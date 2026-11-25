# Bitácora del Punto de Venta Comic Shop

Entradas recientes primero. Mantén cada ronda en 3–5 líneas, con fecha, cambios, comprobaciones, bloqueos y próxima acción cuando corresponda. Si la bitácora supera 150 líneas, resume las rondas antiguas y conserva sus referencias a PR e incidencias. Registra las decisiones permanentes verificadas en [AGENTS.md](../AGENTS.md) y el panorama vigente en [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md).

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
