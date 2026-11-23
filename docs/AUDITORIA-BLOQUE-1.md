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

## Validación aislada de Firebase

La prueba de emulador carga exactamente el `firestore.rules` del repositorio y registra su SHA-256. Solo admite un endpoint de loopback y el proyecto ficticio `demo-pos-bloque1`. Necesita Node con `registerHooks`, Java y un Firestore Emulator local. Desde el checkout:

```bash
lab_pos=$(mktemp -d)
npm install --prefix "$lab_pos" firebase@10.12.2 @firebase/rules-unit-testing@3.0.3 firebase-tools@14.27.0
cp firestore.rules "$lab_pos/firestore.rules"
cat > "$lab_pos/firebase.json" <<'JSON'
{"firestore":{"rules":"firestore.rules"},"emulators":{"firestore":{"host":"127.0.0.1","port":9849},"ui":{"enabled":false}}}
JSON
export NODE_PATH="$lab_pos/node_modules"
export FIRESTORE_EMULATOR_HOST=127.0.0.1:9849
"$lab_pos/node_modules/.bin/firebase" emulators:exec --config "$lab_pos/firebase.json" --only firestore --project demo-pos-bloque1 'node --test pruebas/firebase/cobros.cjs'
```

La suite usa sesiones sintéticas independientes con credenciales de prueba de las reglas. El adaptador del POS usa el SDK real de Firestore contra el emulador con caché en memoria. La persistencia de IndexedDB al cerrar un navegador y la autenticación real de Firebase quedan como verificaciones separadas. Si el emulador no arranca o no puede cargar las reglas, el resultado de la suite es **BLOQUEADO**.

## Pendientes para revisión

- Verificar la carga de las reglas y los tres escenarios aislados del emulador antes de aprobar cambios de producción. Validar también cestas con muchos SKU, pues Firestore limita las lecturas de documentos de reglas por lote, y el funcionamiento sin Web Locks y con IndexedDB en navegadores instalados.
- Coordinar reglas y artefacto en una ventana separada. Las marcas del nuevo código requieren las reglas de esta rama. La auditoría dejó intactos Firebase de producción y las publicaciones.
- Una interrupción entre el resguardo y la puesta en cola puede dejar solo el comprobante. Se lleva a revisión tras verificar el servidor. El aparato no vuelve a cobrarlo automáticamente.
- Los casos históricos PWA 04 y 05 de pestañas que ya ejecutan v2.35 siguen sujetos a la [migración supervisada](PUBLICACION-V2.42.md). El Bloque 2 y los demás bloques quedan pendientes de revisión.
