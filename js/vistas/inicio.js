import { nombreVenta } from '../nucleo/producto.js';
// Inicio por rol (§13.4): recuadros del día, autorizaciones (admin), alertas y ventas de hoy.
import { h, icono, toast, sin, unaVez, largo } from '../ui.js';
import { registrarVista, navegar } from '../app.js';
import { resumenDia, inventarioBajo } from '../nucleo/reportes.js';
import { esperadoCaja } from '../nucleo/caja.js';
import { aCop } from '../nucleo/tasas.js';
import { fmtCop } from '../nucleo/dinero.js';
import { hoy, sumarDias, inicioDia } from '../nucleo/fechas.js';
import { escucharVentasConCosto, listaVentas } from './ventas-rango.js';

// Tarjetas como en la app de Pedidos: chip con ícono + etiqueta, valor grande, subtítulo de color e ícono de fondo.
// Al tocarlas llevan a la pantalla que explica ese número.
const DESTINO = { ventas: '/reportes', ganancia: '/reportes', caja: '/caja', cobrado: '/caja', bajas: '/inventario', 'mis-ventas': '/reportes', 'mi-caja': '/caja', comision: '/reportes' };
const tile = (k, color, etiqueta, valor, sub, ic) => h('button', { type: 'button', class: 'tile' + (String(valor).length >= 13 ? ' ancha' : '') + (k === 'ventas' || k === 'mis-ventas' ? ' principal' : '') + (String(valor) === '0' ? ' cero' : ''), 'data-k': k, style: `--c:${color}`, onclick: () => DESTINO[k] && navegar(DESTINO[k]) },
  ic ? h('span', { class: 'tile-ic', 'aria-hidden': 'true' }, icono(ic)) : null,
  h('span', { class: 'et' }, ic ? h('span', { class: 'chip-ic' }, icono(ic)) : null, etiqueta),
  h('span', { class: 'val num', 'data-largo': largo(String(valor)) }, valor), sub ? h('span', { class: 'sub' }, sub) : null);

const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function saludo(nombre) {
  const d = new Date(), hr = d.getHours();
  return h('div', { class: 'saludo-caja' },
    h('h1', { class: 'saludo' }, hr < 12 ? 'Buenos días, ' : hr < 19 ? 'Buenas tardes, ' : 'Buenas noches, ', h('span', {}, nombre)),
    h('span', { class: 'fecha-hoy' }, icono('calendario'), `${DIAS_L[d.getDay()][0].toUpperCase()}${DIAS_L[d.getDay()].slice(1)} ${d.getDate()} de ${MESES_L[d.getMonth()]} ${d.getFullYear()}`));
}

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
    listo: id => id in porCaja,
    parar: () => Object.values(subs).forEach(q => q()),
  };
}

function totalCajaCop(ctx, caja, ventas, apartados) {
  const formas = ctx.ajustes.formasPago;
  const esp = esperadoCaja(caja, ventas.filter(v => v.cajaId === caja.id), apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === caja.id)), formas);
  return Object.entries(esp).reduce((s, [id, m]) => s + (aCop(m, formas.find(f => f.id === id)?.moneda || 'COP', ctx.tasas) || 0), 0);
}

// v1.98: lo último que se vio queda en memoria mientras la app está abierta. Al volver a Inicio se muestra
// al instante y se actualiza solo, en vez de pasar por 0 → «—» → cifra real.
const memo = {};

const diaCorto = iso => new Date(iso).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'short' });

registrarVista('/inicio', {
  montar(cont, ctx) {
    const gestion = ctx.puedeVer('verReportesTodos');
    const dia = hoy();
    const clave = `${ctx.sesion?.usuario}|${dia}`;
    const guardado = memo.clave === clave ? memo : {};
    let datos = guardado.datos || null, cajas = guardado.cajas || [], apartados = guardado.apartados || [], autorizaciones = [];
    let llegaron = !!datos;
    // v2.00: cada recuadro sabe si sus datos ya llegaron. Mientras no, muestra lo último que se vio (o el gris
    // que respira la primera vez); así ya no aparecen 0 o «—» por un instante ni montos que saltan.
    let apartadosListos = !!guardado.apartados, cajasListas = !!guardado.cajas;
    const vistos = guardado.vistos || {};
    const tiles = h('div', { class: 'tiles' });
    let pintar = () => {};
    const porCaja = escucharVentasDeCajas(ctx, () => pintar());
    const auts = h('div', { class: 'autorizaciones' });
    const alertas = h('div', { class: 'alertas' });
    const ventasEl = h('div', { class: 'tarjeta' });
    pintar = () => {
      const cargando = !datos;
      const d = datos || { ventas: [], costosVenta: null };
      const r = resumenDia(d.ventas, d.costosVenta, ctx.ajustes.formasPago);
      const bajas = inventarioBajo(Object.values(ctx.productos));
      const negativos = Object.values(ctx.productos).filter(p => p.existencia < 0);
      const lista = [];
      const ponerTile = (k, listo, color, etiqueta, valor, sub, ic) => {
        if (listo) vistos[k] = { valor, sub };
        const v = listo ? { valor, sub } : vistos[k];
        const t = tile(k, color, etiqueta, v ? v.valor : valor, v ? v.sub : sub, ic);
        if (!v) t.classList.add('cargando');
        else if (listo && !llegaron) t.querySelector('.val')?.classList.add('llega');
        lista.push(t);
      };
      if (gestion) {
        const abiertas = cajas.filter(c => c.estado === 'abierta' && c.tipo !== 'personal');
        const mia = ctx.miCaja;
        porCaja.actualizar(mia ? [...abiertas, mia] : abiertas);
        const enCaja = abiertas.reduce((s, c) => s + totalCajaCop(ctx, c, porCaja.ventas(c.id), apartados), 0);
        const cobrado = mia ? totalCajaCop(ctx, mia, porCaja.ventas(mia.id), apartados) : 0;
        const cajasOk = cajasListas && apartadosListos && abiertas.every(c => porCaja.listo(c.id));
        ponerTile('ventas', !cargando, 'var(--tono-verde)', 'Ventas de hoy', fmtCop(r.total), `${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'} · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`, 'carrito');
        ponerTile('ganancia', !cargando && r.ganancia != null && !r.gananciaParcial, 'var(--tono-rosa)', 'Ganancia', r.ganancia == null ? '—' : fmtCop(r.ganancia), 'Total menos costo', 'grafica');
        ponerTile('caja', cajasOk, 'var(--tono-ambar)', 'En cajas abiertas', fmtCop(enCaja), abiertas.length === 1 ? '1 abierta, en pesos' : `${abiertas.length} abiertas, en pesos`, 'cartera');
        ponerTile('cobrado', apartadosListos && (!mia || porCaja.listo(mia.id)), 'var(--tono-naranja)', 'Cobrado por mí hoy', fmtCop(cobrado), 'solo informativo', 'monedas');
        ponerTile('bajas', true, 'var(--tono-turquesa)', 'Existencias bajas', String(bajas.length), 'en el mínimo o menos', 'caja');
      } else {
        const mia = ctx.miCaja;
        porCaja.actualizar(mia ? [mia] : []);
        const comision = d.ventas.filter(v => v.estado !== 'anulada').flatMap(v => v.lineas).reduce((s, l) => s + (l.comision || 0), 0);
        ponerTile('mis-ventas', !cargando, 'var(--tono-verde)', 'Mis ventas de hoy', fmtCop(r.total), `${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'} · ${r.unidades} ${r.unidades === 1 ? 'prenda' : 'prendas'}`, 'carrito');
        ponerTile('mi-caja', apartadosListos && (!mia || porCaja.listo(mia.id)), 'var(--tono-ambar)', 'Mi caja', mia ? fmtCop(totalCajaCop(ctx, mia, porCaja.ventas(mia.id), apartados)) : 'Cerrada', mia ? 'Debería haber' : 'Ábrela para vender', 'cartera');
        ponerTile('comision', !cargando, 'var(--tono-rosa)', 'Mi comisión de hoy', fmtCop(comision), null, 'porcentaje');
      }
      tiles.replaceChildren(...lista);
      if (!cargando) llegaron = true;
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
        negativos.length ? alerta('Existencia negativa', negativos.map(p => `${nombreVenta(p)} · ${p.talla ? 'Talla ' + p.talla : 'Talla única'} (${p.existencia})`).join(', ') + '. Se vendió sin conexión más de lo que había: revisa las ventas y ajusta.') : null,
        ...(ctx.porArquear || []).filter(c => c.tipo !== 'personal').map(c => h('div', { class: 'aviso' }, icono('alerta'), h('div', {}, h('b', {}, `La caja de @${c.usuario} del ${diaCorto(c.cierre?.fecha || c.abierta)} se cerró sola y falta arquearla`), h('div', { class: 'nota' }, 'Se arquea cuando cuente el dinero al abrir la caja de hoy.')))),
        ...cierres.map(c => alerta(`Cierre con diferencia · @${c.usuario}`, `${c.cierre.totalCop > 0 ? '+' : ''}${fmtCop(c.cierre.totalCop)} COP · ${c.cierre.nota || ''}`)),
      ].filter(Boolean) : []));
      // Solo las últimas 5: el total ya está en la tarjeta de arriba; el resto, en Reportes.
      const n = d.ventas.length;
      ventasEl.replaceChildren(h('div', { class: 'cab-sec' }, h('h2', { class: 'sec-t' }, icono('historial'), 'Últimas ventas'),
        n > 5 ? h('button', { class: 'enlace', id: 'ver-todas', onclick: () => navegar('/reportes') }, `Ver las ${n}`) : null),
        cargando ? h('div', { class: 'ventas-cargando', 'aria-busy': 'true' }, h('span', { class: 'esqueleto', style: 'width:100%;height:44px;margin-top:8px' }), h('span', { class: 'esqueleto', style: 'width:100%;height:44px;margin-top:8px' })) : listaVentas(ctx, d.ventas, 5));
      if (datos) Object.assign(memo, { clave, datos, vistos, ...(cajasListas ? { cajas } : {}), ...(apartadosListos ? { apartados } : {}) });
    };
    const q = [
      escucharVentasConCosto(ctx, { desde: dia, hasta: dia }, d => { datos = d; pintar(); }),
      ctx.almacen.escuchar('apartados', l => { apartados = l; apartadosListos = true; pintar(); }),
    ];
    if (gestion) {
      let abiertas = [], recientes = [];
      let okA = false, okR = false;
      const unir = () => { const m = new Map([...recientes, ...abiertas].map(c => [c.id, c])); cajas = [...m.values()]; if (okA && okR) cajasListas = true; pintar(); };
      q.push(ctx.almacen.escuchar('cajas', l => { abiertas = l; okA = true; unir(); }, { estado: 'abierta' }));
      q.push(ctx.almacen.escuchar('cajas', l => { recientes = l; okR = true; unir(); }, { desde: inicioDia(sumarDias(dia, -3)) }));
    }
    if (ctx.puedeVer('aprobarDescuento')) q.push(ctx.almacen.escuchar('autorizaciones', l => { autorizaciones = l; pintar(); }, { estado: 'pendiente' }));
    const alDatos = e => { if (['productos', 'caja', 'tasas', 'ajustes'].includes(e.detail.que)) pintar(); };
    window.addEventListener('pos:datos', alDatos);
    const s = ctx.sesion;
    // Sin botón «Abrir caja» en el Inicio de la vendedora: la caja se abre desde Vender.
    cont.append(...sin(saludo((s.nombre || s.usuario).split(' ')[0]), tiles, auts, alertas, ventasEl));
    pintar();
    return () => { q.forEach(x => x()); porCaja.parar(); window.removeEventListener('pos:datos', alDatos); };
  },
});
