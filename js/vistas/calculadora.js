// Calculadora rápida COP / USD / Bs con las tasas del punto de venta (§12.2) y detalle de tasas (§12.1).
import { h, icono, abrirHoja, abrirVentana, despuesDeCerrar, esTelefono } from '../ui.js';
import { navegar } from '../app.js';
import { abrirPestana } from './ajustes.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { copPorBs } from '../nucleo/tasas.js';
import { leerTasaRemota } from '../datos/tasa-remota.js';

const CAMPOS = [
  { id: 'cop', moneda: 'COP', nombre: 'Peso colombiano (COP)', prefijo: 'COP', ic: 'monedas', copiar: 'Copiar pesos', clase: 'c-cop' },
  { id: 'usd', moneda: 'USD', nombre: 'Dólar americano (USD)', prefijo: '$', ic: 'billete', copiar: 'Copiar dólares', clase: 'c-usd' },
  { id: 'bs', moneda: 'BS', nombre: 'Bs (VES)', prefijo: 'Bs.', ic: 'banco', copiar: 'Copiar Bs', clase: 'c-bs' },
];

// v2.15: una sola calculadora; tocar el ícono otra vez la cierra.
let abierta = null;
export function abrirCalculadora(ctx) {
  if (abierta && abierta.el.isConnected) { abierta.cerrar(); abierta = null; return null; }
  let usdBase = null, fuente = null;
  const inputs = {};
  const estado = h('span', { class: 'solo-lector', role: 'status', 'aria-live': 'polite' });
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
    // v2.00: al copiar, el ícono pasa a ✓ un momento (sin aviso de la app: en Android ya sale el del sistema).
    let tCopia = 0;
    const copiar = h('button', { class: 'ibtn', 'aria-label': c.copiar, onclick: async e => {
      if (!inp.value) return;
      const b = e.currentTarget;
      try {
        await navigator.clipboard.writeText(inp.value);
        b.classList.add('copiado'); b.replaceChildren(icono('check')); b.setAttribute('aria-label', 'Copiado');
        estado.textContent = `${c.nombre}: ${inp.value} copiado`;
        clearTimeout(tCopia); tCopia = setTimeout(() => { b.classList.remove('copiado'); b.replaceChildren(icono('copiar')); b.setAttribute('aria-label', c.copiar); }, 1400);
      } catch { inp.select(); }
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
  // v2.17 · PC: debajo, las referencias Binance P2P y BCV (como en la Super Calculadora).
  const refs = esTelefono() ? null : referencias(ctx);
  const alDatos = e => { if (e.detail.que === 'tasas') { pintar(); refs?.pintar(); } };
  window.addEventListener('pos:datos', alDatos);
  // En PC no tapa el carrito: se abre a su izquierda y sin bloquear la pantalla.
  const tel = esTelefono();
  const borrar = h('button', { class: 'ibtn', id: 'calc-borrar', 'aria-label': 'Borrar todo', onclick: () => { usdBase = null; fuente = null; pintar(); } }, icono('borrador'));
  // v2.18 · PC: junto al borrador, una tuerca que lleva a Ajustes › Tasas.
  const ajustes = tel ? null : h('button', { class: 'ibtn', id: 'calc-ajustes', 'aria-label': 'Ajustes de tasas', onclick: () => { abrirPestana('tasas'); hj.cerrar(); despuesDeCerrar(() => navegar('/ajustes')); } }, icono('tuerca'));
  const hj = abrirHoja({ titulo: 'Calculadora', contenido: h('div', { class: 'pila calc' }, ...filas, estado, ...(refs ? [refs.el] : [])), modal: tel, extraCab: ajustes ? h('span', { class: 'calc-extra' }, borrar, ajustes) : borrar });
  hj.el.querySelector('.caja')?.classList.add('calc2');
  hj.el.querySelector('.cab h2')?.prepend(icono('calculadora')); // v2.06: ícono en la cabecera
  hj.alCerrar = () => { window.removeEventListener('pos:datos', alDatos); refs?.quitar(); if (abierta === hj) abierta = null; };
  abierta = hj;
  return hj;
}


// v2.17 · Referencias de la Super Calculadora (Binance P2P y BCV), con el mismo diseño y los mismos textos.
// Lee el tasa.json que ya trae la app (ctx.tasaRemota); «Actualizar» lo vuelve a leer al instante.
const SVG_BIN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/></svg>';
const SVG_BCV = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 20 7H4z"/></svg>';
const SVG_ACT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>';
const STALE_MS = 1.5 * 3600 * 1000;
const nfChg = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const nfPct = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const two = n => (n < 10 ? '0' + n : String(n));
function hace(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return 'hace ' + m + ' min';
  const hh = Math.floor(m / 60); if (hh < 24) return 'hace ' + hh + (hh === 1 ? ' hora' : ' horas');
  const d = Math.floor(hh / 24); return 'hace ' + d + (d === 1 ? ' día' : ' días');
}
function sello(ts) { // 15-11-2026 03:07 pm
  const d = new Date(ts); let hr = d.getHours(); const ap = hr >= 12 ? 'pm' : 'am'; hr = hr % 12 || 12;
  return two(d.getDate()) + '-' + two(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + two(hr) + ':' + two(d.getMinutes()) + ' ' + ap;
}
const pct = (v, base) => (base > 0 ? nfPct.format((v / base - 1) * 100) + ' %' : '—');

function referencias(ctx) {
  let error = false, cargando = false;
  const seccion = (clave, etiqueta, nombre, par, svg) => {
    const val = h('b', {}, '—'), chg = h('span', { class: 'q-chg' }), fecha = h('p', { class: 'q-date' }), meta = h('p', { class: 'usdt-meta', 'aria-live': 'polite' });
    const act = h('button', { class: 'link-btn', type: 'button', 'data-ref': clave, onclick: () => actualizar() });
    act.innerHTML = SVG_ACT + 'Actualizar';
    const badge = h('span', { class: 'q-badge' + (clave === 'bcv' ? ' bcv' : ''), 'aria-hidden': 'true' }); badge.innerHTML = svg;
    const el = h('section', { class: 'ref', 'aria-label': etiqueta },
      h('div', { class: 'usdt-head' }, h('span', { class: 'label' }, etiqueta), h('div', { class: 'usdt-actions' }, act)),
      h('div', { class: 'quote' }, h('div', { class: 'q-main' }, badge, h('div', { class: 'q-name' }, h('strong', {}, nombre), h('span', {}, par)), h('div', { class: 'q-val' }, val, chg)), fecha),
      meta);
    return { el, val, chg, fecha, meta, act };
  };
  const bin = seccion('binance', 'Binance P2P', 'Binance', 'USDT / VES', SVG_BIN);
  const bcv = seccion('bcv', 'BCV oficial', 'BCV', 'USD / VES', SVG_BCV);
  const el = h('footer', { class: 'calc-refs' }, bin.el, bcv.el);
  const poner = (s, dato, estale) => {
    if (!dato) { s.val.textContent = '—'; s.chg.textContent = ''; s.chg.className = 'q-chg'; s.fecha.textContent = ''; s.meta.className = 'usdt-meta';
      s.meta.textContent = cargando ? 'Cargando…' : error ? 'No se pudo leer el dato. Revisa tu conexión y toca Actualizar.' : 'Todavía sin dato'; return; }
    s.val.textContent = fmtDec(dato.ves); s.fecha.textContent = sello(dato.ts);
    if (typeof dato.chg === 'number') { s.chg.textContent = nfChg.format(dato.chg) + '%'; s.chg.className = 'q-chg' + (dato.chg > 0 ? ' up' : dato.chg < 0 ? ' down' : ''); }
    else { s.chg.textContent = ''; s.chg.className = 'q-chg'; }
    const edad = Date.now() - (dato.revisado || dato.ts), dif = 'Frente a tu tasa en Bs.: ' + pct(dato.ves, ctx.tasas?.bsPorUsd) + '.';
    if (error) { s.meta.className = 'usdt-meta stale'; s.meta.textContent = 'No se pudo actualizar. Se muestra el último valor guardado. ' + hace(edad) + ' / ' + dif; }
    else if (estale && edad >= STALE_MS) { s.meta.className = 'usdt-meta stale'; s.meta.textContent = 'El valor tiene ' + hace(edad).replace('hace ', '') + ' sin actualizarse. ' + dif; }
    else { s.meta.className = 'usdt-meta'; s.meta.textContent = hace(edad) + ' / ' + dif; }
  };
  function pintar() {
    const t = ctx.tasaRemota, fecha = x => { const n = Date.parse(x); return isNaN(n) ? null : n; };
    const dBin = t && t.rate > 0 && fecha(t.updated_at) ? { ves: t.rate, ts: fecha(t.updated_at), chg: t.change_pct } : null;
    const b = t?.bcv, dBcv = b && b.rate > 0 ? { ves: b.rate, ts: fecha(b.updated_at) || fecha(t.updated_at) || Date.now(), revisado: fecha(b.checked_at), chg: b.change_pct } : null;
    poner(bin, dBin, true); poner(bcv, dBcv, false);
  }
  async function actualizar() {
    if (cargando) return;
    cargando = true; for (const s of [bin, bcv]) s.act.classList.add('busy');
    const t = await leerTasaRemota(fetch.bind(window));
    cargando = false; for (const s of [bin, bcv]) s.act.classList.remove('busy');
    error = !t;
    if (t) { ctx.tasaRemota = t; ctx.recalcularTasas?.(); }
    pintar();
  }
  pintar();
  const reloj = setInterval(pintar, 60 * 1000); // «hace N min» al día
  return { el, pintar, quitar: () => clearInterval(reloj) };
}
