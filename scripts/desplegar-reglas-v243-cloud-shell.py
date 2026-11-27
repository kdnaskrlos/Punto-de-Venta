#!/usr/bin/env python3
"""Publica solo firestore.rules de POS v2.43 y conserva la reversión."""
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PROJECT = "punto-de-venta-comic-shop"
P = f"projects/{PROJECT}"
RELEASE = f"{P}/releases/cloud.firestore"
SHA = "fa521e96c86e4052934ec9dcd080aceba06e7443"
NAME = "firestore.rules"
CANDIDATE_SHA256 = "f5242399a61a0d5318d8f65ebeff36a1fba94ba3761e3e565b165cc432226d0f"
HOST = "firebaserules.googleapis.com"
DOC = "/databases/(default)/documents/"
UID = "pos-v242-fixture"
WHO = "pos-v242-operadora"
CAJA = "pos-v242-caja"
VENTA = "pos-v242-venta"
APARTADO = "pos-v242-apartado"


class Blocked(RuntimeError):
    pass


def require(ok, message):
    if not ok:
        raise Blocked(message)


def progress(message):
    print(message, flush=True)


def api(host, path, method="GET", data=None, missing=False):
    req = Request(f"https://{host}/{path}", method=method,
                  data=json.dumps(data).encode() if data is not None else None,
                  headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=60) as response:
            return json.load(response)
    except HTTPError as error:
        if missing and error.code == 404:
            return None
        try:
            detail = json.loads(error.read()).get("error", {}).get("message", "")
        except (ValueError, AttributeError):
            detail = ""
        raise Blocked(f"{method} {path} HTTP {error.code}. {detail}") from None
    except (URLError, TimeoutError, ValueError):
        raise Blocked(f"{method} {path}: respuesta no verificable.") from None


def digest(content):
    return hashlib.sha256(content).hexdigest()


def valid_ruleset(name):
    return isinstance(name, str) and re.fullmatch(
        r"projects/(?:punto-de-venta-comic-shop|570684941224)/rulesets/[A-Za-z0-9_-]+", name
    ) is not None


def files(source):
    rows = source.get("files", [])
    result = {row["name"]: row["content"].encode("utf-8") for row in rows}
    require(rows and len(result) == len(rows), "La fuente de reglas está vacía o tiene nombres repetidos.")
    return result


def fingerprint(source):
    return {name: digest(content) for name, content in files(source).items()}


def ruleset(name):
    require(valid_ruleset(name), f"ID de ruleset fuera del proyecto esperado: {name}")
    return api(HOST, "v1/" + name)["source"]


def release():
    active = api(HOST, "v1/" + RELEASE)
    require(valid_ruleset(active.get("rulesetName")) and bool(active.get("updateTime")),
            "El release de Firestore no tiene un ruleset y una fecha verificables.")
    return active


def stamp(value):
    return value["rulesetName"], value["updateTime"]


def point_release(name):
    require(valid_ruleset(name), "El destino de la actualización no pertenece al proyecto autorizado.")
    return api(HOST, "v1/" + RELEASE, "PATCH", {
        "release": {"name": RELEASE, "rulesetName": name}, "updateMask": "rulesetName"
    })


def check_legacy_mode():
    state = api("firestore.googleapis.com", f"v1/{P}/databases/(default)/documents/sistema/estado"
                "?mask.fieldPaths=soloVentasProcesadas", missing=True) or {}
    flag = state.get("fields", {}).get("soloVentasProcesadas")
    require(flag is None or flag == {"booleanValue": False},
            "soloVentasProcesadas está activo o tiene un valor inesperado.")


def mock(function, document, value):
    return {"function": function, "args": [{"exactValue": DOC + document}], "result": {"value": value}}


def lookup(function, document, data):
    return mock(function, document, {"data": data})


def case(method, document, uid=UID, expected="ALLOW", previous=None, proposed=None, mocks=()):
    request = {"path": DOC + document, "method": method}
    if uid:
        request["auth"] = {"uid": uid}
    if proposed is not None:
        request["resource"] = {"data": proposed}
    result = {"request": request, "expectation": expected, "functionMocks": list(mocks)}
    if previous is not None:
        result["resource"] = {"data": previous}
    return result


def scenarios():
    profile = f"usuarios/{UID}"
    seller = {"activo": True, "rol": "vendedora", "usuario": WHO}
    own = (mock("exists", profile, True), lookup("get", profile, seller))
    admin = (mock("exists", profile, True), lookup("get", profile, {**seller, "rol": "admin"}))
    caja = {"usuario": WHO, "uid": UID, "estado": "abierta", "tipo": "tienda"}
    sales_path = "ventas/" + VENTA
    sale = {"id": VENTA, "usuario": WHO, "uid": UID, "estado": "ok", "cajaId": CAJA,
            "numero": None, "total": 25000, "offline": False, "creada": "2026-11-25T12:00:00.000Z"}
    box = ("cajas/" + CAJA, caja)
    legacy = own + (lookup("get", *box), mock("exists", "sistema/estado", True),
                    lookup("get", "sistema/estado", {"soloVentasProcesadas": False}),
                    mock("existsAfter", f"{profile}/solicitudesVenta/{VENTA}", False))
    reservation = "apartados/" + APARTADO
    before = {"usuario": WHO, "estado": "pendiente", "total": 25000, "saldo": 0}
    after = {**before, "estado": "completado", "ventaId": VENTA}
    historic_receipt = {**sale, "desdeApartado": APARTADO, "abonosPrevios": before["total"] - before["saldo"]}
    closing = legacy + (mock("exists", reservation, True), lookup("get", reservation, before),
                        mock("existsAfter", reservation, True), lookup("getAfter", reservation, after))
    # Las reglas activas pueden comprobar existencia y la candidata consulta el documento.
    # Ambos mocks describen el mismo comprobante creado en el lote simulado.
    transition = own + (mock("exists", sales_path, False), mock("existsAfter", sales_path, True),
                        lookup("getAfter", sales_path, historic_receipt))
    core = [
        ("resolución de login antes de Auth", case("get", f"logins/{WHO}", uid=None,
                                                   previous={"uid": UID, "email": "fixture@example.invalid"})),
        ("lectura del perfil propio", case("get", profile, previous=seller, mocks=own)),
        ("catálogo", case("get", "productos/pos-v242-sku", previous={"existencia": 3}, mocks=own)),
        ("ajustes", case("get", "ajustes/general", previous={}, mocks=own)),
        ("puntero de caja", case("get", f"cajaAbierta/{WHO}", previous={"cajaId": CAJA}, mocks=own)),
        ("caja propia", case("get", box[0], previous=caja, mocks=own)),
        ("comprobante propio", case("get", sales_path, previous=sale, mocks=own)),
        ("lectura de apartado", case("get", reservation, previous=before, mocks=own)),
        ("alta de comprobante directo simulado", case("create", sales_path, proposed=sale, mocks=legacy)),
        ("liquidación histórica vinculada simulada", case(
            "create", sales_path, proposed=historic_receipt, mocks=closing)),
        ("transición histórica del apartado simulada", case(
            "update", reservation, previous=before, proposed=after, mocks=transition)),
        ("numeración por gestión simulada", case("update", sales_path, previous=sale,
                                                  proposed={**sale, "numero": "V-0001"}, mocks=admin))
    ]
    controls = [
        ("rechazo de comprobante sin autenticación", case("create", sales_path, uid=None,
                                                           expected="DENY", proposed=sale)),
        ("rechazo de alterar el interruptor desde el POS", case(
            "update", "sistema/estado", previous={"soloVentasProcesadas": False},
            proposed={"soloVentasProcesadas": True}, expected="DENY", mocks=admin))
    ]
    return core, controls


def run_simulation(source, suite, label):
    result = api(HOST, f"v1/{P}:test", "POST",
                 {"source": source, "testSuite": {"testCases": [test for _, test in suite]}})
    errors = [i.get("description") for i in result.get("issues", []) if i.get("severity") == "ERROR"]
    require(not errors, f"Compilación {label}: {errors}")
    results = result.get("testResults", [])
    require(len(results) == len(suite), f"El simulador devolvió resultados incompletos para {label}.")
    rejected = []
    for (name, _), check in zip(suite, results):
        state = check.get("state", "indeterminado")
        progress(f"  {label} | {state} | {name}")
        if state != "SUCCESS":
            rejected.append(f"{name}: {check.get('debugMessages', [])}")
    require(not rejected, f"Compatibilidad {label}: " + "; ".join(rejected))


def save_manifest(directory, manifest):
    staging = directory / ".manifest.tmp"
    staging.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    staging.replace(directory / "manifest.json")


def status_after_error():
    try:
        active = release()
        progress(f"Release observado tras el fallo: {active['rulesetName']} ({active['updateTime']}).")
    except Blocked as error:
        progress(f"No se pudo determinar el puntero activo tras el fallo: {error}")


def publish(repo):
    progress("[1/5] Recuperando reglas activas y fijando la candidata.")
    candidate_bytes = subprocess.check_output(["git", "-C", repo, "show", SHA + ":" + NAME])
    candidate = {"files": [{"name": NAME, "content": candidate_bytes.decode("utf-8")}]}
    expected = {NAME: digest(candidate_bytes)}
    require(expected[NAME] == CANDIDATE_SHA256, "El archivo de Git no tiene la huella candidata autorizada.")
    old = release()
    previous = ruleset(old["rulesetName"])
    previous_hash = fingerprint(previous)
    directory = Path(tempfile.mkdtemp(prefix="pos-reglas-v243-", dir=Path.home()))
    shutil.copyfile(__file__, directory / "reglas-v243.py")
    (directory / "ruleset-anterior.json").write_text(
        json.dumps(previous, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (directory / "firestore.rules").write_bytes(candidate_bytes)
    previous_files = files(previous)
    before_text = []
    for name, content in sorted(previous_files.items()):
        if len(previous_files) > 1 or name != NAME:
            before_text.append(f"// Archivo: {name}\n")
        before_text.extend(content.decode("utf-8").splitlines(keepends=True))
    diff = "".join(difflib.unified_diff(before_text, candidate_bytes.decode("utf-8").splitlines(keepends=True),
                                        fromfile="activo", tofile="candidata"))
    (directory / "reglas.diff").write_text(diff, encoding="utf-8")
    manifest = {"proyecto": PROJECT, "commit": SHA, "release": RELEASE,
                "anterior": old, "sha256Anterior": previous_hash, "sha256Candidata": expected}
    save_manifest(directory, manifest)
    progress(f"Respaldo de reglas: {directory}")
    progress(f"Ruleset anterior: {old['rulesetName']}")
    progress(f"SHA-256 candidata: {expected[NAME]}")
    progress(f"Reversión tras un alta: python3 '{directory / 'reglas-v243.py'}' revertir '{directory}'")

    check_legacy_mode()
    progress("[2/5] Evaluando permisos de v2.42 con solicitudes simuladas. Firestore no ejecuta esas operaciones.")
    core, controls = scenarios()
    simulation_errors = []
    for label, source, suite in (("activo", previous, core), ("candidata", candidate, core + controls)):
        try:
            run_simulation(source, suite, label)
        except Blocked as error:
            simulation_errors.append(f"{label}: {error}")
    require(not simulation_errors, " | ".join(simulation_errors))
    manifest["simulacionesV242"] = {"activo": len(core), "candidata": len(core) + len(controls)}
    save_manifest(directory, manifest)

    progress("[3/5] Validando el puntero y creando el ruleset de la candidata.")
    require(stamp(release()) == stamp(old), "El release cambió durante la comprobación. Se detuvo la publicación.")
    check_legacy_mode()
    if expected == previous_hash:
        progress(json.dumps({"estado": "REGLAS_YA_ACTIVAS_VERIFICADAS", "ruleset": old["rulesetName"],
                             "sha256": expected[NAME], "respaldo": str(directory)}, ensure_ascii=False))
        return
    name = api(HOST, "v1/" + P + "/rulesets", "POST", {"source": candidate})["name"]
    require(valid_ruleset(name), "La API devolvió un ID de ruleset inesperado.")
    manifest["candidata"] = name
    save_manifest(directory, manifest)
    require(fingerprint(ruleset(name)) == expected, "La huella del ruleset creado difiere de la candidata.")
    require(stamp(release()) == stamp(old), "El release cambió antes de publicarse la candidata. Se detuvo la publicación.")
    check_legacy_mode()

    progress("[4/5] Actualizando exclusivamente cloud.firestore.")
    try:
        result = point_release(name)
        if result.get("rulesetName") == name and result.get("updateTime"):
            manifest["activado"] = result["updateTime"]
            save_manifest(directory, manifest)
        progress("[5/5] Releyendo el ruleset activo y verificando su SHA-256.")
        active = release()
        require(active["rulesetName"] == name and active["updateTime"] == manifest.get("activado"),
                "El release observado no coincide con la actualización confirmada.")
        require(fingerprint(ruleset(name)) == expected, "El contenido activo no coincide con la candidata.")
    except Blocked:
        status_after_error()
        raise
    progress(json.dumps({"estado": "REGLAS_V243_VERIFICADAS", "proyecto": PROJECT, "commit": SHA,
                         "ruleset": name, "sha256": expected[NAME], "anterior": old["rulesetName"],
                         "respaldo": str(directory)}, ensure_ascii=False))


def revert(directory):
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    require((manifest.get("proyecto"), manifest.get("commit"), manifest.get("release")) == (PROJECT, SHA, RELEASE),
            "El respaldo no corresponde al despliegue de reglas autorizado.")
    old = manifest["anterior"]["rulesetName"]
    candidate = manifest.get("candidata")
    require(valid_ruleset(old) and valid_ruleset(candidate) and old != candidate,
            "El respaldo carece de un par verificable de rulesets anterior y candidato.")
    active = release()
    if active["rulesetName"] == old:
        require(fingerprint(ruleset(old)) == manifest["sha256Anterior"], "La huella activa anterior difiere del respaldo.")
        progress(f"La versión anterior ya está activa y verificada: {old}")
        return
    require(active["rulesetName"] == candidate and (
        not manifest.get("activado") or active["updateTime"] == manifest["activado"]),
        "El release ya no corresponde a este despliegue; no se reemplazará una versión ajena.")
    require(fingerprint(ruleset(candidate)) == manifest["sha256Candidata"], "La huella candidata difiere del respaldo.")
    saved = json.loads((directory / "ruleset-anterior.json").read_text(encoding="utf-8"))
    require(fingerprint(saved) == manifest["sha256Anterior"] == fingerprint(ruleset(old)),
            "La copia anterior o el ruleset remoto difiere de la huella conservada.")
    progress(f"Reversión de cloud.firestore en {PROJECT}: {candidate} → {old}.")
    with open("/dev/tty") as tty:
        progress("Con el piloto y los clientes cerrados, escribe REVERTIR_REGLAS_V243 para confirmar.")
        require(tty.readline().strip() == "REVERTIR_REGLAS_V243", "Reversión cancelada.")
    require(stamp(release()) == stamp(active), "El release cambió durante la confirmación.")
    try:
        point_release(old)
        require(release()["rulesetName"] == old and fingerprint(ruleset(old)) == manifest["sha256Anterior"],
                "La reversión no se pudo verificar.")
    except Blocked:
        status_after_error()
        raise
    progress(f"REGLAS_REVERTIDAS_Y_VERIFICADAS {old}")


if __name__ == "__main__":
    os.umask(0o077)
    try:
        require(len(sys.argv) == 3 and sys.argv[1] in {"publicar", "revertir"},
                "Uso: reglas-v243.py publicar REPO | revertir DIRECTORIO_RESPALDO")
        token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
        require(bool(token), "Cloud Shell no devolvió una credencial activa.")
        if sys.argv[1] == "publicar":
            publish(sys.argv[2])
        else:
            revert(Path(sys.argv[2]))
    except (Blocked, OSError, KeyError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(f"BLOQUEADO: {error}")
