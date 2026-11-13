// Cliente de la venta: pantalla propia al tocar Cobrar o Apartar, antes del pago (nombre y teléfono obligatorios).
import { h, icono, abrirVentana, esTelefono } from '../ui.js';
import { telefonoInternacional } from '../nucleo/recibo.js';

// Campos de cliente: nombre primero (sugiere clientes ya registrados) y luego el teléfono (si ya existe, completa el nombre).
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
  const sugerencias = h('div', { class: 'sugerencias-cli' });
  const sinTildes = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  nombre.addEventListener('input', () => {
    errNom.textContent = ''; alCambiar();
    const q = sinTildes(nombre.value.trim());
    const hallados = q.length < 2 ? [] : clientes.filter(c => sinTildes(c.nombre || '').includes(q)).slice(0, 3);
    sugerencias.replaceChildren(...hallados.map(c => h('button', { type: 'button', class: 'sug-cli', onclick: () => {
      nombre.value = c.nombre; tel.value = telefonoLegible(c.telefono); sugerencias.replaceChildren(); errTel.textContent = ''; alCambiar();
    } }, icono('usuario'), h('b', {}, c.nombre), h('span', { class: 'nota num' }, telefonoLegible(c.telefono)))));
  });
  const el = h('div', { class: 'cliente' },
    h('div', { class: 'campo' }, h('label', { for: 'cli-nombre' }, 'Nombre del cliente'), nombre, errNom, sugerencias),
    h('div', { class: 'campo' }, h('label', { for: 'cli-tel' }, 'Teléfono'), tel, errTel));
  // Qué le falta al cliente ('tel', 'nombre' o null) y marcarlo: error bajo el campo y foco en él.
  const falta = () => (nombre.value.trim().length < 2 ? 'nombre' : !telefonoInternacional(tel.value) ? 'tel' : null);
  const marcar = cual => {
    if (cual === 'tel') { errTel.textContent = tel.value.trim() ? 'Teléfono no válido' : 'Escribe el teléfono del cliente'; tel.focus(); }
    if (cual === 'nombre') { errNom.textContent = 'Escribe el nombre del cliente'; nombre.focus(); }
  };
  return {
    el, quitar, falta, marcar,
    valido: () => !falta(),
    datos: () => ({ nombre: nombre.value.trim(), telefono: telefonoInternacional(tel.value) }),
    foco: () => nombre.focus(),
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
  const b = h('button', { class: 'btn primary grande', id: 'cli-guardar' }, editar ? icono('check') : null, editar ? 'Guardar cliente' : 'Continuar al pago', editar ? null : icono('der'));
  const v = abrirVentana({ titulo: editar ? 'Editar cliente' : 'Cliente', pantallaCompleta: true, contenido: h('div', { class: 'pila' }, h('p', { class: 'nota' }, editar ? 'Corrige los datos del cliente.' : '¿A nombre de quién es la venta?'), campos.el), acciones: b });
  v.alCerrar = () => campos.quitar();
  if (!esTelefono()) setTimeout(() => campos.foco(), 40);
  b.onclick = () => {
    const falta = campos.falta();
    if (falta) { campos.marcar(falta); return; }
    c.cliente = campos.datos();
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
