// Pantalla de entrada (usuario + PIN de 4 números) y creación del primer administrador.
import { h, icono } from '../ui.js';
import { APP_VERSION } from '../version.js';

const MENSAJES = {
  'no-existe': ['usuario', 'Ese usuario no existe'],
  pin: ['pin', 'PIN incorrecto'],
  inactivo: ['usuario', 'Usuario desactivado'],
  red: ['pin', 'Sin conexión a internet'],
  intentos: ['pin', 'Demasiados intentos. Espera unos minutos.'],
  datos: ['pin', 'Revisa los datos'],
  error: ['pin', 'No se pudo entrar'],
};

function campo(id, etiqueta, attrs) {
  return h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), h('input', { class: 'inp', id, ...attrs }), h('span', { class: 'error', 'data-de': id }));
}

export function pantallaEntrada(raiz, ctx, { demo }) {
  const form = h('form', { class: 'tarjeta entrar', novalidate: true },
    h('div', { class: 'entrar-logo' }, icono('carrito')),
    h('div', {}, h('h1', {}, 'Comic Shop · Punto de Venta'), h('p', { class: 'nota' }, 'Entra con el usuario y el PIN que te dio el administrador.')),
    campo('entrar-usuario', 'Usuario', { autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'next' }),
    campo('entrar-pin', 'PIN', { type: 'password', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', enterkeyhint: 'go' }),
    h('button', { class: 'btn primary grande', id: 'entrar-btn' }, icono('check'), 'Entrar'),
    demo ? h('p', { class: 'nota demo' }, 'Modo demostración: usuarios admin, encargada o vendedora · PIN 1234') : null,
    h('p', { class: 'ver-pie' }, `versión ${APP_VERSION}`));
  const error = (cual, texto) => { form.querySelectorAll('.error').forEach(e => { e.textContent = ''; }); if (cual) form.querySelector(`[data-de="entrar-${cual}"]`).textContent = texto; };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const usuario = form.querySelector('#entrar-usuario').value.trim();
    const pin = form.querySelector('#entrar-pin').value.trim();
    if (!usuario) return error('usuario', 'Escribe tu usuario');
    if (!/^\d{4}$/.test(pin)) return error('pin', 'El PIN debe tener 4 números');
    error(null);
    const b = form.querySelector('#entrar-btn'); b.disabled = true;
    const r = await ctx.almacen.entrar(usuario, pin);
    b.disabled = false;
    if (!r.ok) { const [c, t] = MENSAJES[r.error] || MENSAJES.error; error(c, t); }
  });
  raiz.replaceChildren(h('div', { class: 'puerta' }, form));
  setTimeout(() => form.querySelector('#entrar-usuario')?.focus(), 30);
}

export function pantallaPrimerAdmin(raiz, ctx) {
  const form = h('form', { class: 'tarjeta entrar', novalidate: true },
    h('div', { class: 'entrar-logo' }, icono('llave')),
    h('div', {}, h('h1', {}, 'Crear administrador'), h('p', { class: 'nota' }, 'Primera vez que se abre el punto de venta. Con este usuario darás de alta al resto del equipo. Esta pantalla no vuelve a aparecer.')),
    campo('adm-nombre', 'Tu nombre', { autocomplete: 'off' }),
    campo('adm-usuario', 'Usuario', { autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false' }),
    campo('adm-pin', 'PIN (4 números)', { type: 'password', inputmode: 'numeric', maxlength: '4' }),
    campo('adm-pin2', 'Repite el PIN', { type: 'password', inputmode: 'numeric', maxlength: '4' }),
    h('button', { class: 'btn primary grande' }, icono('check'), 'Crear y entrar'));
  const err = (id, t) => { form.querySelectorAll('.error').forEach(e => { e.textContent = ''; }); if (id) form.querySelector(`[data-de="${id}"]`).textContent = t; };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = id => form.querySelector('#' + id).value.trim();
    if (v('adm-nombre').length < 2) return err('adm-nombre', 'Escribe tu nombre');
    if (!/^[a-z0-9._-]{3,20}$/i.test(v('adm-usuario'))) return err('adm-usuario', 'Minúsculas y números, sin espacios (3 a 20)');
    if (!/^\d{4}$/.test(v('adm-pin'))) return err('adm-pin', 'El PIN debe tener 4 números');
    if (v('adm-pin') !== v('adm-pin2')) return err('adm-pin2', 'Los PIN no coinciden');
    const r = await ctx.almacen.crearAdministrador({ nombre: v('adm-nombre'), usuario: v('adm-usuario'), pin: v('adm-pin') });
    if (!r.ok) err('adm-pin2', r.error === 'red' ? 'Sin conexión a internet' : 'No se pudo crear');
  });
  raiz.replaceChildren(h('div', { class: 'puerta' }, form));
}
