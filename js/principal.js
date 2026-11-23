// Punto de entrada: crea el almacén, muestra la entrada o la app según la sesión y registra el service worker.
import { ctx, crearContexto, usarContexto, refrescarContexto, mostrarApp, definirCalculadora } from './app.js';
import { vigilarVentaEnCurso, ofrecerRetomar } from './vistas/venta-en-curso.js';
import { vigilarPendientes } from './datos/pendientes.js';
import { capturarContexto } from './datos/contexto.js';
import { h, icono, cerrarCapaSuperior, hayCapas, despuesDeCerrar } from './ui.js';
import { crearAlmacen, crearAlmacenPrueba, cuentaDePrueba, MODO_DEMO, DEMO_DIRECTO, usuarioDemo } from './datos/index.js';
import { iniciarDatos } from './datos/vivos.js';
import { pantallaEntrada, pantallaPrimerAdmin } from './vistas/entrar.js';
import { abrirCalculadora } from './vistas/calculadora.js';
import { abrirCobrar } from './vistas/cobrar.js';
import { esperarAjustesDePago } from './vistas/pagos.js';
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

window.__pos = { get ctx() { return ctx; } };
definirCalculadora(() => abrirCalculadora(ctx));
function configurarCobro(contexto) {
  contexto.abrirApartar = () => { if (ctx === contexto) abrirApartar(contexto); };
  contexto.abrirCobro = modo => {
    const vigente = capturarContexto(contexto);
    if (ctx !== contexto || !vigente() || !carrito(contexto).lineas.length || !esperarAjustesDePago(contexto)) return;
    conCliente(contexto, () => {
      if (vigente()) (modo === 'venta' ? abrirCobrar : abrirApartar)(contexto);
    });
  };
}

function recuperar(contexto) {
  return ofrecerRetomar(contexto, capturarContexto(contexto));
}

const CLAVE_PRUEBA_ACTIVA = 'pos-modo-prueba-activo';
function leerPruebaActiva() {
  let guardada;
  try { guardada = sessionStorage.getItem(CLAVE_PRUEBA_ACTIVA); } catch { return null; }
  if (guardada === null) return null;
  // Una marca ilegible también impide montar la última ruta de práctica con el almacén operativo.
  try { return JSON.parse(guardada) || {}; } catch { return {}; }
}

async function iniciar() {
  const raiz = document.getElementById('app');
  const operativo = ctx;
  let marcaPrueba = leerPruebaActiva();
  operativo.almacen = await crearAlmacen({
    puedeSincronizar: () => !marcaPrueba && ctx === operativo && !operativo.almacenReal,
    generacion: () => operativo.generacion,
    ajustesListos: () => operativo.ajustesListos !== false,
  });
  configurarCobro(operativo);
  if (DEMO_DIRECTO) await operativo.almacen.entrar(usuarioDemo(), '1234');
  let anterior, pararDatos = null, turno = 0;
  const escuchar = (contexto, opciones) => {
    pararDatos?.();
    pararDatos = contexto.sesion ? iniciarDatos(contexto, opciones) : null;
  };
  // Modo demo: cambia de almacén (real ↔ simulado) y vuelve a escuchar los datos del nuevo.
  operativo.reiniciarDatos = () => { operativo.carrito = null; escuchar(operativo); };

  const cerrarCapas = () => { while (hayCapas()) cerrarCapaSuperior(); };
  const olvidarPrueba = marca => {
    marcaPrueba = null;
    try { sessionStorage.removeItem(CLAVE_PRUEBA_ACTIVA); } catch { /* sin almacenamiento */ }
    const ruta = ['#/mas', '#/ajustes'].includes(marca?.ruta) ? marca.ruta : '#/mas';
    // El historial de práctica puede contener vistas que escriben al montarse, como Reportes.
    history.replaceState(null, '', ruta);
  };
  const activarPrueba = (datos, marca, turnoInicial) => {
    const prueba = crearContexto(datos);
    configurarCobro(prueba);
    const dejarPerfil = prueba.almacen.alCambiarSesion(s => {
      prueba.sesion = s;
      if (s && ctx === prueba) window.dispatchEvent(new CustomEvent('pos:sesion'));
    });
    prueba.cerrarAlmacen = () => {
      dejarPerfil();
      prueba.sesion = null;
      prueba.almacen.salir();
      olvidarPrueba(marca);
    };
    prueba.salirModoPrueba = () => {
      if (ctx !== prueba) return;
      cerrarCapas();
      despuesDeCerrar(() => {
        if (ctx !== prueba || turno !== turnoInicial) return;
        prueba.cerrarAlmacen();
        usarContexto(operativo);
        escuchar(operativo, { restaurarOperacion: true });
        reanudarOperacion();
        refrescarContexto();
        recuperar(operativo);
      });
    };
    prueba.renovarModoPrueba = ambito => {
      if (ctx !== prueba || turno !== turnoInicial) return;
      prueba.generacion++;
      prueba.ambitoPrueba = ambito;
      prueba.carrito = null;
      escuchar(prueba);
      refrescarContexto();
    };
    usarContexto(prueba);
    escuchar(prueba);
  };

  function reanudarOperacion() {
    operativo.almacen.numerarPendientes?.();
    operativo.almacen.reanudarCostos?.();
    revisarPendientes();
  }

  let entrandoPrueba = false;
  operativo.entrarModoPrueba = async () => {
    if (entrandoPrueba || ctx !== operativo || operativo.vistaRol || !operativo.puedeVer('ajustes')) return false;
    const turnoInicial = turno;
    const uid = operativo.sesion.uid;
    const marca = { cuenta: cuentaDePrueba(uid), ruta: location.hash };
    entrandoPrueba = true;
    try {
      const datos = await crearAlmacenPrueba(uid);
      if (!datos || turno !== turnoInicial || ctx !== operativo || operativo.vistaRol || !operativo.puedeVer('ajustes')) return false;
      // Solo se abre la práctica si una recarga podrá reconocer esta pestaña antes de montar la operación.
      try { sessionStorage.setItem(CLAVE_PRUEBA_ACTIVA, JSON.stringify(marca)); } catch { return false; }
      marcaPrueba = marca;
      cerrarCapas();
      activarPrueba(datos, marca, turnoInicial);
      refrescarContexto();
      recuperar(ctx);
      return true;
    } finally {
      entrandoPrueba = false;
    }
  };

  let ultimaCuenta = null;
  operativo.almacen.alCambiarSesion(async s => {
    const clave = s ? JSON.stringify([s.uid, s.usuario, s.rol]) : null;
    // Solo se omite si la pantalla que se ve ya corresponde (app con sesión o entrada sin ella).
    const mostrando = s ? !!raiz.querySelector(':scope > .side') : !!raiz.querySelector('.puerta');
    if (clave === anterior && mostrando) {
      if (operativo.almacenReal) operativo.sesionReal = s;
      else operativo.sesion = s;
      if (ctx === operativo) window.dispatchEvent(new CustomEvent('pos:sesion'));
      return;
    }
    const mio = ++turno;
    operativo.generacion++;
    anterior = clave;
    cerrarCapas();
    if (ctx.ambitoPrueba) {
      await new Promise(despuesDeCerrar);
      if (mio !== turno) return;
      ctx.cerrarAlmacen();
      usarContexto(operativo);
    }
    // Si se sale o cambia la sesión real estando en Modo demo, se vuelve al almacén real.
    if (operativo.almacenReal) { operativo.almacen = operativo.almacenReal; operativo.almacenReal = null; operativo.sesionReal = null; operativo.vistaRol = null; }
    operativo.sesion = s;
    pararDatos && pararDatos(); pararDatos = null;
    operativo.carrito = null;
    if (s) {
      const marca = marcaPrueba;
      const cambioCuenta = !MODO_DEMO && !!ultimaCuenta && ultimaCuenta !== s.uid;
      const restaurarOperacion = !!marca || cambioCuenta;
      ultimaCuenta = s.uid;
      if (marca?.cuenta === cuentaDePrueba(s.uid) && operativo.puedeVer('ajustes')) {
        const datos = await crearAlmacenPrueba(s.uid);
        if (turno !== mio) return;
        if (datos) {
          activarPrueba(datos, marca, mio);
          mostrarApp();
          recuperar(ctx);
          return;
        }
      }
      if (marca) olvidarPrueba(marca);
      escuchar(operativo, { restaurarOperacion, cambioCuenta });
      if (restaurarOperacion) reanudarOperacion();
      mostrarApp();
      setTimeout(() => { if (ctx === operativo && turno === mio) recuperar(operativo); }, 700);
      setTimeout(revisarPendientes, 4000);
    } else {
      // La consulta a Firebase puede tardar: si mientras tanto alguien entró, su respuesta atrasada no debe
      // tapar la app con la pantalla de entrada (antes pasaba y ya no se podía entrar sin recargar).
      const iniciado = MODO_DEMO || await ctx.almacen.sistemaIniciado();
      if (mio !== turno) return;
      if (!iniciado) pantallaPrimerAdmin(raiz, ctx); else pantallaEntrada(raiz, ctx, { demo: MODO_DEMO });
    }
    raiz.dataset.listo = '1';
  });
}
vigilarVentaEnCurso(() => ctx);
const revisarPendientes = vigilarPendientes(() => ctx);
iniciar();

// Actualizaciones: se buscan al volver a la app y cada 10 minutos (antes solo al recargar con el botón que se quitó).
// Si no hay nada a medias (ventana abierta, carrito con prendas, escribiendo), se aplica sola; si no, aviso con "Actualizar".
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recargando) { recargando = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const buscar = () => { if (reg.waiting && navigator.serviceWorker.controller) avisarVersionNueva(reg.waiting); reg.update().catch(() => {}); };
    setInterval(buscar, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
    if (reg.waiting && navigator.serviceWorker.controller) avisarVersionNueva(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo && nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarVersionNueva(nuevo);
      });
    });
  }).catch(() => {});
}

const sinNadaAMedias = () => !document.querySelector('.capa') && !(window.__pos?.ctx?.carrito?.lineas?.length) && !document.activeElement?.matches?.('input, textarea');

function avisarVersionNueva(sw) {
  if (sinNadaAMedias()) { sw.postMessage('activar'); return; }
  document.querySelector('.toast.version')?.remove();
  // v2.19: aviso animado (entra desde abajo, el ícono gira de vez en cuando y el botón late);
  // al tocar «Actualizar», el ícono gira sin parar con «Actualizando…» hasta que la app se recarga.
  const ico = h('span', { class: 'ver-ico' }, icono('actualizar'));
  const boton = h('button', { class: 'ver-btn', onclick: () => {
    aviso.classList.add('actualizando'); boton.disabled = true; texto.textContent = 'Actualizando…'; boton.textContent = 'Un momento';
    sw.postMessage('activar');
  } }, 'Actualizar');
  const texto = h('span', {}, 'Hay una versión nueva');
  const aviso = h('div', { class: 'toast version', role: 'status' }, ico, texto, boton);
  document.body.append(aviso);
}
