# Instrucciones para Punto-de-Venta

## Arquitectura y datos

- Mantén la aplicación como PWA estática con HTML, CSS y módulos ES de JavaScript. `index.html` carga `js/principal.js` y `js/app.js` gestiona las rutas por hash. Conserva el despliegue desde la raíz según la guía. [Entrada](index.html) · [Arranque](js/principal.js) · [Rutas](js/app.js) · [Guía](GUIA.md)
- Ubica la lógica de negocio en `js/nucleo/` y la interfaz en `js/vistas/`. Las vistas acceden a los datos a través del almacén. Si cambia su contrato, revisa tanto el almacén en memoria como el de Firebase. [Núcleo](js/nucleo/) · [Vistas](js/vistas/) · [Contrato](js/datos/contrato.js) · [Memoria](js/datos/memoria.js) · [Firebase](js/datos/firebase.js)
- Para cambios de permisos, revisa la matriz `puede(rol, accion)` y las reglas de Firestore. Mantén los tres roles existentes (`admin`, `encargada` y `vendedora`) y verifica los controles del servidor. Reserva `config.js` para la configuración pública de Firebase y mantén tokens y PIN fuera del repositorio. [Permisos](js/nucleo/permisos.js) · [Reglas de Firestore](firestore.rules) · [Guía](GUIA.md)

## Interfaz

- Escribe textos de interfaz breves en español. Incluye descripciones cuando aporten información necesaria para entender un estado o completar una acción. [Textos de interfaz](docs/superpowers/plans/2026-11-12-punto-de-venta-fase1.md#global-constraints) · [Preferencias originales](docs/memoria/README.md#preferencias-originales)
- Usa Plus Jakarta Sans, el tema claro y los tokens del POS para tipografía, colores de moneda y estados. Conserva la jerarquía visual entre títulos, cifras y detalles, y reutiliza los componentes compartidos para mantener consistencia entre tarjetas, botones, filtros y vistas de detalle. Respeta el alcance de los estilos de inventario bajo `.stk`. [Componentes](js/ui.js) · [Tokens](css/tokens.css) · [Tema](index.html) · [Inventario](css/stock.css)
- Mantén la navegación lateral en PC y la barra inferior en móvil. Para el selector de fechas en Reportes, reutiliza el calendario de la aplicación. Consulta las medidas históricas de espaciado y tipografía como referencias de diseño pendientes de confirmación. [Navegación](js/app.js) · [Estilos adaptables](css/base.css) · [Calendario de Reportes](js/vistas/calendario.js) · [Referencias por confirmar](docs/memoria/PENDIENTES.md#referencias-y-decisiones-por-confirmar)
- En Vender, «Tarjetas listado» se refiere a los productos que se pueden agregar y «Tarjetas cobrar» a las prendas ya agregadas al carrito. Identifica cuál de esos flujos afecta el cambio. Inventario y «Todos los productos» comparten `tarjetaPrenda`. [Vista Vender](js/vistas/vender.js) · [Inventario](js/vistas/inventario.js) · [POS Comic Shop, mensajes 5 y 135](docs/memoria/README.md#pos-comic-shop)

## Pruebas y versiones

- Ejecuta `npm test` para verificar cambios en el núcleo y los datos. Para flujos de navegador, usa `npm run e2e` en un entorno con Python 3 y Playwright con Chromium. Consulta en `package.json` la ruta de módulos que usa el script. El servidor de pruebas abre la demostración por defecto. [Comandos](package.json) · [Servidor de pruebas](pruebas/e2e/_servidor.cjs)
- Cuando se publique una versión de la aplicación, actualiza juntos `APP_VERSION` y `CACHE`. [Versión](js/version.js) · [Service worker](sw.js)

## Memoria del proyecto

- Consulta el estado de una decisión en la memoria del proyecto y verifica su evidencia en el repositorio antes de aplicarla. Las preferencias históricas de trabajo requieren confirmación antes de convertirse en reglas permanentes. [Índice y fuentes](docs/memoria/README.md) · [Decisiones pendientes de confirmación](docs/memoria/DECISIONES.md#pendientes-de-confirmación)

## Flujo permanente ChatGPT ↔ Codex

- Al iniciar una tarea, consulta `docs/ESTADO_ACTUAL.md`, las últimas entradas de `docs/BITACORA.md` y esta guía. Si se necesita recuperar contexto, usa la skill `pos-contexto` situada en `.agents/skills/pos-contexto/SKILL.md`.
- No pidas volver a adjuntar esos tres archivos cuando estés dentro de este repositorio. Lee siempre su versión actual del checkout; verifica con GitHub la rama y el estado real de CI.
- Tras **cada tarea que modifique código o decisiones**, actualiza `docs/ESTADO_ACTUAL.md` y agrega una entrada de 3–5 líneas a `docs/BITACORA.md` **en el mismo commit o PR**. Para tareas de solo lectura, evita commits artificiales.
- Mantén cada archivo de memoria con **máximo 200 líneas**; compacta entradas antiguas y conserva las decisiones verificadas, sin borrar reglas existentes.
- Al cerrar, informa brevemente archivos cambiados, pruebas realizadas, bloqueos y un único siguiente paso concreto.
- La v2.43 se trabaja en la rama `integracion/pos-auditoria`; la v2.42 publicada no debe alterarse sin autorización. No desplegar funciones/reglas, borrar datos ni tocar otros proyectos Firebase automáticamente.
