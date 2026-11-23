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

## Prueba remota de capacidad (solo proyecto QA independiente)

Existe `pruebas/firebase/remoto-cestas.cjs`: prueba la regla **realmente publicada en un proyecto remoto aislado** con cestas de 1, 8, 12, 16, 20, 24, 32, 48 y 64 SKU. Si el lote se rechaza, verifica que el stock quede intacto y que no existan venta, marca ni movimientos. Si se acepta, contrasta los movimientos con los SKU, la venta y el último movimiento de cada producto. **No divide ventas.** La prueba deja datos sintéticos identificados por un prefijo `qa-` en ese proyecto QA, nunca en el POS operativo.

**Seguridad:** el script se niega a ejecutarse a menos que el `projectId` comience por `pos-qa-`, exige una cuenta Firebase Auth de QA previamente asociada a un perfil admin activo en `usuarios/{uid}` y bloquea el proyecto `punto-de-venta-comic-shop`. No almacena secretos en el repositorio y tampoco conecta al emulador. Debe usarse en un proyecto **creado exclusivamente para pruebas**, con reglas correspondientes a esta PR y una cuenta sintética. No utilizar credenciales del negocio real.

Con `firebase@10.12.2` instalado en una carpeta temporal y `NODE_PATH` apuntando a sus `node_modules`:

```bash
POS_QA_PROJECT_ID=pos-qa-<proyecto> \
POS_QA_API_KEY=<clave-publica-del-proyecto-qa> \
POS_QA_EMAIL=<usuario-de-qa> \
POS_QA_PASSWORD=<clave-del-usuario-qa> \
NODE_PATH=<carpeta-temporal>/node_modules \
node pruebas/firebase/remoto-cestas.cjs
```

El comando es para ejecutarse desde un entorno confiable, sin imprimir contraseñas ni publicarlas en archivos, logs o conversaciones. Antes de dar por cerrado el Bloque 1, comprobar el resultado contra Firestore remoto y corregir cualquier tamaño de cesta que sea válido para el negocio pero sea rechazado por los límites del backend. **No afirmar que un resultado del emulador sustituye esta comprobación**.

## Cobertura funcional y criterios de cierre

- **Pruebas del adaptador real contra el emulador.** Las cestas de 24, 32, 48 y 64 SKU pasan por `guardarVenta`, incluido el evento que acompaña al lote. Se comprueba el comprobante, la caja, la fecha, el stock y un solo movimiento por SKU tras repetir el ID. También se cubren reserva, abono y liquidación offline en orden, y dos sesiones que liquidan la misma reserva con un solo cobro confirmado y un conflicto conciliable.
- **BLOQUEADO · capacidad en Firestore remoto.** Hace falta acceso a un proyecto QA autorizado y separado, una cuenta Auth sintética y el archivo de reglas de la revisión cargado y verificado en QA. Se debe ejecutar la matriz de tamaños remota antes de cerrar el Bloque 1. Si una cesta legítima falla, se necesita una solución que conserve el cobro atómico o una decisión comercial explícita sobre el tamaño admitido.
- **Revisión separada para Daybreak.** Revisar la equivalencia de permisos si cambia el esquema para reducir lecturas o se introduce un servicio transaccional. Validar la separación de proyectos QA y producción, la asignación de roles, la vinculación entre venta, stock, movimientos y conflicto, y la vigencia de las garantías de idempotencia y atomicidad. Usar únicamente reglas y datos sintéticos en un entorno aprobado. Esta revisión queda pendiente.

## Pendientes para revisión

- **Estrés adicional verificado en CI:** GitHub Actions [45273442012](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45273442012) ejecutó 168/168 pruebas unitarias y 8/8 pruebas de Firestore Emulator. Las ventas de 32, 48 y 64 SKU se confirmaron enteras en el emulador; la de 24 SKU se rechazó sin ninguna escritura parcial cuando faltaba la última unidad. **La validación con el emulador no certifica la producción:** Firestore documenta 20 accesos a documentos por lote y 10 por operación, con caché de algunos accesos. Antes de fusionar/publicar, repetir con 24/32/48/64 SKU en un proyecto Firebase remoto aislado, sin datos reales. Si hay límite, definir una solución comprobable que no divida cobros atómicos ni limite silenciosamente el catálogo. [Límites de Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions#access_call_limits) · [Diferencias del emulador](https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production)
- Validar la recuperación tras un cierre forzoso con IndexedDB en un navegador instalado durante el Bloque 2.
- Coordinar reglas y artefacto en una ventana separada. Las marcas del nuevo código requieren las reglas de esta rama. La auditoría dejó intactos Firebase de producción y las publicaciones.
- Una interrupción entre el resguardo y la puesta en cola puede dejar solo el comprobante. Se lleva a revisión tras verificar el servidor. El aparato no vuelve a cobrarlo automáticamente.
- Los casos históricos PWA 04 y 05 de pestañas que ya ejecutan v2.35 siguen sujetos a la [migración supervisada](PUBLICACION-V2.42.md). El Bloque 2 y los demás bloques quedan pendientes de revisión.
