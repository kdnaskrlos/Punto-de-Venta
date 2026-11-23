# POS v2.42 · Preparación y publicación

La rama `integracion/pos-v2.42` contiene el código fuente para revisión. El sitio estático candidato se conserva en `release/pos-v2.42-candidata`. GitHub Pages debe servir el sitio estático en el mismo origen y bajo `/Punto-de-Venta/`.

## Preparar y verificar el sitio

1. En **Settings → Pages**, registra la fuente, el directorio y el método de publicación efectivos. Desde la URL pública, guarda el HTML, el worker activo y una copia del árbol servido. Registra el commit que produjo ese árbol. Verifica que integrar en `main` y escribir en ramas de revisión no publique nada. Si Pages sirve el código fuente de `main`, corrige la separación entre fuente y sitio antes de integrar la PR.
2. Confirma que existen las copias del artefacto activo y de un artefacto compatible de reversión. Conserva los módulos históricos, cada prefijo anterior de `versiones/`, las fotos vigentes y la configuración pública de Firebase. Si la publicación activa es v2.35, usa un artefacto con el puente como destino de reversión. El worker original de v2.35 borra otras cachés al activarse.
3. Desde una copia limpia del commit de integración, reproduce y comprueba el candidato. Para el ensayo exacto, usa la revisión v2.41 que se indica abajo. Para publicar, comprueba también la unión con el árbol realmente servido en el paso 1.

   ```bash
   tmp_pos=$(mktemp -d)
   mkdir "$tmp_pos/v241"
   git archive 3799c3ffab374089fc3d98b1123a322c48fb2d40 | tar -x -C "$tmp_pos/v241"
   node scripts/preparar-publicacion.cjs "$tmp_pos/candidato" "$tmp_pos/v241" > "$tmp_pos/publicacion.json"
   cat "$tmp_pos/publicacion.json"
   cmp "$tmp_pos/v241/config.js" "$tmp_pos/candidato/config.js"
   diff -qr "$tmp_pos/v241/fotos" "$tmp_pos/candidato/fotos"
   for prefijo in "$tmp_pos/v241/versiones/"*/; do
     diff -qr "$prefijo" "$tmp_pos/candidato/versiones/$(basename "$prefijo")" || exit 1
   done
   node pruebas/pwa/huella.cjs
   npm test
   npm run e2e
   node pruebas/pwa/actualizacion.cjs
   POS_PWA_PREVIO_DIR="$tmp_pos/v241" POS_PWA_CANDIDATO_DIR="$tmp_pos/candidato" node --test pruebas/pwa/puente.cjs
   POS_PWA_CANDIDATO_DIR="$tmp_pos/candidato" node --test pruebas/pwa/regresion-actualizacion.cjs
   ```

   El único prefijo adicional esperado es el de v2.42. Las suites PWA requieren Playwright, Chromium y OpenSSL. Usa `NODE_PATH` si Playwright está instalado fuera de esta copia y `POS_CHROMIUM_PATH` si usas Chromium del sistema.

4. Compara `config.js` y todo `fotos/` con la fuente vigente antes de promover. Las subidas de fotos del POS se guardan en la rama predeterminada. Si hay cambios posteriores a la construcción del candidato, incorpóralos al árbol de publicación y repite la verificación del sitio, incluidas su huella y las pruebas de actualización. Respeta la configuración y las reglas de Firebase en uso.
5. Confirma los flujos de acceso, sincronización y envío único de pendientes con Firebase aislado. Haz el ensayo de actualización con datos sintéticos y, cuando se use iOS/Safari, en un dispositivo instalado con la misma ruta y el mismo procedimiento. Comprueba que existe un respaldo vigente de los datos de negocio y conserva evidencias de los identificadores de operaciones sin sincronizar. Un respaldo del servidor no incluye los borradores locales.

## Publicar por etapas

1. Crea una rama estática independiente a partir del árbol servido. Agrega el nuevo prefijo de `versiones/` y conserva todos los prefijos previos. Disponibiliza las rutas raíz compatibles con v2.35, incluido `js/nucleo/ejemplos.js`, junto con las fotos y la configuración vigentes. Conserva los `index.html` y `sw.js` activos en esta primera revisión. Guarda la revisión de preparación.
2. Una vez autorizada la publicación, sirve esa revisión. Comprueba por HTTPS, desde la ruta real, que los puntos de entrada siguen siendo los previos. Compara las huellas de los recursos del nuevo prefijo con los del candidato. Comprueba respuestas 200, el tipo JavaScript en los módulos, el manifiesto, el grafo histórico y las fotos. Un 200 con bytes antiguos no es válido.
3. Coordina la ventana con quienes tienen v2.35. Suspende el cambio si hay un borrador, caja u operación pendiente cuyo estado no puedes comprobar. Con varias pestañas y trabajo distinto, termina las operaciones primero. v2.35 usa una clave de borrador compartida por cuenta. Anota los identificadores y confirma el estado antes de reintentar ventas o abonos.
4. Promueve únicamente los `index.html` y `sw.js` del candidato verificado, juntos en un solo commit de la fuente estática autorizada. Conserva el mismo URL, alcance del worker, fotos, configuración y datos locales. Verifica que el worker instale el conjunto completo y que quede en espera mientras haya pestañas activas. Si se rechaza la instalación, conserva el worker activo y repón los recursos faltantes o incorrectos.
5. En cada terminal v2.35 que deba conservar un carrito, abre **Continuar** en la pestaña con el borrador, comprueba las prendas y pagos y deja el carrito activo. Cierra primero las pestañas vacías, dejando esa pestaña abierta. Cuando el candidato esté descargado, cierra la pestaña con el carrito activo al final, vuelve a abrir el POS y confirma que **Continuar** recupera el mismo carrito. Si el operador no puede verificar qué pestaña conserva el carrito, termina el trabajo antes de cerrarlas y comprueba las operaciones pendientes. Para v2.41, deja terminar la instalación y usa el aviso de actualización cuando sea seguro cerrar. Evita las recargas forzadas, borrar cachés o reinstalar.

## Criterios y verificación posterior

- Comprueba en terminales piloto la versión visible, el worker controlador, la recuperación sin conexión y la reconexión. Verifica las fotos, los ajustes, el acceso, los totales de caja, las ventas previas, el carrito y los identificadores de ventas y abonos pendientes. Reconcilia esos identificadores tras conectar y verifica que cada operación figure una sola vez.
- Comprueba en el piloto los cobros y recibos, el vuelto mixto y su selección automática, la comisión con caja abierta y la autorización de descuento tras cambiar de perfil. Realiza operaciones sintéticas en demostración o en el entorno aislado.
- La regresión histórica tiene seis casos que deben pasar. El 04 reproduce la pérdida al cerrar la última pestaña original v2.35 con un borrador aún sin retomar. El 05 reproduce el borrado compartido al cerrar una pestaña original vacía de la misma cuenta. Ambos siguen fallando con el JavaScript original cargado. El worker nuevo no puede cambiar el código en ejecución ni leer `localStorage` de esas pestañas. La secuencia del paso 5 protege el carrito activo y la capa histórica protege las pestañas que ya cargaron el módulo compatible. Si el borrador se borró y ninguna pestaña conserva el carrito, v2.42 no puede reconstruirlo.
- Detén la ampliación del piloto ante una caída de arranque, una discrepancia en datos, un fallo de acceso o duplicados. Mantén controlada la migración de v2.35 hasta que puedas coordinar todas las terminales que aún la usan.

## Reversión segura

1. Conserva el árbol desplegado, su manifiesto de huella y la revisión anterior compatible. Con el trabajo abierto comprobado, repón el `index.html` y el `sw.js` de esa revisión en un único commit sobre la fuente estática activa. Deja disponibles los recursos versionados de ambas revisiones y el grafo histórico. Mantén las fotos y la configuración más recientes verificadas.
2. Verifica por HTTPS los dos archivos restaurados y sus recursos, y comprueba en un piloto que el worker anterior compatible termine de instalarse y que el POS arranque sin red. Compara borradores, ventas, caja, fotos y ajustes con el registro anterior a la reversión. Reconcilia los pendientes por identificador al reconectar.
3. Conserva los datos del navegador y Firebase. Volver al código anterior no requiere revertir documentos de Firestore ni volver a cobrar operaciones. No borres cachés ni reinstales la PWA para aplicar la reversión.
