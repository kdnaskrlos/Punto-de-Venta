// Usuarios (Más → Usuarios): el administrador crea usuarios, cambia PIN y activa/desactiva.
// Al final, "Mi cuenta" (para todos los roles).
import { h, icono, abrirVentana, toast, unaVez } from '../ui.js';
import { registrarVista } from '../app.js';
import { NOMBRE_ROL, opcionesCuenta } from './cuenta.js';

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

function usuarios(ctx) {
  const lista = h('div', { class: 'lista-usuarios' });
  const el = seccion('Usuarios', 'usuarios', lista,
    h('button', { class: 'forma-nueva nuevo-usuario', id: 'nu-abrir', onclick: () => nuevoUsuario(ctx) }, icono('mas1'), 'Nuevo usuario'));
  const quitar = ctx.almacen.escuchar('usuarios', l => {
    lista.replaceChildren(...l.filter(u => !u.reemplazadoPor).sort((a, b) => (a.rol === 'admin' ? -1 : 1) - (b.rol === 'admin' ? -1 : 1) || a.usuario.localeCompare(b.usuario)).map(u => h('div', { class: 'usuario' + (u.activo ? '' : ' off'), 'data-usuario': u.usuario },
      h('div', { class: 'u-cab' },
        h('span', { class: 'avatar' }, (u.nombre || u.usuario).slice(0, 1).toUpperCase()),
        h('div', { class: 'u-info' }, h('b', {}, u.nombre), h('div', { class: 'nota' }, `@${u.usuario} · ${NOMBRE_ROL[u.rol] || u.rol}`)),
        h('span', { class: 'est ' + (u.activo ? 'g' : 'n') }, u.activo ? 'Activo' : 'Inactivo')),
      u.uid === ctx.sesion.uid ? null : h('div', { class: 'u-acc' },
        h('button', { class: 'btn', onclick: async () => { const pin = await pedirPin(`Nuevo PIN para ${u.nombre}`); if (pin) guardado(await ctx.almacen.cambiarPin(u.uid, pin)); } }, icono('llave'), 'Nuevo PIN'),
        h('button', { class: 'btn ' + (u.activo ? 'danger' : ''), onclick: async () => guardado(await ctx.almacen.activarUsuario(u.uid, !u.activo)) }, u.activo ? 'Desactivar' : 'Activar')))));
  });
  return { el, quitar };
}

registrarVista('/usuarios', {
  montar(cont, ctx) {
    const admin = ctx.puedeVer('ajustes');
    const u = admin ? usuarios(ctx) : null;
    cont.append(...(u ? [u.el] : []), h('section', { class: 'tarjeta pila', id: 'mi-cuenta' }, h('h2', { class: 'sec-t' }, icono('usuario'), 'Mi cuenta'), opcionesCuenta(ctx)));
    return u?.quitar;
  },
});
