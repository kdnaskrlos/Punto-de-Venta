# Estado actual del Punto de Venta Comic Shop

- **Actualizado el 27-11-2026.** El propietario aprobó el piloto funcional v2.43.2. Un fallo posterior de arranque en v2.42 oficial motivó una reparación de caché en la candidata. Falta comprobar la transición en PC y Android antes de autorizar la publicación. [Bitácora](BITACORA.md)
- **Versión publicada registrada** v2.42. **Candidata** v2.43.2 en `integracion/pos-auditoria`, con el PR #21 en borrador. [Publicación v2.42](PUBLICACION-V2.42.md) · [Versión candidata](../js/version.js) · [PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21)
- **Prioridad** publicar v2.43.2 en el mismo origen, con ventas procesadas y reversión a v2.42.

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

- Pasó la CI de la revisión del piloto `66928d93b2cdc6461243375937bce04033a5d8c5`. GitHub generó una integración de prueba del PR #21 sobre `main`. La preparación previa de publicación `186bc0e` también pasó CI. La corrección del worker requiere la CI de su propio SHA. [CI del piloto](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/46063452609) · [CI de la preparación](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/46065947884)
- Pasó la CI del receptor CloudEvent nativo en `a8b5330aeebdfa889d25d90debd96e2909506289`. [PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21) · [CI](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45918790033)
- En la revisión funcional `70ffba8` aprobaron 174/174 unitarias, 37/37 de Firestore Emulator, 181/181 funcionales de Chromium, 5/5 de actualización PWA y 25/25 del puente. Pasó la generación del piloto de demostración. [GitHub Actions](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45657887101) · [Artefacto](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45657887101/artifacts/15042164279)
- La suite histórica obtuvo 6/8. Los casos 04 y 05 de pérdida de borrador en pestañas v2.35 siguen reproduciéndose. El ensayo del procesador en el emulador cubrió 18 tamaños hasta 248 SKU, reentregas y el rechazo íntegro con el último SKU agotado. [Resultados del PR #21](https://github.com/kdnaskrlos/Punto-de-Venta/pull/21#issuecomment-7171416036)

## Firebase real y publicación pendientes

- **Precheck real v2.43 aprobado según la salida de Cloud Shell aportada por el propietario.** En `punto-de-venta-comic-shop`, `modo: solo-lectura`, `adminActivo: true`, `cajaPersonalExistente: false`, `cajaFisicaExistente: false`, `sinPunteroDeCaja: true` y `ventasEjecutadas: 0`. La ausencia del puntero corresponde al administrador habitual. [Script](../pruebas/firebase/remoto-cestas.cjs)

- El propietario autorizó datos sintéticos en `punto-de-venta-comic-shop` (Blaze) y el uso de su administrador habitual. Aceptó la ausencia de respaldo solo para esta fase no operativa. La matriz requiere verificar el proyecto, la caja, las colas y el efecto de los registros `qa-` en reportes. [Condiciones de la prueba](VALIDACION-FINAL-V243.md#firebase-remoto-existente) · [Decisión](https://github.com/kdnaskrlos/Punto-de-Venta/issues/22)
- El WIF de `main` exige `refs/heads/main` y que el SHA de ejecución, el SHA autorizado y el checkout coincidan. El proveedor documentado también limita la confianza a `main`. El workflow vigente no permite desplegar la candidata del PR #21 desde esa rama. El intercambio OIDC aprobado en la ejecución 45610821324 acredita identidad, con alcance distinto de los permisos efectivos de despliegue. [Workflow](https://github.com/kdnaskrlos/Punto-de-Venta/blob/main/.github/workflows/desplegar-firebase-pos.yml) · [Ejecución WIF](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/45610821324)
- **Inventario anterior al despliegue, aportado desde Cloud Shell.** `punto-de-venta-comic-shop` tiene Firestore `(default)` en modo `FIRESTORE_NATIVE`, ubicación `nam5`, Hosting existente y 14 colecciones raíz. En esa lectura, las reglas del 16-11-2026 diferían de la candidata y las listas de Functions estaban vacías.
- **Función activa según Cloud Shell.** `procesarVentaPos` usa el receptor CloudEvent nativo del SHA `a8b5330aeebdfa889d25d90debd96e2909506289`. Eventarc entregó y procesó automáticamente la venta de control.
- **Verificación estructural real aprobada según Cloud Shell.** El verificador terminó con `fallos: []` y `pendientes: []`, incluido el transporte Pub/Sub. Se registraron la restauración de los agentes administrados de Cloud Functions y Eventarc y el ruleset activo identificado para reversión. Cloud Shell informó 12 respuestas 5xx en el transporte y HTTP 500 en Cloud Run durante la prueba, con cero errores vinculados directamente al ID de venta. [Verificador](../scripts/verificar-funcion-v243-cloud-shell.py)

- **Reglas activas, verificadas en Cloud Shell.** El propietario informó `REGLAS_V243_VERIFICADAS` para `punto-de-venta-comic-shop`, commit autorizado `fa521e96c86e4052934ec9dcd080aceba06e7443`, ruleset `8b7c6bda-e0f3-49d6-9888-e8ca445dfec6` y SHA-256 `f5242399a61a0d5318d8f65ebeff36a1fba94ba3761e3e565b165cc432226d0f`. La huella coincide con la del archivo autorizado en Git. El script conserva la fuente anterior para reversión. [Script](../scripts/desplegar-reglas-v243-cloud-shell.py)

- **Primer intento de reglas en Cloud Shell.** Las reglas activas aprobaron 11 de 12 casos. La transición histórica del apartado devolvió `Function not found: existsAfter` y se detuvo antes de publicar. Se corrigió el mock de existencia posterior del comprobante, se revisaron las lecturas simuladas y ahora se informan ambas tandas antes de bloquear. Se conservaron 12 casos activos, 14 candidatos y la huella aprobada. Pasaron seis escenarios locales con APIs simuladas. [Script](../scripts/desplegar-reglas-v243-cloud-shell.py)

- **Primer intento por Eventarc.** La solicitud `qa-v243-20261126-79dcb917` quedó pendiente con el SHA anterior. Cloud Run registró «documentPath … Path must be a non-empty string» en `ventas.cjs:34:46`, antes de la transacción. Firebase Functions 7.4.0 calcula `event.params` desde la extensión `document`. El error se reprodujo con un CloudEvent binario sin la extensión. Los registros reales carecen de la cabecera original y de correlación directa con el ID. [SDK](https://github.com/firebase/firebase-functions/blob/v7.4.0/src/v2/providers/firestore.ts#L1026) · [Procesador](../funciones/ventas.cjs)

- **Validación desplegada.** El SHA activo admite el namespace predeterminado vacío, normaliza el nombre de recurso y `subject` y valida su concordancia con el snapshot. Los avisos registran solo el código de rechazo. [Disparador](../funciones/index.cjs)

- **Recuperación directa confirmada.** Cloud Shell devolvió `VENTA_RECUPERADA` para `qa-v243-20261126-79dcb917`, estado `CONFIRMADA`, número `V-0004`, pagos verificados y existencia final de una unidad. Se observó una venta, un movimiento de inventario, un evento de actividad y ningún conflicto. [Script](../scripts/recuperar-venta-v243-cloud-shell.py)

- **Segunda prueba automática.** A las `2026-11-26T16:54:00.508707Z`, la revisión `procesarventapos-00002-pas` devolvió HTTP 204 y advirtió que el origen o documento era inválido. El aviso no identifica el atributo. RED reprodujo el rechazo con `namespace` vacío y GREEN confirmó la recuperación y la idempotencia en el emulador. Pasaron además la comprobación local del alias de proyecto y una simulación del despliegue desde un manifiesto nuevo. [Contrato de Eventarc](https://docs.cloud.google.com/eventarc/docs/cloudevents#firestore) · [Regresión](../pruebas/firebase/cestas-atomicas.cjs)

- **Conciliación real completada.** Cloud Shell confirmó las dos solicitudes pendientes como `V-0006` y `V-0007`, con pagos verificados, inventario correcto y sin duplicados ni conflictos.

- **Piloto v2.43.2 aprobado por el propietario en PC y Android.** Confirmó ventas offline, cierre y reapertura sin conexión, sincronización, inventario, caja y comisiones. Las pruebas de la vendedora y la consulta administrativa también quedaron aprobadas. [Piloto](https://punto-de-venta-comic-shop--piloto-v243-n8egt6cf.web.app)
- **Incidencia de arranque v2.42.** PC y Android mostraron un 503. En Android el bypass y desregistrar solo el worker desbloquearon el acceso. Se reprodujo el 503 con la caché del shell ausente. La candidata comprueba la integridad de cada recurso y repara su caché con un conjunto de la misma versión. [Recuperación](RECUPERACION-PWA.md)
- **Configuración de publicación preparada.** `ventasAtomicas: true` está en la configuración de producción y se regeneró la huella de la PWA. Se verificaron los puntos de entrada públicos de v2.42 frente a su artefacto en Git y se preparó la reversión conservando ambos grafos. [Procedimiento](PUBLICACION-V2.43.2.md)
- **Indispensable antes del corte.** Falta evidencia actual de la conciliación de todas las colas por terminal y cuenta, de un respaldo vigente de Firestore y de la rama configurada en Settings → Pages. Si aún hay clientes v2.35, requieren migración supervisada antes de cerrar sus pestañas. El PR #21 y Pages se promueven con autorización del propietario y CI de la revisión preparada. [Controles](PUBLICACION-V2.43.2.md#antes-de-autorizar)
- **Aplazable.** Las matrices ampliadas de estrés y el retiro de las rutas históricas quedan fuera de este corte. Los registros sintéticos se conservan.

**Siguiente acción.** Verificar la transición del worker corregido en una terminal de cada tipo, PC y Android, antes de autorizar el corte. [Publicación](PUBLICACION-V2.43.2.md#publicar-con-autorización)

## Reglas comerciales por confirmar

- Criterio para la tasa paralela en saldos diferidos, con la fecha aplicable y cómo se registra la tasa utilizada.
- Vencimiento de apartados, reposición y tratamiento de pagos vencidos. Significado y tratamiento de «cliente fantasma».
- Lotes mayoristas abiertos por goteo, preventas, entregas parciales y agrupación de ventas para impedir fragmentación indebida.
- Precios, reservas, anticipos, saldos y liquidación de operaciones parciales. Atribución y reversión de comisiones cuando distintas personas reciben el abono y el saldo del apartado.

Las reglas vigentes están en [AGENTS.md](../AGENTS.md#reglas-comerciales-vigentes). Las fuentes históricas describen etapas anteriores y se contrastan con el código y las pruebas de la candidata. [Memoria histórica](memoria/README.md) · [Notas de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md)

## Fuera de la fase actual

- Integrar Pedidos en el POS, implementar lotes mayoristas, añadir flujos comerciales sin criterios aprobados y hacer rediseños ajenos a fallos actuales. [Fases futuras](memoria/PENDIENTES.md#fases-futuras-documentadas)
- El reinicio total de fábrica sigue pospuesto. Su ejecución requiere autorización explícita independiente. [Issue #26](https://github.com/kdnaskrlos/Punto-de-Venta/issues/26)
