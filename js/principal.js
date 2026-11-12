// Punto de entrada: crea el almacén, muestra la entrada o la app según la sesión y registra el service worker.
import { ctx, mostrarApp } from './app.js';
import { h, cerrarCapaSuperior, hayCapas } from './ui.js';
import { crearAlmacen, MODO_DEMO } from './datos/index.js';
import { pantallaEntrada, pantallaPrimerAdmin } from './vistas/entrar.js';
import './vistas/mas.js';
import './vistas/vender.js';
import { iniciarDatos } from './datos/vivos.js';

window.__pos = { ctx };

async function iniciar() {
  const raiz = document.getElementById('app');
  ctx.almacen = await crearAlmacen();
  let anterior, pararDatos = null;
  ctx.almacen.alCambiarSesion(async s => {
    const clave = s ? s.uid + s.rol : null;
    if (clave === anterior) { ctx.sesion = s; return; }
    anterior = clave;
    ctx.sesion = s;
    while (hayCapas()) cerrarCapaSuperior();
    pararDatos && pararDatos(); pararDatos = null;
    ctx.carrito = null;
    if (s) { pararDatos = iniciarDatos(ctx); mostrarApp(); }
    else if (!MODO_DEMO && !(await ctx.almacen.sistemaIniciado())) pantallaPrimerAdmin(raiz, ctx);
    else pantallaEntrada(raiz, ctx, { demo: MODO_DEMO });
    raiz.dataset.listo = '1';
  });
}
iniciar();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo && nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarVersionNueva(nuevo);
      });
    });
  }).catch(() => {});
}

function avisarVersionNueva(sw) {
  document.body.append(h('div', { class: 'toast', role: 'status' }, 'Hay una versión nueva',
    h('button', { onclick: () => { sw.postMessage('activar'); location.reload(); } }, 'Actualizar')));
}
