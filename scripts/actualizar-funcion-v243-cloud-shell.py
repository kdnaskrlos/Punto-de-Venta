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


def api(url, data=None, method="GET", missing=False, upload=False, binary=False):
    headers = {"Content-Type": "application/zip" if upload else "application/json"}
    if not upload:
        headers["Authorization"] = "Bearer " + token
    body = data if upload or data is None else json.dumps(data).encode()
    try:
        with urlopen(Request(url, body, headers, method=method), timeout=90) as res:
            return {} if upload else res.read() if binary else json.load(res)
    except HTTPError as e:
        if missing and e.code == 404:
            return {}
        detail = "" if upload else e.read().decode(errors="replace")[:1800]
        raise RuntimeError(f"{method} {urlsplit(url).path if not upload else 'carga de fuente'} HTTP {e.code} {detail}") from None


def ci():
    run = json.loads(command("gh", "api", "repos/kdnaskrlos/Punto-de-Venta/actions/runs/45852855011"))
    need((run.get("head_sha"), run.get("workflow_id"), run.get("status"), run.get("conclusion"))
         == (NEW, 428319907, "completed", "success"), "La CI del SHA candidato debe terminar con éxito.")
    emit(ci=run["html_url"], sha=NEW)


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


def snapshot():
    fn, run, ev, rule = (api(url) for url in (CF + FN, RUN, EA, RULES))
    svc = fn["serviceConfig"]
    ea = fn["eventTrigger"]
    topic = ev["transport"]["pubsub"]["topic"]
    sub = ev["transport"]["pubsub"]["subscription"]
    allowed = (P, "570684941224")
    for name, kind in ((topic, "topics"), (sub, "subscriptions")):
        need(re.fullmatch(rf"projects/(?:{'|'.join(allowed)})/{kind}/[\w.-]+", name), "Transporte fuera del proyecto.")
    pub = api("https://pubsub.googleapis.com/v1/" + sub)
    need(pub.get("topic") == topic, "La suscripción apunta a otro tema.")
    pub_topic = api("https://pubsub.googleapis.com/v1/" + topic)
    ready = run["latestReadyRevision"].split("/")[-1]
    traffic = [t for t in run["trafficStatuses"] if t.get("percent", 0)]
    need(fn.get("state") == "ACTIVE" and fn.get("environment") == "GEN_2"
         and svc.get("service", "").endswith("/locations/us-central1/services/procesarventapos")
         and svc.get("revision", "").split("/")[-1] == ready
         and run["terminalCondition"]["state"] == "CONDITION_SUCCEEDED" and not run.get("reconciling")
         and len(traffic) == 1 and traffic[0].get("percent") == 100
         and (traffic[0].get("revision", "").split("/")[-1] == ready or
              (not traffic[0].get("revision") and traffic[0].get("type") == "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
               and run.get("latestCreatedRevision") == run.get("latestReadyRevision"))),
         "La función y su revisión de Cloud Run deben estar activas con 100 % del tráfico.")
    need(ea["trigger"] == ev["name"] and ev["name"].endswith("/locations/nam5/triggers/procesarventapos-790966")
         and ea.get("retryPolicy") == "RETRY_POLICY_RETRY"
         and rule["rulesetName"].split("/")[-1] == "8b7c6bda-e0f3-49d6-9888-e8ca445dfec6", "Eventarc o ruleset difiere.")
    template = run["template"]
    for container in template.get("containers", []):
        container.pop("image", None)
    template.pop("revision", None)
    # Cloud Functions puede propagar la etiqueta de versión a la plantilla.
    template.get("labels", {}).pop("pos-source-sha", None)
    if not template.get("labels"):
        template.pop("labels", None)
    iam = api(RUN + ":getIamPolicy?options.requestedPolicyVersion=3")
    build = fn["buildConfig"]
    return {"sha": fn["labels"].get("pos-source-sha"), "fnLabels": fn["labels"], "revision": ready,
            "updateTime": fn["updateTime"],
            "source": build.get("sourceProvenance", {}).get("resolvedStorageSource") or build.get("source", {}).get("storageSource"),
            "config": {"service": {k: v for k, v in svc.items() if k not in ("revision", "uri")},
                       "build": {k: v for k, v in build.items() if k not in ("build", "source", "sourceProvenance")},
                       "triggerFunction": {k: v for k, v in ea.items() if k != "updateTime"},
                       "trigger": {k: v for k, v in ev.items() if k not in ("etag", "updateTime")},
                       "subscription": pub, "topic": pub_topic, "rule": rule, "runIam": iam,
                       "runTemplate": template, "ingress": run.get("ingress"), "invokerIamDisabled": run.get("invokerIamDisabled")}}


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
    return out["storageSource"], checksum


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


def source_matches(actual, submitted, checksum):
    if not actual:
        return False
    if all(str(actual.get(k)) == str(v) for k, v in submitted.items()):
        return True
    # Cloud Functions puede copiar el ZIP al bucket de fuentes resueltas.
    return hashlib.sha256(api(storage_url(actual) + "&alt=media", binary=True)).hexdigest() == checksum


def change(before, source, target, state, checksum):
    need(snapshot() == before, "El estado cambió después del preflight. Detén la operación.")
    labels = {**before["fnLabels"], "pos-source-sha": target}
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
    need(not op.get("error"), f"Cloud Functions rechazó la actualización: {op.get('error')}")
    after = snapshot()
    need(after["config"] == before["config"], "Cambió la configuración protegida. Revisa el manifiesto y la operación.")
    need(after["sha"] == target and after["revision"] != before["revision"]
         and source_matches(after["source"], source, checksum),
         "El SHA, la revisión o la procedencia activa no coinciden con la carga.")
    state["verificado"] = after
    save(state)
    emit(estado="REVISION_VERIFICADA", sha=target, revision=after["revision"])


def diagnostics(current, since):
    revision = current["revision"]
    subscription = current["config"]["subscription"]["name"].split("/")[-1]
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
    if mode == "diagnosticar":
        state = json.loads(manifest.read_text(encoding=UTF)) if manifest.exists() else {}
        for operation in state.get("operaciones", []):
            op = api(CF + operation["nombre"])
            emit(operacion=operation, done=op.get("done", False), error=op.get("error"))
        emit(solicitud=sale())
        now = snapshot()
        emit(sha=now["sha"], revision=now["revision"])
        diagnostics(now, state.get("inicio") or dt.datetime.now(dt.timezone.utc).isoformat()[:10] + "T00:00:00Z")
        return
    before = snapshot()
    if mode == "actualizar":
        ci()
        need(not manifest.exists(), "Ya existe un manifiesto. Usa diagnosticar antes de cualquier cambio.")
        need(before["sha"] == OLD and before["source"] and before["source"].get("generation"),
             "La fuente anterior debe coincidir con el SHA desplegado y tener generación de Storage.")
        verify_saved_source(before["source"])
        original = sale()
        need(original["estado"] == "PENDIENTE" and original["solicitudCreateTime"] and original["solicitudUpdateTime"],
             "La solicitud original debe estar pendiente y tener marcas de tiempo verificables.")
        emit(solicitudAntes=original, revisionAnterior=before["revision"], manifiesto=str(manifest))
        authorization("AUTORIZO_ACTUALIZAR " + NEW)
        state = {"anterior": before, "solicitudAntes": original, "inicio": dt.datetime.now(dt.timezone.utc).isoformat()}
        save(state)
        target_source, checksum = archive()
        state["cargaCandidata"] = target_source
        state["sha256Candidata"] = checksum
        save(state)
        change(before, target_source, NEW, state, checksum)
        until = time.monotonic() + 120
        result = sale()
        while result["estado"] in ("PENDIENTE", "CONFIRMADA_SIN_NUMERO") and time.monotonic() < until:
            time.sleep(8)
            result = sale()
        need(all(result[k] == original[k] for k in ("solicitudCreateTime", "solicitudUpdateTime")),
             "La solicitud original cambió durante la verificación.")
        emit(solicitudDespues=result, recuperacion="OBSERVADA" if result["estado"] == "CONFIRMADA" else "NO_VERIFICADA")
        if result["estado"] != "CONFIRMADA":
            diagnostics(state["verificado"], state["inicio"])
        return
    need(mode == "revertir", "Modo inválido.")
    state = json.loads(manifest.read_text(encoding=UTF))
    old = state["anterior"]
    need(old["sha"] == OLD and old["source"] and before["sha"] == NEW and before["config"] == old["config"]
         and before["source"] and state.get("cargaCandidata") and
         source_matches(before["source"], state["cargaCandidata"], state["sha256Candidata"]),
         "El estado actual no coincide con la actualización registrada para revertir.")
    verify_saved_source(old["source"])
    authorization("AUTORIZO_REVERTIR " + OLD)
    checksum = hashlib.sha256(api(storage_url(old["source"]) + "&alt=media", binary=True)).hexdigest()
    change(before, old["source"], OLD, state, checksum)
    emit(solicitudDespuesDeRevertir=sale())


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
