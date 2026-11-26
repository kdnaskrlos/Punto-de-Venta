#!/usr/bin/env python3
"""Entrega dirigida de la solicitud sintética original a procesarVentaPos."""
import base64
import importlib.util
import json
import re
import sys
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "pos", Path(__file__).with_name("actualizar-funcion-v243-cloud-shell.py"))
pos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pos)

QUEUES = "https://cloudtasks.googleapis.com/v2/" + pos.PARENT + "/queues"
QUEUE = pos.PARENT + "/queues/pos-recuperacion-v243"
QUEUE_URL = "https://cloudtasks.googleapis.com/v2/" + QUEUE
TASK = QUEUE + "/tasks/recuperar-" + pos.V


def cloud_event(doc):
    source = f"projects/{pos.P}/databases/(default)"
    return {"specversion": "1.0", "id": "recuperar-" + pos.V,
            "type": "google.cloud.firestore.document.v1.created",
            "source": "//firestore.googleapis.com/" + source,
            "subject": doc["name"].removeprefix(source + "/"),
            "database": "(default)", "datacontenttype": "application/json",
            "data": {"value": {k: doc[k] for k in ("name", "createTime", "updateTime")}}}


def create_once(url, body):
    try:
        return pos.api(url, body, "POST")
    except RuntimeError as error:
        if "HTTP 409" in str(error) and "ALREADY_EXISTS" in str(error):
            return None
        raise


def recover(manifest):
    original = json.loads(Path(manifest).read_text(encoding="utf-8"))["solicitudAntes"]
    timestamps = ("solicitudCreateTime", "solicitudUpdateTime")
    before = pos.sale()
    pos.emit(antes=before)
    pos.need(all(before[k] and before[k] == original[k] for k in timestamps),
             "La solicitud no coincide con la registrada en el manifiesto.")
    if before["estado"] == "CONFIRMADA":
        pos.emit(estado="YA_CONFIRMADA", venta=before)
        return
    pos.need(before["estado"] in ("PENDIENTE", "CONFIRMADA_SIN_NUMERO"),
             "El estado de la solicitud requiere revisión antes de reenviar.")

    fn = pos.function_state()
    svc = fn["serviceConfig"]
    pos.need(pos.active_sha(fn) == pos.NEW and svc.get("revision", "").split("/")[-1] == "procesarventapos-00002-pas",
             "La revisión activa no coincide con el despliegue informado.")
    url = svc.get("uri", "").rstrip("/")
    identity = fn["eventTrigger"].get("serviceAccountEmail", "")
    pos.need(re.fullmatch(r"https://procesarventapos-[a-z0-9-]+(?:\.us-central1)?\.run\.app", url)
             and identity == "570684941224-compute@developer.gserviceaccount.com",
             "URL interna o identidad del disparador inesperada.")

    box = pos.fields(pos.api(pos.FS + "/cajas/" + pos.BOX))
    uid = box.get("uid")
    pos.need(isinstance(uid, str) and uid and "/" not in uid, "UID de caja inválido.")
    route = f"usuarios/{uid}/solicitudesVenta/{pos.V}"
    doc = pos.api(pos.FS + "/" + pos.quote(route, safe="/"))
    pos.need(doc["name"] == pos.DB + "/" + route and doc["createTime"] == before[timestamps[0]]
             and doc["updateTime"] == before[timestamps[1]], "Cambió el documento de solicitud.")
    body = base64.b64encode(json.dumps(cloud_event(doc)).encode()).decode()
    queue = pos.api(QUEUE_URL, missing=True)
    pos.emit(destino=url, cola=QUEUE, tarea=TASK, cuenta=identity, creaCola=not bool(queue))
    pos.authorization("AUTORIZO_RECUPERAR " + pos.V)
    if not queue:
        queue = create_once(QUEUES, {"name": QUEUE, "retryConfig": {"maxAttempts": 1}})
        if not queue:
            queue = pos.api(QUEUE_URL)
    pos.need(queue.get("name") in (QUEUE, QUEUE.replace(pos.P, "570684941224", 1)) and queue.get("state") == "RUNNING"
             and queue.get("retryConfig", {}).get("maxAttempts") == 1 and not queue.get("httpTarget"),
             "La cola dedicada no está operativa o tiene configuración inesperada.")
    task = create_once(QUEUE_URL + "/tasks", {"task": {
        "name": TASK, "httpRequest": {"url": url, "httpMethod": "POST",
            "headers": {"Content-Type": "application/cloudevents+json"}, "body": body,
            "oidcToken": {"serviceAccountEmail": identity, "audience": url}}}})
    if task:
        pos.need(task.get("name") in (TASK, TASK.replace(pos.P, "570684941224", 1)), "Cloud Tasks devolvió otro identificador.")
    pos.emit(envio="ENCOLADO" if task else "TAREA_YA_REGISTRADA", tarea=TASK)

    deadline = time.monotonic() + 90
    result = pos.sale()
    while result["estado"] in ("PENDIENTE", "CONFIRMADA_SIN_NUMERO") and time.monotonic() < deadline:
        time.sleep(6)
        result = pos.sale()
    pos.need(all(result[k] == original[k] for k in timestamps), "Cambió la solicitud durante la recuperación.")
    pos.emit(estado="VENTA_RECUPERADA" if result["estado"] == "CONFIRMADA" else "RECUPERACION_NO_VERIFICADA", venta=result)


if __name__ == "__main__":
    try:
        pos.token = pos.command("gcloud", "auth", "print-access-token")
        pos.need(pos.token, "Sin credencial de Cloud Shell.")
        recover(sys.argv[1])
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        sys.exit(f"BLOQUEADO: {error}")
