// Ajustes (solo administrador), en 4 apartados: Tasas, Venta, Pagos y Recibo. Los usuarios están en Más → Usuarios.
import { h, icono, abrirVentana, toast, unaVez } from '../ui.js';
import { registrarVista } from '../app.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { etiquetaTramo } from '../nucleo/tramos.js';
import { NOMBRE_MONEDA, ICONOS_FORMA, iconoForma } from '../nucleo/formas.js';
import { PLANTILLA_DEFECTO, VARIABLES_RECIBO, textoRecibo } from '../nucleo/recibo.js';

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
  const segModo = h('div', { class: 'segmentado', id: 'aj-bs-modo', role: 'group', 'aria-label': 'Bs por dólar' });
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
    h('div', { class: 'campo' }, h('label', {}, 'Bs por dólar'), segModo, ayuda),
    recargo, manualC);
  // Devuelve true si se guardó (o no había nada que guardar).
  const guardar = async () => {
    const v = (id, m) => parseMonto(el.querySelector('#' + id).value, m);
    const ahora = new Date().toISOString();
    const cop = v('aj-cop', 'COP'), manual = v('aj-bs-manual', 'BS');
    const datos = { bsModo: modo.value, bsRecargo: v('aj-recargo', 'BS') || 0 };
    if (cop && cop !== aj.copPorUsd) Object.assign(datos, { copPorUsd: cop, copActualizada: ahora });
    if (manual && manual !== aj.bsManual) Object.assign(datos, { bsManual: manual, bsManualActualizada: ahora });
    if (modo.value === 'manual' && !manual) { toast('Escribe la tasa manual de Bs', { malo: true }); return false; }
    return (await ctx.almacen.guardarAjustes('tasas', datos)).ok;
  };
  return { el, guardar };
}

function venta(ctx) {
  const aj = ctx.ajustes;
  const tramos = [...aj.tramos];
  const coms = aj.comisiones.map(c => (c ? { ...c } : null));
  const el = seccion('Venta', 'carrito',
    h('div', { class: 'rejilla-aj' }, campo('aj-tienda', 'Nombre de la tienda', { value: aj.tienda?.nombre || '' }), campo('aj-redondeo', 'Redondeo del vuelto (COP)', { inputmode: 'numeric', value: String(aj.redondeo) }), campo('aj-desc-max', 'Descuento máximo de la vendedora (%)', { inputmode: 'decimal', value: String(aj.descuentoMaxVendedora) })),
    h('h3', { class: 'sub-t' }, 'Tramos (desde cuántas prendas)'),
    h('div', { class: 'rejilla-aj' }, ...tramos.map((t, i) => h('div', { class: 'campo' }, h('label', {}, `Tramo ${i + 1}`), h('input', { class: 'inp num', inputmode: 'numeric', value: String(t), disabled: i === 0, oninput: e => { tramos[i] = Number(e.target.value) || tramos[i]; } })))),
    h('h3', { class: 'sub-t' }, 'Comisión por prenda (si el producto no trae la suya)'),
    h('div', { class: 'rejilla-aj' }, ...coms.map((c, i) => h('div', { class: 'campo' }, h('label', {}, `${etiquetaTramo(i, tramos)}: normal / reducida`),
      h('div', { class: 'dos' }, montoCom(`aj-com-${i}-normal`, c ? c.valor : null, i ? `Igual que ${etiquetaTramo(i - 1, tramos)}` : '', n => { coms[i] = n == null ? null : { ...(coms[i] || { tipo: 'Fijo' }), valor: n, reducida: coms[i]?.reducida ?? n }; }),
        montoCom(`aj-com-${i}-reducida`, c ? c.reducida : null, i ? `Igual que ${etiquetaTramo(i - 1, tramos)}` : '', n => { if (coms[i]) coms[i].reducida = n ?? coms[i].valor; }))))),
  );
  const guardar = async () => {
    for (let i = 1; i < tramos.length; i++) if (tramos[i] <= tramos[i - 1]) { toast('Cada tramo debe empezar después del anterior', { malo: true }); return false; }
    const v = id => el.querySelector('#' + id).value;
    return {
      tienda: { ...(aj.tienda || {}), nombre: v('aj-tienda').trim() || 'Comic Shop' },
      redondeo: parseMonto(v('aj-redondeo'), 'COP') || 100, descuentoMaxVendedora: Number(String(v('aj-desc-max')).replace(',', '.')) || 0,
      tramos, comisiones: coms,
    };
  };
  return { el, guardar };
}

// Formas de pago en tarjetas: apagadas se ven opacas; al tocarlas se activan con el color de su moneda.
function pagos(ctx, alCambiar) {
  let formas = ctx.ajustes.formasPago.map(f => ({ ...f }));
  const rejilla = h('div', { class: 'formas-aj' });
  const pintar = () => rejilla.replaceChildren(...formas.map(f => {
    const activa = f.activa !== false;
    return h('div', { class: `forma-tarjeta m-${f.moneda.toLowerCase()}` + (activa ? ' activa' : ''), 'data-forma': f.id },
      h('button', { type: 'button', class: 'forma-toque', 'aria-pressed': String(activa), 'aria-label': `${f.nombre}: ${activa ? 'activa' : 'apagada'}`,
        onclick: () => { f.activa = !activa; pintar(); alCambiar(); } },
        h('span', { class: 'forma-ic' }, icono(iconoForma(f))),
        h('span', { class: 'forma-txt' }, h('b', {}, f.nombre),
          h('span', { class: 'forma-pie' }, h('span', { class: 'moneda' }, NOMBRE_MONEDA[f.moneda]), f.efectivo ? ' · efectivo' : '', ' · ', h('span', { class: 'forma-est' }, activa ? 'Activa' : 'Apagada')))),
      h('div', { class: 'forma-acc' },
        h('button', { type: 'button', class: 'ibtn chico', 'aria-label': `Editar ${f.nombre}`, onclick: () => editarForma(f, d => { Object.assign(f, d); pintar(); alCambiar(); }) }, icono('lapiz')),
        h('button', { type: 'button', class: 'ibtn chico peligro', 'aria-label': `Eliminar ${f.nombre}`, onclick: () => {
          const antes = formas;
          formas = formas.filter(x => x !== f); pintar(); alCambiar();
          toast(`${f.nombre} eliminada`, { deshacer: () => { formas = antes; pintar(); } });
        } }, icono('borrar'))));
  }), h('button', { type: 'button', class: 'forma-nueva', id: 'aj-forma-nueva', onclick: () => editarForma(null, d => {
    let id = d.nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'forma';
    while (formas.some(x => x.id === id)) id += '-2';
    formas.push({ id, activa: true, ...d }); pintar(); alCambiar();
  }) }, icono('mas1'), 'Agregar forma de pago'));
  pintar();
  const el = seccion('Formas de pago', 'monedas', h('p', { class: 'nota' }, 'Toca una forma para activarla o apagarla. Las apagadas no salen al cobrar.'), rejilla);
  const guardar = async () => {
    if (!formas.some(f => f.activa !== false)) { toast('Deja al menos una forma de pago activa', { malo: true }); return false; }
    return { formasPago: formas };
  };
  return { el, guardar };
}

function editarForma(f, alGuardar) {
  let moneda = f?.moneda || 'COP', ic = f ? iconoForma(f) : 'billete';
  const nombre = h('input', { class: 'inp', id: 'fp-nombre', value: f?.nombre || '', placeholder: 'Ej. Nequi' });
  const efectivo = h('input', { type: 'checkbox', id: 'fp-efectivo', checked: !!f?.efectivo });
  const err = h('span', { class: 'error' });
  const segMon = h('div', { class: 'segmentado', id: 'fp-moneda' });
  const iconos = h('div', { class: 'iconos-forma' });
  const pintar = () => {
    segMon.replaceChildren(...['COP', 'USD', 'BS'].map(m => h('button', { type: 'button', 'data-moneda': m, 'aria-pressed': String(m === moneda), onclick: () => { moneda = m; pintar(); } }, NOMBRE_MONEDA[m])));
    iconos.replaceChildren(...ICONOS_FORMA.map(n => h('button', { type: 'button', class: 'ibtn', 'data-icono': n, 'aria-label': n, 'aria-pressed': String(n === ic), onclick: () => { ic = n; pintar(); } }, icono(n))));
  };
  pintar();
  const b = h('button', { class: 'btn primary', id: 'fp-guardar' }, icono('check'), f ? 'Guardar' : 'Agregar');
  const v = abrirVentana({ titulo: f ? 'Editar forma de pago' : 'Nueva forma de pago', contenido: h('div', { class: 'pila' },
    h('div', { class: 'campo' }, h('label', { for: 'fp-nombre' }, 'Nombre'), nombre, err),
    h('div', { class: 'campo' }, h('label', {}, 'Moneda'), segMon),
    h('div', { class: 'campo' }, h('label', {}, 'Ícono'), iconos),
    h('label', { class: 'interruptor' }, efectivo, 'Es efectivo (se cuenta en la caja)')), acciones: h('div', { class: 'acciones' }, b) });
  b.onclick = () => {
    if (nombre.value.trim().length < 2) { err.textContent = 'Escribe el nombre'; return; }
    alGuardar({ nombre: nombre.value.trim(), moneda, icono: ic, efectivo: efectivo.checked });
    v.cerrar();
  };
}

// Recibo por WhatsApp: primero la vista previa (como la ve el cliente) y debajo el mensaje para editar.
const EJEMPLO = { fecha: new Date().toISOString(), numero: 'V-0001', cliente: { nombre: 'Juan Pérez', telefono: '584121234567' }, tasas: { copPorUsd: 3900, bsPorUsd: 1075 },
  lineas: [{ cantidad: 2, nombre: 'Franela Negra', talla: 'M', subtotal: 48000 }], subtotal: 48000, descuento: null, total: 48000,
  pagos: [{ nombre: 'Efectivo pesos', monto: 50000, moneda: 'COP' }], vuelto: { monto: 2000, moneda: 'COP' } };

function recibo(ctx) {
  const area = h('textarea', { class: 'inp plantilla', id: 'aj-plantilla', rows: 12, spellcheck: 'true' });
  area.value = ctx.ajustes.recibo?.plantilla?.trim() ? ctx.ajustes.recibo.plantilla : PLANTILLA_DEFECTO;
  const burbuja = h('div', { class: 'wa-burbuja', id: 'aj-recibo-vista' });
  const pintar = () => {
    const txt = textoRecibo(EJEMPLO, ctx.ajustes.tienda || { nombre: 'Comic Shop' }, { plantilla: area.value });
    // Como en WhatsApp: *texto* se ve en negrita.
    burbuja.replaceChildren(...txt.split(/(\*[^*\n]+\*)/).map(t => (/^\*[^*]+\*$/.test(t) ? h('b', {}, t.slice(1, -1)) : t)));
  };
  const insertar = clave => {
    const t = `{${clave}}`, i = area.selectionStart ?? area.value.length, f = area.selectionEnd ?? i;
    area.value = area.value.slice(0, i) + t + area.value.slice(f);
    area.focus(); area.setSelectionRange(i + t.length, i + t.length);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const el = seccion('Recibo por WhatsApp', 'recibo',
    h('div', { class: 'wa-fondo' }, burbuja),
    h('div', { class: 'campo' }, h('label', { for: 'aj-plantilla' }, 'Mensaje'), area,
      h('span', { class: 'nota chica' }, 'Usa *asteriscos* para negrita. Toca un dato para ponerlo donde está el cursor:')),
    h('div', { class: 'chips-recibo' }, ...VARIABLES_RECIBO.map(([k, t]) => h('button', { type: 'button', class: 'chip', 'data-variable': k, onclick: () => insertar(k) }, icono('mas1'), t))),
    h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'btn', id: 'aj-recibo-original', onclick: () => { area.value = PLANTILLA_DEFECTO; area.dispatchEvent(new Event('input', { bubbles: true })); } }, icono('actualizar'), 'Volver al mensaje original')));
  area.addEventListener('input', pintar);
  pintar();
  return { el, guardar: async () => ({ recibo: { plantilla: area.value } }), pintar };
}

const PESTANAS = [['tasas', 'Tasas'], ['venta', 'Venta'], ['pagos', 'Pagos'], ['recibo', 'Recibo']];
let pestanaActual = 'tasas';

registrarVista('/ajustes', {
  accion: 'ajustes',
  montar(cont, ctx) {
    const boton = h('button', { class: 'btn primary', id: 'aj-guardar' }, icono('check'), 'Guardar cambios');
    const barra = h('div', { class: 'guardar-ajustes', hidden: true }, h('span', {}, 'Cambios sin guardar'), boton);
    const cambio = () => { barra.hidden = false; };
    const t = tasas(ctx), ve = venta(ctx), pa = pagos(ctx, cambio), re = recibo(ctx);
    const secciones = { tasas: t.el, venta: ve.el, pagos: pa.el, recibo: re.el };
    // Un solo botón para guardar; aparece cuando se cambia algo.
    for (const sec of [t.el, ve.el, re.el]) { sec.addEventListener('input', cambio); sec.addEventListener('change', cambio); sec.addEventListener('click', e => { if (e.target.closest('.segmentado button, button[aria-pressed]')) cambio(); }); }
    boton.addEventListener('click', e => unaVez(e.currentTarget, async () => {
      if (!(await t.guardar())) return;
      const partes = [await ve.guardar(), await pa.guardar(), await re.guardar()];
      if (partes.some(x => !x)) return;
      const r = await ctx.almacen.guardarAjustes('general', Object.assign({}, ...partes));
      if (!r.ok) { toast('No se pudo guardar', { malo: true }); return; }
      barra.hidden = true; document.activeElement?.blur(); toast('Cambios guardados');
    })());
    const pest = h('div', { class: 'segmentado pestanas-aj', role: 'tablist' });
    const mostrar = id => {
      pestanaActual = id;
      pest.replaceChildren(...PESTANAS.map(([k, txt]) => h('button', { type: 'button', role: 'tab', id: 'aj-tab-' + k, 'aria-selected': String(k === id), 'aria-pressed': String(k === id), onclick: () => mostrar(k) }, txt)));
      for (const [k, el] of Object.entries(secciones)) el.hidden = k !== id;
      if (id === 'recibo') re.pintar();
    };
    mostrar(pestanaActual);
    cont.append(barra, pest, h('div', { class: 'ajustes' }, ...Object.values(secciones)));
  },
});
