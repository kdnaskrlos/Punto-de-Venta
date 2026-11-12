// Inicio por rol (§13.4): recuadros del día, autorizaciones (admin), alertas y ventas de hoy.
import { h, icono, toast, sin } from '../ui.js';
import { registrarVista, navegar } from '../app.js';
import { resumenDia, inventarioBajo } from '../nucleo/reportes.js';
import { esperadoCaja } from '../nucleo/caja.js';
import { aCop } from '../nucleo/tasas.js';
import { fmtCop } from '../nucleo/dinero.js';
import { hoy, sumarDias, inicioDia } from '../nucleo/fechas.js';
import { escucharVentasConCosto, listaVentas } from './ventas-rango.js';

const tile = (k, color, etiqueta, valor, sub, ic) => h('div', { class: 'tile', 'data-k': k, style: `--c:${color}` },
  h('div', { class: 'et' }, etiqueta), h('div', { class: 'val num' }, valor), sub ? h('div', { class: 'sub' }, sub) : null,
  ic ? h('span', { class: 'tile-ic', 'aria-hidden': 'true' }, icono(ic)) : null);

function totalCajaCop(ctx, caja, ventas, apartados) {
  const formas = ctx.ajustes.formasPago;
  const esp = esperadoCaja(caja, ventas.filter(v => v.cajaId === caja.id), apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === caja.id)), formas);
  return Object.entries(esp).reduce((s, [id, m]) => s + (aCop(m, formas.find(f => f.id === id)?.moneda || 'COP', ctx.tasas) || 0), 0);
}

registrarVista('/inicio', {
  montar(cont, ctx) {
    const gestion = ctx.puedeVer('verReportesTodos');
    const dia = hoy();
    let datos = { ventas: [], costosVenta: null }, cajas = [], apartados = [], autorizaciones = [];
    const tiles = h('div', { class: 'tiles' });
    const auts = h('div', { class: 'autorizaciones' });
    const alertas = h('div', { class: 'alertas' });
    const ventasEl = h('div', { class: 'tarjeta' });
    const pintar = () => {
      const r = resumenDia(datos.ventas, datos.costosVenta, ctx.ajustes.formasPago);
      const bajas = inventarioBajo(Object.values(ctx.productos));
      const negativos = Object.values(ctx.productos).filter(p => p.existencia < 0);
      if (gestion) {
        const abiertas = cajas.filter(c => c.estado === 'abierta');
        const enCaja = abiertas.reduce((s, c) => s + totalCajaCop(ctx, c, datos.ventas, apartados), 0);
        tiles.replaceChildren(
          tile('ventas', 'var(--accent)', 'Ventas de hoy', fmtCop(r.total), `${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'} · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`, 'carrito'),
          tile('ganancia', 'var(--cop)', 'Ganancia', r.ganancia == null ? '—' : fmtCop(r.ganancia), r.gananciaParcial ? 'Calculando costos…' : 'Total menos costo', 'grafica'),
          tile('caja', 'var(--usd)', 'En cajas abiertas', fmtCop(enCaja), `${abiertas.length} ${abiertas.length === 1 ? 'caja abierta' : 'cajas abiertas'} · en COP`, 'cartera'),
          tile('bajas', bajas.length ? 'var(--warn)' : 'var(--muted)', 'Existencias bajas', String(bajas.length), 'en el mínimo o menos', 'caja'));
      } else {
        const mia = ctx.miCaja;
        const comision = datos.ventas.filter(v => v.estado !== 'anulada').flatMap(v => v.lineas).reduce((s, l) => s + (l.comision || 0), 0);
        tiles.replaceChildren(
          tile('mis-ventas', 'var(--accent)', 'Mis ventas de hoy', fmtCop(r.total), `${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'} · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`, 'carrito'),
          tile('mi-caja', 'var(--usd)', 'Mi caja', mia ? fmtCop(totalCajaCop(ctx, mia, datos.ventas, apartados)) : 'Cerrada', mia ? 'debería haber, en COP' : 'Ábrela para vender', 'cartera'),
          tile('comision', 'var(--cop)', 'Mi comisión de hoy', fmtCop(comision), null, 'porcentaje'));
      }
      const pendientes = autorizaciones.filter(a => a.estado === 'pendiente');
      auts.replaceChildren(...(ctx.puedeVer('aprobarDescuento') && pendientes.length ? [h('h2', { class: 'sec-t' }, icono('porcentaje'), 'Autorizaciones de descuento'),
        ...pendientes.map(a => h('div', { class: 'autorizacion tarjeta' },
          h('div', {}, h('b', {}, `@${a.solicita} pide ${a.tipo === 'monto' ? fmtCop(a.valor) + ' COP' : a.pct + '%'} de descuento`), h('div', { class: 'nota' }, `Sobre ${fmtCop(a.subtotal || 0)} · ${a.motivo || ''}`)),
          h('div', { class: 'acciones' },
            h('button', { class: 'btn', onclick: async () => { await ctx.almacen.responderAutorizacion(a.id, false); toast('Rechazado'); } }, 'Rechazar'),
            h('button', { class: 'btn primary', onclick: async () => { const r = await ctx.almacen.responderAutorizacion(a.id, true); toast(r.ok ? 'Aprobado' : 'No se pudo', { malo: !r.ok }); } }, 'Aprobar'))))] : []));
      const alerta = (txt, detalle) => h('div', { class: 'aviso grave' }, icono('alerta'), h('div', {}, h('b', {}, txt), detalle ? h('div', { class: 'nota' }, detalle) : null));
      const cierres = cajas.filter(c => c.estado === 'cerrada' && c.cierre?.fecha >= inicioDia(dia) && (c.cierre.filas || []).some(f => f.nivel !== 'ok'));
      alertas.replaceChildren(...(gestion ? [
        negativos.length ? alerta('Existencia negativa', negativos.map(p => `${p.grupo} · Talla ${p.talla || p.sku} (${p.existencia})`).join(', ') + '. Se vendió sin conexión más de lo que había: revisa las ventas y ajusta.') : null,
        ...cierres.map(c => alerta(`Cierre con diferencia · @${c.usuario}`, `${c.cierre.totalCop > 0 ? '+' : ''}${fmtCop(c.cierre.totalCop)} COP · ${c.cierre.nota || ''}`)),
      ].filter(Boolean) : []));
      ventasEl.replaceChildren(h('h2', { class: 'sec-t' }, icono('historial'), gestion ? 'Ventas de hoy' : 'Mis ventas de hoy'), listaVentas(ctx, datos.ventas));
    };
    const q = [
      escucharVentasConCosto(ctx, { desde: dia, hasta: dia }, d => { datos = d; pintar(); }),
      ctx.almacen.escuchar('apartados', l => { apartados = l; pintar(); }),
    ];
    if (gestion) q.push(ctx.almacen.escuchar('cajas', l => { cajas = l; pintar(); }, { desde: inicioDia(sumarDias(dia, -3)) }));
    if (ctx.puedeVer('aprobarDescuento')) q.push(ctx.almacen.escuchar('autorizaciones', l => { autorizaciones = l; pintar(); }, { estado: 'pendiente' }));
    const alDatos = e => { if (['productos', 'caja', 'tasas', 'ajustes'].includes(e.detail.que)) pintar(); };
    window.addEventListener('pos:datos', alDatos);
    const s = ctx.sesion;
    cont.append(...sin(h('h1', { class: 'saludo' }, 'Hola, ', h('span', {}, (s.nombre || s.usuario).split(' ')[0])), tiles, auts, alertas, ventasEl,
      !gestion && !ctx.miCaja ? h('button', { class: 'btn primary grande', onclick: () => navegar('/caja') }, icono('cartera'), 'Abrir caja') : null));
    pintar();
    return () => { q.forEach(x => x()); window.removeEventListener('pos:datos', alDatos); };
  },
});
