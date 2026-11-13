// Calendario propio (comicshop-interfaz): un solo calendario para elegir un rango.
// Primer toque = desde, segundo toque = hasta (se ordenan solos). Hoy con contorno verde, rango en verde crema.
import { h, icono, abrirVentana } from '../ui.js';
import { diasCalendario, mesCorto, hoy } from '../nucleo/fechas.js';

const SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function abrirCalendarioRango({ desde, hasta }, alAplicar) {
  let [a, b] = [desde, hasta];
  let [anio, mes] = (hasta || hoy()).split('-').map(Number);
  let esperandoFin = false;
  const hoyStr = hoy();
  const titulo = h('b', { class: 'cal-mes' });
  // Como en Pedidos: tres meses en una tira (anterior, actual, siguiente) que sigue al dedo y se desliza.
  const pista = h('div', { class: 'cal-pista' });
  const visor = h('div', { class: 'cal-visor' }, pista);
  const resumen = h('p', { class: 'nota cal-resumen' });
  const MENOS_MOV = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mesMas = n => { let m = mes + n, y = anio; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } return [y, m]; };

  const rejilla = (y, m, actual) => {
    const [i, f] = a <= b ? [a, b] : [b, a];
    return h('div', { class: 'cal-dias' + (actual ? ' cal-actual' : ''), 'aria-hidden': actual ? null : 'true' }, ...diasCalendario(y, m).map(d => {
      const clases = ['dia', d.delMes ? '' : 'fuera', d.fecha === hoyStr ? 'hoy' : '', d.fecha >= i && d.fecha <= f ? 'en-rango' : '', d.fecha === i || d.fecha === f ? 'borde' : ''].filter(Boolean).join(' ');
      return h('button', { type: 'button', class: clases, 'data-fecha': d.fecha, tabindex: actual ? null : '-1', 'aria-pressed': String(d.fecha >= i && d.fecha <= f) }, String(d.dia));
    }));
  };
  const pintar = () => {
    titulo.textContent = mesCorto(anio, mes);
    pista.style.transition = 'none'; pista.style.transform = '';
    pista.replaceChildren(rejilla(...mesMas(-1), false), rejilla(anio, mes, true), rejilla(...mesMas(1), false));
    resumen.textContent = esperandoFin ? 'Toca el último día del rango' : 'Toca el primer día';
  };
  const elegir = fecha => {
    if (!esperandoFin) { a = b = fecha; esperandoFin = true; }
    else { [a, b] = fecha < a ? [fecha, a] : [a, fecha]; esperandoFin = false; }
    pintar();
  };
  // Pasa de mes con un deslizamiento corto (0,26 s; 0,18 s si fue un gesto rápido)
  let pendiente = null;
  const terminar = () => { if (!pendiente) return; const d = pendiente; pendiente = null; if (d) { [anio, mes] = mesMas(d); } pintar(); };
  const moverMes = (dir, rapido) => {
    terminar();
    if (MENOS_MOV || !dir) { if (dir) [anio, mes] = mesMas(dir); pintar(); return; }
    pendiente = dir;
    pista.style.transition = `transform ${rapido ? .18 : .26}s cubic-bezier(.22,.9,.3,1)`;
    pista.style.transform = `translateX(${dir > 0 ? -66.6667 : 0}%)`;
    const fin = () => terminar();
    pista.addEventListener('transitionend', fin, { once: true }); setTimeout(fin, rapido ? 230 : 310);
  };
  const volver = () => { pista.style.transition = 'transform .2s cubic-bezier(.22,.9,.3,1)'; pista.style.transform = ''; };

  // La tira sigue al dedo; al soltar cambia de mes si se arrastró un 20 % o con un gesto rápido (> 0,35 px/ms)
  let x0 = null, y0 = 0, modo = '', dx = 0, marcas = [], arrastro = false, pid = null;
  visor.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; terminar(); pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; modo = ''; dx = 0; marcas = [[performance.now(), x0]]; });
  visor.addEventListener('pointermove', e => {
    if (x0 === null || e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!modo) { if (Math.abs(mx) < 6 && Math.abs(my) < 6) return; modo = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; if (modo === 'y') { x0 = null; return; } try { visor.setPointerCapture(pid); } catch { /* sin captura */ } }
    e.preventDefault(); dx = mx; marcas.push([performance.now(), e.clientX]); if (marcas.length > 5) marcas.shift();
    pista.style.transition = 'none'; pista.style.transform = `translate3d(calc(-33.3333% + ${dx}px),0,0)`;
  });
  const soltar = e => {
    if (x0 === null || e.pointerId !== pid) return; x0 = null; if (modo !== 'x') return;
    arrastro = Math.abs(dx) > 6; setTimeout(() => { arrastro = false; }, 400);
    const ancho = visor.clientWidth, p0 = marcas[0], p1 = marcas[marcas.length - 1];
    const vel = p1 && p0 && p1[0] - p0[0] > 8 ? (p1[1] - p0[1]) / (p1[0] - p0[0]) : 0;
    const rapido = Math.abs(vel) > .35 && Math.sign(vel) === Math.sign(dx) && Math.abs(dx) > 20;
    if (rapido || Math.abs(dx) > ancho * .2) moverMes(dx < 0 ? 1 : -1, rapido); else volver();
  };
  visor.addEventListener('pointerup', soltar); visor.addEventListener('pointercancel', soltar);
  pista.addEventListener('click', e => { if (arrastro) return; const d = e.target.closest('.cal-actual .dia'); if (d) elegir(d.dataset.fecha); });

  const aplicar = h('button', { class: 'btn primary calendario-aplicar' }, icono('check'), 'Aplicar');
  const contenido = h('div', { class: 'calendario' },
    h('div', { class: 'cal-cab' }, h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Mes anterior', onclick: () => moverMes(-1) }, icono('izq')), titulo,
      h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Mes siguiente', onclick: () => moverMes(1) }, icono('der'))),
    h('div', { class: 'cal-semana' }, ...SEMANA.map(s => h('span', {}, s))),
    visor, resumen);
  const v = abrirVentana({ titulo: 'Fechas', contenido, acciones: h('div', { class: 'acciones' }, aplicar) });
  aplicar.addEventListener('click', () => { const [i, f] = a <= b ? [a, b] : [b, a]; v.cerrar(); alAplicar(i, f); });
  pintar();
}
