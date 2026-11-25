# Validación final de POS v2.43

> **Decisión del propietario, 24-11-2026:** el POS aún no está operativo. Se autorizó probar usando el proyecto Firebase **existente** `punto-de-venta-comic-shop`, ya actualizado a Blaze. Las referencias siguientes a un proyecto `pos-qa-*` describen la vía alternativa, no una obligación de crear otro proyecto. Ninguna prueba debe ejecutarse sobre datos de negocio: usar cuenta administrativa exclusiva de QA, inventariar el contenido antes de probar, respaldar datos existentes y conservar las reglas y la configuración para reversión. No ejecutar el modo histórico sin una revisión explícita de sus límites y efectos. El proyecto existente solo supera las barreras de los scripts con `POS_QA_ALLOW_EXISTING_PROJECT=punto-de-venta-comic-shop` y `POS_QA_CONFIRM_NONOPERATIVE=SI_POS_NO_OPERATIVO`; mantener estas variables **fuera del repositorio** y comprobar el ID real antes de usarlas. Estos controles no sustituyen una revisión de permisos y de datos.

## Firebase remoto aislado

1. Para el Firebase existente autorizado, primero identifica proyecto, servicios, reglas y documentos existentes; genera respaldo y configura alertas de presupuesto en Blaze. Si se usa la alternativa de QA independiente, crea proyecto `pos-qa-…`. Usa exclusivamente datos sintéticos. En Firestore crea la base `(default)` en modo Native. Elige una región de Functions gen 2 compatible con la ubicación del origen del evento de Firestore y configura `POS_REGION_FUNCIONES` si difiere de `us-central1`.
2. Habilita Firebase Authentication con correo y contraseña. Registra una app web, guarda su configuración **pública** como `config-publica-qa.json` fuera del repositorio y autoriza el dominio HTTPS de pruebas en Authentication. Prepara un admin separado para la matriz y al menos una vendedora y una cuenta de gestión para las pruebas físicas. Crea las cuentas físicas mediante el POS de QA, para que se generen los perfiles `usuarios/{uid}` y el acceso `logins/{usuario}`. La cuenta de la matriz necesita perfil activo de admin y caja cerrada antes de comenzar.
3. Usa una cuenta de despliegue con permisos en QA para actualizar reglas de Firestore y desplegar Functions gen 2, incluida la capacidad de utilizar la cuenta de servicio de ejecución. Verifica los servicios utilizados por Functions gen 2 y el disparador: Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Eventarc y Pub/Sub. La identidad de ejecución necesita acceso de lectura y escritura a Firestore (`roles/datastore.user`). La identidad del disparador necesita recibir eventos (`roles/eventarc.eventReceiver`) y permiso de invocación en el servicio Cloud Run correspondiente. Verifica las vinculaciones que crea Firebase CLI antes de modificar IAM.
4. En un checkout del commit candidato, revisa explícitamente el ID y la ubicación. Con Firebase CLI y Node 22, carga solo las reglas y la función **en QA**. Si la región elegida no es la predeterminada, define `POS_REGION_FUNCIONES` en `funciones/.env.<ID_QA>` de la copia local antes del despliegue.

   ```sh
   firebase deploy --config firebase.ventas.json --project "$POS_QA_PROJECT_ID" --only firestore:rules,functions:procesarVentaPos
   ```

   Comprueba que el disparador observa `usuarios/{uid}/solicitudesVenta/{id}` en la base `(default)` y que escribe marcas terminales al procesar. No se requiere Hosting ni Storage de Firebase para este piloto. Las fotos de ejemplo van en el sitio estático.

5. En una cuenta exclusiva de pruebas, sin personalizar precios, tramos, comisiones ni formas de pago de la cuenta dedicada a la matriz, instala Firebase SDK en un directorio temporal y ejecuta ambos modos. Usa exclusivamente la clave pública del proyecto QA y credenciales sintéticas en variables de entorno. Conserva el resultado JSON por tamaño.

   ```sh
   npm install --prefix "$POS_QA_HERRAMIENTAS" firebase@10.12.2
   NODE_PATH="$POS_QA_HERRAMIENTAS/node_modules" POS_QA_VENTAS_PROCESADAS=1 node pruebas/firebase/remoto-cestas.cjs
   NODE_PATH="$POS_QA_HERRAMIENTAS/node_modules" POS_QA_VENTAS_PROCESADAS=0 node pruebas/firebase/remoto-cestas.cjs
   ```

   Variables requeridas: `POS_QA_PROJECT_ID`, `POS_QA_API_KEY`, `POS_QA_EMAIL`, `POS_QA_PASSWORD` y la ruta temporal `POS_QA_HERRAMIENTAS`. En la ruta procesada deben confirmarse 1–248 SKU de la matriz, con coincidencia de caja, pagos, movimientos, existencias, marca y evento. Con el último SKU agotado se exige un conflicto con el comprobante original y cero escrituras parciales. En la ruta histórica registra el primer tamaño rechazado con código de salida 2. Un lote rechazado debe dejar el inventario y los comprobantes intactos. La medición debe hacerse antes de decidir qué clientes antiguos podrán seguir operando.

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

## Decisión de publicación

La ruta directa sigue admitiendo importes calculados por el cliente. La protección nueva vincula la liquidación con el apartado, conserva su importe reservado y mantiene los lotes históricos sin marca. No recalcula los abonos ni valida su recepción. La liquidación histórica de comisiones conserva su formato y acredita la persona que la registró, pero no adquiere el bloqueo por venta de los clientes nuevos.

Antes de aprobar v2.43, revisa el resultado de ambas matrices y las pruebas en los dos dispositivos físicos. Acuerda y verifica el retiro controlado de las rutas débiles después de conciliar colas de ventas, apartados, comisiones y cuentas con UID sustituido. Un dispositivo ausente, una cola indeterminada, una escritura parcial o una diferencia sin explicar mantiene bloqueada la publicación.
