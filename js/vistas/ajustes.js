// Ajustes (solo administrador): tasas, formas de pago, tramos, comisiones, tienda y usuarios.
import { h, icono, abrirVentana, toast, unaVez } from '../ui.js';
import { registrarVista } from '../app.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { etiquetaTramo } from '../nucleo/tramos.js';
import { NOMBRE_MONEDA } from '../nucleo/formas.js';
import { NOMBRE_ROL, cambiarTema } from './cuenta.js';

const campo = (id, etiqueta, attrs = {}) => h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), h('input', { class: 'inp', id, autocomplete: 'off', ...attrs }));
const seccion = (titulo, ic, ...hijos) => h('section', { class: 'tarjeta pila' }, h('h2', { class: 'sec-t' }, icono(ic), titulo), ...hijos);
// Monto de comisión: se muestra con punto de miles (4.000); vacío = usa el tramo anterior.
const montoCom = (id, valor, ejemplo, alCambiar) => {
  const inp = h('input', { class: 'inp num', id, inputmode: 'numeric', value: valor != null ? fmtCop(valor) : '', placeholder: ejemplo, 'aria-label': id.endsWith('normal') ? 'Comisión normal' : 'Comisión reducida' });
  inp.addEventListener('input', () => alCambiar(parseMonto(inp.value, 'COP')));
  inp.addEventListener('blur', () => { const n = parseMonto(inp.value, 'COP'); inp.value = n != null ? fmtCop(n) : ''; });
  return inp;
};
const guardado = r => toast(r.ok ? 'Guardado' : 'No se pudo guardar', { malo: !r.ok });

function tasas(ctx) {
  const aj = ctx.ajustesTasas || {};
  // Modo de la tasa de Bs con botones (no la lista del teléfono) y solo el campo que aplica a cada modo.
  const modo = { value: aj.bsModo || 'binance' };
  const MODOS = [['binance', 'Binance', 'Automático desde Binance P2P, más el recargo.'], ['bcv', 'BCV', 'Automático, dólar oficial del BCV.'], ['manual', 'Manual', 'La escribes tú.']];
  const segModo = h('div', { class: 'segmentado', id: 'aj-bs-modo', role: 'group', 'aria-label': 'Bolívares por dólar' });
  const ayuda = h('p', { class: 'nota chica' });
  const recargo = campo('aj-recargo', 'Recargo sobre Binance (Bs)', { inputmode: 'decimal', value: aj.bsRecargo != null ? fmtDec(aj.bsRecargo) : '' });
  const manualC = campo('aj-bs-manual', 'Tasa manual de Bs', { inputmode: 'decimal', value: aj.bsManual ? fmtDec(aj.bsManual) : '' });
  const pintarModo = () => {
    segModo.replaceChildren(...MODOS.map(([v, t]) => h('button', { type: 'button', 'data-modo': v, 'aria-pressed': String(v === modo.value), onclick: () => { modo.value = v; pintarModo(); } }, t)));
    ayuda.textContent = MODOS.find(m => m[0] === modo.value)[2];
    recargo.hidden = modo.value !== 'binance';
    manualC.hidden = modo.value !== 'manual';
  };
  pintarModo();
  const el = seccion('Tasas', 'monedas',
    campo('aj-cop', 'Pesos por dólar (COP)', { inputmode: 'decimal', value: aj.copPorUsd ? fmtCop(aj.copPorUsd) : '' }),
    h('div', { class: 'campo' }, h('label', {}, 'Bolívares por dólar'), segModo, ayuda),
    recargo, manualC,
    h('div', { class: 'acciones' }, h('button', { class: 'btn primary', id: 'aj-tasas-guardar', onclick: async () => {
      const v = (id, m) => parseMonto(el.querySelector('#' + id).value, m);
      const ahora = new Date().toISOString();
      const cop = v('aj-cop', 'COP'), manual = v('aj-bs-manual', 'BS');
      const datos = { bsModo: modo.value, bsRecargo: v('aj-recargo', 'BS') || 0 };
      if (cop && cop !== aj.copPorUsd) Object.assign(datos, { copPorUsd: cop, copActualizada: ahora });
      if (manual && manual !== aj.bsManual) Object.assign(datos, { bsManual: manual, bsManualActualizada: ahora });
      if (modo.value === 'manual' && !manual) { toast('Escribe la tasa manual de Bs', { malo: true }); return; }
      guardado(await ctx.almacen.guardarAjustes('tasas', datos));
    } }, 'Guardar tasas')));
  return el;
}

function general(ctx) {
  const aj = ctx.ajustes;
  const formas = aj.formasPago.map(f => ({ ...f }));
  const tramos = [...aj.tramos];
  const coms = aj.comisiones.map(c => (c ? { ...c } : null));
  const el = seccion('Venta y cobro', 'ajustes',
    h('div', { class: 'rejilla-aj' }, campo('aj-tienda', 'Nombre de la tienda', { value: aj.tienda?.nombre || '' }), campo('aj-redondeo', 'Redondeo del vuelto (COP)', { inputmode: 'numeric', value: String(aj.redondeo) }), campo('aj-desc-max', 'Descuento máximo de la vendedora (%)', { inputmode: 'decimal', value: String(aj.descuentoMaxVendedora) })),
    h('h3', { class: 'sub-t' }, 'Formas de pago'),
    h('div', { class: 'pila' }, ...formas.map(f => h('div', { class: 'forma-aj' },
      h('input', { class: 'inp', value: f.nombre, 'aria-label': 'Nombre', oninput: e => { f.nombre = e.target.value; } }),
      h('span', { class: `nota ${{ COP: 'c-cop', USD: 'c-usd', BS: 'c-bs' }[f.moneda]}` }, NOMBRE_MONEDA[f.moneda]),
      h('label', { class: 'interruptor' }, h('input', { type: 'checkbox', checked: f.activa !== false, onchange: e => { f.activa = e.target.checked; } }), 'Activa')))),
    h('h3', { class: 'sub-t' }, 'Tramos (desde cuántas prendas)'),
    h('div', { class: 'rejilla-aj' }, ...tramos.map((t, i) => h('div', { class: 'campo' }, h('label', {}, `Tramo ${i + 1}`), h('input', { class: 'inp num', inputmode: 'numeric', value: String(t), disabled: i === 0, oninput: e => { tramos[i] = Number(e.target.value) || tramos[i]; } })))),
    h('h3', { class: 'sub-t' }, 'Comisión por prenda (si el producto no trae la suya)'),
    h('div', { class: 'rejilla-aj' }, ...coms.map((c, i) => h('div', { class: 'campo' }, h('label', {}, `${etiquetaTramo(i, tramos)}: normal / reducida`),
      h('div', { class: 'dos' }, montoCom(`aj-com-${i}-normal`, c ? c.valor : null, i ? `Igual que ${etiquetaTramo(i - 1, tramos)}` : '', n => { coms[i] = n == null ? null : { ...(coms[i] || { tipo: 'Fijo' }), valor: n, reducida: coms[i]?.reducida ?? n }; }),
        montoCom(`aj-com-${i}-reducida`, c ? c.reducida : null, i ? `Igual que ${etiquetaTramo(i - 1, tramos)}` : '', n => { if (coms[i]) coms[i].reducida = n ?? coms[i].valor; }))))),
    h('div', { class: 'acciones' }, h('button', { class: 'btn primary', onclick: async () => {
      for (let i = 1; i < tramos.length; i++) if (tramos[i] <= tramos[i - 1]) { toast('Cada tramo debe empezar después del anterior', { malo: true }); return; }
      const v = id => el.querySelector('#' + id).value;
      guardado(await ctx.almacen.guardarAjustes('general', {
        tienda: { ...(aj.tienda || {}), nombre: v('aj-tienda').trim() || 'Comic Shop' },
        redondeo: parseMonto(v('aj-redondeo'), 'COP') || 100, descuentoMaxVendedora: Number(String(v('aj-desc-max')).replace(',', '.')) || 0,
        formasPago: formas, tramos, comisiones: coms,
      }));
    } }, 'Guardar')));
  return el;
}

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
      u.uid !== ctx.sesion.uid ? h('div', { class: 'acciones' },
        h('button', { class: 'btn', onclick: async () => { const pin = await pedirPin(`Nuevo PIN para ${u.nombre}`); if (pin) guardado(await ctx.almacen.cambiarPin(u.uid, pin)); } }, icono('llave'), 'Nuevo PIN'),
        h('button', { class: 'btn ' + (u.activo ? 'danger' : ''), onclick: async () => guardado(await ctx.almacen.activarUsuario(u.uid, !u.activo)) }, u.activo ? 'Desactivar' : 'Activar')) : null)));
  });
  return { el, quitar };
}

registrarVista('/ajustes', {
  accion: 'ajustes',
  montar(cont, ctx) {
    const u = usuarios(ctx);
    cont.append(h('h1', { class: 'sec-t' }, icono('ajustes'), 'Ajustes'), h('div', { class: 'ajustes' }, tasas(ctx), general(ctx), u.el,
      seccion('Apariencia', 'luna', h('button', { class: 'btn', onclick: cambiarTema }, icono('luna'), 'Tema claro u oscuro'))));
    return u.quitar;
  },
});
