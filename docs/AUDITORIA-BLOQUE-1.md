# Auditoría v2.42 · Bloque 1 de integridad de cobros

## Fallos reproducidos

- Al vencer el plazo de cuatro segundos, el almacén podía iniciar un lote offline mientras seguía abierta la transacción del mismo ID. Además, un ID en `enCurso` devolvía éxito de servidor sin verificar la escritura.
- El lote offline decrementaba el inventario con un incremento negativo. Las reglas anteriores verificaban el movimiento, pero permitían un resultado negativo. La excepción de administración tampoco comprobaba ese resultado.
- Un lote que se rechazaba después del aviso local dejaba el ID bloqueado en la sesión. El registro anterior se anotaba desde la vista, después de devolver el éxito, y perdía el vínculo con la caja en los rechazos.
- La recepción parcial de abonos podía comparar nuevamente todas las formas de pago con un saldo que ya descontaba alguna de ellas. El reintento conserva sus identificadores y considera los abonos que faltan.

## Cambios y compatibilidad

Se registra el comprobante local antes de enviar el lote. Firestore conserva y aplica un único lote por intento con la venta o el apartado, sus movimientos y una marca inmutable. La marca conserva el orden de envío del dispositivo y la fecha original. Los navegadores con Web Locks serializan el encolado entre pestañas de la misma cuenta. El orden de dispositivos independientes lo decide el servidor. Las ventas se numeran en una transacción posterior a la aceptación, de modo que un comprobante local puede carecer de número oficial.

- `local_pendiente` indica que el comprobante quedó en el dispositivo y aún falta respuesta del servidor, aunque el navegador informe que está conectado.
- `confirmada_servidor` indica un commit aceptado o una marca confirmada.
- `rechazada_conflicto` conserva los datos del comprobante, incluidos pagos, identificador y caja original, para conciliación. Tras comprobar el servidor se guarda un conflicto con el mismo identificador y se retira la copia de la cola. Si el conflicto no se pudo escribir, la copia queda en el aparato.

El cálculo de caja sigue leyendo ventas y abonos. Firestore muestra los cambios locales provisionalmente y retira los rechazados de los totales operativos. El conflicto permite contrastar esos pagos con el efectivo y el arqueo sin introducir un cobro nuevo. La reconciliación previa se mantiene para las colas de versiones que no tienen marca, incluidos los avisos de stock histórico negativo.

## Revisión de los movimientos de inventario

El emulador reprodujo el fallo con las reglas anteriores del borrador. Ahora las reglas comprueban el tipo, el signo, el motivo, el actor y el origen del movimiento tanto en la creación del movimiento como en la actualización del producto. Las ventas y reservas nacen en ese mismo lote y deben dejar existencias no negativas. Solo gestión puede recuperar existencias al anular o cancelar la operación original. Ajustes manuales, importación y sincronización requieren administración.

## Validación aislada de Firebase

La prueba carga exactamente el `firestore.rules` del repositorio y registra su SHA-256. Solo admite un endpoint de loopback y el proyecto ficticio `demo-pos-bloque1`. Con Node 24 y Docker, desde el checkout:

```bash
lab_pos=$(mktemp -d)
npm install --prefix "$lab_pos" firebase@10.12.2 @firebase/rules-unit-testing@3.0.3
contenedor_pos=$(docker run -d --rm -p 127.0.0.1:9849:8080 \
  google/cloud-sdk@sha256:7238e47ca03f43296f380010193eedd7ce7cac69efcae36ff7b0a75e0cd879e8 \
  gcloud beta emulators firestore start --project=demo-pos-bloque1 --host-port=0.0.0.0:8080)
trap 'docker stop "$contenedor_pos" >/dev/null' EXIT
curl --fail --retry 30 --retry-all-errors --max-time 2 --retry-delay 1 http://127.0.0.1:9849/
NODE_PATH="$lab_pos/node_modules" FIRESTORE_EMULATOR_HOST=127.0.0.1:9849 node --test pruebas/firebase/cobros.cjs
```

La suite usa sesiones sintéticas independientes con credenciales de prueba de las reglas. El adaptador del POS usa el SDK real de Firestore contra el emulador con caché en memoria. La persistencia de IndexedDB al cerrar un navegador y la autenticación real de Firebase quedan como verificaciones separadas. Si el emulador no arranca o no puede cargar las reglas, el resultado de la suite es **BLOQUEADO**.

## Pendientes para revisión

- El emulador prueba la atomicidad de una cesta de 24 SKU, que aceptó cuando todos tenían existencias y rechazó completa cuando faltaba el último. Este resultado no certifica el tamaño admitido en producción. Firestore documenta 20 accesos a documentos por lote y 10 por operación, con caché de algunos accesos. 24 SKU ya implican 24 lecturas distintas de movimientos con estas reglas. Antes de fusionar o publicar, evaluar el límite con un proyecto remoto aislado o decidir cómo admitir cestas que lo excedan sin dividir un cobro. [Límites de Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions#access_call_limits) · [Diferencias del emulador](https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production)
- Validar el uso sin Web Locks y la persistencia de IndexedDB en una instalación de navegador.
- Coordinar reglas y artefacto en una ventana separada. Las marcas del nuevo código requieren las reglas de esta rama. La auditoría dejó intactos Firebase de producción y las publicaciones.
- Una interrupción entre el resguardo y la puesta en cola puede dejar solo el comprobante. Se lleva a revisión tras verificar el servidor. El aparato no vuelve a cobrarlo automáticamente.
- Los casos históricos PWA 04 y 05 de pestañas que ya ejecutan v2.35 siguen sujetos a la [migración supervisada](PUBLICACION-V2.42.md). El Bloque 2 y los demás bloques quedan pendientes de revisión.
