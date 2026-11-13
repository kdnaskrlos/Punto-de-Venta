// Ayudas de interfaz: crear elementos, íconos, ventanas, hojas y avisos breves.
const ICONOS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  carrito: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  apartado: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  caja: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  cartera: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  grafica: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  ajustes: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  mas: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  calculadora: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  actualizar: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  escanear: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 7v10M12 7v10M17 7v10"/>',
  buzo: '<path d="M8.5 3 5 4.6a2 2 0 0 0-1.2 1.6L3 19h3l1-8v10h10V11l1 8h3l-.8-12.8A2 2 0 0 0 19 4.6L15.5 3"/><path d="M8.5 3a3.5 3.5 0 0 0 7 0"/><path d="M9.5 16h5"/>',
  chaqueta: '<path d="M8 3 4.6 4.7a2 2 0 0 0-1.1 1.6L3 19h3l1-8v10h10V11l1 8h3l-.5-12.7a2 2 0 0 0-1.1-1.6L16 3"/><path d="m8 3 4 3 4-3"/><path d="M12 6v15"/>',
  pantalon: '<path d="M6 2h12l1 19h-5l-2-12-2 12H5z"/><path d="M6 6h12"/>',
  short: '<path d="M5 4h14l1.5 12-6.5 1-2-6-2 6-6.5-1z"/><path d="M5 8h14"/>',
  body: '<path d="M9 3a3 3 0 0 0 6 0l4 2 2 4-3 1.5V15c0 2-1.5 3-3 3.5L14 21h-4l-1-2.5C7.5 18 6 17 6 15v-4.5L3 9l2-4z"/>',
  vestido: '<path d="M9 2v3L7 9l2.5 1L5 22h14l-4.5-12L17 9l-2-4V2"/><path d="M9 5h6"/>',
  gorra: '<path d="M3.5 15a8.5 7 0 0 1 17 0z"/><path d="M12 8V6.5"/><path d="M3.5 15c4 1.6 10 1.8 15 .2l2.5 1.3"/>',
  camisa: '<path d="M20.4 6.6 16 3h-2l-2 3-2-3H8L3.6 6.6a1 1 0 0 0-.2 1.2L5 11h2v10h10V11h2l1.6-3.2a1 1 0 0 0-.2-1.2z"/><path d="M12 6v6"/>',
  franela: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  mas1: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  menos: '<path d="M5 12h14"/>',
  borrar: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  calendario: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  mensaje: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  etiqueta: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  imagen: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  porcentaje: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  monedas: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
  luna: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  borrador: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  tuerca: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  matraz: '<path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.07-10.13a2 2 0 0 1-.21-.9V2"/><path d="M8.5 2h7M7 16h10"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  billete: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  banco: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"/>',
  tarjeta: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  movil: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  cripto: '<path d="M11.77 19.09c4.92.87 6.14-6.03 1.21-6.9m-1.21 6.9-5.91-1.04m5.91 1.04-.35 1.97m1.56-8.86c4.93.87 6.14-6.03 1.22-6.9m-1.22 6.9-3.94-.7m5.16-6.2L8.29 4.26m5.91 1.04.35-1.97M7.48 20.36l3.13-17.72"/>',
  envio: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  lapiz: '<path d="M21.17 6.81a1 1 0 0 0-3.98-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  recibo: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  izq: '<path d="m15 18-6-6 6-6"/>', der: '<path d="m9 18 6-6-6-6"/>', abajo: '<path d="m6 9 6 6 6-6"/>',
  llave: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4M21 2l-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  prohibido: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  historial: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
};

export function icono(nombre) {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
  return t.content.firstChild;
}

// Logo de la app: el carrito blanco de logo-carrito.png (misma forma que el ícono instalado).
export function logo() {
  const img = document.createElement('img');
  img.src = 'logo-carrito.png'; img.alt = ''; img.className = 'logo-img';
  img.setAttribute('aria-hidden', 'true');
  return img;
}

// h('button', {class:'btn', onclick}, 'texto', icono('x'))
export function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  // Sin autocompletado del navegador (en Android saca una barra de llaves, tarjetas y direcciones encima del teclado)
  if (tag === 'input' && !['checkbox', 'radio', 'file'].includes(attrs?.type) && !(attrs && 'autocomplete' in attrs)) el.setAttribute('autocomplete', 'off');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// ---- Capas (ventanas y hojas): Esc y el botón atrás cierran la de arriba primero ----
const pila = [];
let ignorarPop = 0;
// Si se abre una capa mientras el "atrás" de la que se cerró aún no termina, su entrada de historial
// se agrega al terminar ese "atrás" (si no, el atrás se comería la nueva y luego se saldría de la app).
let entradasPendientes = 0;
// En cualquier campo de una sola línea, Enter = "Listo": oculta el teclado.
document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Enter' && !e.defaultPrevented && t instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(t.type)) t.blur();
});
let trasAtras = [];
// Ejecuta fn cuando termina el "atrás" de la capa que se acaba de cerrar (para navegar sin que ese atrás se lo coma).
export function despuesDeCerrar(fn) {
  if (ignorarPop > 0) trasAtras.push(fn); else fn();
}
function entrarHistorial() {
  if (ignorarPop > 0) entradasPendientes++;
  else history.pushState({ capa: pila.length }, '');
}
function salirHistorial() {
  if (entradasPendientes > 0) { entradasPendientes--; return; }
  ignorarPop++;
  history.back();
}

function abrirCapa(el) {
  document.body.append(el);
  const capa = { el, cerrada: false, alCerrar: null };
  pila.push(capa);
  entrarHistorial();
  // En el teléfono no se enfoca un campo al abrir (abriría el teclado y taparía la ventana); solo si lo pide [autofocus].
  const foco = el.querySelector('[autofocus]') || (esTelefono() ? el.querySelector('.cerrar') : el.querySelector('input, button:not(.cerrar), .cerrar'));
  setTimeout(() => foco && foco.focus(), 30);
  const cerrar = () => {
    if (capa.cerrada) return;
    quitar(capa);
    salirHistorial();
  };
  el.querySelector('.fondo')?.addEventListener('click', cerrar);
  el.querySelectorAll('.cerrar').forEach(b => b.addEventListener('click', cerrar));
  el.addEventListener('keydown', e => atraparFoco(e, el));
  return { cerrar, el, set alCerrar(fn) { capa.alCerrar = fn; } };
}

function quitar(capa) {
  capa.cerrada = true;
  const i = pila.indexOf(capa);
  if (i >= 0) pila.splice(i, 1);
  capa.el.remove();
  capa.alCerrar && capa.alCerrar();
}

function atraparFoco(e, el) {
  if (e.key !== 'Tab') return;
  const f = [...el.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}

export function hayCapas() { return pila.length > 0; }

export function cerrarCapaSuperior() {
  const c = pila[pila.length - 1];
  if (!c) return false;
  quitar(c); salirHistorial();
  return true;
}

window.addEventListener('popstate', e => {
  if (ignorarPop > 0) {
    ignorarPop--; e.stopImmediatePropagation();
    if (!ignorarPop) {
      for (; entradasPendientes > 0; entradasPendientes--) history.pushState({ capa: pila.length }, '');
      const fns = trasAtras; trasAtras = []; fns.forEach(f => f());
    }
    return;
  }
  const c = pila[pila.length - 1];
  if (c) { quitar(c); e.stopImmediatePropagation(); }
}, true);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && pila.length) { e.preventDefault(); cerrarCapaSuperior(); }
});

function cabecera(titulo, extra) {
  return h('div', { class: 'cab' }, h('h2', {}, titulo), extra || null, h('button', { class: 'ibtn cerrar', 'aria-label': 'Cerrar' }, icono('x')));
}

export function abrirVentana({ titulo, contenido, acciones, pantallaCompleta = false, extraCab = null }) {
  const el = h('div', { class: 'capa ventana' + (pantallaCompleta ? ' completa' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
    h('div', { class: 'fondo' }),
    h('div', { class: 'caja' }, cabecera(titulo, extraCab), h('div', { class: 'cuerpo' }, contenido), acciones ? h('div', { class: 'pie' }, acciones) : null));
  return abrirCapa(el);
}

// modal:false deja usar el resto de la pantalla mientras la hoja está abierta (sin fondo oscuro).
export function abrirHoja({ titulo, contenido, lado, modal = true, extraCab = null }) {
  const l = lado || (matchMedia('(max-width:760px)').matches ? 'abajo' : 'derecha');
  const el = h('div', { class: `capa hoja ${l}${modal ? '' : ' no-modal'}`, role: 'dialog', 'aria-modal': String(modal), 'aria-label': titulo },
    modal ? h('div', { class: 'fondo' }) : null,
    h('div', { class: 'caja' }, cabecera(titulo, extraCab), h('div', { class: 'cuerpo' }, contenido)));
  return abrirCapa(el);
}

let toastT;
export function toast(texto, { deshacer, malo } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastT);
  const t = h('div', { class: 'toast' + (malo ? ' malo' : ''), role: 'status' }, texto,
    deshacer ? h('button', { onclick: () => { t.remove(); deshacer(); } }, 'Deshacer') : null);
  document.body.append(t);
  toastT = setTimeout(() => t.remove(), deshacer ? 5000 : 2600);
}

export function esTelefono() { return matchMedia('(max-width:760px)').matches; }

// Pide un texto obligatorio (motivo de anulación, cancelación, ajuste). Devuelve el texto o null.
export function pedirMotivo({ titulo, etiqueta = 'Motivo', boton = 'Confirmar', peligro = false }) {
  return new Promise(res => {
    const inp = h('input', { class: 'inp', id: 'motivo', autocomplete: 'off' });
    const err = h('span', { class: 'error' });
    const b = h('button', { class: 'btn ' + (peligro ? 'danger' : 'primary'), id: 'motivo-final' }, boton);
    let valor = null;
    const v = abrirVentana({ titulo, contenido: h('div', { class: 'campo' }, h('label', { for: 'motivo' }, etiqueta), inp, err), acciones: h('div', { class: 'acciones' }, b) });
    const ok = () => { if (!inp.value.trim()) { err.textContent = 'Escribe el motivo'; return; } valor = inp.value.trim(); v.cerrar(); };
    b.onclick = ok;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    v.alCerrar = () => res(valor);
  });
}

// Quita los vacíos (null, undefined, false) antes de insertar: append(null) escribiría "null" en pantalla.
export const sin = (...xs) => xs.flat(Infinity).filter(x => x != null && x !== false);
export { unaVez } from './nucleo/una-vez.js';

// En el teléfono, mientras se escribe, la barra inferior se esconde para dejar sitio al teclado.
const ES_CAMPO = el => el && (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea'));
document.addEventListener('focusin', e => { if (ES_CAMPO(e.target)) document.body.classList.add('teclado'); });
document.addEventListener('focusout', () => setTimeout(() => { if (!ES_CAMPO(document.activeElement)) document.body.classList.remove('teclado'); }, 60));
