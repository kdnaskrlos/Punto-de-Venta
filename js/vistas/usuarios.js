// Usuarios (Más → Usuarios): el administrador crea usuarios, cambia PIN y activa/desactiva.
// Cada quien tiene sus opciones (cambiar PIN, cerrar sesión) en su propia tarjeta; los demás roles ven «Mi cuenta».
import { h, icono, abrirVentana, toast, unaVez } from '../ui.js';
import { registrarVista } from '../app.js';
import { NOMBRE_ROL, opcionesCuenta, cambiarMiPin } from './cuenta.js';
import { DEMO_DIRECTO } from '../datos/index.js';
import { ganaComision } from '../nucleo/comisiones.js';

const seccion = (titulo, ic, ...hijos) => h('section', { class: 'tarjeta pila' }, h('h2', { class: 'sec-t' }, icono(ic), titulo), ...hijos);
const guardado = r => toast(r.ok ? 'Guardado' : 'No se pudo guardar', { malo: !r.ok });

function pedirPin(titulo) {
  return new Promise(res => {
    const inp = h('input', { class: 'inp', id: 'pin-otro', type: 'password', inputmode: 'numeric', maxlength: '4' });
    const err = h('span', { class: 'error' });
    const b = h('button', { class: 'btn primary' }, 'Guardar PIN');
    let valor = null;
    const v = abrirVentana({ titulo, contenido: h('div', { class: 'campo' }, h('label', { for: 'pin-otro' }, 'PIN nuevo (4 números)'), inp, err), acciones: h('div', { class: 'acciones' }, b) });
    b.onclick = () => { if (!/^\d{4}$/.test(inp.value)) { err.textContent = 'El PIN debe tener 4 números'; return; } valor = inp.value; v.cerrar(); };
    v.alCerrar = () => res(valor);
  });
}

const pinAzar = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');
const limpiarUsuario = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20);

// Datos de acceso para enviarle al nuevo usuario (igual que en Pedidos).
function mostrarCredenciales(nombre, usuario, pin) {
  const texto = `Hola ${nombre}, estos son tus datos para entrar al Punto de Venta de Comic Shop:\nUsuario: ${usuario}\nPIN: ${pin}`;
  const copiar = h('button', { class: 'btn', id: 'cred-copiar', onclick: async () => { try { await navigator.clipboard.writeText(texto); toast('Copiado'); } catch { toast('No se pudo copiar', { malo: true }); } } }, icono('copiar'), 'Copiar');
  const compartir = h('button', { class: 'btn primary', onclick: async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Acceso al Punto de Venta', text: texto }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  } }, icono('mensaje'), 'Compartir');
  const v = abrirVentana({ titulo: 'Datos de acceso', contenido: h('div', { class: 'pila' }, h('p', { class: 'nota' }, `Envíale estos datos a ${nombre}. El PIN no se vuelve a mostrar: si lo pierde, le pones uno nuevo.`), h('pre', { class: 'cred' }, texto)),
    acciones: h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: () => v.cerrar() }, 'Listo'), copiar, compartir) });
}

// Ventana "Nuevo usuario" como en Pedidos: nombre, usuario (se llena solo), rol y PIN sugerido.
function nuevoUsuario(ctx) {
  let rol = 'vendedora', tocado = false;
  const nombre = h('input', { class: 'inp', id: 'nu-nombre', autocapitalize: 'words' });
  const usuario = h('input', { class: 'inp', id: 'nu-usuario', autocapitalize: 'none', spellcheck: 'false' });
  const pin = h('input', { class: 'inp num', id: 'nu-pin', inputmode: 'numeric', maxlength: '4', value: pinAzar() });
  const err = h('span', { class: 'error' });
  const roles = h('div', { class: 'segmentado', id: 'nu-rol' });
  const pintarRoles = () => roles.replaceChildren(...['vendedora', 'encargada', 'admin'].map(r => h('button', { type: 'button', 'data-rol': r, 'aria-pressed': String(r === rol), onclick: () => { rol = r; pintarRoles(); } }, NOMBRE_ROL[r])));
  pintarRoles();
  nombre.oninput = () => { if (!tocado) usuario.value = limpiarUsuario(nombre.value.split(' ')[0]); };
  usuario.oninput = () => { tocado = true; usuario.value = limpiarUsuario(usuario.value); };
  const crear = h('button', { class: 'btn primary', id: 'nu-crear' }, icono('check'), 'Crear usuario');
  const v = abrirVentana({ titulo: 'Nuevo usuario', contenido: h('div', { class: 'pila' },
    h('div', { class: 'campo' }, h('label', { for: 'nu-nombre' }, 'Nombre'), nombre),
    h('div', { class: 'campo' }, h('label', { for: 'nu-usuario' }, 'Usuario (para entrar)'), usuario, h('span', { class: 'nota chica' }, 'Minúsculas, sin espacios')),
    h('div', { class: 'campo' }, h('label', {}, 'Rol'), roles),
    h('div', { class: 'campo' }, h('label', { for: 'nu-pin' }, 'PIN'), h('div', { class: 'fila-pin' }, pin, h('button', { type: 'button', class: 'btn', id: 'nu-otro', onclick: () => { pin.value = pinAzar(); } }, 'Otro'))),
    err),
    acciones: h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: () => v.cerrar() }, 'Cancelar'), crear) });
  crear.onclick = e => unaVez(e.currentTarget, async () => {
    const n = nombre.value.trim(), u = limpiarUsuario(usuario.value), p = pin.value.trim();
    if (n.length < 2) { err.textContent = 'Escribe el nombre'; return; }
    if (u.length < 3) { err.textContent = 'Usuario no válido (3 a 20 letras o números, sin espacios)'; return; }
    if (!/^\d{4}$/.test(p)) { err.textContent = 'El PIN debe tener 4 números'; return; }
    const r = await ctx.almacen.crearUsuario({ usuario: u, nombre: n, rol, pin: p });
    if (!r.ok) { err.textContent = r.error === 'existe' ? 'Ese usuario ya existe, elige otro' : 'No se pudo crear'; return; }
    v.cerrar(); setTimeout(() => mostrarCredenciales(n, u, p), 0);
  })();
}


// Abre o cierra la tarjeta (sin volver a pintar la lista).
function poner(tarjeta, abrir) {
  tarjeta.classList.toggle('abierto', abrir);
  tarjeta.querySelector('.u-cab').setAttribute('aria-expanded', String(abrir));
  tarjeta.querySelector('.u-cuerpo').hidden = !abrir;
}
// Copia de animarDesplegable de Pedidos: mide, cambia y anima la altura de cada tarjeta de la vieja a la nueva.
function animarTarjetas(tarjetas, cambiar, nueva) {
  const h0 = new Map(tarjetas.map(t => [t, t.getBoundingClientRect().height]));
  cambiar();
  if (!document.body.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const t of tarjetas) {
    t.getAnimations().forEach(a => a.cancel());
    const h1 = t.getBoundingClientRect().height; if (Math.abs(h1 - h0.get(t)) < 2) continue;
    t.style.overflow = 'hidden';
    const a = t.animate([{ height: h0.get(t) + 'px' }, { height: h1 + 'px' }], { duration: 200, easing: 'cubic-bezier(.22,.9,.3,1)' });
    if (t === nueva) [...t.querySelector('.u-cuerpo').children].forEach((r, i) => r.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 170, delay: 40 + i * 35, easing: 'ease-out', fill: 'backwards' }));
    a.onfinish = a.oncancel = () => { t.style.overflow = ''; };
  }
}

// Usuarios como en Pedidos: tarjetas compactas (avatar, nombre, @usuario, rol) que se despliegan al tocarlas.
function usuarios(ctx) {
  const lista = h('div', { class: 'lista-usuarios' });
  const abiertos = new Set();
  let ultimos = [];
  const el = seccion('Usuarios', 'usuarios', lista,
    h('button', { class: 'forma-nueva nuevo-usuario', id: 'nu-abrir', onclick: () => nuevoUsuario(ctx) }, icono('mas1'), 'Nuevo usuario'));
  const pintar = () => lista.replaceChildren(...ultimos.map(u => {
    const abierto = abiertos.has(u.usuario);
    const yo = u.uid === ctx.sesion.uid;
    const idCuerpo = `u-cuerpo-${u.usuario}`;
    return h('div', { class: 'usuario' + (u.activo ? '' : ' off') + (abierto ? ' abierto' : ''), 'data-usuario': u.usuario },
      h('button', { type: 'button', class: 'u-cab', 'aria-expanded': String(abierto), 'aria-controls': idCuerpo, onclick: e => {
        // Igual que en Pedidos: solo una tarjeta abierta; se anima la altura de la tarjeta que se abre y de la
        // que se cierra a la vez (280 ms), y las filas de la que se abre aparecen escalonadas.
        const tarjeta = e.currentTarget.closest('.usuario');
        const abrir = !abiertos.has(u.usuario);
        const otra = abrir ? [...lista.querySelectorAll('.usuario.abierto')].find(t => t !== tarjeta) : null;
        animarTarjetas([tarjeta, otra].filter(Boolean), () => {
          if (otra) { abiertos.delete(otra.dataset.usuario); poner(otra, false); }
          abrir ? abiertos.add(u.usuario) : abiertos.delete(u.usuario);
          poner(tarjeta, abrir);
        }, abrir ? tarjeta : null);
      } },
        h('span', { class: 'avatar' }, (u.nombre || u.usuario).slice(0, 1).toUpperCase()),
        h('span', { class: 'u-info' }, h('b', {}, u.nombre), h('span', { class: 'nota' }, `@${u.usuario}`)),
        u.activo ? null : h('span', { class: 'est n' }, 'Inactivo'),
        h('span', { class: 'est n rol' }, NOMBRE_ROL[u.rol] || u.rol),
        icono('abajo')),
      h('div', { class: 'u-cuerpo', id: idCuerpo, hidden: !abierto },
        h('label', { class: 'interruptor u-com' }, h('input', { type: 'checkbox', 'data-comision': u.usuario, checked: ganaComision(u),
          onchange: async e => { const r = await ctx.almacen.marcarComision(u.uid, e.target.checked); if (!r.ok) { e.target.checked = !e.target.checked; guardado(r); } else toast(e.target.checked ? `${u.nombre} gana comisión` : `${u.nombre} ya no gana comisión`); } }), 'Gana comisión por prenda vendida'),
        // En la tarjeta propia van «Cambiar mi PIN» y «Cerrar sesión» (antes en «Mi cuenta»).
        yo ? accionesPropias(ctx) : h('div', { class: 'u-acc' },
          h('button', { class: 'btn', onclick: async () => { const pin = await pedirPin(`Nuevo PIN para ${u.nombre}`); if (pin) guardado(await ctx.almacen.cambiarPin(u.uid, pin)); } }, icono('llave'), 'Nuevo PIN'),
          h('button', { class: 'btn', onclick: async () => guardado(await ctx.almacen.activarUsuario(u.uid, !u.activo)) }, u.activo ? 'Desactivar' : 'Activar'),
          h('button', { class: 'btn texto peligro u-eliminar', 'data-eliminar': u.usuario, onclick: () => eliminar(ctx, u) }, icono('borrar'), 'Eliminar'))));
  }));
  const quitar = ctx.almacen.escuchar('usuarios', l => {
    ultimos = l.filter(u => !u.reemplazadoPor && !u.eliminado).sort((a, b) => (a.rol === 'admin' ? -1 : 1) - (b.rol === 'admin' ? -1 : 1) || a.usuario.localeCompare(b.usuario));
    pintar();
  });
  return { el, quitar };
}

function accionesPropias(ctx) {
  // En la demostración no hay PIN ni sesión que cerrar: se cambia de rol con «Probar como».
  if (DEMO_DIRECTO) return opcionesCuenta(ctx).querySelector('.probar');
  return h('div', { class: 'u-acc' },
    h('button', { class: 'btn', id: 'mi-pin', onclick: () => cambiarMiPin(ctx) }, icono('llave'), 'Cambiar mi PIN'),
    h('button', { class: 'btn texto peligro', id: 'cerrar-sesion', onclick: () => ctx.almacen.salir() }, icono('salir'), 'Cerrar sesión'));
}

// Eliminar pide confirmación: no se puede deshacer (el usuario queda libre y ya no puede entrar).
// Sus ventas, cajas y comisiones se conservan con su nombre.
function eliminar(ctx, u) {
  const si = h('button', { class: 'btn primary peligro-lleno', id: 'eliminar-si' }, icono('borrar'), 'Eliminar');
  const no = h('button', { class: 'btn' }, 'Cancelar');
  const v = abrirVentana({ titulo: `Eliminar a ${u.nombre}`, contenido: h('div', { class: 'aviso' }, icono('alerta'),
    `@${u.usuario} ya no podrá entrar. Sus ventas y cajas se conservan en los reportes. Esto no se puede deshacer.`),
    acciones: h('div', { class: 'acciones' }, no, si) });
  no.onclick = () => v.cerrar();
  si.onclick = unaVez(si, async () => {
    const r = await ctx.almacen.eliminarUsuario(u.uid);
    v.cerrar();
    toast(r.ok ? `${u.nombre} eliminado` : r.error === 'propio' ? 'No puedes eliminarte a ti mismo' : 'No se pudo eliminar', { malo: !r.ok });
  });
}

registrarVista('/usuarios', {
  montar(cont, ctx) {
    const admin = ctx.puedeVer('ajustes');
    const u = admin ? usuarios(ctx) : null;
    // El administrador tiene sus opciones en su propia tarjeta; los demás roles ven solo «Mi cuenta».
    cont.append(u ? u.el : h('section', { class: 'tarjeta pila', id: 'mi-cuenta' }, h('h2', { class: 'sec-t' }, icono('usuario'), 'Mi cuenta'), opcionesCuenta(ctx)));
    return u?.quitar;
  },
});
