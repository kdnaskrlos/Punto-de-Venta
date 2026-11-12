# Punto de Venta Comic Shop · Fase 1 — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el núcleo del punto de venta de Comic Shop: app instalable que vende, cobra en COP/USD/Bs, aparta, maneja caja, comisiones y reportes, funciona sin internet y se sincroniza con Firebase.

**Architecture:** PWA sin paso de compilación (HTML + CSS + módulos ES) publicada en GitHub Pages. Los cálculos de dinero viven en funciones puras (`js/nucleo/`) probadas con `node --test`. Las pantallas (`js/vistas/`) hablan solo con un **almacén** (`js/datos/`) que tiene dos implementaciones con el mismo contrato: `memoria.js` (modo demo y pruebas en navegador) y `firebase.js` (Firestore con caché persistente).

**Tech Stack:** JavaScript ES2022 con módulos, Firebase JS SDK 10.12.2 desde `https://www.gstatic.com/firebasejs/10.12.2/` (igual que Pedidos), Node 22 `node:test`, Playwright 1.63 (global en `/opt/npm-tools/node_modules`) para pruebas en navegador, servidor local `python3 -m http.server`.

**Spec:** `docs/superpowers/specs/2026-11-12-punto-de-venta-fase1-design.md` (leerla completa antes de empezar; este plan cita sus secciones como §N).

## Global Constraints

- Todo texto de interfaz en español, frases cortas; toasts de 1–3 palabras ("Venta guardada").
- Sistema de diseño **comicshop-interfaz** (skill `anthropic-skills:comicshop-interfaz`): Plus Jakarta Sans, acento `#15803d`, tokens de su §3, tema **claro por defecto**, interruptor de oscuro en Ajustes.
- Colores de moneda: COP `#0f766e`, USD `#2563eb`, Bs `#7c3aed` (modo oscuro: `#2dd4bf`, `#60a5fa`, `#a78bfa`). El verde solo para acciones.
- Toque mínimo 44 px; formas de pago 48 px de alto; contraste de texto ≥ 4,5:1; nunca opacidad sobre texto; borde de campos del POS `#9ca3af` (claro) / `#4b5563` (oscuro).
- Montos con `white-space:nowrap` y `font-variant-numeric:tabular-nums`. COP sin decimales con punto de miles; USD y Bs con 2 decimales y coma decimal.
- COP se guarda como entero de pesos; USD y Bs con 2 decimales.
- `APP_VERSION` en `js/version.js` y `CACHE` en `sw.js` suben en **cada** tarea que cambie la app (v1.0 en la Tarea 1, +0.1 por tarea). La versión se ve al pie de Inicio, en "Más" y en la cabecera de PC.
- Teléfono = ancho ≤ 760 px. Pruebas de navegador en 360×780 y 1530×900.
- Ningún token, clave ni PIN en el repositorio. `config.js` solo lleva la configuración pública de Firebase.
- Roles: `admin`, `encargada`, `vendedora`. Toda decisión de permiso pasa por `puede(rol, accion)` (Tarea 2) en la interfaz **y** se repite en `firestore.rules` (Tarea 17).

## Review Focus

1. **Montos tecleados con separadores ambiguos** ("10.500" en COP es diez mil quinientos; "10.50" en USD es diez con cincuenta; "1.234,5" en Bs). Esperado: se interpreta según la moneda, nunca un monto 1000 veces mayor. → prueba en Tarea 2.
2. **Tasa de Bs ausente, 0 o texto** (tasa.json caído en la primera apertura). Esperado: conversiones a Bs devuelven `null` y las formas de pago en Bs se desactivan; nunca `NaN` ni `Infinity` en pantalla. → pruebas en Tareas 3 y 11.
3. **Doble toque en "Cobrar" o reintento tras corte de red.** Esperado: una sola venta y un solo descuento de existencia. → prueba en Tarea 7.
4. **Carrito con cantidad 0/negativa o variante sin precio en un tramo.** Esperado: la línea se descarta o usa el precio del tramo anterior con valor; total nunca `NaN`. → prueba en Tarea 4.
5. **Teléfonos en formatos reales** ("0412-123.45.67", "+58 412 1234567", "300 123 4567", "57 3001234567"). Esperado: enlace `wa.me` con número internacional correcto, o error de campo si no se reconoce. → prueba en Tarea 6.

---

## Estructura de archivos

```
index.html               shell, carga fuentes, monta #app, registra sw
config.js                firebaseConfig público (vacío = modo demo)
manifest.webmanifest, sw.js, icono-192.png, icono-512.png
firestore.rules          reglas de seguridad (Tarea 17)
GUIA.md                  pasos manuales para Carlos (Tarea 17)
package.json             { "type":"module", "scripts": { "test":"node --test pruebas/nucleo pruebas/datos" } }
css/tokens.css           tokens comicshop-interfaz + colores de moneda
css/base.css             tipografía, layout, navegación, cabecera
css/componentes.css      botones, campos, pastillas, tarjetas, ventanas, toasts, hojas
js/version.js            export const APP_VERSION
js/app.js                arranque, enrutador por hash, cabecera, nav, botón atrás, atajos
js/ui.js                 helpers DOM: h(), abrirVentana(), abrirHoja(), toast(), icono()
js/nucleo/dinero.js      formato, parseo, redondeo
js/nucleo/permisos.js    matriz de roles (§4)
js/nucleo/tasas.js       tasas vigentes y conversión
js/nucleo/tramos.js      tramos, mix, ofertas, aviso
js/nucleo/descuento.js   reparto de descuento y límites
js/nucleo/cobro.js       pagos mixtos, falta, sugerido, vuelto
js/nucleo/comisiones.js  comisión por línea y resúmenes
js/nucleo/caja.js        esperado y diferencias de cierre
js/nucleo/costos.js      costo vigente por fecha, costo de venta
js/nucleo/importar.js    inventario.json → productos y plan
js/nucleo/fotos.js       claves y emparejado de fotos
js/nucleo/recibo.js      teléfono internacional y texto del recibo
js/nucleo/reportes.js    resúmenes del día, más vendidos, inventario
js/datos/contrato.js     JSDoc del almacén + ids
js/datos/memoria.js      almacén en memoria (demo, pruebas)
js/datos/firebase.js     almacén Firestore
js/datos/index.js        elige almacén: firebase si config.js tiene apiKey y no hay ?demo
js/datos/semilla.js      datos demo (productos de ejemplo de §8, usuarios demo)
js/vistas/entrar.js, inicio.js, vender.js, cobrar.js, apartados.js, inventario.js,
          caja.js, reportes.js, comisiones.js, ajustes.js, calculadora.js, mas.js
pruebas/nucleo/*.test.js     una por módulo de nucleo
pruebas/datos/memoria.test.js
pruebas/e2e/*.cjs            Playwright (ejecutar con NODE_PATH=/opt/npm-tools/node_modules)
pruebas/e2e/_servidor.cjs    levanta http.server en :8765 y abre la app con ?demo
pruebas/REGLAS.md            lista manual de comprobación de reglas (Tarea 17)
```

## Formas de datos compartidas

Definidas una vez; todas las tareas las usan con estos nombres.

```js
// Moneda: 'COP' | 'USD' | 'BS'
// Producto (variante), §6:
{ sku, nombre, producto, grupo, color, talla, categoria, marca, codigo,
  precios: [p1,p2,p3,p4,p5|null], separado: bool,
  comisiones: [{tipo:'Fijo'|'Porcentaje', valor, reducida}|null ×5],
  existencia, minimo, foto: 'fotos/<clave>.webp'|null, oferta: {pct, activa}|null, activo: bool }
// Línea de carrito: { sku, cantidad }
// Pago: { forma, moneda, monto }            forma = id de ajustes.formasPago
// Tasas: { copPorUsd, bsPorUsd|null, fuenteBs, bsActualizada, copActualizada, ultimaConocida }
// FormaPago (ajustes): { id, nombre, moneda, efectivo: bool, activa: bool }
```

Formas de pago por defecto (§9.1), ids fijos: `efectivo-cop`, `transferencia-cop`, `efectivo-usd`, `zelle`, `usdt`, `efectivo-bs`, `pago-movil`, `punto`. `efectivo:true` solo en las tres de efectivo.

---

### Task 1: Esqueleto instalable con navegación y versión

**Files:**
- Create: `index.html`, `config.js`, `manifest.webmanifest`, `sw.js`, íconos, `package.json`, `css/tokens.css`, `css/base.css`, `css/componentes.css`, `js/version.js`, `js/app.js`, `js/ui.js`, `js/vistas/*.js` (vacías con título interno), `pruebas/e2e/_servidor.cjs`, `pruebas/e2e/esqueleto.cjs`, `.gitignore`

**Interfaces:**
- Produces: `ui.js` → `h(tag, attrs, ...hijos): HTMLElement`, `icono(nombre): SVGElement` (íconos Lucide inline, 20 px), `abrirVentana({titulo, contenido, acciones, pantallaCompleta}): {cerrar()}`, `abrirHoja({contenido, lado:'derecha'|'abajo'}): {cerrar()}`, `toast(texto, {deshacer}?)`; `app.js` → `registrarVista(ruta, {montar(contenedor, ctx), rol?})`, `navegar(ruta)`, `ctx = {almacen, sesion, tasas, ajustes}`; pila de capas abiertas que el botón atrás y Esc cierran primero.

- [ ] **Step 1: Escribir `pruebas/e2e/esqueleto.cjs`**: abre `http://localhost:8765/?demo` a 1530×900 y 360×780; afirma que existen la barra lateral (PC) con 7 íconos y la barra inferior (teléfono) con 5 ítems cuyo central es Vender, la cabecera con estado de conexión, pastilla de tasas, botón calculadora, actualizar y fecha corta ("Jueves 12 nov" según fecha del sistema); que `document.body.innerText` contiene `v1.0`; que cada botón de nav mide ≥ 44×44; que al abrir una ventana y pulsar `Escape` se cierra, y que `history.back()` con ventana abierta la cierra sin cambiar de ruta.
- [ ] **Step 2: Ejecutar** `NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/esqueleto.cjs` → falla (no hay app).
- [ ] **Step 3: Implementar** el shell. Carga de fuente sin saltos según comicshop-interfaz §2. Enrutador por hash (`#/inicio`, `#/vender`, …). En teléfono "Más" agrupa Caja, Reportes, Comisiones, Calculadora, Ajustes y la versión. `sw.js`: precachea el shell, red primero para `.json`, caché primero para el resto; constante `CACHE='pos-v1.0'`; mensaje `nueva-version` que la app muestra como "Hay una versión nueva · Actualizar". Cabecera con datos falsos hasta la Tarea 11.
- [ ] **Step 4: Ejecutar la prueba** → pasa. Tomar capturas en ambos tamaños y revisarlas contra los bocetos aprobados.
- [ ] **Step 5: Commit** `feat: esqueleto instalable con navegación (v1.0)`

### Task 2: Dinero y permisos

**Files:** Create `js/nucleo/dinero.js`, `js/nucleo/permisos.js`, `pruebas/nucleo/dinero.test.js`, `pruebas/nucleo/permisos.test.js`

**Interfaces:**
- Produces: `redondear(n, paso=1): number` · `fmtCop(n): string` · `fmtDec(n): string` · `fmtMonto(n, moneda): string` · `parseMonto(texto, moneda): number|null` · `puede(rol, accion): boolean` con acciones: `vender, abrirCaja, descuentoHastaMax, descuentoSinLimite, aprobarDescuento, verCostos, verReportesTodos, importar, fotosMasivas, ajustarInventario, ofertas, anularVenta, cancelarApartado, pagarComisiones, cambiarTasas, reabrirCaja, ajustes`.

- [ ] **Step 1: Pruebas**
```js
assert.equal(fmtCop(116000), '116.000'); assert.equal(fmtCop(-2500), '-2.500');
assert.equal(fmtDec(18192.307), '18.192,31'); assert.equal(fmtMonto(29.7435,'USD'), '29,74');
assert.equal(redondear(116049, 100), 116000); assert.equal(redondear(116050, 100), 116100);
// Review Focus 1
assert.equal(parseMonto('10.500','COP'), 10500); assert.equal(parseMonto('10500','COP'), 10500);
assert.equal(parseMonto('10.50','USD'), 10.5);   assert.equal(parseMonto('10,5','USD'), 10.5);
assert.equal(parseMonto('1.234,5','BS'), 1234.5); assert.equal(parseMonto('1.234','BS'), 1234);
assert.equal(parseMonto('','COP'), null); assert.equal(parseMonto('abc','USD'), null);
// permisos (§4, tabla exacta)
assert.ok(puede('encargada','verCostos')); assert.ok(!puede('encargada','aprobarDescuento'));
assert.ok(!puede('encargada','importar')); assert.ok(!puede('encargada','ofertas'));
assert.ok(!puede('encargada','cambiarTasas')); assert.ok(puede('encargada','anularVenta'));
assert.ok(puede('encargada','descuentoSinLimite')); assert.ok(!puede('vendedora','verCostos'));
assert.ok(puede('admin','reabrirCaja')); assert.ok(!puede('desconocido','vender'));
```
- [ ] **Step 2: Ejecutar** `npm test` → falla.
- [ ] **Step 3: Implementar.** Regla de `parseMonto`: COP → todo punto y coma son miles salvo una coma seguida de 1–2 dígitos al final (se descarta, COP es entero); USD/BS → si hay coma, la coma es decimal y los puntos miles; si solo hay puntos, el último punto es decimal cuando le siguen 1–2 dígitos, si le siguen 3 es miles. `fmt*` con `Intl.NumberFormat('es-CO')`.
- [ ] **Step 4: Ejecutar** `npm test` → pasa.
- [ ] **Step 5: Commit** `feat: formato de dinero y matriz de permisos`

### Task 3: Tasas y conversión

**Files:** Create `js/nucleo/tasas.js`, `pruebas/nucleo/tasas.test.js`

**Interfaces:**
- Consumes: `redondear`.
- Produces: `tasasVigentes(ajustesTasas, tasaJson|null, cacheBs|null): Tasas` · `aCop(monto, moneda, tasas): number|null` (entero) · `desdeCop(cop, moneda, tasas, {haciaArriba=false}): number|null` (2 decimales; COP devuelve el entero) · `copPorBs(tasas): number|null`.
  `ajustesTasas = {copPorUsd, copActualizada, bsModo:'binance'|'bcv'|'manual', bsRecargo, bsManual}`; `cacheBs = {bsPorUsd, fuenteBs, bsActualizada}`.

- [ ] **Step 1: Pruebas**
```js
const aj = {copPorUsd:3900, bsModo:'binance', bsRecargo:15, bsManual:null};
const tj = {rate:1060, updated_at:'2026-11-12T14:10:27Z', bcv:{rate:236.5}};
const t = tasasVigentes(aj, tj, null);
assert.equal(t.bsPorUsd, 1075); assert.equal(t.fuenteBs, 'binance'); assert.equal(t.ultimaConocida, false);
assert.equal(tasasVigentes({...aj, bsModo:'bcv'}, tj, null).bsPorUsd, 236.5);
assert.equal(tasasVigentes({...aj, bsModo:'manual', bsManual:1100}, null, null).bsPorUsd, 1100);
const c = tasasVigentes(aj, null, {bsPorUsd:1070, fuenteBs:'binance', bsActualizada:'x'});
assert.equal(c.bsPorUsd, 1070); assert.equal(c.ultimaConocida, true);
assert.equal(aCop(50, 'USD', t), 195000);
assert.equal(aCop(18192.31, 'BS', t), 66000);
assert.equal(desdeCop(66000, 'BS', t, {haciaArriba:true}), 18192.31);
assert.equal(desdeCop(116000, 'USD', t), 29.74);
// Review Focus 2
const sin = tasasVigentes(aj, null, null);
assert.equal(sin.bsPorUsd, null); assert.equal(aCop(100,'BS',sin), null); assert.equal(desdeCop(1000,'BS',sin), null);
assert.equal(tasasVigentes(aj, {rate:0}, null).bsPorUsd, null);
assert.equal(tasasVigentes(aj, {rate:'x'}, null).bsPorUsd, null);
```
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar** (cualquier tasa no finita o ≤ 0 se trata como ausente). **Step 4: Ejecutar** → pasa.
- [ ] **Step 5: Commit** `feat: tasas vigentes y conversión COP/USD/Bs`

### Task 4: Tramos, mix, ofertas y descuento

**Files:** Create `js/nucleo/tramos.js`, `js/nucleo/descuento.js`, `pruebas/nucleo/tramos.test.js`, `pruebas/nucleo/descuento.test.js`

**Interfaces:**
- Produces:
  - `LIMITES_DEFECTO = [1,6,12,24,49]` · `tramoDe(cantidad, limites): 0..4` · `etiquetaTramo(i, limites): '1–5'|'6–11'|…|'49+'`
  - `calcularCarrito(lineas, productosPorSku, {limites, redondeo}): { lineas:[{sku, cantidad, tramo, precioUnit, subtotal, oferta:bool}], cantidadMix, subtotal, aviso:{faltan, etiqueta}|null }`
  - `aplicarDescuento(subtotal, {tipo:'pct'|'monto', valor}): {descuento, total}` · `repartirDescuento(lineas, descuento): number[]` (por línea, suma exacta) · `requiereAutorizacion(rol, pct, maxPct): boolean`

- [ ] **Step 1: Pruebas** (productos de ejemplo: franela `F` precios [25000,24000,22500,20000,null]; buzo `B` [48000,45000,42000,40000,38000]; body `Y` [18000,17000,16000,15000,14000] `separado:true`, producto 'Body Serfe')
```js
const r = calcularCarrito([{sku:'F',cantidad:3},{sku:'B',cantidad:3}], P, {limites:LIMITES_DEFECTO, redondeo:100});
assert.equal(r.cantidadMix, 6); assert.deepEqual(r.lineas.map(l=>l.tramo), [1,1]);
assert.equal(r.subtotal, 3*24000 + 3*45000);
const s = calcularCarrito([{sku:'F',cantidad:4},{sku:'Y',cantidad:2}], P, opts);
assert.equal(s.cantidadMix, 4); assert.equal(s.lineas[1].tramo, 0); // separado cuenta solo lo suyo
assert.deepEqual(s.aviso, {faltan:2, etiqueta:'6–11'});
assert.equal(calcularCarrito([{sku:'F',cantidad:49}], P, opts).lineas[0].precioUnit, 20000); // +49 sin p5 → p4
// oferta 10% sobre el tramo, redondeo 100
const PO = {...P, F:{...P.F, oferta:{pct:10, activa:true}}};
const o = calcularCarrito([{sku:'F',cantidad:1}], PO, opts).lineas[0];
assert.equal(o.precioUnit, 22500); assert.equal(o.oferta, true);
// Review Focus 4
const z = calcularCarrito([{sku:'F',cantidad:0},{sku:'B',cantidad:-2},{sku:'NOEXISTE',cantidad:1}], P, opts);
assert.equal(z.lineas.length, 0); assert.equal(z.subtotal, 0);
assert.equal(calcularCarrito([{sku:'F',cantidad:1}], {F:{...P.F, precios:[25000,0,null,null,null]}}, opts).subtotal, 25000);
assert.equal(calcularCarrito([{sku:'F',cantidad:7}], {F:{...P.F, precios:[25000,0,null,null,null]}}, opts).lineas[0].precioUnit, 25000);
// descuento
assert.deepEqual(aplicarDescuento(100000, {tipo:'pct', valor:5}), {descuento:5000, total:95000});
assert.deepEqual(repartirDescuento([{subtotal:75000},{subtotal:25000}], 5001), [3751, 1250]);
assert.ok(requiereAutorizacion('vendedora', 6, 5)); assert.ok(!requiereAutorizacion('vendedora', 5, 5));
assert.ok(!requiereAutorizacion('encargada', 30, 5));
```
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar.** Precio de un tramo sin valor válido (> 0) cae al tramo válido inmediatamente inferior. Cantidad propia de un `separado` = suma de líneas con el mismo `producto`. Aviso cuando `limites[t+1] - cantidadMix ≤ 3`. `repartirDescuento`: proporcional, redondeado al peso, el residuo va a la línea mayor.
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: tramos con mix, separado, ofertas y descuentos`

### Task 5: Cobro y comisiones

**Files:** Create `js/nucleo/cobro.js`, `js/nucleo/comisiones.js`, `pruebas/nucleo/cobro.test.js`, `pruebas/nucleo/comisiones.test.js`

**Interfaces:**
- Consumes: `aCop`, `desdeCop`, `redondear`.
- Produces:
  - `estadoCobro({total, pagos, tasas, redondeo}): {pagos:[...pago, equivalenteCop], pagadoCop, faltaCop, vueltoCop, cuadra}` (`faltaCop, vueltoCop ≥ 0`; `cuadra = faltaCop < redondeo/2`; un pago cuya moneda no tiene tasa → `equivalenteCop:null` y `cuadra:false`)
  - `montoSugerido(faltaCop, moneda, tasas): number|null` (hacia arriba)
  - `vueltoEn(vueltoCop, moneda, tasas, redondeo): number|null` (COP → `redondear(v, redondeo)`; USD/BS → 2 decimales)
  - `COMISIONES_DEFECTO = [{tipo:'Fijo',valor:4000,reducida:2000},{tipo:'Fijo',valor:2000,reducida:1000},{tipo:'Fijo',valor:1000,reducida:500},{tipo:'Fijo',valor:1000,reducida:500},null]`
  - `comisionLinea({tramo, cantidad, subtotal}, producto, defectos, reducida): number`
  - `comisionesVenta(lineasCalculadas, productosPorSku, defectos, hayDescuento): [{sku, comision, reducida}]`
  - `resumenComisiones(ventas, {vendedor, desde, hasta}, pagosComision): {ventas, prendas, normal, reducida, total, pagado, pendiente}` (ignora `estado:'anulada'`)

- [ ] **Step 1: Pruebas**
```js
const t = {copPorUsd:3900, bsPorUsd:1075};
let e = estadoCobro({total:116000, pagos:[{forma:'efectivo-cop',moneda:'COP',monto:50000}], tasas:t, redondeo:100});
assert.equal(e.faltaCop, 66000);
assert.equal(montoSugerido(66000,'BS',t), 18192.31);
e = estadoCobro({total:116000, pagos:[{forma:'efectivo-cop',moneda:'COP',monto:50000},{forma:'pago-movil',moneda:'BS',monto:18192.31}], tasas:t, redondeo:100});
assert.equal(e.cuadra, true); assert.equal(e.vueltoCop, 0);
e = estadoCobro({total:116000, pagos:[{forma:'efectivo-usd',moneda:'USD',monto:40}], tasas:t, redondeo:100});
assert.equal(e.vueltoCop, 40000); assert.equal(vueltoEn(40000,'BS',t,100), 11025.64);
assert.equal(vueltoEn(40049,'COP',t,100), 40000);
assert.equal(estadoCobro({total:1000, pagos:[{forma:'pago-movil',moneda:'BS',monto:10}], tasas:{copPorUsd:3900,bsPorUsd:null}, redondeo:100}).cuadra, false);
// comisiones (§14)
assert.equal(comisionLinea({tramo:0,cantidad:2,subtotal:50000}, {comisiones:[]}, COMISIONES_DEFECTO, false), 8000);
assert.equal(comisionLinea({tramo:0,cantidad:2,subtotal:50000}, {comisiones:[]}, COMISIONES_DEFECTO, true), 4000);
assert.equal(comisionLinea({tramo:4,cantidad:1,subtotal:20000}, {comisiones:[]}, COMISIONES_DEFECTO, false), 1000); // +49 → tramo 4
assert.equal(comisionLinea({tramo:0,cantidad:1,subtotal:30000}, {comisiones:[{tipo:'Porcentaje',valor:10,reducida:5}]}, COMISIONES_DEFECTO, false), 3000);
const cv = comisionesVenta([{sku:'F',tramo:0,cantidad:1,subtotal:22500,oferta:true},{sku:'B',tramo:0,cantidad:1,subtotal:48000,oferta:false}], P, COMISIONES_DEFECTO, false);
assert.deepEqual(cv.map(c=>c.reducida), [true,false]);
```
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar.** Comisión de un tramo sin dato (en el producto o en los defectos) usa la del tramo inferior con dato; `Porcentaje` se aplica sobre el `subtotal` de la línea; el resultado se redondea al peso. **Step 4: Ejecutar** → pasa.
- [ ] **Step 5: Commit** `feat: cobro multimoneda y comisiones`

### Task 6: Caja, costos, recibo, importación, fotos y reportes (núcleo)

**Files:** Create `js/nucleo/caja.js`, `costos.js`, `recibo.js`, `importar.js`, `fotos.js`, `reportes.js` y sus `pruebas/nucleo/*.test.js`

**Interfaces:**
- Produces:
  - `esperadoCaja(caja, ventas, abonos, formasPago): {[formaId]: monto}` — `caja = {fondo:{COP,USD,BS}, movimientos:[{tipo:'entrada'|'salida', forma, monto, motivo}]}`; el fondo de cada moneda suma a su forma `efectivo:true`; ventas `ok` suman pagos y restan el vuelto en la forma de efectivo de su moneda; ventas `anulada` de esta caja restan sus pagos.
  - `diferenciasCierre(esperado, contado, formasPago, tasas): {filas:[{forma, esperado, contado, diferencia, nivel:'ok'|'leve'|'grave'}], totalCop}` — `leve` si |dif en COP| ≤ máx(1% del esperado en COP, 2000).
  - `costoEn(historial, fechaISO): number|null` · `costoVenta(venta, costosPorSku): {lineas:[{sku,costoUnit}], total}`
  - `telefonoInternacional(texto): string|null` · `textoRecibo(venta, tienda): string` · `enlaceWhatsApp(venta, tienda): string|null`
  - `leerInventario(json): {productos:[Producto & {costo}], avisos:string[]}` · `planImportacion(entrantes, actualesPorSku): {nuevos, cambios:[{sku, campos:{...}}], iguales, faltantes}`
  - `claveFoto(texto): string` · `emparejarFotos(nombresArchivo, grupos): {asignadas:[{archivo, grupo}], sinAsignar:string[]}`
  - `resumenDia(ventas, costosVenta): {total, ganancia|null, unidades, ticketPromedio, porForma}` · `masVendidos(ventas, productosPorSku, n): [{grupo, unidades}]` · `inventarioBajo(productos)` · `valorInventario(productos, costosPorSku): {aCosto, aPrecio}`

- [ ] **Step 1: Pruebas** (los valores exactos que importan)
```js
// caja
const esp = esperadoCaja({fondo:{COP:50000,USD:20,BS:500}, movimientos:[{tipo:'salida',forma:'efectivo-cop',monto:10000,motivo:'gasto'}]},
  [{estado:'ok', pagos:[{forma:'efectivo-cop',monto:120000},{forma:'pago-movil',monto:5000}], vuelto:{moneda:'COP',monto:4000}}], [], FORMAS);
assert.equal(esp['efectivo-cop'], 50000+120000-4000-10000); assert.equal(esp['pago-movil'], 5000); assert.equal(esp['efectivo-usd'], 20);
const d = diferenciasCierre({'efectivo-cop':156000}, {'efectivo-cop':154500}, FORMAS, t);
assert.equal(d.filas[0].diferencia, -1500); assert.equal(d.filas[0].nivel, 'leve');
assert.equal(diferenciasCierre({'efectivo-cop':156000},{'efectivo-cop':150000},FORMAS,t).filas[0].nivel, 'grave');
// costos (§15)
const h = [{costo:9000, desde:'2026-11-01T00:00:00Z'},{costo:9500, desde:'2026-11-20T00:00:00Z'}];
assert.equal(costoEn(h, '2026-11-12T15:00:00Z'), 9000); assert.equal(costoEn(h, '2026-11-21T00:00:00Z'), 9500);
// Review Focus 5
assert.equal(telefonoInternacional('0412-123.45.67'), '584121234567');
assert.equal(telefonoInternacional('+58 412 1234567'), '584121234567');
assert.equal(telefonoInternacional('300 123 4567'), '573001234567');
assert.equal(telefonoInternacional('57 3001234567'), '573001234567');
assert.equal(telefonoInternacional('123'), null);
assert.match(enlaceWhatsApp(VENTA_EJEMPLO, TIENDA), /^https:\/\/wa\.me\/584121234567\?text=/);
// importación: usa la fila real de App-Inventario (Franela AS Niño 4 Blanco)
const {productos} = leerInventario(INVENTARIO_EJEMPLO);
assert.deepEqual(productos[0].precios, [25000,24000,22500,20000,null]); assert.equal(productos[0].existencia, 12);
assert.equal(productos[0].minimo, 5); assert.equal(productos[0].costo, 9000); assert.equal(productos[0].codigo, '100983086933');
const plan = planImportacion([{...productos[0], existencia:99, precios:[26000,24000,22500,20000,null]}], {[productos[0].sku]:{...productos[0], existencia:3}});
assert.equal(plan.cambios.length, 1); assert.ok(!('existencia' in plan.cambios[0].campos));
// fotos
assert.equal(claveFoto('Fran-AS-Niño Blanco.JPG'), 'franasninoblanco');
assert.deepEqual(emparejarFotos(['Franela AS Niño-Blanco.jpg','otra.png'], ['Franela AS Niño Blanco']).sinAsignar, ['otra.png']);
```
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar.** `leerInventario` ubica columnas por nombre en `head` (`sku, name, category, brand, cost, price, price2..price4, price5?, barcode, location_fiscalstock + location_nonfiscalstock = existencia, location_minstock, comm_type1..4, comm_value1..4, comm_reduced_value1..4, producto?, color?, talla?, separado?`); `grupo = producto && color ? \`${producto} ${color}\` : nombre` con aviso. **Ojo con el código de barras:** en el `inventario.json` actual la columna `barcode` viene vacía y el código está en la columna sin título que la sigue (índice 17 en la fila de ejemplo); usar `barcode` si tiene valor y, si no, esa columna siguiente. Teléfono: 11 dígitos con 0 inicial → Venezuela (quita el 0, antepone 58); 10 dígitos empezando en 3 → Colombia (57); 12 dígitos empezando en 58 o 57 → tal cual; lo demás `null`. `textoRecibo` según §9.4.
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: caja, costos, recibo, importación, fotos y reportes`

### Task 7: Almacén en memoria (contrato completo)

**Files:** Create `js/datos/contrato.js`, `js/datos/memoria.js`, `js/datos/semilla.js`, `js/datos/index.js`, `pruebas/datos/memoria.test.js`

**Interfaces:**
- Consumes: núcleo completo.
- Produces (mismo contrato que implementará Firebase en la Tarea 8; todas async):
  - Sesión: `entrar(usuario, pin)` → `{ok, error:'no-existe'|'pin'|'inactivo'|'red'}` · `salir()` · `alCambiarSesion(cb)` con `{uid, usuario, nombre, rol}|null` · `crearUsuario({usuario, nombre, rol, pin})` · `cambiarPin(uid, pin)` · `activarUsuario(uid, bool)`
  - Lectura: `escuchar(nombre, cb, filtro?) → desuscribir` para `productos, ventas, apartados, cajas, autorizaciones, ajustes, clientes, comisiones, costos, costosVenta, movimientos, usuarios`
  - Ventas: `nuevoId(): string` · `guardarVenta(venta)` → `{ok:true, offline}|{ok:false, faltantes:[sku]}` · `anularVenta(id, motivo)`
  - Apartados: `guardarApartado(ap)` · `abonarApartado(id, pago)` · `completarApartado(id, venta)` · `cancelarApartado(id, motivo)`
  - Caja: `abrirCaja(fondo)` · `movimientoCaja(cajaId, mov)` · `cerrarCaja(cajaId, cierre)` · `reabrirCaja(cajaId)`
  - Inventario: `ajustarExistencia(sku, cantidad, motivo, nota)` · `aplicarImportacion(plan)` · `guardarOferta(grupo, oferta)` · `guardarFoto(grupo, blob)` → ruta
  - Otros: `guardarAjustes(doc, datos)` · `guardarCliente({telefono, nombre})` · `solicitarAutorizacion(a)` · `responderAutorizacion(id, aprobada)` · `pagarComisiones(reg)` · `congelarCostoVenta(ventaId, costo)` · `estadoSync(cb)` con `{enLinea, pendientes, error}`
  - Memoria impone los permisos con `puede()` y rechaza con `{ok:false, error:'permiso'}`; tiene `simularSinConexion(bool)` para pruebas.

- [ ] **Step 1: Pruebas** (comportamiento de dominio que Firebase debe replicar)
```js
const a = crearMemoria(semilla()); await a.entrar('vendedora','1234');
await a.abrirCaja({COP:50000,USD:0,BS:0});
const v = ventaDemo(a.nuevoId(), [{sku:'F-N-6',cantidad:2}]);
assert.deepEqual(await a.guardarVenta(v), {ok:true, offline:false});
assert.equal(existencia(a,'F-N-6'), 10);
// Review Focus 3: doble toque / reintento
assert.equal((await a.guardarVenta(v)).ok, true); assert.equal(existencia(a,'F-N-6'), 10);
assert.equal(ventas(a).length, 1);
// sin existencia (con conexión)
assert.deepEqual(await a.guardarVenta(ventaDemo(a.nuevoId(), [{sku:'F-N-6',cantidad:99}])), {ok:false, faltantes:['F-N-6']});
// sin conexión: se permite y puede quedar negativa
a.simularSinConexion(true);
assert.deepEqual(await a.guardarVenta(ventaDemo(a.nuevoId(), [{sku:'F-N-6',cantidad:11}])), {ok:true, offline:true});
assert.equal(existencia(a,'F-N-6'), -1);
// permisos
assert.equal((await a.ajustarExistencia('F-N-6', 5, 'conteo')).error, 'permiso');
await a.salir(); await a.entrar('encargada','1234');
assert.equal((await a.aplicarImportacion({nuevos:[],cambios:[],iguales:[],faltantes:[]})).error, 'permiso');
// sin caja abierta no se vende
assert.equal((await a.guardarVenta(ventaDemo(a.nuevoId(), [{sku:'B-M',cantidad:1}]))).error, 'sin-caja');
// apartado reserva y cancelar devuelve
// historial de costo: aplicarImportacion como admin con costo nuevo agrega entrada y no borra la anterior
```
(Escribir los tres últimos casos con la misma forma: apartar 2 → existencia −2; cancelar como encargada → +2; importar como admin con costo 9500 → `costos[sku].historial.length === 2`.)
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar.** `semilla.js`: usuarios `admin/encargada/vendedora` con PIN `1234`, los productos de ejemplo de los bocetos (Franela AS Niño blanco y negro, tallas 4–10; Buzo Etanol gris S–L con existencia 2; Body Bebé Serfe rosa `separado`; Jogger Texcol negro; Franela Rockdreams agotada), ajustes por defecto (§6), tasas `copPorUsd:3900`, `bsModo:'manual'`, `bsManual:1075`. `index.js` usa memoria con `?demo` o si `config.js` no tiene `apiKey`.
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: almacén en memoria con contrato del POS`

### Task 8: Almacén Firebase

**Files:** Create `js/datos/firebase.js`; Modify `js/datos/index.js`

**Interfaces:**
- Consumes: contrato de la Tarea 7 (mismas firmas y mismos resultados).
- Produces: implementación Firestore. Colecciones y campos exactamente los de §6.

- [ ] **Step 1: Implementar** con SDK 10.12.2 CDN: `initializeFirestore(app, {localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})})`. Entrada como Pedidos: `logins/{usuario}` → `email`; contraseña = `'cs-' + pin`; primer usuario en sistema vacío crea `sistema/estado` y queda admin.
  - `guardarVenta`: si `navigator.onLine`, `runTransaction` que lee cada `productos/{sku}`, devuelve `{ok:false, faltantes}` si alguna existencia < cantidad, si no escribe venta (con `setDoc` por id; si el doc ya existe devuelve `{ok:true, offline:false}` sin descontar), `existencia - n` y un `movimientos` por línea. Si la transacción falla con `unavailable` o está sin conexión: `writeBatch` con `increment(-n)`, venta con `offline:true`, movimientos; no espera al servidor (`{ok:true, offline:true}`).
  - Número legible `V-0001`: contador `contadores/ventas` en la misma transacción; en ventas sin conexión se asigna `numero:null` y lo completa la siguiente app de admin/encargada en línea (`completarNumeros()`).
  - `estadoSync`: `onSnapshotsInSync` + `metadata.hasPendingWrites` de una escucha de las ventas propias del día + `online/offline`.
  - Usuario desactivado: escucha `usuarios/{uid}`; si `activo:false`, `salir()`.
- [ ] **Step 2: Verificar** con un proyecto real (cuando exista) usando `pruebas/REGLAS.md` §"Flujo" (Tarea 17): venta con y sin red (DevTools → Offline), doble toque, venta con faltante.
- [ ] **Step 3: Commit** `feat: almacén Firebase con transacción y modo sin conexión`

### Task 9: Entrar, usuarios y sesión

**Files:** Create `js/vistas/entrar.js`; Modify `js/app.js`; Test `pruebas/e2e/entrar.cjs`

**Interfaces:** Consumes `entrar, salir, alCambiarSesion, puede`. Produces `ctx.sesion`.

- [ ] **Step 1: Prueba e2e:** en `?demo` aparece la pantalla de entrada (usuario + PIN, `inputmode="numeric"`, `maxlength=4`); PIN incorrecto muestra la línea roja "PIN incorrecto" bajo el campo; con `vendedora/1234` entra a Inicio y **no** ve Ajustes en la nav; con `admin/1234` sí; "Cerrar sesión" en Más vuelve a la entrada.
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar.** Mensajes exactos: "Ese usuario no existe", "PIN incorrecto", "Usuario desactivado", "Sin conexión a internet". El PIN debe ser de 4 números.
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: entrada con usuario y PIN`

### Task 10: Vender

**Files:** Create `js/vistas/vender.js`; Test `pruebas/e2e/vender.cjs`

**Interfaces:** Consumes `calcularCarrito, etiquetaTramo, fmtCop, desdeCop, almacen.escuchar('productos'), ctx.tasas`. Produces `carrito` en `ctx` (`{lineas, descuento, cliente}`) y el evento `abrirCobro()` / `abrirApartar()` que usan las Tareas 12 y 13.

- [ ] **Step 1: Prueba e2e** (PC y teléfono, `?demo` como vendedora con caja abierta): buscar "buzo" deja solo Buzo Etanol; tocar su tarjeta abre las tallas como botones ≥ 44 px con su existencia; elegir M dos veces agrega 2; agregar 4 Franela AS → el carrito muestra "precio 6–11" en ambas y el total correcto; con 4 prendas se ve "Con 2 prendas más pasan a precio 6–11"; la tarjeta de Franela Rockdreams muestra la pastilla "Agotada" y su talla no se puede elegir; en el teléfono la barra "N prendas · total · Ver" abre el carrito; − hasta 0 quita la línea; F2 enfoca el buscador; F9 abre Cobrar si el carrito tiene prendas; escribir un código de barras completo + Enter agrega esa variante.
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar** según §8.1 y el boceto aprobado. Tarjetas por `grupo` con foto (`producto.foto` o ícono de prenda), "Color · N tallas", precio detal; "pocas" en ámbar si alguna talla ≤ mínimo. Escanear con cámara: `BarcodeDetector` si existe; si no, botón oculto en el teléfono (el lector USB sigue funcionando en PC). Total en COP 28 px peso 800 con equivalentes USD/Bs en sus colores (Bs se oculta si `bsPorUsd` es null). Descuento manual (botón en el carrito): hasta `ajustes.descuentoMaxVendedora` sin pedir nada; si `requiereAutorizacion`, botón "Pedir autorización" que llama `solicitarAutorizacion` y espera la respuesta escuchando `autorizaciones` (sin conexión: aviso "Necesitas internet para pedir autorización").
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: pantalla Vender con tramos y carrito`

### Task 11: Cabecera de tasas, calculadora y estado de conexión

**Files:** Create `js/vistas/calculadora.js`, `js/datos/tasa-remota.js`; Modify `js/app.js`; Test `pruebas/nucleo/tasa-remota.test.js`, `pruebas/e2e/calculadora.cjs`

**Interfaces:**
- Consumes: `tasasVigentes`, `almacen.escuchar('ajustes')`, `estadoSync`.
- Produces: `ctx.tasas` actualizado y evento `tasas-cambiaron`. `leerTasaRemota(fetchFn, url): Promise<object|null>` (timeout 8 s, devuelve null si falla o el JSON no tiene `rate` numérico); caché en `localStorage['pos.tasaBs']`.

- [ ] **Step 1: Pruebas.** Unitaria: `leerTasaRemota` con un `fetchFn` que rechaza → `null`; con `{rate:'x'}` → `null`; con el `tasa.json` real de ejemplo → objeto. E2E: la pastilla muestra "$ 3.900 · Bs 1.075"; al tocarla se ve fuente, hora y fecha del último cambio de COP; el ícono de calculadora abre un panel derecho en PC (el carrito sigue visible) y una hoja inferior en el teléfono; escribir 100 en USD da COP "390.000" y Bs "107.500,00"; con tasa Bs ausente (semilla con `bsModo:'binance'` y fetch bloqueado) la casilla Bs muestra "Sin tasa" y no `NaN`.
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar.** Lee `https://kdnaskrlos.github.io/Calculadora-de-Tasas/tasa.json?t=<ms>` al abrir y cada 10 min. Indicador de conexión: punto verde "En línea", ámbar "Sin conexión · N por subir", rojo "Error al sincronizar". **Sin** aviso por antigüedad de la tasa COP (§2).
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: tasas en cabecera, calculadora y estado de conexión`

### Task 12: Cobrar y recibo

**Files:** Create `js/vistas/cobrar.js`; Test `pruebas/e2e/cobrar.cjs`

**Interfaces:** Consumes `estadoCobro, montoSugerido, vueltoEn, comisionesVenta, aplicarDescuento, telefonoInternacional, enlaceWhatsApp, almacen.guardarVenta/guardarCliente/nuevoId`.

- [ ] **Step 1: Prueba e2e** (teléfono y PC): con 116.000 en el carrito, Cobrar abre a pantalla completa en teléfono; el botón final dice "Cobrar 116.000" y está deshabilitado sin cliente; escribir teléfono de un cliente existente completa el nombre; tocar "Efectivo pesos" y cambiar a 50.000, luego tocar "Pago móvil" → se llena con "18.192,31" y la barra pasa a verde "Falta 0"; cobrar → toast "Venta guardada", botones "Enviar recibo por WhatsApp" (href `https://wa.me/58…`) y "Nueva venta"; la existencia bajó; **doble clic rápido** en Cobrar crea una sola venta; con 40 USD en efectivo aparece vuelto, se elige Bs y muestra "11.025,64"; con la tasa Bs ausente los botones de Bs aparecen desactivados con el texto "Sin tasa de Bs"; venta sin conexión con existencia resultante ≤ 2 muestra antes "Estás sin conexión y quedan pocas. Confirma con la tienda antes de cobrar."; si `guardarVenta` devuelve faltantes, se avisa el producto y el carrito queda igual.
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar** según §9.2 y el boceto. Botones de 48 px en 2 columnas, agrupados por moneda con su color. El botón Cobrar se deshabilita mientras guarda. La venta guarda `tasas`, `comision`/`reducida` por línea, `descuento.autorizadoPor` y `cajaId`.
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: cobro multimoneda con recibo por WhatsApp`

### Task 13: Apartados

**Files:** Create `js/vistas/apartados.js`; Test `pruebas/e2e/apartados.cjs`

- [ ] **Step 1: Prueba e2e:** desde el carrito "Apartar" pide cliente y abono (acepta 0) con las mismas formas de pago; crea el apartado en amarillo "Pendiente" con abonado y saldo, y la existencia baja; "Abonar" suma; "Completar" cobra el saldo, crea la venta sin volver a descontar y pasa a verde; como vendedora no aparece "Cancelar"; como encargada "Cancelar" pide motivo, devuelve existencia y queda gris.
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar** (§10; reutiliza el panel de pagos de Cobrar extraído a `js/vistas/pagos.js`). **Step 4: Ejecutar** → pasa.
- [ ] **Step 5: Commit** `feat: apartados con abonos`

### Task 14: Caja

**Files:** Create `js/vistas/caja.js`; Test `pruebas/e2e/caja.cjs`

- [ ] **Step 1: Prueba e2e:** sin caja abierta, Vender muestra "Abre tu caja para vender" con botón; abrir con fondo COP 50.000 / USD 20 / Bs 500; registrar una salida de 10.000 "gasto"; tras una venta, la vista muestra el esperado por forma de pago (mismos números que `esperadoCaja`); cerrar con un faltante de 1.500 → fila ámbar y exige nota; con 6.000 → roja; una vez cerrada no se puede editar; solo admin ve "Reabrir".
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar** (§11). **Step 4: Ejecutar** → pasa.
- [ ] **Step 5: Commit** `feat: apertura, movimientos y cierre de caja`

### Task 15: Inventario (consulta, ajustes, ofertas, importar, fotos)

**Files:** Create `js/vistas/inventario.js`, `js/datos/github-fotos.js`; Test `pruebas/e2e/inventario.cjs`

**Interfaces:** Consumes `leerInventario, planImportacion, emparejarFotos, claveFoto, almacen.aplicarImportacion/ajustarExistencia/guardarOferta/guardarFoto`. Produces `subirFotoGitHub({token, repo:'kdnaskrlos/Punto-de-Venta', ruta, blob}): Promise<{ok, error}>` (API de contenidos; obtiene el `sha` actual antes de sobrescribir para no repetir el error 422 de la Carga Masiva).

- [ ] **Step 1: Prueba e2e:** en teléfono, Inventario solo permite buscar/escanear y ver existencia, 5 precios por tramo y foto; como vendedora no aparecen costos. Como admin en PC: "Importar" con el `inventario.json` de ejemplo muestra la vista previa (nuevos/cambios/iguales/faltantes) y al aplicar crea productos sin tocar existencias de los que ya existían; ajuste +3 "llegó del taller" sube la existencia y aparece en el historial; activar oferta 10% en un grupo cambia el precio en Vender; arrastrar 2 archivos de prueba asigna uno y lista el otro en "sin asignar". Como encargada no aparecen Importar, Fotos, Ajustar ni Ofertas, pero sí costos y valor del inventario.
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar.** Compresión: `createImageBitmap` + `OffscreenCanvas` (o canvas) a WebP calidad 0.8, lado mayor 800 px, reintentando con calidad menor si pasa de 120 KB. El token de GitHub se pide una vez y se guarda solo en `localStorage['pos.githubToken']` del navegador del admin. En modo demo, `guardarFoto` guarda un `blob:` URL.
- [ ] **Step 4: Ejecutar** → pasa. **Step 5: Commit** `feat: inventario con importación, ajustes, ofertas y fotos`

### Task 16: Inicio, autorizaciones, reportes, comisiones y ajustes

**Files:** Create `js/vistas/inicio.js`, `reportes.js`, `comisiones.js`, `ajustes.js`, `mas.js`; Test `pruebas/e2e/gestion.cjs`

- [ ] **Step 1: Prueba e2e:**
  - Inicio admin: recuadros KPI (ventas de hoy, ganancia, caja de la tienda, existencias bajas) con valores iguales a `resumenDia`; una solicitud de descuento de la vendedora aparece con Aprobar/Rechazar y al aprobar se habilita en la sesión de la vendedora (dos contextos de navegador sobre el mismo almacén demo compartido por `BroadcastChannel`); alerta de existencia negativa tras la venta sin conexión.
  - Inicio encargada: mismos recuadros, **sin** autorizaciones.
  - Inicio vendedora: su caja y sus ventas del día, sin ganancia.
  - Reportes: rango de fechas con el calendario propio; más vendidos; existencias bajas; valor del inventario. Ver una venta como admin crea su `costosVenta` y, tras cambiar el costo, la ganancia de esa venta no cambia.
  - Anular venta (encargada) con motivo: existencia vuelve y la comisión deja de contar.
  - Comisiones por vendedora y rango; "Marcar como pagadas" deja pendiente 0.
  - Ajustes (solo admin): tasas (COP manual, modo Bs y recargo), formas de pago, tramos, comisiones por defecto, redondeo, descuento máximo, tienda, usuarios (crear, PIN, desactivar), tema oscuro; la versión al pie.
- [ ] **Step 2: Ejecutar** → falla. **Step 3: Implementar** (§13.4, §14, §15, §4). Recuadros KPI según comicshop-interfaz §8. **Step 4: Ejecutar** → pasa.
- [ ] **Step 5: Commit** `feat: inicio, autorizaciones, reportes, comisiones y ajustes`

### Task 17: Reglas de seguridad y guía

**Files:** Create `firestore.rules`, `GUIA.md`, `pruebas/REGLAS.md`

- [ ] **Step 1: Escribir `pruebas/REGLAS.md`**: lista de comprobaciones con resultado esperado, para ejecutar en la consola del navegador con cada rol contra el proyecto real (o con el emulador si hay red para instalar `firebase-tools`). Mínimo: vendedora no lee `costos` ni `costosVenta`; vendedora no cambia `precios` de un producto pero sí su `existencia`; encargada no escribe `ajustes`, no aplica importación, no cambia `oferta`, no responde `autorizaciones`; nadie sobrescribe una venta existente; solo admin reabre caja; usuario con `activo:false` no lee nada; `logins` es pública solo para lectura. Sección "Flujo": venta con red, sin red, doble toque, faltante.
- [ ] **Step 2: Escribir `firestore.rules`** que cumpla cada línea de §4 y §6 (funciones `activo()`, `rol()`, `esAdmin()`, `esGestion()` = admin o encargada; `existencia` modificable por cualquier activo solo si el resto de campos de `productos` no cambia; `ventas` create con `request.auth.uid == request.resource.data.uid`, update solo para anular por gestión).
- [ ] **Step 3: Escribir `GUIA.md`** para Carlos, sin tecnicismos, como la de Pedidos: crear el repo `Punto-de-Venta` y activar Pages; crear el proyecto Firebase "Punto de Venta Comic Shop"; activar Authentication (correo/contraseña); crear Firestore; publicar reglas; pegar `firebaseConfig` en `config.js`; primer ingreso como administrador; crear el token de GitHub de permisos limitados (solo el repo, permiso "Contents: Read and write") para las fotos.
- [ ] **Step 4: Verificar** todas las líneas de `pruebas/REGLAS.md` en el proyecto real (si aún no existe, dejar la tarea marcada como pendiente de verificación y decírselo a Carlos).
- [ ] **Step 5: Commit** `feat: reglas de seguridad y guía de instalación`

### Task 18: Cambio en la Carga Masiva (repositorio App-Inventario)

**Files:** Modify `kdnaskrlos/App-Inventario/index.html` (herramienta de Carga Masiva) — requiere acceso de escritura a ese repo.

- [ ] **Step 1:** Leer cómo la Carga Masiva toma precios del Tarifario y arma `data/inventario.json`.
- [ ] **Step 2:** Agregar al JSON de cada fila: `price5` (tramo +49 del Tarifario), `separado` (bool del Tarifario), `producto`, `color`, `talla`. Mantener intactas las 51 columnas de la plantilla exportable.
- [ ] **Step 3:** Verificar con `leerInventario` (Tarea 6) que el nuevo JSON produce `precios[4]`, `separado`, `grupo` correctos y sin avisos.
- [ ] **Step 4:** Subir la versión de la Carga Masiva y hacer commit en su repo `feat: exportar 5.º tramo, separado, producto, color y talla para el POS`.

### Task 19: Pasada final de calidad

- [ ] **Step 1:** `npm test` y todos los `pruebas/e2e/*.cjs` en verde.
- [ ] **Step 2:** Capturas en 360×780 y 1530×900 de Inicio, Vender, Cobrar, Apartados, Caja, Inventario y Reportes, en claro y oscuro. Revisar contra comicshop-interfaz y §13.3: toques ≥ 44 px (script que mide todos los `button, a, [role=button]`), ningún monto partido en dos líneas, contraste de los colores de moneda, foco visible, botón atrás.
- [ ] **Step 3:** Prueba con red cortada (Playwright `context.setOffline(true)`) de una venta completa y su sincronización al volver.
- [ ] **Step 4:** Revisión de código con `superpowers:requesting-code-review`.
- [ ] **Step 5:** Commit `chore: pasada de calidad (vX.Y)` y preparar la prueba guiada con la esposa y la vendedora (§17), usando `design:user-research` para el guion.
