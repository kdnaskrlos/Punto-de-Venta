# Comic Shop | Lista maestra de escenarios comerciales

**Versión de la fuente original:** 1.0 · 27 de noviembre de 2026
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

[Clasificación y seguimiento](#clasificación-y-seguimiento) · [Reglas comerciales](REGLAS_COMERCIALES.md) · [Plan maestro](PLAN_MAESTRO.md)

<a id="cat-01"></a>

## 01 · Precios, comisiones y núcleo financiero (001–014)

[Clasificación y evidencia de esta categoría](#fichas-01)

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

[Clasificación y evidencia de esta categoría](#fichas-02)

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

[Clasificación y evidencia de esta categoría](#fichas-03)

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

[Clasificación y evidencia de esta categoría](#fichas-04)

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

[Clasificación y evidencia de esta categoría](#fichas-05)

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

[Clasificación y evidencia de esta categoría](#fichas-06)

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

[Clasificación y evidencia de esta categoría](#fichas-07)

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

[Clasificación y evidencia de esta categoría](#fichas-08)

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

[Clasificación y evidencia de esta categoría](#fichas-09)

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

[Clasificación y evidencia de esta categoría](#fichas-10)

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

[Clasificación y evidencia de esta categoría](#fichas-11)

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

[Clasificación y evidencia de esta categoría](#fichas-12)

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

[Clasificación y evidencia de esta categoría](#fichas-13)

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

[Clasificación y evidencia de esta categoría](#fichas-14)

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

[Clasificación y evidencia de esta categoría](#fichas-15)

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

[Clasificación y evidencia de esta categoría](#fichas-16)

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

[Clasificación y evidencia de esta categoría](#fichas-17)

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

## Clasificación y seguimiento

**Revisión de planificación del 27/11/2026.** Los nombres de bloque siguen el [plan maestro](PLAN_MAESTRO.md) vigente. La numeración y el orden propuesto en la fuente histórica se conservan arriba. El bloque es el destino principal del escenario. En fase 1 indica una capacidad de la base operativa v2.43.2 con el alcance observado. La evidencia bajo cada caso indica qué parte se comprobó y qué falta verificar. Los diagnósticos I/P/N de los escenarios 001–014 se conservan como antecedentes. Cada caso mantiene su prioridad original y el estado verificable **Por verificar** hasta que una revisión documente el alcance completo o actualice ese estado. La asignación de fase, las dependencias y el riesgo son propuestas de planificación y no aprueban comportamientos comerciales.

| Carácter | Consecuencia |
| --- | --- |
| **Bloqueante de entrada · 2.1** | Resolver solo la decisión o validación indicada para iniciar Clientes. |
| **Condicional · 2.0** | Trabajar únicamente sobre el flujo operativo afectado si una brecha concreta se confirma con evidencia. La entrada en Clientes se detiene solo si la brecha compromete la consulta segura o el uso sin escrituras de su ficha. |
| **Bloqueante del flujo propio** | Resolver sus dependencias antes de incorporar ese flujo. Los casos de fases posteriores no retrasan Clientes. |
| **No bloqueante** | Referencia operativa, mejora o criterio de aceptación que puede avanzar dentro de su propio alcance. |

[Plan maestro, bloques y mínimos de entrada a Clientes](PLAN_MAESTRO.md) · [Reglas comerciales aprobadas](REGLAS_COMERCIALES.md)

- [01 · Precios, comisiones y núcleo financiero (001–014)](#fichas-01)
- [02 · Ventas, precios y rentabilidad (015–022)](#fichas-02)
- [03 · Inventario y mercancía (023–035)](#fichas-03)
- [04 · Comisiones y vendedores (036–045)](#fichas-04)
- [05 · Cambios, devoluciones y garantías (046–054)](#fichas-05)
- [06 · Apartados y reservas (055–063)](#fichas-06)
- [07 · Cobros, caja y multimoneda (064–078)](#fichas-07)
- [08 · Crédito y saldos a favor (079–089)](#fichas-08)
- [09 · Proveedores y compras (090–097)](#fichas-09)
- [10 · Seguridad y continuidad operativa (098–108)](#fichas-10)
- [11 · Reportes y rentabilidad (109–117)](#fichas-11)
- [12 · Tienda online y encargos: alcance previo (118–125)](#fichas-12)
- [13 · Pedidos: cotización, captura y aprobación del diseño (126–137)](#fichas-13)
- [14 · Pedidos: materiales, taller y producción (138–151)](#fichas-14)
- [15 · Pedidos: anticipos, costos, comisiones y cancelaciones (152–163)](#fichas-15)
- [16 · Pedidos: entrega y comunicación (164–171)](#fichas-16)
- [17 · Integración de Pedidos con el POS (172–180)](#fichas-17)

<a id="fichas-01"></a>

### 01 · Precios, comisiones y núcleo financiero

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-001](#esc-001) | 1 | Núcleo operativo | Versión de tarifas, variantes y motor de tramos | Cinco tramos, mix y grupos separados vigentes | No bloqueante | Cambiar límites movería precios de ventas actuales | [Pruebas de tramos](../pruebas/nucleo/tramos.test.js) pruebas de límites y grupos |
| [ESC-002](#esc-002) | 1 | Núcleo operativo | Motor de tramos y cálculo por grupo | Piso por composición acordada | No bloqueante | Extender el piso a tickets distintos distorsionaría comisiones | [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) piso por grupo; fragmentación corresponde a ESC-003 |
| [ESC-003](#esc-003) | 2 | 2.3 · Acuerdos mayoristas | Identidad y vínculos entre tickets con auditoría | Definir compra independiente, acuerdo y excepciones | Bloqueante del flujo propio | Agrupar por cercanía o teléfono sancionaría ventas legítimas | [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) calcula por venta; sin consolidación verificada |
| [ESC-004](#esc-004) | 2 | 2.3 · Acuerdos mayoristas | Acuerdo versionado, tickets y ajustes vinculados | Vigencia, volumen elegible y reposición | Bloqueante del flujo propio | Reescribir precios o duplicar diferencias | Sin evidencia específica en la revisión documental |
| [ESC-005](#esc-005) | 2 | 2.3 · Acuerdos mayoristas | Etiquetas de oferta y elegibilidad por línea | Qué promociones cuentan para el volumen y la comisión | Bloqueante del flujo propio | Excluir descuentos válidos o cambiar precios del mix | [Descuentos](../pruebas/nucleo/descuento.test.js) controles actuales de oferta y descuento |
| [ESC-006](#esc-006) | 2 | 2.4 · Cambios, devoluciones y garantías | Detalle por línea, venta de origen y reversión | Cuándo recalcular descuentos, volumen y comisiones | Bloqueante del flujo propio | Aplicar dos veces un descuento o un ajuste | [Descuentos](../pruebas/nucleo/descuento.test.js) descuentos actuales; falta verificación de devoluciones parciales |
| [ESC-007](#esc-007) | 2 | 2.0 · Consolidación del núcleo | Tasas históricas y caja por medio | Vuelto mixto vigente y tratamiento del efectivo insuficiente | Condicional · 2.0 | Bloquear ventas válidas o mezclar unidades de distintas monedas | [Pruebas de cobro](../pruebas/nucleo/cobro.test.js) vuelto y redondeo; [Estado oficial](ESTADO_ACTUAL.md#evidencia-de-validación) validación operativa; disponibilidad por moneda por contrastar en ESC-068 |
| [ESC-008](#esc-008) | 2 | 2.0 · Consolidación del núcleo | Equivalentes históricos y registro transaccional de abonos | Conservar importes; acordar tasa de cada abono si el caso lo requiere | Condicional · 2.0 | Revalorar importes pasados o registrar un pago multimétodo a medias | [Flujo de apartados](../js/vistas/apartados.js) guarda cada medio por separado con ID fijo; [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) cubre marca y duplicados por abono; la atomicidad entre medios queda abierta |
| [ESC-009](#esc-009) | 2 | 2.5 · Comisiones avanzadas | Apartado, liquidación, abonos y movimientos de comisión | Beneficiario, devengo y reversión | Bloqueante del flujo propio | Pagar dos veces o atribuir al vendedor equivocado | [Auditoría y acuerdos históricos](memoria/PENDIENTES.md#alcance-adicional-pendiente-de-confirmación) antecedente de atribución; [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) resume la venta |
| [ESC-010](#esc-010) | 2 | 2.2 · Apartados avanzados | Vencimientos, reservas y trazabilidad de abonos | Prórroga, liberación y política de clientes fantasma | Bloqueante del flujo propio | Liberar stock o disponer de abonos sin autorización | [Decisiones comerciales abiertas](ESTADO_ACTUAL.md#reglas-comerciales-por-confirmar); [Flujo de apartados](../js/vistas/apartados.js) cancelación actual |
| [ESC-011](#esc-011) | 4 | Materiales y producción | Pedido de taller, capacidad y disponibilidad de stock | Distinguir encargo, venta y anticipo | Bloqueante del flujo propio | Crear stock negativo o comprometer producción inexistente | [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) antecedente de integración |
| [ESC-012](#esc-012) | 2 | 2.0 · Consolidación del núcleo | IDs, colas, transacciones y marcas del flujo existente | Conciliar reintentos y operaciones inciertas | Condicional · 2.0 | Cambiar identidad de una operación podría duplicar cobros | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) y [Estado oficial](ESTADO_ACTUAL.md#evidencia-de-validación) ventas atómicas; [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) protección de abonos; garantías por flujo |
| [ESC-013](#esc-013) | 2 | 2.0 · Consolidación del núcleo | Eventos protegidos y escrituras asociadas | Acciones sensibles vigentes, motivo y datos permitidos | Condicional · 2.0 | Exponer datos personales o romper clientes antiguos | [Reglas del repositorio](../firestore.rules) reglas de eventos; [Registro de actividad](../js/datos/eventos.js) tipos y campos actuales |
| [ESC-014](#esc-014) | 2 | 2.3 · Acuerdos mayoristas | Acuerdo, cantidades, abonos y ajustes de comisión | Incumplimiento, costos comprometidos y autorización | Bloqueante del flujo propio | Penalizar compras normales o cobrar diferencias retroactivas | Sin evidencia específica en la revisión documental |

<a id="fichas-02"></a>

### 02 · Ventas, precios y rentabilidad

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-015](#esc-015) | 2 | 2.3 · Acuerdos mayoristas | Costo histórico y validación de precio por línea | Margen mínimo, advertencia y rol autorizador | Bloqueante del flujo propio | Bloquear liquidaciones legítimas por costos ausentes o viejos | [Pruebas de costos](../pruebas/nucleo/costos.test.js) costo histórico; [Descuentos](../pruebas/nucleo/descuento.test.js) autorización de descuentos como antecedente |
| [ESC-016](#esc-016) | 2 | 2.3 · Acuerdos mayoristas | Motor de tramos, ofertas y descuentos | Qué rebajas se pueden acumular y en qué orden | Bloqueante del flujo propio | Aplicar rebajas incompatibles o cambiar precios ya acordados | [Descuentos](../pruebas/nucleo/descuento.test.js) alcance actual |
| [ESC-017](#esc-017) | 2 | 2.3 · Acuerdos mayoristas | Versiones de tarifa y cotización | Vigencia, moneda y renegociación | Bloqueante del flujo propio | Congelar precios sin vigencia aprobada | Sin evidencia específica en la revisión documental |
| [ESC-018](#esc-018) | 2 | 2.3 · Acuerdos mayoristas | Simulación de totales por cantidad y tramo | Umbral de alerta y destinatario | No bloqueante | Corregir automáticamente un tarifario intencional | [Pruebas de tramos](../pruebas/nucleo/tramos.test.js) cálculo de tramos; alerta sin evidencia específica |
| [ESC-019](#esc-019) | 2 | 2.3 · Acuerdos mayoristas | Precio por línea, identidad y evento de aprobación | Excepciones y justificación | Bloqueante del flujo propio | Abrir una vía para evadir el control de descuentos | [Descuentos](../pruebas/nucleo/descuento.test.js) autorización de descuentos como antecedente |
| [ESC-020](#esc-020) | 2 | 2.3 · Acuerdos mayoristas | Cotización versionada e ID de operación de destino | Vigencia y conversión a cada tipo de operación | Bloqueante del flujo propio | Consumir stock o duplicar cobros al convertir | Sin evidencia específica en la revisión documental |
| [ESC-021](#esc-021) | 2 | 2.3 · Acuerdos mayoristas | Cantidades comprometidas y entregadas por línea | Condición de entrega parcial y saldo | Bloqueante del flujo propio | Confundir entrega con cobro o liberar mercancía dos veces | Sin evidencia específica en la revisión documental |
| [ESC-022](#esc-022) | 2 | 2.9 · Inventario avanzado | Movimientos de salida, costo y motivo | Quién autoriza regalos y muestras | Bloqueante del flujo propio | Registrar una venta inexistente o esconder una pérdida | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) ajustes de inventario; salida clasificada aún sin evidencia específica |

<a id="fichas-03"></a>

### 03 · Inventario y mercancía

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-023](#esc-023) | 2 | 2.9 · Inventario avanzado | Estado de la unidad y stock vendible | Reparación, baja o revisión de daños | Bloqueante del flujo propio | Reponer al catálogo prendas no aptas | [Auditoría de inventario](AUDITORIA-BLOQUE-1.md#revisión-de-los-movimientos-de-inventario) movimientos existentes; clasificación de daños sin evidencia específica |
| [ESC-024](#esc-024) | 2 | 2.9 · Inventario avanzado | Bajas con actor, costo y motivo | Aprobación y manejo de pérdidas o extravíos | Bloqueante del flujo propio | Ocultar una diferencia mediante ajuste sin trazabilidad | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) permisos de ajuste; tratamiento específico por definir |
| [ESC-025](#esc-025) | 1 | Núcleo operativo | Conteo, eventos y ajuste por SKU | Ajuste autorizado por administración | No bloqueante | Sobrescribir existencias con conteos sin vigencia | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) ajustes y permisos; [Auditoría de inventario](AUDITORIA-BLOQUE-1.md#revisión-de-los-movimientos-de-inventario) historial previsto y observado |
| [ESC-026](#esc-026) | 1 | Núcleo operativo | Transacción de stock, ID y conflicto | Confirmar solo una venta de la última unidad | No bloqueante | Reemplazar una garantía comprobada con una comprobación de interfaz | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) concurrencia y rechazo; [Estado oficial](ESTADO_ACTUAL.md#evidencia-de-validación) recuperación de ventas |
| [ESC-027](#esc-027) | 2 | 2.4 · Cambios, devoluciones y garantías | Estado de devolución y stock vendible | Criterios de inspección y destino | Bloqueante del flujo propio | Incorporar prendas defectuosas antes de inspección | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) anulación y reposición; no cubre clasificación de devolución |
| [ESC-028](#esc-028) | 2 | 2.7 · Proveedores y compras | Orden, lotes de recepción y movimiento de inventario | Aceptar cantidades y registrar faltantes | Bloqueante del flujo propio | Sumar existencias por unidades aún no recibidas | Sin evidencia específica en la revisión documental |
| [ESC-029](#esc-029) | 1 | Núcleo operativo | Historial de costos y costo guardado en venta | Vigencia de costos históricos | No bloqueante | Recalcular márgenes de ventas antiguas | [Pruebas de costos](../pruebas/nucleo/costos.test.js) cálculo por fecha y costo de venta |
| [ESC-030](#esc-030) | 2 | 2.9 · Inventario avanzado | Estado del producto y referencias históricas | Cuándo ocultar, reactivar o descontinuar | No bloqueante | Perder vínculos de variantes o de comprobantes | Sin evidencia específica en la revisión documental |
| [ESC-031](#esc-031) | 2 | 2.7 · Proveedores y compras | Compra, recepciones y stock visible | Cuándo la mercancía pasa a disponible | Bloqueante del flujo propio | Ofrecer stock todavía en tránsito | Sin evidencia específica en la revisión documental |
| [ESC-032](#esc-032) | 2 | 2.0 · Consolidación del núcleo | SKU, guardas de importación y movimientos concurrentes | Límites para reemplazar cantidades y autorización de importación | Condicional · 2.0 | Sobrescribir una venta o duplicar existencias al importar | [Pruebas del importador](../pruebas/nucleo/importar.test.js) duplicados y vista previa; [Auditoría de inventario](AUDITORIA-BLOQUE-1.md#revisión-de-los-movimientos-de-inventario) garantías del flujo actual y sus límites |
| [ESC-033](#esc-033) | 2 | 2.9 · Inventario avanzado | Historial de stock, ventas y antigüedad | Umbral de baja rotación y período | No bloqueante | Confundir falta de datos con inventario inmovilizado | [Reportes actuales](../js/vistas/reportes.js) ranking de movimientos comerciales como antecedente |
| [ESC-034](#esc-034) | 2 | 2.9 · Inventario avanzado | Movimiento de consumo y costo imputado | Quién autoriza y a qué centro se asigna | Bloqueante del flujo propio | Simular ingresos o duplicar consumos del taller | Sin evidencia específica en la revisión documental |
| [ESC-035](#esc-035) | 2 | 2.9 · Inventario avanzado | Existencias por ubicación y traslados | Aprobación para sustituir inventario único | Bloqueante del flujo propio | Fragmentar stock o vender una unidad en dos ubicaciones | [Reglas comerciales vigentes](../AGENTS.md#reglas-comerciales-vigentes) regla vigente de inventario único |

<a id="fichas-04"></a>

### 04 · Comisiones y vendedores

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-036](#esc-036) | 2 | 2.5 · Comisiones avanzadas | Identificadores de vendedores y liquidaciones | Distribución y autoridad de reparto | Bloqueante del flujo propio | Devengar dos comisiones completas | [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) atribución ordinaria por vendedor |
| [ESC-037](#esc-037) | 2 | 2.5 · Comisiones avanzadas | Autor original, reasignación y evento | Autoridad, motivo y fecha efectiva | Bloqueante del flujo propio | Perder responsabilidad original o afectar pagos liquidados | [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) atribución actual por usuario de venta |
| [ESC-038](#esc-038) | 2 | 2.5 · Comisiones avanzadas | Anulación y ajuste contra liquidación pagada | Compensación y autorizador | Bloqueante del flujo propio | Borrar pagos anteriores o descontar dos veces | [Auditoría y acuerdos históricos](memoria/PENDIENTES.md#alcance-adicional-pendiente-de-confirmación) auditoría de compensación; [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) exclusión actual de anuladas |
| [ESC-039](#esc-039) | 2 | 2.5 · Comisiones avanzadas | Histórico de usuarios y saldo por vendedor | Consulta y pago a personas inactivas | No bloqueante | Perder saldos por filtrar identidades activas | [Auditoría y acuerdos históricos](memoria/PENDIENTES.md#alcance-adicional-pendiente-de-confirmación) auditoría de saldos de inactivos |
| [ESC-040](#esc-040) | 2 | 2.5 · Comisiones avanzadas | Importe persistido y reglas versionadas | Fecha efectiva y excepciones de transición | Bloqueante del flujo propio | Recalcular comisiones pagadas con una tarifa nueva | [Detalle de comisiones](../pruebas/e2e/comisiones-demo.cjs) detalle histórico usa importes guardados |
| [ESC-041](#esc-041) | 2 | 2.5 · Comisiones avanzadas | Costo histórico y comisión por línea | Qué margen dispara advertencia | No bloqueante | Alertar por costos incompletos o margen mal calculado | [Pruebas de costos](../pruebas/nucleo/costos.test.js) costos; [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) cálculo base |
| [ESC-042](#esc-042) | 2 | 2.5 · Comisiones avanzadas | Eventos de venta, ajustes y revisión | Indicios, investigación y derecho de aclaración | Bloqueante del flujo propio | Clasificar como fraude una venta válida | [Registro de actividad](../js/datos/eventos.js) eventos de actividad como insumo |
| [ESC-043](#esc-043) | 2 | 2.5 · Comisiones avanzadas | Registro de incentivos separado de liquidación | Metas, período, elegibilidad y pago | No bloqueante | Duplicar pagos o mezclarlos con comisión ordinaria | Sin evidencia específica en la revisión documental |
| [ESC-044](#esc-044) | 2 | 2.5 · Comisiones avanzadas | Obligaciones y cobros de ESC-088 | Devengo sobre entrega o pago y reversión | Bloqueante del flujo propio | Devengar comisión sobre importes incobrables | Sin evidencia específica en la revisión documental |
| [ESC-045](#esc-045) | 2 | 2.5 · Comisiones avanzadas | Pago previo, factura o evidencia y ajustes | Protocolo de revisión y autorización | Bloqueante del flujo propio | Pagar de nuevo la misma liquidación | [Detalle de comisiones](../pruebas/e2e/comisiones-demo.cjs) historial de liquidación; resolución de disputa sin evidencia específica |

<a id="fichas-05"></a>

### 05 · Cambios, devoluciones y garantías

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-046](#esc-046) | 2 | 2.4 · Cambios, devoluciones y garantías | Venta original, variantes y movimientos vinculados | Equivalencia de precio y ventana de cambio | Bloqueante del flujo propio | Crear ingreso ficticio o duplicar existencias | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) anulación completa como antecedente |
| [ESC-047](#esc-047) | 2 | 2.4 · Cambios, devoluciones y garantías | Cambio vinculado y cobro de diferencia | Precio aplicable y efecto en comisión | Bloqueante del flujo propio | Cobrar un ticket completo o pagar comisión doble | Sin evidencia específica en la revisión documental |
| [ESC-048](#esc-048) | 2 | 2.4 · Cambios, devoluciones y garantías | Reintegro o saldo a favor de ESC-085 | Medio, límites y política de diferencia | Bloqueante del flujo propio | Emitir crédito y devolución de efectivo por el mismo saldo | Sin evidencia específica en la revisión documental |
| [ESC-049](#esc-049) | 2 | 2.4 · Cambios, devoluciones y garantías | Cantidades devolubles por línea e idempotencia | Límite total por venta y autorizaciones | Bloqueante del flujo propio | Reembolsar más unidades de las vendidas | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) prueba de anulación repetida; devoluciones parciales sucesivas no verificadas |
| [ESC-050](#esc-050) | 2 | 2.4 · Cambios, devoluciones y garantías | Búsqueda fiable y coincidencia de venta | Prueba de compra o excepción autorizada | Bloqueante del flujo propio | Devolver un importe de la venta equivocada | Sin evidencia específica en la revisión documental |
| [ESC-051](#esc-051) | 2 | 2.4 · Cambios, devoluciones y garantías | Tipo de promoción y evidencia comunicada | Política de liquidación y garantías aplicables | Bloqueante del flujo propio | Aplicar restricciones retroactivas o indebidas | Sin evidencia específica en la revisión documental |
| [ESC-052](#esc-052) | 2 | 2.4 · Cambios, devoluciones y garantías | Reclamo, adjuntos y destino de prenda | Garantía, evidencia mínima y resolución | No bloqueante | Acumular datos innecesarios o reponer sin verificar defecto | Sin evidencia específica en la revisión documental |
| [ESC-053](#esc-053) | 2 | 2.4 · Cambios, devoluciones y garantías | Caja activa y movimiento ligado a venta | Origen del reintegro y cierre inmutable | Bloqueante del flujo propio | Cambiar arqueos históricos o registrar dos salidas | [Pruebas del núcleo de caja](../pruebas/nucleo/caja.test.js) anulación completa y esperado de caja; devolución parcial no verificada |
| [ESC-054](#esc-054) | 2 | 2.4 · Cambios, devoluciones y garantías | Líneas originales, motor de tramos y ajustes | Qué promoción recalcular y quién autoriza excepción | Bloqueante del flujo propio | Reescribir precios originales o recalcular dos veces | [Pruebas de tramos](../pruebas/nucleo/tramos.test.js) motor actual; reversión por volumen sin evidencia específica |

<a id="fichas-06"></a>

### 06 · Apartados y reservas

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-055](#esc-055) | 2 | 2.2 · Apartados avanzados | Reserva por SKU y actualización transaccional | Permisos, saldo, diferencias y vigencia | Bloqueante del flujo propio | Liberar o reservar unidades incorrectamente | [Flujo de apartados](../js/vistas/apartados.js) flujo actual sin evidencia de edición transaccional de prendas |
| [ESC-056](#esc-056) | 1 | Núcleo operativo | Guardas de movimientos y reserva de stock | Una reserva por unidad disponible | No bloqueante | Introducir una reserva paralela que ignore existencias | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) cobertura de reservas y movimientos; alcance de concurrencia de reserva no reensayado |
| [ESC-057](#esc-057) | 2 | 2.0 · Consolidación del núcleo | Saldo, marcas de cobro y transacciones | Límite vigente del saldo; excedente se define en su bloque | Condicional · 2.0 | Aceptar abonos superiores o convertir un excedente sin autorización | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) abonos y validación de saldo; [Reglas del repositorio](../firestore.rules) reglas de saldo |
| [ESC-058](#esc-058) | 2 | 2.2 · Apartados avanzados | Estados de pago, reserva y entrega diferenciados | Política de retención o retiro | Bloqueante del flujo propio | Interpretar pago total como entrega efectiva | [Flujo de apartados](../js/vistas/apartados.js) estados de apartado actuales |
| [ESC-059](#esc-059) | 2 | 2.2 · Apartados avanzados | Vínculo entre titulares e historial de pagos | Quién autoriza transferencia y cómo se acredita identidad | Bloqueante del flujo propio | Mostrar pagos de otra persona o perder trazabilidad | [Captura de clientes](../js/vistas/cliente.js) modelo actual por teléfono; transferencia sin evidencia |
| [ESC-060](#esc-060) | 2 | 2.2 · Apartados avanzados | Precio guardado por línea y versión del acuerdo | Respetar precio original o renegociar documentadamente | Bloqueante del flujo propio | Aplicar una tarifa nueva a un apartado anterior | [Flujo de apartados](../js/vistas/apartados.js) conserva total y saldo al completar; renegociación sin evidencia |
| [ESC-061](#esc-061) | 2 | 2.2 · Apartados avanzados | Operación original, stock y abonos reintegrados | Cuándo se reactiva y qué pasa con el dinero previo | Bloqueante del flujo propio | Restaurar stock y abonos dos veces | [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) cancelación y reglas actuales como antecedente |
| [ESC-062](#esc-062) | 2 | 2.2 · Apartados avanzados | Historial de apartados por identidad verificada | Reincidencia, avisos y restricciones autorizadas | No bloqueante | Atribuir abandonos a un homónimo o número compartido | Sin evidencia específica en la revisión documental |
| [ESC-063](#esc-063) | 2 | 2.2 · Apartados avanzados | Reserva, comprobante y compensación vinculada | Falta de entrega, reintegro o sustitución | Bloqueante del flujo propio | Dejar stock bloqueado o devolver dos veces | [Flujo de apartados](../js/vistas/apartados.js) cancelación vigente; compensación diferenciada sin evidencia |

<a id="fichas-07"></a>

### 07 · Cobros, caja y multimoneda

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-064](#esc-064) | 2 | 2.8 · Caja y gestión financiera avanzada | Estado electrónico y comprobación independiente | Cuándo se reconoce un pago informado como confirmado | Bloqueante del flujo propio | Entregar sin fondos o sumar caja antes de confirmar | [Pruebas de cobro](../pruebas/nucleo/cobro.test.js) medios actuales; conciliación electrónica sin evidencia específica |
| [ESC-065](#esc-065) | 2 | 2.8 · Caja y gestión financiera avanzada | Referencia, conciliación y registro de incidencias | Evidencia mínima y resolución antes de entregar | Bloqueante del flujo propio | Aceptar comprobantes apócrifos o marcar fraude sin prueba | Sin evidencia específica en la revisión documental |
| [ESC-066](#esc-066) | 2 | 2.8 · Caja y gestión financiera avanzada | Reverso vinculado y deuda o disputa | Quién registra reversión y política de recuperación | Bloqueante del flujo propio | Borrar ingresos históricos o cobrar dos veces | Sin evidencia específica en la revisión documental |
| [ESC-067](#esc-067) | 2 | 2.8 · Caja y gestión financiera avanzada | Movimiento compensatorio e ID de venta | Autorización y caja que registra la corrección | Bloqueante del flujo propio | Cambiar un comprobante confirmado o duplicar el cobro | [Reglas del repositorio](../firestore.rules) reglas de historial; compensación por medio aún sin evidencia |
| [ESC-068](#esc-068) | 2 | 2.0 · Consolidación del núcleo | Disponible por efectivo, medio y moneda | Alternativa cuando falta efectivo para vuelto vigente | Condicional · 2.0 | Bloquear cobros aun con efectivo suficiente o prometer vuelto inexistente | [Pruebas de cobro](../pruebas/nucleo/cobro.test.js) reparto mixto y [Pruebas del núcleo de caja](../pruebas/nucleo/caja.test.js) cálculo por medio; comprobar guardas de disponibilidad si hay una discrepancia reproducible |
| [ESC-069](#esc-069) | 2 | 2.0 · Consolidación del núcleo | IDs y conciliación de recibos de flujos operativos | Qué evidencia acredita un duplicado real | Condicional · 2.0 | Confundir pagos iguales e independientes o volver a contabilizar fondos | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) y [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) protegen IDs; deduplicación por referencia externa no verificada |
| [ESC-070](#esc-070) | 2 | 2.8 · Caja y gestión financiera avanzada | Tipos de movimiento y cuenta de origen | Qué retiro se clasifica como patrimonial y quién lo autoriza | Bloqueante del flujo propio | Alterar margen al mezclar retiro y gasto | [Flujo de caja](../js/vistas/caja.js) entradas y salidas genéricas |
| [ESC-071](#esc-071) | 2 | 2.8 · Caja y gestión financiera avanzada | Categoría, comprobante y motivo de movimiento | Gastos admisibles y autoridad | No bloqueante | Contar gastos dos veces o registrar salidas sin comprobante | [Flujo de caja](../js/vistas/caja.js) salida genérica; clasificación y adjunto por definir |
| [ESC-072](#esc-072) | 2 | 2.8 · Caja y gestión financiera avanzada | Movimiento espejo e ID común entre cajas | Roles y momento de recepción | Bloqueante del flujo propio | Dejar un ingreso sin contrapartida | Sin evidencia específica en la revisión documental |
| [ESC-073](#esc-073) | 2 | 2.8 · Caja y gestión financiera avanzada | Dos monedas, tasa y movimientos enlazados | Valoración de diferencia cambiaria | Bloqueante del flujo propio | Simular ventas o generar efectivo ficticio | [Flujo de caja](../js/vistas/caja.js) y [Tasas](../pruebas/nucleo/tasas.test.js) antecedentes de caja y tasas |
| [ESC-074](#esc-074) | 1 | Núcleo operativo | Arqueo contado y esperado | Cierre, motivo y revisión vigente | No bloqueante | Cambiar arqueos previos sin evidencia | [Pruebas del núcleo de caja](../pruebas/nucleo/caja.test.js) diferencias de caja y [Flujo de caja](../js/vistas/caja.js) pantalla de cierre |
| [ESC-075](#esc-075) | 2 | 2.8 · Caja y gestión financiera avanzada | Incidencia, medio y ajuste vinculado | Criterio de aceptación, reemplazo o baja | Bloqueante del flujo propio | Bajar caja sin verificación o castigar al operador equivocado | Sin evidencia específica en la revisión documental |
| [ESC-076](#esc-076) | 2 | 2.8 · Caja y gestión financiera avanzada | Conciliación del bruto, comisión y neto | Fecha y clasificación del costo bancario | No bloqueante | Contabilizar importe neto como venta bruta | Sin evidencia específica en la revisión documental |
| [ESC-077](#esc-077) | 2 | 2.8 · Caja y gestión financiera avanzada | Identidad de pagador y referencia a obligación | Datos y prueba del tercero autorizados | Bloqueante del flujo propio | Atribuir el cobro a otro cliente o revelar datos innecesarios | Sin evidencia específica en la revisión documental |
| [ESC-078](#esc-078) | 2 | 2.4 · Cambios, devoluciones y garantías | Tasa histórica del cobro y del reintegro | Moneda y tasa de devolución, autoridad | Bloqueante del flujo propio | Pagar diferencia cambiaria sin política o alterar el cobro | [Detalle de venta](../pruebas/e2e/detalle-venta.cjs) muestra datos históricos; no cubre nueva moneda de reintegro |

<a id="fichas-08"></a>

### 08 · Crédito y saldos a favor

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-079](#esc-079) | 2 | 2.6 · Créditos y cuentas por cobrar | Identidad, obligaciones y verificación transaccional | Cupo y autorización excepcional | Bloqueante del flujo propio | Financiar sin límite o con identidad equivocada | Sin evidencia específica en la revisión documental |
| [ESC-080](#esc-080) | 2 | 2.6 · Créditos y cuentas por cobrar | Fechas, estado de cuenta y pagos conciliados | Mora, aviso y restricciones autorizadas | Bloqueante del flujo propio | Bloquear ventas por un saldo incorrecto | Sin evidencia específica en la revisión documental |
| [ESC-081](#esc-081) | 2 | 2.6 · Créditos y cuentas por cobrar | Asignación de abono por deuda y movimiento único | Orden de aplicación y distribución | Bloqueante del flujo propio | Descontar un solo abono de varias deudas por su importe total | Sin evidencia específica en la revisión documental |
| [ESC-082](#esc-082) | 2 | 2.6 · Créditos y cuentas por cobrar | Libro de cargos y abonos con saldo | Adelanto, descuentos y cargos negociados | Bloqueante del flujo propio | Inventar un descuento o registrar un pago doble | Sin evidencia específica en la revisión documental |
| [ESC-083](#esc-083) | 2 | 2.6 · Créditos y cuentas por cobrar | Versiones del acuerdo y vencimientos previos | Condiciones, gracia y autorizador | Bloqueante del flujo propio | Perder antigüedad o reescribir obligaciones | Sin evidencia específica en la revisión documental |
| [ESC-084](#esc-084) | 2 | 2.6 · Créditos y cuentas por cobrar | Ajuste de baja con autorización | Criterio de incobrabilidad y aprobación | Bloqueante del flujo propio | Simular un ingreso al cancelar un saldo | Sin evidencia específica en la revisión documental |
| [ESC-085](#esc-085) | 2 | 2.6 · Créditos y cuentas por cobrar | Registro de saldo y consumo idempotente | Vigencia, uso y reembolso | Bloqueante del flujo propio | Confundir saldo a favor con efectivo nuevo | Sin evidencia específica en la revisión documental |
| [ESC-086](#esc-086) | 2 | 2.6 · Créditos y cuentas por cobrar | Reverso ligado al abono y al movimiento | Autoridad y manejo de períodos cerrados | Bloqueante del flujo propio | Restaurar saldo más de una vez | Sin evidencia específica en la revisión documental |
| [ESC-087](#esc-087) | 2 | 2.6 · Créditos y cuentas por cobrar | Transacción de cupo e IDs únicos | Límite aprobado compartido entre operadores | Bloqueante del flujo propio | Conceder crédito sobre el mismo cupo concurrentemente | Sin evidencia específica en la revisión documental |
| [ESC-088](#esc-088) | 2 | 2.6 · Créditos y cuentas por cobrar | Venta, cobro parcial, deuda y comisión | Cuándo se devenga comisión y cómo se divide el cobro | Bloqueante del flujo propio | Mostrar deuda como caja recaudada | Sin evidencia específica en la revisión documental |
| [ESC-089](#esc-089) | 2 | 2.6 · Créditos y cuentas por cobrar | Libro conciliado y cortes por fecha | Conceptos, saldo de apertura y visibilidad | Bloqueante del flujo propio | Mostrar sumas parciales como saldo oficial | Sin evidencia específica en la revisión documental |

<a id="fichas-09"></a>

### 09 · Proveedores y compras

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-090](#esc-090) | 2 | 2.7 · Proveedores y compras | Recepción, cuenta por pagar y movimiento | Reconocimiento de obligación y aceptación de mercancía | Bloqueante del flujo propio | Crear deuda o stock sin recepción | Sin evidencia específica en la revisión documental |
| [ESC-091](#esc-091) | 2 | 2.7 · Proveedores y compras | Referencia al proveedor, anticipo y conciliación | Autorización del desembolso y aplicación futura | Bloqueante del flujo propio | Sumar stock antes de recibir o descontar anticipo dos veces | Sin evidencia específica en la revisión documental |
| [ESC-092](#esc-092) | 2 | 2.7 · Proveedores y compras | Compra de origen, salida y saldo | Reembolso, nota de crédito y responsable | Bloqueante del flujo propio | Bajar stock sin ajustar deuda o duplicar recuperación | Sin evidencia específica en la revisión documental |
| [ESC-093](#esc-093) | 2 | 2.7 · Proveedores y compras | Prorrateo y costo histórico por unidad | Rubros atribuibles y base de distribución | Bloqueante del flujo propio | Recalcular costos previos o duplicar flete | [Pruebas de costos](../pruebas/nucleo/costos.test.js) historial de costos; prorrateo sin evidencia específica |
| [ESC-094](#esc-094) | 2 | 2.7 · Proveedores y compras | Orden, cantidades inspeccionadas y recepción | Resolución de sobrantes y faltantes | Bloqueante del flujo propio | Pagar o vender mercancía errónea | Sin evidencia específica en la revisión documental |
| [ESC-095](#esc-095) | 2 | 2.7 · Proveedores y compras | Clave proveedor, factura y deduplicación atómica | Qué referencias prueban una factura repetida | Bloqueante del flujo propio | Contabilizar dos veces o rechazar facturas legítimas | Sin evidencia específica en la revisión documental |
| [ESC-096](#esc-096) | 2 | 2.7 · Proveedores y compras | Registro de propiedad, existencias y liquidación | Condiciones de consignación y devolución | Bloqueante del flujo propio | Contar como propio stock de terceros | Sin evidencia específica en la revisión documental |
| [ESC-097](#esc-097) | 2 | 2.7 · Proveedores y compras | Demanda, existencias y mercancía en tránsito | Umbral y criterios para recomendar compras | No bloqueante | Comprar de más por omitir entradas en camino | [Reportes actuales](../js/vistas/reportes.js) indicadores básicos; no equivale a recomendación de compra |

<a id="fichas-10"></a>

### 10 · Seguridad y continuidad operativa

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-098](#esc-098) | 1 | Núcleo operativo | Comprobantes inmutables y ajustes vinculados | Campos autorizados, motivo y rol | No bloqueante | Reescribir importes o borrar historia al abrir la ficha | [Reglas del repositorio](../firestore.rules) reglas de ventas; [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) anulación autorizada; en 2.1 se reutiliza en modo consulta |
| [ESC-099](#esc-099) | 2 | 2.0 · Consolidación del núcleo | Fecha declarada y hora de servidor en rutas actuales | Fecha relevante para caja y conciliación | Condicional · 2.0 | Ordenar cobros por fecha incorrecta o moverlos a otro cierre | [Procesador de ventas](../funciones/ventas.cjs) validación de fecha; alcance de reloj incorrecto por flujo no verificado |
| [ESC-100](#esc-100) | 2 | 2.0 · Consolidación del núcleo | Sesión, rol revalidado y cola por identidad | Autorizaciones al reconectar y resolución de pendientes | Condicional · 2.0 | Descartar cobros legítimos o permitir escritura tras revocación | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) pruebas de perfil; [Persistencia de pendientes](../pruebas/datos/pendientes.test.js) conserva identidad y casos de cola; alcance por dispositivo sin confirmar |
| [ESC-101](#esc-101) | 2 | 2.0 · Consolidación del núcleo | Transacciones y conflictos en escrituras operativas | Quién resuelve conflictos y qué dato prevalece | Condicional · 2.0 | Sobrescribir saldos o stock con la última escritura | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) y [Pruebas de cobros y reglas](../pruebas/firebase/cobros.cjs) cubren flujos delimitados; no presuponen cobertura de ediciones futuras |
| [ESC-102](#esc-102) | 2 | 2.0 · Consolidación del núcleo | Sesión, revocación y almacenamiento local existente | Responsable y respuesta ante pérdida de dispositivo | Condicional · 2.0 | Borrar pendientes del dispositivo o asumir revocación offline inmediata | [Reglas del repositorio](../firestore.rules) exige cuenta activa en servidor; no demuestra control de una caché offline |
| [ESC-103](#esc-103) | 1 | Núcleo operativo | Persistencia, estados de cola y arranque PWA | Comunicar alcance offline y reconciliar al volver | No bloqueante | Prometer acceso a datos que el equipo nunca sincronizó | [Recuperación PWA](RECUPERACION-PWA.md) recuperación de caché; [Persistencia de pendientes](../pruebas/datos/pendientes.test.js) pendientes; [Estado oficial](ESTADO_ACTUAL.md#evidencia-de-validación) prueba operativa del propietario |
| [ESC-104](#esc-104) | 1 | Núcleo operativo | Grafo de versión, cola y borrador estable | Resguardar operaciones antes de cerrar clientes antiguos | No bloqueante | Perder carritos o mezclar recursos de versiones | [Recuperación PWA](RECUPERACION-PWA.md) prueba y limitación histórica v2.35; [Estado oficial](ESTADO_ACTUAL.md#evidencia-de-validación) publicación y retirada del piloto |
| [ESC-105](#esc-105) | 1 | Núcleo operativo | Respaldo remoto y recuperación local | Alcance, responsables y punto de restauración | No bloqueante | Tratar un respaldo remoto como copia de colas del navegador | [Estado oficial](ESTADO_ACTUAL.md#evidencia-de-validación) respaldo confirmado del 27/11/2026; no acredita un ensayo de restauración integral |
| [ESC-106](#esc-106) | 2 | 2.0 · Consolidación del núcleo | Permisos, confirmación, motivo y eventos vigentes | Inventario de acciones sensibles actuales | Condicional · 2.0 | Ampliar privilegios o registrar datos indebidos por una política genérica | [Reglas del repositorio](../firestore.rules) y [Registro de actividad](../js/datos/eventos.js) protegen acciones y eventos concretos; verificar solo cambios dirigidos |
| [ESC-107](#esc-107) | 2 | 2.1 · Clientes | Reglas de clientes, ventas y apartados; prueba por rol | Aprobar quién consulta historial y datos de contacto | Bloqueante de entrada · 2.1 | Exponer historial o contacto de terceros | [Reglas del repositorio](../firestore.rules) permisos actuales por colección; la ficha propone límites, la exportación se mantiene fuera |
| [ESC-108](#esc-108) | 2 | 2.1 · Clientes | Consultas limitadas por cliente, índices y caché | Cuántos resultados y qué se muestra offline | No bloqueante | Leer todas las ventas, aumentar costo o mostrar historial incompleto como vacío | [Almacén Firebase](../js/datos/firebase.js) contrato y lecturas actuales; consulta paginada de Clientes todavía por diseñar |

<a id="fichas-11"></a>

### 11 · Reportes y rentabilidad

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-109](#esc-109) | 2 | 2.10 · Reportes avanzados | Ventas, caja, deuda y estados conciliados | Definición de facturación, efectivo y cartera | Bloqueante del flujo propio | Presentar cuentas por cobrar futuras como liquidez real | [Reportes actuales](../js/vistas/reportes.js) reporte base; separar cartera depende de 2.6 |
| [ESC-110](#esc-110) | 2 | 2.10 · Reportes avanzados | Costos históricos, devoluciones, comisiones y gastos | Rubros que integran la ganancia neta | Bloqueante del flujo propio | Sobreestimar margen al omitir ajustes o imputarlos dos veces | [Reportes actuales](../js/vistas/reportes.js) y [Pruebas de costos](../pruebas/nucleo/costos.test.js) rentabilidad básica y costos |
| [ESC-111](#esc-111) | 2 | 2.10 · Reportes avanzados | Tasas históricas y operaciones de cambio | Método de diferencia cambiaria | No bloqueante | Confundir variación de tasa con ganancia comercial | [Tasas](../pruebas/nucleo/tasas.test.js) conversiones; atribución de diferencia depende de 2.8 |
| [ESC-112](#esc-112) | 2 | 2.10 · Reportes avanzados | Margen por línea, SKU y tramo | Criterio de volumen y margen bajo | No bloqueante | Rankear ventas con costo desconocido como rentables | [Reportes actuales](../js/vistas/reportes.js) más vendidos y [Pruebas de costos](../pruebas/nucleo/costos.test.js) costos históricos |
| [ESC-113](#esc-113) | 2 | 2.10 · Reportes avanzados | Identidad, márgenes y ajustes de venta | Qué gastos se atribuyen a un cliente | No bloqueante | Evaluar al cliente equivocado o sin devoluciones | Sin evidencia específica en la revisión documental |
| [ESC-114](#esc-114) | 2 | 2.10 · Reportes avanzados | Eventos, operador, descuentos y anulaciones | Indicador de revisión y umbrales | No bloqueante | Etiquetar a un vendedor como culpable por un indicador | [Registro de actividad](../js/datos/eventos.js) eventos de actividad; indicadores sin evidencia específica |
| [ESC-115](#esc-115) | 2 | 2.10 · Reportes avanzados | Caja, gastos, deuda, inventario y ajustes conciliados | Fecha de corte y alcance del cierre | Bloqueante del flujo propio | Cerrar un período con obligaciones omitidas | [Reportes actuales](../js/vistas/reportes.js) ventanas de reportes; cierre consolidado sin evidencia específica |
| [ESC-116](#esc-116) | 2 | 2.10 · Reportes avanzados | Períodos comparables y zona horaria estable | Comparaciones por temporada y período incompleto | No bloqueante | Comparar rangos desiguales como si fueran equivalentes | [Reportes actuales](../js/vistas/reportes.js) rangos actuales; comparativo avanzado sin evidencia |
| [ESC-117](#esc-117) | 2 | 2.8 · Caja y gestión financiera avanzada | Clasificación de movimientos y reporte | Qué es gasto personal, patrimonial o de negocio | Bloqueante del flujo propio | Reducir utilidad de negocio por retiros del propietario | [Flujo de caja](../js/vistas/caja.js) movimientos genéricos; comparte clasificación con ESC-070 y ESC-071 |

<a id="fichas-12"></a>

### 12 · Tienda online y encargos: alcance previo

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-118](#esc-118) | 3 | Tienda Online | Stock compartido y reserva transaccional entre canales | Prioridad, vigencia y conciliación de reservas | Bloqueante del flujo propio | Vender la última unidad en ambos canales | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) garantía en el POS; la garantía entre canales queda sin verificar |
| [ESC-119](#esc-119) | 3 | Tienda Online | Reserva online, expiración y liberación idempotente | Tiempo de retención y abandono | Bloqueante del flujo propio | Bloquear stock o liberar una reserva pagada | Sin evidencia específica en la revisión documental |
| [ESC-120](#esc-120) | 3 | Tienda Online | Tarifas versionadas y canal de venta | Precio, promociones y vigencia por canal | Bloqueante del flujo propio | Asumir distintas tarifas sin aprobación o alterar mostrador | [Pruebas de tramos](../pruebas/nucleo/tramos.test.js) tarifario actual del POS; canal online sin evidencia específica |
| [ESC-121](#esc-121) | 4 | Cotización y diseño | Pedido, diseño, cantidades y revisiones | Vigencia y aceptación de cambios | Bloqueante del flujo propio | Fabricar con una versión anterior del diseño | [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) antecedente de diseño de Pedidos |
| [ESC-122](#esc-122) | 4 | Materiales y producción | Consumos, defectos y orden de reproceso | Política de reparación, baja y costos | Bloqueante del flujo propio | Duplicar consumos o inventariar un defecto | Sin evidencia específica en la revisión documental |
| [ESC-123](#esc-123) | 4 | Entrega y comunicación | Compromiso de entrega y seguimiento | Avisos y compensación por retraso | No bloqueante | Prometer compensaciones sin autoridad | Sin evidencia específica en la revisión documental |
| [ESC-124](#esc-124) | 4 | Anticipos y costos | Producción empezada, materiales y anticipo | Política de cancelación y recuperación de costos | Bloqueante del flujo propio | Retener o devolver anticipos sin conocer lo producido | Sin evidencia específica en la revisión documental |
| [ESC-125](#esc-125) | 4 | Cotización y diseño | Identificación del canal, cotización y destino | Cuándo un acuerdo en WhatsApp es vinculante | Bloqueante del flujo propio | Crear pedidos o ventas duplicadas desde un mensaje | [Recibo por WhatsApp](../js/nucleo/recibo.js) recibo WhatsApp; conversión de negociación sin evidencia |

<a id="fichas-13"></a>

### 13 · Pedidos: cotización, captura y aprobación del diseño

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-126](#esc-126) | 4 | Cotización y diseño | Esquemas separados por modalidad | Qué campos y costos corresponden a cada modalidad | Bloqueante del flujo propio | Calcular piezas o personalización con reglas de otra modalidad | [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) antecedente; distinción observada en la descripción de la app |
| [ESC-127](#esc-127) | 4 | Cotización y diseño | Líneas por prenda, diseño y técnica | Agrupación y precio por línea aprobados | Bloqueante del flujo propio | Perder combinaciones válidas o duplicar cantidad | Sin evidencia específica en la revisión documental |
| [ESC-128](#esc-128) | 4 | Cotización y diseño | Tabla de tallas y medidas versionada | Validación, tolerancia y excepción antes de cortar | Bloqueante del flujo propio | Fabricar con medidas sin acuerdo | Sin evidencia específica en la revisión documental |
| [ESC-129](#esc-129) | 4 | Cotización y diseño | Datos por unidad e ID de asignación | Campos obligatorios, consentimiento si aplica y corrección | Bloqueante del flujo propio | Aplicar nombre o número a una unidad distinta | Sin evidencia específica en la revisión documental |
| [ESC-130](#esc-130) | 4 | Cotización y diseño | Registro de recepción y custodia por propietario | Condición, daño y tratamiento de la prenda aportada | Bloqueante del flujo propio | Sumar al stock prendas ajenas o cobrarlas | Sin evidencia específica en la revisión documental |
| [ESC-131](#esc-131) | 4 | Cotización y diseño | Sistema de partidas y costos por servicio | Tarifa de diseño, impresión y extras | Bloqueante del flujo propio | Ocultar extras o duplicar el precio de la prenda | Sin evidencia específica en la revisión documental |
| [ESC-132](#esc-132) | 4 | Cotización y diseño | Cotización, versión y mínimos | Vigencia, anticipo y causal de recotización | Bloqueante del flujo propio | Producir sin mínimo o cambiar condiciones ya aceptadas | Sin evidencia específica en la revisión documental |
| [ESC-133](#esc-133) | 4 | Cotización y diseño | Versiones de arte y registro de comentarios | Límites, costos y responsable de correcciones | Bloqueante del flujo propio | Perder la última aprobación o cobrar cambios no acordados | Sin evidencia específica en la revisión documental |
| [ESC-134](#esc-134) | 4 | Cotización y diseño | Versión de archivo aprobada y control previo a producción | Quién aprueba y cuándo se exige | Bloqueante del flujo propio | Fabricar con un diseño sin aprobación | Sin evidencia específica en la revisión documental |
| [ESC-135](#esc-135) | 4 | Cotización y diseño | Validación de archivo, resolución y evidencia | Calidad aceptable y aprobación del reemplazo | No bloqueante | Prometer un resultado que el insumo no permite | Sin evidencia específica en la revisión documental |
| [ESC-136](#esc-136) | 4 | Cotización y diseño | Historial de versiones, consumo y aprobación | Cuándo renovar aprobación y quién cubre materiales | Bloqueante del flujo propio | Fabricar con arte desactualizado o cargar costos improcedentes | Sin evidencia específica en la revisión documental |
| [ESC-137](#esc-137) | 4 | Cotización y diseño | Capacidad, plazo comprometido y recargo | Criterios de urgencia y autorización | Bloqueante del flujo propio | Aceptar plazos o precios inviables | Sin evidencia específica en la revisión documental |

<a id="fichas-14"></a>

### 14 · Pedidos: materiales, taller y producción

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-138](#esc-138) | 4 | Materiales y producción | Reserva compartida de stock y transacción por pedido | Liberación, consumo y asignación al taller | Bloqueante del flujo propio | Vender y reservar la misma prenda base | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) protege ventas POS; reserva de taller sin evidencia |
| [ESC-139](#esc-139) | 4 | Materiales y producción | Stock disponible, compra o fabricación proyectada | Aceptación condicionada y fecha estimada | Bloqueante del flujo propio | Prometer mercancía inexistente o forzar stock negativo | Sin evidencia específica en la revisión documental |
| [ESC-140](#esc-140) | 4 | Materiales y producción | Compras 2.7, insumos y anticipo enlazado | Autorización y atribución de costo | Bloqueante del flujo propio | Cargar el anticipo a dos pedidos | Sin evidencia específica en la revisión documental |
| [ESC-141](#esc-141) | 4 | Materiales y producción | Medidas, tallas, moldes y cálculo versionado | Criterios de estimación y pérdidas previstas | Bloqueante del flujo propio | Comprar o prometer con estimaciones erróneas | Sin evidencia específica en la revisión documental |
| [ESC-142](#esc-142) | 4 | Materiales y producción | Movimientos de consumo, desperdicio y costo real | Umbral de desvíos y aprobación | Bloqueante del flujo propio | Descontar dos veces al ajustar el consumo | Sin evidencia específica en la revisión documental |
| [ESC-143](#esc-143) | 4 | Materiales y producción | Insumo compartido y prorrateo rastreable | Base de distribución y redondeo | Bloqueante del flujo propio | Duplicar costos o perder existencias de insumo | Sin evidencia específica en la revisión documental |
| [ESC-144](#esc-144) | 4 | Materiales y producción | Versiones de insumo y proveedor; costo comparado | Cuándo se necesita aprobación del cliente | Bloqueante del flujo propio | Cambiar acabado o plazo sin conformidad | Sin evidencia específica en la revisión documental |
| [ESC-145](#esc-145) | 4 | Materiales y producción | Etapas, responsables y dependencias de taller | Roles y criterios de avance | No bloqueante | Asignar trabajo a una etapa o modalidad incorrecta | Sin evidencia específica en la revisión documental |
| [ESC-146](#esc-146) | 4 | Materiales y producción | Calendario de carga, recursos y pedido | Capacidad anunciada y prioridad | Bloqueante del flujo propio | Asumir más compromisos que los posibles | Sin evidencia específica en la revisión documental |
| [ESC-147](#esc-147) | 4 | Materiales y producción | Estado y cantidades por línea y variante | Criterio de terminado y rechazo | Bloqueante del flujo propio | Marcar todo listo con parte sin fabricar | Sin evidencia específica en la revisión documental |
| [ESC-148](#esc-148) | 4 | Materiales y producción | Trazabilidad por unidad, defecto y reposición | Responsable y autorización de reproceso | Bloqueante del flujo propio | Consumir stock dos veces o entregar una unidad errónea | Sin evidencia específica en la revisión documental |
| [ESC-149](#esc-149) | 4 | Materiales y producción | Muestras, tolerancias y evidencia de aprobación | Acordar acabado, reproceso y compensación | Bloqueante del flujo propio | Aceptar acabado fuera de especificación sin prueba | Sin evidencia específica en la revisión documental |
| [ESC-150](#esc-150) | 4 | Materiales y producción | Orden de reemplazo ligada a consumo anterior | Autoridad, costos y responsabilidad | Bloqueante del flujo propio | Crear una venta ficticia o duplicar stock descontado | Sin evidencia específica en la revisión documental |
| [ESC-151](#esc-151) | 4 | Materiales y producción | Salida de sobrantes y tipo de propiedad | Destino permitido de productos personalizados | Bloqueante del flujo propio | Ofrecer a terceros prendas personalizadas sin autorización | Sin evidencia específica en la revisión documental |

<a id="fichas-15"></a>

### 15 · Pedidos: anticipos, costos, comisiones y cancelaciones

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-152](#esc-152) | 4 | Anticipos y costos | Caja, IDs, conciliación y vínculo pedido-cliente | Medios, tasa y confirmación del anticipo | Bloqueante del flujo propio | Contabilizar el mismo anticipo en los dos sistemas | [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) acuerdo histórico; [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) evidencia limitada a ventas POS |
| [ESC-153](#esc-153) | 4 | Anticipos y costos | Total versionado y registro de anticipos, ajustes y reembolsos | Condición de saldo exigible antes de entregar | Bloqueante del flujo propio | Cobrar un saldo ya pagado | Sin evidencia específica en la revisión documental |
| [ESC-154](#esc-154) | 4 | Anticipos y costos | Estado del anticipo y evento de autorización | Monto mínimo, evidencia y excepción | Bloqueante del flujo propio | Iniciar producción con pago todavía sin confirmar | Sin evidencia específica en la revisión documental |
| [ESC-155](#esc-155) | 4 | Anticipos y costos | Revisión del pedido y vigencia de saldo | Aceptación expresa del incremento | Bloqueante del flujo propio | Aumentar deuda sin acuerdo o revalorar abonos pasados | Sin evidencia específica en la revisión documental |
| [ESC-156](#esc-156) | 4 | Anticipos y costos | Ajustes vinculados al cálculo de ESC-014 | Costos comprometidos y excedente de abono | Bloqueante del flujo propio | Acreditar un saldo a favor superior al comprobado | Sin evidencia específica en la revisión documental |
| [ESC-157](#esc-157) | 4 | Anticipos y costos | Comisión de 2.5 y vínculo con operación final | Base, responsable, devengo y exclusión de dobles comisiones | Bloqueante del flujo propio | Pagar comisión por pedido y por venta final | [Pruebas de comisiones](../pruebas/nucleo/comisiones.test.js) cálculo POS como antecedente |
| [ESC-158](#esc-158) | 4 | Anticipos y costos | Líneas separadas de inventario y fabricación, cobro común | Asignación de costos, reserva y comisión por línea | Bloqueante del flujo propio | Contar dos veces ingresos o vender mercancía reservada | Sin evidencia específica en la revisión documental |
| [ESC-159](#esc-159) | 4 | Anticipos y costos | Margen de fabricación y autorización | Tope de descuento y evidencia | Bloqueante del flujo propio | Autorizar precio por debajo de costos no medidos | [Descuentos](../pruebas/nucleo/descuento.test.js) control actual de descuentos en POS; no acredita taller |
| [ESC-160](#esc-160) | 4 | Anticipos y costos | Costos por actividad, orden y tercero | Imputación de mano de obra y subcontratos | No bloqueante | Confundir costo estimado con efectivo pagado | Sin evidencia específica en la revisión documental |
| [ESC-161](#esc-161) | 4 | Anticipos y costos | Estado de producción, consumos, anticipos y reverso | Condiciones de cancelación comunicadas y autorización | Bloqueante del flujo propio | Duplicar reintegro o retener importes sin acuerdo | Sin evidencia específica en la revisión documental |
| [ESC-162](#esc-162) | 4 | Anticipos y costos | Obligación de 2.6 y entrega independiente | Quién concede crédito y cómo devenga comisión | Bloqueante del flujo propio | Registrar como efectivo una entrega a crédito | Sin evidencia específica en la revisión documental |
| [ESC-163](#esc-163) | 4 | Anticipos y costos | Reclamo, orden de reposición y ajustes de caja e inventario | Garantía y compensación autorizadas | Bloqueante del flujo propio | Duplicar consumo, comisión o reintegro | Sin evidencia específica en la revisión documental |

<a id="fichas-16"></a>

### 16 · Pedidos: entrega y comunicación

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-164](#esc-164) | 4 | Entrega y comunicación | Estados separados de cobro, producción y entrega | Condición de retiro y autorización | Bloqueante del flujo propio | Marcar entregado o cobrado solo por estar listo | Sin evidencia específica en la revisión documental |
| [ESC-165](#esc-165) | 4 | Entrega y comunicación | Cantidades por línea, acta de entrega, saldo | Requisito de cobro y comisión proporcional | Bloqueante del flujo propio | Facturar o entregar dos veces la misma unidad | Sin evidencia específica en la revisión documental |
| [ESC-166](#esc-166) | 4 | Entrega y comunicación | Identificador de tercero y evidencia de recepción | Quién puede autorizar y qué datos se guardan | Bloqueante del flujo propio | Entregar a una persona no autorizada | Sin evidencia específica en la revisión documental |
| [ESC-167](#esc-167) | 4 | Entrega y comunicación | Envío enlazado, guía y estado de recepción | Quién asume costo, riesgo y devolución | Bloqueante del flujo propio | Dar por entregado un paquete perdido o cobrar envío dos veces | Sin evidencia específica en la revisión documental |
| [ESC-168](#esc-168) | 4 | Entrega y comunicación | Tiempos de custodia y registro de contacto | Política de abandono y anticipos | Bloqueante del flujo propio | Disponer de una prenda antes de vencer el plazo | Sin evidencia específica en la revisión documental |
| [ESC-169](#esc-169) | 4 | Entrega y comunicación | Plantilla de aviso, saldo actual y prueba de envío si existe | Canal, destinatario y consentimiento según alcance | No bloqueante | Mostrar como enviado un aviso solo preparado | [Recibo por WhatsApp](../js/nucleo/recibo.js) genera mensajes de recibo; no acredita estado del aviso de pedido |
| [ESC-170](#esc-170) | 4 | Entrega y comunicación | Suscripciones por dispositivo y deduplicación | Avisos consentidos y preferencias de destinatario | No bloqueante | Duplicar avisos o exponer datos en notificaciones | Sin evidencia específica en la revisión documental |
| [ESC-171](#esc-171) | 4 | Entrega y comunicación | Versión de comprobante y control de acceso | Campos descargables autorizados y su retención | Bloqueante del flujo propio | Filtrar diseños privados o difundir datos innecesarios | Sin evidencia específica en la revisión documental |

<a id="fichas-17"></a>

### 17 · Integración de Pedidos con el POS

| ID | Fase | Bloque | Dependencia técnica | Dependencia comercial | Carácter | Riesgo de adelantarlo | Evidencia existente y límites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ESC-172](#esc-172) | 4 | Integración y corte | En 2.1 coincidencia local revisable; en fase 4, ID intersistemas y conciliación | Aprobar teléfonos compartidos, cambiados o reasignados | Bloqueante de entrada · 2.1 | Fusionar personas o mostrar comprobantes de otra identidad | [Captura de clientes](../js/vistas/cliente.js) consulta por teléfono; [Almacén Firebase](../js/datos/firebase.js) guarda la clave por teléfono; [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) antecedente de integración; sin identidad común verificada |
| [ESC-173](#esc-173) | 4 | Integración y corte | Mapa de roles, cuentas y autores históricos | Quién conserva acceso y cómo se revoca | Bloqueante del flujo propio | Escalar privilegios o perder autoría de pedidos | [Reglas del repositorio](../firestore.rules) roles del POS; [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) matriz histórica de integración |
| [ESC-174](#esc-174) | 4 | Integración y corte | Inventario de fuentes, IDs, imágenes y ensayo de reconciliación | Qué datos migrar y criterio de aceptación del corte | Bloqueante del flujo propio | Perder historial o importar saldos incompatibles | [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) acuerdo histórico; sin evidencia de migración ejecutada |
| [ESC-175](#esc-175) | 4 | Integración y corte | Correspondencia de cobros por ID y conciliación | Qué cobros ya se contabilizaron | Bloqueante del flujo propio | Duplicar efectivo histórico | [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) antecedente sobre cobro por caja |
| [ESC-176](#esc-176) | 4 | Integración y corte | Fuente de verdad, IDs y escritura idempotente | Sistema autorizado para cada operación y fecha de corte | Bloqueante del flujo propio | Provocar sincronización circular o doble cobro | [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) idempotencia POS; integración entre sistemas sin evidencia |
| [ESC-177](#esc-177) | 4 | Integración y corte | Referencias, integridad de archivos y políticas de acceso | Datos y artes cuya migración está autorizada | Bloqueante del flujo propio | Exponer artes privados o romper vínculos | [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) antecedente de imágenes y migración |
| [ESC-178](#esc-178) | 4 | Integración y corte | Versiones, autores y conflictos offline por sección | Qué cambios requieren resolución explícita | Bloqueante del flujo propio | Sobrescribir pagos, cantidades o arte al reconectar | [Persistencia de pendientes](../pruebas/datos/pendientes.test.js) persistencia del POS; concurrencia de Pedidos sin evidencia |
| [ESC-179](#esc-179) | 4 | Integración y corte | Respaldo, colas conciliadas, prueba histórica y reversión | Aprobación explícita del corte y retiro | Bloqueante del flujo propio | Cerrar un origen con pedidos o cobros sin reconciliar | [Estado oficial](ESTADO_ACTUAL.md#evidencia-de-validación) precedente del POS; [Antecedente de Pedidos](superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) integración futura |
| [ESC-180](#esc-180) | 4 | Integración y corte | Reportes 2.10, costos de fabricación y cobros conciliados | Criterio de consolidación tienda/taller | Bloqueante del flujo propio | Sumar anticipo y factura como dos ingresos | [Reportes actuales](../js/vistas/reportes.js) reportes POS; consolidación de taller sin evidencia |

### Registro de revisiones posteriores

Añade aquí las revisiones con fecha, ID, estado, cambio, evidencia y alcance. Estados: **Por verificar**, **Pendiente**, **En curso**, **Parcial**, **Implementado**, **Bloqueado**, **Reemplazado** o **Descartado**. Si cambia el alcance, registra autor, motivo, versión anterior en Git y sucesor si existe. Conserva la definición y el ancla histórica aun al dividir el catálogo. Próximo ID disponible **ESC-181**.
