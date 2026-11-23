// Los cobros guardan el comprobante antes de enviar el lote. Los registros anteriores
// conservan su formato y se concilian con la lectura de los documentos originales.

export const LOCAL_PENDIENTE = 'local_pendiente';
export const CONFIRMADA_SERVIDOR = 'confirmada_servidor';
export const RECHAZADA_CONFLICTO = 'rechazada_conflicto';

const clave = usuario => 'pos-pendientes-' + (usuario || '');
const prefijo = usuario => 'pos-cobro-' + usuario + ':';
export const claveOperacion = p => p.que + ':' + p.id;
const claveCobro = (usuario, p) => prefijo(usuario) + claveOperacion(p);

export function leerCobro(usuario, p) {
  try { return JSON.parse(localStorage.getItem(claveCobro(usuario, p))); } catch { return null; }
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
    if (estadoSync === CONFIRMADA_SERVIDOR) localStorage.removeItem(claveCobro(usuario, p));
    else localStorage.setItem(claveCobro(usuario, p), JSON.stringify({ ...anterior, estadoSync }));
  } catch { /* el comprobante original sigue disponible para la conciliación */ }
}

function leerLegados(usuario) {
  try {
    const lista = JSON.parse(localStorage.getItem(clave(usuario)) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch { return []; }
}

export function leerPendientes(usuario) {
  const anteriores = leerLegados(usuario);
  const nuevos = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(prefijo(usuario))) continue;
      const p = JSON.parse(localStorage.getItem(k));
      if (p) nuevos.push(p);
    }
  } catch { /* quedan disponibles los pendientes ya leídos */ }
  return anteriores.concat(nuevos.sort((a, b) => a.orden - b.orden));
}
function escribir(usuario, lista) {
  try { if (lista.length) localStorage.setItem(clave(usuario), JSON.stringify(lista)); else localStorage.removeItem(clave(usuario)); } catch { /* sin almacenamiento */ }
}

// p: { que: 'venta'|'apartado'|'abono'|'completar', id, apartadoId?, abonoId?, offline, datos, resumen }
export function anotarPendiente(ctx, p) {
  const u = ctx.sesion?.usuario; if (!u) return;
  const lista = leerLegados(u).filter(x => !(x.que === p.que && x.id === p.id));
  lista.push({ ...p, anotado: new Date().toISOString() });
  escribir(u, lista);
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
  const lista = leerPendientes(u);
  if (!lista.length) return;
  revisando = true;
  try {
    if (!(await almacen.esperarSubidas()) || !mismaSesion()) return;
    for (const p of lista) {
      let r;
      try { r = await revisarUno(almacen, p, ctx.productos); } catch { return; } // sin conexión a mitad: se sigue luego
      if (!mismaSesion()) return;
      if (r !== 'ok') {
        const g = await almacen.registrarConflicto(r.conflicto);
        if (!g.ok || !mismaSesion()) return;
      }
      if (p.orden != null) resolverCobro(u, p, CONFIRMADA_SERVIDOR);
      else {
        const confirmado = JSON.stringify(p);
        escribir(u, leerLegados(u).filter(actual => JSON.stringify(actual) !== confirmado));
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
  setInterval(() => { if (ctx.sesion && leerPendientes(ctx.sesion.usuario).length) ir(); }, 2 * 60 * 1000);
  return ir;
}
