// Mi cuenta: cambiar PIN y cerrar sesión. Está al final de Más → Usuarios y en la barra lateral (PC).
import { h, icono, abrirVentana, toast } from '../ui.js';
import { DEMO_DIRECTO, recordarUsuarioDemo } from '../datos/index.js';

export const NOMBRE_ROL = { admin: 'Administrador', encargada: 'Encargada', vendedora: 'Vendedora' };

export function cambiarMiPin(ctx) {
  const inp = (id, label) => h('div', { class: 'campo' }, h('label', { for: id }, label), h('input', { class: 'inp', id, type: 'password', inputmode: 'numeric', maxlength: '4' }), h('span', { class: 'error' }));
  const cont = h('div', { class: 'pila' }, inp('pin-actual', 'PIN actual'), inp('pin-nuevo', 'PIN nuevo (4 números)'), inp('pin-repite', 'Repite el PIN nuevo'));
  const guardar = h('button', { class: 'btn primary' }, icono('check'), 'Guardar');
  const v = abrirVentana({ titulo: 'Cambiar mi PIN', contenido: cont, acciones: h('div', { class: 'acciones' }, guardar) });
  guardar.addEventListener('click', async () => {
    const val = id => cont.querySelector('#' + id).value.trim();
    const err = (id, t) => { cont.querySelectorAll('.error').forEach(e => { e.textContent = ''; }); cont.querySelector('#' + id).nextElementSibling.textContent = t; };
    if (!/^\d{4}$/.test(val('pin-nuevo'))) return err('pin-nuevo', 'El PIN debe tener 4 números');
    if (val('pin-nuevo') !== val('pin-repite')) return err('pin-repite', 'Los PIN no coinciden');
    const r = await ctx.almacen.cambiarPin(ctx.sesion.uid, val('pin-nuevo'), val('pin-actual'));
    if (!r.ok) return err('pin-actual', r.error === 'pin' ? 'El PIN actual no es correcto' : 'No se pudo cambiar');
    v.cerrar(); toast('PIN actualizado');
  });
}

export function opcionesCuenta(ctx, alSalir) {
  const s = ctx.sesion;
  return h('div', { class: 'cuenta' },
    h('div', { class: 'cuenta-quien' }, h('span', { class: 'avatar' }, (s.nombre || s.usuario).slice(0, 1).toUpperCase()),
      h('div', {}, h('b', {}, s.nombre), h('div', { class: 'nota' }, `@${s.usuario} · ${NOMBRE_ROL[s.rol] || s.rol}`))),
    // Cambiar el PIN es solo del administrador: la vendedora y la encargada se lo piden a él.
    DEMO_DIRECTO ? probarComo(ctx, alSalir) : (ctx.rol ? ctx.rol() : s.rol) === 'admin' ? h('button', { class: 'fila-btn', id: 'mi-pin', onclick: () => cambiarMiPin(ctx) }, icono('llave'), 'Cambiar mi PIN') : null,
    DEMO_DIRECTO ? null : h('button', { class: 'fila-btn peligro', onclick: async () => { alSalir && alSalir(); await ctx.almacen.salir(); } }, icono('salir'), 'Cerrar sesión'));
}

// Demostración: ver la app como cada rol, sin PIN. La elección se recuerda al recargar.
function probarComo(ctx, alCambiar) {
  const actual = ctx.sesion.usuario;
  return h('div', { class: 'probar' },
    h('div', { class: 'nota' }, 'Probar como (demostración)'),
    h('div', { class: 'segmentado' }, ...['admin', 'encargada', 'vendedora'].map(u =>
      h('button', { type: 'button', id: 'probar-' + u, 'aria-pressed': String(u === actual), onclick: async () => {
        if (u === ctx.sesion.usuario) return;
        recordarUsuarioDemo(u); alCambiar && alCambiar();
        await ctx.almacen.entrar(u, '1234');
      } }, NOMBRE_ROL[u]))));
}
