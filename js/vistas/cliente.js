// Cliente de la venta: se registra en el carrito, antes de pasar al pago (nombre y teléfono obligatorios).
import { h, icono, abrirVentana, esTelefono } from '../ui.js';
import { telefonoInternacional } from '../nucleo/recibo.js';

// Campos de cliente (teléfono primero; si ya existe, completa el nombre).
export function camposCliente(ctx, alCambiar = () => {}, inicial = null) {
  let clientes = [];
  const quitar = ctx.almacen.escuchar('clientes', l => { clientes = l; });
  const tel = h('input', { class: 'inp', id: 'cli-tel', type: 'tel', inputmode: 'tel', autocomplete: 'off', placeholder: 'Ej. 0412 123 4567' });
  const nombre = h('input', { class: 'inp', id: 'cli-nombre', autocomplete: 'off', autocapitalize: 'words' });
  if (inicial) { tel.value = inicial.telefonoTexto || inicial.telefono || ''; nombre.value = inicial.nombre || ''; }
  const errTel = h('span', { class: 'error' }), errNom = h('span', { class: 'error' });
  tel.addEventListener('input', () => {
    const t = telefonoInternacional(tel.value);
    const c = t && clientes.find(x => x.telefono === t);
    if (c && !nombre.value.trim()) nombre.value = c.nombre;
    errTel.textContent = '';
    alCambiar();
  });
  tel.addEventListener('blur', () => { if (tel.value.trim() && !telefonoInternacional(tel.value)) errTel.textContent = 'Teléfono no válido'; });
  nombre.addEventListener('input', () => { errNom.textContent = ''; alCambiar(); });
  const el = h('div', { class: 'cliente' },
    h('div', { class: 'campo' }, h('label', { for: 'cli-tel' }, 'Teléfono del cliente'), tel, errTel),
    h('div', { class: 'campo' }, h('label', { for: 'cli-nombre' }, 'Nombre'), nombre, errNom));
  // Qué le falta al cliente ('tel', 'nombre' o null) y marcarlo: error bajo el campo y foco en él.
  const falta = () => (!telefonoInternacional(tel.value) ? 'tel' : nombre.value.trim().length < 2 ? 'nombre' : null);
  const marcar = cual => {
    if (cual === 'tel') { errTel.textContent = tel.value.trim() ? 'Teléfono no válido' : 'Escribe el teléfono del cliente'; tel.focus(); }
    if (cual === 'nombre') { errNom.textContent = 'Escribe el nombre del cliente'; nombre.focus(); }
  };
  return {
    el, quitar, falta, marcar,
    valido: () => !falta(),
    datos: () => ({ nombre: nombre.value.trim(), telefono: telefonoInternacional(tel.value) }),
    foco: () => tel.focus(),
  };
}

// Teléfono legible: 58 412 123 4567 → 0412 123 4567; 57 300… → 300 123 4567.
export function telefonoLegible(t) {
  const d = String(t || '');
  if (d.startsWith('58') && d.length === 12) return `0${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  if (d.startsWith('57') && d.length === 12) return `${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d ? '+' + d : '';
}

const avisar = () => window.dispatchEvent(new CustomEvent('pos:carrito'));

// Ventana para registrar o editar el cliente del carrito.
export function ventanaCliente(ctx, alListo) {
  const c = ctx.carrito;
  const editar = !!c.cliente;
  const campos = camposCliente(ctx, () => {}, c.cliente && { nombre: c.cliente.nombre, telefonoTexto: telefonoLegible(c.cliente.telefono) });
  const b = h('button', { class: 'btn primary grande', id: 'cli-guardar' }, icono('check'), editar ? 'Guardar cliente' : 'Registrar cliente');
  const v = abrirVentana({ titulo: editar ? 'Editar cliente' : 'Registrar cliente', contenido: h('div', { class: 'pila' }, campos.el), acciones: b });
  v.alCerrar = () => campos.quitar();
  if (!esTelefono()) setTimeout(() => campos.foco(), 40);
  b.onclick = () => {
    const falta = campos.falta();
    if (falta) { campos.marcar(falta); return; }
    c.cliente = campos.datos();
    if (c.enviarRecibo == null) c.enviarRecibo = true;
    document.activeElement?.blur();
    v.cerrar(); avisar();
    alListo && alListo();
  };
}

// Sigue al pago solo con cliente registrado; si falta, primero pide registrarlo.
export function conCliente(ctx, seguir) {
  if (ctx.carrito?.cliente) seguir();
  else ventanaCliente(ctx, seguir);
}

// Bloque del cliente dentro del carrito: Registrar, o nombre + Editar + Enviar recibo.
export function bloqueCliente(ctx) {
  const c = ctx.carrito;
  if (!c.cliente) return h('button', { class: 'cliente-registrar', id: 'cli-registrar', onclick: () => ventanaCliente(ctx) }, icono('usuario'), 'Registrar cliente', h('span', { class: 'nota' }, 'Obligatorio para cobrar'));
  const recibo = c.enviarRecibo !== false;
  return h('div', { class: 'cliente-carrito' },
    h('div', { class: 'cli-fila' }, h('span', { class: 'cli-ic' }, icono('usuario')),
      h('div', { class: 'cli-datos' }, h('b', {}, c.cliente.nombre), h('span', { class: 'nota num' }, telefonoLegible(c.cliente.telefono))),
      h('button', { class: 'btn chico', id: 'cli-editar', onclick: () => ventanaCliente(ctx) }, icono('lapiz'), 'Editar')),
    h('button', { class: 'cli-recibo', id: 'cli-recibo', role: 'switch', 'aria-checked': String(recibo), onclick: () => { c.enviarRecibo = !recibo; avisar(); } },
      icono('mensaje'), 'Enviar recibo por WhatsApp', h('span', { class: 'sp' }), h('span', { class: 'switch' + (recibo ? ' on' : '') })));
}
