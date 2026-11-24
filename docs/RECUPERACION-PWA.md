# Recuperar el POS de un 503 en Chrome

## Qué se comprobó

Con v2.42, al quitar la caché del shell de un perfil que conserva el service worker activo, la navegación devuelve el 503 del worker aunque el servidor HTTPS funcione. Se reprodujo en Chromium de escritorio y con un perfil Pixel 7 simulado. Un contexto limpio puede abrir la aplicación. Con dos pestañas controladas, el worker nuevo puede terminar la instalación y seguir esperando. Esto reproduce los síntomas del Issue #19. La causa concreta del teléfono afectado sigue por confirmar.

El candidato v2.42.1 recompone los recursos ausentes con los archivos de la **misma publicación que controla la página**. La descarga es compartida entre solicitudes concurrentes y valida tipos y huella completa antes de escribir. Una descarga incompleta, de otra versión o rechazada por cuota falla de forma segura. Si el recurso solicitado era un módulo, la respuesta 503 es texto. El HTML puede mostrar un aviso de arranque aunque el módulo principal no se cargue. La navegación sin shell recibe una página de recuperación con un reintento manual que mantiene la URL.

## Recuperación sin borrar datos

1. Comprueba que puedes conectarte a Internet y que el dispositivo dispone de espacio libre. Mantén el origen, la cuenta y el perfil habitual de Chrome. Una ventana de incógnito permite comparar la carga, pero tiene su propio almacenamiento y no permite comprobar si la sesión habitual conserva operaciones pendientes.
2. Si alguna ventana antigua todavía funciona, revisa el carrito y los cobros por sincronizar. En v2.35 retoma el borrador en la pestaña que conserva el carrito, cierra primero las vacías y deja esa última. Sigue el proceso supervisado si hay trabajo de la misma cuenta en varias pestañas. [Transición documentada](../GUIA.md#transición-desde-v235)
3. Con conexión, cierra todas las pestañas del POS. En Android cierra también la ventana de la aplicación instalada desde aplicaciones recientes. Abre de nuevo el POS en el mismo perfil. Si aparece el aviso de recuperación del candidato, pulsa **Reintentar**. Conserva los datos del sitio y la aplicación instalada.
4. Si sigue el 503, inspecciona el origen con **Application → Service Workers** en Chrome. En Android usa, si está disponible y autorizado, la inspección remota de Chrome desde un PC mediante USB. Registra el alcance, qué worker está activo, si hay otro en espera y qué clientes siguen abiertos. Puedes solicitar **Update** con la conexión restablecida. Si la actualización queda en espera, resguarda el trabajo de los clientes antes de cerrar todos. Deja desactivados **Update on reload** y **Bypass for network** durante la verificación y conserva los registros y el almacenamiento.
5. Si la actualización no termina de instalarse, comprueba que la publicación compatible esté disponible íntegra en el servidor. Escala con el estado del worker y la versión observada. La ausencia de claves de carrito en `localStorage` no demuestra que IndexedDB o las colas de Firestore estén vacías.

El worker corregido solo repara solicitudes que él controla. El worker original de v2.42 puede seguir devolviendo un 503 hasta que se instale y active el candidato. El navegador decide cuándo activar un worker en espera. La reparación no fuerza la activación ni modifica IndexedDB, carritos, autorizaciones, cobros, pendientes ni la caché de fotos. Sin conexión y sin la caché necesaria, la aplicación requiere recuperar Internet.

## Preparación y reversión

1. Identifica y archiva el árbol estático que sirve Pages. Comprueba qué rama o flujo lo publica antes de integrar cambios en el código fuente. Guarda el `index.html` y el `sw.js` activos y su huella.
2. Genera el candidato desde el código aprobado, pasando el artefacto anterior a `scripts/preparar-publicacion.cjs`. Conserva versiones previas, rutas históricas, fotos y la configuración vigente. Sirve y verifica el nuevo prefijo por HTTPS antes de promover los archivos de entrada.
3. Promueve juntos el `index.html` y el `sw.js` verificados en una ventana supervisada. En una terminal piloto comprueba el paso de activo a espera, el arranque online y luego offline, la integridad del carrito y los pendientes. En un Android real confirma tanto Chrome normal como la aplicación instalada. Si existen clientes v2.35, aplica las precauciones de su migración.
4. Para revertir, restaura juntos el HTML y el worker del artefacto compatible verificado, conservando los recursos de ambos grafos, el origen y el alcance. El worker original de v2.35 puede eliminar otras cachés al activarse y queda fuera del procedimiento de reversión. [Publicación y reversión de v2.42](PUBLICACION-V2.42.md)

Las pruebas de navegador usan HTTPS local, datos sintéticos y bloqueo de la red externa. Incluyen reinicio real del proceso de Chromium con perfil persistente y una base IndexedDB sintética. El entorno Pixel 7 es una emulación de navegador. Quedan por validar el Chrome de Windows, el dispositivo Android afectado, la instalación nativa en Android y la cola real de Firestore en IndexedDB en una instalación autorizada. Los casos históricos 04 y 05 afectan pestañas que ya ejecutan el JavaScript de v2.35.
