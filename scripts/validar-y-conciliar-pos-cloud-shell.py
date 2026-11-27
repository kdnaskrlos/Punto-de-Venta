#!/usr/bin/env python3
"""Actualiza la función existente, valida una venta automática y concilia IDs conocidos."""
import datetime as dt
import importlib.util
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def cargar(nombre):
    archivo = Path(__file__).with_name(nombre + ".py")
    spec = importlib.util.spec_from_file_location(nombre, archivo)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


pos = cargar("actualizar-funcion-v243-cloud-shell")
rec = cargar("recuperar-venta-v243-cloud-shell")
rec.pos = pos
ACTIVO = "339649d7126faed6d8feb3f2e58246568630954c"
REVISION = "procesarventapos-00003-joz"
PRUEBA = "qa-v243-eventarc-nativo-20261127-c7f04261"
PENDIENTES = (pos.V, pos.EVENTARC_SALE, "qa-v243-eventarc-20261127-31c2a83e")
RECUPERABLES = ("PENDIENTE", "CONFIRMADA_SIN_NUMERO")
SIN_SOLICITUD = ("SIN_SOLICITUD", "SOLO_DATOS_DE_PRUEBA")


def main(repo, sdk, manifest):
    pos.repo, pos.manifest = str(repo), manifest
    target = pos.command("git", "-C", str(repo), "rev-parse", "HEAD")
    pos.need(target != ACTIVO, "El checkout aún corresponde al SHA desplegado anterior.")
    smoke_env = {**os.environ, "NODE_PATH": str(sdk)}
    for nombre in ("POS_SMOKE_USUARIO", "POS_SMOKE_PIN"):
        pos.need(os.environ.pop(nombre, ""), f"Falta {nombre} para la venta controlada.")

    functions = repo / "funciones"
    adc = rec.get_adc(functions)
    deploy_token = pos.command("gcloud", "auth", "print-access-token")
    pos.need(deploy_token, "Sin credencial de despliegue de Cloud Shell.")
    pos.token = adc

    if manifest.exists():
        state = json.loads(manifest.read_text(encoding="utf-8"))
        pos.need(state.get("sha") == target and state.get("prueba") == PRUEBA, "El manifiesto pertenece a otra operación.")
    else:
        extra = pos.sale(PRUEBA, permitir_ausente=True)
        pos.need(extra["estado"] == "SIN_SOLICITUD", "Ya existen registros para la venta automática reservada.")
        pending = {}
        for venta_id in PENDIENTES:
            info = pos.sale(venta_id, permitir_ausente=True)
            pos.need(info["estado"] in (*RECUPERABLES, *SIN_SOLICITUD, "CONFIRMADA", "RECHAZADA"),
                     f"Conciliación inconsistente para {venta_id}.")
            if info["estado"] in RECUPERABLES:
                pending[venta_id] = info
        pos.token = deploy_token
        before = pos.function_state()
        baseline = pos.snapshot(before)
        source = pos.source_of(before)
        pos.need(pos.active_sha(before) == ACTIVO and baseline["revision"] == REVISION
                 and source and source.get("generation"), "La revisión activa o la fuente de reversión difiere.")
        pos.verify_saved_source(source)
        pos.emit(sha=target, actualiza="procesarVentaPos", ventaAutomatica=PRUEBA, importeCOP=10000,
                 conciliaSoloTrasExitoAutomatico=list(pending))
        pos.authorization("AUTORIZO_POS " + target)
        state = {"sha": target, "prueba": PRUEBA, "pendientes": pending, "baseline": baseline,
                 "fuenteAnterior": source, "inicio": dt.datetime.now(dt.timezone.utc).isoformat()}
        pos.save(state)

    pos.token = deploy_token
    before = pos.function_state()
    baseline = state["baseline"]
    if "verificado" not in state:
        pos.need(pos.active_sha(before) == ACTIVO and pos.source_of(before) == state["fuenteAnterior"]
                 and pos.snapshot(before) == baseline and not state.get("patchSolicitado"),
                 "La actualización ya se intentó o cambió la revisión. Consulta la operación del manifiesto.")
        source = pos.archive(target)
        state["patchSolicitado"] = True
        pos.save(state)
        pos.change(before, source, target, state, baseline)
    else:
        pos.need(pos.active_sha(before) == target, "La revisión verificada dejó de estar activa.")

    pos.token = adc
    if not state.get("pruebaIniciada"):
        pos.need(pos.sale(PRUEBA, permitir_ausente=True)["estado"] == "SIN_SOLICITUD",
                 "El ID de la prueba se ocupó antes de iniciarla.")
        state["pruebaIniciada"] = True
        pos.save(state)
        subprocess.run(["timeout", "180s", "node",
                        str(repo / "scripts/verificar-eventarc-venta-v243-cloud-shell.cjs"), PRUEBA],
                       env=smoke_env)
        # La lectura de conciliación se fija dos segundos antes para mantener consistencia.
        time.sleep(3)
    automatic = pos.sale(PRUEBA, permitir_ausente=True)
    pos.emit(ventaAutomatica=automatic)
    if automatic["estado"] != "CONFIRMADA":
        pos.token = deploy_token
        pos.diagnostics(state["verificado"], state["inicio"], PRUEBA)
        raise RuntimeError("Eventarc aún no está verificado. Las solicitudes pendientes se conservan.")

    pos.token = adc
    for venta_id, original in state["pendientes"].items():
        pos.need(rec.recover_original(original, functions, venta_id, confirmar=False) == 0,
                 f"La conciliación de {venta_id} requiere revisión.")
    pos.emit(estado="POS_PROCESAMIENTO_VERIFICADO", sha=target, ventaAutomatica=PRUEBA,
             solicitudesConciliadas=list(state["pendientes"]))


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main(*(Path(p) for p in sys.argv[1:]))
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        sys.exit(f"BLOQUEADO: {error}")
