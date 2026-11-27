# Bitácora del Punto de Venta Comic Shop

Entradas recientes primero. Mantén cada ronda en 3–5 líneas, con fecha, cambios, comprobaciones, bloqueos y próxima acción cuando corresponda. Si la bitácora supera 150 líneas, resume las rondas antiguas y conserva sus referencias a PR e incidencias. Registra las decisiones permanentes verificadas en [AGENTS.md](../AGENTS.md) y el panorama vigente en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md).

## 2026-11-27 — Preparación de la publicación definitiva v2.43.2

- El propietario aprobó PC y Android con cobros offline, cierre y reapertura, sincronización, inventario, caja y comisiones. GitHub confirmó la CI de `66928d9`. [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/46063452609)
- Se habilitaron las ventas procesadas en producción y se regeneró la huella. Se verificaron los puntos de entrada públicos de v2.42 y se prepararon la integración del PR #21, la precarga del grafo y la reversión. [Procedimiento](PUBLICACION-V2.43.2.md)
- La simulación local sobre un remoto Git de prueba verificó el bloqueo por fuente incorrecta, la cancelación, la precarga y la reversión con ambos grafos.
- Siguiente acción. Confirmar las colas operativas por terminal y cuenta, la fuente de Pages y un respaldo vigente antes de autorizar. La publicación sigue en v2.42.

## 2026-11-27 — Pruebas comerciales aprobadas y detalles v2.43.2

- El propietario confirmó las pruebas comerciales de la vendedora, sus comisiones y su caja, y verificó los resultados en el perfil administrativo.
- Las ventas anuladas conservan cobro, tasas y motivo, y muestran los movimientos de devolución y el saldo final cuando se pueden identificar. Comisiones abre cada venta con líneas, importes históricos y estado de liquidación. [Ventas](../js/vistas/ventas-rango.js) · [Comisiones](../js/vistas/reportes.js)
- Se actualizó la versión, la caché y la huella de la PWA. Pasaron 7 casos dirigidos en Chromium, con vista móvil simulada, y 5 comprobaciones de instalación y actualización PWA. [Ventas](../pruebas/e2e/detalle-venta.cjs) · [Comisiones](../pruebas/e2e/comisiones-demo.cjs) · [PWA](../pruebas/pwa/actualizacion.cjs)
- Siguiente acción. Actualizar solo el canal `piloto-v243` y comprobar los dos detalles en PC y Android. La publicación registrada sigue en v2.42.

## 2026-11-27 — Vuelto en el detalle histórico de ventas

- Se corrigió la visualización de total, pagos, vuelto, redondeo y neto usando los datos originales. Se conservó el estado de las ventas anuladas. [Vista](../js/vistas/ventas-rango.js)
- Se actualizaron la versión a v2.43.1, la caché y la huella PWA. Pasaron 174 unitarias y tres casos de Chromium en PC y móvil simulado. [Regresión](../pruebas/e2e/detalle-venta.cjs)
- Siguiente acción. Actualizar el canal temporal de Hosting y comprobar el detalle en PC y Android. La versión pública sigue en v2.42.

## 2026-11-27 — Piloto v2.43 activo y primeras pruebas en PC aprobadas

- Se desplegó el piloto v2.43 en Firebase Hosting. El enlace vence el 4 de diciembre de 2026. [Piloto](https://punto-de-venta-comic-shop--piloto-v243-n8egt6cf.web.app)
- El propietario confirmó el funcionamiento de autenticación, inventario, venta e historial en PC.
- Continúan las últimas pruebas comerciales, sin conexión y en Android antes de publicar. La v2.42 sigue como versión pública.

## 2026-11-26 — Backend verificado y piloto web preparado

- Cloud Shell devolvió `POS_PROCESAMIENTO_VERIFICADO` para `a8b5330aeebdfa889d25d90debd96e2909506289`. Eventarc procesó automáticamente la venta de control y quedaron conciliadas `V-0006` y `V-0007` con pagos e inventario correctos, sin duplicados ni conflictos. [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45918790033)
- Se generó el piloto v2.43 y se comprobó la configuración de Firebase real, ventas procesadas y los recursos versionados de la PWA. [Generador](../scripts/preparar-piloto.cjs)
- Siguiente acción. Activar el canal temporal HTTPS y probar desde la interfaz en PC y Android. La publicación v2.42 sigue vigente. [Acceso al piloto](VALIDACION-FINAL-V243.md#piloto-funcional-en-pc-y-android)

## 2026-11-26 — Receptor CloudEvent nativo y validación con una autorización

- La ruta anterior dependía de la extracción de `params` y de la proyección a snapshot que hacía Firebase Functions. Se registró un manejador nativo de Functions Framework que obtiene el recurso Firestore directamente del cuerpo. El procesador financiero conserva sus transacciones. [Receptor](../funciones/index.cjs) · [Contrato de Google Cloud](https://docs.cloud.google.com/run/docs/triggering/trigger-functions-with-firestore-documents)
- Pasaron el caso dirigido en Firestore Emulator, la recepción HTTP de protobuf y JSON con un solo cobro y una simulación que bloquea la conciliación si falla la venta automática. El código candidato sigue pendiente de validación real. [Regresión](../pruebas/firebase/cestas-atomicas.cjs)
- Siguiente acción. Autorizar actualización exclusiva, una venta automática de 10.000 COP y la conciliación condicionada de los IDs sintéticos existentes. [Procedimiento](../scripts/validar-y-conciliar-pos-cloud-shell.py)

## 2026-11-26 — Revisión 00003 activa y nueva venta de control preparada

- Cloud Shell devolvió `REVISION_VERIFICADA` en `procesarventapos-00003-joz` para el SHA `339649d7126faed6d8feb3f2e58246568630954c`. Pasó la CI de ese SHA. [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45916546856)
- La solicitud `qa-v243-eventarc-20261126-0d59dccc` sigue pendiente con dos unidades intactas, sin marca, número ni movimientos.
- Se reutilizó la venta controlada con el ID `qa-v243-eventarc-20261127-31c2a83e` y se incorporó la lectura de `motivo` ante fallo. Siguiente acción. Ejecutar el único bloque en Cloud Shell y registrar la salida. [Prueba](../scripts/verificar-eventarc-venta-v243-cloud-shell.cjs)

## 2026-11-26 — Eventarc entregó la solicitud, pero la revisión la descartó

- Cloud Shell confirmó `V-0004` por recuperación directa. La segunda solicitud `qa-v243-eventarc-20261126-0d59dccc` llegó a `procesarventapos-00002-pas` a las `16:54:00.508707Z`, recibió HTTP 204 y quedó pendiente.
- RED reprodujo el rechazo con `namespace` vacío. GREEN admitió la base predeterminada y las variantes de ruta con validación del recurso, y conservó una sola venta, movimiento y número ante entregas repetidas en el emulador. El aviso registra un código sin datos de la solicitud. La cabecera real no consta en el aviso anterior. [SDK](https://github.com/firebase/firebase-functions/blob/v7.4.0/src/v2/providers/firestore.ts#L1026) · [Regresión](../pruebas/firebase/cestas-atomicas.cjs)
- Pasó la simulación de autorización y despliegue con manifiesto nuevo. Siguiente acción. Autorizar el PATCH exclusivo desde una sesión nueva y conservar la solicitud pendiente. [Procedimiento](../scripts/actualizar-funcion-v243-cloud-shell.py)

## 2026-11-26 — Revisión activa y recuperación directa preparada

- Cloud Tasks devolvió `RECUPERACION_NO_VERIFICADA` y los registros posteriores a las 16:25 UTC quedaron vacíos. Se abandonó esa vía. La envoltura directa de `atenderVenta` del SHA `9339da4` pasó sintaxis y cuatro escenarios simulados. [Script](../scripts/recuperar-venta-v243-cloud-shell.py) · [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45852855011)

## 2026-11-26 — Validación funcional simplificada

- El propietario cerró la auditoría exhaustiva y priorizó un POS operativo, estable y seguro. Cloud Shell se detuvo ante diferencias en el snapshot antes del PATCH.
- Se simplificó el procedimiento existente. Reutiliza el manifiesto, limita el cambio a fuente y etiqueta SHA y concilia la venta original por ID. Las pruebas aprobadas del candidato siguen vigentes. [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45852855011)
- Se comprobó con una simulación que un cambio de metadatos permite continuar y que la fuente anterior sirve para revertir. Siguiente acción. Autorizar el bloque simplificado y registrar el resultado real. [Script](../scripts/actualizar-funcion-v243-cloud-shell.py)

## 2026-11-26 — Corrección de la entrega Firestore de procesarVentaPos

- Cloud Shell informó `PENDIENTE` para `qa-v243-20261126-79dcb917`, HTTP 500 y 12 respuestas 5xx. La traza cae al construir `usuarios/{uid}`. El SDK 7.4.0 calcula `params` desde la extensión `document`. La entrega real no tiene cabecera capturada ni error correlacionado con el ID. [SDK](https://github.com/firebase/firebase-functions/blob/v7.4.0/src/v2/providers/firestore.ts#L1026)
- RED reprodujo el error exacto con el wrapper del SDK y protobuf sin la extensión. GREEN validó origen y ruta, descartó eventos inválidos y recuperó la solicitud preexistente con una sola venta, movimiento, evento y número. [Disparador](../funciones/index.cjs) · [Regresión](../pruebas/firebase/cestas-atomicas.cjs)
- Pasaron 174 unitarias y 38 pruebas de Firestore Emulator con Node 22. La función permanece en el SHA desplegado. Siguiente acción. Revisar y autorizar el SHA candidato para verificar la recuperación de la solicitud original en Firebase real.

## 2026-11-26 — Reglas verificadas y primera venta pendiente de conciliación

- Cloud Shell informó `REGLAS_V243_VERIFICADAS` en `punto-de-venta-comic-shop` para `8b7c6bda-e0f3-49d6-9888-e8ca445dfec6` del SHA autorizado `fa521e96c86e4052934ec9dcd080aceba06e7443`. El respaldo anterior se conservó en las pruebas simuladas. [Estado](ESTADO_ACTUAL.md#firebase-real-y-publicación-pendientes) · [CI de 8363353](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45707695177)
- Se probó una venta de un SKU y un pago COP en caja cerrada. El primer bloque agotó los 90 segundos sin observar marca y número juntos. El diagnóstico de solo lectura pasó ocho escenarios simulados, al igual que el piloto antes de su ejecución. [CI de 16f25ae](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45848393140) · [CI de 4efbe1d](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45851070342)

## 2026-11-25 — Corrección de los mocks de compatibilidad

- Cloud Shell informó 11 de 12 casos aprobados en las reglas activas. La transición histórica del apartado se detuvo en `existsAfter` antes de publicar.
- Se añadió el mock del comprobante posterior al lote y se revisaron los demás accesos simulados. El script ejecuta ambas tandas y bloquea ante cualquier fallo. [Script](../scripts/desplegar-reglas-v243-cloud-shell.py)
- Pasaron seis escenarios locales con APIs simuladas. El archivo de reglas autorizado conserva su SHA-256 y el respaldo anterior permanece disponible.
- Siguiente acción. Ejecutar el bloque corregido de Cloud Shell y compartir la salida.

## 2026-11-25 — Verificación estructural aprobada y reglas autorizadas

- El propietario confirmó cero fallos y pendientes, transporte Pub/Sub verificado y ruleset anterior identificado. Sigue pendiente una prueba activa de entrega de eventos.
- Autorizó solo `firestore.rules` de `fa521e96c86e4052934ec9dcd080aceba06e7443` en `punto-de-venta-comic-shop`. Se corroboró la huella candidata y se prepararon respaldo, simulaciones de v2.42, publicación y reversión. [Script](../scripts/desplegar-reglas-v243-cloud-shell.py)
- Pasaron seis escenarios simulados. La ejecución real de las reglas sigue pendiente.
- Siguiente acción. Ejecutar el bloque de reglas en Cloud Shell y compartir el resultado.

## 2026-11-25 — Función real desplegada y corrección de la verificación

- El propietario confirmó `procesarVentaPos` activa, revisión `procesarventapos-00001-mem` lista con 100 % del tráfico y Eventarc `procesarventapos-790966` en `nam5` con destino `cloudFunction`, filtros y cuenta correctos.
- Se registró la restauración de los agentes administrados de Cloud Functions y Eventarc informada por el propietario. Sus enlaces, la invocación y el transporte se comprueban mediante el verificador de solo lectura. [Verificador](../scripts/verificar-funcion-v243-cloud-shell.py)
- Se corrigió el verificador para aceptar `destination.cloudFunction` y la ausencia de `conditions`. Pasaron siete escenarios simulados. La ronda se limitó a documentación y verificación local. [Referencia de Eventarc](https://docs.cloud.google.com/eventarc/docs/reference/rest/v1/projects.locations.triggers)
- Siguiente acción. Ejecutar el verificador en Cloud Shell. Las reglas de `fa521e9` requieren autorización separada.

## 2026-11-25 — Aprovisionamiento del agente y alta oficial de la función

- El propietario informó que falta el rol del agente de Cloud Functions y que el token de Compute devolvió HTTP 403. El alta sigue pendiente.
- Se preparó un bloque con confirmación explícita, aprovisionamiento por Service Usage, restauración del rol exclusivo del agente y alta de la función por la API v2 sin obtener un token de Compute. [Script](../scripts/desplegar-funcion-v243-cloud-shell.sh)
- Pasaron sintaxis y nueve escenarios simulados. La verificación real sigue pendiente y su alcance es estructural, sin eventos de venta.
- Siguiente acción. Ejecutar el bloque integral y compartir el resultado.

## 2026-11-25 — Alta de la función sin Policy Troubleshooter

- El propietario confirmó permisos propios del llamante, cuenta de Compute Engine válida, backend compatible, Node.js 22 gen 2 disponible y cero solicitudes. El 403 de Troubleshooter persiste.
- Se cambió el preflight a IAM Credentials y `testIamPermissions` bajo la identidad real. El alta comprobada conserva la compilación, revisión privada y Eventarc como evidencias, sin cambios de IAM. [Script](../scripts/desplegar-funcion-v243-cloud-shell.sh)
- Pasaron sintaxis y siete escenarios simulados, incluido fallo de la credencial antes del alta. Sigue pendiente ejecutar en Firebase real con el SHA autorizado.
- Siguiente acción. Ejecutar el bloque único de Cloud Shell y compartir su resultado.

## 2026-11-25 — Diagnóstico del HTTP 403 de Policy Troubleshooter

- El propietario informó que se aceptó la cuenta de Compute Engine y que las consultas v3 se detuvieron con HTTP 403. Los permisos efectivos de despliegue siguen pendientes.
- Se contrastaron los requisitos de cuota y visibilidad de Google. El diagnóstico prueba los permisos propios del llamante por separado, informa la evidencia disponible de los otros principales y propone ajustes acotados cuando corresponde. [Diagnóstico](../scripts/diagnosticar-iam-funcion-v243.py)
- Pasaron sintaxis y cinco escenarios con APIs simuladas. La iteración se limitó a documentación y preparación del diagnóstico.
- Siguiente acción. Ejecutar el bloque de diagnóstico en Cloud Shell y compartir su salida.

## 2026-11-25 — Corrección de la validación IAM del alta de la función

- El propietario informó que la comprobación de formato rechazó la cuenta predeterminada de Compute Engine antes del alta. Confirmó que Policy Troubleshooter está habilitada.
- Se sustituyó la restricción de dominio por la verificación de pertenencia y estado en IAM y se agruparon los bloqueos de permisos antes del alta.
- Pasaron sintaxis y seis escenarios con APIs simuladas. El despliegue autorizado y los permisos efectivos siguen pendientes de comprobación desde Cloud Shell.
- Siguiente acción. Ejecutar el bloque corregido y compartir la salida. [Script](../scripts/desplegar-funcion-v243-cloud-shell.sh)

## 2026-11-25 — Autorización exclusiva de procesarVentaPos v2.43

- El propietario autorizó solo `procesarVentaPos` en `punto-de-venta-comic-shop` para `fa521e96c86e4052934ec9dcd080aceba06e7443`. Las reglas siguen pendientes de autorización.
- Se preparó el bloque de Cloud Shell para comprobar IAM, solicitudes, compatibilidad y estado, crear solo la función y verificar Cloud Run y Eventarc por metadatos. [Script](../scripts/desplegar-funcion-v243-cloud-shell.sh)
- Pasaron sintaxis y tres escenarios con APIs simuladas. La ejecución y el resultado de Firebase real quedan pendientes.
- Siguiente acción. Ejecutar el bloque en Cloud Shell y compartir la salida estructural o el bloqueo.

## 2026-11-25 — Preparación y precheck de Firebase real

- Firebase confirmó Firestore Native en `nam5` y Hosting existente. El precheck verificó administrador activo, ausencia de caja y cero ventas ejecutadas. Codex obtuvo HTTP 403 al consultar inicialmente las reglas y la identidad WIF quedó limitada a `main`; se preparó el despliegue separado para `fa521e9`. [Procedimiento](DESPLIEGUE-FIREBASE-WIF.md) · [Precheck](VALIDACION-FINAL-V243.md#firebase-remoto-existente) · [CI del SHA](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45687488832) · [CI de reglas](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45684703207)
- Se aprobaron en CI el núcleo, Chromium, Firestore Emulator y el piloto de `70ffba8`. El emulador cubrió la caja personal y cestas de hasta 248 SKU. La matriz real conserva IDs y requiere confirmación para las escrituras sintéticas. WIF intercambió la identidad y el fallo del respaldo omitió el despliegue. [PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21) · [CI funcional](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45657887101) · [CI de caja](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45653138434) · [Matriz](../pruebas/firebase/remoto-cestas.cjs) · [Condiciones](VALIDACION-FINAL-V243.md#firebase-remoto-existente)
- Se estableció la memoria permanente con `pos-contexto`, evidencia diferenciada y actualización de ambos documentos por ronda. El propietario priorizó Firebase real con datos sintéticos. [Protocolo](../AGENTS.md#flujo-permanente-chatgpt--codex) · [Fuentes](memoria/README.md) · [Autorización](https://github.com/kdnaskrlos/Punto-de-Venta/issues/22#issuecomment-7171546304)
- El reinicio de fábrica quedó pospuesto. Pedidos Personalizados mantiene su Firebase y las nuevas reglas comerciales requieren especificación. [Issue #26](https://github.com/kdnaskrlos/Punto-de-Venta/issues/26) · [Notas de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) · [Reglas por confirmar](ESTADO_ACTUAL.md#reglas-comerciales-por-confirmar)
