// "Más" en el teléfono: accesos que no caben en la barra inferior. "Mi cuenta" está dentro de Usuarios.
import { h, icono } from '../ui.js';
import { registrarVista, navegar } from '../app.js';

// Tarjetas con el mismo estilo que Inicio: chip con ícono, nombre, para qué sirve e ícono de fondo.
registrarVista('/mas', {
  montar(cont, ctx) {
    const admin = ctx.puedeVer('ajustes');
    const ir = (ruta, ic, color, texto, sub) => h('button', { type: 'button', class: 'tile mas-tile fila-btn', style: `--c:${color}`, onclick: () => navegar(ruta) },
      h('span', { class: 'tile-ic', 'aria-hidden': 'true' }, icono(ic)),
      h('span', { class: 'chip-ic grande' }, icono(ic)),
      h('b', { class: 'mas-t' }, texto), h('span', { class: 'sub' }, sub));
    cont.append(h('div', { class: 'tiles lista-mas' },
      ir('/caja', 'cartera', 'var(--accent)', 'Caja', ctx.puedeVer('cajaPersonal') ? 'Cobrado hoy y cajas de la tienda' : 'Abrir, contar y cerrar'),
      ir('/reportes', 'grafica', 'var(--t-info)', 'Reportes', 'Ventas, ganancia y más vendidos'),
      ctx.puedeVer('pagarComisiones') ? ir('/comisiones', 'porcentaje', 'var(--kpi-ganancia)', 'Comisiones', 'Lo que se le debe a la vendedora') : null,
      admin ? ir('/usuarios', 'usuarios', 'var(--t-violet)', 'Usuarios', 'Equipo, PIN y mi cuenta') : ir('/usuarios', 'usuario', 'var(--t-violet)', 'Mi cuenta', 'Cambiar PIN y salir'),
      admin ? ir('/ajustes', 'ajustes', 'var(--kpi-neutro)', 'Ajustes', 'Tasas, pagos y recibo') : null));
  },
});
