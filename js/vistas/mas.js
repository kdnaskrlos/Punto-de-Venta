// "Más" en el teléfono: accesos que no caben en la barra inferior y la cuenta.
import { h, icono } from '../ui.js';
import { registrarVista, navegar } from '../app.js';
import { opcionesCuenta } from './cuenta.js';

registrarVista('/mas', {
  montar(cont, ctx) {
    const ir = (ruta, ic, texto) => h('button', { class: 'fila-btn', onclick: () => navegar(ruta) }, icono(ic), texto, h('span', { class: 'sp' }), icono('der'));
    cont.append(
      h('div', { class: 'lista-mas' },
        ir('/caja', 'cartera', 'Caja'),
        ir('/reportes', 'grafica', 'Reportes'),
        ctx.puedeVer('pagarComisiones') ? ir('/comisiones', 'porcentaje', 'Comisiones') : null,
        h('button', { class: 'fila-btn', onclick: () => ctx.abrirCalculadora() }, icono('calculadora'), 'Calculadora'),
        ctx.puedeVer('ajustes') ? ir('/ajustes', 'ajustes', 'Ajustes') : null),
      h('h2', { class: 'sec-t' }, icono('usuarios'), 'Mi cuenta'),
      opcionesCuenta(ctx));
  },
});
