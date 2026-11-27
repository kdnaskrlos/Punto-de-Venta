# Comic Shop | Lista maestra de escenarios comerciales

**Versión del catálogo:** 1.0 · 27 de noviembre de 2026
**Base del POS:** v2.43.2 oficial · 180 escenarios

Documento de planificación. Los escenarios 001–014 resumen el diagnóstico solicitado; 015–125 conservan las propuestas previas; 126–180 amplían Pedidos Personalizados y su integración. Los comportamientos esperados son propuestas sujetas a aprobación, no reglas ya aprobadas ni evidencia de implementación. Los puntos pueden solaparse intencionalmente: un mismo servicio podrá resolver varios de ellos.

**Prioridad orientativa:** C = crítica (integridad o pérdidas); A = alta (control comercial); M = media (gestión); F = futura (expansión). La prioridad no equivale al orden de ejecución: se respetarán las dependencias. En los puntos 001–014 se indica el estado del diagnóstico previo (I = implementado con posibles límites, P = parcial, N = no implementado según el requisito); los demás deben contrastarse con el código antes de asignarles estado.

## Índice por categoría

- [01 · Precios, comisiones y núcleo financiero (001–014)](#cat-01)
- [02 · Ventas, precios y rentabilidad (015–022)](#cat-02)
- [03 · Inventario y mercancía (023–035)](#cat-03)
- [04 · Comisiones y vendedores (036–045)](#cat-04)
- [05 · Cambios, devoluciones y garantías (046–054)](#cat-05)
- [06 · Apartados y reservas (055–063)](#cat-06)
- [07 · Cobros, caja y multimoneda (064–078)](#cat-07)
- [08 · Crédito y saldos a favor (079–089)](#cat-08)
- [09 · Proveedores y compras (090–097)](#cat-09)
- [10 · Seguridad y continuidad operativa (098–108)](#cat-10)
- [11 · Reportes y rentabilidad (109–117)](#cat-11)
- [12 · Tienda online y encargos: alcance previo (118–125)](#cat-12)
- [13 · Pedidos: cotización, captura y aprobación del diseño (126–137)](#cat-13)
- [14 · Pedidos: materiales, taller y producción (138–151)](#cat-14)
- [15 · Pedidos: anticipos, costos, comisiones y cancelaciones (152–163)](#cat-15)
- [16 · Pedidos: entrega y comunicación (164–171)](#cat-16)
- [17 · Integración de Pedidos con el POS (172–180)](#cat-17)

[Seguimiento de escenarios](#seguimiento-de-escenarios) · [Reglas comerciales](REGLAS_COMERCIALES.md) · [Plan maestro](PLAN_MAESTRO.md)

<a id="cat-01"></a>

## 01 · Precios, comisiones y núcleo financiero (001–014)

- <a id="esc-001"></a> **ESC-001** [A/I] **Cinco tramos de volumen:** recalcular precios por mix y grupos separados; validar límites exactos y configuraciones personalizadas.
- <a id="esc-002"></a> **ESC-002** [A/I] **Piso de comisiones:** evitar caídas al cruzar tramos para una composición comparable; revisar cambios de composición y fragmentación.
- <a id="esc-003"></a> **ESC-003** [A/N] **Ventas fragmentadas o agrupadas:** detectar tickets relacionados, justificar excepciones y consolidar comisiones sin sancionar compras independientes legítimas.
- <a id="esc-004"></a> **ESC-004** [A/N] **Reposiciones mayoristas:** vincular compras adicionales a un acuerdo abierto y aplicar condiciones de volumen; ajustar diferencias sin reescribir tickets.
- <a id="esc-005"></a> **ESC-005** [A/N] **Exclusión de liquidaciones:** distinguir ofertas, remates y promociones; excluir del volumen elegible y aplicar precio y comisión propios según política.
- <a id="esc-006"></a> **ESC-006** [A/P] **Carritos mixtos, descuentos y devoluciones:** separar reglas por línea, validar autorizaciones, recalcular volumen cuando proceda y ajustar comisiones.
- <a id="esc-007"></a> **ESC-007** [A/I] **Multimoneda y vuelto mixto:** aplicar tasas válidas, entregar USD físicos y COP, comprobar efectivo disponible y registrar redondeos y caja por medio.
- <a id="esc-008"></a> **ESC-008** [C/P] **Tasas en saldos y abonos:** usar la tasa aplicable a cada nuevo pago, conservar equivalentes históricos y confirmar abonos multimétodo atómicamente.
- <a id="esc-009"></a> **ESC-009** [A/P] **Comisión de apartados:** definir beneficiario, momento de devengo y liberación, ajustes por cancelación y reversión de comisiones ya pagadas.
- <a id="esc-010"></a> **ESC-010** [A/N] **Apartados vencidos y clientes fantasma:** avisar, prorrogar o liberar stock de forma segura y resolver abonos según política comunicada.
- <a id="esc-011"></a> **ESC-011** [A/N] **Encargos sin existencia física:** separar compromisos de producción de mercancía disponible; recibir anticipos y entregar sin crear stock negativo ficticio.
- <a id="esc-012"></a> **ESC-012** [C/I] **Offline e idempotencia:** conservar IDs estables, colas y comprobantes; reconciliar reintentos y conflictos; extender garantías a todos los flujos.
- <a id="esc-013"></a> **ESC-013** [C/P] **Auditoría inmutable:** exigir eventos sensibles con identidad, hora, antes/después y motivo; protegerlos de escrituras y borrados no autorizados.
- <a id="esc-014"></a> **ESC-014** [A/N] **Incumplimiento del volumen pactado:** recalcular tramo real y comisión con piso, descontar abonos, evaluar costos comprometidos y exigir autorización cuando proceda.

<a id="cat-02"></a>

## 02 · Ventas, precios y rentabilidad (015–022)

- <a id="esc-015"></a> **ESC-015** [A] **Venta bajo costo:** advertir o exigir autorización por margen negativo.
- <a id="esc-016"></a> **ESC-016** [A] **Descuentos acumulados:** determinar compatibilidad entre oferta, tramo y descuento manual.
- <a id="esc-017"></a> **ESC-017** [A] **Cambio de tarifa durante negociación:** conservar cotización vigente y condiciones pactadas.
- <a id="esc-018"></a> **ESC-018** [A] **Acantilado de precio total:** detectar cuando añadir unidades reduce el importe total; informar al administrador sin alterar automáticamente el tarifario.
- <a id="esc-019"></a> **ESC-019** [A] **Precio excepcional:** registrar precio negociado, autorización y justificación.
- <a id="esc-020"></a> **ESC-020** [M] **Cotizaciones:** convertir presupuestos en ventas, apartados o encargos sin duplicar operaciones.
- <a id="esc-021"></a> **ESC-021** [A] **Entrega parcial:** conservar cantidades entregadas y pendientes independientemente del pago.
- <a id="esc-022"></a> **ESC-022** [M] **Regalos y muestras:** registrar salidas sin ingreso y con costo y motivo.

<a id="cat-03"></a>

## 03 · Inventario y mercancía (023–035)

- <a id="esc-023"></a> **ESC-023** [A] **Mercancía dañada:** excluir del stock vendible y clasificar destino.
- <a id="esc-024"></a> **ESC-024** [A] **Pérdidas, hurtos o extravíos:** baja trazable con responsable y costo.
- <a id="esc-025"></a> **ESC-025** [C] **Diferencias de conteo físico:** comparar existencias y autorizar ajustes documentados.
- <a id="esc-026"></a> **ESC-026** [C] **Última unidad vendida simultáneamente:** confirmar una sola operación y conciliar el conflicto.
- <a id="esc-027"></a> **ESC-027** [A] **Devolución no vendible:** enviar a revisión, reparación o baja, no a disponibilidad automática.
- <a id="esc-028"></a> **ESC-028** [A] **Recepción parcial de compra:** incorporar solo unidades recibidas y aceptadas.
- <a id="esc-029"></a> **ESC-029** [A] **Cambios de costo:** valoración consistente y costo histórico de cada venta.
- <a id="esc-030"></a> **ESC-030** [M] **Producto agotado o descontinuado:** desactivar sin perder historial ni vínculos.
- <a id="esc-031"></a> **ESC-031** [M] **Mercancía en tránsito:** distinguir compra, recepción y disponibilidad.
- <a id="esc-032"></a> **ESC-032** [C] **Importación duplicada:** validar SKU, variantes y actualización de cantidades sin sobrescribir movimientos concurrentes.
- <a id="esc-033"></a> **ESC-033** [M] **Baja rotación:** identificar inventario inmovilizado y antigüedad.
- <a id="esc-034"></a> **ESC-034** [M] **Consumo interno:** registrar prendas para taller, muestras o uso del negocio.
- <a id="esc-035"></a> **ESC-035** [F] **Ubicaciones de inventario:** gestionar tienda, taller y almacén con transferencias si se aprueba cambiar el inventario único.

<a id="cat-04"></a>

## 04 · Comisiones y vendedores (036–045)

- <a id="esc-036"></a> **ESC-036** [M] **Venta compartida:** distribuir comisión entre vendedores con autorización.
- <a id="esc-037"></a> **ESC-037** [A] **Reasignación de vendedor:** conservar responsabilidad original y registrar cambios justificados.
- <a id="esc-038"></a> **ESC-038** [A] **Comisión pagada antes de anulación:** registrar compensación autorizada, no borrar liquidaciones.
- <a id="esc-039"></a> **ESC-039** [A] **Vendedor inactivo:** mantener consulta y pago de saldos históricos.
- <a id="esc-040"></a> **ESC-040** [A] **Cambios de comisión:** aplicar reglas desde su vigencia sin alterar operaciones anteriores.
- <a id="esc-041"></a> **ESC-041** [A] **Comisión superior al margen:** alertar sobre ventas cuya remuneración compromete rentabilidad.
- <a id="esc-042"></a> **ESC-042** [C] **Ventas falsas:** detectar indicios, investigar y registrar resolución sin asumir culpabilidad.
- <a id="esc-043"></a> **ESC-043** [M] **Bonificaciones:** separar incentivos por metas o campañas de comisión ordinaria.
- <a id="esc-044"></a> **ESC-044** [A] **Comisión a crédito:** definir devengo al entregar, cobrar o proporcionalmente según regla aprobada.
- <a id="esc-045"></a> **ESC-045** [A] **Liquidación disputada:** revisar diferencias y emitir ajustes sin repetir pagos.

<a id="cat-05"></a>

## 05 · Cambios, devoluciones y garantías (046–054)

- <a id="esc-046"></a> **ESC-046** [A] **Cambio de talla al mismo precio:** intercambiar existencias sin ingreso ficticio.
- <a id="esc-047"></a> **ESC-047** [A] **Cambio a producto más caro:** cobrar diferencia y ajustar inventario y comisión.
- <a id="esc-048"></a> **ESC-048** [A] **Cambio a producto más barato:** resolver diferencia por reintegro o saldo a favor autorizado.
- <a id="esc-049"></a> **ESC-049** [C] **Devoluciones sucesivas:** impedir devolver más unidades que las vendidas, incluso en operaciones concurrentes.
- <a id="esc-050"></a> **ESC-050** [A] **Devolución sin recibo:** localizar venta original o solicitar excepción autorizada.
- <a id="esc-051"></a> **ESC-051** [A] **Devolución de liquidación:** aplicar condiciones comunicadas y derechos que correspondan.
- <a id="esc-052"></a> **ESC-052** [M] **Defecto de fabricación:** registrar reclamo, evidencias, resolución y destino de la prenda.
- <a id="esc-053"></a> **ESC-053** [C] **Devolución tras cierre de caja:** registrar reintegro en caja correspondiente sin cambiar arqueos históricos.
- <a id="esc-054"></a> **ESC-054** [A] **Devolución con promoción por volumen:** recalcular condición elegible o documentar excepción.

<a id="cat-06"></a>

## 06 · Apartados y reservas (055–063)

- <a id="esc-055"></a> **ESC-055** [A] **Modificar prendas apartadas:** actualizar reservas y saldo en una operación autorizada.
- <a id="esc-056"></a> **ESC-056** [C] **Doble reserva:** impedir comprometer dos veces una unidad física.
- <a id="esc-057"></a> **ESC-057** [A] **Abono superior al saldo:** rechazar o resolver excedente expresamente.
- <a id="esc-058"></a> **ESC-058** [A] **Apartado pagado no retirado:** distinguir pago, reserva y entrega real.
- <a id="esc-059"></a> **ESC-059** [M] **Transferencia de titular:** conservar relación con cliente anterior, pagos y autorización.
- <a id="esc-060"></a> **ESC-060** [A] **Precio cambia durante apartado:** respetar vigencia y condiciones originales o renegociar.
- <a id="esc-061"></a> **ESC-061** [A] **Reactivar cancelación:** comprobar precios, stock y destino de abonos anteriores.
- <a id="esc-062"></a> **ESC-062** [M] **Apartados abandonados recurrentes:** mostrar historial y aplicar restricciones autorizadas.
- <a id="esc-063"></a> **ESC-063** [A] **Incumplimiento del negocio:** resolver reserva, devolución o compensación por falta de entrega.

<a id="cat-07"></a>

## 07 · Cobros, caja y multimoneda (064–078)

- <a id="esc-064"></a> **ESC-064** [C] **Pago electrónico pendiente:** separar pago reportado de fondos confirmados.
- <a id="esc-065"></a> **ESC-065** [C] **Comprobante falso o inválido:** comprobar fondos y evitar entrega injustificada; registrar incidencia.
- <a id="esc-066"></a> **ESC-066** [A] **Transferencia revertida:** registrar reversión y obligación pendiente.
- <a id="esc-067"></a> **ESC-067** [A] **Medio de pago equivocado:** corregir mediante movimientos vinculados, sin duplicar venta.
- <a id="esc-068"></a> **ESC-068** [A] **Efectivo insuficiente para vuelto:** validar disponibilidad por moneda y ofrecer alternativas autorizadas.
- <a id="esc-069"></a> **ESC-069** [C] **Pago duplicado:** detectar por referencia, importe y medio; conciliar antes de repetir.
- <a id="esc-070"></a> **ESC-070** [A] **Retiro del propietario:** separar retiro patrimonial de gasto e ingreso comercial.
- <a id="esc-071"></a> **ESC-071** [A] **Gastos desde caja:** clasificar, justificar y vincular comprobantes.
- <a id="esc-072"></a> **ESC-072** [A] **Transferencia entre cajas:** registrar origen y destino con un único identificador.
- <a id="esc-073"></a> **ESC-073** [A] **Cambio de divisas:** registrar ambas monedas, tasa y diferencia cambiaria sin generar ventas ficticias.
- <a id="esc-074"></a> **ESC-074** [C] **Faltante o sobrante de caja:** conciliar diferencias y registrar revisión.
- <a id="esc-075"></a> **ESC-075** [A] **Billete falso o deteriorado:** registrar incidencia y ajuste autorizado.
- <a id="esc-076"></a> **ESC-076** [M] **Comisión bancaria:** separar importe bruto, costo financiero y neto recibido.
- <a id="esc-077"></a> **ESC-077** [M] **Pago por tercero:** identificar pagador y cliente beneficiario sin duplicar cobro.
- <a id="esc-078"></a> **ESC-078** [A] **Reembolso en otra moneda:** conservar tasas del cobro y devolución y aplicar política aprobada.

<a id="cat-08"></a>

## 08 · Crédito y saldos a favor (079–089)

- <a id="esc-079"></a> **ESC-079** [A] **Límite de crédito:** validar cupo y exigir autorización excepcional.
- <a id="esc-080"></a> **ESC-080** [A] **Cliente moroso:** mostrar vencimientos y aplicar restricciones aprobadas.
- <a id="esc-081"></a> **ESC-081** [A] **Pago de varias deudas:** asignar abono entre obligaciones con distribución verificable.
- <a id="esc-082"></a> **ESC-082** [M] **Pago anticipado de crédito:** reducir saldo sin inventar descuentos.
- <a id="esc-083"></a> **ESC-083** [A] **Renegociación de deuda:** versionar condiciones y vencimientos.
- <a id="esc-084"></a> **ESC-084** [A] **Deuda incobrable:** registrar baja autorizada sin simular cobro.
- <a id="esc-085"></a> **ESC-085** [A] **Saldo a favor:** reutilizar crédito del cliente sin volver a contabilizar efectivo.
- <a id="esc-086"></a> **ESC-086** [C] **Abono de crédito erróneo:** reversar movimiento y restaurar saldo.
- <a id="esc-087"></a> **ESC-087** [C] **Créditos simultáneos:** comprobar cupo transaccionalmente.
- <a id="esc-088"></a> **ESC-088** [A] **Venta parcialmente a crédito:** separar ingreso efectivo, saldo financiado y comisión.
- <a id="esc-089"></a> **ESC-089** [M] **Estado de cuenta:** mostrar cargos, abonos, devoluciones y saldo conciliable.

<a id="cat-09"></a>

## 09 · Proveedores y compras (090–097)

- <a id="esc-090"></a> **ESC-090** [A] **Compra a crédito:** registrar inventario recibido y cuenta por pagar.
- <a id="esc-091"></a> **ESC-091** [A] **Anticipo a proveedor:** registrar desembolso sin aumentar inventario aún no recibido.
- <a id="esc-092"></a> **ESC-092** [A] **Devolución a proveedor:** descontar existencias y ajustar deuda o recuperación de dinero.
- <a id="esc-093"></a> **ESC-093** [A] **Costos adicionales de compra:** distribuir fletes y otros costos atribuibles entre unidades.
- <a id="esc-094"></a> **ESC-094** [A] **Discrepancias de recepción:** registrar faltantes, sobrantes o referencias incorrectas.
- <a id="esc-095"></a> **ESC-095** [C] **Factura duplicada:** validar referencia y proveedor antes de contabilizar.
- <a id="esc-096"></a> **ESC-096** [F] **Consignación:** distinguir propiedad de mercancía y obligación con proveedor.
- <a id="esc-097"></a> **ESC-097** [M] **Sugerencias de reposición:** estimar compras según demanda, stock y rotación.

<a id="cat-10"></a>

## 10 · Seguridad y continuidad operativa (098–108)

- <a id="esc-098"></a> **ESC-098** [C] **Edición de venta histórica:** impedir cambios directos y utilizar ajustes vinculados.
- <a id="esc-099"></a> **ESC-099** [A] **Reloj del dispositivo incorrecto:** conservar fecha declarada y hora de servidor.
- <a id="esc-100"></a> **ESC-100** [C] **Usuario desactivado estando offline:** revalidar identidad y conciliar operaciones pendientes.
- <a id="esc-101"></a> **ESC-101** [C] **Edición concurrente:** transacciones, versiones y detección de conflictos.
- <a id="esc-102"></a> **ESC-102** [A] **Dispositivo perdido o robado:** revocar acceso cuando sea posible y proteger datos locales e historial.
- <a id="esc-103"></a> **ESC-103** [C] **Caída de Firebase o internet:** resguardar operaciones y comunicar límites reales del modo offline.
- <a id="esc-104"></a> **ESC-104** [C] **Actualización con cobros pendientes:** proteger comprobantes, IDs, carritos y colas entre versiones.
- <a id="esc-105"></a> **ESC-105** [C] **Pérdida accidental de datos:** respaldos y restauración ensayada, incluyendo límites de datos locales.
- <a id="esc-106"></a> **ESC-106** [A] **Acción administrativa sensible:** confirmación adicional, motivo y auditoría obligatoria.
- <a id="esc-107"></a> **ESC-107** [A] **Exportación no autorizada:** restringir clientes, costos, ganancias y datos financieros por rol.
- <a id="esc-108"></a> **ESC-108** [M] **Costo inesperado de Firebase:** optimizar consultas, vigilar consumo y configurar alertas presupuestarias.

<a id="cat-11"></a>

## 11 · Reportes y rentabilidad (109–117)

- <a id="esc-109"></a> **ESC-109** [A] **Facturación alta con baja liquidez:** separar ventas, efectivo y cuentas por cobrar.
- <a id="esc-110"></a> **ESC-110** [A] **Ganancia sobreestimada:** descontar devoluciones, comisiones, costos y gastos pertinentes.
- <a id="esc-111"></a> **ESC-111** [A] **Fluctuación cambiaria:** distinguir margen comercial de diferencias de cambio.
- <a id="esc-112"></a> **ESC-112** [M] **Producto de alto volumen y bajo margen:** medir rentabilidad por SKU, categoría y tramo.
- <a id="esc-113"></a> **ESC-113** [M] **Cliente de baja rentabilidad:** considerar descuentos, devoluciones y costos atribuibles.
- <a id="esc-114"></a> **ESC-114** [A] **Anulaciones o descuentos atípicos por vendedor:** indicadores para revisión, no acusaciones automáticas.
- <a id="esc-115"></a> **ESC-115** [A] **Cierre mensual:** consolidar ventas, costos, gastos, comisiones, obligaciones e inventario.
- <a id="esc-116"></a> **ESC-116** [M] **Comparación de períodos:** analizar días, semanas, meses y temporadas.
- <a id="esc-117"></a> **ESC-117** [A] **Gastos personales mezclados:** separar retiros del propietario y gastos del negocio.

<a id="cat-12"></a>

## 12 · Tienda online y encargos: alcance previo (118–125)

- <a id="esc-118"></a> **ESC-118** [F] **Última unidad vendida online:** coordinar disponibilidad y reserva con tienda física.
- <a id="esc-119"></a> **ESC-119** [F] **Carrito online abandonado:** liberar reserva temporal según vencimiento.
- <a id="esc-120"></a> **ESC-120** [F] **Precios por canal:** aplicar políticas diferenciadas autorizadas.
- <a id="esc-121"></a> **ESC-121** [F] **Cambios en encargo personalizado:** versionar diseño, cantidades, costos y precio.
- <a id="esc-122"></a> **ESC-122** [F] **Producción defectuosa:** registrar desperdicio, reproceso y costo adicional.
- <a id="esc-123"></a> **ESC-123** [F] **Entrega tardía:** generar alertas y resolver compromisos o compensaciones.
- <a id="esc-124"></a> **ESC-124** [F] **Cancelación con fabricación iniciada:** resolver costos, materiales, prendas y anticipos según acuerdo.
- <a id="esc-125"></a> **ESC-125** [F] **Venta por WhatsApp:** convertir negociación en cotización, encargo o venta conservando origen.

<a id="cat-13"></a>

## 13 · Pedidos: cotización, captura y aprobación del diseño (126–137)

- <a id="esc-126"></a> **ESC-126** [A] **Personalizado vs. sublimación completa:** aplicar campos, costos, tallas, piezas y reglas específicos de cada modalidad sin mezclarlos.
- <a id="esc-127"></a> **ESC-127** [A] **Pedido con varias prendas y diseños:** agrupar por variante, técnica, diseño, talla y cantidad; conservar precio por línea y total.
- <a id="esc-128"></a> **ESC-128** [A] **Tallas, hormas y medidas especiales:** validar tabla, tipo de prenda y medidas acordadas; documentar excepciones antes de cortar.
- <a id="esc-129"></a> **ESC-129** [A] **Datos de personalización por unidad:** nombres, números, cargos u otros textos; detectar duplicados, campos faltantes y errores de asignación.
- <a id="esc-130"></a> **ESC-130** [A] **Cliente entrega prenda propia:** identificar propiedad, condición de recepción y custodia; no sumar al inventario propio ni cobrar prenda inexistente.
- <a id="esc-131"></a> **ESC-131** [A] **Precio de diseño y personalización:** separar prenda, diseño, impresión, extras y cargos de preparación según política.
- <a id="esc-132"></a> **ESC-132** [A] **Cotización con vigencia y mínimo de unidades:** congelar versión de condiciones, definir anticipo y mínimo; recotizar al cambiar alcance.
- <a id="esc-133"></a> **ESC-133** [A] **Revisión de diseño y correcciones:** conservar versiones, comentarios, costo de cambios y límites acordados.
- <a id="esc-134"></a> **ESC-134** [C] **Aprobación del arte antes de producir:** registrar quién aprobó, cuándo y qué versión exacta; bloquear fabricación si falta aprobación exigida.
- <a id="esc-135"></a> **ESC-135** [A] **Imagen o logo de mala calidad:** señalar resolución, bordes o formato insuficientes y obtener aprobación de resultado o reemplazo.
- <a id="esc-136"></a> **ESC-136** [A] **Cambio de arte tras aprobación:** generar nueva revisión, invalidar aprobación anterior cuando corresponda y evaluar material ya utilizado.
- <a id="esc-137"></a> **ESC-137** [A] **Pedido urgente:** registrar fecha prometida, recargo autorizado y capacidad disponible antes de aceptar.

<a id="cat-14"></a>

## 14 · Pedidos: materiales, taller y producción (138–151)

- <a id="esc-138"></a> **ESC-138** [C] **Reserva de prendas base:** vincular stock del POS al pedido sin vender dos veces; distinguir reserva, consumo y entrega.
- <a id="esc-139"></a> **ESC-139** [A] **Prenda base sin disponibilidad:** permitir encargo sujeto a compra o fabricación, con fecha estimada y sin inventario negativo.
- <a id="esc-140"></a> **ESC-140** [A] **Compra de insumos para un pedido:** vincular compras y anticipos a materiales específicos y registrar costo real.
- <a id="esc-141"></a> **ESC-141** [A] **Cálculo de materiales y piezas:** usar medidas, hormas, tallas, mangas y piezas para estimar tela, papel, tinta y otros insumos; conservar versión del cálculo.
- <a id="esc-142"></a> **ESC-142** [A] **Consumo real vs. estimado:** registrar diferencias y desperdicio; ajustar costo y disponibilidad sin duplicar consumo.
- <a id="esc-143"></a> **ESC-143** [A] **Material compartido entre pedidos:** distribuir consumo o costo con criterio consistente y trazable.
- <a id="esc-144"></a> **ESC-144** [A] **Cambio de proveedor o material:** validar sustitución, costo, plazo y conformidad del cliente cuando afecte especificación.
- <a id="esc-145"></a> **ESC-145** [A] **Asignación de tareas del taller:** registrar responsables, etapas y dependencias; distinguir diseño, impresión, corte, confección y control de calidad según modalidad.
- <a id="esc-146"></a> **ESC-146** [A] **Capacidad de producción insuficiente:** visualizar carga de trabajo, fechas y cuellos de botella; evitar promesas inviables.
- <a id="esc-147"></a> **ESC-147** [A] **Producción parcial por talla o diseño:** registrar cantidades terminadas, pendientes y rechazadas por línea, sin marcar listo todo el pedido.
- <a id="esc-148"></a> **ESC-148** [C] **Error en nombre, número, talla o diseño:** aislar unidades defectuosas, determinar causa y generar reposición sin doble descuento de stock.
- <a id="esc-149"></a> **ESC-149** [A] **Diferencias de color o acabado:** registrar muestras, tolerancias y aprobación; definir reproceso o compensación.
- <a id="esc-150"></a> **ESC-150** [A] **Reprocesos y prendas de reemplazo:** crear orden vinculada, controlar materiales, costo y responsabilidad sin simular una venta adicional.
- <a id="esc-151"></a> **ESC-151** [A] **Producción excedente o sobrantes:** decidir destino de unidades o materiales sobrantes; no incorporarlos automáticamente al stock vendible si son personalizados.

<a id="cat-15"></a>

## 15 · Pedidos: anticipos, costos, comisiones y cancelaciones (152–163)

- <a id="esc-152"></a> **ESC-152** [C] **Anticipo desde caja del POS:** confirmar un único cobro vinculado a pedido, cliente, caja, operador, moneda y tasa histórica; sin duplicar ingresos.
- <a id="esc-153"></a> **ESC-153** [C] **Saldo de pedido al entregar:** calcular total vigente menos anticipos confirmados, devoluciones y ajustes; impedir cobros repetidos.
- <a id="esc-154"></a> **ESC-154** [A] **Abono mínimo para iniciar producción:** definir porcentaje o monto, excepciones y autoridad; distinguir pago reportado de pago confirmado.
- <a id="esc-155"></a> **ESC-155** [A] **Modificación que aumenta precio:** registrar revisión del pedido, diferencia y aceptación; recalcular saldo sin alterar abonos previos.
- <a id="esc-156"></a> **ESC-156** [A] **Modificación que reduce precio:** aplicar escenario 014, evaluar costos comprometidos y resolver excedentes de abono.
- <a id="esc-157"></a> **ESC-157** [A] **Comisión en personalizados:** definir base (prenda, servicio o margen), responsable y devengo; evitar comisión doble por pedido y venta final.
- <a id="esc-158"></a> **ESC-158** [A] **Pedido mixto de tienda y taller:** separar líneas físicas y de fabricación, impuestos si aplican, costos, reservas y comisiones; permitir cobro consolidado conciliable.
- <a id="esc-159"></a> **ESC-159** [A] **Descuentos especiales en encargos:** verificar margen con materiales y mano de obra; autorización y evidencia.
- <a id="esc-160"></a> **ESC-160** [A] **Costo de mano de obra y subcontratación:** registrar costo estimado y real por actividad o pedido, separado del efectivo recibido.
- <a id="esc-161"></a> **ESC-161** [A] **Cancelación antes y después de producir:** aplicar condiciones previamente comunicadas y decidir reembolso, saldo a favor o compensación según costos y derechos aplicables.
- <a id="esc-162"></a> **ESC-162** [A] **Encargo entregado a crédito:** crear cuenta por cobrar vinculada y aplicar límites y política de comisión; no confundir con caja cobrada.
- <a id="esc-163"></a> **ESC-163** [A] **Garantía o compensación de personalizado:** resolver defecto, reposición, ajuste o reintegro sin duplicar cobro, comisión o consumo de inventario.

<a id="cat-16"></a>

## 16 · Pedidos: entrega y comunicación (164–171)

- <a id="esc-164"></a> **ESC-164** [A] **Pedido listo pero pendiente de cobro o retiro:** mantener estados financiero, producción y entrega independientes.
- <a id="esc-165"></a> **ESC-165** [A] **Entrega parcial:** emitir comprobante por cantidades entregadas, conservar pendientes y aplicar política de saldo y comisión.
- <a id="esc-166"></a> **ESC-166** [A] **Entrega a tercero:** registrar persona autorizada y confirmación de recepción cuando proceda.
- <a id="esc-167"></a> **ESC-167** [A] **Envío a domicilio o transportista:** registrar guía, costo, responsable, estado y eventual pérdida o devolución.
- <a id="esc-168"></a> **ESC-168** [A] **Pedido no retirado:** alertar, registrar intentos de contacto y aplicar política de custodia, abono y destino de prendas personalizadas.
- <a id="esc-169"></a> **ESC-169** [M] **Aviso de listo por WhatsApp:** generar mensaje con pedido y saldo correctos; distinguir mensaje preparado, enviado y confirmado cuando haya evidencia.
- <a id="esc-170"></a> **ESC-170** [A] **Notificaciones push:** informar cambios relevantes, asignaciones o vencimientos según preferencias; evitar avisos duplicados entre dispositivos y respetar permisos.
- <a id="esc-171"></a> **ESC-171** [M] **Resumen y comprobantes descargables:** conservar versión de prendas, cantidades, diseños, pagos, saldo y entrega; no exponer datos o imágenes innecesarios.

<a id="cat-17"></a>

## 17 · Integración de Pedidos con el POS (172–180)

- <a id="esc-172"></a> **ESC-172** [C] **Identidad única de cliente:** relacionar clientes y pedidos por identificador estable; conciliar teléfonos duplicados o cambiados sin fusionar personas erróneamente.
- <a id="esc-173"></a> **ESC-173** [C] **Usuarios y permisos comunes:** migrar roles admin, encargada y vendedora; impedir escalada de permisos y conservar autores históricos.
- <a id="esc-174"></a> **ESC-174** [C] **Migración de pedidos existentes:** inventariar IDs, estados, líneas, abonos, saldos e imágenes; preservar historia y reconciliar cantidades e importes antes del corte.
- <a id="esc-175"></a> **ESC-175** [C] **Migración de cobros anteriores:** identificar anticipos y saldos ya contabilizados; importar como antecedentes o movimientos conciliados sin ingresar efectivo por segunda vez.
- <a id="esc-176"></a> **ESC-176** [C] **Doble escritura durante integración:** definir fuente única de verdad, evitar sincronización circular y reintentos duplicados entre proyectos; cerrar rutas antiguas solo tras conciliar.
- <a id="esc-177"></a> **ESC-177** [C] **Adjuntos y artes de clientes:** migrar referencias y archivos de forma verificable; restringir acceso, proteger privacidad y evitar enlaces rotos.
- <a id="esc-178"></a> **ESC-178** [C] **Ediciones offline concurrentes de pedidos:** conservar revisiones, autor e IDs; detectar conflictos de cantidades, estado, diseño y pagos al sincronizar.
- <a id="esc-179"></a> **ESC-179** [C] **Corte y retiro de la app Pedidos:** respaldar, conciliar colas locales, verificar acceso a pedidos históricos, documentar reversión y retirar el sistema antiguo tras aprobación.
- <a id="esc-180"></a> **ESC-180** [A] **Reportes consolidados tienda/taller:** distinguir facturación, anticipos, entregas, saldos, margen por encargo, costo de fabricación y comisiones, sin doble contabilización.

## Criterios transversales y orden de desarrollo

- Conservar el POS oficial y su historial. No modificar ventas confirmadas silenciosamente: usar ajustes vinculados, autorizados e idempotentes.
- Separar estado comercial, financiero, de inventario, de producción y de entrega. Un pedido pagado no necesariamente está entregado; uno fabricado no necesariamente está cobrado.
- Mantener un registro único de cobros y movimientos, con tasas, precios, costos y reglas históricas. Validar operaciones sensibles en servidor; proteger permisos y auditoría.
- Evitar sobreingeniería: reutilizar motores de precios, cobros, comisiones, inventario y sincronización; los escenarios repetidos son criterios de un mismo módulo, no servicios separados.
- Orden propuesto: fase 2.0 integridad financiera y reglas comerciales; clientes; apartados y mayoristas; devoluciones y comisiones; crédito y compras; caja, inventario y reportes avanzados. Fase 3 tienda online. Fase 4 integración de Pedidos y taller. Anticipar contratos de datos comunes sin desplegar prematuramente la integración.
- Antes de implementar cada escenario: confirmar estado real, aprobar reglas y permisos, definir criterios de aceptación y casos borde, implementar de forma compatible, probar y publicar solo con autorización.

## Fuentes de contexto

- Conversación de diagnóstico de los 14 escenarios y ampliación a 125; los escenarios 126–180 son propuestas adicionales de planificación.
- POS: [especificación original de fases](https://github.com/kdnaskrlos/Punto-de-Venta/blob/main/docs/superpowers/specs/2026-11-12-punto-de-venta-fase1-design.md) y [notas de integración de Pedidos](https://github.com/kdnaskrlos/Punto-de-Venta/blob/main/docs/superpowers/specs/2026-11-14-pedidos-en-pos-notas.md).
- [App Pedidos Personalizados](https://github.com/kdnaskrlos/Pedidos-Personalizados): se verificó su descripción y fragmentos de su interfaz, incluyendo las modalidades Personalizado y Sublimación completa. No se realizó una auditoría exhaustiva de su código o datos de producción.
- Acuerdo histórico de integración: usuarios y roles comunes del POS; abonos y saldos por caja del POS; migración única de datos de Pedidos. La vigencia y alcance exacto de los permisos históricos se revisarán antes del corte. Las propuestas de este catálogo no autorizan eliminar registros ni modificar producción.

## Seguimiento de escenarios

Fuente inicial: adjunto `ESCENARIOS_COMERCIALES_POS.md` v1.0, aportado por el propietario el 27/11/2026. Registra aquí solo escenarios revisados o modificados y enlaza a su definición. Los 180 originales mantienen su prioridad orientativa. I/P/N en 001–014 corresponde al diagnóstico de origen. Hasta contrastar el alcance completo, el estado verificable del catálogo es **Por verificar** y las dependencias específicas quedan **Por definir**. El seguimiento posterior prevalece en el alcance que documente.

- Las aprobaciones se registran en [Reglas comerciales](REGLAS_COMERCIALES.md). En el seguimiento se indica la decisión vinculada si existe.
- Para cada revisión registra ID, módulo, estado (**Por verificar**, **Pendiente**, **En curso**, **Parcial**, **Implementado**, **Bloqueado**, **Reemplazado** o **Descartado**), prioridad, dependencias, fecha, cambio y evidencia. Registra fecha y autor de la decisión si se amplía, reemplaza o descarta un escenario.
- Si cambia el alcance de una definición, anota el cambio y enlaza la versión anterior en Git. Si se reemplaza, enlaza el sucesor en ambos sentidos. Conserva la definición histórica y su ancla, aun al dividir el catálogo. Próximo ID disponible **ESC-181**.

| Escenario | Módulo | Estado al 27/11/2026 | Prioridad | Dependencias | Referencia o evidencia y alcance |
| --- | --- | --- | --- | --- | --- |
| [ESC-001](#esc-001) | Precios | Por verificar | A | Configuración vigente | [Reglas de precios](../AGENTS.md#reglas-comerciales-vigentes) · [Tramos](../js/nucleo/tramos.js). Evidencia de código para tramos, mix y separados. |
| [ESC-002](#esc-002) | Comisiones | Por verificar | A | Tramos | [Acuerdo de auditoría](memoria/PENDIENTES.md#requisitos-aprobados) · [Cálculo del piso](../js/nucleo/comisiones.js). La protección contra fragmentación queda por verificar. |
| [ESC-007](#esc-007) | Cobro | Por verificar | A | Tasas, caja y medios | [Cálculo del vuelto](../js/nucleo/cobro.js) · [Validación de producción](ESTADO_ACTUAL.md). Verificar el alcance de la disponibilidad de efectivo. |
| [ESC-009](#esc-009) | Apartados | Por verificar | A | Atribución y reversión aprobadas | [Auditoría histórica](memoria/PENDIENTES.md#alcance-adicional-pendiente-de-confirmación). |
| [ESC-010](#esc-010) | Apartados | Por verificar | A | Política de vencimientos y abonos aprobada | [Decisiones comerciales abiertas](ESTADO_ACTUAL.md#reglas-comerciales-por-confirmar). |
| [ESC-012](#esc-012) | Sincronización | Por verificar | C | Identidad y transacciones | [Validación de producción](ESTADO_ACTUAL.md) · [Pruebas de cestas](../pruebas/firebase/cestas-atomicas.cjs). Evidencia para ventas, extensión a otros flujos por evaluar. |
| [ESC-038](#esc-038) | Comisiones | Por verificar | A | Política de compensación aprobada | [Auditoría histórica](memoria/PENDIENTES.md#alcance-adicional-pendiente-de-confirmación). |
| [ESC-039](#esc-039) | Comisiones | Por verificar | A | Permisos y liquidación | [Auditoría histórica](memoria/PENDIENTES.md#alcance-adicional-pendiente-de-confirmación). |
| [ESC-104](#esc-104) | PWA | Por verificar | C | Grafo versionado y colas locales | [Recuperación PWA](RECUPERACION-PWA.md) · [Pruebas de actualización](../pruebas/pwa/actualizacion.cjs). La limitación en v2.35 permanece documentada. |
| [ESC-152](#esc-152) | Pedidos | Por verificar | C | Integración de caja, identidad, reglas de anticipos | [Acuerdo histórico sobre Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md). |
| [ESC-172](#esc-172) | Clientes y Pedidos | Por verificar | C | Política de identidad y permisos | [Diseño del bloque Clientes](PLAN_MAESTRO.md#bloque-21-clientes). |
| [ESC-173](#esc-173) | Pedidos | Por verificar | C | Migración de usuarios y permisos | [Matriz histórica de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md). |
| [ESC-174](#esc-174) | Pedidos | Por verificar | C | Identidad y conciliación de datos | [Acuerdo histórico sobre Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md). |
