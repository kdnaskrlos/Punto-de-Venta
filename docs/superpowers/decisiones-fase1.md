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

## Detalle (v1.31)
- Prenda elegida en Vender con contorno azul crema (borde #a8c5fa y anillo var(--b-bd)).

## Apartados, modo prueba y elección de prenda (v1.32)
- Apartados rediseñados: resumen arriba (Por cobrar, Pendientes, +15 días), búsqueda por cliente o teléfono, filtros Pendientes (con conteo) · Completados · Cancelados · Todos; tarjetas con cliente y teléfono, prendas en pastillas, barra de lo abonado, saldo en rojo y aviso de días cuando pasan 15.
- Modo prueba como en Pedidos (solo admin, en Más arriba de la versión): carga ejemplos con demo:true (45 ventas en 30 días, apartados en los tres estados, clientes y, si hay pocos productos reales, prendas de ejemplo con costo). "Modo prueba · activo" los quita sin tocar lo real. Reglas: el admin solo crea/borra documentos con demo:true (y costosVenta "demo-…"). Ruling: el ID de venta de ejemplo empieza con "demo-" para poder borrar su costo congelado.
- Prenda elegida en Vender: acento violeta (fondo suave, borde y ícono violeta, pastilla de cantidad violeta) en lugar de contorno; las tallas elegidas también en violeta.

## Detalle (v1.33)
- El círculo "−" de las tallas pasa a la esquina inferior izquierda.

## Detalle (v1.34)
- Elección de prenda y tallas con acento azul muy suave (#3b82f6 a baja intensidad); la cantidad en pastilla azul crema.

## Auditoría de diseño (v1.35) — cada mejora en su propio commit, para poder revertirla sola
- Punto de partida marcado con la etiqueta git `antes-auditoria`.
- Mejora 1 (5478ff4): escala de letra 12·13·14·16·20·26 y radios 8·12·16·pastilla.
- Mejora 2 (622211a): títulos y etiquetas sin mayúsculas, sin letra monoespaciada, "Talla 4: 12", "25.000 c/u (1–5 prendas)".
- Mejora 3 (0a301c2): tonos de Inicio sin chocar con las monedas (ganancia rosa, cajas ámbar, cobrado naranja), un solo ícono por tarjeta, colores pasados a tokens, sin bloque de modo oscuro ni estilos sin uso.
- Mejora 4 (432291f): filas de ventas tocables con detalle (prendas, pagos, total); "Anular venta" vive en el detalle.
- Mejora 5 (26b58a4): tarjetas de Vender con la silueta en el color real de la prenda (nucleo/colores.js), tallas a la vista (agotadas tachadas) y precio destacado.
- Mejora 6 (802ef6f): Inicio con "Últimas ventas" (5) y "Ver las N"; la última tarjeta impar ocupa todo el ancho; formas de pago llenan su fila; Reportes con más vendidos legibles.
- Para revertir una: `git revert <commit>` y subir la versión.

## v1.36 — Correcciones de la auditoría UI (ui-ux-audit, 47/100)
- C1: las cifras de las tarjetas se achican según su largo (mín. 17px) y la tarjeta ocupa la fila si son muy largas. El contenedor de medida es la rejilla `.tiles` (no la tarjeta) para no romper el subgrid.
- C2/W7: nombre accesible en la tasa Bs manual, el recargo y los tres buscadores.
- W1: foco visible por dentro de los botones segmentados. W4: toques de 44px (chips, botones chicos, Modo prueba, rango).
- W2: el área del − crece solo hacia su talla; tallas separadas 14px. W3: filtros de Apartados en 2 × 2 en el teléfono.
- W5/W6/P6: "pocas" con texto e ícono en Inventario; tallas agotadas legibles; siluetas de color en Inventario.
- W8: tarjetas en 2 columnas (4 en ≥1100px) sin sueltas; datos de Comisiones igual.
- P1–P5: hora sin partir, títulos de Más alineados, filas de tarjetas con subgrid, hover en laptop, contraste en Comisiones.
- Cada grupo está en su propio commit para poder revertirlo.

## v1.37 — Rediseño de Apartados, Vender/Inventario, Reportes, Comisiones y menos verde
- Apartados: tarjeta compacta como en Pedidos (nombre, saldo, resumen de prendas, fecha, aviso +15 días); al tocar abre el detalle con pago, prendas, abonos y acciones. Resumen arriba en una sola tarjeta neutra.
- Vender: tarjetas compactas de 2 por fila en el teléfono, imagen cuadrada; sin foto, ícono gris según el tipo de prenda (nucleo/tipo-prenda.js). Sin pastillas: tallas y color en texto. Inventario: filas compactas con la misma miniatura, tallas «4: 12» y total a la derecha.
- Reportes: tarjeta resumen (ventas, ganancia y %), gráfica de barras por hora (un día) o por día (rango), cobros en una barra apilada por forma (equivalente en pesos), top 5 con barras; Ventas, Existencias bajas y Valor del inventario se abren en una ventana.
- Comisiones: «Por pagar» primero, detalle debajo y comisión por venta en ventana. Solo ganan quienes tengan «Gana comisión» en Usuarios (campo ganaComision; si no se marcó, solo la vendedora).
- Verde solo en acciones principales y estados de éxito; pestañas, filtros, chips, menú, calendario y opciones elegidas en gris oscuro (--sel-neu). Las tarjetas de color de Inicio y los íconos de Más se mantienen (tonos elegidos por Carlos).

## v1.38 — Tallas, total del carrito y pantalla de Cobrar
- Tallas: una fila por talla con − cantidad + (botones de 48px, separados); el − se ve siempre y se apaga en 0; la fila elegida se resalta en azul suave. Ya no hay círculo − en la esquina.
- Carrito: «Total», el monto y sus equivalentes alineados a la derecha.
- Cobrar: total en tarjeta (alineado a la derecha, con USD y Bs). Las formas de pago son tarjetas como las de Ajustes → Pagos (ícono del color de la moneda, nombre, moneda); al tocar una se resalta y el monto aparece dentro de esa tarjeta, con su equivalencia y la X para quitarla.

## v1.39 — Diez ajustes según las referencias de Carlos
- Apartados: tarjeta con monto y pastilla «Por cobrar» a la derecha; filtros como pastillas deslizables; detalle con cabecera propia (nombre, teléfono, estado, X), saldo pendiente | total abonado, prendas con talla en pastilla, «Último abono» con historial y fecha del apartado al pie.
- Tasas: panel sin cabecera que baja desde la barra superior (animación «baja»); fecha y hora en una línea; «Cambiar tasas» abajo para quien puede.
- Inventario: filtros Todos / Stock bajo / Agotados (con cuenta) y categorías; aviso «Stock bajo» o «Agotado».
- Vender: filas (imagen, nombre, punto de color, tallas; a la derecha disponibles en pastilla y precio). La imagen 8 se tomó como referencia de Vender porque muestra precio y categorías.
- Tallas: tarjetas por talla (talla · disponibles · − cantidad +); los cambios se pasan con «Agregar al carrito» (o «Actualizar carrito»); la X no cambia el carrito.
- Carrito: cada línea en tarjeta con imagen, pastillas de color/talla y tarifa, quitar y monto a la derecha, cantidad abajo; fila de descuento; total en caja verde suave con equivalencias.
- Cobrar: formas en dos columnas, sin «+»; tocar elige o quita; los pagos elegidos se suman debajo del total.
- Usuarios: tarjetas compactas que se despliegan (comisión, Nuevo PIN, Desactivar adentro).

## v1.40 — Inventario más claro y detalle gráfico
- Tarjeta del inventario sin tallas: imagen, nombre, punto de color, «N tallas», una barrita por talla (gris = bien, ámbar = en el mínimo, rojo = agotada), total de unidades y estado (En stock / Stock bajo / Agotado).
- Detalle de prenda sin cabecera repetida: imagen y nombre con la X, tres cifras (unidades, tallas, en el mínimo), barras de existencia por talla con línea punteada del mínimo; al tocar una talla aparece su código, Historial y Ajustar. Precio por cantidad como barras con el margen sobre el costo y el costo en violeta.
- Tallas en orden natural (meses, números, S–XXL) con compararTallas (nucleo/tipo-prenda.js).

## v1.41 — Detalle de prenda más sencillo
- Se quitan las barras, márgenes y cifras sueltas: total de unidades, una casilla por talla (talla y cantidad; ámbar «pocas», rojo «agotada»), y precios en filas simples con el costo al final. Tocar una talla muestra su código, Historial y Ajustar.

## v1.42 — Detalle de prenda vuelve al de la v1.38
- A pedido de Carlos, la ventana de detalle del inventario vuelve a la de la v1.38 (precios en recuadros, filas por talla con Historial/Ajustar). Se conserva el orden natural de tallas. La tarjeta de la lista sigue como en la v1.40.

## v1.43 — Ajustes, pagos, pastillas y carrito
- Ajustes → Venta: sin «Nombre de la tienda» ni «Descuento máximo de la vendedora» (todo descuento de la vendedora pide autorización: máximo 0). Tramos y comisión por prenda en tarjetas desplegables; descripciones sin negrita.
- Pagos: dos columnas, sin «Activa/Apagada» (lo dice el color). La transferencia en pesos se llama «Nequi»; se quitan «Efectivo Bs» y «Punto de venta» (también de ajustes ya guardados, con normalizarFormas). Sin efectivo en Bs no hay fondo en Bs ni vuelto en Bs.
- Pastillas de filtros más bajas (34px) y con su contorno completo en Vender, Inventario y Apartados.
- Apartados: sin el círculo con la inicial; la pastilla de estado a la altura del nombre y el monto a la altura de la fecha.
- Carrito: contador arriba a la derecha (con 1 unidad el − es un bote), sin línea vertical ni bote aparte, sin el ícono ⇄. Con más de 2 prendas las líneas se compactan y se abren al tocarlas, con transiciones de altura como en Pedidos (ponerCarrito). El aviso amarillo de tramos entra deslizándose y late dos veces.
- Vender: tallas abajo a la altura del precio y sin línea vertical.

## v1.44 — Principios de Material Design 3 con la identidad de Comic Shop
- Se conservan fuente, colores, verde de acción y tonos crema; se adaptan las reglas de Material 3. Tres desviaciones deliberadas: campos de 48px (M3 usa 56), botones de 48px (M3 usa 40 con área de toque de 48) y ventanas con radio de 16px (M3 usa 28).
- Escala de 4/8: espacios, radios (4·8·12·16) y tamaños de letra normalizados en componentes.css y base.css; peso 800 solo en cifras.
- css/material.css: botones 40/48/56, deshabilitado gris de M3, botón de texto, campos unificados (fondo blanco, borde #c4cad3, foco con borde de 2px), un solo estilo de cerrar, títulos de sección iguales, tarjetas sin sombra y dos niveles de elevación, áreas de toque de 48px con ::after, capas de estado al pasar y presionar, foco visible, botón «cargando» con ruedita y movimiento reducido.
- Jerarquía y estados: «Ventas de hoy» ocupa todo el ancho en Inicio y las cifras en cero se apagan; formas de pago con un menú ⋮ (Editar/Eliminar); en Cobros cada forma tiene su tono dentro del color de su moneda; el botón final dice «Cobrando…» y Ajustes «Guardando…»; en tallas el + se apaga al llegar a la existencia y aparece «Máximo N».
- Tarjetas de lista compactas: Apartados 89px e Inventario 78px, todas iguales (la pastilla de aviso toma el lugar de «unidades»).
- Detalles: talla bajo el nombre en el detalle del apartado; «Valor del inventario» en dos líneas; descripciones cortas en Binance/BCV; montos grandes que se encogen solos según su largo (--n); en Vender máximo 5 tallas y «+N».
- Ventanas adaptables de M3: teléfono y tableta hasta 839px (barra abajo), computadora desde 840px; Vender en una columna < 600px, dos columnas de 600 a 839px y rejilla libre desde 840px.
- Apartados (a pedido de Carlos): sin la flecha › en las tarjetas; la pastilla y el monto quedan pegados al borde derecho y el monto siempre a la altura de la fecha.

## v1.45 — Revisión de consistencia en todo el sistema
- Medición de todas las pantallas y ventanas a 360px: 7 tamaños de letra (12·13·14·16·20·24·32), 4 radios (8·12·pastilla·círculo), campos de 48px y cerrar de 48px en todas las ventanas.
- Se corrigen las excepciones que quedaban: títulos y nombres con peso 700 (el 800 solo en cifras); nombres de tarjeta a 16px en Vender, Inventario y Apartados; botones finales de ancho completo y campos de cifra grande a 56px (antes 50–52).

## v1.46 — Rol, carrito, espacios, tasas y tarjeta de apartado
- Rol en Usuarios: pastilla neutra para todos los roles. Prenda en el carrito: selección neutra (fondo gris claro, contador oscuro) en lugar de azul.
- Espacio de 12px entre las pastillas de filtro y el primer elemento en Vender, Apartados, Inventario, Reportes y Comisiones (antes 24 en varias). La pastilla de fecha mide lo que se ve (36) con área de toque de 48.
- Tasas del día: monto a 18px (20 desde 400px) alineado arriba con el título.
- Tarjeta de apartado: nombre y estado en la primera línea; fecha y monto en la última sobre la misma línea base (antes el monto se alineaba al fondo de la tarjeta y quedaba más bajo que la fecha).

## v1.47 — Tasas del día
- La fecha va sin el día de la semana («12 nov · 8:00 am») y el monto se apoya en la misma línea base que la fecha y hora.

## v1.48 — Título de la tasa en Bs
- En Tasas del día, el título de la fila de Bs es la fuente elegida en Ajustes («Binance P2P» con su recargo, «BCV oficial» o «Tasa manual»); abajo solo queda la fecha y hora.
- v1.49: el título «Binance P2P» va sin el recargo.

## v1.50 — Solo tamaños de la escala
- Monto de Tasas del día a 20px (estaba en 18, fuera de la escala).
- Se quitan los tamaños continuos (clamp/calc) de los recuadros de Inicio y de los montos que se encogían: ahora un monto largo baja un paso de la escala (24→20→16; 32→24→20) según su largo (data-largo, función largo() en ui.js).
- Verificado en todas las pantallas a 360 y 1280px: solo 12·13·14·16·20·24·32.

## v1.51 — Carrito
- El nombre de la prenda usa hasta dos líneas y luego «…» (antes se cortaba a mitad de letra junto al contador).
- Contador igual con 1 o con varias unidades: el bote tiene el mismo fondo gris que − y +, solo el ícono es rojo.
- «Tarifa 1–5» en pastilla neutra y el recuadro del total en gris (el verde queda solo para Cobrar).
- Sin descuento no se muestra la fila «Descuento 0 COP» (ya está el botón Descuento).
- v1.52: cabecera de ventanas y hojas (Carrito, Calculadora, etc.) de 72 a 56px de alto.
- v1.53: vuelve el fondo verde crema del recuadro Total en el carrito (a pedido de Carlos).
- v1.54: las hojas que suben desde abajo (Carrito, Calculadora en el teléfono) se ocultan con una flecha hacia abajo en lugar de la X; las ventanas conservan la X.

## v1.55 — Pedidos de Carlos (descuento, apartados, animaciones, ajustes)
- Ajustes que se perdían: la app publicada corre en modo demostración (config.js sin Firebase) y guardaba en sessionStorage, que se borra al cerrar la app o al actualizarse. Ahora guarda en localStorage (y rescata lo que hubiera en la pestaña la primera vez).
- Descuento del carrito: sin porcentaje; monto en pesos o en dólares (convertido a COP con la tasa del día y mostrando el equivalente). La fila del carrito muestra el monto descontado en rojo, sin X; se quita desde la misma ventana («Quitar descuento»).
- Detalle de apartado: primero «Total abonado» y luego «Saldo pendiente».
- Tarjeta de apartado: nombre (y estado si aplica); cantidad de prendas y fecha en gris; abajo «Abonado X» a la izquierda y el saldo grande a la derecha, en la misma línea base. Sin nombre de prenda ni «Debe».
- Calendario de fechas: tira de tres meses que sigue al dedo y pasa de mes deslizándose (0,26 s; 0,18 s con gesto rápido; cambia con 20 % de arrastre o > 0,35 px/ms), como la agenda de Pedidos.
- Pastillas de filtro sin bamboleo vertical (el área de toque de 48 px sobresalía): overflow-y hidden.
- Desplegables (Usuarios y tarjetas de Ajustes → Venta) con la animación de Pedidos: alto en 280 ms y filas escalonadas cada 35 ms; al plegar, lo inverso (desplegar() en ui.js).
- Cierre de capas con el movimiento inverso al de apertura: la hoja del carrito baja completa (240 ms), la lateral sale por la derecha, las ventanas se desvanecen. Las hojas ahora entran completas desde su borde (280 ms).
- Ajustes: aviso flotante discreto «Cambios sin guardar · Guardar» mientras haya cambios y el botón de abajo no se vea.
- Ajustes → Pagos: nombre y moneda alineados a la derecha.

## v1.56 — Tarjeta de apartado, cobro y «Venta exitosa»
- Tarjeta de apartado como la imagen de Carlos: a la izquierda el nombre (hasta dos líneas) y «prendas · fecha» con íconos (fecha en rojo si pasó de 15 días); a la derecha dos columnas con línea divisoria: «Abonado» y «Saldo» (rojo). En Completados/Cancelados la segunda columna dice el estado y muestra el total. Columnas de ancho mínimo fijo para que los montos queden alineados en la lista.
- Detalle de apartado: abonado y saldo del mismo tamaño (24px).
- Ajustes → Pagos sin la descripción.
- Carrito: el monto del descuento y su «COP» en rojo, con el mismo formato de moneda que el resto.
- Teclado: en el teléfono ningún campo se enfoca solo (ventanas, entrada, cliente, caja, descuento). La ventana Descuento ya no salta al cambiar de moneda (la línea del equivalente siempre ocupa su lugar).
- Cobrar: total en verde crema. Cada pago en tarjeta: ícono, nombre y «≈ pesos», recuadro con el monto y la moneda, y botón redondo − en la esquina. Al agregar un pago entra abriéndose; al quitarlo se cierra.
- «Venta exitosa»: check animado con onda, total cobrado en verde crema con equivalentes, pagos y vuelto, botones de recibo y Nueva venta, y cierre automático a los 10 s con barra (tocar la pantalla o el recibo lo detiene).

## v1.57 — Tarjeta de apartado en tres líneas (boceto aprobado)
- 1) nombre a todo el ancho, sin cortarse; 2) «Hace N días» (rojo desde 15) en línea con «Abonado» y «Saldo»; 3) fecha con ícono en la misma línea base que los montos. Sin cantidad de prendas. Una sola línea divisoria, continua, entre Abonado y Saldo.
- Formas de pago (Cobrar y Ajustes): «· efectivo» solo aparece si el nombre no lo dice ya («Efectivo / COP» en lugar de «Efectivo / COP · efectivo»).
- v1.58: quitar un pago en Cobrar es fluido en dos tiempos (se desvanece y luego su espacio se cierra, 340 ms) sin el salto final: el relleno y el borde de la tarjeta tenían !important y no se animaban; el espacio entre pagos pasó a ser margen de cada tarjeta. Al agregar, el movimiento inverso.
- v1.59: aviso amarillo de tramos: al aparecer primero se abre su espacio y luego se desvanece hacia adentro (480 ms, sin salto del espacio entre bloques); al cambiar el número se renueva con un fundido corto; al irse, una copia se desvanece y cierra su espacio (380 ms).
- v1.60: pagos en Cobrar: al quitar, un solo movimiento continuo (se encoge y se desvanece a la vez, 300 ms) y la forma de pago se desmarca al instante; al agregar, se abre y aparece a la vez y el botón − entra al final; sin anclaje de desplazamiento del navegador; sin «≈ 0 COP» cuando el monto está vacío.
- v1.61: Reportes: Ventas y Ganancia con el mismo tamaño (32px; bajan juntos a 24 o 20 si alguno es largo).

## v1.62 — Conexión a Firebase
- config.js con el proyecto «punto-de-venta-comic-shop». Sin ?demo la app usa Firebase (Authentication por usuario y PIN, Firestore con las reglas de firestore.rules). El modo demostración sigue disponible con ?demo.

## v1.63 — Usuarios y guardado de ajustes en Firebase
- Usuarios (administrador): sin la sección «Mi cuenta»; en su propia tarjeta van «Cambiar mi PIN» y «Cerrar sesión» (en la demostración, «Probar como»). Sin «(tú)». Los demás roles siguen viendo «Mi cuenta».
- Eliminar usuario: botón «Eliminar» en la tarjeta de los demás (no en la propia), con confirmación. El perfil queda apagado y marcado eliminado (sus ventas y cajas se conservan) y se borra su entrada de «logins»: ya no puede entrar y el nombre de usuario se puede volver a usar.
- Ajustes en Firebase: guardarAjustes espera la respuesta del servidor (hasta 8 s) para avisar si las reglas lo rechazan, y quita los campos «undefined» (Firestore los rechaza). Si las tasas no se guardan, ahora sale un aviso con la causa (antes no decía nada).
- Más: junto a la versión dice «conectado a Firebase» o «modo demostración».
- v1.64: la entrada ya no se queda callada: si la cuenta es correcta pero el perfil no llega (reglas, perfil borrado o inactivo, sin respuesta), dice «no se pudo cargar tu perfil (causa)»; otros errores muestran su código. Verificado con un Firebase simulado (crear admin, salir, entrar, guardar tasas).
- v1.65: crear el administrador espera la respuesta de Firestore (hasta 15 s); si falla, muestra la causa y borra la cuenta de Authentication recién creada para no dejarla a medias.
- v1.66: al volver a entrar, la sesión ya no se cierra sola con la copia vacía del perfil que queda en el teléfono tras cerrar sesión: solo se decide con la respuesta del servidor. Si la sesión se cierra sola, la entrada muestra la causa.
- v1.68: entrar abre la sesión directamente con el perfil leído del servidor (no espera otro aviso de Firestore); cada paso tiene límite de 15 s y la pantalla muestra en qué va («Buscando usuario…», «Verificando PIN…», «Cargando tu perfil…»); la consola registra [entrar] en cada paso.
- v1.69: causa real de «no entra»: al cerrar sesión, la app consultaba a Firebase si el sistema estaba iniciado antes de mostrar la entrada; si alguien entraba mientras tanto, esa respuesta atrasada tapaba la app con la pantalla de entrada y la app ya no volvía a cambiar (creía que ya mostraba la sesión). Ahora cada cambio de sesión tiene su turno y una respuesta vieja no pinta nada; además solo se omite repintar si la pantalla visible ya corresponde. Reproducido con Firebase simulado (sistema lento 3 s).

## v1.70 — Importar el inventario.json nuevo de la Carga Masiva (sin FacilitoPOS)
- Importador reescrito (js/nucleo/importar.js): lee por NOMBRE de columna en `head` (nunca por posición) e ignora columnas desconocidas. Columnas: sku, nombre, tipo, tela, color, talla, genero, marca, modelo, costo, precio1..precio5, separado, codigo, existencia, minimo. Sin rastros de FacilitoPOS (name, category, brand, price, barcode, location_*, comm_*, sizes, categoria).
- Validación por fila (no detiene la importación): sku obligatorio y no repetido, código de 13 dígitos si viene (texto, conserva ceros), números válidos y no negativos, precio1 obligatorio. Si falta la columna sku o nombre, no se importa y se dice por qué.
- Upsert por sku. Resumen: filas leídas, nuevos, actualizados, sin cambios, con errores (con la lista de filas); los productos del POS que no vienen en el archivo se avisan y no se borran.
- Decisión de Carlos: la existencia del archivo solo se usa en la carga inicial (productos nuevos); los que ya existen conservan el stock del POS.
- Modelo de producto: tipo, tela, color, talla, genero, marca, modelo (+ grupo y titulo calculados). Tarjeta = tipo + tela + marca + género + modelo + color; dentro, las tallas. Título visible «tipo marca género modelo» (sin repetir el modelo cuando es igual al tipo); color y tela debajo. Filtros por género. Búsqueda por todos los atributos, sku y código.
- Fotos por sku (el nombre del archivo es el sku de la variante); la tarjeta muestra la foto de cualquiera de sus tallas.
- «separado» se guarda pero no tiene lógica: todas las prendas cuentan en el mix hasta que Carlos defina su uso. precio5 se guarda tal cual (sigue siendo el precio del último tramo). Las comisiones por producto ya no vienen en el archivo: se usan las de Ajustes.
- Variantes sin talla (39 en el inventario real) se muestran como «Talla única». Íconos para Chemis y Bluson.
- Probado con el inventario real (1.369 filas, con los nombres de columna de la Carga Masiva v45): 1.369 válidas, 0 errores, 346 tarjetas, importación en 0,2 s.

## v1.71 — Botón «Sincronizar inventario»
- Reemplaza a «Importar» y reutiliza el mismo importador. Solo sincroniza al pulsarlo (nunca automático). Descarga data/inventario.json de la Carga Masiva con ?t=<fecha> y no guarda nada hasta «Aplicar cambios»; «Cancelar» cierra sin cambios.
- Vista previa: fecha del archivo («at») y hace cuánto, filas, nuevos, actualizados (con el detalle campo por campo, p. ej. «precio1 25000 → 27000»), sin cambios y con error (listados al final). Aviso de los productos del POS que no vienen en el archivo: nunca se borran.
- Existencia: los nuevos toman la del archivo; en los que ya existen solo se aplica si se marca «Actualizar también existencia» (desmarcada por defecto), con su movimiento «sincronización» en el historial. El mínimo siempre se actualiza.
- «Última sincronización: <fecha y hora>» junto al botón; se guarda en Ajustes (ultimaSincronizacion y archivoSincronizado).
- Sin internet, error de descarga o archivo dañado / sin columnas obligatorias: mensaje claro y no se cambia nada. Las filas con error no se aplican; las válidas sí.
- Prueba con el inventario real (1.369 filas): primera vez 1.369 nuevos, 0 actualizados, 0 sin cambios, 0 con error; segunda vez con el mismo archivo 0 / 0 / 1.369 / 0.
- v1.72: el último tramo empieza en 48 (precio4 = 24–47, precio5 = 48+), como el Tarifario. Si en Ajustes quedaron guardados los tramos viejos exactos (1, 6, 12, 24, 49) se corrigen solos a 48; unos personalizados se respetan.
- v1.73: fotos por código de imagen. La Carga Masiva trae la columna «id_imagen» (img-0001, en minúsculas; la comparten las tallas de una prenda y a veces varias prendas). Se importa por nombre con las demás columnas y en la vista previa de la sincronización cuenta como campo que cambia.
  - La foto se guarda una sola vez como fotos/img-0001.webp (WebP, máx. 800 px) y el registro código → foto va en ajustes/imagenes (todos lo leen, solo el admin lo cambia; no hizo falta tocar las reglas). Todas las variantes con ese código la muestran, sin copiarla a cada sku.
  - Orden: foto del código → foto del sku (respaldo) → ícono gris de la prenda.
  - En Inventario: «Fotos» empareja los archivos por código (img-0001.jpg/.png/.webp) y si no, por sku; muestra «N de M productos con foto · K códigos de imagen sin foto». En el detalle de cada prenda, botón «Foto» / «Cambiar foto» que sube al código de esa tarjeta.
  - Inventario real: 1.369 productos, 346 códigos de imagen, ninguno vacío; sin fotos subidas todavía (0 con foto, 346 códigos sin foto).
- v1.74: ícono de la app con esquinas redondeadas como el del Tarifario (radio 112 de 512, fondo transparente) para «any»; aparte icono-maskable-512.png cuadrado para Android y apple-touch-icon.png de 180 px para el iPhone.
- v1.75: la nota de «Fotos» siempre pide nombrar el archivo con el código de imagen (img-0001.jpg). Si los productos aún no traen id_imagen (cargados antes de la v1.73), aparece un aviso para pulsar «Sincronizar inventario»; el sku sigue funcionando como respaldo.
- v1.76: se quitó el respaldo de foto por sku. La foto sale solo del código de imagen (id_imagen); sin código o sin foto subida se ve el ícono gris de la prenda. «Fotos» empareja solo por código y la lista manual ofrece solo códigos; el botón «Foto» del detalle aparece solo en prendas con código. Se eliminó guardarFoto(sku) de los almacenes.
- v1.77: pastilla «Modo demo» junto a «Modo prueba» (en Más en el teléfono; al pie de Ajustes en la computadora, donde ahora también está Modo prueba). Permite al administrador ver la app como Vendedora o Encargada: cambia solo lo que se muestra (ctx.vistaRol → ctx.rol() y puedeVer), los datos y lo que se guarde son reales. Franja amarilla «Modo demo · <rol> · Lo que hagas se guarda de verdad» con «Salir»; al recargar o volver a entrar se vuelve a administrador.
- v1.78: el nombre de la tarjeta sale de la columna «nombre» tal cual, quitándole solo la talla, el color y la tela («Franela Etanol Unisex 2XL Amarillo Claro PoliAlg.» → «Franela Etanol Unisex»). El modelo y la tela ya no se muestran (ni en el nombre ni en la línea de abajo, que queda solo con el color; tampoco en el carrito ni en lo que se guarda en ventas); siguen sirviendo para agrupar y para el buscador. Se calcula siempre, sin usar el titulo guardado de versiones anteriores. Inventario real: 346 tarjetas y 346 combinaciones nombre + color distintas (ninguna se ve repetida).
- v1.79: se revierte la parte de la v1.78 que quitaba la tela de todas partes: la línea bajo el nombre vuelve a «color · tela», el carrito a «color · tela · Talla» y lo guardado en ventas a «nombre color tela». Solo el nombre (título) queda sin modelo ni tela, sacado de la columna nombre.
- v1.80: el Inventario del POS es una copia visual de la app «Stock, Comic Shop» (App-Inventario/movil/index.html v14): css/stock.css copia su <style> dentro de .stk (variables claro/oscuro, Public Sans + JetBrains Mono; .btn/.tile/.ver renombradas a .sbtn/.stile/.sver para no chocar con el POS). Cabecera fija con «Stock, Comic Shop», versión del POS en pastilla y botones de icono (sincronizar y subir fotos solo para el admin en computadora; tema claro/oscuro solo de esta sección, guardado en pos.temaInventario). Resumen, segmentos Todos/Stock bajo/Agotados, buscador con botón de escáner, filtros Género/Marca/Orden, «N resultados · Sincronizado …», una tarjeta por variante (nombre de la columna sin la tela; sku; «precio1 · género · N uds/bajo/agotado» con color de estado) y la foto del código de imagen a la derecha (o recuadro con ícono). «Mostrar N más» de 80 y luego de 100.
  - Detalle en hoja inferior con la misma animación, gesto de bajar, scrim y bloqueo de scroll; Atrás/Escape la cierran sin salir del POS (ui.js: abrirCapaPropia). Tarjetas: foto (si hay), Stock, Código de barras EAN-13 dibujado con Copiar, Precios 1–5 (con oferta), Ficha (+ código de imagen; costo con «Mostrar» solo para quien ve costos) y Acciones del POS según permisos (Historial, Ajustar existencia, Oferta, Subir/Cambiar foto). Se repinta al cambiar los datos.
  - Escáner (js/vistas/escaner.js) copiado de la app: cámara trasera, recuadro, flash, foto del código, campo manual; BarcodeDetector o @zxing/library 0.21.3 (se carga al abrir; el service worker lo guarda). Busca por codigo (también sin dígito verificador o con 0 delante) o sku; uno → abre su detalle; ninguno → «No encontré ese código». Sin cámara o permiso: solo el campo (sirve para lector USB). Enter en el buscador con un código hace lo mismo.
  - Se quitaron la lista agrupada por prenda y la ventana de detalle por grupo del inventario (Vender sigue agrupando).
- v1.81: el Inventario se integra como una sección más del POS (conserva colores, fondo y letra de la app de stock): sin título «Stock, Comic Shop» ni versión ni selector de tema (siempre en claro); Fotos y Sincronizar como botones en la cabecera fija (admin en computadora); sin barra de desplazamiento visible mientras se ve el inventario (clase stk-sin-barra en <html>, se quita al salir). Escritorio (≥840 px): contenido de hasta 1180 px centrado junto a la barra lateral, cabecera en dos filas (resumen + segmentos; buscador + filtros + botones) y tarjetas en varias columnas; la hoja de detalle se centra en el área de contenido. El teléfono queda igual.
- v1.82: Inventario centrado en la pantalla en escritorio (no solo junto a la barra lateral; ancho hasta 1180 px). Se quitaron las tarjetas «unidades en stock» y «variantes registradas»; su estilo (fondo suave, cifra mono de 24 px y etiqueta) pasa a Todos (violeta), Stock bajo (ámbar) y Agotados (rojo), con borde de su color en la opción elegida. El espacio bajo la barra de tasas es el mismo de las demás pantallas (16 px en computadora, 12 px en teléfono). En escritorio la primera fila es opciones + buscador y la segunda filtros + Fotos/Sincronizar.
- v1.83: inventario descentrado en teléfonos angostos (320–360 px) con el inventario real: una regla vieja (.vista[data-ruta="/inventario"] en flex) no dejaba encoger el contenido por debajo del ancho de las cifras de Todos/Stock bajo/Agotados («1.390»), así que se salía ~34 px por la derecha. La vista ahora es bloque, los botones pueden encoger y en pantallas de 380 px o menos la cifra baja a 20 px. Prueba e2e a 320 px con 1.421 variantes.
- v1.84: las tarjetas Todos / Stock bajo / Agotados del inventario llevan el degradado de las tarjetas de Inicio (color al 9 % que se funde con la superficie hacia la derecha, borde del mismo color al 28 % e ícono grande y tenue arriba a la derecha: caja, alerta, círculo con X). La elegida lleva el borde en su color.
- v1.85: la tarjeta elegida (Todos / Stock bajo / Agotados) ya no lleva el contorno grueso: mantiene el borde fino de Inicio, un poco más marcado (55 %), y algo más de color en el degradado (16 %).
- v1.86: el Inventario usa la letra del resto del POS (Plus Jakarta Sans) también en cifras, SKU y precios, con números de ancho fijo; se quitó la carga de Public Sans y JetBrains Mono. Se quitó de la tarjeta de detalle del producto todo el bloque «Código de barras» (dibujo EAN-13 y botones Copiar código / Copiar SKU); el escáner y la búsqueda por código siguen igual.
  - Círculo de foco en la X: al abrirse una ventana sin que se hubiera tocado nada antes (p. ej. «¿Continuar venta?» al retomar un carrito, o la hoja de detalle del inventario), el foco iba a la X y Chrome la marcaba con el contorno. Ahora el foco va al primer campo (en la computadora, o el que pida [autofocus]) y, si no hay campo, a la propia ventana sin marco (ui.js abrirCapa). El teclado sigue funcionando: Tab entra a los botones y Escape cierra.
- v1.87 (aprobado con boceto): menos negrita en toda la app, con jerarquía: 400 texto y datos (los textos grises que estaban en 600 pasan a 400), 500 etiquetas/chips/texto resaltado, 600 nombres/botones/títulos de sección (antes 700), 700 cifras principales/títulos de ventana/saludo (antes 800); 800 ya no se usa; <b> y <strong> en 600.
  - Lineamiento de tarjetas de Apartados, Carrito e Inventario con los tamaños de «Stock, Comic Shop»: nombre 14,5/600 completo (sin «…», en varias líneas si hace falta), detalle 12,5/400, datos 12/400–500, cifra principal 14,5/600, foto 58 px, relleno 10×12, alto mínimo 68. Las líneas compactas del carrito muestran nombre y variante completos.
  - Inventario agrupado por prenda (como en Vender): 346 tarjetas en vez de 1.369. Tarjeta: nombre + color, «tela · Tallas …», «precio · género · N uds» (stock bajo si alguna talla está en el mínimo o agotada; agotado si no queda nada). Todos/Stock bajo/Agotados cuentan prendas. Detalle de la prenda: stock total, lista de tallas (cada una abre su hoja con Historial y Ajustar existencia), precios, ficha y acciones de la prenda (Oferta, Foto). La búsqueda encuentra la prenda si alguna talla coincide; el escáner abre la talla.
- v1.88: tarjeta de apartado en dos líneas (aprobada con boceto): «nombre | Abono | Saldo» y «fecha / Hace N días | monto | saldo»; «Abonado» pasa a «Abono»; abono y saldo pegados a la derecha con la divisoria continua. Los filtros (chips) de toda la app quedan como estaban pero con esquinas de 10 px, como los filtros del Inventario (el segmentado estilo Reportes del boceto no se aprobó). Géneros en Vender en el orden Unisex / Dama / Niño / Niña (otros después) y «Todo» al final, que sigue elegido al entrar. Fondo del Inventario en blanco, igual que el resto del POS.
- v1.89: tarjeta del Inventario rediseñada (aprobada con boceto): foto a la izquierda, nombre + color y «N unidades» debajo, pastilla de estado arriba a la derecha y precio abajo a la derecha. Las líneas del carrito usan la misma tarjeta (foto, nombre, variante, contador; tramo arriba y subtotal abajo a la derecha). La hoja del carrito no lleva título: solo la flecha, centrada.
  - Filtros del Inventario como chips del resto de la app; al pulsarlos abren un menú propio (ui.js abrirMenu) en vez de la lista gris del sistema. «A-Z» pasa a «Stock» y filtra por Todos / Stock bajo / Agotados. Las tarjetas Todos / Stock bajo / Agotados son solo informativas (sin ícono de fondo ni filtro). Se quitó la línea de conteo bajo los filtros; la última sincronización se ve en la ventana Sincronizar y al pasar el ratón por el botón (en el teléfono no se muestra).
  - El escáner de Vender es el mismo del Inventario (ícono y funcionamiento).
  - El detalle de un apartado se abre en la hoja inferior del Inventario, con la misma animación y gestos.
  - Bordes de chips/pastillas que no se veían completos: color de borde más firme y 3 px de aire arriba y abajo en las filas de filtros.
  - Usuarios: desplegar/plegar con la animación de la app de Pedidos (280 ms, filas escalonadas), uno abierto a la vez; los botones de la tarjeta ya no se salen.
  - «Modo prueba» ya no cambia a «activo». La vendedora y la encargada no pueden cambiar su PIN (solo el administrador). Inicio de la vendedora sin el botón «Abrir caja».
  - Modo demo simulado: al elegir un rol se hace una copia en memoria de los datos reales (crearSimulacion en memoria.js) con una sesión de ese rol; todo lo que se haga ahí se descarta al pulsar «Salir» o al cerrar sesión. La franja amarilla ya no lleva descripción.
- v1.90: las líneas del carrito vuelven al diseño de la v1.88 (el de la v1.89, igual al inventario, se rompía en el teléfono); se mantienen la hoja sin título y el escáner del Inventario. En Vender, «Todo» va primero en los géneros (y sigue elegido al entrar). Tarjeta de prenda sin tallas; el nombre largo sigue en una segunda línea. El círculo con las unidades en el carrito pasa arriba a la izquierda de la foto y cada toque resta una unidad (de la última talla agregada) hasta quitar la prenda; no abre las tallas. En la ventana de tallas la cantidad se puede escribir (máximo la existencia) y el contador tiene tres partes iguales de 48 px: − / cantidad / +.
- v1.91 (aprobado con boceto): el Inventario usa las Tarjetas listado de Vender (misma pieza, tarjetaPrenda en vender.js, sin el círculo del carrito): nombre, punto de color con «color · tela», «N disp.» (ámbar si alguna talla está en el mínimo o agotada) y precio. En la computadora caben 3 por fila porque no hay carrito al lado.
  - Inventario alineado al resto del POS (auditoría): espaciado de 12 px en el teléfono y 16 px en la computadora, a todo el ancho (ya no centrado a 1180 px); colores del POS en la vista y sus hojas; borde del buscador como los demás campos (#c4cad3); filtros como chips del POS (34 px, 13/600); letra base de 14 px.
  - Vocabulario: «Tarjetas listado» = prendas de la lista de Vender; «Tarjetas cobrar» = líneas dentro del carrito. Si no queda claro a cuál se refiere, preguntar antes.
  - Tarjetas cobrar (diseño v1.90): color, tela y talla como texto gris, sin pastilla; solo la tarifa queda en pastilla.
  - Tarjetas listado: el círculo con la cantidad pasa a un círculo con «−»; un toque quita la prenda del carrito con todas sus tallas (no abre las tallas). Sin el contorno verde que quedaba pegado tras tocar una tarjeta en el teléfono.
  - Ventana de tallas: la cantidad elegida sin fondo verde (blanco, número negro), también al escribirla.
  - Panel cobrar (hoja del carrito en el teléfono): barrita para arrastrar en vez de la flecha; se oculta arrastrando hacia abajo (desde la barrita o desde el contenido arriba del todo; un arrastre corto vuelve).
  - Todo el sistema: con una ventana, hoja o menú abierto (no las hojas no modales) la pantalla de abajo no se desplaza (html.con-capa: overflow oculto, overscroll-behavior none, sin «deslizar para actualizar»; el dedo sobre lo que no se desplaza no mueve el fondo; sin salto por la barra de desplazamiento en la computadora).
  - Contornos incompletos: se quitó la regla vieja W3 de Apartados (filtros 2 × 2) que borraba el borde derecho e inferior de algunos chips. Revisión con herramienta de bordes cortados en todas las pantallas, la ventana de tallas y la hoja del carrito: sin más casos.
- v1.92 (aprobado con boceto HTML; desde aquí los bocetos van siempre en HTML: elementos reales de la app con su CSS):
  - Doble contorno: los botones .pill con una pastilla adentro (fecha de Reportes, tasas de la barra superior) ya no llevan borde propio (la regla de material.css que forzaba borde en .pill ahora excluye los botones).
  - Tarjetas cobrar: nombre en una línea con «…»; sin la tela (color · talla); «Tarifa» pasa a «Precio» («Precio 1–5») y el precio por unidad («42.000 c/u») va al lado, no debajo del subtotal.
  - Barra del carrito (teléfono): parece el borde de una hoja (barrita, carrito con la cantidad, «Ver carrito», total y flecha hacia arriba); se abre al tocarla o deslizándola hacia arriba.
  - Panel cobrar: abre, se arrastra y cierra con el mismo mecanismo de la hoja del Inventario (transición de 340 ms; al soltar sigue desde donde quedó).
  - Búsqueda (js/nucleo/busqueda.js) en Vender, Inventario y Apartados: palabras en cualquier orden, sin tildes ni mayúsculas, palabras de 1–2 letras como comienzo de palabra (tallas), plurales, códigos sin guiones, teléfonos con 0 / +58 / espacios / guiones; Apartados también por la prenda. Todos los buscadores con lupa y × para borrar (y Esc).
  - Ventana de tallas: «Agregar al carrito» sin el contador de unidades.
  - Panel de prenda del Inventario: tallas sin SKU y sin tocarlas (la hoja de la talla se abre con su código: buscador + Enter o escáner).
  - Barra inferior: se esconde solo mientras el teclado está a la vista (visualViewport), no por tener un campo enfocado; antes quedaba oculta si se cerraba el teclado con «Atrás».
  - Filtros: el bloqueo de desplazamiento de la v1.91 ponía overflow oculto también en body y la cabecera fija del Inventario se salía de la pantalla al abrir un menú; ahora solo en html.
  - Apartados: resumen con el degradado de Inicio, ícono antes de «Por cobrar» y estado «ícono · cantidad · por revisar» (15 días o más; rojo con alerta o verde con ✓); en las tarjetas sin «Hace» en el contador de días.
- v1.93 (aprobado con boceto HTML): en el panel de la prenda del Inventario cada talla lleva dos botones pequeños: Ajustar existencia (tuerca; solo administrador y en la computadora, como antes) e Historial (reloj; quien ve costos, también en el teléfono). Abren sus ventanas sin abrir otra hoja. Desde aquí los bocetos HTML se entregan en el chat (archivo), sin crear artefactos, y no se ponen descripciones obvias en las pantallas.
- v1.94 (aprobado con boceto HTML en el chat; las correcciones finales sin boceto, a pedido):
  - Panel del carrito (teléfono): la barra de abajo es la cabecera del propio panel, de borde a borde, esquinas de arriba redondeadas, degradado verde crema como el resumen de Apartados y la flecha arriba al centro. Al tocarla o deslizarla hacia arriba el panel entero sube (no se abre otra hoja); al abrirse la cabecera se recoge con transición y queda solo la flecha; se baja con el dedo, Atrás, Esc o tocando el fondo.
  - Tarjetas cobrar: el subtotal en la línea base de «Precio 1–5 · c/u» (rejilla de 3 filas).
  - Ventana de tallas: sin «Selecciona las tallas»; se mantiene «N disponibles» y sin existencia dice «No hay» (antes «Agotada»).
  - Cobrar: el monto cabe en el campo (sin «COP» adentro, letra que baja si es largo); moneda (COP, USD, Bs) bajo el nombre, sin el equivalente en pesos; bote de basura al lado del campo para quitar la forma de pago.
  - Reportes: Ventas y Ganancia en dos columnas iguales con espacio, letra más chica desde 8 caracteres.
  - Calculadora de tasas: 40 px de aire al final.
  - Animaciones de todo el sistema un 30 % más cortas (hojas y paneles 240 ms, ventanas 130–180 ms, desplegables ~200 ms).
- v1.95: con el panel del carrito abierto la barra de íconos de abajo baja y se esconde; al ocultar el panel vuelve a subir con la misma transición (240 ms). El panel queda bajo la barra (z 19 < 20) y el fondo oscuro debajo de ambos, para que la barra entre por encima mientras el panel baja.
- v1.96 (aprobado con boceto HTML): en el teléfono, Vender muestra las Tarjetas listado en dos columnas con el diseño que dibujó Carlos: foto de 60 px (52 px en pantallas de menos de 380 px) y pastilla arriba, precio al pie de la foto (16 px desde 9 caracteres para no tocarla), nombre en 2 líneas como máximo con alto fijo y «…», «● color · tela» debajo con «…»; la agotada muestra el precio en gris; círculo «−» de 28 px con área de toque de 44 px. Inventario y computadora quedan igual. La tarjeta gris es la que ya está en el carrito (como antes).
- v1.97 (aprobado con boceto HTML; la computadora como la sugerí): Vender pasa a ser el carrito.
  - La pantalla empieza vacía: buscador + escáner y un solo botón «Todos los productos» (sin ilustración ni textos). Buscar, escanear o «Todos los productos» muestran la lista (Tarjetas listado alargadas de la v1.95, una columna) con los chips de género; al agregar una prenda la búsqueda se limpia, la lista se oculta y la línea nueva se resalta 1,6 s. La × del buscador cierra «Todos los productos».
  - Las prendas elegidas se ven como Tarjetas cobrar directo en la pantalla (ya no hay panel que se despliega ni hoja).
  - Teléfono: barra de cobro fija sobre la barra de íconos, de borde a borde, esquinas de arriba redondeadas y degradado verde crema (el estilo de la barra del carrito): total COP con USD y Bs, Cobrar, y debajo Descuento | Apartar. Solo aparece con prendas en el carrito; se esconde con el teclado.
  - Computadora: carrito a la izquierda y columna derecha con total grande, Cobrar a todo el ancho y Descuento | Apartar debajo. Sin prendas la columna no aparece.
  - Espaciado del sistema (regla para toda la app): 12 px entre bloques y a los bordes en el teléfono, 16 px en la computadora; bajo el buscador se aplica igual.
- v1.98 (auditoría de animaciones con el video de Carlos):
  - Vender (teléfono): la vista entra solo con fundido; antes el desplazamiento de la entrada hacía que la barra de cobro apareciera a media pantalla y luego saltara abajo. La barra ahora sube desde abajo (260 ms) al entrar, al agregar la primera prenda y al cerrar el teclado, y baja (200 ms) al vaciar el carrito.
  - Carrito: la prenda que se quita se desvanece y cierra su hueco (260 ms) en vez de desaparecer de golpe; el total sube con un fundido corto al cambiar.
  - «Todos los productos» / búsqueda: chips y tarjetas entran con fundido escalonado solo al abrir la lista (no en cada letra); el vacío y el carrito aparecen con fundido.
  - Inicio y Apartados: ya no muestran 0, «—», «Calculando costos…» ni «Todavía no hay apartados» mientras llegan los datos. La primera vez se ven bloques grises que respiran; al volver se muestra al instante lo último visto y se actualiza solo.
  - Todo respeta «reducir movimiento» del teléfono.
- v1.99 (aprobado con boceto HTML; los demás cambios a pedido, sin boceto):
  - Barra de cobro: total arriba a la derecha (con USD y Bs) y en una sola línea Descuento · Apartar · Cobrar (Cobrar más ancho). En la computadora la columna pasa de 330 a 360 px.
  - «Todos los productos» al centro del espacio libre de la pantalla.
  - Tarjetas cobrar: nombre sin el género («Franela AS»); el género va en la segunda línea con el color y la talla (también en las líneas compactas); el tramo en texto verde sin pastilla (la oferta en ámbar); «COP» del mismo color que el precio; el subtotal en la línea base del último texto de la izquierda (el tramo o el «c/u»).
  - Detalle del apartado: sin los recuadros del pago, las prendas y el último abono; barra de abonos en degradado verde (en toda la app); botones alineados a la derecha.
  - Detalle de la prenda (Inventario): sin el recuadro de stock; bajo el nombre «● color · tela» (sin «N tallas»); Ficha en dos columnas sin cajitas (Tipo, Género, Marca, Modelo, Código de imagen, Costo). El panel de cada talla queda igual.
  - Ajustes · Tasas: sin el aviso flotante de «Cambios sin guardar»; en su lugar un ícono de guardar (ámbar) a la derecha de «Peso colombiano» que aparece con cambios y guarda al tocarlo; más aire entre ese título y el campo. Binance (ámbar), BCV (azul) y Manual (violeta) con su color, como las formas de pago. En las otras pestañas el aviso sigue.
  - Comisión por prenda: sin textos de ejemplo dentro de los campos.
  - Recibo: si se agranda el recuadro del mensaje, la app recuerda el alto en ese aparato.
  - Buscador del Inventario con la misma letra y color de texto de ejemplo que los demás buscadores.
- v2.00 (aprobado con boceto HTML, 4 vueltas):
  - Ajustes: sin aviso flotante de «Cambios sin guardar» en ninguna pestaña. En Tasas, un ícono verde de guardar junto a «Peso colombiano» solo indica que hay cambios (sin recuadro ni acción). «Bs» con el mismo título que «Peso colombiano». Binance en verde (BCV azul, Manual violeta). Formas de pago activas en degradado de su moneda que se va a blanco hacia la derecha (70 %).
  - Calculadora: cabecera con el degradado verde crema; los recuadros igual. Al copiar ya no sale el aviso de la app (en Android quedaba doble con el del sistema): el ícono pasa a ✓ 1,4 s y se anuncia a lectores de pantalla.
  - Detalle del apartado: arriba igual (abonado y saldo centrados en su mitad, sin la línea antes de «Prendas»); el teléfono más grande abre el chat de WhatsApp del cliente. Prendas en filas con la cantidad en su cuadrito, el nombre corto y «color · tela · talla»; último abono en fila; «Ver historial» como fila tocable de 44 px.
  - Detalle de la prenda (Inventario): mismo sistema sin cajas y con secciones separadas por una línea; X de 44 px sin recuadro; Tallas con su total; precios en sus recuadros con el tramo real («1–5 prendas», «6–11»…); Ficha en dos columnas con el código de imagen y el costo en la misma letra que los demás datos.
  - Inicio: cada recuadro espera sus propios datos (ventas, costos, cajas y apartados) y mientras tanto muestra lo último que se vio o el gris que respira; ya no aparecen 0, «—» o montos que saltan y desaparecen.
  - Tarjetas listado sin cambios (boceto descartado).
  - Pastilla de tasas de arriba: «$ 3.900 / Bs 1.075» (barra en vez de punto).
  - Búsqueda sin lag: el texto de búsqueda de cada producto se prepara una sola vez; Vender guarda las tarjetas agrupadas y pinta primero 40 (luego «Mostrar más»); el Inventario reusa las prendas agrupadas y ya no espera 120 ms; si se escribe rápido solo se procesa la última letra de cada cuadro; los íconos se arman una vez y se copian; el navegador no dibuja las tarjetas fuera de pantalla.
  - Sin barras de desplazamiento visibles en todo el sistema.
  - Modo demo: sin la descripción ni la línea bajo el título.
  - Detalle del apartado: una sola línea entre filas y sin la línea sobre los botones.
- v2.01 (aprobado con boceto HTML):
  - Reportes: Hoy / Semana / Mes / Año (sin «7 días»; Año agrupa la gráfica por mes). Ventas y Ganancia con un solo tamaño (el reducido) en los 4 períodos. «Ver montos» / «Ver los N» como fila verde con flecha. Al cambiar de período el contenido entra con fundido, las barras crecen y se llenan (las piezas que no cambian se reusan para no reiniciar la animación).
  - Ventanas de Reportes rediseñadas (total arriba y filas con ícono o puesto, detalle, monto y barra): Ver montos, Más vendidos (tallas en cuadritos), Ventas (total, cantidad y ticket), Existencias bajas (nombre y debajo «talla · color · tela», existencia frente al mínimo), Valor del inventario (dos recuadros y la ganancia posible en verde) y Comisión por venta.
  - Detalle del apartado: los 3 botones siempre en una línea (también a 360 px).
  - Inventario: menú Género en orden Todos / Unisex / Dama / Niño / Niña; menú Marca con Etanol antes que Comic Shop.
  - Usuarios: «Eliminar» centrado.
  - Modo demo: vuelve la línea bajo el título de la ventana.
- v2.02: Reportes sin brincos al cambiar de período (video de Carlos). Antes se pintaba con las ventas («Ganancia 0 · calculando…»), otra vez al llegar los costos y otra al congelarlos; cada vez se reiniciaba la animación y había un cuadro en blanco. Ahora lo anterior queda atenuado mientras llegan ventas y costos (máx. 1,2 s) y se pinta una sola vez con la animación; las actualizaciones posteriores no la repiten.
- v2.03 (aprobado con bocetos HTML):
  - Tarjetas cobrar: el género vuelve al nombre («Franela AS Niño») y debajo color y talla sin la palabra «Talla» («Blanco · 6»).
  - Carrito: deslizar una prenda a la izquierda para quitarla, igual que en Pedidos (fondo rojo crema con papelera y «Quitar»; solo quita si el dedo llega casi al borde; «Deshacer» en el aviso). Funciona con dedo y con mouse.
  - Aviso de tramos: sin latido ni brillo; solo el ícono se mueve una vez y solo cuando cambia el tramo al que se llega.
  - Barra de cobro (propuesta A, mismo degradado): pastilla con las prendas, total a la derecha con USD y Bs; Descuento y Apartar como botones cuadrados con ícono y nombre; Cobrar grande con flecha y sombra verde.
  - Ajustes: sin el recuadro que encerraba cada pestaña; ritmo fijo (16 px bajo las pestañas, 20 px entre grupos, 8 px entre título y campo); «Redondeo del vuelto» en negrita. Tarjetas de Bs reorganizadas: círculo · nombre con fuente y hace cuánto · tasa a la derecha con «Bs por USD»; solo la elegida se abre para el recargo de Binance o la tasa manual (campos de 44 px).
  - Reportes: una sola escucha del año (desde el lunes si la semana empezó el año anterior); Hoy/Semana/Mes/Año se recortan de ahí y el cambio es instantáneo; barras de la gráfica más rápidas. Encabezado de Ver montos, Más vendidos y Ventas: tarjeta con degradado, la cifra principal y a la derecha dos datos que la lista no muestra (efectivo/digital; talla más vendida y prendas por venta; ventas y ticket), con la barra del reparto en Montos y Más vendidos.
- v2.04: en Vender, una prenda de una sola talla (o talla única) se agrega directo con un toque, sin la ventana de tallas; cada toque suma 1 y la cantidad se cambia con − y + en el carrito. Sin existencia avisa «No hay existencia» / «No hay más existencia». Con varias tallas sigue la ventana.
- v2.05: carrito plegado — color y talla bajan a una segunda línea bajo el nombre (sin el punto inicial); el monto queda sobre la línea base de esa segunda línea.
- v2.06: Descuento y Apartar pasan a la pantalla de cobro (sin encabezado ni flecha; se sale con atrás/Esc). Descuento fuera del recuadro verde; «Apartar» deja lo pagado como abono. Botón de cobro flotante con degradado: número, «prendas / en total» y el total con USD y Bs. «Faltan» en vez de «Falta». Bug: la zona táctil de la papelera tapaba el campo del monto y al tocarlo se quitaba la forma de pago (cobro, apartar, abonar, completar); corregido y con prueba. En el teléfono las formas de pago se quitan deslizando (sin papelera); el gesto vive en ui.js (deslizarParaQuitar) y lo comparten carrito y pagos. Tarjetas de prenda (Inventario y «Todos los productos») con una sola regla de diseño: color junto al nombre. «Todos los productos» se escribe en el buscador y la lista se quita solo al borrar la frase o con la ×. Ajustes: marco invisible, sin ícono de cambios, tasa Manual en una fila con su campo, redondeo del vuelto escrito a mano en COP y USD (vuelto en USD redondeado), sin título en Recibo, puntos rellenos en Pagos. Moneda junto a campos en la línea base del monto. Ícono en la cabecera de la Calculadora; «Cambiar tasas» abre la pestaña Tasas. Marca AS al final en Inventario. Al agregar al carrito el fondo se ilumina (sin contorno verde); quitar deslizando sin brinco y también en tarjetas desplegadas.
- v2.07: quitar deslizando ya no da un salto al final (el hueco se quedaba en el alto mínimo de la tarjeta y luego saltaba; ahora se cierra entero, con prueba). Sin resaltado verde al agregar o cambiar cantidades. En el teléfono, tocar un campo de número (monto de pago, cantidad de talla) pone el cursor al final en vez de seleccionar todo, para que no salga el menú Cortar/Copiar; en la computadora sigue seleccionando todo.
- v2.08: semáforo de existencias igual en toda la app (verde = hay, amarillo = stock bajo en el mínimo o menos, rojo = agotado): ventana de tallas, tarjetas de prenda, detalle del Inventario y existencias bajas de Reportes. La barra Vuelto ↔ Faltan del cobro cambia de alto y color con animación. «Deshacer» solo donde hace falta: quitar prenda del carrito (también con la papelera), quitar un pago con monto y quitar el descuento (pediría otra autorización).
- v2.09: regla de «separado» (columna de la Carga Masiva) definida por Carlos: esas prendas no suman al tramo de las demás ni reciben el suyo; van por su propia cantidad, contando juntas las tallas y colores del mismo producto (tipo+marca+género+modelo). El descuento solo se aplica y reparte sobre las prendas normales (no puede pasar su subtotal; la autorización se pide sobre ese subtotal); las «separado» no llevan descuento ni comisión reducida por él. La ventana de Descuento avisa cuántas prendas van aparte.
- v2.10: sin avisos de «Con N prendas más pasan a precio …» en el carrito (ni del mix ni de las «separado»; el cálculo avisosSeparado queda en el núcleo, sin usarse en pantalla). Botón de cobro sin «prendas / en total»: la cantidad va dentro de una camiseta blanca rellena.
- v2.11: círculo crema con cuántas prendas faltan para el próximo tramo (solo si faltan 3 o menos; normales juntas, cada «separado» aparte): en la tarjeta compacta junto a la talla y en la desplegada pegado a «Precio …», con «c/u» en su propia línea debajo. Punto ámbar en el ícono de Vender cuando hay prendas en el carrito y se está en otra pantalla.
- v2.12: el círculo de «faltan N» de la tarjeta desplegada se alinea por la línea base del tramo y sube 0,21 em: queda a media altura de las letras de «Precio …».
- v2.13: «¿Continuar venta?» → Continuar ahora lleva al carrito aunque la app se abra en otra pantalla (antes el «atrás» con que se cierra la ventana deshacía el cambio de pantalla; ahora se navega con despuesDeCerrar).
- v2.14: al tocar un campo de monto o texto se vacía para escribir el dato nuevo (el anterior queda en gris como guía). Si se sale sin escribir nada (otro toque, Enter o cerrar el teclado con «Atrás»), vuelve el dato anterior; si se escribió algo, aunque luego se borre todo, queda como se dejó. No aplica a buscadores, PIN, fechas, casillas, textos largos ni a la pantalla de entrada. Al cerrar el teclado con «Atrás» el campo suelta el foco.
- v2.15 (PC): Vender con el carrito como tabla y barra de cobro fija abajo (cliente F1 | total y Cobrar F9), «Todos los productos» junto al buscador; sin botón de escáner en la PC (el lector USB escribe en el buscador de Vender o Inventario aunque no esté enfocado). Barra izquierda con el perfil arriba y Vender verde sin nombre al centro. Tasas en dos pastillas (Peso | Bs con su fuente). Inventario: búsqueda y acciones arriba; pestañas Todos/Stock bajo/Agotados que filtran (con semáforo) y Género/Marca a la derecha. Detalles de prenda y de apartado anchos y en dos columnas (el estado del apartado alineado con la barra de abono). Caja en dos columnas. Ajustes a lo ancho y sin marco invisible: Tasas dos y dos, Venta con el redondeo en franja y tramos/comisión en dos columnas, Recibo con la vista previa a la derecha. Calculadora: una sola (el ícono la abre y la cierra), montos a la izquierda (también teléfono) y en Vender no tapa la barra de cobro. Inicio: Existencias bajas con semáforo y lleva al Inventario filtrado (también teléfono).
- v2.16: PC — detalles de prenda y apartado como ventana centrada (sin rayita de arrastre; Oferta y Subir foto en la cabecera). Inventario: búsqueda y acciones arriba; Género, Marca y luego Todos/Stock bajo/Agotados; prendas separadas por tipo. Filtros y opciones de arriba con una sola forma (la de Género/Marca) y el elegido en verde crema, en PC y teléfono. Tasas: pastillas «COP» y «Bs», cada una abre solo su tasa con «Cambiar tasas». Calendario de Reportes debajo del botón de fechas (el que sigue a Hoy/Semana/Mes/Año); Hoy/Semana/Mes/Año marcan el período completo (lunes–domingo, 1–último día, 1 ene–31 dic), también en el teléfono. Usuarios: lápiz sobre el avatar → foto con recorte libre y nombre (también teléfono; foto en barra lateral y Mi cuenta). Ajustes con tuerca. Ajustes/Venta: redondeos juntos a la izquierda con su título; Tramos y Comisión siempre abiertos. Ajustes/Tasas: peso compacto y las tres fuentes de Bs en una fila. Sin logo en Inicio (descartado).
- v2.17: chips de Inventario con la forma de Género/Marca; «Todos los productos» (PC) separado por tipo; Ajustes/Venta: Tramos y Comisión en la misma fila (PC); Guardar se apaga si todo vuelve a como estaba; redondeo en teléfono con un solo título; sin texto gris de ejemplo en los campos (tampoco el valor anterior al tocar); barra de cobro PC: «8 Prendas» grande (32/20 px) antes del total con línea, sin camiseta en el botón, Enter abre el cobro (F9 sigue); miniatura del carrito dentro de su recuadro; Usuarios: «Editar» dentro de la tarjeta (en PC todo en una fila, Desactivar y Eliminar a la derecha); Editar perfil igual en PC y teléfono (foto grande con lápiz); recorte en círculo con marco de esquinas en L; calculadora PC con Binance P2P y BCV (copiado de la Super Calculadora, mismo tasa.json).
- v2.18: calculadora PC como panel flotante a la derecha que entra deslizándose desde el borde, esquinas redondeadas, más compacta (Binance y BCV completos) y con tuerca a Ajustes › Tasas; calculadora del teléfono con solo las esquinas de arriba redondeadas; «N Prendas» sobre la línea base de USD·Bs; pastillas de tasas solo informativas (se quitó su ventana); detalle de prenda con miniatura de 76 px junto al nombre (la foto completa al tocarla); lápiz del perfil siempre blanco; recorte: la foto se achica a 1280 px y la ventana abre ya cargada (sin brinco).
- v2.19: aviso de versión nueva animado (entra desde abajo, ícono que gira cada 3 s, botón que late; al tocar, «Actualizando…» con giro continuo); el punto del carrito en la barra ya no brinca al cambiar de pantalla (solo anima cuando aparece).
- v2.20: calculadora PC del alto de su contenido (sin espacio blanco abajo).
- v2.21: la tuerca de la calculadora (a Ajustes › Tasas) también en el teléfono.
- v2.22: calculadora PC centrada a lo alto (pegada a la derecha); recorte de foto sin el menú copiar/descargar/compartir al mantener presionado. Lápiz del perfil con foto: reabre el recorte (de la foto original si se eligió en esa edición) y «Otra foto» abre la galería.
- v2.23: Ajustes en el teléfono con el contorno de cada sección otra vez (en la PC sigue sin marco).
- v2.24: Usuarios: la última tarjeta vuelve a tener su borde de abajo (lo quitaba una regla vieja de lista).
- v2.25: reporte de cierre de caja (se abre al tocar una caja cerrada): quién y cuándo, manual/automático y arqueo, resultado Sobrante/Faltante/Cuadró, tabla por forma de pago, resumen del día (fondo, ventas, prendas, anuladas, abonos, entradas, salidas), nota y envío por WhatsApp. La lista de cajas cerradas dice Sobrante/Faltante/Cuadró. Abonos y movimientos en USD/Bs se pasan a COP con la tasa actual (el esperado/contado/diferencia son los guardados al cerrar).
- Pendiente (auditoría, Bloque 3): la comisión reducida (por descuento u oferta) solo aplica a las prendas al detal (tramo 1-5); en los tramos al mayor se paga la normal. Hoy se reduce en cualquier tramo (nucleo/comisiones.js · comisionesVenta).
- Pendiente (auditoría, Bloque 3, N2): comisión con «piso»: en un tramo mayor la comisión del grupo (mix o producto «separado») nunca baja de la máxima del tramo anterior: piso = comisión del tramo anterior × (límite del tramo − 1) / cantidad; se reparte entre las líneas en proporción.
- Pendiente (auditoría, Bloque 3, M2): el cobro exige el monto exacto (pagado ≥ total); se quita la tolerancia de menos de medio redondeo (49 COP).
- Pendiente (auditoría, Bloque 3, M3 ampliado): vuelto mixto: dólares enteros (múltiplos del «billete más chico», por defecto 1 USD; reemplaza «Redondeo del vuelto en dólares») + el resto en pesos redondeado hacia abajo con el redondeo COP; opción «Todo en pesos»; la caja descuenta cada parte en su forma de efectivo. Pago en dólares en efectivo: sugerido en dólares enteros hacia arriba (Zelle/USDT con centavos).
- v2.26 (auditoría, Bloque 1): (C2) el id de la venta y del apartado va en el borrador del carrito antes de enviar, junto con los pagos escritos (M6); al volver de un apagón, si esa venta/apartado ya existe se avisa «ya se guardó» y se descarta el borrador, si no se retoma con el mismo id. (C1/H1) js/datos/pendientes.js: ventas, apartados, abonos y completar guardados sin confirmación del servidor se anotan en el aparato; al reconectar (al entrar, evento online y cada 2 min) se espera a que suba lo pendiente y se verifica en el servidor: lo rechazado → conflicto «rechazada»; venta/apartado sin internet que dejó existencia negativa → conflicto «inventario». Colección «conflictos» (reglas nuevas: crea quien lo tuvo, gestión lo marca revisado, nadie borra) y aviso en Inicio para gestión con la lista y «Revisado» + nota. Hay que publicar firestore.rules.
- v2.27 (auditoría, Bloque 2): registro de actividad en la colección «eventos» (js/datos/eventos.js describe cada acción; firebase.js lo escribe en la misma escritura que la acción, con hora del servidor, usuario, rol, aparato y versión; memoria.js igual en demo). Aparato: id propio + nombre editable (js/datos/dispositivo.js). Pantalla Reportes › Actividad (gestión) con filtros por tipo y persona. Reglas: eventos solo se crean (en == request.time) y solo gestión los lee; productos: no admin solo cambian existencia + ultimoMov y el movimiento creado en la misma escritura debe tener esa diferencia (H2); clientes no se borran y cada alta/cambio exige su evento (ultimoEvento). Orden de despliegue: actualizar todos los aparatos a v2.27 antes de publicar las reglas.
- v2.28: Comisiones en la barra lateral de la PC (entre Reportes y Usuarios, solo gestión); antes solo se llegaba desde «Más» del teléfono.
- v2.29: barra lateral de la PC con cada ícono en un recuadro degradado de su color (Inicio verde azulado, Apartados índigo, Inventario naranja, Caja verde, Reportes azul, Comisiones violeta, Usuarios rosa, Ajustes turquesa); la pantalla actual con el fondo gris de siempre. Cantidad escribible en las líneas del carrito (PC y teléfono) con las reglas de la ventana de tallas. Bug: al elegir una forma de pago en la PC el campo salía vacío (se vaciaba al enfocarlo la app); ahora el campo solo se vacía cuando la persona lo toca.
- v2.30: Cobrar en la PC: al elegir una forma de pago el monto ya no se enfoca ni se selecciona solo; al hacer clic se vacía como en el teléfono. Cantidad del carrito sin contorno al escribir. Teléfono: al abrir o cerrar el teclado el pie de Cobrar se desliza (FLIP con visualViewport) en vez de brincar, y el campo se centra suave.
- v2.31: PC: con cliente en el carrito, botones Cambiar (ventana vacía que reemplaza al cliente) y Quitar (con Deshacer). Modo prueba con vendedora simulada @prueba (usuario demo sin cuenta): ventas casi todas suyas, una caja por día de los últimos 14 (hoy abierta) con cierres que cuadran/sobran/faltan y abonos de apartados, apartados con abonos en días distintos, una semana de comisión pagada; ventas de ejemplo sin efectivo en dólares; precio y comisión por tramo real. Reglas: cajas y comisiones de ejemplo (demo:true) las crea/borra el administrador.
- v2.32: Modo prueba: si Firebase rechaza los ejemplos por permisos, el aviso dice que hay que publicar las reglas nuevas (antes solo «No se pudieron cargar»).
- v2.33: Modo prueba: antes de cargar se quitan los ejemplos que hubiera (de una carga anterior o a medias); las reglas no dejan reescribir ventas, apartados ni pagos de comisión existentes y eso hacía fallar la carga con «sin permiso».
- v2.34: a pedido de Carlos, el Modo prueba vuelve a como estaba en la v2.30 (sin vendedora simulada, cajas ni comisiones de ejemplo) y las reglas vuelven a las de la v2.27 (sin las reglas de cajas y comisiones de ejemplo). El resto de cambios (cliente en la PC, etc.) se mantiene.
