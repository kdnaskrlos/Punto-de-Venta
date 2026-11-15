// Arranque de la app: navegación, cabecera, enrutador por hash y atajos.
import { h, icono, logo, abrirHoja, abrirVentana, esTelefono, despuesDeCerrar } from './ui.js';
import { APP_VERSION } from './version.js';
import { puede } from './nucleo/permisos.js';
import { opcionesCuenta } from './vistas/cuenta.js';
import { avatarDe } from './vistas/recorte.js';
import { MODO_DEMO } from './datos/index.js';
import { crearSimulacion } from './datos/memoria.js';
import { NOMBRES } from './datos/contrato.js';

const VISTAS = {};
export function registrarVista(ruta, def) { VISTAS[ruta] = def; }
export function navegar(ruta) {
  if (location.hash === '#' + ruta) { montar(); return; }
  const prof = history.state?.profundidad || 0;
  location.hash = ruta;
  history.replaceState({ pestana: true, profundidad: prof + 1 }, '');
}

// Pestañas de la barra (como una app): Inicio es la base; ir a otra pestaña agrega una sola entrada
// y cambiar entre pestañas la reemplaza. Así "atrás" vuelve a Inicio, y desde Inicio sale de la app.
// Las pantallas de Más (Caja, Reportes…) sí agregan entrada: "atrás" vuelve a Más.
function irPestana(ruta) {
  const actual = rutaActual();
  if (ruta === actual) return;
  if (ruta === '/inicio') {
    if (history.state?.pestana) history.go(-(history.state.profundidad || 1));
    else location.replace('#/inicio');
    return;
  }
  if (actual === '/inicio') { location.hash = ruta; history.replaceState({ pestana: true, profundidad: 1 }, ''); return; }
  const prof = history.state?.profundidad || 1;
  const reemplazar = () => { location.replace('#' + ruta); history.replaceState({ pestana: true, profundidad: 1 }, ''); };
  if (prof > 1) {
    // Desde una pantalla de Más: primero se vuelve a la entrada de la pestaña, luego se reemplaza.
    window.addEventListener('popstate', () => setTimeout(reemplazar), { once: true });
    history.go(-(prof - 1));
  } else reemplazar();
}

// Accesos: en PC la barra lateral muestra los de `pc`; en el teléfono, los de `movil` en ese orden.
const ACCESOS = [
  { ruta: '/inicio', titulo: 'Inicio', icono: 'home', pc: 1, movil: 1 },
  // v2.15: en la PC, Vender va al centro de la barra (verde y sin nombre, como en el teléfono).
  { ruta: '/vender', titulo: 'Vender', icono: 'carrito', pc: 5, movil: 3, centro: true },
  { ruta: '/apartados', titulo: 'Apartados', icono: 'apartado', pc: 2, movil: 2 },
  { ruta: '/inventario', titulo: 'Inventario', icono: 'caja', pc: 3, movil: 4 },
  { ruta: '/caja', titulo: 'Caja', icono: 'cartera', pc: 4 },
  { ruta: '/reportes', titulo: 'Reportes', icono: 'grafica', pc: 6 },
  { ruta: '/usuarios', titulo: 'Usuarios', icono: 'usuarios', pc: 7, accion: 'ajustes' },
  { ruta: '/ajustes', titulo: 'Ajustes', icono: 'ajustes', pc: 8, accion: 'ajustes' },
  { ruta: '/mas', titulo: 'Más', icono: 'mas', movil: 5 },
];

export const ctx = {
  almacen: null,
  sesion: null,
  tasas: { copPorUsd: null, bsPorUsd: null },
  ajustes: {},
  // Modo demo: el administrador ve la app como otro rol (vistaRol) sobre una copia simulada de los
  // datos (almacenReal guarda el de verdad); al salir se descarta todo lo hecho en la simulación.
  vistaRol: null,
  rol: () => ctx.vistaRol || ctx.sesion?.rol,
  puedeVer: accion => !!ctx.sesion && puede(ctx.rol(), accion),
  abrirCalculadora: () => alAbrirCalculadora(),
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaCorta(d = new Date()) { return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; }

let raiz, contenedor, barra, cabecera, avisoDemo;

export const ROLES_DEMO = [['vendedora', 'Vendedora'], ['encargada', 'Encargada']];
const nombreRol = r => (ROLES_DEMO.find(([k]) => k === r) || [, r])[1];
export async function verComo(rol) {
  rol = rol || null;
  if (rol && rol !== ctx.vistaRol) {
    // Se trabaja sobre una copia simulada: nada de lo que se haga en el modo demo se guarda de verdad.
    const real = ctx.almacenReal || ctx.almacen;
    const datos = await copiarDatos(real);
    const sim = crearSimulacion(datos, { rol, nombre: nombreRol(rol) });
    await sim.entrar('demo', '0000');
    ctx.almacenReal = real; ctx.sesionReal = ctx.sesionReal || ctx.sesion;
    ctx.almacen = sim; ctx.sesion = { uid: 'u-demo', usuario: 'demo', nombre: nombreRol(rol), rol };
  } else if (!rol && ctx.almacenReal) {
    ctx.almacen = ctx.almacenReal; ctx.sesion = ctx.sesionReal || ctx.sesion;
    ctx.almacenReal = null; ctx.sesionReal = null;
  }
  ctx.vistaRol = rol;
  ctx.reiniciarDatos && ctx.reiniciarDatos();
  pintarAvisoDemo();
  if (rutaActual() === '/inicio') montar(); else location.replace('#/inicio');
}
// Toma una foto de todas las colecciones (la primera respuesta de cada una, con 5 s de tope).
function copiarDatos(almacen) {
  const datos = {};
  return Promise.all(NOMBRES.map(n => new Promise(listo => {
    let quitar = null, hecho = false;
    const fin = docs => { if (hecho) return; hecho = true; datos[n] = docs || []; setTimeout(() => quitar && quitar()); listo(); };
    quitar = almacen.escuchar(n, fin);
    setTimeout(() => fin([]), 5000);
  }))).then(() => datos);
}
function pintarAvisoDemo() {
  if (!avisoDemo) return;
  avisoDemo.hidden = !ctx.vistaRol;
  avisoDemo.replaceChildren(...(ctx.vistaRol ? [icono('usuario'), h('span', {}, h('b', {}, `Modo demo · ${nombreRol(ctx.vistaRol)}`)),
    h('button', { class: 'btn chico', id: 'salir-demo', onclick: () => verComo(null) }, 'Salir')] : []));
}
// Pastilla «Modo demo»: elige con qué rol ver la app.
export function pastillaModoDemo() {
  const b = h('button', { class: 'pill demo' + (ctx.vistaRol ? ' on' : ''), id: 'modo-demo', type: 'button' }, icono('usuario'), ctx.vistaRol ? `Modo demo · ${nombreRol(ctx.vistaRol)}` : 'Modo demo');
  b.onclick = () => {
    const v = abrirVentana({ titulo: 'Modo demo', contenido: h('div', { class: 'pila' },
      h('div', { class: 'demo-roles' }, ...ROLES_DEMO.map(([k, t]) => h('button', { class: 'btn' + (ctx.vistaRol === k ? ' primary' : ''), 'data-rol': k, onclick: () => { v.cerrar(); despuesDeCerrar(() => verComo(k)); } }, icono('usuario'), t)))) });
  };
  return b;
}
let alAbrirCalculadora = () => abrirHoja({ titulo: 'Calculadora', contenido: h('div', { class: 'vacio' }, 'Calculadora') });
export function definirCalculadora(fn) { alAbrirCalculadora = fn; }

function rutaActual() { return (location.hash || '#/inicio').slice(1).split('?')[0]; }

function pintarNav() {
  const tel = esTelefono();
  const lista = ACCESOS.filter(a => (tel ? a.movil : a.pc) && (!a.accion || ctx.puedeVer(a.accion)))
    .sort((x, y) => (tel ? x.movil - y.movil : x.pc - y.pc));
  const actual = rutaActual();
  // v2.15: en la PC, arriba va el perfil del usuario (en vez del logo); abajo solo la versión.
  const cuenta = ctx.sesion ? h('button', { class: 'ibtn cuenta-btn', 'aria-label': 'Mi cuenta', onclick: () => { const c = abrirHoja({ titulo: 'Mi cuenta', contenido: opcionesCuenta(ctx, () => c.cerrar()) }); } },
    avatarDe(ctx.sesion)) : null;
  barra.replaceChildren(
    tel ? h('div', { class: 'logo', 'aria-hidden': 'true' }, logo()) : cuenta,
    ...lista.map(a => {
      const enMas = tel && a.ruta === '/mas' && ['/caja', '/reportes', '/ajustes', '/comisiones', '/usuarios'].includes(actual);
      const activo = actual === a.ruta || enMas;
      const centro = !!a.centro;
      // v2.11: en el ícono de Vender, un punto avisa que hay una venta en curso en el carrito (fuera de Vender).
      const punto = a.ruta === '/vender' ? h('i', { class: 'nav-punto', 'aria-hidden': 'true' }) : null;
      return h('a', { class: 'nav' + (centro ? ' centro' : ''), href: '#' + a.ruta, 'data-ruta': a.ruta, 'aria-label': a.titulo, 'aria-current': activo ? 'true' : 'false', onclick: e => { e.preventDefault(); irPestana(a.ruta); } },
        centro ? h('span', { class: 'ring' }, icono(a.icono), punto) : punto ? h('span', { class: 'nav-ic' }, icono(a.icono), punto) : icono(!tel && a.ruta === '/ajustes' ? 'tuerca' : a.icono), // v2.16: tuerca en la PC
        centro ? null : h('span', {}, a.titulo));
    }),
    h('div', { class: 'grow' }),
    h('div', { class: 'ver' }, APP_VERSION));
  marcarCarrito();
}
// Muestra u oculta el punto del carrito: hay prendas y no se está en Vender.
function marcarCarrito() {
  const n = barra?.querySelector('.nav[data-ruta="/vender"]');
  if (!n) return;
  const hay = !!ctx.carrito?.lineas?.length && rutaActual() !== '/vender';
  n.classList.toggle('con-carrito', hay);
  n.setAttribute('aria-label', hay ? 'Vender · venta en curso' : 'Vender');
}

export function pintarCabecera() {
  const t = ctx.tasas || {};
  const fmt = n => n == null ? '—' : Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const conn = ctx.conexion || { enLinea: navigator.onLine, pendientes: 0 };
  const textoConn = conn.error ? 'Error al sincronizar' : conn.enLinea ? 'En línea' : `Sin conexión${conn.pendientes ? ` · ${conn.pendientes} por subir` : ''}`;
  cabecera.replaceChildren(
    h('span', { class: 'conn' + (conn.error ? ' err' : conn.enLinea ? '' : ' off'), role: 'status' }, h('i'), textoConn),
    h('span', { class: 'sp' }),
    // v2.15: en la PC, dos pastillas: la tasa del peso y la de Bs (con su fuente: Binance, BCV o Manual).
    // v2.18: las pastillas de tasas solo informan (ya no abren ventana).
    ...(esTelefono() ? [h('span', { class: 'pill tasas info' + (!t.bsPorUsd || t.ultimaConocida ? ' vieja' : ''), title: t.ultimaConocida ? 'Bs: última tasa conocida' : 'Tasas del día' },
      h('span', { class: 'num' }, '$ ', h('b', { class: 'c-cop' }, fmt(t.copPorUsd)), ' / Bs ', h('b', { class: 'c-bs' }, fmt(t.bsPorUsd))))]
      // v2.16: «COP» y «Bs» (sin nombres); cada pastilla abre solo su tasa.
      : [h('span', { class: 'pill tasas tasa-pc info', title: 'Tasa del peso' },
          h('span', { class: 'num' }, h('small', {}, 'COP'), h('b', { class: 'c-cop' }, fmt(t.copPorUsd)))),
        h('span', { class: 'pill tasas tasa-pc info' + (!t.bsPorUsd || t.ultimaConocida ? ' vieja' : ''), title: t.ultimaConocida ? 'Bs: última tasa conocida' : 'Tasa de Bs' },
          h('span', { class: 'num' }, h('small', {}, 'Bs'), h('b', { class: 'c-bs' }, fmt(t.bsPorUsd))))]),
    h('button', { class: 'ibtn', 'aria-label': 'Calculadora', onclick: () => alAbrirCalculadora() }, icono('calculadora')),
    h('span', { class: 'pill fecha' }, fechaCorta()));
}

let desmontar = null;
function montar() {
  const ruta = rutaActual();
  pintarNav();
  desmontar && desmontar(); desmontar = null;
  const v = VISTAS[ruta];
  if (v && v.accion && !ctx.puedeVer(v.accion)) { history.replaceState(null, '', '#/inicio'); montar(); return; }
  const cont = h('section', { class: 'vista', 'data-ruta': ruta });
  contenedor.replaceChildren(cont);
  if (v && (!v.accion || ctx.puedeVer(v.accion))) desmontar = v.montar(cont, ctx) || null;
  else cont.append(h('div', { class: 'vacio' }, 'Próximamente'));
  if (ruta === '/mas') cont.append(h('p', { class: 'ver-pie' }, `versión ${APP_VERSION} · ${MODO_DEMO ? 'modo demostración' : 'conectado a Firebase'}`));
  window.scrollTo(0, 0);
}
export function refrescar() { montar(); }

let escuchando = false;
// Muestra la app (con sesión). La pantalla de entrada la pinta principal.js.
export function mostrarApp() {
  raiz = document.getElementById('app');
  barra = h('nav', { class: 'side', 'aria-label': 'Navegación' });
  cabecera = h('header', { class: 'topbar' });
  contenedor = h('main', { class: 'contenido' });
  ctx.vistaRol = null;
  avisoDemo = h('div', { class: 'aviso-demo', id: 'aviso-demo', role: 'status', hidden: true });
  raiz.replaceChildren(barra, h('div', { class: 'main' }, cabecera, avisoDemo, contenedor));
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/inicio');
  pintarCabecera();
  montar();
  if (!escuchando) {
    escuchando = true;
    window.addEventListener('hashchange', () => { if (ctx.sesion) montar(); });
    window.addEventListener('pos:carrito', () => { if (ctx.sesion) marcarCarrito(); });
    window.addEventListener('pos:sesion', () => { if (ctx.sesion) pintarNav(); }); // v2.16: foto o nombre nuevos
    window.addEventListener('pos:datos', e => { if (ctx.sesion && ['tasas', 'conexion'].includes(e.detail.que) && cabecera) pintarCabecera(); });
    matchMedia('(max-width:839px)').addEventListener('change', () => { if (ctx.sesion) { pintarNav(); pintarCabecera(); } });
    addEventListener('online', () => ctx.sesion && pintarCabecera()); addEventListener('offline', () => ctx.sesion && pintarCabecera());
  }
  raiz.dataset.listo = '1';
}
