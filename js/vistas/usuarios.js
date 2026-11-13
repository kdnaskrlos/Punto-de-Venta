// Usuarios (Más → Usuarios): el administrador crea usuarios, cambia PIN y activa/desactiva.
// Al final, "Mi cuenta" (para todos los roles).
import { h, icono, abrirVentana, toast, unaVez } from '../ui.js';
import { registrarVista } from '../app.js';
import { NOMBRE_ROL, opcionesCuenta } from './cuenta.js';

const campo = (id, etiqueta, attrs = {}) => h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), h('input', { class: 'inp', id, ...attrs }));
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

function usuarios(ctx) {
  const lista = h('div', { class: 'pila' });
  const rol = h('select', { class: 'inp', id: 'nu-rol' }, ...['vendedora', 'encargada', 'admin'].map(r => h('option', { value: r }, NOMBRE_ROL[r])));
  const err = h('span', { class: 'error' });
  const el = seccion('Usuarios', 'usuarios', lista,
    h('h3', { class: 'sub-t' }, 'Nuevo usuario'),
    h('div', { class: 'rejilla-aj' }, campo('nu-nombre', 'Nombre'), campo('nu-usuario', 'Usuario', { autocapitalize: 'none', spellcheck: 'false' }), h('div', { class: 'campo' }, h('label', { for: 'nu-rol' }, 'Rol'), rol), campo('nu-pin', 'PIN (4 números)', { type: 'password', inputmode: 'numeric', maxlength: '4' })),
    err,
    h('div', { class: 'acciones' }, h('button', { class: 'btn primary', id: 'nu-crear', onclick: e => unaVez(e.currentTarget, async () => {
      const v = id => el.querySelector('#' + id).value.trim();
      if (!/^\d{4}$/.test(v('nu-pin'))) { err.textContent = 'El PIN debe tener 4 números'; return; }
      const r = await ctx.almacen.crearUsuario({ usuario: v('nu-usuario'), nombre: v('nu-nombre'), rol: rol.value, pin: v('nu-pin') });
      if (!r.ok) { err.textContent = r.error === 'existe' ? 'Ese usuario ya existe' : r.error === 'datos' ? 'Revisa el usuario (minúsculas, sin espacios)' : 'No se pudo crear'; return; }
      err.textContent = ''; ['nu-nombre', 'nu-usuario', 'nu-pin'].forEach(id => { el.querySelector('#' + id).value = ''; });
      toast('Usuario creado');
    })() }, icono('mas1'), 'Crear usuario')));
  const quitar = ctx.almacen.escuchar('usuarios', l => {
    lista.replaceChildren(...l.filter(u => !u.reemplazadoPor).sort((a, b) => a.usuario.localeCompare(b.usuario)).map(u => h('div', { class: 'usuario', 'data-usuario': u.usuario },
      h('span', { class: 'avatar' }, (u.nombre || u.usuario).slice(0, 1).toUpperCase()),
      h('div', { class: 'u-info' }, h('b', {}, u.nombre), h('div', { class: 'nota' }, `@${u.usuario} · ${NOMBRE_ROL[u.rol] || u.rol}`)),
      h('span', { class: 'est ' + (u.activo ? 'g' : 'n') }, u.activo ? 'Activo' : 'Inactivo'),
      u.uid === ctx.sesion.uid ? null : h('div', { class: 'acciones' },
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
