// "Más" en el teléfono: accesos que no caben en la barra inferior. "Mi cuenta" está dentro de Usuarios.
import { h, icono } from '../ui.js';
import { registrarVista, navegar } from '../app.js';

// Más: filas agrupadas con ícono de color, nombre, para qué sirve y flecha.
registrarVista('/mas', {
  montar(cont, ctx) {
    const admin = ctx.puedeVer('ajustes');
    const ir = (ruta, ic, color, texto, sub) => h('button', { type: 'button', class: 'fila-btn mas-fila', style: `--c:${color}`, onclick: () => navegar(ruta) },
      h('span', { class: 'mas-ic' }, icono(ic)),
      h('span', { class: 'mas-txt' }, h('b', { class: 'mas-t' }, texto), h('span', { class: 'mas-sub' }, sub)),
      h('span', { class: 'mas-flecha' }, icono('der')));
    const grupo = (titulo, ...filas) => (filas.some(Boolean) ? h('section', { class: 'mas-grupo' }, h('h2', { class: 'mas-grupo-t' }, titulo), h('div', { class: 'lista-mas' }, ...filas)) : null);
    cont.append(...[
      grupo('Negocio',
        ir('/caja', 'cartera', 'var(--tono-verde)', 'Caja', ctx.puedeVer('cajaPersonal') ? 'Cobrado hoy y cajas de la tienda' : 'Abrir, contar y cerrar'),
        ir('/reportes', 'grafica', 'var(--tono-azul)', 'Reportes', 'Ventas, ganancia y más vendidos'),
        ctx.puedeVer('pagarComisiones') ? ir('/comisiones', 'porcentaje', 'var(--tono-violeta)', 'Comisiones', 'Lo que se le debe a la vendedora') : null),
      grupo(admin ? 'Administración' : 'Cuenta',
        admin ? ir('/usuarios', 'usuarios', 'var(--tono-rosa)', 'Usuarios', 'Equipo, PIN y mi cuenta') : ir('/usuarios', 'usuario', 'var(--tono-rosa)', 'Mi cuenta', 'Cambiar PIN y salir'),
        admin ? ir('/ajustes', 'ajustes', 'var(--tono-turquesa)', 'Ajustes', 'Tasas, pagos y recibo') : null),
    ].filter(Boolean));
  },
});
