// Calculadora rápida COP / USD / Bs con las tasas del punto de venta (§12.2) y detalle de tasas (§12.1).
import { h, icono, abrirHoja, abrirVentana, toast, esTelefono } from '../ui.js';
import { navegar } from '../app.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { copPorBs } from '../nucleo/tasas.js';
import { fechaHora } from '../nucleo/fechas.js';

const CAMPOS = [
  { id: 'cop', moneda: 'COP', nombre: 'Peso colombiano (COP)', prefijo: 'COP', ic: 'monedas', copiar: 'Copiar pesos', clase: 'c-cop' },
  { id: 'usd', moneda: 'USD', nombre: 'Dólar americano (USD)', prefijo: '$', ic: 'billete', copiar: 'Copiar dólares', clase: 'c-usd' },
  { id: 'bs', moneda: 'BS', nombre: 'Bs (VES)', prefijo: 'Bs.', ic: 'banco', copiar: 'Copiar Bs', clase: 'c-bs' },
];

export function abrirCalculadora(ctx) {
  let usdBase = null, fuente = null;
  const inputs = {};
  const tasaPill = {};
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
    tasaPill[c.id] = c.id === 'usd' ? null : h('span', { class: 'calc-tasa num' });
    return h('div', { class: 'campo calc-fila' },
      h('div', { class: 'calc-cab' }, h('label', { for: 'calc-' + c.id, class: c.clase }, icono(c.ic), c.nombre), tasaPill[c.id]),
      h('div', { class: 'calc-caja' }, h('span', { class: 'calc-pre' }, c.prefijo), inp, copiar));
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
    if (tasaPill.cop) tasaPill.cop.textContent = t.copPorUsd ? `Tasa: ${fmtDec(t.copPorUsd)}` : 'Sin tasa';
    if (tasaPill.bs) tasaPill.bs.textContent = t.bsPorUsd ? `Tasa: ${fmtDec(t.bsPorUsd)}` : 'Sin tasa';
  }
  pintar();
  const alDatos = e => { if (e.detail.que === 'tasas') pintar(); };
  window.addEventListener('pos:datos', alDatos);
  // En PC no tapa el carrito: se abre a su izquierda y sin bloquear la pantalla.
  const tel = esTelefono();
  const hj = abrirHoja({ titulo: 'Calculadora', contenido: h('div', { class: 'pila calc' }, ...filas), modal: tel });
  const lado = document.querySelector('.lado-carrito');
  if (!tel && lado && lado.offsetParent) hj.el.querySelector('.caja').style.marginRight = `${hj.el.getBoundingClientRect().right - lado.getBoundingClientRect().left + 8}px`;
  hj.alCerrar = () => window.removeEventListener('pos:datos', alDatos);
  return hj;
}

const FUENTE = { binance: 'Binance P2P', bcv: 'BCV (oficial)', manual: 'Manual' };

export function abrirDetalleTasas(ctx) {
  const t = ctx.tasas, aj = ctx.ajustesTasas || {};
  const cuando = iso => (iso ? fechaHora(iso) : 'sin fecha');
  const cxb = copPorBs(t);
  const tarjeta = (cls, color, ic, etiqueta, valor, moneda, fuente, fecha) => h('div', { class: 'tasa-tile ' + cls, style: `--c:${color}` },
    h('span', { class: 'tile-ic', 'aria-hidden': 'true' }, icono(ic)),
    h('span', { class: 'et' }, h('span', { class: 'chip-ic' }, icono(ic)), etiqueta),
    h('span', { class: 'tasa-val num' }, valor ?? '—', valor != null ? h('small', {}, moneda) : null),
    h('span', { class: 'tasa-meta' }, h('span', { class: 'tasa-fuente' }, fuente), h('span', { class: 'nota' }, icono('reloj'), cuando(fecha))));
  const cont = h('div', { class: 'pila tasas-dia' },
    h('div', { class: 'tasas-tiles' },
      tarjeta('cop', 'var(--cop)', 'monedas', 'Pesos por dólar', t.copPorUsd ? fmtCop(t.copPorUsd) : null, 'COP', 'Manual', t.copActualizada),
      tarjeta('bs', 'var(--bs)', 'banco', 'Bs por dólar', t.bsPorUsd ? fmtDec(t.bsPorUsd) : null, 'Bs',
        `${FUENTE[t.fuenteBs] || t.fuenteBs || '—'}${t.fuenteBs === 'binance' && aj.bsRecargo ? ` + ${fmtDec(aj.bsRecargo)}` : ''}${t.ultimaConocida ? ' · última conocida' : ''}`, t.bsActualizada)),
    h('div', { class: 'equivalencias' }, ...[
      t.copPorUsd && ['c-usd', `1 USD = ${fmtCop(t.copPorUsd)} COP`],
      t.bsPorUsd && ['c-usd', `1 USD = ${fmtDec(t.bsPorUsd)} Bs`],
      cxb && ['c-bs', `1 Bs = ${fmtDec(cxb)} COP`],
    ].filter(Boolean).map(([c, txt]) => h('span', { class: 'equiv num ' + c }, txt))),
    !t.bsPorUsd ? h('div', { class: 'aviso' }, icono('alerta'), 'Sin tasa de Bs: los pagos en Bs quedan desactivados.') : null);
  const acciones = ctx.puedeVer('cambiarTasas') ? h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: () => { v.cerrar(); setTimeout(() => navegar('/ajustes'), 0); } }, icono('ajustes'), 'Cambiar tasas')) : null;
  const v = abrirVentana({ titulo: 'Tasas del día', contenido: cont, acciones });
  return v;
}
