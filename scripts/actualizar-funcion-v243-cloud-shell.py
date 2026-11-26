#!/usr/bin/env python3
"""Actualiza exclusivamente la fuente de procesarVentaPos o restaura su fuente anterior."""
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError

P = "punto-de-venta-comic-shop"
OLD = "fa521e96c86e4052934ec9dcd080aceba06e7443"
NEW = "9339da407dfeec141e3287c47785e061dcbfc4ce"
V = "qa-v243-20261126-79dcb917"
BOX, SKU = V + "-caja", V + "-sku"
CF = "https://cloudfunctions.googleapis.com/v2/"
PARENT = f"projects/{P}/locations/us-central1"
FN = f"{PARENT}/functions/procesarVentaPos"
RUN = f"https://run.googleapis.com/v2/{PARENT}/services/procesarventapos"
EA = f"https://eventarc.googleapis.com/v1/projects/{P}/locations/nam5/triggers/procesarventapos-790966"
RULES = f"https://firebaserules.googleapis.com/v1/projects/{P}/releases/cloud.firestore"
DB = f"projects/{P}/databases/(default)/documents"
FS = "https://firestore.googleapis.com/v1/" + DB
UTF = "utf-8"


def need(ok, message):
    if not ok:
        raise RuntimeError(message)


def emit(**data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def command(*args):
    return subprocess.check_output(args, text=True).strip()


def api(url, data=None, method="GET", missing=False, upload=False):
    headers = {"Content-Type": "application/zip" if upload else "application/json"}
    if not upload:
        headers["Authorization"] = "Bearer " + token
    body = data if upload or data is None else json.dumps(data).encode()
    try:
        with urlopen(Request(url, body, headers, method=method), timeout=90) as res:
            return {} if upload else json.load(res)
    except HTTPError as e:
        if missing and e.code == 404:
            return {}
        detail = "" if upload else e.read().decode(errors="replace")[:1800]
        raise RuntimeError(f"{method} {urlsplit(url).path if not upload else 'carga de fuente'} HTTP {e.code} {detail}") from None


def digest(*values):
    return hashlib.sha256(json.dumps(values, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def decode(field):
    k, v = next(iter(field.items()))
    if k == "integerValue":
        return int(v)
    if k == "mapValue":
        return fields(v)
    if k == "arrayValue":
        return [decode(x) for x in v.get("values", [])]
    return v


def fields(doc):
    return {k: decode(v) for k, v in doc.get("fields", {}).items()}


def sale():
    def get(path):
        return fields(api(FS + "/" + quote(path, safe="/:"), missing=True))

    uid = get("cajas/" + BOX).get("uid")
    need(isinstance(uid, str) and uid and "/" not in uid, "La caja sintética carece de UID verificable.")
    conflict_id = "venta-" + digest(uid, V)
    mov_id, event_id = digest(V, SKU), digest(uid, V, "venta.creada")
    paths = {"solicitud": f"usuarios/{uid}/solicitudesVenta/{V}", "marca": f"usuarios/{uid}/operacionesCobro/venta:{V}",
             "venta": f"ventas/{V}", "caja": f"cajas/{BOX}", "sku": f"productos/{SKU}",
             "contador": "contadores/ventas", "conflicto": f"conflictos/{conflict_id}"}
    instant = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=2)).isoformat(timespec="microseconds")
    docs = api(FS + ":batchGet", {"documents": [DB + "/" + v for v in paths.values()], "readTime": instant}, "POST")
    by_name = {d.get("missing") or d["found"]["name"]: d.get("found", {}) for d in docs
               if d.get("missing") or d.get("found")}
    need(all(DB + "/" + p in by_name for p in paths.values()), "Respuesta incompleta de Firestore.")
    sol, mark, v, box, sku, counter, conflict = (fields(by_name[DB + "/" + p]) for p in paths.values())

    def query(col, attr, value):
        filt = {"fieldFilter": {"field": {"fieldPath": attr}, "op": "EQUAL", "value": {"stringValue": value}}}
        rows = api(FS + ":runQuery", {"readTime": instant, "structuredQuery": {
            "from": [{"collectionId": col}], "where": filt, "limit": 5}}, "POST")
        return [(r["document"]["name"].split("/")[-1], fields(r["document"])) for r in rows if "document" in r]

    sales = query("ventas", "cajaId", BOX)
    moves = query("movimientos", "ref", V)
    stock_moves = query("movimientos", "sku", SKU)
    events = query("eventos", "ref.id", V)
    number = v.get("numero")
    sequence = query("ventas", "numero", number) if isinstance(number, str) and number else []
    submitted = sol.get("venta", {})
    payments = v.get("pagos", [])
    paid = len(payments) == 1 and payments == submitted.get("pagos") and all(
        payments[0].get(k) == x for k, x in {"moneda": "COP", "monto": 10000, "equivalenteCop": 10000}.items())
    intact = submitted.get("id") == V and submitted.get("cajaId") == BOX and box.get("uid") == uid
    settled = (intact and mark.get("estadoSync") == "confirmada_servidor" and mark.get("refId") == V
               and v.get("id") == V and v.get("uid") == uid and v.get("cajaId") == BOX and v.get("estado") == "ok"
               and v.get("total") == submitted.get("total") == 10000 and v.get("lineas") == submitted.get("lineas")
               and paid and box.get("movimientos") == [] and sku.get("existencia") == 1 and sku.get("ultimoMov") == mov_id
               and [x[0] for x in sales] == [V] and [x[0] for x in moves] == [mov_id]
               and [x[0] for x in stock_moves] == [mov_id] and [x[0] for x in events] == [event_id]
               and moves[0][1].get("cantidad") == -1 and moves[0][1].get("sku") == SKU
               and events[0][1].get("ref") == {"col": "ventas", "id": V} and not conflict)
    if settled and isinstance(number, str) and re.fullmatch(r"V-[0-9]{4,}", number) and [x[0] for x in sequence] == [V]:
        status = "CONFIRMADA"
    elif settled and not number:
        status = "CONFIRMADA_SIN_NUMERO"
    elif intact and mark.get("estadoSync") == "rechazada_conflicto" and mark.get("refId") == V \
            and mark.get("conflictoId") == conflict_id and conflict and not (v or sales or moves or stock_moves or events) \
            and sku.get("existencia") == 2:
        status = "RECHAZADA"
    elif intact and sku.get("existencia") == 2 and not (v or mark or conflict or sales or moves or stock_moves or events):
        status = "PENDIENTE"
    else:
        status = "INCONSISTENTE"
    return {"estado": status, "id": V, "solicitudExiste": bool(sol), "marca": mark.get("estadoSync"), "numero": number,
            "existencia": sku.get("existencia"), "pagosVerificados": paid, "ventasCaja": len(sales), "ventasConNumero": len(sequence),
            "movimientosInventario": len(moves), "movimientosSku": len(stock_moves), "eventos": len(events),
            "movimientosCaja": len(box.get("movimientos") or []), "conflicto": conflict.get("motivo"),
            "contador": counter.get("n"), "ultimaVentaEsEsta": counter.get("ventaId") == V,
            "solicitudCreateTime": by_name[DB + "/" + paths["solicitud"]].get("createTime"),
            "solicitudUpdateTime": by_name[DB + "/" + paths["solicitud"]].get("updateTime")}


def function_state():
    fn = api(CF + FN)
    svc, build = fn["serviceConfig"], fn["buildConfig"]
    need(fn.get("state") == "ACTIVE" and fn.get("environment") == "GEN_2"
         and svc.get("service", "").endswith("/locations/us-central1/services/procesarventapos")
         and build.get("runtime") == "nodejs22" and build.get("entryPoint") == "procesarVentaPos",
         "La función activa no coincide con procesarVentaPos Gen 2.")
    return fn


def source_of(fn):
    build = fn["buildConfig"]
    return build.get("sourceProvenance", {}).get("resolvedStorageSource") or build.get("source", {}).get("storageSource")


def active_sha(fn):
    return fn.get("labels", {}).get("pos-source-sha")


def snapshot(fn):
    svc, build, trigger = fn["serviceConfig"], fn["buildConfig"], fn["eventTrigger"]
    run, eventarc, rule = (api(url) for url in (RUN, EA, RULES))
    revision = run["latestReadyRevision"].split("/")[-1]
    traffic = [t for t in run["trafficStatuses"] if t.get("percent", 0)]
    need(svc.get("revision", "").split("/")[-1] == revision and len(traffic) == 1
         and traffic[0]["percent"] == 100
         and (traffic[0].get("revision", "").split("/")[-1] == revision
              or (not traffic[0].get("revision") and traffic[0].get("type") == "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
                  and run.get("latestCreatedRevision") == run.get("latestReadyRevision"))),
         "Cloud Run no tiene el 100 % del tráfico en la revisión de la función.")
    need(trigger["trigger"] == eventarc["name"] and trigger.get("retryPolicy") == "RETRY_POLICY_RETRY"
         and rule["rulesetName"].split("/")[-1] == "8b7c6bda-e0f3-49d6-9888-e8ca445dfec6",
         "El disparador o el ruleset vigente no coincide.")
    route = {k: eventarc[k] for k in ("name", "destination", "serviceAccount", "transport")}
    route["eventFilters"] = sorted(eventarc["eventFilters"], key=lambda f: f["attribute"])
    return {"revision": revision, "eventarc": route,
            "runtimeServiceAccount": svc.get("serviceAccountEmail"), "buildServiceAccount": build.get("serviceAccount"),
            "triggerServiceAccount": trigger.get("serviceAccountEmail"), "ingress": svc.get("ingressSettings"),
            "ruleset": rule["rulesetName"]}


def save(state):
    tmp = manifest.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding=UTF)
    tmp.replace(manifest)


def authorization(phrase):
    print(f"Autorización del propietario para {P}/procesarVentaPos. Escribe: {phrase}", flush=True)
    with open("/dev/tty", encoding=UTF) as tty:
        need(tty.readline().strip() == phrase, "Autorización ausente.")


def archive():
    need(command("git", "-C", repo, "rev-parse", NEW + "^{commit}") == NEW, "SHA candidato ausente.")
    zip_data = subprocess.check_output(["git", "-C", repo, "archive", "--format=zip", NEW + ":funciones"])
    out = api(CF + PARENT + "/functions:generateUploadUrl", {"environment": "GEN_2"}, "POST")
    url = urlsplit(out["uploadUrl"])
    need(url.scheme == "https" and url.hostname == "storage.googleapis.com", "Destino inesperado para la carga.")
    api(out["uploadUrl"], zip_data, "PUT", upload=True)
    checksum = hashlib.sha256(zip_data).hexdigest()
    emit(zipSha256=checksum)
    return out["storageSource"]


def storage_url(source):
    bucket = quote(source["bucket"], safe="")
    name = quote(source["object"], safe="")
    generation = str(source["generation"])
    need(generation.isdecimal(), "Generación anterior inválida.")
    return f"https://storage.googleapis.com/storage/v1/b/{bucket}/o/{name}?generation={generation}"


def verify_saved_source(source):
    meta = api(storage_url(source))
    generation = str(source["generation"])
    need(str(meta.get("generation")) == generation and meta.get("bucket") == source["bucket"]
         and meta.get("name") == source["object"] and int(meta["size"]) > 0,
         "La fuente anterior no está disponible para reversión.")


def operations(state):
    for record in state.get("operaciones", []):
        name = record["nombre"]
        need(re.fullmatch(r"projects/(?:punto-de-venta-comic-shop|570684941224)/locations/us-central1/operations/[\w.-]+", name),
             "El manifiesto contiene una operación fuera del alcance.")
        op = api(CF + name)
        emit(operacion=name, done=op.get("done", False), error=op.get("error"))
        yield op


def change(before, source, target, state, baseline):
    current = function_state()
    need(active_sha(current) == active_sha(before)
         and current["serviceConfig"].get("revision") == before["serviceConfig"].get("revision")
         and current["eventTrigger"].get("trigger") == before["eventTrigger"].get("trigger"),
         "Cambió el SHA, la revisión o el disparador desde la lectura inicial.")
    labels = {**current.get("labels", {}), "pos-source-sha": target}
    op = api(CF + FN + "?updateMask=buildConfig.source,labels",
             {"name": FN, "buildConfig": {"source": {"storageSource": source}}, "labels": labels}, "PATCH")
    name = op["name"]
    need(re.fullmatch(r"projects/(?:punto-de-venta-comic-shop|570684941224)/locations/us-central1/operations/[\w.-]+", name),
         f"Operación devuelta con ruta inesperada: {name}")
    state.setdefault("operaciones", []).append({"nombre": name, "objetivo": target})
    save(state)
    emit(operacion=name, objetivo=target)
    deadline = time.monotonic() + 1500
    while not op.get("done"):
        need(time.monotonic() < deadline, "Consulta la operación guardada antes de intentar otro cambio.")
        time.sleep(10)
        op = api(CF + name)
    need(not op.get("error"), f"Cloud Functions rechazó el cambio: {op.get('error')}")
    fn = function_state()
    verified = snapshot(fn)
    need(active_sha(fn) == target and verified["revision"] != baseline["revision"], "El SHA o la revisión no coincide.")
    need(all(verified[k] == baseline[k] for k in verified if k != "revision"),
         "Cambió una identidad, el transporte, Eventarc, el ingreso o el ruleset.")
    state["verificado"] = {"sha": target, **verified}
    save(state)
    emit(estado="REVISION_VERIFICADA", sha=target, revision=verified["revision"])
    return verified


def diagnostics(current, since):
    revision = current["revision"]
    subscription = current["eventarc"]["transport"]["pubsub"]["subscription"].split("/")[-1]
    filt = (f'timestamp>="{since}" AND ('
            f'(resource.type="cloud_run_revision" AND resource.labels.revision_name="{revision}" '
            'AND (severity>=ERROR OR httpRequest.status>=400)) OR '
            'protoPayload.resourceName:"procesarventapos-790966" OR '
            f'resource.labels.subscription_id="{subscription}" OR SEARCH("{V}"))')
    out = api("https://logging.googleapis.com/v2/entries:list", {
        "resourceNames": ["projects/" + P], "filter": filt, "orderBy": "timestamp desc", "pageSize": 20}, "POST")
    emit(contextoDeRevisionSinCorrelacionGarantizada=[{
        "hora": e.get("timestamp"), "trace": e.get("trace"), "http": e.get("httpRequest", {}).get("status"),
        "mensaje": (e.get("textPayload") or e.get("jsonPayload", {}).get("message") or "")[:1000]}
        for e in out.get("entries", [])], mas=bool(out.get("nextPageToken")))


def main(mode):
    state = json.loads(manifest.read_text(encoding=UTF))
    if mode == "diagnosticar":
        list(operations(state))
        emit(solicitud=sale())
        return

    need(mode in ("actualizar", "revertir"), "Modo inválido.")
    need(all(op.get("done") for op in operations(state)), "Hay una operación en curso. Usa diagnosticar.")
    old = state["anterior"]
    before = function_state()
    baseline = snapshot(before)
    source = old["source"]
    need(old["sha"] == OLD and source.get("generation"), "El manifiesto carece de fuente anterior verificable.")
    verify_saved_source(source)
    if mode == "revertir":
        need(active_sha(before) == NEW and state.get("baselineMinima"),
             "La reversión requiere que el SHA candidato esté activo y registrado.")
        need(all(baseline[k] == state["baselineMinima"][k] for k in baseline if k != "revision"),
             "Cambió la configuración esencial desde la actualización.")
        authorization("AUTORIZO_REVERTIR " + OLD)
        change(before, source, OLD, state, baseline)
        emit(solicitud=sale())
        return

    need(active_sha(before) == OLD and source_of(before) == source, "La fuente activa difiere de la respaldada.")
    original = sale()
    need(original["estado"] in ("PENDIENTE", "CONFIRMADA", "CONFIRMADA_SIN_NUMERO")
         and all(original[k] and original[k] == state["solicitudAntes"][k]
                 for k in ("solicitudCreateTime", "solicitudUpdateTime")),
         "El estado o la identidad de la solicitud original cambió. Usa diagnosticar.")
    emit(solicitudAntes=original, revisionAnterior=baseline["revision"], manifiesto=str(manifest))
    authorization("AUTORIZO_ACTUALIZAR " + NEW)
    state["baselineMinima"] = baseline
    state["inicio"] = dt.datetime.now(dt.timezone.utc).isoformat()
    target_source = archive()
    state["cargaCandidata"] = target_source
    save(state)
    verified = change(before, target_source, NEW, state, baseline)
    until = time.monotonic() + 120
    result = sale()
    while result["estado"] in ("PENDIENTE", "CONFIRMADA_SIN_NUMERO") and time.monotonic() < until:
        time.sleep(8)
        result = sale()
    need(all(result[k] == original[k] for k in ("solicitudCreateTime", "solicitudUpdateTime")),
         "La solicitud original cambió durante la verificación.")
    if result["estado"] == "CONFIRMADA":
        recovery = "YA_CONFIRMADA" if original["estado"] == "CONFIRMADA" else "OBSERVADA"
    else:
        recovery = "NO_VERIFICADA"
    emit(solicitudDespues=result, recuperacion=recovery)
    if recovery == "NO_VERIFICADA":
        diagnostics(verified, state["inicio"])


if __name__ == "__main__":
    os.umask(0o077)
    try:
        mode, repo, path = sys.argv[1:]
        manifest = Path(path)
        token = command("gcloud", "auth", "print-access-token")
        need(token, "Sin credencial de Cloud Shell.")
        main(mode)
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as e:
        sys.exit(f"BLOQUEADO: {e}")
