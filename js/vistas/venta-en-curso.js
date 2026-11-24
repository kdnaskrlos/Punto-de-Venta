import { titulo } from '../nucleo/producto.js';
// Venta en curso: el carrito (prendas, descuento y cliente) se guarda en el aparato mientras se vende.
// Si la app se cierra o se sale sin querer, al volver pregunta "¿Continuar venta?" (igual que Pedidos).
import { h, icono, abrirVentana, despuesDeCerrar } from '../ui.js';
import { navegar } from '../app.js';
import { LOCAL_PENDIENTE, CONFIRMADA_SERVIDOR, RECHAZADA_CONFLICTO } from '../datos/pendientes.js';

const clave = ctx => 'pos-venta-' + (ctx.sesion?.usuario || '');
const resguardos = new WeakMap();
const prefijo = ctx => 'pos-borrador:' + encodeURIComponent(ctx.sesion?.uid || ctx.sesion?.usuario || '') + ':';
const pertenece = (ctx, k) => k === clave(ctx) || k.startsWith(prefijo(ctx));

function leerGuardado(original) {
  try {
    const d = JSON.parse(original);
    return Array.isArray(d?.c?.lineas) && d.c.lineas.length ? d : null;
  } catch { return null; }
}

function coincide(ctx, guardado) {
  try {
    return guardado && ctx.sesion && pertenece(ctx, guardado.clave) &&
      localStorage.getItem(guardado.clave) === guardado.original;
  } catch { return false; }
}

function descartar(ctx, guardado) {
  try {
    if (coincide(ctx, guardado)) localStorage.removeItem(guardado.clave);
  } catch { /* sin almacenamiento */ }
}

export function resguardoVigente(ctx) {
  return coincide(ctx, resguardos.get(ctx.carrito));
}

function escribir(c, k, anterior) {
  const guardadoEn = leerGuardado(anterior)?.en;
  const en = Number.isFinite(guardadoEn) ? Math.max(Date.now(), guardadoEn + 1) : Date.now();
  const original = JSON.stringify({ c, en });
  localStorage.setItem(k, original);
  resguardos.set(c, { clave: k, original });
}

export function actualizarResguardo(c) {
  const previo = resguardos.get(c);
  try {
    if (previo && localStorage.getItem(previo.clave) === previo.original) escribir(c, previo.clave, previo.original);
  } catch { /* sin almacenamiento */ }
}

export function guardarVentaEnCurso(ctx) {
  const c = ctx.carrito;
  if (!ctx.sesion || !c) return false;
  const previo = resguardos.get(c);
  if (!c.lineas?.length) {
    descartar(ctx, previo);
    resguardos.delete(c);
    return false;
  }
  try {
    const principal = clave(ctx);
    if (previo && !coincide(ctx, previo)) return false;
    const k = previo?.clave || (leerGuardado(localStorage.getItem(principal))
      ? prefijo(ctx) + ctx.almacen.nuevoId() : principal);
    escribir(c, k, localStorage.getItem(k));
    return true;
  } catch { return false; }
}

function leer(ctx) {
  if (!ctx.sesion) return [];
  try {
    const claves = [clave(ctx)];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefijo(ctx))) claves.push(k);
    }
    return claves.flatMap(k => {
      const original = localStorage.getItem(k);
      const d = leerGuardado(original);
      return d ? [{ clave: k, original, c: d.c, en: d.en }] : [];
    }).sort((a, b) => b.en - a.en);
  } catch { return []; }
}

export function vigilarVentaEnCurso(ctx) {
  window.addEventListener('pos:carrito', () => guardarVentaEnCurso(ctx));
  window.addEventListener('pos:carrito-vaciado', e => {
    descartar(ctx, resguardos.get(e.detail));
    resguardos.delete(e.detail);
  });
  const guardarAlSalir = () => { if (ctx.carrito?.lineas?.length) guardarVentaEnCurso(ctx); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarAlSalir(); });
  window.addEventListener('pagehide', guardarAlSalir);
}

export async function ofrecerRetomar(ctx, omitir = new Set()) {
  const disponibles = leer(ctx).filter(d => !omitir.has(d.clave));
  const [d] = disponibles;
  if (!d || ctx.carrito?.lineas?.length) return;
  const c = d.c;
  const estadoVenta = await ctx.almacen.estadoCobro?.('venta', c.ventaId);
  const estado = estadoVenta || await ctx.almacen.estadoCobro?.('apartado', c.apartadoId);
  if (!coincide(ctx, d) || ctx.carrito?.lineas?.length) return;
  if (estado === LOCAL_PENDIENTE || estado === RECHAZADA_CONFLICTO) {
    const ok = h('button', { class: 'btn primary', id: 'ya-guardada' }, 'Entendido');
    const v = abrirVentana({ titulo: estado === LOCAL_PENDIENTE ? 'Cobro pendiente de sincronización' : 'Cobro en conflicto',
      contenido: h('p', { class: 'nota' }, 'Conserva el comprobante y comprueba el estado del cobro antes de repetirlo.'),
      acciones: h('div', { class: 'acciones' }, ok) });
    ok.onclick = () => { descartar(ctx, d); v.cerrar(); };
    return;
  }
  // v2.26 · Si la luz se fue justo al cobrar, la venta (o el apartado) pudo quedar guardada: no se ofrece cobrarla otra vez.
  let ya = estado === CONFIRMADA_SERVIDOR ? (estadoVenta ? 'venta' : 'apartado') : null;
  if (!ya && c.ventaId && await ctx.almacen.obtener('ventas', c.ventaId)) ya = 'venta';
  if (!ya && c.apartadoId && await ctx.almacen.obtener('apartados', c.apartadoId)) ya = 'apartado';
  if (!coincide(ctx, d) || ctx.carrito?.lineas?.length) return;
  if (ya) {
    descartar(ctx, d);
    const ok = h('button', { class: 'btn primary', id: 'ya-guardada' }, 'Entendido');
    const v = abrirVentana({ titulo: ya === 'venta' ? 'La venta ya se guardó' : 'El apartado ya se guardó', contenido: h('p', { class: 'nota' },
      `${ya === 'venta' ? 'La venta' : 'El apartado'}${c.cliente?.nombre ? ' de ' + c.cliente.nombre : ''} que estaba en curso sí quedó guardado antes del corte. No hay que cobrarlo otra vez.`),
      acciones: h('div', { class: 'acciones' }, ok) });
    ok.onclick = () => v.cerrar();
    return;
  }
  const prendas = c.lineas.reduce((s, l) => s + l.cantidad, 0);
  const nombres = [...new Set(c.lineas.map(l => (ctx.productos?.[l.sku] ? titulo(ctx.productos[l.sku]) : l.sku)))];
  const siguiente = disponibles.length > 1 ? h('button', { class: 'btn', id: 'retomar-otro' }, 'Otro borrador') : null;
  const continuar = h('button', { class: 'btn primary', id: 'retomar-si' }, icono('check'), 'Continuar');
  const cancelar = h('button', { class: 'btn', id: 'retomar-no' }, 'Cancelar');
  const v = abrirVentana({ titulo: '¿Continuar venta?', contenido: h('div', { class: 'pila' },
    h('p', { class: 'nota' }, 'Quedó una venta sin terminar en este aparato.'),
    h('div', { class: 'venta-curso' }, h('span', { class: 'chip-ic' }, icono('carrito')),
      h('div', {}, h('b', {}, c.cliente?.nombre || 'Sin cliente todavía'),
        h('small', {}, `${prendas} ${prendas === 1 ? 'prenda' : 'prendas'} · ${nombres.slice(0, 2).join(', ')}${nombres.length > 2 ? '…' : ''}`)))),
    acciones: h('div', { class: 'acciones' }, cancelar, siguiente, continuar) });
  if (siguiente) siguiente.onclick = () => {
    v.cerrar();
    despuesDeCerrar(() => ofrecerRetomar(ctx, new Set([...omitir, d.clave])));
  };
  cancelar.onclick = () => {
    descartar(ctx, d);
    v.cerrar();
    despuesDeCerrar(() => ofrecerRetomar(ctx));
  };
  continuar.onclick = () => {
    if (!coincide(ctx, d) || ctx.carrito?.lineas?.length) { v.cerrar(); return; }
    ctx.carrito = { lineas: c.lineas, descuento: c.descuento || null, autorizacion: c.autorizacion || null, ...(c.cliente ? { cliente: c.cliente } : {}),
      ...(c.solicitudDescuento ? { solicitudDescuento: c.solicitudDescuento } : {}),
      ...(c.ventaId ? { ventaId: c.ventaId } : {}), ...(c.apartadoId ? { apartadoId: c.apartadoId } : {}),
      ...(c.pagos?.length ? { pagos: c.pagos } : {}) }; // v2.26: mismos ids y pagos escritos
    resguardos.set(ctx.carrito, d);
    v.cerrar();
    window.dispatchEvent(new CustomEvent('pos:carrito'));
    // v2.13: se va al carrito cuando la ventana termina de cerrarse (antes el «atrás» del cierre deshacía el cambio de pantalla).
    despuesDeCerrar(() => { if (location.hash !== '#/vender') navegar('/vender'); });
  };
}
