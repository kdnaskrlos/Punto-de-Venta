// Punto de entrada: crea el almacén, muestra la entrada o la app según la sesión y registra el service worker.
import { ctx, mostrarApp, definirCalculadora } from './app.js';
import { h, cerrarCapaSuperior, hayCapas } from './ui.js';
import { crearAlmacen, MODO_DEMO, DEMO_DIRECTO, usuarioDemo } from './datos/index.js';
import { iniciarDatos } from './datos/vivos.js';
import { pantallaEntrada, pantallaPrimerAdmin } from './vistas/entrar.js';
import { abrirCalculadora, abrirDetalleTasas } from './vistas/calculadora.js';
import { abrirCobrar } from './vistas/cobrar.js';
import { abrirApartar } from './vistas/apartados.js';
import { conCliente } from './vistas/cliente.js';
import { carrito } from './vistas/vender.js';
import './vistas/inicio.js';
import './vistas/vender.js';
import './vistas/caja.js';
import './vistas/inventario.js';
import './vistas/reportes.js';
import './vistas/ajustes.js';
import './vistas/usuarios.js';
import './vistas/mas.js';

window.__pos = { ctx };
definirCalculadora(() => abrirCalculadora(ctx));
ctx.abrirTasas = () => abrirDetalleTasas(ctx);
ctx.abrirApartar = () => abrirApartar(ctx);
ctx.abrirCobro = modo => { if (!carrito(ctx).lineas.length) return; conCliente(ctx, () => (modo === 'venta' ? abrirCobrar(ctx) : abrirApartar(ctx))); };

async function iniciar() {
  const raiz = document.getElementById('app');
  ctx.almacen = await crearAlmacen();
  if (DEMO_DIRECTO) await ctx.almacen.entrar(usuarioDemo(), '1234');
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
