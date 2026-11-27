// v2.25 · Reporte de cierre de caja: se abre al tocar una caja cerrada.
// Resultado (Sobrante / Faltante / Cuadró), desglose por forma de pago, resumen del día, nota y envío por WhatsApp.
import { h, icono, abrirVentana, esTelefono } from '../ui.js';
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';
import { NOMBRE_MONEDA } from '../nucleo/formas.js';
import { fechaHora } from '../nucleo/fechas.js';
import { aCop } from '../nucleo/tasas.js';

const NIVEL = { ok: 'g', leve: 'y', grave: 'r' };

function leerUnaVez(ctx, coleccion, filtro) {
  return new Promise(res => {
    let listo = false, q = null;
    q = ctx.almacen.escuchar(coleccion, l => { if (listo) return; listo = true; res(l); setTimeout(() => q && q()); }, filtro);
    if (listo) setTimeout(() => q && q());
  });
}

const firmado = (n, moneda) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtMonto(Math.abs(n), moneda)}`;

export function resultadoCierre(totalCop) {
  const n = Math.round(totalCop || 0);
  if (!n) return { clase: 'g', titulo: 'Cuadró', monto: '' };
  return n > 0 ? { clase: 'y', titulo: 'Sobrante', monto: `+${fmtCop(n)} COP` } : { clase: 'r', titulo: 'Faltante', monto: `−${fmtCop(-n)} COP` };
}

export async function abrirReporteCierre(ctx, caja) {
  const [ventas, apartados] = await Promise.all([leerUnaVez(ctx, 'ventas', { cajaId: caja.id }), leerUnaVez(ctx, 'apartados')]);
  const formas = ctx.ajustes.formasPago || [];
  const nombreForma = id => formas.find(f => f.id === id)?.nombre || id;
  const ci = caja.cierre || {};
  const res = resultadoCierre(ci.totalCop);
  const validas = ventas.filter(v => v.estado !== 'anulada'), anuladas = ventas.length - validas.length;
  const vendido = validas.reduce((s, v) => s + (v.total || 0), 0);
  const prendas = validas.reduce((s, v) => s + (v.lineas || []).reduce((t, l) => t + (l.cantidad || 0), 0), 0);
  const abonos = apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === caja.id));
  const abonado = abonos.reduce((s, a) => s + (a.equivalenteCop ?? aCop(a.monto, a.moneda, ctx.tasas) ?? 0), 0);
  const movs = caja.movimientos || [];
  const monedaDe = f => formas.find(x => x.id === f)?.moneda || 'COP';
  const movCop = tipo => movs.filter(m => m.tipo === tipo).reduce((s, m) => s + (aCop(m.monto, monedaDe(m.forma), ctx.tasas) ?? 0), 0);
  const fondo = Object.entries(caja.fondo || {}).filter(([, n]) => n).map(([m, n]) => `${fmtMonto(n, m)} ${NOMBRE_MONEDA[m]}`).join(' · ') || 'Sin fondo';
  const modo = ci.automatico ? (ci.arqueo ? `Cierre automático · arqueada por @${ci.arqueo.por} el ${fechaHora(ci.arqueo.fecha)}` : 'Cierre automático a medianoche') : 'Cierre manual';

  const filas = (ci.filas || []).map(f => h('div', { class: `rc-fila n-${f.nivel || 'ok'}` },
    h('span', { class: 'rc-forma' }, nombreForma(f.forma)),
    h('span', { class: 'num' }, `${fmtMonto(f.esperado, f.moneda)}`),
    h('span', { class: 'num' }, `${fmtMonto(f.contado, f.moneda)}`),
    h('span', { class: 'num rc-dif' }, f.diferencia ? firmado(f.diferencia, f.moneda) : '0', h('small', {}, ' ' + NOMBRE_MONEDA[f.moneda]))));
  const dato = (et, val) => h('div', { class: 'rc-dato' }, h('span', {}, et), h('b', { class: 'num' }, val));

  const contenido = h('div', { class: 'pila rep-cierre' },
    h('div', { class: 'rc-quien' }, h('b', {}, `@${caja.usuario}`), h('span', { class: 'nota' }, `Abrió ${fechaHora(caja.abierta)}`), ci.fecha ? h('span', { class: 'nota' }, `Cerró ${fechaHora(ci.fecha)}`) : null, h('span', { class: 'nota' }, modo)),
    h('div', { class: `rc-resultado ${res.clase}` }, h('span', {}, res.titulo), res.monto ? h('b', { class: 'num' }, res.monto) : null,
      ci.totalCop ? h('small', { class: 'num' }, `Esperado ${fmtCop(Math.round(ci.totalEsperadoCop || 0))} · Contado ${fmtCop(Math.round(ci.totalContadoCop || 0))} COP`) : null),
    filas.length ? h('div', { class: 'rc-tabla' }, h('div', { class: 'rc-fila cab' }, h('span', {}, 'Forma de pago'), h('span', {}, 'Esperado'), h('span', {}, 'Contado'), h('span', {}, 'Diferencia')), ...filas) : null,
    h('div', { class: 'rc-resumen' },
      dato('Fondo inicial', fondo),
      dato('Ventas', `${validas.length} · ${fmtCop(vendido)} COP`),
      dato('Prendas vendidas', String(prendas)),
      anuladas ? dato('Anuladas', String(anuladas)) : null,
      dato('Abonos de apartados', `${abonos.length} · ${fmtCop(Math.round(abonado))} COP`),
      dato('Entradas', `${movs.filter(m => m.tipo !== 'salida').length} · ${fmtCop(Math.round(movCop('entrada')))} COP`),
      dato('Salidas', `${movs.filter(m => m.tipo === 'salida').length} · ${fmtCop(Math.round(movCop('salida')))} COP`)),
    ci.nota ? h('div', { class: 'rc-nota' }, h('span', {}, 'Nota'), h('p', {}, ci.nota)) : null);

  // Texto para WhatsApp (negritas con *).
  const texto = [
    `*Cierre de caja · @${caja.usuario}*`,
    `Abrió: ${fechaHora(caja.abierta)}`, ci.fecha ? `Cerró: ${fechaHora(ci.fecha)}` : null, modo, '',
    `*${res.titulo}${res.monto ? ': ' + res.monto : ''}*`, '',
    ...(ci.filas || []).map(f => `${nombreForma(f.forma)}: esperado ${fmtMonto(f.esperado, f.moneda)} · contado ${fmtMonto(f.contado, f.moneda)} · dif. ${f.diferencia ? firmado(f.diferencia, f.moneda) : '0'} ${NOMBRE_MONEDA[f.moneda]}`), '',
    `Fondo inicial: ${fondo}`, `Ventas: ${validas.length} (${fmtCop(vendido)} COP) · ${prendas} prendas`, anuladas ? `Anuladas: ${anuladas}` : null,
    `Abonos: ${abonos.length} (${fmtCop(Math.round(abonado))} COP)`, `Entradas: ${fmtCop(Math.round(movCop('entrada')))} COP · Salidas: ${fmtCop(Math.round(movCop('salida')))} COP`,
    ci.nota ? `\nNota: ${ci.nota}` : null,
  ].filter(x => x != null).join('\n');
  const enviar = h('button', { class: 'btn primary grande', id: 'rc-whatsapp', onclick: () => window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener') }, icono('mensaje'), 'Enviar por WhatsApp');
  return abrirVentana({ titulo: 'Cierre de caja', contenido, acciones: h('div', { class: 'acciones' }, enviar), clase: esTelefono() ? undefined : 'ventana-cierre' });
}
