// v2.26 · Escrituras sin confirmar (C1 / H1 de la auditoría).
// Lo que se guardó en el aparato sin respuesta del servidor (ventas, apartados, abonos, completar) se anota aquí.
// Al reconectar se espera a que suba y se revisa en el servidor:
//   · si no está → el servidor lo rechazó → «Conflicto: rechazada» (el dinero se cobró pero el registro no existe);
//   · si es una venta/apartado hecho sin internet y dejó alguna prenda en negativo → «Conflicto de inventario».
// Los conflictos se guardan en Firebase (colección «conflictos») para que gestión los vea desde cualquier aparato.

const clave = (usuario, ambitoPrueba) => ambitoPrueba ? ambitoPrueba + ':pendientes' : 'pos-pendientes-' + (usuario || '');

export function leerPendientes(usuario, ambitoPrueba) {
  try { return JSON.parse(localStorage.getItem(clave(usuario, ambitoPrueba)) || '[]'); } catch { return []; }
}
function escribir(usuario, lista, ambitoPrueba) {
  const k = clave(usuario, ambitoPrueba);
  try { if (lista.length) localStorage.setItem(k, JSON.stringify(lista)); else localStorage.removeItem(k); } catch { /* sin almacenamiento */ }
}

// p: { que: 'venta'|'apartado'|'abono'|'completar', id, apartadoId?, abonoId?, offline, datos, resumen }
export function anotarPendiente(ctx, p) {
  const u = ctx.sesion?.usuario; if (!u) return;
  const lista = leerPendientes(u, ctx.ambitoPrueba).filter(x => !(x.que === p.que && x.id === p.id));
  lista.push({ ...p, anotado: new Date().toISOString() });
  escribir(u, lista, ctx.ambitoPrueba);
}

const resumenDe = d => ({
  cliente: d?.cliente?.nombre || '', telefono: d?.cliente?.telefono || '',
  total: d?.total ?? null, prendas: (d?.lineas || []).reduce((s, l) => s + (l.cantidad || 0), 0),
  pagos: (d?.pagos || d?.abonos || (d?.monto ? [d] : [])).map(p => ({ nombre: p.nombre || p.forma, moneda: p.moneda, monto: p.monto })),
});

// Revisa un pendiente contra el servidor. Devuelve: 'ok' | { conflicto } | 'esperar' (no se pudo saber todavía).
export async function revisarUno(almacen, p, productosPorSku = {}) {
  const v = (col, id) => almacen.verificarServidor(col, id);
  let existe = false;
  if (p.que === 'venta') existe = !!(await v('ventas', p.id));
  else if (p.que === 'apartado') existe = !!(await v('apartados', p.id));
  else if (p.que === 'completar') existe = !!(await v('ventas', p.id));
  else if (p.que === 'abono') { const ap = await v('apartados', p.apartadoId); existe = !!ap?.abonos?.some(a => a.id === p.id); }
  if (!existe) return { conflicto: { id: `rechazada-${p.que}-${p.id}`, tipo: 'rechazada', que: p.que, refId: p.id, apartadoId: p.apartadoId || null, fecha: p.datos?.fecha || p.anotado, resumen: p.resumen || resumenDe(p.datos), datos: p.datos || null } };
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

let revisando = false;
export async function revisarPendientes(ctx) {
  const u = ctx.sesion?.usuario, almacen = ctx.almacen;
  if (revisando || !u || !almacen?.verificarServidor || !navigator.onLine) return;
  let lista = leerPendientes(u, ctx.ambitoPrueba);
  if (!lista.length) return;
  revisando = true;
  try {
    if (!(await almacen.esperarSubidas())) return; // todavía subiendo: se reintenta luego
    for (const p of [...lista]) {
      let r;
      try { r = await revisarUno(almacen, p, ctx.productos); } catch { return; } // sin conexión a mitad: se sigue luego
      if (r !== 'ok') {
        const g = await almacen.registrarConflicto(r.conflicto);
        if (!g.ok) continue; // p. ej. reglas sin publicar: se reintenta luego, sin perder el pendiente
      }
      lista = lista.filter(x => x !== p);
      escribir(u, lista, ctx.ambitoPrueba);
    }
  } finally { revisando = false; }
}

// Revisa al entrar, al volver la conexión y cada 2 minutos mientras haya pendientes.
export function vigilarPendientes(contexto) {
  const ir = () => revisarPendientes(contexto()).catch(() => {});
  window.addEventListener('online', () => setTimeout(ir, 1500));
  setInterval(() => {
    const ctx = contexto();
    if (ctx.sesion && leerPendientes(ctx.sesion.usuario, ctx.ambitoPrueba).length) ir();
  }, 2 * 60 * 1000);
  return ir;
}
