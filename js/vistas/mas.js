// "Más" en el teléfono: accesos que no caben en la barra inferior. "Mi cuenta" está dentro de Usuarios.
import { h, icono } from '../ui.js';
import { registrarVista, navegar } from '../app.js';
import { abrirVentana, toast, unaVez } from '../ui.js';
import { generarEjemplos } from '../nucleo/ejemplos.js';

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
    // Modo prueba (como en Pedidos): llena la app con ejemplos para ver cómo se ve; se quitan sin tocar lo real.
    const boton = h('button', { class: 'pill demo', id: 'modo-prueba' });
    let hay = false;
    const pintar = () => { boton.classList.toggle('on', hay); boton.replaceChildren(icono('matraz'), hay ? 'Modo prueba · activo' : 'Modo prueba'); };
    boton.onclick = e => unaVez(e.currentTarget, async () => {
      if (!hay) {
        const r = await ctx.almacen.cargarEjemplos(generarEjemplos({ productos: ctx.productos, formas: ctx.ajustes.formasPago, tasas: ctx.tasas }));
        toast(r.ok ? 'Ejemplos cargados' : 'No se pudieron cargar', { malo: !r.ok });
        return;
      }
      const si = h('button', { class: 'btn danger', id: 'quitar-ejemplos' }, icono('borrar'), 'Quitar ejemplos');
      const v = abrirVentana({ titulo: 'Quitar modo prueba', contenido: h('p', {}, 'Se borran las ventas, apartados, clientes y prendas de ejemplo. Tus datos reales no se tocan.'),
        acciones: h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: () => v.cerrar() }, 'Cancelar'), si) });
      si.onclick = ev => unaVez(ev.currentTarget, async () => { const r = await ctx.almacen.quitarEjemplos(); v.cerrar(); toast(r.ok ? 'Ejemplos quitados' : 'No se pudieron quitar', { malo: !r.ok }); })();
    })();
    pintar();
    cont.append(h('div', { class: 'modo-prueba' }, boton));
    return ctx.almacen.escuchar('apartados', l => { hay = l.some(a => a.demo); pintar(); });
  },
});
