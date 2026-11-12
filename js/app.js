// Arranque de la app: navegación, cabecera, enrutador por hash y atajos.
import { h, icono, abrirHoja, esTelefono } from './ui.js';
import { APP_VERSION } from './version.js';

const VISTAS = {};
export function registrarVista(ruta, def) { VISTAS[ruta] = def; }
export function navegar(ruta) { if (location.hash !== '#' + ruta) location.hash = ruta; else montar(); }

// Accesos: en PC la barra lateral muestra los de `pc`; en el teléfono, los de `movil` en ese orden.
const ACCESOS = [
  { ruta: '/inicio', titulo: 'Inicio', icono: 'home', pc: 1, movil: 1 },
  { ruta: '/vender', titulo: 'Vender', icono: 'carrito', pc: 2, movil: 3, centro: true },
  { ruta: '/apartados', titulo: 'Apartados', icono: 'apartado', pc: 3, movil: 2 },
  { ruta: '/inventario', titulo: 'Inventario', icono: 'caja', pc: 4, movil: 4 },
  { ruta: '/caja', titulo: 'Caja', icono: 'cartera', pc: 5 },
  { ruta: '/reportes', titulo: 'Reportes', icono: 'grafica', pc: 6 },
  { ruta: '/ajustes', titulo: 'Ajustes', icono: 'ajustes', pc: 7, accion: 'ajustes' },
  { ruta: '/mas', titulo: 'Más', icono: 'mas', movil: 5 },
];

export const ctx = {
  almacen: null,
  sesion: null,
  tasas: { copPorUsd: 3900, bsPorUsd: 1075 },
  ajustes: {},
  puedeVer: () => true,
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaCorta(d = new Date()) { return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; }

let raiz, contenedor, barra, cabecera;
let alAbrirCalculadora = () => abrirHoja({ titulo: 'Calculadora', contenido: h('div', { class: 'vacio' }, 'Calculadora') });
export function definirCalculadora(fn) { alAbrirCalculadora = fn; }

function rutaActual() { return (location.hash || '#/inicio').slice(1).split('?')[0]; }

function pintarNav() {
  const tel = esTelefono();
  const lista = ACCESOS.filter(a => (tel ? a.movil : a.pc) && (!a.accion || ctx.puedeVer(a.accion)))
    .sort((x, y) => (tel ? x.movil - y.movil : x.pc - y.pc));
  const actual = rutaActual();
  barra.replaceChildren(
    h('div', { class: 'logo', 'aria-hidden': 'true' }, icono('franela')),
    ...lista.map(a => {
      const enMas = tel && a.ruta === '/mas' && ['/caja', '/reportes', '/ajustes', '/comisiones'].includes(actual);
      const activo = actual === a.ruta || enMas;
      const centro = tel && a.centro;
      return h('a', { class: 'nav' + (centro ? ' centro' : ''), href: '#' + a.ruta, 'aria-label': a.titulo, 'aria-current': activo ? 'true' : 'false' },
        centro ? h('span', { class: 'ring' }, icono(a.icono)) : icono(a.icono),
        centro ? null : h('span', {}, a.titulo));
    }),
    h('div', { class: 'grow' }),
    h('div', { class: 'ver' }, APP_VERSION));
}

export function pintarCabecera() {
  const t = ctx.tasas || {};
  const fmt = n => n == null ? '—' : Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const conn = ctx.conexion || { enLinea: navigator.onLine, pendientes: 0 };
  const textoConn = conn.error ? 'Error al sincronizar' : conn.enLinea ? 'En línea' : `Sin conexión${conn.pendientes ? ` · ${conn.pendientes} por subir` : ''}`;
  cabecera.replaceChildren(
    h('span', { class: 'conn' + (conn.error ? ' err' : conn.enLinea ? '' : ' off'), role: 'status' }, h('i'), textoConn),
    h('span', { class: 'sp' }),
    h('button', { class: 'pill tasas', 'aria-label': 'Tasas del día', onclick: () => ctx.abrirTasas && ctx.abrirTasas() },
      h('span', { class: 'num' }, '$ ', h('b', { class: 'c-cop' }, fmt(t.copPorUsd)), ' · Bs ', h('b', { class: 'c-bs' }, fmt(t.bsPorUsd)))),
    h('button', { class: 'ibtn', 'aria-label': 'Calculadora', onclick: () => alAbrirCalculadora() }, icono('calculadora')),
    h('button', { class: 'ibtn', 'aria-label': 'Actualizar', onclick: () => location.reload() }, icono('actualizar')),
    h('span', { class: 'pill fecha' }, fechaCorta()));
}

function montar() {
  const ruta = rutaActual();
  pintarNav();
  const v = VISTAS[ruta];
  const cont = h('section', { class: 'vista', 'data-ruta': ruta });
  contenedor.replaceChildren(cont);
  if (v) v.montar(cont, ctx);
  else cont.append(h('div', { class: 'vacio' }, 'Próximamente'));
  if (ruta === '/inicio' || ruta === '/mas') cont.append(h('p', { class: 'ver-pie' }, `versión ${APP_VERSION}`));
  window.scrollTo(0, 0);
}
export function refrescar() { montar(); }

export function arrancar() {
  raiz = document.getElementById('app');
  barra = h('nav', { class: 'side', 'aria-label': 'Navegación' });
  cabecera = h('header', { class: 'topbar' });
  contenedor = h('main', { class: 'contenido' });
  raiz.replaceChildren(barra, h('div', { class: 'main' }, cabecera, contenedor));
  if (!location.hash) history.replaceState(null, '', '#/inicio');
  pintarCabecera();
  montar();
  window.addEventListener('hashchange', montar);
  matchMedia('(max-width:760px)').addEventListener('change', pintarNav);
  addEventListener('online', pintarCabecera); addEventListener('offline', pintarCabecera);
  raiz.dataset.listo = '1';
}
