// Reportes (§15) y comisiones (§14).
import { h, icono, toast, sin, unaVez, abrirVentana } from '../ui.js';
import { registrarVista } from '../app.js';
import { resumenDia, masVendidos, inventarioBajo, valorInventario, ventasPorPeriodo, cobrosEnPesos } from '../nucleo/reportes.js';
import { resumenComisiones } from '../nucleo/comisiones.js';
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';
import { NOMBRE_MONEDA } from '../nucleo/formas.js';
import { hoy, sumarDias, rangoCorto } from '../nucleo/fechas.js';
import { abrirCalendarioRango } from './calendario.js';
import { escucharVentasConCosto, listaVentas } from './ventas-rango.js';

// Selector de rango: Hoy / Semana / 7 días / Este mes, o cualquier rango con el calendario propio.
function selectorRango(alCambiar, inicial = 'hoy') {
  const d = hoy();
  const lunes = sumarDias(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  const RANGOS = { hoy: [d, d], semana: [lunes, d], siete: [sumarDias(d, -6), d], mes: [d.slice(0, 8) + '01', d] };
  let [desde, hasta] = RANGOS[inicial];
  let activo = inicial;
  const seg = h('div', { class: 'segmentado' });
  const boton = h('button', { type: 'button', class: 'pill rango-btn', id: 'rango-btn', 'aria-label': 'Elegir fechas' });
  const fijar = (a, b, k) => { [desde, hasta] = [a, b]; activo = k; pintar(); alCambiar(desde, hasta); };
  const pintar = () => {
    seg.replaceChildren(...[['hoy', 'Hoy'], ['semana', 'Semana'], ['siete', '7 días'], ['mes', 'Este mes']].map(([k, t]) =>
      h('button', { 'aria-pressed': String(k === activo), onclick: () => fijar(...RANGOS[k], k) }, t)));
    boton.replaceChildren(h('span', {}, icono('calendario'), rangoCorto(desde, hasta)));
  };
  boton.addEventListener('click', () => abrirCalendarioRango({ desde, hasta }, (a, b) => fijar(a, b, Object.keys(RANGOS).find(k => RANGOS[k][0] === a && RANGOS[k][1] === b) || '')));
  pintar();
  return { el: h('div', { class: 'rango' }, seg, boton), valor: () => [desde, hasta] };
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const COLOR_MONEDA = { COP: 'var(--cop)', USD: 'var(--usd)', BS: 'var(--bs)', Bs: 'var(--bs)' };

// Gráfica de barras de ventas (por hora o por día). La barra más alta lleva su monto.
function graficaVentas(p) {
  const max = Math.max(...p.barras.map(b => b.total), 0);
  const salto = p.barras.length > 16 ? Math.ceil(p.barras.length / 8) : p.barras.length > 9 ? 2 : 1;
  return h('div', { class: 'graf', role: 'img', 'aria-label': `Ventas por ${p.modo === 'hora' ? 'hora' : 'día'}` },
    h('div', { class: 'graf-barras' }, ...p.barras.map(b => h('div', { class: 'graf-col' + (max && b.total === max ? ' max' : ''), title: `${b.etiqueta}: ${fmtCop(b.total)}` },
      max && b.total === max ? h('span', { class: 'graf-tope num' }, fmtCop(b.total)) : null,
      h('i', { style: `height:${max ? Math.max(b.total ? 3 : 0, (b.total / max) * 100) : 0}%` })))),
    h('div', { class: 'graf-ejes' }, ...p.barras.map((b, i) => h('span', {}, i % salto === 0 ? b.etiqueta : ''))));
}

// Fila de sección que abre el detalle.
const filaSeccion = (cls, ic, titulo, resumen, alAbrir) => h('button', { type: 'button', class: 'rep-fila ' + cls, onclick: alAbrir },
  h('span', { class: 'rep-fila-ic' }, icono(ic)), h('span', { class: 'rep-fila-t' }, h('b', {}, titulo), resumen ? h('span', { class: 'nota' }, resumen) : null), icono('der'));

registrarVista('/reportes', {
  montar(cont, ctx) {
    const gestion = ctx.puedeVer('verReportesTodos');
    let quitar = null, datos = { ventas: [], costosVenta: null, costos: {} }, rangoActual = [hoy(), hoy()];
    const cuerpo = h('div', { class: 'pila rep' });
    const pintar = () => {
      const r = resumenDia(datos.ventas, datos.costosVenta, ctx.ajustes.formasPago);
      const formas = ctx.ajustes.formasPago;
      const productos = Object.values(ctx.productos);
      const nombreForma = id => formas.find(x => x.id === id) || { nombre: id, moneda: 'COP' };
      const enPesos = Object.entries(cobrosEnPesos(datos.ventas, formas)).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
      const sumaPesos = enPesos.reduce((s, [, m]) => s + m, 0);
      const top = masVendidos(datos.ventas, ctx.productos, 50);
      const bajas = gestion ? inventarioBajo(productos) : [];
      const validas = datos.ventas.filter(v => v.estado !== 'anulada').length;

      const resumen = h('div', { class: 'tarjeta rep-resumen' },
        h('div', { class: 'rep-kpis' },
          h('div', { class: 'rep-kpi principal', 'data-k': 'total' }, h('span', { class: 'et' }, 'Ventas'), h('b', { class: 'val num' }, fmtCop(r.total))),
          gestion ? h('div', { class: 'rep-kpi', 'data-k': 'ganancia' }, h('span', { class: 'et' }, 'Ganancia'),
            h('b', { class: 'val num' }, r.ganancia == null ? '—' : fmtCop(r.ganancia)),
            r.ganancia != null && r.total ? h('span', { class: 'sub' }, r.gananciaParcial ? 'calculando…' : `${pct(r.ganancia, r.total)}% del total`) : null) : null),
        h('div', { class: 'rep-mini' },
          h('span', {}, h('b', { class: 'num' }, String(r.ventas)), r.ventas === 1 ? ' venta' : ' ventas'),
          h('span', {}, h('b', { class: 'num' }, String(r.unidades)), r.unidades === 1 ? ' prenda' : ' prendas'),
          h('span', {}, 'ticket ', h('b', { class: 'num' }, fmtCop(r.ticketPromedio)))),
        r.ventas ? graficaVentas(ventasPorPeriodo(datos.ventas, ...rangoActual)) : null);

      const pagos = h('div', { class: 'tarjeta rep-pagos' }, h('h2', { class: 'sec-t' }, 'Cobros'),
        sumaPesos ? h('div', { class: 'rep-pila', role: 'img', 'aria-label': 'Reparto de cobros por forma de pago' },
          ...enPesos.map(([id, m], i) => h('i', { style: `width:${(m / sumaPesos) * 100}%;--c:${COLOR_MONEDA[nombreForma(id).moneda] || 'var(--muted)'};--o:${1 - (i % 3) * 0.28}`, title: nombreForma(id).nombre }))) : null,
        sumaPesos ? h('div', { class: 'rep-leyenda' }, ...enPesos.slice(0, 4).map(([id, m], i) => h('span', {},
          h('i', { style: `--c:${COLOR_MONEDA[nombreForma(id).moneda] || 'var(--muted)'};--o:${1 - (i % 3) * 0.28}` }), nombreForma(id).nombre, h('b', { class: 'num' }, ` ${pct(m, sumaPesos)}%`)))) : h('p', { class: 'nota' }, 'Sin cobros.'),
        sumaPesos ? h('button', { type: 'button', class: 'rep-ver', onclick: () => abrirVentana({ titulo: 'Cobros por forma de pago', contenido: h('div', { class: 'rep-det' },
          ...Object.entries(r.porForma).map(([id, m]) => { const f = nombreForma(id); return h('div', { class: 'fila-rep' }, h('span', {}, f.nombre), h('b', { class: 'num' }, `${fmtMonto(m, f.moneda)} ${NOMBRE_MONEDA[f.moneda]}`)); })) }) }, 'Ver montos', icono('der')) : null);

      const maxU = top[0]?.unidades || 0;
      const vendidos = h('div', { class: 'tarjeta mas-vendidos' }, h('h2', { class: 'sec-t' }, 'Más vendidos'),
        top.length ? h('div', { class: 'rep-top' }, ...top.slice(0, 5).map(m => h('div', { class: 'rep-top-fila' },
          h('span', { class: 'rep-top-n' }, m.grupo), h('span', { class: 'rep-top-barra' }, h('i', { style: `width:${pct(m.unidades, maxU)}%` })), h('b', { class: 'num' }, String(m.unidades))))) : h('p', { class: 'nota' }, 'Sin ventas en este período.'),
        top.length ? h('button', { type: 'button', class: 'rep-ver', id: 'rep-ver-vendidos', onclick: () => abrirVentana({ titulo: 'Más vendidos', contenido: h('div', { class: 'rep-det' },
          ...top.map((m, i) => h('div', { class: 'fila-rep' }, h('span', { class: 'mv-nombre' }, `${i + 1}. ${m.grupo}`, h('span', { class: 'nota' }, 'Tallas ' + Object.entries(m.tallas).map(([t, n]) => `${t} (${n})`).join(', '))), h('b', { class: 'num' }, `${m.unidades}`)))) }) }, top.length > 5 ? `Ver los ${top.length}` : 'Ver tallas', icono('der')) : null);

      const inv = gestion ? valorInventario(productos, datos.costos) : null;
      cuerpo.replaceChildren(...sin(resumen, h('div', { class: 'rep-dos' }, pagos, vendidos),
        h('div', { class: 'rep-filas tarjeta' },
          filaSeccion('rep-ventas', 'historial', 'Ventas', `${validas} en este período`, () => abrirVentana({ titulo: 'Ventas', contenido: listaVentas(ctx, datos.ventas, 200) })),
          gestion ? filaSeccion('bajas', 'alerta', 'Existencias bajas', bajas.length ? `${bajas.length} ${bajas.length === 1 ? 'talla' : 'tallas'} en el mínimo o menos` : 'Todo en orden', () => abrirVentana({ titulo: 'Existencias bajas', contenido: h('div', { class: 'rep-det bajas-det' },
            ...(bajas.length ? bajas.slice(0, 100).map(p => h('div', { class: 'fila-rep' }, h('span', {}, `${p.grupo} · Talla ${p.talla || p.sku}`), h('b', { class: 'num ' + (p.existencia <= 0 ? 'neg' : '') }, `${p.existencia} / mín. ${p.minimo || 0}`))) : [h('p', { class: 'nota' }, 'Ninguna talla está en el mínimo.')])) })) : null,
          gestion ? filaSeccion('rep-inv', 'caja', 'Valor del inventario', `${fmtCop(inv.aCosto)} a costo · ${fmtCop(inv.aPrecio)} a precio`, () => abrirVentana({ titulo: 'Valor del inventario', contenido: h('div', { class: 'rep-det' },
            h('div', { class: 'fila-rep' }, h('span', {}, 'A costo'), h('b', { class: 'num' }, fmtCop(inv.aCosto))),
            h('div', { class: 'fila-rep' }, h('span', {}, 'A precio detal'), h('b', { class: 'num' }, fmtCop(inv.aPrecio))),
            h('div', { class: 'fila-rep' }, h('span', {}, 'Diferencia'), h('b', { class: 'num' }, fmtCop(inv.aPrecio - inv.aCosto)))) })) : null)));
    };
    const cargar = (desde, hasta) => { rangoActual = [desde, hasta]; quitar && quitar(); quitar = escucharVentasConCosto(ctx, { desde, hasta }, d => { datos = d; pintar(); }); };
    const rango = selectorRango(cargar);
    cont.append(h('div', { class: 'cab-vista' }, gestion ? rango.el : h('span', { class: 'nota' }, 'Tus ventas de hoy')), cuerpo);
    cargar(...(gestion ? rango.valor() : [hoy(), hoy()]));
    return () => quitar && quitar();
  },
});

registrarVista('/comisiones', {
  accion: 'pagarComisiones',
  montar(cont, ctx) {
    let usuarios = [], ventas = [], pagos = [], vendedor = '', quitarVentas = null;
    let [desde, hasta] = [hoy(), hoy()];
    const sel = h('div', { class: 'segmentado personas', id: 'com-vendedor', role: 'group', 'aria-label': 'Vendedora' });
    const res = h('div', { class: 'resumen-com tarjeta' });
    const pintar = () => {
      const opciones = usuarios.filter(u => u.activo !== false && (u.rol !== 'admin' || ventas.some(v => v.usuario === u.usuario)));
      // Sin elegir: la primera vendedora (normalmente hay una sola)
      if (!opciones.some(u => u.usuario === vendedor)) vendedor = (opciones.find(u => u.rol === 'vendedora') || opciones[0])?.usuario || '';
      sel.replaceChildren(...opciones.map(u => h('button', { type: 'button', 'data-usuario': u.usuario, 'aria-pressed': String(u.usuario === vendedor), onclick: () => { vendedor = u.usuario; pintar(); } }, u.nombre)));
      sel.hidden = opciones.length < 2;
      if (!vendedor) { res.replaceChildren(h('p', { class: 'nota' }, 'Aún no hay vendedoras.')); return; }
      const r = resumenComisiones(ventas, { vendedor, desde, hasta }, pagos);
      const dato = (et, v, cls = '') => h('div', { class: 'dato ' + cls }, h('span', { class: 'nota' }, et), ' ', h('b', { class: 'num' }, v));
      const quien = opciones.find(u => u.usuario === vendedor);
      res.replaceChildren(...sin(h('p', { class: 'nota' }, quien ? `Comisiones de ${quien.nombre}` : ''), h('div', { class: 'datos' },
        dato('Ventas', String(r.ventas)), dato('Prendas', String(r.prendas)), dato('Normal', fmtCop(r.normal)), dato('Reducida', fmtCop(r.reducida)),
        dato('Total', fmtCop(r.total), 'fuerte'), dato('Pagado', fmtCop(r.pagado)), dato('Pendiente', fmtCop(r.pendiente), r.pendiente ? 'pend' : '')),
        r.pendiente > 0 ? h('div', { class: 'acciones' }, h('button', { class: 'btn primary', onclick: e => unaVez(e.currentTarget, async () => {
          const x = await ctx.almacen.pagarComisiones({ vendedor, desde, hasta, monto: r.pendiente, ventas: r.idsPendientes });
          toast(x.ok ? 'Comisiones pagadas' : 'No se pudo guardar', { malo: !x.ok });
        })() }, icono('check'), 'Marcar como pagadas')) : null));
    };
    const cargar = (d, hh) => { desde = d; hasta = hh; quitarVentas && quitarVentas(); quitarVentas = escucharVentasConCosto(ctx, { desde, hasta }, x => { ventas = x.ventas; pintar(); }); };
    const rango = selectorRango(cargar, 'semana');
    const q = [ctx.almacen.escuchar('usuarios', l => { usuarios = l; pintar(); }), ctx.almacen.escuchar('comisiones', l => { pagos = l; pintar(); })];
    cont.append(h('div', { class: 'cab-vista' }, rango.el), sel, res);
    cargar(...rango.valor());
    return () => { q.forEach(x => x()); quitarVentas && quitarVentas(); };
  },
});
