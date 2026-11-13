# Registro de construcción y decisiones · Punto de Venta fase 1

Copia del registro de trabajo: cada tarea, cada decisión tomada ("Ruling") con su costo si fuera incorrecta, las correcciones de las tres revisiones independientes y los detalles menores que quedaron pendientes.

Spec: docs/superpowers/specs/2026-11-12-punto-de-venta-fase1-design.md
Checkpoints acordados con Carlos: revisión independiente tras Tarea 6, tras Tarea 8 y al final.
## Pre-flight
- T2→T3/T4/T5: redondear/fmt* producidos en T2, consumidos igual. OK
- T3→T5: aCop/desdeCop firmas coinciden. OK
- T4→T10: calcularCarrito firma coincide. OK
- T5→T12: estadoCobro/montoSugerido/vueltoEn/comisionesVenta coinciden. OK
- T6→T7/T15/T16: leerInventario/planImportacion/costoEn/esperadoCaja coinciden. OK
- T7→T8: contrato idéntico. Ruling pendiente: semilla usa sku 'F-N-6' y 'B-M' (T7 test) mientras T4 usa 'F','B','Y' como fixtures propios — son fixtures independientes, sin conflicto.
- T12 usa telefonoInternacional/enlaceWhatsApp de T6. OK
Task 1: Ruling: no se crean archivos vacíos en js/vistas/ — las rutas sin vista muestran 'Próximamente'; cada vista se crea en su tarea — costo si es incorrecto: ninguno
Task 1: complete (commits acb4872..9cb5a35, tests: env NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/esqueleto.cjs → esqueleto: 8/8 pasan)
Task 2: Ruling: script de pruebas con patrón 'pruebas/nucleo/*.test.js' (Node 22 no acepta carpetas) — costo si es incorrecto: ninguno
Task 2: complete (commits 9cb5a35..35d33b2, tests: npm test → # duration_ms 118.073559)
Task 3: complete (commits 35d33b2..9817b14, tests: npm test → # duration_ms 157.266365)
Task 4: complete (commits 9817b14..b0cf235, tests: npm test → # duration_ms 254.704284)
Task 5: Ruling: nuevo js/nucleo/fechas.js (diaLocal en America/Caracas) para agrupar ventas por día de la tienda, no por día UTC — costo si es incorrecto: reportes de un día con ventas nocturnas mal asignadas
Task 5: complete (commits b0cf235..3a4d99b, tests: npm test → # duration_ms 461.2095)
Task 6: Ruling: nuevo js/nucleo/formas.js (FORMAS_PAGO_DEFECTO, formaEfectivo, NOMBRE_MONEDA) compartido por caja, reportes y recibo; el vuelto guarda su 'forma' — costo si es incorrecto: mover 3 constantes
Task 6: Ruling: costoVenta devuelve además 'incompleto' y diferenciasCierre devuelve totalEsperadoCop/totalContadoCop además de totalCop; resumenDia agrega 'ventas' y 'gananciaParcial' — costo: ninguno, campos extra
Task 6: complete (commits 3a4d99b..1d74b9c, tests: npm test → # duration_ms 780.64323)
## Revisión independiente 1 (núcleo, Tareas 2–6)
Checkpoint: fixed parseMonto formato EE.UU. '1,234.56' USD → 1234.56 (crítico) — 'parseMonto con formato de EE. UU.' RED→GREEN
Checkpoint: fixed diferenciasCierre sin tasa → grave + totalIncompleto — test RED→GREEN
Checkpoint: fixed resumenComisiones: pagado por venta cubierta por un pago (evita pagar dos veces) — test RED→GREEN
Checkpoint: fixed importar: costo vacío = null (no 0) — test RED→GREEN
Checkpoint: fixed planImportacion compara costo contra costos/{sku} (3er parámetro), costo fuera de CAMPOS — test RED→GREEN
Checkpoint: fixed calcularCarrito: cantidad texto→número, decimales/inválidas en 'invalidas' — test RED→GREEN
Checkpoint: fixed (re-graduado de menor a importante: precio negativo) oferta >100% se limita a 100 — test RED→GREEN
Checkpoint: fixed (re-graduado: recibo no se puede enviar) teléfonos '+58 0414…' y '0058…' — test RED→GREEN
Checkpoint: fixed parseMonto rechaza negativos — test RED→GREEN
Checkpoint: fixed comisión: sin dato del producto en ese tramo ni debajo → defectos — test RED→GREEN
Checkpoint: Ruling: anulaciones — esperadoCaja cuenta el cobro de ventas anuladas; la devolución se registra como salida en la caja abierta de quien anula (Tarea 7 anularVenta) — un solo lugar para el dinero devuelto — costo si es incorrecto: cierre de caja descuadrado en anulaciones
Checkpoint: Ruling: esperadoCaja suma también formas que ya no están en la lista — no perder dinero de formas desactivadas — costo: ninguno
Checkpoint: Ruling: vuelto COP al centenar más cercano (puede sobrar hasta 50) — §9.3 dice "a la centena" — costo: ≤ 50 COP por venta
Checkpoint: Ruling: '10.500' en USD = 10500 (convención venezolana); la UI muestra el equivalente en COP al instante para detectar errores — costo: un monto mal tecleado visible antes de cobrar
Checkpoint: Ruling: comm_reduced_active=false → reducida = valor normal (no hay reducción configurada) — costo: ninguno
Checkpoint: Ruling: comisión en % sobre el subtotal de la línea antes del descuento manual — la reducida ya compensa el descuento — costo: comisión algo mayor en ventas con descuento y comisión porcentual
Checkpoint: minor (deferred): aCop/desdeCop no validan tasas que no vengan de tasasVigentes (Infinity con bsPorUsd '0')
Checkpoint: minor (deferred): recibo no muestra línea de descuento si solo viene descuento.pct sin monto (la UI siempre guarda monto)
Checkpoint: minor (deferred): costoEn compara texto ISO; correcto mientras 'desde' se guarde con toISOString (así lo hace el almacén)
Task 7: Ruling: anularVenta registra la devolución como salidas (por forma de pago, menos el vuelto) en la caja de la venta si sigue abierta; si no, en la caja abierta de quien anula; si no hay ninguna → error 'sin-caja' — costo si es incorrecto: hay que abrir caja para anular ventas de días cerrados
Task 7: complete (commits 258c521..2fa3891, tests: npm test → # duration_ms 935.863807)
Task 8: Ruling: contrato agrega sistemaIniciado() y crearAdministrador() (primer ingreso, como Pedidos) y cambiarPin(uid, pinNuevo, pinActual) — el propio exige el actual; el de otros crea cuenta nueva (nuevo uid) como Pedidos — costo: ninguno
Task 8: Ruling: ventas, cajas y autorizaciones de la vendedora se filtran por 'usuario' (no por uid), porque el cambio de PIN por el admin cambia el uid — costo si es incorrecto: reglas deben usar usuario
Task 8: Ruling: filtro de escuchar es un objeto {desde, hasta, usuario, cajaId, sku, estado} (memoria también acepta función) — Firestore no admite funciones — costo: ninguno
Task 8: Ruling: importación en lotes de 450 escrituras, no atómica en total (Firestore limita 500 por lote); repetirla es seguro — costo: una importación cortada deja parte aplicada hasta repetirla
Task 8: Ruling: verificación contra un proyecto real queda pendiente hasta que exista el proyecto Firebase (Tarea 17 / pruebas/REGLAS.md) — costo: errores de Firestore aparecerían al conectar
Task 8: complete (commits 2fa3891..6cf025b, tests: npm test → # duration_ms 865.150038)
## Revisión independiente 2 (datos, Tareas 7–8)
Checkpoint2: fixed C1 venta reintentada sin conexión: guardia enCurso permanente en la sesión + getDocFromCache antes del lote — verificado por lectura (firebase no se puede ejecutar aquí); memoria ya cubierta por 'doble toque' test
Checkpoint2: fixed C2 dos cajas abiertas: puntero cajaAbierta/{usuario} creado/borrado en el mismo lote; vender/abrir esperan el primer dato de la caja (máx 4 s) — verificado por lectura
Checkpoint2: fixed C3 abonos simultáneos: saldo con increment(-equivalenteCop) — verificado por lectura
Checkpoint2: fixed I1 doble toque en Anular: guardia enCurso — verificado por lectura
Checkpoint2: fixed I3 numeración: completarNumeros relee la venta en la transacción; también corre al volver la conexión — verificado por lectura
Checkpoint2: fixed I4 (parcial) por subir: ventas propias sin número con escrituras pendientes cuentan tras recargar — verificado por lectura
Checkpoint2: fixed I5 cobro colgado con internet intermitente: transacción con tope de 4 s y luego lote — verificado por lectura
Checkpoint2: fixed I6 entrar espera la sesión publicada y cierra la sesión de Auth si falla — verificado por lectura
Checkpoint2: fixed I7 memoria: autorizaciones guardan usuario — 'la vendedora ve sus propias solicitudes' RED→GREEN, suite 88/88
Checkpoint2: Ruling: I2 devolución en la caja de la venta si sigue abierta — las reglas (Tarea 17) permitirán a admin/encargada SOLO agregar movimientos a una caja abierta ajena (hasAll) — costo si es incorrecto: anulación rechazada por el servidor
Checkpoint2: Ruling: requisitos para firestore.rules (Tarea 17): ventas/apartados solo create; venta update solo numero desde null o estado ok→anulada; apartado update solo si pendiente; costosVenta solo create; cajaAbierta solo create si no existe y delete por su dueño; propiedad por usuario vía get(usuarios/uid); usuario lee su propio perfil; arranque del primer admin con getAfter(sistema/estado)
Checkpoint2: minor (deferred): divergencias menores memoria/firebase en códigos de error (movimientoCaja/cerrarCaja, responderAutorizacion, importación con SKU faltante, numeración inmediata en completarApartado, largo de usuario)
Checkpoint2: minor (deferred): la caché de Firestore conserva costos en el dispositivo tras cerrar sesión de admin/encargada (usan sus propios teléfonos)
Checkpoint2: minor (deferred): repetir la importación con el MISMO plan reescribe existencias; la pantalla siempre recalcula el plan antes de aplicar
Checkpoint2: minor (deferred): escuchas creadas antes de entrar quedan vacías en firebase (la app escucha después de entrar)
Task 9: complete (commits 6cf025b..f059e8e, tests: sh -c 'npm test >/dev/null && NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/esqueleto.cjs | tail -1 && NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/entrar.cjs | tail -1' → entrar: 6/6 pasan)
Task 10: Ruling: nuevo js/datos/vivos.js mantiene ctx.productos/ajustes/tasas/miCaja y emite 'pos:datos'; las vistas devuelven una función de limpieza al montar — costo: ninguno
Task 10: Ruling: escanear con cámara solo si el navegador tiene BarcodeDetector (Chrome Android); si no, en PC el botón enfoca el buscador para el lector USB y en el teléfono se oculta — sin librerías extra (sin red para instalarlas) — costo: teléfonos sin BarcodeDetector no escanean con cámara
Task 10: Ruling: el carrito no deja pasar de la existencia conocida en el dispositivo — costo: sin conexión con existencia desactualizada puede bloquear una venta real
Task 10: complete (commits f059e8e..f1e8085, tests: env NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/vender.cjs → vender: 9/9 pasan)
Task 11: Ruling: en PC la calculadora es un panel no modal a la izquierda del carrito (8 px de separación) para cumplir 'sin tapar el carrito' — costo: ninguno
Task 11: complete (commits f1e8085..707d822, tests: sh -c 'npm test >/dev/null && NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/calculadora.cjs | tail -1' → calculadora: 5/5 pasan)
Task 12: Ruling: la barra Falta/Vuelto va en el pie de la ventana junto al botón Cobrar (siempre visible, §9.2) — costo: ninguno
Task 12: Ruling: nombres largos de formas de pago se recortan con '…' (sin saltos de línea, regla del dueño) y muestran el nombre completo al mantener — costo: 'Transferencia / Nequi / Bancolombia' se ve recortado en el teléfono
Task 12: complete (commits 707d822..bcb272f, tests: env NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/cobrar.cjs → cobrar: 7/7 pasan)
Task 13: Ruling: el panel de pagos no avisa cambios mientras se construye (evita leer 'panel' antes de crearlo) — costo: ninguno
Task 13: Ruling: abonar con varias formas registra un abono por forma; al completar, la venta guarda total del apartado, abonosPrevios y solo los pagos finales (la caja cuenta abonos y pagos por separado) — costo: ninguno
Task 13: complete (commits bcb272f..a76d58d, tests: sh -c 'NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/apartados.cjs | tail -1 && NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/cobrar.cjs | tail -1' → cobrar: 7/7 pasan)
Task 14: Ruling: el cierre muestra las formas de efectivo y las que tienen esperado distinto de 0; 'Entrada o salida' permite cualquier forma de pago — costo: ninguno
Task 14: complete (commits a76d58d..834dc27, tests: env NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/caja.cjs → caja: 3/3 pasan)
Task 15: Ruling: guardarFoto(grupo, blob) en ambos almacenes; firebase sube a GitHub (fotos/<clave>.webp?v=fecha) con el token guardado en este navegador y, si falta, la pantalla lo pide — costo: la foto tarda ~1 min en verse (publicación de GitHub Pages)
Task 15: Ruling: en el teléfono el inventario es solo consulta (sin ajustar, ofertas, importar ni fotos), §13.4 — costo: el admin ajusta desde la PC
Task 15: complete (commits 834dc27..392c4d2, tests: sh -c 'npm test >/dev/null && NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/inventario.cjs | tail -1' → inventario: 6/6 pasan)
Task 16: Ruling: sin BroadcastChannel entre pestañas demo; la aprobación en vivo se prueba con el almacén (escuchar autorizaciones) y en navegador cambiando de sesión — costo: la demo no sincroniza entre dos pestañas
Task 16: Ruling: rango de fechas con atajos (Hoy, Esta semana, 7 días, Este mes) y fechas del navegador para rangos propios, en vez del calendario propio de comicshop-interfaz — costo: el selector de fecha se ve distinto en cada teléfono (pendiente para fase 2)
Task 16: Ruling: 'En cajas abiertas' suma en COP lo que debería haber en todas las cajas abiertas — costo: ninguno
Task 16: Ruling: si el rol no puede ver la pantalla abierta, se va a Inicio — costo: ninguno
Task 16: complete (commits 392c4d2..f6d553e, tests: env NODE_PATH=/opt/npm-tools/node_modules node pruebas/e2e/gestion.cjs → gestion: 8/8 pasan)
Task 17: Ruling: reglas escritas y revisadas contra los requisitos de la revisión 2; NO verificadas con emulador (sin red para firebase-tools). Verificación pendiente con pruebas/REGLAS.md en el proyecto real — costo si es incorrecto: operaciones rechazadas por el servidor o permisos más amplios de lo debido hasta corregir
Task 17: Ruling: ventas 'get' permite leer un documento inexistente (resource == null) para que la transacción de la vendedora pueda comprobar si su venta ya existe — costo: ninguno (no revela datos)
Task 17: complete (commits f6d553e..4370320, tests: npm test → # duration_ms 8920.006099)
Task 18: Ruling: DIFERIDA — cambiar la Carga Masiva (App-Inventario/index.html, 144 KB, v35, filas de 51 columnas sin color/talla separados) toca la herramienta en producción de Carlos; se hará en una sesión aparte con su aprobación. El POS funciona sin esos datos (agrupa por nombre, +49 usa el precio 4, la vista previa avisa) — costo: hasta entonces, tarjetas por nombre completo (una por talla) y sin regla 'separado' en productos importados
Task 19: Ruling: 'null' visible en pantallas (append de vacíos) — nuevo ayudante sin() y prueba 'Ninguna pantalla muestra null' RED→GREEN; plural '1 prenda'
Task 19: Ruling: revisión de toques en 36 combinaciones: solo las casillas de Ajustes miden 20 px, dentro de una etiqueta de 44 px que también se toca — costo: ninguno
Task 19: complete (commits 4370320..d62aac5, tests: sh -c 'npm test >/dev/null && for f in pruebas/e2e/[!_]*.cjs; do NODE_PATH=/opt/npm-tools/node_modules node $f | tail -1 || exit 1; done' → vender: 9/9 pasan)
## Revisión final (Tareas 9–19)
Final: fixed C1 descuento que crece al quitar prendas — 'Descuento: al quitar prendas…' RED→GREEN (revisarDescuento; aprobado guarda su subtotal; total 0 bloqueado)
Final: fixed C2 comisiones 'Pagado' por ids de ventas incluidas en el pago — 'lo pagado se cuenta por las ventas…' RED→GREEN
Final: fixed C3 reglas de apartados (abonos hasAll, saldo baja y ≥ 0, completado exige la venta) — verificado por lectura; pendiente REGLAS.md
Final: fixed I1 F9 doble abre dos cobros — 'F9 dos veces…' RED→GREEN (marca de cobro abierto)
Final: fixed I2 precios cambiados durante el cobro — 'Si cambian los precios…' RED→GREEN
Final: fixed I3 caja e Inicio leen ventas por cajaId — cubierto por pruebas de caja y gestion (verde); firebase escucha por cajaId
Final: fixed I4 doble toque en movimientos, pagar comisiones, crear usuario, aprobar/rechazar, anular, cancelar — 'unaVez' RED→GREEN
Final: fixed I5 abonos con id y saldo actual — 'un abono reintentado…' RED→GREEN
Final: fixed I6 anular en firebase libera la marca al fallar — verificado por lectura
Final: fixed I7 teléfonos fijos colombianos, con + y 0300 — teléfonos RED→GREEN
Final: fixed I8 reglas: movimientos propios solo se agregan; contador solo +1 — verificado por lectura
Final: fixed (re-graduado) M2 redondeo con parseMonto; M4 abonar/completar esperan la caja en firebase
Final: Ruling: '+57 0300…' ahora se normaliza a 573001234567 (antes null) — costo: ninguno
Final: minor (deferred): al cerrar sesión la pantalla abierta no se desmonta hasta la siguiente entrada (atajos F2/F9 vivos sin sesión)
Final: minor (deferred): sin tasa de Bs, los totales de caja en Inicio cuentan Bs como 0 sin decirlo
Final: minor (deferred): 'Cobros por forma de pago' en Reportes no incluye abonos de apartados
Final: minor (deferred): la vendedora descarga todo su historial de ventas en Inicio (filtro de fecha en el teléfono)
Final: minor (deferred): editar una comisión porcentual en Ajustes la convierte en fija
Suite final: npm test 99/99 · e2e 59/59
- Prueba intermitente: entrar.cjs 'PC: Mi cuenta → Cerrar sesión' falló 2 veces en ~70 corridas (timeout 5 s esperando la barra tras volver a entrar), solo con el equipo ocupado; sin causa encontrada en 40 repeticiones aisladas con diagnóstico. Pendiente de revisar.

## Correcciones tras el video de Carlos (v1.18)
- 25 correcciones aplicadas (teclado, brinco de la barra, demo sin entrada, caja desde Vender, cobro compacto, calendario propio, comisiones, inventario, ajustes, ícono).
- Ruling: las formas de pago mantienen 48 px de alto (§13.3) en 3 columnas; los botones muestran un nombre corto ("Efectivo", "Transferencia", "USDT") porque el grupo ya indica la moneda; el pago agregado y el recibo usan el nombre completo — costo: ninguno.
- Ruling: en el teléfono ninguna ventana abre el teclado sola (solo con [autofocus]); en PC se sigue enfocando el primer campo — costo: un toque más para escribir en el teléfono.
- Ruling: la demostración entra directo con el último rol elegido ("Probar como" en Mi cuenta); ?demo&entrar muestra la pantalla de entrada para pruebas; los datos de la demostración se reinician al recargar — costo: ninguno.
- Ruling: el cliente (teléfono y nombre) va al final de Cobrar, después de los pagos — costo: ninguno.
- Prueba: el corredor de pruebas en navegador reemplaza los elementos de la página por un texto antes de comparar; antes, una comparación fallida con un elemento colgaba la prueba.
- Pendiente: el fallo intermitente de "cerrar sesión y volver a entrar" apareció una vez más con el equipo cargado; no se reproduce aislado (25 + 40 intentos).

## Caja sin fricción (v1.20)
- Vendedora: no puede vender ni apartar sin caja abierta; tocar una prenda abre "Abrir caja".
- Toda caja abierta se cierra sola a las 11:59 pm de su día (la cierra la primera app que se abra después, y se revisa cada minuto). Las de la vendedora quedan "Por arquear".
- Arqueo con un solo conteo: al abrir la caja del día siguiente, lo contado cierra la de ayer (contado vs esperado) y el efectivo contado es el fondo de hoy. La nota no es obligatoria aquí; la diferencia queda registrada.
- Admin y encargada ven en Inicio el aviso mientras haya una caja por arquear.
- Dueños (admin, encargada): sin caja visible. Al cobrar, apartar, abonar o anular se crea sola una caja personal sin fondo, que se cierra a medianoche sin arqueo. Inicio y Caja muestran "Cobrado por mí hoy" solo como información; "En cajas abiertas" ya no cuenta las cajas personales.

## Venta y Ajustes (v1.21)
- Tallas: tocar suma una prenda; el botón "−" de cada talla con prendas resta una. Al dar Listo, la tarjeta del producto queda marcada (borde verde y ✓ con la cantidad).
- Cliente antes del pago: se registra en el carrito (Registrar / Editar). Si se toca Cobrar o Apartar sin cliente, primero pide registrarlo. "Enviar recibo por WhatsApp" es un interruptor en el carrito, encendido por defecto; apagado, la venta no ofrece el recibo.
- Ajustes en 5 apartados: Tasas, Venta, Pagos, Recibo y Usuarios. El administrador cambia su PIN en Usuarios (ya no en Mi cuenta); los demás roles lo siguen cambiando en Mi cuenta porque no entran a Ajustes. "Probar como" sigue en Mi cuenta (solo demostración).
- Formas de pago en tarjetas: apagadas opacas, activas con el color de su moneda e ícono propio; editar, eliminar (con Deshacer) y agregar. Debe quedar al menos una activa.
- Recibo editable: saludo con {cliente}, apartados que se muestran, mensaje final y pie, con vista previa.
- Tema: un interruptor "Modo claro / Modo oscuro" sin el título "Apariencia".
- Arreglo: al cerrar una ventana y abrir otra seguida (cliente → cobro), el historial se comía una entrada y al cerrar la segunda la app salía de la página.

## Ajustes de pantallas (v1.22)
- Cliente en pantalla aparte: al tocar Cobrar o Apartar se abre "Cliente" (pantalla completa) con nombre primero y teléfono después; al escribir el nombre sugiere clientes ya registrados. El carrito ya no tiene bloque de cliente.
- El recibo por WhatsApp es un botón opcional en la pantalla "Venta guardada"; sin interruptor previo.
- Sin modo oscuro: la app queda siempre en claro (se borra la preferencia guardada).
- Más: sin "Mi cuenta"; nueva entrada "Usuarios" debajo de Comisiones (admin) o "Mi cuenta" (otros roles), con Mi cuenta al final de esa pantalla. En PC, "Usuarios" en la barra lateral. Ajustes queda en 4 apartados.
- Formas de pago: tarjetas bajas, ícono a la izquierda y nombre con descripción a la derecha.
- Recibo: un mensaje libre con variables ({cliente}, {tienda}, {ticket}, {fecha}, {prendas}, {totalCOP}, {totalUSD}, {totalBs}, {pagos}, {vuelto}); vista previa estilo WhatsApp arriba y el mensaje debajo. Una línea cuyas variables quedan vacías no se muestra.
- Pendiente de decisión de Carlos: enviar el recibo desde su número (API de WhatsApp).
- Intermitente conocido: tras cambiar de rol, a veces la espera de la barra lateral vence (pruebas de gestión, distinta prueba cada vez).

## Navegación y diseño (v1.23)
- Atrás como en una app: Inicio es la base. Ir de Inicio a otra pestaña agrega una entrada; cambiar entre pestañas la reemplaza; las pantallas de Más agregan una. Así atrás va Ajustes → Más → Inicio y desde Inicio sale de la app.
- La demostración guarda sus datos en la pestaña (sessionStorage): sobreviven a recargas y al botón atrás.
- Modo de Bs: cambiar solo Binance/BCV/Manual ya activa "Guardar" (antes el clic no se detectaba porque el botón se redibujaba).
- "Guardar cambios" de Ajustes: aviso compacto "Cambios sin guardar" arriba, bajo la barra superior, para no tapar lo que se escribe.
- Sin la palabra "bolívares" en pantalla: "Bs".
- Sin título en las pantallas de Más (Ajustes, Caja, Reportes, Comisiones).
- Cobro: "Falta" en rojo crema.
- Calculadora: etiqueta con ícono y tasa a la derecha, caja con prefijo (COP, $, Bs.) y copiar; sin descripción al pie.
- Más en tarjetas; Inicio con tarjetas como la app de Pedidos (chip con ícono, ícono de fondo, saludo según la hora y fecha). Las tarjetas de Inicio llevan a su pantalla.
- Tasas del día: tarjetas por moneda con fuente y hora, y equivalencias en pastillas.

## Diseño y detalles (v1.24)
- Tasas del día: dos filas (ícono de color, fuente y hora, tasa grande), sin tarjetas ni pastillas. La tuerca junto a Cerrar abre Ajustes; antes el "atrás" de la ventana cerrada se comía la navegación (ahora se espera con despuesDeCerrar).
- Usuarios como en Pedidos: botón crema "+ Nuevo usuario" que abre ventana con nombre, usuario automático, rol y PIN sugerido ("Otro"); al crear, "Datos de acceso" para copiar o compartir. Nuevo PIN y Desactivar alineados a la derecha.
- Inicio: tarjetas blancas con borde de color a la izquierda, valor del color e ícono grande muy tenue arriba a la derecha.
- Más: filas agrupadas (Negocio / Administración) con ícono de color, descripción y flecha.
- Calculadora: sin "0" de ejemplo y con borrador junto a Cerrar que limpia todo.
- En toda la app, Enter en un campo de una línea oculta el teclado.

## Detalles (v1.25)
- Barra superior sin botón de actualizar; la calculadora ocupa su lugar.
- "Nuevo usuario": ancho completo, punteado y sin relleno, como "Agregar forma de pago".
- Tasas del día: no se muestra "Manual" (sí Binance/BCV o "última conocida").
- Degradado sutil (color al 9 % hacia blanco, borde teñido) en tarjetas de Inicio; íconos de Más y de Tasas con fondo degradado e ícono de color.

## Detalles (v1.26)
- "Guardar cambios" de Ajustes vuelve abajo (como en el resto de la app), aunque el teclado lo tape.
- La versión ya no se muestra en Inicio; queda al pie de Más (teléfono) y en la barra lateral (PC).

## Tasas en Ajustes (v1.27)
- Como la Calculadora de Tasas: "1 USD = [ ] COP" para el peso; para Bs, tres tarjetas con radio (Binance P2P con su tasa base, hora y total con recargo; BCV oficial; Manual con "1 USD = [ ] Bs."). El recargo solo se ve con Binance elegido; escribir la tasa manual elige Manual. Se mantiene "Guardar cambios" abajo (no se copiaron Listo/Restablecer).

## Tonos (v1.28)
- Tonos de la app de Pedidos (verde #15803d, rojo #dc2626, azul #2563eb, violeta #7c3aed, rosa #db2777) en tarjetas de Inicio (ventas verde, ganancia violeta, caja azul, cobrado rosa, existencias bajas rojo) y en íconos de Más (Caja verde, Reportes azul, Comisiones violeta, Usuarios rosa, Ajustes rojo). El diseño de las tarjetas no cambia.

## Guardar fijo y actualizaciones (v1.29)
- "Guardar cambios" de Ajustes fijo al final del contenido (no flotante), siempre visible y activo solo cuando hay cambios. Tasas, Venta y Pagos sin título.
- Actualizaciones: al quitar el botón de recargar, la app ya no buscaba versiones nuevas (solo al cargar). Ahora busca al volver a la app y cada 10 minutos; si no hay nada a medias se actualiza sola, si no muestra "Hay una versión nueva · Actualizar". Los archivos se revalidan con el servidor (no-cache) para no servir copias viejas del navegador. No se puede probar en las pruebas automáticas (corren sin https): verificar en el teléfono.

## Venta en curso y detalles (v1.30)
- Venta en curso como en Pedidos: el carrito (prendas, descuento, cliente) se guarda en el aparato por usuario; si la app se cierra, al entrar pregunta "¿Continuar venta?" (Cancelar la descarta). Vale 24 h; al terminar la venta se borra.
- El "−" de las tallas en rojo crema y del mismo tamaño que la cantidad.
- Inventario sin tarjetas de valor arriba.
- Existencias bajas (Inicio) y el ícono de Ajustes (Más) en azul turquesa (#0891b2).
