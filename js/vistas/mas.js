// "Más" en el teléfono: accesos que no caben en la barra inferior. "Mi cuenta" está dentro de Usuarios.
import { h, icono } from '../ui.js';
import { registrarVista, navegar } from '../app.js';

registrarVista('/mas', {
  montar(cont, ctx) {
    const ir = (ruta, ic, texto) => h('button', { class: 'fila-btn', onclick: () => navegar(ruta) }, icono(ic), texto, h('span', { class: 'sp' }), icono('der'));
    cont.append(
      h('div', { class: 'lista-mas' },
        ir('/caja', 'cartera', 'Caja'),
        ir('/reportes', 'grafica', 'Reportes'),
        ctx.puedeVer('pagarComisiones') ? ir('/comisiones', 'porcentaje', 'Comisiones') : null,
        ctx.puedeVer('ajustes') ? ir('/usuarios', 'usuarios', 'Usuarios') : ir('/usuarios', 'usuario', 'Mi cuenta'),
        ctx.puedeVer('ajustes') ? ir('/ajustes', 'ajustes', 'Ajustes') : null));
  },
});
