// Inicio por rol (§13.4): recuadros del día, autorizaciones (admin), alertas y ventas de hoy.
import { h, icono, toast, sin, unaVez } from '../ui.js';
import { abrirCajaVentana } from './caja.js';
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

// Ventas de cada caja abierta, por cajaId (no por fecha): una caja abierta varios días suma todo.
function escucharVentasDeCajas(ctx, alCambiar) {
  const subs = {}, porCaja = {};
  return {
    actualizar(cajasAbiertas) {
      const ids = new Set(cajasAbiertas.map(c => c.id));
      for (const id of Object.keys(subs)) if (!ids.has(id)) { subs[id](); delete subs[id]; delete porCaja[id]; }
      for (const id of ids) {
        if (subs[id]) continue;
        subs[id] = () => {}; // marcar antes: la escucha puede avisar en el mismo instante
        const quitar = ctx.almacen.escuchar('ventas', l => { porCaja[id] = l; queueMicrotask(alCambiar); }, { cajaId: id });
        if (subs[id]) subs[id] = quitar; else quitar();
      }
    },
    ventas: id => porCaja[id] || [],
    parar: () => Object.values(subs).forEach(q => q()),
  };
}

function totalCajaCop(ctx, caja, ventas, apartados) {
  const formas = ctx.ajustes.formasPago;
  const esp = esperadoCaja(caja, ventas.filter(v => v.cajaId === caja.id), apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === caja.id)), formas);
  return Object.entries(esp).reduce((s, [id, m]) => s + (aCop(m, formas.find(f => f.id === id)?.moneda || 'COP', ctx.tasas) || 0), 0);
}

const diaCorto = iso => new Date(iso).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'short' });

registrarVista('/inicio', {
  montar(cont, ctx) {
    const gestion = ctx.puedeVer('verReportesTodos');
    const dia = hoy();
    let datos = { ventas: [], costosVenta: null }, cajas = [], apartados = [], autorizaciones = [];
    const tiles = h('div', { class: 'tiles' });
    let pintar = () => {};
    const porCaja = escucharVentasDeCajas(ctx, () => pintar());
    const auts = h('div', { class: 'autorizaciones' });
    const alertas = h('div', { class: 'alertas' });
    const ventasEl = h('div', { class: 'tarjeta' });
    pintar = () => {
      const r = resumenDia(datos.ventas, datos.costosVenta, ctx.ajustes.formasPago);
      const bajas = inventarioBajo(Object.values(ctx.productos));
      const negativos = Object.values(ctx.productos).filter(p => p.existencia < 0);
      if (gestion) {
        const abiertas = cajas.filter(c => c.estado === 'abierta' && c.tipo !== 'personal');
        const mia = ctx.miCaja;
        porCaja.actualizar(mia ? [...abiertas, mia] : abiertas);
        const enCaja = abiertas.reduce((s, c) => s + totalCajaCop(ctx, c, porCaja.ventas(c.id), apartados), 0);
        const cobrado = mia ? totalCajaCop(ctx, mia, porCaja.ventas(mia.id), apartados) : 0;
        tiles.replaceChildren(
          tile('ventas', 'var(--accent)', 'Ventas de hoy', fmtCop(r.total), `${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'} · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`, 'carrito'),
          tile('ganancia', 'var(--kpi-ganancia)', 'Ganancia', r.ganancia == null ? '—' : fmtCop(r.ganancia), r.gananciaParcial ? 'Calculando costos…' : 'Total menos costo', 'grafica'),
          tile('caja', 'var(--kpi-neutro)', 'En cajas abiertas', fmtCop(enCaja), abiertas.length === 1 ? '1 abierta, en pesos' : `${abiertas.length} abiertas, en pesos`, 'cartera'),
          tile('cobrado', 'var(--t-info)', 'Cobrado por mí hoy', fmtCop(cobrado), 'en pesos · solo informativo', 'monedas'),
          tile('bajas', bajas.length ? 'var(--warn)' : 'var(--muted)', 'Existencias bajas', String(bajas.length), 'en el mínimo o menos', 'caja'));
      } else {
        const mia = ctx.miCaja;
        porCaja.actualizar(mia ? [mia] : []);
        const comision = datos.ventas.filter(v => v.estado !== 'anulada').flatMap(v => v.lineas).reduce((s, l) => s + (l.comision || 0), 0);
        tiles.replaceChildren(
          tile('mis-ventas', 'var(--accent)', 'Mis ventas de hoy', fmtCop(r.total), `${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'} · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`, 'carrito'),
          tile('mi-caja', 'var(--kpi-neutro)', 'Mi caja', mia ? fmtCop(totalCajaCop(ctx, mia, porCaja.ventas(mia.id), apartados)) : 'Cerrada', mia ? 'Debería haber' : 'Ábrela para vender', 'cartera'),
          tile('comision', 'var(--kpi-ganancia)', 'Mi comisión de hoy', fmtCop(comision), null, 'porcentaje'));
      }
      const pendientes = autorizaciones.filter(a => a.estado === 'pendiente');
      auts.replaceChildren(...(ctx.puedeVer('aprobarDescuento') && pendientes.length ? [h('h2', { class: 'sec-t' }, icono('porcentaje'), 'Autorizaciones de descuento'),
        ...pendientes.map(a => h('div', { class: 'autorizacion tarjeta' },
          h('div', {}, h('b', {}, `@${a.solicita} pide ${a.tipo === 'monto' ? fmtCop(a.valor) + ' COP' : a.pct + '%'} de descuento`), h('div', { class: 'nota' }, `Sobre ${fmtCop(a.subtotal || 0)} · ${a.motivo || ''}`)),
          h('div', { class: 'acciones' },
            h('button', { class: 'btn', onclick: e => unaVez(e.currentTarget, async () => { await ctx.almacen.responderAutorizacion(a.id, false); toast('Rechazado'); })() }, 'Rechazar'),
            h('button', { class: 'btn primary', onclick: e => unaVez(e.currentTarget, async () => { const r = await ctx.almacen.responderAutorizacion(a.id, true); toast(r.ok ? 'Aprobado' : 'No se pudo', { malo: !r.ok }); })() }, 'Aprobar'))))] : []));
      const alerta = (txt, detalle) => h('div', { class: 'aviso grave' }, icono('alerta'), h('div', {}, h('b', {}, txt), detalle ? h('div', { class: 'nota' }, detalle) : null));
      const cierres = cajas.filter(c => c.estado === 'cerrada' && c.cierre?.fecha >= inicioDia(dia) && (c.cierre.filas || []).some(f => f.nivel !== 'ok'));
      alertas.replaceChildren(...(gestion ? [
        negativos.length ? alerta('Existencia negativa', negativos.map(p => `${p.grupo} · Talla ${p.talla || p.sku} (${p.existencia})`).join(', ') + '. Se vendió sin conexión más de lo que había: revisa las ventas y ajusta.') : null,
        ...(ctx.porArquear || []).filter(c => c.tipo !== 'personal').map(c => h('div', { class: 'aviso' }, icono('alerta'), h('div', {}, h('b', {}, `La caja de @${c.usuario} del ${diaCorto(c.cierre?.fecha || c.abierta)} se cerró sola y falta arquearla`), h('div', { class: 'nota' }, 'Se arquea cuando cuente el dinero al abrir la caja de hoy.')))),
        ...cierres.map(c => alerta(`Cierre con diferencia · @${c.usuario}`, `${c.cierre.totalCop > 0 ? '+' : ''}${fmtCop(c.cierre.totalCop)} COP · ${c.cierre.nota || ''}`)),
      ].filter(Boolean) : []));
      ventasEl.replaceChildren(h('h2', { class: 'sec-t' }, icono('historial'), gestion ? 'Ventas de hoy' : 'Mis ventas de hoy'), listaVentas(ctx, datos.ventas));
    };
    const q = [
      escucharVentasConCosto(ctx, { desde: dia, hasta: dia }, d => { datos = d; pintar(); }),
      ctx.almacen.escuchar('apartados', l => { apartados = l; pintar(); }),
    ];
    if (gestion) {
      let abiertas = [], recientes = [];
      const unir = () => { const m = new Map([...recientes, ...abiertas].map(c => [c.id, c])); cajas = [...m.values()]; pintar(); };
      q.push(ctx.almacen.escuchar('cajas', l => { abiertas = l; unir(); }, { estado: 'abierta' }));
      q.push(ctx.almacen.escuchar('cajas', l => { recientes = l; unir(); }, { desde: inicioDia(sumarDias(dia, -3)) }));
    }
    if (ctx.puedeVer('aprobarDescuento')) q.push(ctx.almacen.escuchar('autorizaciones', l => { autorizaciones = l; pintar(); }, { estado: 'pendiente' }));
    const alDatos = e => { if (['productos', 'caja', 'tasas', 'ajustes'].includes(e.detail.que)) pintar(); };
    window.addEventListener('pos:datos', alDatos);
    const s = ctx.sesion;
    cont.append(...sin(h('h1', { class: 'saludo' }, 'Hola, ', h('span', {}, (s.nombre || s.usuario).split(' ')[0])), tiles, auts, alertas, ventasEl,
      !gestion && !ctx.miCaja ? h('button', { class: 'btn primary grande', onclick: () => abrirCajaVentana(ctx, () => navegar('/vender')) }, icono('cartera'), 'Abrir caja') : null));
    pintar();
    return () => { q.forEach(x => x()); porCaja.parar(); window.removeEventListener('pos:datos', alDatos); };
  },
});
