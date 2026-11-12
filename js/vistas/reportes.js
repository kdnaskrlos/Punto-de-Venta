// Reportes (§15) y comisiones (§14).
import { h, icono, toast, sin, unaVez } from '../ui.js';
import { registrarVista } from '../app.js';
import { resumenDia, masVendidos, inventarioBajo, valorInventario } from '../nucleo/reportes.js';
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

const tile = (k, color, et, val, sub) => h('div', { class: 'tile', 'data-k': k, style: `--c:${color}` }, h('div', { class: 'et' }, et), h('div', { class: 'val num' }, val), sub ? h('div', { class: 'sub' }, sub) : null);

registrarVista('/reportes', {
  montar(cont, ctx) {
    const gestion = ctx.puedeVer('verReportesTodos');
    let quitar = null, datos = { ventas: [], costosVenta: null, costos: {} };
    const cuerpo = h('div', { class: 'pila' });
    const pintar = () => {
      const r = resumenDia(datos.ventas, datos.costosVenta, ctx.ajustes.formasPago);
      const formas = ctx.ajustes.formasPago;
      const productos = Object.values(ctx.productos);
      cuerpo.replaceChildren(...sin(
        h('div', { class: 'tiles' },
          tile('total', 'var(--accent)', 'Ventas', fmtCop(r.total), `${r.ventas} ventas`),
          gestion ? tile('ganancia', 'var(--cop)', 'Ganancia', r.ganancia == null ? '—' : fmtCop(r.ganancia), r.gananciaParcial ? 'Calculando costos…' : null) : null,
          tile('unidades', 'var(--usd)', 'Prendas', String(r.unidades)),
          tile('ticket', 'var(--bs)', 'Ticket promedio', fmtCop(r.ticketPromedio))),
        h('div', { class: 'tarjeta' }, h('h2', { class: 'sec-t' }, icono('monedas'), 'Cobros por forma de pago'),
          ...Object.entries(r.porForma).map(([id, m]) => { const f = formas.find(x => x.id === id) || { nombre: id, moneda: 'COP' }; return h('div', { class: 'fila-rep' }, h('span', {}, f.nombre), h('b', { class: 'num' }, `${fmtMonto(m, f.moneda)} ${NOMBRE_MONEDA[f.moneda]}`)); }),
          Object.keys(r.porForma).length ? null : h('p', { class: 'nota' }, 'Sin cobros.')),
        h('div', { class: 'tarjeta mas-vendidos' }, h('h2', { class: 'sec-t' }, icono('grafica'), 'Más vendidos'),
          ...masVendidos(datos.ventas, ctx.productos, 10).map((m, i) => h('div', { class: 'fila-rep' }, h('span', {}, `${i + 1}. ${m.grupo}`, h('span', { class: 'nota' }, ' · ' + Object.entries(m.tallas).map(([t, n]) => `${t}: ${n}`).join(', '))), h('b', { class: 'num' }, `${m.unidades}`))),
          masVendidos(datos.ventas, ctx.productos, 1).length ? null : h('p', { class: 'nota' }, 'Sin ventas en este período.')),
        gestion ? h('div', { class: 'tarjeta bajas' }, h('h2', { class: 'sec-t' }, icono('alerta'), 'Existencias bajas'),
          ...inventarioBajo(productos).slice(0, 30).map(p => h('div', { class: 'fila-rep' }, h('span', {}, `${p.grupo} · Talla ${p.talla || p.sku}`), h('b', { class: 'num ' + (p.existencia <= 0 ? 'neg' : '') }, `${p.existencia} / mín. ${p.minimo || 0}`)))) : null,
        gestion ? (() => { const v = valorInventario(productos, datos.costos); return h('div', { class: 'tiles' }, tile('valor-costo', 'var(--cop)', 'Inventario a costo', fmtCop(v.aCosto)), tile('valor-precio', 'var(--accent)', 'Inventario a precio detal', fmtCop(v.aPrecio))); })() : null,
        h('div', { class: 'tarjeta' }, h('h2', { class: 'sec-t' }, icono('historial'), 'Ventas'), listaVentas(ctx, datos.ventas))));
    };
    const cargar = (desde, hasta) => { quitar && quitar(); quitar = escucharVentasConCosto(ctx, { desde, hasta }, d => { datos = d; pintar(); }); };
    const rango = selectorRango(cargar);
    cont.append(h('div', { class: 'cab-vista' }, h('h1', { class: 'sec-t' }, icono('grafica'), 'Reportes'), gestion ? rango.el : h('span', { class: 'nota' }, 'Tus ventas de hoy')), cuerpo);
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
    cont.append(h('div', { class: 'cab-vista' }, h('h1', { class: 'sec-t' }, icono('porcentaje'), 'Comisiones'), rango.el), sel, res);
    cargar(...rango.valor());
    return () => { q.forEach(x => x()); quitarVentas && quitarVentas(); };
  },
});
