# Punto de Venta Comic Shop · Fase 1 (núcleo) — Especificación de diseño

Fecha: 12 de noviembre de 2026 · Estado: borrador para revisión de Carlos

## 1. Propósito y contexto

Comic Shop es una tienda de ropa (franelas, buzos, joggers, bodies…) en una ciudad fronteriza de Venezuela donde circula mucho el peso colombiano. Carlos (administrador) trabaja desde su taller, lejos de la tienda. En la tienda trabaja una vendedora. Su esposa es encargada del negocio. Carlos y su esposa también venden a veces desde el taller, incluidos pedidos que llegan por WhatsApp.

El objetivo es un punto de venta propio, instalable en PC y teléfono, que funcione sin internet, se sincronice solo y maneje tres monedas.

**Éxito de la fase 1:** la vendedora vende, cobra en cualquier combinación de monedas y cierra su caja sin ayuda. Carlos y su esposa ven desde el teléfono, en tiempo real, ventas, ganancias, caja, existencias y comisiones. Una venta nunca se pierde por falta de internet.

### 1.1 Proyecto completo y fases

| Fase | Contenido |
|---|---|
| **1 (esta)** | Núcleo del punto de venta: productos, inventario, venta, cobro multimoneda, apartados, caja, tasas, comisiones, recibo por WhatsApp, reportes básicos, usuarios y roles, vista móvil |
| 2 | Ficha de clientes con historial, crédito, cambios y devoluciones, compras a proveedores, reportes avanzados |
| 3 | Tienda online conectada al mismo inventario |
| 4 | Enlace con la app de Pedidos (prendas por encargo) |

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataforma | App web instalable (PWA) en GitHub Pages + Firebase (Firestore y Authentication) |
| Proyecto Firebase | **Nuevo y separado** de Pedidos: "Punto de Venta Comic Shop" |
| Usuarios | Lista propia del POS. Mismo sistema de entrada que Pedidos: usuario + **PIN de 4 dígitos**, creados por el administrador |
| Moneda principal | **COP**. Segunda: USD. Tercera: Bs |
| Tasa COP/USD | **Manual**, solo el administrador la cambia. Aviso si pasan 24 h sin cambiarla |
| Tasa Bs/USD | Automática desde `tasa.json` de la Calculadora de Tasas (Binance P2P con recargo, o BCV), con opción de fijarla a mano |
| Inventario | **Un solo inventario total**, sin ubicaciones ni traslados |
| Productos | Se crean en la **Carga Masiva** y el POS los importa por SKU. Las existencias las lleva el POS |
| Precios | Origen: Tarifario → Carga Masiva → POS. **5 tramos por cantidad** con regla del mix |
| Comprobante | Solo **recibo por WhatsApp** |
| Cliente | **Nombre y teléfono obligatorios** en toda venta y apartado |
| Diseño | Sistema "comicshop-interfaz", tema claro por defecto, con las correcciones de la sección 13 |

## 3. Alcance de la fase 1

**Incluye:**
1. Productos e inventario: importación desde la Carga Masiva, fotos masivas, búsqueda por nombre, foto o código, existencias, mínimos, ajustes con motivo e historial de movimientos.
2. Venta con precio por tramo automático, aviso de "faltan X prendas para el siguiente tramo", ofertas y descuento manual con autorización.
3. Cobro con pagos mixtos en 8 formas de pago, conversión entre COP, USD y Bs, y vuelto en la moneda elegida.
4. Apartados: reservan unidades con un abono; luego se completan o se cancelan.
5. Caja por usuario: apertura, movimientos, cierre con esperado, contado y diferencia.
6. Tasas: Bs automática y COP manual.
7. Calculadora rápida COP / USD / Bs.
8. Comisiones por tramo, normal y reducida, con control de pagadas.
9. Recibo por WhatsApp.
10. Inicio (resumen del día) y reportes básicos.
11. Usuarios y roles con PIN.
12. Vista móvil simplificada.
13. Cambio previo en la Carga Masiva (sección 7.1).
14. Anulación de una venta completa (no devolución parcial).

**No incluye:** devoluciones parciales, cambios de talla, crédito, ficha de clientes con historial, proveedores, ticket impreso, notificaciones push del teléfono, ubicaciones de inventario, tienda online, enlace con Pedidos.

## 4. Usuarios, roles y permisos

| Acción | Administrador (Carlos) | Encargada (esposa) | Vendedora |
|---|---|---|---|
| Vender, cobrar, apartar | ✅ | ✅ | ✅ |
| Abrir y cerrar **su** caja | ✅ | ✅ | ✅ |
| Descuento manual hasta el máximo permitido | ✅ | ✅ | ✅ |
| Descuento mayor al máximo | ✅ | ✅ | Con autorización |
| Aprobar autorizaciones de descuento | ✅ | ✅ | ❌ |
| Ver costos, ganancias, valor del inventario | ✅ | ✅ | ❌ |
| Ver reportes de todos | ✅ | ✅ | Solo sus ventas del día |
| Importar productos, fotos masivas | ✅ | ✅ | ❌ |
| Ajustes de inventario, ofertas | ✅ | ✅ | ❌ |
| Anular ventas, cancelar apartados | ✅ | ✅ | ❌ |
| Marcar comisiones como pagadas | ✅ | ✅ | ❌ |
| Cambiar tasas | ✅ | ❌ (solo ve) | ❌ (solo ve) |
| Reabrir una caja cerrada | ✅ | ❌ | ❌ |
| Ajustes (formas de pago, tramos, comisiones, usuarios, redondeo, descuento máximo, tienda) | ✅ | ❌ | ❌ |

Los permisos se hacen cumplir con **reglas de seguridad de Firestore**, no solo ocultando botones. Los costos se guardan en una colección aparte que la vendedora no puede leer.

### 4.1 Entrada

- Igual que Pedidos: la colección pública `logins/{usuario}` traduce el usuario a un correo interno, y Firebase Auth valida el PIN (guardado como contraseña con prefijo fijo, porque Firebase exige al menos 6 caracteres).
- PIN de **4 dígitos**. El primer usuario que entra en un sistema vacío queda como administrador.
- El administrador crea, desactiva y cambia el PIN de cualquier usuario. Cada usuario puede cambiar su propio PIN.
- Un usuario desactivado pierde el acceso de inmediato (las reglas lo rechazan) y la app cierra su sesión al detectar el cambio.
- La sesión queda abierta en el dispositivo hasta que el usuario cierra sesión, para poder trabajar sin internet.

## 5. Arquitectura

### 5.1 Piezas

- **Repositorio** `kdnaskrlos/Punto-de-Venta`, publicado con GitHub Pages.
- **Sin paso de compilación:** HTML, CSS y JavaScript con módulos ES, y Firebase cargado desde su CDN oficial, como en Pedidos.
- **Service worker** que guarda la app para abrirla sin internet. Al publicarse una versión nueva aparece "Hay una versión nueva · Actualizar".
- **Firestore con caché persistente** (varias pestañas), así que los datos quedan en el dispositivo.
- **Número de versión** (`APP_VERSION`) visible al pie de Inicio, en "Más" y en la cabecera de la PC. Sube en cada cambio, junto con la versión de caché del service worker.

### 5.2 Organización del código

Cada archivo tiene un propósito. Los cálculos de dinero son **funciones puras** sin Firebase ni pantalla, para poder probarlas solas.

```
index.html, manifest.webmanifest, sw.js, firestore.rules, GUIA.md
css/            tokens.css (sistema comicshop-interfaz), base.css, componentes.css
js/nucleo/      dinero.js      formato y redondeo de COP, USD, Bs
                tasas.js       conversión entre monedas, tasa vigente
                tramos.js      tramo por cantidad, regla del mix, precio por línea
                comisiones.js  comisión normal y reducida por línea
                cobro.js       pagos mixtos, falta, vuelto
                caja.js        esperado por forma de pago, diferencias
                importar.js    convertir inventario.json en cambios a aplicar
                fotos.js       emparejar nombres de archivo con grupos
js/datos/       firebase.js, sesion.js, productos.js, ventas.js, apartados.js,
                cajas.js, ajustes.js, autorizaciones.js, sincronizacion.js
js/vistas/      inicio, vender, cobrar, apartados, inventario, caja,
                reportes, ajustes, calculadora, entrar
js/app.js       arranque, navegación, cabecera, botón atrás
pruebas/        pruebas automáticas de js/nucleo y de las reglas
```

## 6. Datos (Firestore)

Montos en COP guardados como **enteros en pesos**. USD y Bs con 2 decimales.

| Colección | Documento | Campos principales | Lectura / escritura |
|---|---|---|---|
| `logins/{usuario}` | Usuario → correo interno | `email`, `uid` | Pública / admin |
| `usuarios/{uid}` | Perfil | `usuario`, `nombre`, `rol` (`admin`·`encargada`·`vendedora`), `activo` | Usuarios activos / admin |
| `productos/{sku}` | Una variante | `sku`, `nombre`, `producto` (base del Tarifario), `grupo` (producto + color), `color`, `talla`, `categoria`, `marca`, `codigo` (barras), `precios[5]`, `separado` (bool), `comisiones` (por tramo: tipo, valor, reducida), `existencia`, `minimo`, `foto` (ruta), `oferta` (`{pct, activa}`), `activo` | Todos leen. Vendedora solo puede cambiar `existencia` |
| `costos/{sku}` | Costo de la variante | `costo` (actual), `historial[]` (`costo`, `desde`) | Admin y encargada |
| `costosVenta/{ventaId}` | Costo congelado de una venta | `lineas[]` (`sku`, `costoUnit`), `total` | Admin y encargada; se crea una vez y no se edita |
| `ventas/{id}` | Venta o anulación | ver 6.1 | Crea el usuario de la venta. Solo admin y encargada anulan |
| `apartados/{id}` | Apartado | líneas, cliente, `abonos[]`, `saldo`, `estado` (`pendiente`·`completado`·`cancelado`), `ventaId` | Todos crean y abonan. Admin y encargada cancelan |
| `cajas/{id}` | Turno de caja de un usuario | `usuario`, `abierta`, `fondo` (por moneda), `movimientos[]`, `cierre` (contado y diferencia por forma de pago, nota), `estado` | El dueño de la caja escribe mientras está abierta. Admin reabre |
| `movimientos/{id}` | Cambio de existencia | `sku`, `cantidad` (±), `motivo` (`venta`·`apartado`·`anulación`·`cancelación`·`ajuste`·`importación`), `ref`, `usuario`, `fecha`, `nota` | Se crea con cada cambio; nunca se edita |
| `clientes/{telefono}` | Lista básica | `nombre`, `telefono` | Usuarios activos |
| `autorizaciones/{id}` | Pedido de descuento | `solicita`, `pct` o monto, `motivo`, `estado`, `aprueba` | Vendedora crea; admin y encargada responden |
| `comisiones/{id}` | Pago de comisiones | `vendedor`, `desde`, `hasta`, `monto`, `fecha` | Admin y encargada |
| `ajustes/general` | Configuración | formas de pago, tramos (`[1,6,12,24,49]`), comisiones por defecto, redondeo (100), descuento máximo de la vendedora (5%), nombre y teléfono de la tienda | Todos leen. Admin escribe |
| `ajustes/tasas` | Tasas vigentes | `copPorUsd`, `copActualizada`, `bsModo` (`binance`·`bcv`·`manual`), `bsRecargo`, `bsManual` | Todos leen. Admin escribe |

### 6.1 Venta

`id` generado en el dispositivo (sirve para evitar duplicados), `numero` legible (V-0001, asignado al sincronizar), `fecha`, `usuario`, `cajaId`, `cliente` (`nombre`, `telefono`), `lineas[]` (`sku`, `nombre`, `cantidad`, `tramo`, `precioUnit`, `oferta`, `comision`, `reducida`), `subtotal`, `descuento` (`pct` o monto, `autorizadoPor`), `total`, `pagos[]` (`forma`, `moneda`, `monto`, `equivalenteCop`), `vuelto` (`moneda`, `monto`, `equivalenteCop`), `tasas` (`copPorUsd`, `bsPorUsd`, `fuenteBs`), `offline` (bool), `estado` (`ok`·`anulada`), `anulacion` (`por`, `motivo`, `fecha`).

## 7. Productos, importación y fotos

### 7.1 Cambio previo en la Carga Masiva

Para que el POS reciba todo lo que necesita, `inventario.json` de la Carga Masiva agrega estos datos por variante:
- `price5` (tramo +49).
- `separado` (cuenta por separado en el mix), tomado del Tarifario.
- `producto` (nombre base del Tarifario), `color` y `talla` explícitos.

Se sube la versión de la Carga Masiva y se mantiene compatible con la plantilla actual de 51 columnas.

### 7.2 Importar

- Botón **Importar** (admin y encargada, en PC). Lee `https://kdnaskrlos.github.io/App-Inventario/data/inventario.json`.
- **Vista previa** antes de aplicar: nuevos, con cambios (precio, costo, nombre, código, comisiones, separado) y sin cambios.
- Al aplicar: los nuevos se crean con la existencia del archivo (con un movimiento `importación`). Los existentes actualizan sus datos pero **nunca su existencia**.
- Los SKU que existen en el POS pero no en el archivo **no se borran**. Se listan para que se marquen como inactivos si hace falta.
- Si falta `price5`, el tramo +49 usa el precio del tramo 4. Si falta `producto`, `color` o `talla`, se usa el nombre y se avisa en la vista previa.

### 7.3 Fotos masivas

- En PC (admin y encargada). Se arrastra una carpeta o varios archivos.
- **Emparejado por nombre de archivo** con el `grupo` (producto + color), ignorando mayúsculas, acentos, espacios y guiones. Todas las tallas de un grupo comparten foto.
- Lista de **sin asignar** para colocarlas tocando.
- Cada foto se comprime en el navegador a WebP de ~100 KB y 800 px de lado mayor.
- Se suben al repositorio del POS (`fotos/{grupo}.webp`) con un **token de GitHub de permisos limitados** que vive solo en el navegador del administrador, igual que el Tarifario. Nunca se sube el token.
- El service worker guarda las fotos vistas para mostrarlas sin internet.

### 7.4 Ajustes de inventario y ofertas

- Ajuste: sumar o restar existencia con **motivo obligatorio** (conteo, daño, regalo, llegó del taller, otro con nota). Crea un movimiento.
- Oferta: un % de descuento por **grupo**, que se activa y desactiva. Se aplica sobre el precio del tramo y activa la comisión reducida.
- Historial por producto: lista de sus movimientos.

## 8. Vender

### 8.1 Pantalla

- **Buscador** por nombre, SKU o código de barras. En PC el buscador está siempre listo para recibir el lector de códigos. En el teléfono, el botón de escanear usa la cámara (lector de códigos del navegador o una librería ligera de respaldo).
- Filtros por categoría como pastillas.
- **Tarjetas por grupo** (producto + color): foto, nombre, color y número de tallas, y precio detal. Si la existencia del grupo está bajo el mínimo, la palabra "pocas" en ámbar. Si está agotada, la foto se apaga y aparece una pastilla roja **"Agotada"**, con texto a contraste completo.
- Al tocar una tarjeta: ventana con las **tallas como botones de 44 px o más**, cada una con su existencia. Las agotadas no se pueden elegir.
- **Carrito:** fijo a la derecha en PC. En el teléfono, una barra verde abajo ("4 prendas · 116.000 · Ver") que abre el carrito. Cada línea tiene + / −, quitar y la etiqueta del tramo aplicado ("precio 1–5").
- **Aviso de tramo:** "Con 2 prendas más pasan a precio 6–11" (cuando aplica).
- **Total** en COP grande (28 px, 800), con equivalentes USD y Bs debajo en sus colores.
- Botones **Apartar** y **Cobrar**.

### 8.2 Precio por tramo (regla del mix)

- Tramos por defecto: 1–5, 6–11, 12–23, 24–48, 49+ (editables en ajustes, deben coincidir con el Tarifario).
- **Cantidad del mix** = suma de unidades de todas las líneas cuyo producto **no** es `separado`.
- Para un producto `separado`, su cantidad es la suma de unidades de sus variantes (mismo `producto`) en el carrito.
- Tramo de cada línea = tramo de su cantidad (mix o propia). Precio unitario = `precios[tramo]` de la variante. Si hay oferta activa en su grupo: `redondear(precio × (1 − pct))`.
- El precio se recalcula con cada cambio del carrito.
- Aviso de tramo: si la cantidad del mix está a 3 o menos unidades del siguiente tramo, se muestra cuántas faltan.

### 8.3 Descuento manual

- Sobre el total de la venta, en % o en monto.
- La vendedora puede aplicar hasta el **descuento máximo** (por defecto 5%).
- Si necesita más: **"Pedir autorización"** crea una solicitud. Al administrador y a la encargada les aparece en Inicio con insignia, con **Aprobar** y **Rechazar**. Al aprobarse, a la vendedora se le habilita el descuento al instante. Requiere internet; sin conexión se le avisa.
- Cualquier descuento manual activa la **comisión reducida** en todas las líneas de esa venta.
- Para la ganancia, el descuento se reparte entre las líneas en proporción a su monto.

## 9. Cobrar

### 9.1 Formas de pago (editables por el admin)

| Forma | Moneda |
|---|---|
| Efectivo pesos | COP |
| Transferencia / Nequi / Bancolombia | COP |
| Efectivo dólares | USD |
| Zelle | USD |
| USDT (Binance) | USD |
| Efectivo bolívares | Bs |
| Pago móvil | Bs |
| Punto de venta | Bs |

### 9.2 Ventana Cobrar

1. **Cliente arriba:** teléfono primero (si ya existe, se completa el nombre), luego nombre. Ambos obligatorios. El error es una línea roja corta bajo el campo.
2. **Total** en COP.
3. **Formas de pago agrupadas por moneda** (pesos, dólares, bolívares), cada grupo con su color, en botones de 2 columnas de **48 px** de alto.
4. Al tocar una forma de pago se agrega un pago **ya lleno con lo que falta**, convertido a su moneda (ejemplo: Pago móvil 18.192,31 Bs). Se puede editar el monto.
5. Lista de pagos agregados, cada uno con su monto en su moneda y su equivalente en COP, y la opción de quitarlo.
6. **Barra Falta / Vuelto** siempre visible: ámbar mientras falta, verde cuando cuadra, azul cuando hay vuelto.
7. Si hay vuelto: se elige la **moneda del vuelto** y se muestra el monto exacto.
8. Botón final verde de ancho completo **"Cobrar 116.000"**. Se habilita cuando el cliente está completo y falta ≤ 0.
9. Después: "Venta guardada", con **Enviar recibo por WhatsApp** y **Nueva venta**.

### 9.3 Conversión, formato y redondeo

- `copPorUsd` (manual) y `bsPorUsd` (vigente). COP por Bs = `copPorUsd / bsPorUsd`.
- Equivalente en COP de un pago = monto × tasa, **redondeado al peso**.
- Monto sugerido en USD o Bs = falta en COP convertido, con **2 decimales redondeando hacia arriba** (para que el pago cubra el total).
- La venta se considera pagada si la falta es menor que la mitad del redondeo (50 COP con redondeo 100).
- Vuelto en COP redondeado a la **centena**. Vuelto en USD o Bs con 2 decimales.
- Formato: COP sin decimales con punto de miles (116.000). USD y Bs con coma decimal (29,74 · 18.192,31). Los montos nunca se parten en dos líneas.
- La venta guarda las tasas usadas.

### 9.4 Recibo por WhatsApp

Abre `https://wa.me/<teléfono>` con un texto ya escrito: tienda, fecha y hora, número de venta, líneas (cantidad, nombre, talla, precio), descuento, total en COP, pagos y vuelto, y un agradecimiento. El teléfono se normaliza con el código de país (Venezuela 58 o Colombia 57, según el formato que se escriba).

### 9.5 Guardar la venta y existencias

- **Con internet:** una **transacción de Firestore** lee la existencia de cada SKU, verifica que alcance, descuenta, crea la venta y los movimientos, todo junto. Si un SKU no alcanza, la venta no se guarda y se avisa cuál; el carrito queda intacto.
- **Sin internet** (la transacción falla por falta de conexión): se guarda con una escritura en lote que descuenta con incremento negativo, crea la venta con `offline: true` y sus movimientos. Sube sola al volver la conexión.
- **Advertencia sin conexión:** si alguna línea deja la existencia en 2 o menos, antes de cobrar sale: "Estás sin conexión y quedan pocas. Confirma con la tienda antes de cobrar."
- **Duplicados:** el `id` de la venta se genera en el dispositivo y las reglas no permiten sobrescribir una venta existente.
- **Existencia negativa:** si tras sincronizar una existencia queda bajo cero, al administrador y a la encargada les aparece una alerta en Inicio con las ventas involucradas.

### 9.6 Anular

Admin y encargada, con motivo obligatorio. La venta queda `anulada`, se devuelven las existencias (movimientos `anulación`) y su comisión deja de contar. En la caja aparece como salida por el mismo monto y formas de pago, para que el cierre cuadre.

## 10. Apartados

- Desde el carrito, **Apartar**: cliente obligatorio y **abono** (puede ser 0) con las mismas formas de pago.
- Las unidades se descuentan de la existencia de inmediato (mismo mecanismo que la venta, motivo `apartado`).
- Lista de apartados con su estado: amarillo (pendiente), verde (completado), gris (cancelado). Muestra cliente, prendas, abonado y saldo.
- **Abonar:** registra otro pago parcial.
- **Completar:** cobra el saldo y genera la venta (sin volver a descontar existencias). Los precios quedan como al apartar.
- **Cancelar** (admin y encargada): las unidades vuelven al inventario. Si hay que devolver abonos, se registra como salida de caja.
- Los abonos entran en la caja de quien los cobra.

## 11. Caja

- Para vender, apartar o abonar, el usuario debe tener **su caja abierta**. Solo una abierta por usuario.
- **Abrir:** fondo inicial por moneda (COP, USD, Bs).
- **Movimientos:** entradas y salidas de efectivo con motivo (gasto, retiro, otro).
- **Esperado** por forma de pago = fondo (solo efectivo) + cobros − vuelto − salidas + entradas − anulaciones.
- **Cerrar:** se escribe lo contado por forma de pago. Se muestran esperado, contado y diferencia de cada una, más un total convertido a COP con las tasas del cierre. Diferencia 0 en verde, pequeña (hasta 1% del esperado o 2.000 COP) en ámbar, mayor en rojo. Cualquier diferencia pide una nota.
- Al cerrar, al administrador y a la encargada les aparece el resumen en Inicio.
- Una caja cerrada no se modifica. Solo el administrador la reabre, y queda registrado quién y cuándo.

## 12. Tasas y calculadora

### 12.1 Tasas

- **Cabecera:** pastilla "$ 3.900 · Bs 1.075", con cada número en el color de su moneda. Al tocarla, el detalle: fuente, hora de actualización y equivalencia COP por Bs.
- **COP/USD:** el administrador la escribe en Ajustes → Tasas. Si pasan 24 h sin cambiarla, la pastilla se pone en amarillo y aparece un aviso en Inicio.
- **Bs/USD:** se lee `https://kdnaskrlos.github.io/Calculadora-de-Tasas/tasa.json` al abrir y cada 10 minutos.
  - Modo **Binance**: `rate` + recargo (por defecto 15 Bs).
  - Modo **BCV**: `bcv.rate`.
  - Modo **manual**: el valor que escriba el administrador.
- Sin internet se usa la última tasa guardada y la pastilla indica "última conocida".
- Si nunca se obtuvo una tasa de Bs y el modo no es manual, las formas de pago en Bs quedan **desactivadas con un aviso**, en vez de cobrar con una tasa equivocada.

### 12.2 Calculadora rápida

- Ícono en la cabecera, en todas las pantallas. En PC se desliza un panel desde el borde derecho sin tapar el carrito; en el teléfono sube como hoja desde abajo.
- Tres casillas, COP, USD y Bs: se escribe en una y las otras dos se calculan al instante. Cada una tiene botón de copiar.
- Usa las **tasas del POS**. Funciona sin internet. No registra nada.

## 13. Diseño visual

Sistema **comicshop-interfaz** (Plus Jakarta Sans, verde `#15803d`, superficies blancas, colores crema para estados, tema claro por defecto con interruptor de oscuro en Ajustes), más estas reglas propias del POS.

### 13.1 Navegación

- **PC:** barra lateral de íconos (84 px): Inicio · Vender · Apartados · Inventario · Caja · Reportes · Ajustes (solo admin).
- **Teléfono (≤ 760 px):** barra inferior Inicio · Apartados · **Vender** (botón central verde destacado) · Inventario · Más. "Más" reúne Caja, Reportes, Comisiones, Calculadora, Ajustes y la versión.
- **Cabecera:** estado de conexión con punto, pastilla de tasas, calculadora, actualizar y fecha. Los íconos tienen 44 px de área de toque.

### 13.2 Colores con significado

- Monedas: **COP en teal `#0f766e`** (5,3:1), **USD en azul `#2563eb`**, **Bs en violeta `#7c3aed`**. El verde queda solo para acciones.
- Existencia: verde (hay), amarillo (bajo mínimo), rojo (agotada o negativa).
- Apartados: amarillo (pendiente), verde (completado), gris (cancelado).
- Cierre: verde, ámbar o rojo según la diferencia.
- Conexión: verde (en línea), amarillo (sin conexión con ventas por subir), rojo (error).

### 13.3 Accesibilidad y uso rápido

- Toque mínimo de **44 px** en todo. Formas de pago de 48 px.
- Contraste de texto ≥ 4,5:1. Nunca se usa opacidad sobre texto.
- **Borde de los campos más oscuro** en el POS, para que contraste al menos 3:1 con su fondo.
- La información nunca depende solo del color: cada moneda y estado lleva su texto.
- **Atajos en PC:** buscador listo para el lector de códigos, **F2** buscar, **F9** cobrar, **Esc** cerrar ventanas.
- Las ventanas mantienen el foco dentro y se cierran con Esc. En el teléfono, el **botón atrás** cierra ventanas y hojas en lugar de salir de la app.
- Los íconos sin texto llevan nombre para lectores de pantalla.
- Textos que no saltan de línea, íconos sin cajas, el scroll no se mueve solo.

### 13.4 Pantallas

- **Inicio (admin y encargada):** recuadros KPI teñidos con ventas de hoy, ganancia, caja de la tienda en vivo y existencias bajas. Debajo: autorizaciones pendientes, alertas (existencia negativa, tasa vencida, cierres con diferencia).
- **Inicio (vendedora):** su caja abierta (esperado por forma de pago) y sus ventas del día.
- **Inventario en el teléfono:** solo consulta (buscar o escanear; ver existencia, precios por tramo y foto). Importar y fotos masivas solo en PC.

## 14. Comisiones

- Cada variante trae de la Carga Masiva su comisión por tramo (tipo `Fijo` o porcentaje, valor, y valor reducido). Si falta, se usan las comisiones por defecto de Ajustes. El tramo +49 usa la del tramo 4 si no viene.
- La comisión de cada línea = valor del tramo × cantidad (o % del monto de la línea). Se usa la **reducida** si la venta tiene descuento manual o la línea tiene oferta activa.
- Se calcula al guardar la venta y **queda fija**. Si se anula la venta, su comisión deja de contar.
- Reporte por vendedor y rango de fechas: ventas, prendas, comisión normal y reducida, total, ya pagado y pendiente. **"Marcar como pagadas"** registra el pago del rango.

## 15. Reportes

Admin y encargada (la vendedora solo ve sus ventas del día):
- **Resumen del día:** ventas, ganancia (total − costo), unidades, ticket promedio, cobros por forma de pago.
- **Ventas por fechas** con filtro por vendedor (calendario propio del sistema de diseño).
- **Más vendidos** por grupo y por talla.
- **Existencias bajas** (≤ mínimo) y **valor del inventario** a costo y a precio detal.
- **Comisiones** (sección 14).

Se calculan en el dispositivo a partir de las ventas del rango elegido.

**Ganancia y costos:** cada venta queda con el costo que tenía cada prenda **en el momento de la venta**, y solo el administrador y la encargada pueden verlo:
- `costos/{sku}` guarda el costo actual y un **historial** `[{costo, desde}]`. Cada cambio de costo (por importación o a mano) agrega una entrada con su fecha y nunca borra las anteriores.
- La venta no copia el costo, porque la vendedora no tiene permiso para leer costos. El costo de cada línea es el del historial vigente en la `fecha` de la venta.
- La primera vez que el administrador o la encargada ven una venta (en reportes o Inicio), su app guarda el resultado en `costosVenta/{ventaId}` (costo por línea y total), solo legible por ellos. Desde ahí ese costo queda congelado, aunque después se corrija el historial.
- Así las ganancias de ventas pasadas no cambian cuando sube o baja un costo, sin servidores de pago ni funciones en la nube.

## 16. Sincronización y errores

| Situación | Comportamiento |
|---|---|
| Sin internet | Se vende, aparta, abona y cierra caja. El indicador muestra "Sin conexión · X por subir". Se usan las últimas tasas |
| Vuelve internet | Todo sube solo. El indicador vuelve a "En línea" |
| Otro vendió la última unidad (con internet) | La transacción rechaza la venta, se avisa qué producto, el carrito queda intacto |
| Existencia negativa tras sincronizar | Alerta en Inicio para admin y encargada con las ventas involucradas |
| Sin tasa de Bs | Formas de pago en Bs desactivadas con aviso |
| Tasa COP con más de 24 h | Pastilla amarilla y aviso al administrador |
| Error al guardar (permisos, datos inválidos) | Indicador rojo y mensaje claro. La venta no se marca como guardada |
| Usuario desactivado | Las reglas lo rechazan y la app cierra su sesión |
| Falla la importación o la lectura de `inventario.json` | Mensaje claro, nada se aplica a medias (los cambios se aplican en lotes atómicos) |
| Nueva versión publicada | Aviso "Hay una versión nueva · Actualizar" |

## 17. Pruebas

- **Pruebas automáticas** (`node --test`) de todo `js/nucleo`: tramos con mix y separado, ofertas, conversiones y redondeo, monto sugerido y vuelto, comisiones normal y reducida, esperado y diferencias de caja, importación (nuevos, cambios, sin existencia), emparejado de fotos.
- **Reglas de seguridad** probadas con el emulador de Firebase si está disponible; si no, con una lista de comprobación manual en el proyecto real (por ejemplo: la vendedora no puede leer `costos` ni cambiar precios).
- **Pruebas en navegador** (Playwright, si está disponible) de una venta completa con pago mixto, con y sin internet, en vista de teléfono (360 × 780) y PC (1530 px).
- **Prueba con usuarias:** tareas guiadas con la esposa y la vendedora antes de cerrar la fase.

## 18. Pendientes fuera del código

- Carlos crea el repositorio `Punto-de-Venta` y el proyecto de Firebase "Punto de Venta Comic Shop" (o se hace con el conector de Firebase, si está disponible en el chat de construcción). Se entregará una `GUIA.md` paso a paso para lo que deba hacerse a mano: activar Authentication con correo y contraseña, crear Firestore, publicar las reglas y pegar la configuración en la app.
- Token de GitHub de permisos limitados para subir fotos (se explica en la guía).
- Modificación de la Carga Masiva (sección 7.1).
