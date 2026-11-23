// Punto de entrada: crea el almacén, muestra la entrada o la app según la sesión y registra el service worker.
import { ctx, mostrarApp, definirCalculadora } from './app.js';
import { vigilarVentaEnCurso, ofrecerRetomar, guardarVentaEnCurso } from './vistas/venta-en-curso.js';
import { vigilarPendientes } from './datos/pendientes.js';
import { h, icono, cerrarCapaSuperior, hayCapas } from './ui.js';
import { crearAlmacen, MODO_DEMO, DEMO_DIRECTO, usuarioDemo } from './datos/index.js';
import { iniciarDatos } from './datos/vivos.js';
import { pantallaEntrada, pantallaPrimerAdmin } from './vistas/entrar.js';
import { abrirCalculadora } from './vistas/calculadora.js';
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
ctx.abrirApartar = () => abrirApartar(ctx);
ctx.abrirCobro = modo => { if (!carrito(ctx).lineas.length) return; conCliente(ctx, () => (modo === 'venta' ? abrirCobrar(ctx) : abrirApartar(ctx))); };

async function iniciar() {
  const raiz = document.getElementById('app');
  ctx.almacen = await crearAlmacen();
  if (DEMO_DIRECTO) await ctx.almacen.entrar(usuarioDemo(), '1234');
  let anterior, pararDatos = null, turno = 0;
  // Modo demo: cambia de almacén (real ↔ simulado) y vuelve a escuchar los datos del nuevo.
  ctx.reiniciarDatos = () => { pararDatos && pararDatos(); ctx.carrito = null; pararDatos = ctx.sesion ? iniciarDatos(ctx) : null; };
  ctx.almacen.alCambiarSesion(async s => {
    const clave = s ? s.uid + s.rol : null;
    // Solo se omite si la pantalla que se ve ya corresponde (app con sesión o entrada sin ella).
    const mostrando = s ? !!raiz.querySelector(':scope > .side') : !!raiz.querySelector('.puerta');
    if (clave === anterior && mostrando) { ctx.sesion = s; window.dispatchEvent(new CustomEvent('pos:sesion')); return; } // v2.16: nombre o foto cambiados
    const mio = ++turno;
    anterior = clave;
    // Si se sale o cambia la sesión real estando en Modo demo, se vuelve al almacén real.
    if (ctx.almacenReal) { ctx.almacen = ctx.almacenReal; ctx.almacenReal = null; ctx.sesionReal = null; ctx.vistaRol = null; }
    ctx.sesion = s;
    while (hayCapas()) cerrarCapaSuperior();
    pararDatos && pararDatos(); pararDatos = null;
    ctx.carrito = null;
    if (s) { pararDatos = iniciarDatos(ctx); mostrarApp(); setTimeout(() => ofrecerRetomar(ctx), 700); setTimeout(revisarPendientes, 4000); }
    else {
      // La consulta a Firebase puede tardar: si mientras tanto alguien entró, su respuesta atrasada no debe
      // tapar la app con la pantalla de entrada (antes pasaba y ya no se podía entrar sin recargar).
      const iniciado = MODO_DEMO || await ctx.almacen.sistemaIniciado();
      if (mio !== turno) return;
      if (!iniciado) pantallaPrimerAdmin(raiz, ctx); else pantallaEntrada(raiz, ctx, { demo: MODO_DEMO });
    }
    raiz.dataset.listo = '1';
  });
}
vigilarVentaEnCurso(ctx);
const revisarPendientes = vigilarPendientes(ctx);
iniciar();

// Actualizaciones: se buscan al volver a la app y cada 10 minutos (antes solo al recargar con el botón que se quitó).
// Si no hay nada a medias (ventana abierta, carrito con prendas, escribiendo), se aplica sola; si no, aviso con "Actualizar".
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const workers = navigator.serviceWorker;
  let control = workers.controller, recargando = false;
  workers.addEventListener('controllerchange', () => {
    const anterior = control;
    control = workers.controller;
    if (!anterior || !control || control === anterior || recargando) return;
    recargando = true;
    guardarCarritoActivo();
    location.reload();
  });
  workers.register('sw.js').then(reg => {
    const buscar = () => { if (reg.waiting && workers.controller) avisarVersionNueva(reg.waiting); reg.update().catch(() => {}); };
    workers.addEventListener('message', e => {
      if (e.data === 'actualizacion-aplazada' && reg.waiting === e.source) avisarVersionNueva(reg.waiting, true);
    });
    setInterval(buscar, 10 * 60 * 1000);
    window.addEventListener('online', buscar);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
    if (reg.waiting && workers.controller) avisarVersionNueva(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo && nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && workers.controller) avisarVersionNueva(nuevo);
      });
    });
  }).catch(() => {});
}

const sinNadaAMedias = () => !document.querySelector('.capa') && !(window.__pos?.ctx?.carrito?.lineas?.length) && !document.activeElement?.matches?.('input, textarea');
const guardarCarritoActivo = () => { if (ctx.carrito?.lineas?.length) guardarVentaEnCurso(ctx); };

function avisarVersionNueva(sw, aplazada = false) {
  if (!aplazada && sinNadaAMedias()) { sw.postMessage('activar'); return; }
  document.querySelector('.toast.version')?.remove();
  // v2.19: aviso animado (entra desde abajo, el ícono gira de vez en cuando y el botón late);
  // al tocar «Actualizar», el ícono gira sin parar con «Actualizando…» hasta que la app se recarga.
  const ico = h('span', { class: 'ver-ico' }, icono('actualizar'));
  const boton = h('button', { class: 'ver-btn', onclick: () => {
    guardarCarritoActivo();
    aviso.classList.add('actualizando'); boton.disabled = true; texto.textContent = 'Actualizando…'; boton.textContent = 'Un momento';
    sw.postMessage('activar');
  } }, 'Actualizar');
  const texto = h('span', {}, aplazada ? 'Cierra las otras pestañas del POS para actualizar' : 'Hay una versión nueva');
  const aviso = h('div', { class: 'toast version', role: 'status' }, ico, texto, boton);
  document.body.append(aviso);
}
