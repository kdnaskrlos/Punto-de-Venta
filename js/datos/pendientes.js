// Los cobros guardan el comprobante antes de enviar el lote. Los registros anteriores
// conservan su formato y se concilian con la lectura de los documentos originales.

export const LOCAL_PENDIENTE = 'local_pendiente';
export const CONFIRMADA_SERVIDOR = 'confirmada_servidor';
export const RECHAZADA_CONFLICTO = 'rechazada_conflicto';
export const VENTA_PROCESADA = 'venta-procesada-v1';
export const APARTADO_PROCESADO = 'apartado-procesado-v1';
export const cobroProcesado = p => [VENTA_PROCESADA, APARTADO_PROCESADO].includes(p.transporte);

const clave = (usuario, demo) => (demo ? 'pos-demo-pendientes-' : 'pos-pendientes-') + (usuario || '');
// Una versión anterior no debe interpretar una intención de venta como un lote rechazado.
const prefijos = { [VENTA_PROCESADA]: 'pos-venta-procesada-', [APARTADO_PROCESADO]: 'pos-apartado-procesado-' };
const prefijo = (usuario, transporte) => (prefijos[transporte] || 'pos-cobro-') + usuario + ':';
export const claveOperacion = p => p.que + ':' + p.id;
const claveCobro = (usuario, p) => prefijo(usuario, p.transporte) + claveOperacion(p);

export function leerCobro(usuario, p) {
  try {
    const directo = localStorage.getItem(claveCobro(usuario, p));
    const alterno = !p.transporte && localStorage.getItem(claveCobro(usuario, {
      ...p, transporte: p.que === 'venta' ? VENTA_PROCESADA : APARTADO_PROCESADO,
    }));
    return JSON.parse(directo || alterno || 'null');
  } catch { return null; }
}

export function guardarCobro(usuario, p) {
  const anterior = leerCobro(usuario, p);
  if (anterior) return anterior;
  const secuencia = 'pos-orden-cobro-' + usuario;
  const orden = (Number(localStorage.getItem(secuencia)) || 0) + 1;
  const cobro = { ...p, orden, anotado: new Date().toISOString(), estadoSync: LOCAL_PENDIENTE };
  localStorage.setItem(secuencia, String(orden));
  localStorage.setItem(claveCobro(usuario, cobro), JSON.stringify(cobro));
  return cobro;
}

export function resolverCobro(usuario, p, estadoSync) {
  const anterior = leerCobro(usuario, p);
  if (!anterior) return;
  try {
    const k = claveCobro(usuario, anterior);
    if (estadoSync === CONFIRMADA_SERVIDOR) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify({ ...anterior, estadoSync }));
  } catch { /* el comprobante original sigue disponible para la conciliación */ }
}

function leerLegados(usuario, demo) {
  try {
    const lista = JSON.parse(localStorage.getItem(clave(usuario, demo)) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch { return []; }
}

export function leerPendientes(usuario, demo = false) {
  const anteriores = leerLegados(usuario, demo);
  if (demo) return anteriores;
  const nuevos = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (![undefined, VENTA_PROCESADA, APARTADO_PROCESADO].some(t => k?.startsWith(prefijo(usuario, t)))) continue;
      const p = JSON.parse(localStorage.getItem(k));
      if (p) nuevos.push(p);
    }
  } catch { /* quedan disponibles los pendientes ya leídos */ }
  return anteriores.concat(nuevos.sort((a, b) => a.orden - b.orden));
}
export function proyectarApartados(documentos, cola, usuario) {
  const mapa = new Map(documentos.map(ap => [ap.id, ap]));
  for (const p of cola) {
    if (p.transporte !== APARTADO_PROCESADO || p.estadoSync !== LOCAL_PENDIENTE) continue;
    const ap = mapa.get(p.apartadoId);
    const d = p.datos;
    if (p.que === 'completar') {
      if (ap?.estado === 'pendiente') mapa.set(ap.id, { ...ap, saldo: 0, estado: 'completado', pendienteLocal: true });
      continue;
    }
    if (ap && (p.que === 'apartado' || ap.estado !== 'pendiente')) continue;
    if (!ap && p.que === 'abono') continue;
    const medios = d.pagos.map((pago, i) => ({ ...pago, id: p.id + '-' + i,
      cajaId: d.cajaId, fecha: d.fecha, usuario, operacionId: claveOperacion(p) }));
    const previos = ap?.abonos || [];
    if (previos.some(a => a.operacionId === claveOperacion(p) || medios.some(b => b.id === a.id))) continue;
    const saldo = (ap?.saldo ?? d.total) - medios.reduce((total, a) => total + a.equivalenteCop, 0);
    if (!Number.isSafeInteger(saldo) || saldo < 0) continue;
    mapa.set(p.apartadoId, { ...(ap || d), id: p.apartadoId, usuario: ap?.usuario ?? usuario,
      estado: 'pendiente', abonos: [...previos, ...medios], saldo, pendienteLocal: true });
  }
  return [...mapa.values()];
}

function escribir(usuario, lista, demo) {
  try { if (lista.length) localStorage.setItem(clave(usuario, demo), JSON.stringify(lista)); else localStorage.removeItem(clave(usuario, demo)); } catch { /* sin almacenamiento */ }
}

// p: { que: 'venta'|'apartado'|'abono'|'completar', id, apartadoId?, abonoId?, offline, datos, resumen }
export function anotarPendiente(ctx, p) {
  const u = ctx.sesion?.usuario; if (!u) return;
  const demo = !!ctx.almacen?.esDemostracion;
  const lista = leerLegados(u, demo).filter(x => !(x.que === p.que && x.id === p.id));
  lista.push({ ...p, anotado: new Date().toISOString() });
  escribir(u, lista, demo);
}

const resumenDe = d => ({
  cliente: d?.cliente?.nombre || '', telefono: d?.cliente?.telefono || '',
  total: d?.total ?? null, prendas: (d?.lineas || []).reduce((s, l) => s + (l.cantidad || 0), 0),
  pagos: (d?.pagos || d?.abonos || (d?.monto ? [d] : [])).map(p => ({ nombre: p.nombre || p.forma, moneda: p.moneda, monto: p.monto })),
});

// Revisa un pendiente contra el servidor. Devuelve: 'ok' | { conflicto } | 'esperar' (no se pudo saber todavía).
export async function revisarUno(almacen, p, productosPorSku = {}) {
  const v = (col, id) => almacen.verificarServidor(col, id);
  if (p.orden != null) {
    const estado = await almacen.verificarCobro(p);
    if (estado === CONFIRMADA_SERVIDOR || estado === RECHAZADA_CONFLICTO) return 'ok';
    if (cobroProcesado(p)) return 'esperar';
    return { conflicto: conflictoRechazo(p) };
  }
  let existe = false;
  if (p.que === 'venta') existe = !!(await v('ventas', p.id));
  else if (p.que === 'apartado') existe = !!(await v('apartados', p.id));
  else if (p.que === 'completar') existe = !!(await v('ventas', p.id));
  else if (p.que === 'abono') { const ap = await v('apartados', p.apartadoId); existe = !!ap?.abonos?.some(a => a.id === p.id); }
  if (!existe) return { conflicto: conflictoRechazo(p) };
  // H1: hecha sin internet y dejó existencias negativas.
  if (p.offline && (p.que === 'venta' || p.que === 'apartado')) {
    const negativos = [];
    for (const sku of [...new Set((p.datos?.lineas || []).map(l => l.sku))]) {
      const prod = (await v('productos', sku)) || productosPorSku[sku];
      if (prod && prod.existencia < 0) negativos.push({ sku, existencia: prod.existencia });
    }
    if (negativos.length) return { conflicto: { id: `inventario-${p.que}-${p.id}`, tipo: 'inventario', que: p.que, refId: p.id, fecha: p.datos?.fecha || p.anotado, negativos, resumen: p.resumen || resumenDe(p.datos), datos: p.datos || null } };
  }
  return 'ok';
}

function conflictoRechazo(p) {
  return { id: `rechazada-${p.que}-${p.id}`, tipo: 'rechazada', que: p.que, refId: p.id, apartadoId: p.apartadoId || null,
    fecha: p.datos?.fecha || p.anotado, resumen: p.resumen || resumenDe(p.datos), datos: p.datos || null,
    ...(p.orden != null ? { orden: p.orden, dispositivo: p.dispositivo } : {}) };
}

let revisando = false;
export async function revisarPendientes(ctx) {
  const u = ctx.sesion?.usuario, uid = ctx.sesion?.uid, almacen = ctx.almacen;
  const mismaSesion = () => ctx.sesion?.usuario === u && ctx.sesion?.uid === uid && ctx.almacen === almacen;
  if (revisando || !u || !almacen?.verificarServidor) return;
  const demo = !!almacen.esDemostracion;
  const lista = leerPendientes(u, demo);
  if (!lista.length) return;
  revisando = true;
  try {
    if (!(await almacen.esperarSubidas()) || !mismaSesion()) return;
    for (const p of lista) {
      let r;
      try { r = await revisarUno(almacen, p, ctx.productos); } catch { return; } // sin conexión a mitad: se sigue luego
      if (!mismaSesion()) return;
      if (r === 'esperar') continue;
      if (r !== 'ok') {
        const g = await almacen.registrarConflicto(r.conflicto);
        if (!g.ok || !mismaSesion()) return;
      }
      if (p.orden != null) resolverCobro(u, p, CONFIRMADA_SERVIDOR);
      else {
        const confirmado = JSON.stringify(p);
        escribir(u, leerLegados(u, demo).filter(actual => JSON.stringify(actual) !== confirmado), demo);
      }
    }
  } catch { /* espera o sesión interrumpida: se reintenta con los mismos IDs */ }
  finally { revisando = false; almacen.notificarCobros?.(); }
}

// Revisa al entrar, al volver la conexión y cada 2 minutos mientras haya pendientes.
export function vigilarPendientes(ctx) {
  const ir = () => revisarPendientes(ctx).catch(() => {});
  window.addEventListener('online', () => setTimeout(ir, 1500));
  window.addEventListener('pos:cobros-sync', ir);
  setInterval(() => { if (ctx.sesion && leerPendientes(ctx.sesion.usuario, !!ctx.almacen?.esDemostracion).length) ir(); }, 2 * 60 * 1000);
  return ir;
}
