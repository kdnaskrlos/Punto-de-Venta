// v2.26 · Conflictos de sincronización: lo que el servidor rechazó o que dejó existencia negativa.
// Gestión los ve desde Inicio y los marca como revisados (con una nota opcional).
import { h, icono, abrirVentana, toast, unaVez } from '../ui.js';
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';
import { NOMBRE_MONEDA } from '../nucleo/formas.js';
import { fechaHora } from '../nucleo/fechas.js';

const QUE = { venta: 'Venta', apartado: 'Apartado', abono: 'Abono', completar: 'Completar apartado' };
const EXPLICA = {
  rechazada: 'El cobro quedó en este apartado de revisión. Contrasta el comprobante con el dinero de la caja antes de cobrar de nuevo.',
  inventario: 'Se vendió sin conexión y dejó existencia negativa (otro aparato vendió las mismas prendas). La venta se conserva: revisa el inventario y ajusta.',
};

export function tarjetaConflicto(ctx, c) {
  const r = c.resumen || {};
  const cajaId = c.datos?.cajaId || c.datos?.abonos?.[0]?.cajaId;
  const idNota = 'cf-nota-' + c.id;
  const nota = h('input', { class: 'inp', id: idNota, 'data-no-limpiar': '' });
  const listo = h('button', { class: 'btn', type: 'button' }, icono('check'), 'Revisado');
  listo.onclick = unaVez(listo, async () => {
    const res = await ctx.almacen.revisarConflicto(c.id, nota.value);
    toast(res.ok ? 'Marcado como revisado' : 'No se pudo guardar', { malo: !res.ok });
  });
  return h('div', { class: `conflicto ${c.tipo}`, 'data-conflicto': c.id },
    h('div', { class: 'cf-cab' },
      h('span', { class: `est ${c.tipo === 'rechazada' ? 'r' : 'y'}` }, c.tipo === 'rechazada' ? 'Rechazada' : 'Inventario'),
      h('b', {}, `${QUE[c.que] || c.que}${r.total != null ? ' · ' + fmtCop(r.total) + ' COP' : ''}`),
      h('span', { class: 'nota' }, `@${c.usuario} · ${fechaHora(c.fecha || c.detectado)}`)),
    h('p', { class: 'cf-txt' }, EXPLICA[c.tipo]),
    h('div', { class: 'cf-datos' },
      r.cliente ? h('span', {}, icono('usuario'), r.cliente) : null,
      cajaId ? h('span', { class: 'nota' }, `Caja ${cajaId} · Operación ${c.refId}`) : null,
      r.prendas ? h('span', {}, icono('franela'), `${r.prendas} ${r.prendas === 1 ? 'prenda' : 'prendas'}`) : null,
      ...(r.pagos || []).map(p => h('span', { class: 'num' }, icono('billete'), `${p.nombre}: ${fmtMonto(p.monto, p.moneda)} ${NOMBRE_MONEDA[p.moneda] || ''}`))),
    c.negativos?.length ? h('div', { class: 'cf-neg nota' }, 'Quedaron en negativo: ', c.negativos.map(n => `${ctx.productos?.[n.sku]?.nombre || n.sku} (${n.existencia})`).join(', ')) : null,
    h('label', { class: 'cf-et', for: idNota }, 'Qué se hizo (opcional)'),
    h('div', { class: 'cf-acc' }, nota, listo));
}

export function abrirConflictos(ctx, lista) {
  const cont = h('div', { class: 'pila lista-conflictos' }, ...lista.map(c => tarjetaConflicto(ctx, c)));
  return abrirVentana({ titulo: 'Conflictos por revisar', contenido: cont });
}
