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
  const rejilla = h('div', { class: 'cal-dias' });
  const resumen = h('p', { class: 'nota cal-resumen' });

  const pintar = () => {
    titulo.textContent = mesCorto(anio, mes);
    const [i, f] = a <= b ? [a, b] : [b, a];
    rejilla.replaceChildren(...diasCalendario(anio, mes).map(d => {
      const clases = ['dia', d.delMes ? '' : 'fuera', d.fecha === hoyStr ? 'hoy' : '', d.fecha >= i && d.fecha <= f ? 'en-rango' : '', d.fecha === i || d.fecha === f ? 'borde' : ''].filter(Boolean).join(' ');
      return h('button', { type: 'button', class: clases, 'data-fecha': d.fecha, 'aria-pressed': String(d.fecha >= i && d.fecha <= f), onclick: () => elegir(d.fecha) }, String(d.dia));
    }));
    resumen.textContent = esperandoFin ? 'Toca el último día del rango' : 'Toca el primer día';
  };
  const elegir = fecha => {
    if (!esperandoFin) { a = b = fecha; esperandoFin = true; }
    else { [a, b] = fecha < a ? [fecha, a] : [a, fecha]; esperandoFin = false; }
    pintar();
  };
  const moverMes = n => { mes += n; if (mes < 1) { mes = 12; anio--; } if (mes > 12) { mes = 1; anio++; } pintar(); };

  // Deslizar a los lados cambia de mes
  let x0 = null;
  rejilla.addEventListener('pointerdown', e => { x0 = e.clientX; });
  rejilla.addEventListener('pointerup', e => { if (x0 != null && Math.abs(e.clientX - x0) > 50) moverMes(e.clientX < x0 ? 1 : -1); x0 = null; });

  const aplicar = h('button', { class: 'btn primary calendario-aplicar' }, icono('check'), 'Aplicar');
  const contenido = h('div', { class: 'calendario' },
    h('div', { class: 'cal-cab' }, h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Mes anterior', onclick: () => moverMes(-1) }, icono('izq')), titulo,
      h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Mes siguiente', onclick: () => moverMes(1) }, icono('der'))),
    h('div', { class: 'cal-semana' }, ...SEMANA.map(s => h('span', {}, s))),
    rejilla, resumen);
  const v = abrirVentana({ titulo: 'Fechas', contenido, acciones: h('div', { class: 'acciones' }, aplicar) });
  aplicar.addEventListener('click', () => { const [i, f] = a <= b ? [a, b] : [b, a]; v.cerrar(); alAplicar(i, f); });
  pintar();
}
