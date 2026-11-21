// "Más" en el teléfono: accesos que no caben en la barra inferior. "Mi cuenta" está dentro de Usuarios.
import { h, icono, abrirVentana, toast, unaVez, despuesDeCerrar } from '../ui.js';
import { registrarVista, navegar, pastillaModoDemo } from '../app.js';

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
    if (!admin) return undefined;
    cont.append(bloquePrueba(ctx));
  },
});

// Pastillas «Modo prueba» (llena la app con ejemplos) y «Modo demo» (ver como vendedora o encargada).
// Están en Más (teléfono) y al pie de Ajustes (computadora).
export function bloquePrueba(ctx) {
  const prueba = ctx.ambitoPrueba;
  const boton = h('button', { class: 'pill demo' + (prueba ? ' on' : ''), id: 'modo-prueba', type: 'button' }, icono('matraz'), 'Modo prueba');
  boton.onclick = e => unaVez(e.currentTarget, async () => {
    if (!prueba) {
      if (!await ctx.entrarModoPrueba()) toast('No se pudo abrir el Modo prueba', { malo: true });
      return;
    }
    const si = h('button', { class: 'btn danger', id: 'quitar-ejemplos' }, icono('borrar'), 'Quitar ejemplos');
    const v = abrirVentana({ titulo: 'Quitar ejemplos', contenido: h('p', {}, 'Se borran los ejemplos y los cambios que hiciste en el Modo prueba de este dispositivo.'),
      acciones: h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: () => v.cerrar() }, 'Cancelar'), si) });
    si.onclick = ev => unaVez(ev.currentTarget, async () => {
      const r = await ctx.almacen.quitarEjemplos();
      if (!r.ok) { toast('No se pudieron quitar', { malo: true }); return; }
      ctx.carrito = null;
      for (const sufijo of ['carrito', 'pendientes']) {
        try { localStorage.removeItem(prueba + ':' + sufijo); } catch { /* sin almacenamiento */ }
      }
      v.cerrar();
      despuesDeCerrar(ctx.salirModoPrueba);
      toast('Ejemplos quitados');
    })();
  })();
  return h('div', { class: 'modo-prueba' }, boton, prueba ? null : pastillaModoDemo());
}
