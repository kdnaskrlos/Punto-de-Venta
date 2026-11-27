# Validación final de POS v2.43

> **Decisión del propietario, 24-11-2026:** el POS aún no está operativo. Se autorizó probar usando el proyecto Firebase **existente** `punto-de-venta-comic-shop`, ya actualizado a Blaze. Las referencias siguientes a un proyecto `pos-qa-*` describen la vía alternativa, no una obligación de crear otro proyecto. Ninguna prueba debe ejecutarse sobre datos de negocio: el propietario autoriza usar su cuenta administradora existente para el piloto, siempre que el perfil esté activo, no tenga caja abierta, no existan operaciones comerciales pendientes y se compruebe el impacto de los datos sintéticos `qa-` en reportes. Inventariar el contenido antes de probar y conservar las reglas y la configuración para reversión; el propietario confirmó que no existe respaldo y acepta ese riesgo en su POS todavía no operativo. No ejecutar el modo histórico sin una revisión explícita de sus límites y efectos. El proyecto existente solo supera las barreras de los scripts con `POS_QA_ALLOW_EXISTING_PROJECT=punto-de-venta-comic-shop` y `POS_QA_CONFIRM_NONOPERATIVE=SI_POS_NO_OPERATIVO`; mantener estas variables **fuera del repositorio** y comprobar el ID real antes de usarlas. Estos controles no sustituyen una revisión de permisos y de datos.

## Piloto funcional en PC y Android

Cloud Shell confirmó el procesamiento automático y la conciliación del receptor activo del SHA `a8b5330`. Para esta fase, sirve únicamente el árbol `candidata/Punto-de-Venta` generado por el piloto en un canal temporal de Firebase Hosting. El nombre del canal es `piloto-v243` y su vigencia inicial es de siete días. Configura el sitio `punto-de-venta-comic-shop` con un archivo de Hosting separado y usa `firebase hosting:channel:deploy piloto-v243 --expires 7d --no-authorized-domains`. [Canales de vista previa](https://firebase.google.com/docs/hosting/test-preview-deploy#step_2_preview_and_share)

Abre el mismo enlace HTTPS en Chrome de PC y Android, confirma que la interfaz muestra v2.43 e inicia sesión con el usuario y PIN habituales. Puedes instalar la PWA desde el menú de Chrome. Prueba tus operaciones desde la interfaz con datos sintéticos. Los registros se guardan en el Firebase real y pueden aparecer en reportes. El enlace temporal es accesible para quien lo reciba y el POS conserva su autenticación.

Las secciones siguientes documentan verificaciones previas y pruebas de migración o publicación. El acceso a este piloto usa el backend ya validado.

## Firebase remoto existente

1. **Ejecuta primero el precheck de solo lectura**, desde el commit candidato y antes de cualquier despliegue. Usa `punto-de-venta-comic-shop`, su clave web pública (`POS_QA_API_KEY`) y tu usuario y PIN habituales (`POS_QA_USUARIO` y `POS_QA_PIN`). El PIN se introduce en una terminal de confianza con entrada oculta, fuera de GitHub, chats y archivos. El script resuelve el correo interno en `logins/{usuario}`, comprueba el proyecto de la sesión Auth y lee el perfil y el puntero de caja. El resultado informa si hay caja personal o física, sin escribir en Firestore. `sinPunteroDeCaja: true` solo describe el puntero de esa cuenta. Si el puntero existe o está roto, revisa el estado antes de cualquier matriz.

   ```sh
   export POS_QA_PROJECT_ID=punto-de-venta-comic-shop
   export POS_QA_ALLOW_EXISTING_PROJECT="$POS_QA_PROJECT_ID"
   export POS_QA_CONFIRM_NONOPERATIVE=SI_POS_NO_OPERATIVO
   POS_QA_HERRAMIENTAS=$(mktemp -d)
   npm install --prefix "$POS_QA_HERRAMIENTAS" firebase@10.12.2
   read -r -p 'Usuario del POS: ' POS_QA_USUARIO
   read -rs -p 'PIN del POS: ' POS_QA_PIN
   printf '\n'
   POS_QA_USUARIO="$POS_QA_USUARIO" POS_QA_PIN="$POS_QA_PIN" \
     NODE_PATH="$POS_QA_HERRAMIENTAS/node_modules" POS_QA_SOLO_PRECHECK=1 node pruebas/firebase/remoto-cestas.cjs
   unset POS_QA_PIN
   ```

2. Inventaría los servicios, las reglas, los datos de `(default)` y las versiones activas antes de escribir. Conserva la configuración de reversión. Confirma que el POS sigue fuera de operación, que los clientes están cerrados y que se conciliaron las colas locales. Los productos, ventas y movimientos `qa-` se conservan y pueden aparecer en reportes o afectar contadores.
3. Pide autorización explícita para desplegar las reglas y `procesarVentaPos` en **ese mismo proyecto**. Con autorización, revisa la ubicación de Firestore y configura `POS_REGION_FUNCIONES` si difiere de `us-central1`. Verifica Functions gen 2, Eventarc y las identidades de ejecución y del disparador. Comprueba que observa `usuarios/{uid}/solicitudesVenta/{id}` en `(default)` y escribe una marca terminal por solicitud. Usa un origen HTTPS de piloto separado de la publicación v2.42.
4. Con el backend autorizado y verificado y la cuenta administradora sin caja activa, ejecuta primero la ruta procesada. Genera y anota **una vez** `POS_QA_RUN_ID=$(node -p "require('node:crypto').randomUUID()")`. Conserva ese ID si el resultado es incierto y concilia sus documentos antes de iniciar otra ejecución. La apertura y el cierre de la caja personal sintética usan transacciones. Un puntero ocupado o un ID de ejecución usado bloquean la apertura. La caja sintética usa fondo cero y se cierra sin arqueo. La matriz deja intactos los productos ya presentes y comprueba que venta, pago, caja, marca, evento, stock y movimientos correspondan al mismo ID.

   ```sh
   read -rs -p 'PIN del POS: ' POS_QA_PIN
   printf '\n'
   POS_QA_USUARIO="$POS_QA_USUARIO" POS_QA_PIN="$POS_QA_PIN" NODE_PATH="$POS_QA_HERRAMIENTAS/node_modules" \
     POS_QA_SOLO_PRECHECK=0 POS_QA_CONFIRM_WRITES=SI_DATOS_SINTETICOS POS_QA_RUN_ID="$POS_QA_RUN_ID" \
     POS_QA_VENTAS_PROCESADAS=1 node pruebas/firebase/remoto-cestas.cjs
   unset POS_QA_PIN
   ```

   Deben confirmarse todos los tamaños previstos hasta 248 SKU. Con el último SKU agotado se exige un conflicto con el comprobante original y cero escrituras parciales. Un resultado indeterminado exige revisar la solicitud, la venta y la marca con ese ID. La ruta histórica (`POS_QA_VENTAS_PROCESADAS=0`) requiere una revisión explícita de sus efectos y un ID distinto para esa ejecución. Registra el primer tamaño rechazado con código de salida 2 y verifica que el lote dejara el inventario y los comprobantes intactos. La medición precede a la decisión de qué clientes antiguos pueden seguir operando.

## PC y Android físicos

Genera el piloto desde el commit candidato. Usa un solo origen HTTPS aislado y la misma ruta para ambas versiones. Monta primero `base/` y luego `candidata/`. Cada cambio debe conservar las rutas versionadas incluidas. La base v2.42 usa la ruta directa y la candidata habilita el procesador en el mismo proyecto QA. En Windows y Android, instala la PWA desde Chrome y registra el modelo, sistema y versión del navegador.

```sh
node scripts/preparar-piloto.cjs /ruta/nueva/piloto --firebase-qa /ruta/config-publica-qa.json
```

| Prueba | Aprobación |
|---|---|
| Actualizar con dos ventanas abiertas | Anota un carrito y un comprobante pendiente de QA en v2.42. Activa v2.43 tras cerrar las ventanas necesarias y verifica los datos en el mismo perfil. Se recuperan los borradores con prendas e importes intactos. El cobro antiguo conserva ID y caja, y se confirma una sola vez o queda en conflicto conciliable. |
| Cobrar sin red y reabrir | En v2.43 instalada, inicia sesión online, desconecta y registra un cobro sintético. Cierra forzosamente Chrome o la app, reabre sin red y vuelve a conectar. El número oficial aparece una vez, con mismos ID, pagos y caja. El esperado de caja y el stock cambian una vez. |
| Concurrencia de PC y Android | Con cuentas separadas, cobra el último SKU sin conexión en ambos. Reconecta de uno en uno. Solo un cobro descuenta stock, la existencia final es cero y el otro conserva su comprobante en un conflicto. |
| Pagos, apartados, caja y comisiones | Registra USD + COP con vuelto y un descuento aprobado. Completa y anula un apartado con abono. Comprueba la reposición, las salidas por los medios originales, el arqueo conciliado tras un cobro tardío y una sola liquidación por venta. |
| Reversión y compatibilidad v2.35 | En QA, concilia pendientes antes de volver a v2.42 y conserva los grafos de ambas versiones. Para instalaciones v2.35, practica el procedimiento supervisado de la guía con datos sintéticos. Los casos 04 y 05 de pestañas con código antiguo todavía requieren ese procedimiento. |

### Puerta de migración supervisada desde v2.35

Los casos **04 y 05** de `pruebas/pwa/regresion-actualizacion.cjs` siguen fallando en la aplicación **antigua**: cerrar la última pestaña o cerrar otra pestaña vacía puede borrar el borrador de la misma cuenta. `pruebas/pwa/verificar-historica.cjs` reconoce estos fallos históricos, por lo que **CI verde no significa compatibilidad resuelta**. No es correcto corregir ese resultado silenciando o eliminando las pruebas.

Para usuarios que todavía ejecuten v2.35, **antes de publicar v2.43**: (1) identificar instalaciones y pestañas abiertas; (2) registrar, finalizar o cancelar explícitamente cada carrito no cobrado, y conciliar cada cobro local pendiente con un resultado remoto, conservando su ID; (3) cerrar **todas** las pestañas de v2.35, sin confiar en que el cierre guarde borradores; (4) actualizar/reabrir con un solo cliente por cuenta, verificar versión y datos tras el cambio; (5) confirmar en Firestore que no hay cobros duplicados ni colas que vayan a reaparecer. Si hay clientes v2.35 desconocidos o desconectados, posponer el corte de rutas antiguas o bloquear por versión en el servidor, tras evaluar los cobros pendientes. No afirmar que un Service Worker nuevo puede modificar el comportamiento de una pestaña que sigue ejecutando código v2.35.

**El administrador ya utiliza caja personal automática** (se crea al vender; no requiere arqueo de caja física). El script remoto de validación solo inicia una caja sintética personal si no existe ninguna caja activa del administrador, y nunca cierra una caja preexistente. El preflight `POS_QA_SOLO_PRECHECK=1` identifica esta condición sin escribir datos.


## Decisión de publicación

La ruta directa sigue admitiendo importes calculados por el cliente. La protección nueva vincula la liquidación con el apartado, conserva su importe reservado y mantiene los lotes históricos sin marca. No recalcula los abonos ni valida su recepción. La liquidación histórica de comisiones conserva su formato y acredita la persona que la registró, pero no adquiere el bloqueo por venta de los clientes nuevos.

Antes de aprobar v2.43, revisa el resultado de ambas matrices y las pruebas en los dos dispositivos físicos. Acuerda y verifica el retiro controlado de las rutas débiles después de conciliar colas de ventas, apartados, comisiones y cuentas con UID sustituido. Un dispositivo ausente, una cola indeterminada, una escritura parcial o una diferencia sin explicar mantiene bloqueada la publicación.
