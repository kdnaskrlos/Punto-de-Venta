// Calculadora rápida COP / USD / Bs con las tasas del punto de venta (§12.2) y detalle de tasas (§12.1).
import { h, icono, abrirHoja, abrirVentana, toast, esTelefono } from '../ui.js';
import { navegar } from '../app.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { copPorBs } from '../nucleo/tasas.js';
import { fechaHora } from '../nucleo/fechas.js';

const CAMPOS = [
  { id: 'cop', moneda: 'COP', nombre: 'Peso colombiano', copiar: 'Copiar pesos', clase: 'c-cop' },
  { id: 'usd', moneda: 'USD', nombre: 'Dólar', copiar: 'Copiar dólares', clase: 'c-usd' },
  { id: 'bs', moneda: 'BS', nombre: 'Bolívar', copiar: 'Copiar bolívares', clase: 'c-bs' },
];

export function abrirCalculadora(ctx) {
  let usdBase = null, fuente = null;
  const inputs = {};
  const pie = h('p', { class: 'nota calc-pie num' });
  const filas = CAMPOS.map(c => {
    const inp = h('input', { class: 'inp num', id: 'calc-' + c.id, inputmode: 'decimal', autocomplete: 'off' });
    inputs[c.id] = inp;
    inp.addEventListener('input', () => {
      const n = parseMonto(inp.value, c.moneda);
      fuente = c.id;
      const t = ctx.tasas;
      if (n == null) usdBase = null;
      else if (c.id === 'usd') usdBase = n;
      else if (c.id === 'cop') usdBase = t.copPorUsd ? n / t.copPorUsd : null;
      else usdBase = t.bsPorUsd ? n / t.bsPorUsd : null;
      pintar();
    });
    inp.addEventListener('blur', () => { fuente = null; pintar(); });
    const copiar = h('button', { class: 'ibtn', 'aria-label': c.copiar, onclick: async () => {
      if (!inp.value) return;
      try { await navigator.clipboard.writeText(inp.value); toast('Copiado'); } catch { inp.select(); }
    } }, icono('copiar'));
    return h('div', { class: 'campo calc-fila' }, h('label', { for: 'calc-' + c.id, class: c.clase }, c.nombre, ' ', h('b', {}, c.moneda === 'BS' ? 'Bs' : c.moneda)), h('div', { class: 'calc-entrada' }, inp, copiar));
  });
  function pintar() {
    const t = ctx.tasas;
    const valores = {
      cop: usdBase != null && t.copPorUsd ? fmtCop(usdBase * t.copPorUsd) : '',
      usd: usdBase != null ? fmtDec(usdBase) : '',
      bs: usdBase != null && t.bsPorUsd ? fmtDec(usdBase * t.bsPorUsd) : '',
    };
    for (const c of CAMPOS) {
      const inp = inputs[c.id];
      const sinTasa = (c.id === 'bs' && !t.bsPorUsd) || (c.id !== 'usd' && !t.copPorUsd);
      inp.placeholder = sinTasa ? 'Sin tasa' : '0';
      inp.disabled = sinTasa;
      if (c.id !== fuente) inp.value = sinTasa ? '' : valores[c.id];
    }
    const cxb = copPorBs(t);
    // Cada equivalencia en su propio bloque: si no caben, bajan enteras a la línea siguiente (nunca se cortan).
    pie.replaceChildren(...[t.copPorUsd && `1 USD = ${fmtCop(t.copPorUsd)} COP`, t.bsPorUsd && `1 USD = ${fmtDec(t.bsPorUsd)} Bs`, cxb && `1 Bs = ${fmtDec(cxb)} COP`].filter(Boolean).map(x => h('span', {}, x)));
  }
  pintar();
  const alDatos = e => { if (e.detail.que === 'tasas') pintar(); };
  window.addEventListener('pos:datos', alDatos);
  // En PC no tapa el carrito: se abre a su izquierda y sin bloquear la pantalla.
  const tel = esTelefono();
  const hj = abrirHoja({ titulo: 'Calculadora', contenido: h('div', { class: 'pila calc' }, ...filas, pie), modal: tel });
  const lado = document.querySelector('.lado-carrito');
  if (!tel && lado && lado.offsetParent) hj.el.querySelector('.caja').style.marginRight = `${hj.el.getBoundingClientRect().right - lado.getBoundingClientRect().left + 8}px`;
  hj.alCerrar = () => window.removeEventListener('pos:datos', alDatos);
  return hj;
}

const FUENTE = { binance: 'Binance P2P', bcv: 'BCV (oficial)', manual: 'Manual' };

export function abrirDetalleTasas(ctx) {
  const t = ctx.tasas, aj = ctx.ajustesTasas || {};
  const cuando = iso => (iso ? fechaHora(iso) : '—');
  const cxb = copPorBs(t);
  const fila = (et, val, sub) => h('div', { class: 'tasa-fila' }, h('div', {}, h('div', { class: 'nota' }, et), sub ? h('div', { class: 'nota chica' }, sub) : null), h('b', { class: 'num' }, val));
  const cont = h('div', { class: 'pila' },
    fila('Pesos por dólar', t.copPorUsd ? `${fmtCop(t.copPorUsd)} COP` : 'Sin tasa', `Manual · Último cambio: ${cuando(t.copActualizada)}`),
    fila('Bolívares por dólar', t.bsPorUsd ? `${fmtDec(t.bsPorUsd)} Bs` : 'Sin tasa',
      `${FUENTE[t.fuenteBs] || t.fuenteBs}${t.fuenteBs === 'binance' && aj.bsRecargo ? ` + ${fmtDec(aj.bsRecargo)} Bs de recargo` : ''} · ${t.ultimaConocida ? 'Última conocida: ' : 'Actualizada: '}${cuando(t.bsActualizada)}`),
    cxb ? h('p', { class: 'nota num' }, `1 Bs = ${fmtDec(cxb)} COP`) : null,
    !t.bsPorUsd ? h('div', { class: 'aviso' }, icono('alerta'), 'Sin tasa de Bs: los pagos en bolívares quedan desactivados.') : null);
  const acciones = ctx.puedeVer('cambiarTasas') ? h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: () => { v.cerrar(); setTimeout(() => navegar('/ajustes'), 0); } }, icono('ajustes'), 'Cambiar tasas')) : null;
  const v = abrirVentana({ titulo: 'Tasas del día', contenido: cont, acciones });
  return v;
}
