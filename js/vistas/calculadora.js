// Calculadora rápida COP / USD / Bs con las tasas del punto de venta (§12.2) y detalle de tasas (§12.1).
import { h, icono, abrirHoja, abrirVentana, despuesDeCerrar, toast, esTelefono } from '../ui.js';
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
      inp.placeholder = sinTasa ? 'Sin tasa' : '';
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
  const borrar = h('button', { class: 'ibtn', id: 'calc-borrar', 'aria-label': 'Borrar todo', onclick: () => { usdBase = null; fuente = null; pintar(); } }, icono('borrador'));
  const hj = abrirHoja({ titulo: 'Calculadora', contenido: h('div', { class: 'pila calc' }, ...filas), modal: tel, extraCab: borrar });
  const lado = document.querySelector('.lado-carrito');
  if (!tel && lado && lado.offsetParent) hj.el.querySelector('.caja').style.marginRight = `${hj.el.getBoundingClientRect().right - lado.getBoundingClientRect().left + 8}px`;
  hj.alCerrar = () => window.removeEventListener('pos:datos', alDatos);
  return hj;
}

const TITULO_BS = { binance: 'Binance P2P', bcv: 'BCV oficial', manual: 'Tasa manual' };

export function abrirDetalleTasas(ctx) {
  const t = ctx.tasas;
  // Sin el día de la semana: «12 nov · 8:00 am».
  const cuando = iso => (iso ? fechaHora(iso).replace(/^\S+ /, '') : 'sin fecha');
  const fila = (cls, ic, etiqueta, valor, moneda, fuente, fecha) => h('div', { class: 'tasa-fila ' + cls },
    h('span', { class: 'tasa-ic' }, icono(ic)),
    h('div', { class: 'tasa-txt' }, h('span', { class: 'tasa-et' }, etiqueta), h('span', { class: 'tasa-dato nota' }, fuente ? h('b', {}, fuente) : null, fuente ? ' · ' : null, cuando(fecha))),
    h('span', { class: 'tasa-val num' }, valor ?? '—', valor != null ? h('small', {}, moneda) : null));
  const tuerca = ctx.puedeVer('cambiarTasas') ? h('button', { class: 'tasas-ajustar', id: 'tasas-ajustes', onclick: () => { v.cerrar(); despuesDeCerrar(() => navegar('/ajustes')); } }, icono('tuerca'), 'Cambiar tasas') : null;
  const cont = h('div', { class: 'tasas-dia' },
    fila('cop', 'monedas', 'Pesos por dólar', t.copPorUsd ? fmtCop(t.copPorUsd) : null, 'COP', '', t.copActualizada),
    // El título es la fuente elegida en Ajustes (Binance P2P, BCV oficial o Tasa manual), sin el recargo; abajo solo la fecha.
    fila('bs', 'banco', TITULO_BS[t.fuenteBs] || t.fuenteBs || 'Bs por dólar',
      t.bsPorUsd ? fmtDec(t.bsPorUsd) : null, 'Bs', t.ultimaConocida ? 'Última conocida' : '', t.bsActualizada),
    !t.bsPorUsd ? h('div', { class: 'aviso' }, icono('alerta'), 'Sin tasa de Bs: los pagos en Bs quedan desactivados.') : null,
    tuerca);
  const v = abrirVentana({ titulo: 'Tasas del día', contenido: cont, clase: 'desplegable', sinCabecera: true });
  return v;
}
