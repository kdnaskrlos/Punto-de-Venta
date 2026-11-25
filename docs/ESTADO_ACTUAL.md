# Estado actual del Punto de Venta Comic Shop

- **Actualizado el 25-11-2026.** El propietario confirmó el alta real de `procesarVentaPos`. Se corrigió la verificación de Eventarc y se preparó la fase de reglas para autorización independiente. [Bitácora](BITACORA.md)
- **Versión publicada registrada** v2.42. **Candidata** v2.43 en `integracion/pos-auditoria`, con el PR #21 en borrador. El seguimiento de la publicación está en el issue #22. [Publicación v2.42](PUBLICACION-V2.42.md) · [Versión candidata](../js/version.js) · [PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21) · [Issue #22](https://github.com/kdnaskrlos/Punto-de-Venta/issues/22)
- **Prioridad** validar Firebase real con datos sintéticos en el proyecto existente. La publicación de v2.43 sigue bloqueada por esta validación y por las pruebas en dispositivos físicos. [Decisión del propietario](https://github.com/kdnaskrlos/Punto-de-Venta/issues/22#issuecomment-7171546304)

## Funcionalidades implementadas

| Área | Qué hay en el código |
| --- | --- |
| Ventas y cobros | Carrito, cinco tramos configurables, mix y artículos `separado`, ofertas y descuentos, registro de clientes, pagos multimoneda, vuelto mixto y recibo opcional por WhatsApp. [Tramos](../js/nucleo/tramos.js) · [Cobro](../js/vistas/cobrar.js) · [Reglas vigentes](../AGENTS.md#reglas-comerciales-vigentes) |
| Inventario | Inventario único, movimientos por venta, apartado y ajuste, importación por SKU desde Carga Masiva con vista previa, consulta y escaneo, fotos compartidas por código de imagen. [Inventario](../js/vistas/inventario.js) · [Importador](../js/nucleo/importar.js) |
| Gestión | Roles admin, encargada y vendedora, permisos de descuento, caja personal automática para gestión y caja física con arqueo para vendedora, reportes, comisiones, ajustes y tasas. [Permisos](../js/nucleo/permisos.js) · [Caja](../js/vistas/caja.js) · [Reportes](../js/vistas/reportes.js) |
| Apartados | Reserva de existencias, abonos, liquidación en una venta y cancelación con devolución de stock según el flujo. [Apartados](../js/vistas/apartados.js) · [Almacén Firebase](../js/datos/firebase.js) |
| PWA y sincronización | Caché de recursos versionados, persistencia local, recuperación de carritos, cola de operaciones, IDs estables y conflictos conciliables. [Service worker](../sw.js) · [Recuperación](RECUPERACION-PWA.md) · [Guía](../GUIA.md) |

## Qué agrega la candidata v2.43

- La ruta procesada se habilita con `firebaseConfig.ventasAtomicas`. `procesarVentaPos` valida el comprobante con los datos de servidor y confirma venta, movimientos e inventario en una transacción. El rechazo por stock conserva el comprobante y la reentrega conserva el ID. El código mantiene la ruta directa para clientes históricos. [Procesador](../funciones/ventas.cjs) · [Auditoría](AUDITORIA-BLOQUE-1.md)
- El precheck del administrador comprueba su perfil y el estado de su caja mediante lecturas de Firestore. La matriz exige confirmación de escrituras e ID estable de ejecución. Protege cajas y productos preexistentes y permite conciliar reintentos. [Script remoto](../pruebas/firebase/remoto-cestas.cjs) · [Procedimiento](VALIDACION-FINAL-V243.md#firebase-remoto-existente)
- La candidata mejora la recuperación del shell ante un 503 y de borradores de varias pestañas. Continúa la limitación de v2.35 cuando una pestaña aún ejecuta el JavaScript antiguo. [Recuperación PWA](RECUPERACION-PWA.md) · [Migración supervisada](VALIDACION-FINAL-V243.md#puerta-de-migración-supervisada-desde-v235)

## Evidencia de validación

- En la revisión funcional `70ffba8` aprobaron 174/174 unitarias, 37/37 de Firestore Emulator, 181/181 funcionales de Chromium, 5/5 de actualización PWA y 25/25 del puente. Pasó la generación del piloto de demostración. [GitHub Actions](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45657887101) · [Artefacto](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45657887101/artifacts/15042164279)
- La suite histórica obtuvo 6/8. Los casos 04 y 05 de pérdida de borrador en pestañas v2.35 siguen reproduciéndose. El ensayo del procesador en el emulador cubrió 18 tamaños hasta 248 SKU, reentregas y el rechazo íntegro con el último SKU agotado. [Resultados del PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21#issuecomment-7171416036)

## Firebase real y publicación pendientes

- **Precheck real v2.43 aprobado según la salida de Cloud Shell aportada por el propietario.** En `punto-de-venta-comic-shop`, `modo: solo-lectura`, `adminActivo: true`, `cajaPersonalExistente: false`, `cajaFisicaExistente: false`, `sinPunteroDeCaja: true` y `ventasEjecutadas: 0`. La ausencia del puntero corresponde al administrador habitual. [Script](../pruebas/firebase/remoto-cestas.cjs)

- El propietario autorizó datos sintéticos en `punto-de-venta-comic-shop` (Blaze) y el uso de su administrador habitual. Aceptó la ausencia de respaldo solo para esta fase no operativa. La matriz requiere verificar el proyecto, la caja, las colas y el efecto de los registros `qa-` en reportes. [Condiciones de la prueba](VALIDACION-FINAL-V243.md#firebase-remoto-existente) · [Decisión](https://github.com/kdnaskrlos/Punto-de-Venta/issues/22)
- El WIF de `main` exige `refs/heads/main` y que el SHA de ejecución, el SHA autorizado y el checkout coincidan. El proveedor documentado también limita la confianza a `main`. El workflow vigente no permite desplegar la candidata del PR #21 desde esa rama. El intercambio OIDC aprobado en la ejecución 45610821324 acredita identidad, con alcance distinto de los permisos efectivos de despliegue. [Workflow](https://github.com/kdnaskrlos/Punto-de-Venta/blob/main/.github/workflows/desplegar-firebase-pos.yml) · [Ejecución WIF](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45610821324)
- **Inventario real de la iteración 04, aportado desde Cloud Shell.** `punto-de-venta-comic-shop` tiene Firestore `(default)` en modo `FIRESTORE_NATIVE`, ubicación `nam5`, Hosting existente y 14 colecciones raíz. Las reglas activas se actualizaron el 16-11-2026 y su SHA-256 difiere del de la candidata. Las listas de Functions v1 y v2 estaban vacías y se encontraron cero `procesarVentaPos`.
- **Función desplegada según Cloud Shell.** `procesarVentaPos` gen 2 del SHA `fa521e96c86e4052934ec9dcd080aceba06e7443` figura `ACTIVE` en `us-central1`. Cloud Run informó Ready, ConfigurationsReady y RoutesReady, con 100 % del tráfico en `procesarventapos-00001-mem`. Eventarc `procesarventapos-790966` en `nam5` apunta a ese recurso como `cloudFunction`. El propietario comprobó los filtros de Firestore, la ruta y la cuenta de servicio.
- **Agentes administrados.** El propietario comunicó la restauración de `roles/cloudfunctions.serviceAgent` y `roles/eventarc.serviceAgent` para sus respectivos agentes. El verificador de solo lectura comprueba los enlaces, la invocación privada, los permisos Allow y el tema y suscripción de Pub/Sub. La entrega de eventos queda pendiente de una prueba autorizada. [Verificador](../scripts/verificar-funcion-v243-cloud-shell.py)
- Antes de publicar, valida en Firebase real pagos y descuentos, caja, anulaciones, ventas y existencias, rechazo atómico, reintentos y conciliación. Prueba la PWA instalada en Windows y Android físicos y aplica la migración supervisada de v2.35. Concilia las colas, incluidas cuentas con UID sustituido, antes de acordar el retiro de ventas directas, abonos y liquidaciones de comisiones históricas. Conserva un plan de reversión y obtén la aprobación del propietario para publicar. [Criterios de publicación](VALIDACION-FINAL-V243.md#decisión-de-publicación)

- **Preparación de reglas.** El SHA propuesto para `firestore.rules` es `fa521e96c86e4052934ec9dcd080aceba06e7443`, con CI aprobada. Tras la verificación estructural, conservar el ruleset activo y su fuente, comparar las reglas para v2.42 y cruzar las colecciones existentes. Con autorización separada, actualizar solo el release `cloud.firestore`, verificar el SHA-256 del contenido activo y usar el ruleset anterior para revertir si corresponde. Mantener el piloto desactivado durante esta fase. [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45687488832) · [API de reversión](https://firebase.google.com/docs/reference/rules/rest/v1/projects.releases/patch)

**Siguiente acción.** Ejecutar el verificador de solo lectura en Cloud Shell y compartir su salida. La publicación de reglas queda sujeta a autorización explícita.

## Reglas comerciales por confirmar

- Criterio para la tasa paralela en saldos diferidos, con la fecha aplicable y cómo se registra la tasa utilizada.
- Vencimiento de apartados, reposición y tratamiento de pagos vencidos. Significado y tratamiento de «cliente fantasma».
- Lotes mayoristas abiertos por goteo, preventas, entregas parciales y agrupación de ventas para impedir fragmentación indebida.
- Precios, reservas, anticipos, saldos y liquidación de operaciones parciales. Atribución y reversión de comisiones cuando distintas personas reciben el abono y el saldo del apartado.

Las reglas vigentes están en [AGENTS.md](../AGENTS.md#reglas-comerciales-vigentes). Las fuentes históricas describen etapas anteriores y se contrastan con el código y las pruebas de la candidata. [Memoria histórica](memoria/README.md) · [Notas de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md)

## Fuera de la fase actual

- Integrar Pedidos en el POS, implementar lotes mayoristas, añadir flujos comerciales sin criterios aprobados y hacer rediseños ajenos a fallos actuales. [Fases futuras](memoria/PENDIENTES.md#fases-futuras-documentadas)
- El reinicio total de fábrica sigue pospuesto. Su ejecución requiere autorización explícita independiente. [Issue #26](https://github.com/kdnaskrlos/Punto-de-Venta/issues/26)
