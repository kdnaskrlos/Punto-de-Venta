# Bitácora del Punto de Venta Comic Shop

Entradas recientes primero. Mantén cada ronda en 3–5 líneas, con fecha, cambios, comprobaciones, bloqueos y próxima acción cuando corresponda. Si la bitácora supera 150 líneas, resume las rondas antiguas y conserva sus referencias a PR e incidencias. Registra las decisiones permanentes verificadas en [AGENTS.md](../AGENTS.md) y el panorama vigente en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md).

## 2026-11-26 — Revisión corregida activa y recuperación dirigida preparada

- Cloud Shell devolvió `REVISION_VERIFICADA` en `procesarventapos-00002-pas` para el SHA `9339da4`. Devolvió `NO_VERIFICADA` para `qa-v243-20261126-79dcb917`, pendiente con dos unidades intactas.
- Se preparó una entrega puntual a la función activa mediante Cloud Tasks y OIDC. Pasaron la comprobación del CloudEvent con el SDK y una simulación del encolado que evita otra tarea si la venta ya fue confirmada. [Script](../scripts/recuperar-venta-v243-cloud-shell.py)
- Siguiente acción. Entregar el evento de la solicitud original, conservar su ID y registrar el resultado real.

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

## 2026-11-25 — Iteración 04 de v2.43 · Inventario real y plan de despliegue

- Cloud Shell confirmó `punto-de-venta-comic-shop`, Firestore Native `nam5`, Hosting y 14 colecciones raíz. Las reglas activas del 16-11-2026 difieren por SHA-256 de las candidatas. Functions v1 y v2 están vacías y no hay `procesarVentaPos`.
- Se verificó la combinación de función gen 2 Node.js 22 en `us-central1` y Eventarc en `nam5`. El WIF exige el SHA de `main` y no puede desplegar la candidata del PR #21 desde su rama. [Workflow](https://github.com/kdnaskrlos/Punto-de-Venta/blob/main/.github/workflows/desplegar-firebase-pos.yml) · [Eventarc](https://docs.cloud.google.com/eventarc/docs/locations)
- Se fijó `fa521e9` para un despliegue escalonado vía Cloud Shell. Quedan por comprobar IAM efectivo, compatibilidad de las colecciones y reglas activas, solicitudes y reversión. La ronda se limitó a revisión y documentación.
- Siguiente acción. Obtener autorización explícita por componente para la función y las reglas de `fa521e9`. [CI del SHA](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45687488832)

## 2026-11-25 — Iteración 03 de v2.43 · Precheck aprobado e inventario pendiente

- El propietario aportó el resultado de Cloud Shell en `punto-de-venta-comic-shop`. Precheck de solo lectura aprobado, administrador activo, sin caja personal ni física, sin puntero para esa cuenta y cero ventas ejecutadas.
- Se cotejaron las reglas y la Function gen 2 de la candidata, con Node.js 22, reintentos y creación de solicitudes en `(default)`. [Reglas](../firestore.rules) · [Función](../funciones/index.cjs)
- La API de reglas devolvió HTTP 403 desde Codex y no se dispuso de acceso administrativo a Google Cloud. Quedaron pendientes el inventario, las reglas activas y la revisión y el disparador en servicio.
- Siguiente acción. Ejecutar el inventario de solo lectura desde Cloud Shell y compartir su salida. [Plan remoto](VALIDACION-FINAL-V243.md#firebase-remoto-existente)

## 2026-11-25 — Precheck real v2.43 bloqueado

- Se verificaron el HEAD `8f98a6d`, el PR #21 en borrador y el ID y la clave web pública de `punto-de-venta-comic-shop` en `config.js`. La CI de reglas de ese HEAD figura como aprobada. [PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21) · [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45684703207)
- Se revisó la ruta de solo lectura. El proxy de Codex rechazó Firebase con HTTP 403 y la sesión requiere entrada oculta del PIN. Quedan pendientes Auth, perfil admin y puntero de caja. La ronda se limitó a revisión y consultas públicas. [Script](../pruebas/firebase/remoto-cestas.cjs)
- Siguiente acción. Ejecutar `POS_QA_SOLO_PRECHECK=1` con el administrador habitual en una terminal de confianza. [Procedimiento](VALIDACION-FINAL-V243.md#firebase-remoto-existente)

## 2026-11-25 — Incorporación de la memoria permanente

- Se integraron los adjuntos con la memoria iniciada en la rama. Se conservaron las instrucciones originales y la habilidad `pos-contexto`.
- Se contrastaron el código, los adjuntos y la evidencia de GitHub. Pasaron las comprobaciones de rutas, anclas, longitud y alcance documental.
- Sigue pendiente validar Firebase real. La próxima acción es el precheck con el administrador habitual. [Plan de validación](VALIDACION-FINAL-V243.md#firebase-remoto-existente) · [PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21)

## 2026-11-25 — Decisión de mantener memoria permanente

- Se acordaron `AGENTS.md`, `docs/ESTADO_ACTUAL.md` y `docs/BITACORA.md`, con las instrucciones compatibles del archivo que ya existía.
- La rama añadió `pos-contexto` para recuperar y mantener la memoria. Las fuentes de etapas anteriores permanecen en `docs/memoria/`. [Habilidad](../.agents/skills/pos-contexto/SKILL.md) · [Índice](memoria/README.md)
- Cada tarea debe actualizar estado y bitácora antes de cerrarse. [Protocolo](../AGENTS.md#flujo-permanente-chatgpt--codex)

## 2026-11-25 — Prioridad de Firebase real

- El propietario decidió pasar a validar el Firebase existente con datos sintéticos en el servicio real.
- La CI conserva valor como evidencia local. Pendientes la sesión real del administrador, las revisiones de reglas y Function activas, y la matriz de ventas.
- La decisión mantiene separada la autorización para despliegues y borrados. Primero va el precheck en solo lectura. [Instrucción y próximos pasos](https://github.com/kdnaskrlos/Punto-de-Venta/issues/22#issuecomment-7171546304)

## 2026-11-25 — Alcance pospuesto

- El reinicio total de fábrica se pospuso hasta terminar las validaciones y requiere autorización independiente para borrar. [Issue #26](https://github.com/kdnaskrlos/Punto-de-Venta/issues/26)
- Pedidos Personalizados conserva su propio Firebase. La integración de Pedidos en el POS corresponde a una fase posterior. [Notas de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md)
- Lotes por goteo, apartados vencidos, «cliente fantasma» y tasa paralela requieren especificación comercial. [Reglas por confirmar](ESTADO_ACTUAL.md#reglas-comerciales-por-confirmar)

## 2026-11-25 — Revisión de la candidata

- La CI de `70ffba8` aprobó núcleo, Firestore Emulator, Chromium y generación del piloto.
- Se corrigió el foco de la entrada en escritorio y se estabilizó la prueba de comisiones históricas. El script remoto admite la cuenta habitual del POS.
- Las ventas de prueba contra Firebase real quedaron pendientes. [Resultados en PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21#issuecomment-7171416036) · [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45657887101)

## 2026-11-25 — Seguridad de la matriz remota

- Se añadió un ID estable por ejecución y una confirmación explícita de escrituras sintéticas. Los productos preexistentes quedan protegidos frente a colisiones.
- El emulador comprobó que un ID usado impide repetir la matriz y que el precheck solo lee Firestore. El procesador local fue probado con reentregas de cestas de hasta 248 SKU.
- Falta medir el mismo comportamiento en el servicio real. [Script](../pruebas/firebase/remoto-cestas.cjs) · [Evidencia](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21#issuecomment-7171416036)

## 2026-11-25 — Caja personal del administrador

- Se verificó la caja personal automática con fondo cero y cierre sin arqueo. La matriz usa una caja sintética personal.
- Se reforzaron la apertura y el cierre transaccionales y se validaron los permisos de encargada y vendedora en el emulador.
- Una caja preexistente bloquea la matriz. Su estado puede consultarse primero en solo lectura. [Pruebas](../pruebas/firebase/cobros.cjs) · [CI de caja personal](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45653138434)

## 2026-11-25 — Datos de prueba y respaldo

- El propietario autorizó el proyecto existente `punto-de-venta-comic-shop` y el administrador habitual para las pruebas sintéticas.
- Se aceptó la ausencia de respaldo para el POS todavía no operativo. Los documentos `qa-` pueden figurar en informes.
- Inventariar recursos, verificar caja y conciliar operaciones antes de escribir. [Decisión](https://github.com/kdnaskrlos/Punto-de-Venta/issues/22) · [Condiciones](VALIDACION-FINAL-V243.md#firebase-remoto-existente)

## 2026-11-25 — Autenticación y despliegue

- El workflow separó la verificación de identidad y las autorizaciones para Functions y reglas.
- El intercambio OIDC por WIF pasó en la ejecución 45610821324. El paso de respaldo falló y el despliegue quedó omitido.
- El estado del backend v2.43 sigue pendiente de comprobación en Firebase. [Ejecución WIF](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45610821324) · [Procedimiento](DESPLIEGUE-FIREBASE-WIF.md)

## 2026-11-25 — Preparación del piloto v2.43

- La publicación registrada sigue en v2.42 y la candidata v2.43 está en el PR #21 en borrador.
- Aprobaron núcleo, navegador y emulador. Los casos 04 y 05 de pérdida de borradores en pestañas v2.35 siguen reproduciéndose.
- Para publicar quedan Firebase real, Windows y Android físicos y la conciliación previa al retiro de las rutas históricas. [PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21) · [Criterios](VALIDACION-FINAL-V243.md#decisión-de-publicación)
