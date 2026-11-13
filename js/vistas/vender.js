// Pantalla Vender (§8): tarjetas por modelo y color, tallas, carrito con tramos, descuento y atajos.
import { h, icono, abrirVentana, abrirHoja, toast, esTelefono, hayCapas } from '../ui.js';
import { abrirCajaVentana } from './caja.js';
import { registrarVista, navegar } from '../app.js';
import { tipoPrenda } from '../nucleo/tipo-prenda.js';
import { colorPrenda } from '../nucleo/colores.js';
import { calcularCarrito, etiquetaTramo } from '../nucleo/tramos.js';
import { aplicarDescuento, requiereAutorizacion } from '../nucleo/descuento.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { desdeCop } from '../nucleo/tasas.js';

const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function carrito(ctx) {
  ctx.carrito ||= { lineas: [], descuento: null, autorizacion: null };
  return ctx.carrito;
}

// Resumen del carrito: tramos, descuento y total.
export function resumenCarrito(ctx) {
  const c = carrito(ctx);
  const aj = ctx.ajustes;
  const calc = calcularCarrito(c.lineas, ctx.productos, { limites: aj.tramos, redondeo: aj.redondeo });
  const { descuento, total } = aplicarDescuento(calc.subtotal, c.descuento);
  return { ...calc, descuento, total, unidades: calc.lineas.reduce((s, l) => s + l.cantidad, 0) };
}

// Un descuento deja de valer si el carrito cambió: el aprobado era para otro subtotal, y la vendedora
// no puede quedar por encima del máximo al quitar prendas. Devuelve false si lo quitó.
export function revisarDescuento(ctx) {
  const c = carrito(ctx);
  if (!c.descuento) return true;
  const sub = calcularCarrito(c.lineas, ctx.productos, { limites: ctx.ajustes.tramos, redondeo: ctx.ajustes.redondeo }).subtotal;
  const pct = c.descuento.tipo === 'pct' ? c.descuento.valor : (sub ? c.descuento.valor * 100 / sub : 100);
  const invalido = c.autorizacion ? c.autorizacion.subtotal !== sub
    : (requiereAutorizacion(ctx.sesion?.rol, pct, ctx.ajustes.descuentoMaxVendedora) || pct >= 100);
  if (!invalido) return true;
  c.descuento = null; c.autorizacion = null;
  if (c.lineas.length) toast('Se quitó el descuento: el carrito cambió');
  return false;
}

export function vaciarCarrito(ctx) { ctx.carrito = { lineas: [], descuento: null, autorizacion: null }; }

function enCarrito(ctx, sku) { return carrito(ctx).lineas.find(l => l.sku === sku)?.cantidad || 0; }

export function agregarAlCarrito(ctx, sku, delta = 1) {
  const c = carrito(ctx);
  const p = ctx.productos[sku];
  if (!p) return false;
  const actual = enCarrito(ctx, sku);
  const nueva = actual + delta;
  if (delta > 0 && nueva > p.existencia) { toast('No hay más existencia'); return false; }
  if (nueva <= 0) c.lineas = c.lineas.filter(l => l.sku !== sku);
  else if (actual) c.lineas.find(l => l.sku === sku).cantidad = nueva;
  else c.lineas.push({ sku, cantidad: nueva });
  revisarDescuento(ctx);
  window.dispatchEvent(new CustomEvent('pos:carrito'));
  return true;
}

function grupos(ctx) {
  const g = {};
  for (const p of Object.values(ctx.productos)) {
    if (p.activo === false) continue;
    const k = p.grupo || p.sku;
    (g[k] ||= { grupo: k, producto: p.producto || p.nombre, color: p.color, categoria: p.categoria, foto: p.foto, variantes: [] }).variantes.push(p);
  }
  return Object.values(g).sort((a, b) => a.grupo.localeCompare(b.grupo, 'es'));
}

// Línea del carrito en tarjeta: imagen, nombre, color y talla, tarifa; a la derecha quitar, cantidad y monto.
function lineaCarrito(ctx, l, aj) {
  const p = ctx.productos[l.sku];
  const g = { producto: p.producto || p.nombre, categoria: p.categoria, foto: p.foto };
  return h('div', { class: 'linea', 'data-sku': l.sku },
    miniatura(g, 'foto'),
    h('div', { class: 'linea-info' },
      h('b', {}, g.producto),
      h('span', { class: 'lc-chip' }, [p.color, p.talla && `Talla ${p.talla}`].filter(Boolean).join(' · ') || p.sku),
      h('span', { class: 'lc-chip tramo' + (l.oferta ? ' oferta' : '') }, l.oferta ? 'Precio de oferta' : `Tarifa ${etiquetaTramo(l.tramo, aj.tramos)}`)),
    h('div', { class: 'linea-der' },
      h('button', { 'aria-label': 'Quitar', class: 'quitar ibtn chico peligro', onclick: () => agregarAlCarrito(ctx, l.sku, -l.cantidad) }, icono('borrar')),
      h('span', { class: 'lc-monto' }, h('span', { class: 'num monto' }, fmtCop(l.subtotal)), h('span', { class: 'c-cop moneda' }, 'COP'))),
    h('div', { class: 'linea-pie' },
      h('div', { class: 'stepper' },
        h('button', { 'aria-label': 'Menos', onclick: () => agregarAlCarrito(ctx, l.sku, -1) }, icono('menos')),
        h('span', { class: 'cant num' }, String(l.cantidad)),
        h('button', { 'aria-label': 'Más', onclick: () => agregarAlCarrito(ctx, l.sku, 1) }, icono('mas1'))),
      h('span', { class: 'nota num lc-cu' }, `${fmtCop(l.precioUnit)} c/u`)));
}

export function equivalentes(ctx, cop) {
  // Redondeado hacia arriba, igual que lo que sugerirá Cobrar
  const usd = desdeCop(cop, 'USD', ctx.tasas, { haciaArriba: true }), bs = desdeCop(cop, 'BS', ctx.tasas, { haciaArriba: true });
  return h('div', { class: 'equivalentes num' },
    usd != null ? h('span', { class: 'c-usd' }, `${fmtDec(usd)} USD`) : null,
    usd != null && bs != null ? ' · ' : null,
    bs != null ? h('span', { class: 'c-bs' }, `${fmtDec(bs)} Bs`) : null);
}

export function panelCarrito(ctx, { enHoja = false } = {}) {
  const aj = ctx.ajustes;
  const r = resumenCarrito(ctx);
  const c = carrito(ctx);
  if (!r.lineas.length) return h('div', { class: 'carrito vacio-carrito' }, h('div', { class: 'sec-t' }, icono('carrito'), 'Carrito'), h('p', { class: 'nota' }, 'Toca una prenda para agregarla.'));
  return h('div', { class: 'carrito' + (enHoja ? ' en-hoja' : '') },
    enHoja ? null : h('div', { class: 'sec-t' }, icono('carrito'), `Carrito · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`),
    h('div', { class: 'lineas' }, r.lineas.map(l => lineaCarrito(ctx, l, aj))),
    r.aviso ? h('div', { class: 'aviso aviso-tramo' }, icono('etiqueta'), `Con ${r.aviso.faltan} ${r.aviso.faltan === 1 ? 'prenda' : 'prendas'} más pasan a precio ${r.aviso.etiqueta}`) : null,
    h('div', { class: 'totales' },
      r.descuento ? h('div', { class: 'fila-total' }, h('span', {}, 'Subtotal'), h('span', { class: 'num' }, fmtCop(r.subtotal), h('span', { class: 'c-cop moneda' }, 'COP'))) : null,
      h('div', { class: 'fila-total desc' },
        h('span', { class: 'desc-et' }, icono('etiqueta'), 'Descuento',
          r.descuento ? h('button', { class: 'ibtn chico', 'aria-label': 'Quitar descuento', onclick: () => { c.descuento = null; c.autorizacion = null; window.dispatchEvent(new CustomEvent('pos:carrito')); } }, icono('x')) : null),
        h('span', { class: 'num' }, r.descuento ? '-' + fmtCop(r.descuento) : '0', h('span', { class: 'c-cop moneda' }, 'COP'))),
      h('div', { class: 'caja-total' },
        h('div', { class: 'et-total' }, 'Total'),
        h('div', { class: 'tc-der' },
          h('div', { class: 'total' }, h('span', { class: 'total-cop num' }, fmtCop(r.total)), h('span', { class: 'c-cop moneda' }, 'COP')),
          h('div', { class: 'tc-eq' }, icono('cambio'), '≈ ', equivalentes(ctx, r.total))))),
    h('div', { class: 'acciones-carrito' },
      h('button', { class: 'btn', onclick: () => abrirDescuento(ctx) }, icono('porcentaje'), 'Descuento'),
      h('button', { class: 'btn', onclick: () => ctx.abrirCobro && ctx.abrirCobro('apartar') }, icono('apartado'), 'Apartar'),
      h('button', { class: 'btn primary cobrar', onclick: () => ctx.abrirCobro && ctx.abrirCobro('venta') }, 'Cobrar')));
}

function abrirDescuento(ctx) {
  const c = carrito(ctx);
  const r = resumenCarrito(ctx);
  const max = ctx.ajustes.descuentoMaxVendedora;
  let tipo = c.descuento?.tipo || 'pct';
  const valor = h('input', { class: 'inp', id: 'desc-valor', inputmode: 'decimal', value: c.descuento?.valor ?? '' });
  const err = h('span', { class: 'error' });
  const segm = h('div', { class: 'segmentado' },
    ...[['pct', '%'], ['monto', 'Monto COP']].map(([t, txt]) => h('button', { type: 'button', 'aria-pressed': String(t === tipo), onclick: e => { tipo = t; segm.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, txt)));
  const nota = ctx.sesion.rol === 'vendedora' ? h('p', { class: 'nota' }, `Puedes dar hasta ${max}% sin autorización.`) : null;
  const aplicar = h('button', { class: 'btn primary' }, 'Aplicar');
  const v = abrirVentana({ titulo: 'Descuento', contenido: h('div', { class: 'pila' }, segm, h('div', { class: 'campo' }, h('label', { for: 'desc-valor' }, 'Valor'), valor, err), nota), acciones: h('div', { class: 'acciones' }, aplicar) });
  aplicar.addEventListener('click', async () => {
    const n = parseMonto(valor.value, tipo === 'pct' ? 'USD' : 'COP');
    if (!n || n <= 0) { err.textContent = 'Escribe un valor'; return; }
    const pct = tipo === 'pct' ? n : (r.subtotal ? n * 100 / r.subtotal : 0);
    if (pct >= 100) { err.textContent = 'Debe ser menor que el total'; return; }
    if (requiereAutorizacion(ctx.sesion.rol, pct, max)) {
      aplicar.disabled = true;
      const s = await ctx.almacen.solicitarAutorizacion({ pct: Math.round(pct * 100) / 100, tipo, valor: n, subtotal: r.subtotal });
      if (!s.ok) { aplicar.disabled = false; err.textContent = s.error === 'red' ? 'Necesitas internet para pedir autorización' : 'No se pudo pedir'; return; }
      err.textContent = '';
      aplicar.textContent = 'Esperando autorización…';
      const quitar = ctx.almacen.escuchar('autorizaciones', lista => {
        const a = lista.find(x => x.id === s.id);
        if (!a || a.estado === 'pendiente') return;
        setTimeout(() => quitar && quitar());
        if (a.estado === 'aprobada') { c.descuento = { tipo, valor: n }; c.autorizacion = { id: a.id, por: a.aprueba, subtotal: r.subtotal }; v.cerrar(); toast('Descuento autorizado'); window.dispatchEvent(new CustomEvent('pos:carrito')); }
        else { aplicar.disabled = false; aplicar.textContent = 'Aplicar'; err.textContent = 'Descuento rechazado'; }
      });
      v.alCerrar = () => quitar && quitar();
      return;
    }
    c.descuento = { tipo, valor: n }; c.autorizacion = null;
    v.cerrar(); window.dispatchEvent(new CustomEvent('pos:carrito'));
  });
}

// Tallas: se eligen las cantidades con − y + (bien separados) y se pasan al carrito con «Agregar al carrito».
// Cerrar con la X no cambia el carrito.
function abrirTallas(ctx, g) {
  const variantes = [...g.variantes].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const cuentas = Object.fromEntries(variantes.map(p => [p.sku, enCarrito(ctx, p.sku)]));
  const antes = { ...cuentas };
  const color = colorPrenda(g.color);
  const lista = h('div', { class: 'tallas-lista' });
  const agregar = h('button', { class: 'btn primary grande', id: 'tallas-agregar' });
  const pintar = () => {
    lista.replaceChildren(...variantes.map(p => {
      const n = cuentas[p.sku];
      const nombre = p.talla || p.nombre;
      const agotada = p.existencia <= 0;
      const pocas = !agotada && p.existencia <= p.minimo;
      return h('div', { class: 'talla-fila-v' + (n ? ' con' : '') + (agotada ? ' agotada' : ''), 'data-sku': p.sku },
        h('span', { class: 'tf-talla' }, nombre),
        h('span', { class: 'tf-disp' + (pocas ? ' pocas' : '') }, agotada ? 'Agotada' : [`${p.existencia} `, h('span', { class: 'largo' }, p.existencia === 1 ? 'disponible' : 'disponibles'), h('span', { class: 'corto' }, 'disp.')]),
        h('span', { class: 'tf-paso' },
          h('button', { type: 'button', class: 'talla-menos', 'data-sku': p.sku, 'aria-label': `Quitar una talla ${nombre}`, disabled: !n,
            onclick: () => { cuentas[p.sku] = Math.max(0, n - 1); pintar(); } }, icono('menos')),
          h('span', { class: 'tf-cant num' + (n ? ' con' : ''), 'aria-live': 'polite' }, String(n)),
          h('button', { type: 'button', class: 'talla-mas', 'data-talla': nombre, 'data-sku': p.sku, 'aria-label': `Agregar una talla ${nombre}`, disabled: agotada,
            onclick: () => { if (n >= p.existencia) { toast('No hay más existencia'); return; } cuentas[p.sku] = n + 1; pintar(); } }, icono('mas1'))));
    }));
    const total = Object.values(cuentas).reduce((x, y) => x + y, 0);
    const cambio = variantes.some(p => cuentas[p.sku] !== antes[p.sku]);
    const habia = Object.values(antes).some(Boolean);
    agregar.replaceChildren(icono('carrito'), habia ? 'Actualizar carrito' : 'Agregar al carrito', total ? h('span', { class: 'tf-total' }, ` · ${total}`) : null);
    agregar.disabled = !cambio;
  };
  pintar();
  const cont = h('div', { class: 'tallas-v' },
    h('p', { class: 'tallas-sub' }, g.color ? h('i', { class: 'punto-color grande', style: color ? `--pc:${color}` : '' }) : null, [g.color, 'Selecciona las tallas'].filter(Boolean).join(' · ')),
    lista);
  const v = abrirVentana({ titulo: g.producto, contenido: cont, acciones: agregar, clase: 'ventana-tallas' });
  agregar.onclick = () => {
    for (const p of variantes) { const d = cuentas[p.sku] - enCarrito(ctx, p.sku); if (d) agregarAlCarrito(ctx, p.sku, d); }
    v.cerrar();
  };
}

// Tarjeta de prenda compacta: imagen cuadrada a la izquierda (foto o ícono gris según el tipo de prenda) y al lado nombre, tallas y precio.
export function miniatura(g, clase = 'miniatura') {
  return h('span', { class: clase }, g.foto ? h('img', { src: g.foto, alt: '', loading: 'lazy', width: 64, height: 64 }) : icono(tipoPrenda(g.producto, g.categoria)));
}

// Fila de prenda: imagen cuadrada, nombre, color y tallas; a la derecha disponibles y precio.
function tarjeta(ctx, g) {
  const existencia = g.variantes.reduce((s, p) => s + Math.max(p.existencia, 0), 0);
  const agotada = existencia <= 0;
  const pocas = !agotada && g.variantes.some(p => p.existencia > 0 && p.existencia <= p.minimo);
  const precio = Math.min(...g.variantes.map(p => p.precios?.[0] || Infinity));
  const oferta = g.variantes.some(p => p.oferta?.activa);
  const elegidas = g.variantes.reduce((s, p) => s + enCarrito(ctx, p.sku), 0);
  const tallas = [...g.variantes].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const color = colorPrenda(g.color);
  return h('button', { class: 'tarjeta-prenda' + (agotada ? ' agotada' : '') + (elegidas ? ' elegida' : ''), 'data-grupo': g.grupo, onclick: () => (ctx.miCaja || !ctx.puedeVer('cajaFisica') ? abrirTallas(ctx, g) : abrirCajaVentana(ctx)) },
    h('span', { class: 'tp-img' }, miniatura(g, 'foto'), elegidas ? h('span', { class: 'en-carrito', 'aria-label': `${elegidas} en el carrito` }, String(elegidas)) : null),
    h('span', { class: 'info' },
      h('b', {}, g.producto),
      h('span', { class: 'tp-linea' },
        g.color ? h('span', { class: 'tp-color' }, h('i', { class: 'punto-color', style: color ? `--pc:${color}` : '' }), g.color) : null,
        h('span', { class: 'tp-tallas' }, h('span', { class: 'tp-pal' }, 'Tallas: '), ...tallas.flatMap((p, i) => [i ? ' · ' : '', h('span', { class: p.existencia > 0 ? '' : 'sin' }, p.talla || p.sku)])))),
    h('span', { class: 'tp-der' },
      agotada ? h('span', { class: 'est r tp-estado' }, icono('alerta'), 'Agotada')
        : h('span', { class: 'est tp-disp ' + (pocas ? 'y' : 'g') }, `${existencia} disp.`),
      agotada ? null : h('span', { class: 'num precio' }, Number.isFinite(precio) ? fmtCop(precio) : '—'),
      !agotada && oferta ? h('span', { class: 'tp-estado tp-oferta' }, 'oferta') : null));
}

registrarVista('/vender', {
  montar(cont, ctx) {
    let busqueda = '', categoria = '';
    const buscar = h('input', { class: 'inp', id: 'buscar', type: 'search', 'aria-label': 'Buscar prenda o código', placeholder: 'Buscar prenda o código', autocomplete: 'off', enterkeyhint: 'search' });
    const filtros = h('div', { class: 'filtros' });
    const rejilla = h('div', { class: 'rejilla' });
    const lado = h('aside', { class: 'lado-carrito' });
    const barra = h('button', { class: 'barra-carrito', onclick: () => {
      const hj = abrirHoja({ titulo: 'Carrito', contenido: h('div', { class: 'hoja-carrito' }), lado: 'abajo' });
      const repintar = () => { hj.el.querySelector('.hoja-carrito').replaceChildren(panelCarrito(ctx, { enHoja: true })); if (!carrito(ctx).lineas.length) hj.cerrar(); };
      repintar();
      window.addEventListener('pos:carrito', repintar);
      hj.alCerrar = () => window.removeEventListener('pos:carrito', repintar);
    } });
    const sinCaja = h('div', { class: 'aviso sin-caja' }, icono('cartera'), h('span', {}, 'Abre tu caja para vender'), h('span', { class: 'sp' }), h('button', { class: 'btn primary', onclick: () => abrirCajaVentana(ctx) }, 'Abrir caja'));

    const escanear = ('BarcodeDetector' in window)
      ? h('button', { class: 'btn', 'aria-label': 'Escanear', onclick: () => ctx.escanear && ctx.escanear(cod => agregarPorCodigo(cod)) }, icono('escanear'), h('span', { class: 'solo-pc' }, 'Escanear'))
      : h('button', { class: 'btn solo-pc', 'aria-label': 'Escanear', onclick: () => { buscar.focus(); toast('Escanea con el lector'); } }, icono('escanear'), 'Escanear');

    function agregarPorCodigo(cod) {
      const p = Object.values(ctx.productos).find(x => x.codigo && x.codigo === cod.trim());
      if (!p) return false;
      if (agregarAlCarrito(ctx, p.sku, 1)) toast(`${p.producto || p.nombre} ${p.talla ? 'T' + p.talla : ''} agregada`);
      return true;
    }

    function pintar() {
      const todos = grupos(ctx);
      const cats = [...new Set(todos.map(g => g.categoria).filter(Boolean))].sort();
      filtros.replaceChildren(...['', ...cats].map(c => h('button', { class: 'chip' + (c === categoria ? ' activo' : ''), onclick: () => { categoria = c; pintar(); } }, c || 'Todo')));
      const q = norm(busqueda);
      const vis = todos.filter(g => (!categoria || g.categoria === categoria) && (!q || g.variantes.some(p => norm(`${p.grupo} ${p.nombre} ${p.sku} ${p.codigo} ${p.marca}`).includes(q))));
      rejilla.replaceChildren(...(vis.length ? vis.map(g => tarjeta(ctx, g)) : [h('div', { class: 'vacio' }, q ? 'No hay prendas con esa búsqueda' : 'Todavía no hay productos. El administrador los importa desde la Carga Masiva.')]));
      pintarCarrito();
    }
    function pintarCarrito() {
      const porGrupo = new Map(grupos(ctx).map(g => [g.grupo, g]));
      rejilla.querySelectorAll('.tarjeta-prenda').forEach(el => { const g = porGrupo.get(el.dataset.grupo); if (g) el.replaceWith(tarjeta(ctx, g)); });
      lado.replaceChildren(panelCarrito(ctx));
      const r = resumenCarrito(ctx);
      barra.hidden = !r.unidades;
      barra.replaceChildren(h('span', {}, `${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`), h('span', { class: 'num' }, `${fmtCop(r.total)} · Ver`));
      sinCaja.hidden = !!ctx.miCaja || !ctx.puedeVer('cajaFisica');
    }
    buscar.addEventListener('input', () => { busqueda = buscar.value; pintar(); });
    buscar.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (agregarPorCodigo(buscar.value)) { buscar.value = ''; busqueda = ''; pintar(); }
      else buscar.blur();
    });
    const teclas = e => {
      if (e.key === 'F2') { e.preventDefault(); buscar.focus(); buscar.select(); }
      if (e.key === 'F9' && carrito(ctx).lineas.length && !hayCapas()) { e.preventDefault(); ctx.abrirCobro && ctx.abrirCobro('venta'); }
    };
    const alDatos = e => { if (['productos', 'ajustes', 'tasas', 'caja'].includes(e.detail.que)) pintar(); };
    document.addEventListener('keydown', teclas);
    window.addEventListener('pos:datos', alDatos);
    window.addEventListener('pos:carrito', pintarCarrito);

    cont.classList.add('vender');
    cont.append(h('div', { class: 'vender-main' }, sinCaja, h('div', { class: 'buscador' }, h('div', { class: 'buscar-caja' }, icono('buscar'), buscar), escanear), filtros, rejilla), lado, barra);
    pintar();
    if (!esTelefono()) setTimeout(() => buscar.focus(), 50);
    return () => { document.removeEventListener('keydown', teclas); window.removeEventListener('pos:datos', alDatos); window.removeEventListener('pos:carrito', pintarCarrito); };
  },
});
