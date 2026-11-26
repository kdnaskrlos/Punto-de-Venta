#!/usr/bin/env python3
"""Ejecuta el procesador del POS para la solicitud original desde Cloud Shell."""
import importlib.util
import json
import os
import subprocess
import sys
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "pos", Path(__file__).with_name("actualizar-funcion-v243-cloud-shell.py"))
pos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pos)

ADC = """
const { applicationDefault } = require('firebase-admin/app');
applicationDefault().getAccessToken().then(t => process.stdout.write(t.access_token))
  .catch(e => { console.error(e.message); process.exitCode = 1; });
"""

PROCESSOR = """
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { atenderVenta, idValido } = require('./ventas.cjs');
const [projectId, uid, id] = process.argv.slice(1);
if (projectId !== 'punto-de-venta-comic-shop' || id !== 'qa-v243-20261126-79dcb917' || !idValido(uid)) {
  throw new Error('Proyecto o identidad de la solicitud inesperados.');
}
const db = getFirestore(initializeApp({ projectId, credential: applicationDefault() }));
(async () => {
  try {
    const estado = await atenderVenta(db, { uid, id });
    console.log(JSON.stringify({ procesador: estado, id }));
  } finally {
    await db.terminate();
  }
})().catch(e => {
  console.error(e.code || '', e.message);
  process.exitCode = 1;
});
"""


def recover(manifest, functions):
    pos.need(not os.environ.get("FIRESTORE_EMULATOR_HOST"), "Quita FIRESTORE_EMULATOR_HOST para esta operación.")
    original = json.loads(Path(manifest).read_text(encoding="utf-8"))["solicitudAntes"]
    pos.token = subprocess.check_output(["node", "-e", ADC], cwd=functions, text=True).strip()
    pos.need(pos.token, "El SDK no devolvió credenciales ADC.")
    timestamps = ("solicitudCreateTime", "solicitudUpdateTime")

    def reconcile():
        result = pos.sale()
        pos.need(all(result[k] and result[k] == original[k] for k in timestamps),
                 "La solicitud no coincide con el manifiesto original.")
        return result

    before = reconcile()
    pos.emit(antes=before)
    if before["estado"] == "CONFIRMADA":
        pos.emit(estado="YA_CONFIRMADA", venta=before)
        return
    pos.need(before["estado"] in ("PENDIENTE", "CONFIRMADA_SIN_NUMERO"),
             "El estado requiere conciliación antes de procesar.")
    pos.authorization("AUTORIZO_PROCESAR " + pos.V)
    box = pos.fields(pos.api(pos.FS + "/cajas/" + pos.BOX))
    uid = box.get("uid")
    pos.need(isinstance(uid, str) and uid and "/" not in uid, "UID de la caja inválido.")
    result = reconcile()
    if result["estado"] == "CONFIRMADA":
        pos.emit(estado="YA_CONFIRMADA", venta=result)
        return
    pos.need(result["estado"] in ("PENDIENTE", "CONFIRMADA_SIN_NUMERO"),
             "El estado cambió después de la confirmación.")
    code = subprocess.run(["node", "-e", PROCESSOR, pos.P, uid, pos.V], cwd=functions).returncode
    # La conciliación compartida lee Firestore en un instante dos segundos anterior.
    time.sleep(3)
    after = reconcile()
    pos.emit(estado="VENTA_RECUPERADA" if after["estado"] == "CONFIRMADA" else "RECUPERACION_NO_VERIFICADA",
             codigoProcesador=code, venta=after)
    return 0 if after["estado"] == "CONFIRMADA" else 1


if __name__ == "__main__":
    try:
        sys.exit(recover(*sys.argv[1:]))
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        sys.exit(f"BLOQUEADO: {error}")
