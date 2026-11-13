// Ajustes (solo administrador), en 4 apartados: Tasas, Venta, Pagos y Recibo. Los usuarios están en Más → Usuarios.
import { h, icono, abrirVentana, toast, unaVez, desplegar, esTelefono } from '../ui.js';
import { registrarVista } from '../app.js';
import { fmtCop, fmtDec, parseMonto } from '../nucleo/dinero.js';
import { etiquetaTramo } from '../nucleo/tramos.js';
import { NOMBRE_MONEDA, ICONOS_FORMA, iconoForma } from '../nucleo/formas.js';
import { PLANTILLA_DEFECTO, VARIABLES_RECIBO, textoRecibo } from '../nucleo/recibo.js';

const campo = (id, etiqueta, attrs = {}) => h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), h('input', { class: 'inp', id, autocomplete: 'off', ...attrs }));
const seccion = (titulo, ic, ...hijos) => h('section', { class: 'tarjeta pila' }, titulo ? h('h2', { class: 'sec-t' }, icono(ic), titulo) : null, ...hijos);
// Monto de comisión: se muestra con punto de miles (4.000); vacío = usa el tramo anterior.
const montoCom = (id, valor, ejemplo, alCambiar) => {
  const inp = h('input', { class: 'inp num', id, inputmode: 'numeric', value: valor != null ? fmtCop(valor) : '', placeholder: ejemplo, 'aria-label': id.endsWith('normal') ? 'Comisión normal' : 'Comisión reducida' });
  inp.addEventListener('input', () => alCambiar(parseMonto(inp.value, 'COP')));
  inp.addEventListener('blur', () => { const n = parseMonto(inp.value, 'COP'); inp.value = n != null ? fmtCop(n) : ''; });
  return inp;
};
const guardado = r => toast(r.ok ? 'Guardado' : 'No se pudo guardar', { malo: !r.ok });

// "hace 15 min" a partir de una fecha ISO.
function haceTiempo(iso) {
  if (!iso) return 'sin datos';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  return hr < 24 ? `hace ${hr} h` : `hace ${Math.round(hr / 24)} d`;
}

// Tasas como en la Calculadora de Tasas: pesos por dólar arriba y, para Bs, tres opciones en tarjetas
// (Binance P2P con recargo, BCV oficial o Manual), cada una con su tasa a la derecha.
function tasas(ctx) {
  const aj = ctx.ajustesTasas || {};
  const remota = ctx.tasaRemota || {};
  const modo = { value: aj.bsModo || 'binance' };
  const entrada = (id, valor, sufijo, nombre) => h('div', { class: 'tasa-entrada' }, h('input', { class: 'inp num', id, inputmode: 'decimal', value: valor, 'aria-label': nombre }), h('span', { class: 'suf' }, sufijo));
  const filaUsd = (inp, sufijo) => h('div', { class: 'fila-usd' }, h('span', { class: 'usd-eq' }, '1 USD ='), inp);
  const cop = entrada('aj-cop', aj.copPorUsd ? fmtCop(aj.copPorUsd) : '', 'COP');
  const recargo = entrada('aj-recargo', aj.bsRecargo != null ? fmtDec(aj.bsRecargo) : '', 'Bs.', 'Recargo en Bs sobre Binance');
  const manual = entrada('aj-bs-manual', aj.bsManual ? fmtDec(aj.bsManual) : '', 'Bs.', 'Tasa Bs por dólar');
  const valBin = h('span', { class: 'modo-val num' }), valBcv = h('span', { class: 'modo-val num' }), valMan = h('span', { class: 'modo-val num' });
  const base = Number(remota.rate) || null, bcv = Number(remota.bcv?.rate) || null;
  const num = (inp, m) => parseMonto(inp.querySelector('input').value, m);
  const tarjeta = (v, titulo, desc, valor, extra) => h('div', { class: 'modo-bs', 'data-modo': v, role: 'radio', tabindex: '0',
    onclick: e => { if (modo.value !== v) { modo.value = v; pintar(); if (!e.target.closest('input')) e.currentTarget.dispatchEvent(new Event('change', { bubbles: true })); } } },
    h('div', { class: 'modo-cab' }, h('span', { class: 'radio' }), h('div', { class: 'modo-txt' }, h('b', {}, titulo), h('span', { class: 'nota' }, desc)), valor),
    extra);
  const cBin = tarjeta('binance', 'Binance P2P', base ? `Binance ${fmtDec(base)} · ${haceTiempo(remota.updated_at)}` : 'Todavía sin datos', valBin, h('div', { class: 'modo-extra' }, h('div', { class: 'fila-usd' }, h('span', { class: 'usd-eq' }, 'Recargo: +'), recargo)));
  const cBcv = tarjeta('bcv', 'BCV oficial', remota.bcv?.updated_at ? `Banco Central · ${haceTiempo(remota.bcv.updated_at)}` : 'Banco Central · sin datos', valBcv, null);
  const cMan = tarjeta('manual', 'Manual', 'Escribe tú la tasa: cuántos Bs. equivalen a 1 USD', valMan, h('div', { class: 'modo-extra' }, filaUsd(manual)));
  const grupo = h('div', { class: 'modos-bs', id: 'aj-bs-modo', role: 'radiogroup', 'aria-label': 'Bs por dólar' }, cBin, cBcv, cMan);
  function pintar() {
    for (const c of [cBin, cBcv, cMan]) { const on = c.dataset.modo === modo.value; c.classList.toggle('activo', on); c.setAttribute('aria-checked', String(on)); c.setAttribute('aria-pressed', String(on)); }
    const r = num(recargo, 'BS') || 0;
    valBin.textContent = base ? `${fmtDec(base + r)} Bs.` : '—';
    valBcv.textContent = bcv ? `${fmtDec(bcv)} Bs.` : '—';
  }
  recargo.addEventListener('input', pintar);
  manual.addEventListener('input', () => { modo.value = 'manual'; pintar(); });
  pintar();
  const el = seccion(null, null,
    h('div', { class: 'campo' }, h('label', { class: 'et-moneda', for: 'aj-cop' }, 'Peso colombiano'), filaUsd(cop)),
    h('div', { class: 'campo' }, h('label', { class: 'et-moneda' }, 'Bs'), grupo));
  // Devuelve true si se guardó (o no había nada que guardar).
  const guardar = async () => {
    const ahora = new Date().toISOString();
    const vCop = num(cop, 'COP'), vMan = num(manual, 'BS');
    const datos = { bsModo: modo.value, bsRecargo: num(recargo, 'BS') || 0 };
    if (vCop && vCop !== aj.copPorUsd) Object.assign(datos, { copPorUsd: vCop, copActualizada: ahora });
    if (vMan && vMan !== aj.bsManual) Object.assign(datos, { bsManual: vMan, bsManualActualizada: ahora });
    if (modo.value === 'manual' && !vMan) { toast('Escribe la tasa manual de Bs', { malo: true }); return false; }
    return (await ctx.almacen.guardarAjustes('tasas', datos)).ok;
  };
  return { el, guardar };
}

function venta(ctx) {
  const aj = ctx.ajustes;
  const tramos = [...aj.tramos];
  const coms = aj.comisiones.map(c => (c ? { ...c } : null));
  // Tramos y comisión: tarjetas que se despliegan (como Usuarios).
  const desplegable = (id, ic, titulo, desc, ...cuerpo) => {
    const caja = h('div', { class: 'despl-cuerpo' }, ...cuerpo);
    const det = h('details', { class: 'despl', id }, h('summary', {
      // Se abre y cierra con la misma animación que Usuarios (como en Pedidos).
      onclick: e => {
        e.preventDefault();
        if (det.open) desplegar(caja, false, () => { det.open = false; caja.hidden = false; });
        else { det.open = true; desplegar(caja, true); }
      } }, h('span', { class: 'despl-ic' }, icono(ic)),
      h('span', { class: 'despl-t' }, h('b', {}, titulo), h('span', { class: 'nota' }, desc)), icono('abajo')), caja);
    return det;
  };
  const el = seccion(null, null,
    h('div', { class: 'rejilla-aj' }, campo('aj-redondeo', 'Redondeo del vuelto (COP)', { inputmode: 'numeric', value: String(aj.redondeo) })),
    desplegable('aj-tramos', 'etiqueta', 'Tramos de precio', 'Desde cuántas prendas cambia el precio',
      h('div', { class: 'rejilla-aj' }, ...tramos.map((t, i) => h('div', { class: 'campo' }, h('label', {}, `Tramo ${i + 1}`), h('input', { class: 'inp num', inputmode: 'numeric', value: String(t), disabled: i === 0, oninput: e => { tramos[i] = Number(e.target.value) || tramos[i]; } }))))),
    desplegable('aj-comision', 'cartera', 'Comisión por prenda', 'Si el producto no trae la suya; normal y reducida (descuento u oferta)',
      h('div', { class: 'rejilla-aj' }, ...coms.map((c, i) => h('div', { class: 'campo' }, h('label', {}, `${etiquetaTramo(i, tramos)}: normal / reducida`),
        h('div', { class: 'dos' }, montoCom(`aj-com-${i}-normal`, c ? c.valor : null, i ? `Igual que ${etiquetaTramo(i - 1, tramos)}` : '', n => { coms[i] = n == null ? null : { ...(coms[i] || { tipo: 'Fijo' }), valor: n, reducida: coms[i]?.reducida ?? n }; }),
          montoCom(`aj-com-${i}-reducida`, c ? c.reducida : null, i ? `Igual que ${etiquetaTramo(i - 1, tramos)}` : '', n => { if (coms[i]) coms[i].reducida = n ?? coms[i].valor; })))))),
  );
  const guardar = async () => {
    for (let i = 1; i < tramos.length; i++) if (tramos[i] <= tramos[i - 1]) { toast('Cada tramo debe empezar después del anterior', { malo: true }); return false; }
    const v = id => el.querySelector('#' + id).value;
    return {
      redondeo: parseMonto(v('aj-redondeo'), 'COP') || 100,
      tramos, comisiones: coms,
    };
  };
  return { el, guardar };
}

// Formas de pago en tarjetas: apagadas se ven opacas; al tocarlas se activan con el color de su moneda.
function pagos(ctx, alCambiar) {
  let formas = ctx.ajustes.formasPago.map(f => ({ ...f }));
  const rejilla = h('div', { class: 'formas-aj' });
  // Un solo botón ⋮ por tarjeta con «Editar» y «Eliminar» (menos íconos compitiendo en la pantalla).
  const menuForma = f => {
    const menu = h('div', { class: 'menu-acc', role: 'menu', hidden: true },
      h('button', { type: 'button', role: 'menuitem', 'aria-label': `Editar ${f.nombre}`, onclick: () => { cerrarMenus(); editarForma(f, d => { Object.assign(f, d); pintar(); alCambiar(); }); } }, icono('lapiz'), 'Editar'),
      h('button', { type: 'button', role: 'menuitem', class: 'peligro', 'aria-label': `Eliminar ${f.nombre}`, onclick: () => {
        cerrarMenus();
        const antes = formas;
        formas = formas.filter(x => x !== f); pintar(); alCambiar();
        toast(`${f.nombre} eliminada`, { deshacer: () => { formas = antes; pintar(); } });
      } }, icono('borrar'), 'Eliminar'));
    const boton = h('button', { type: 'button', class: 'ibtn chico', 'aria-label': `Opciones de ${f.nombre}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      onclick: e => { e.stopPropagation(); const abrir = menu.hidden; cerrarMenus(); menu.hidden = !abrir; boton.setAttribute('aria-expanded', String(abrir)); } }, icono('puntos'));
    return h('div', { class: 'forma-acc' }, boton, menu);
  };
  const cerrarMenus = () => rejilla.querySelectorAll('.menu-acc').forEach(m => { m.hidden = true; m.previousElementSibling?.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', e => { if (!e.target.closest('.forma-acc')) cerrarMenus(); });
  const pintar = () => rejilla.replaceChildren(...formas.map(f => {
    const activa = f.activa !== false;
    return h('div', { class: `forma-tarjeta m-${f.moneda.toLowerCase()}` + (activa ? ' activa' : ''), 'data-forma': f.id },
      h('button', { type: 'button', class: 'forma-toque', 'aria-pressed': String(activa), 'aria-label': `${f.nombre}: ${activa ? 'activa' : 'apagada'}`,
        onclick: () => { f.activa = !activa; pintar(); alCambiar(); } },
        h('span', { class: 'forma-ic' }, icono(iconoForma(f))),
        h('span', { class: 'forma-txt' }, h('b', {}, f.nombre),
          h('span', { class: 'forma-pie' }, h('span', { class: 'moneda' }, NOMBRE_MONEDA[f.moneda]), f.efectivo ? ' · efectivo' : ''))),
      menuForma(f));
  }), h('button', { type: 'button', class: 'forma-nueva', id: 'aj-forma-nueva', onclick: () => editarForma(null, d => {
    let id = d.nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'forma';
    while (formas.some(x => x.id === id)) id += '-2';
    formas.push({ id, activa: true, ...d }); pintar(); alCambiar();
  }) }, icono('mas1'), 'Agregar forma de pago'));
  pintar();
  const el = seccion(null, null, h('p', { class: 'nota' }, 'Toca una forma para activarla o apagarla. Las apagadas no salen al cobrar.'), rejilla);
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
    boton.disabled = true;
    const barra = h('div', { class: 'guardar-ajustes' }, boton);
    // Aviso flotante y discreto mientras haya cambios sin guardar y el botón de abajo no se vea.
    const aviso = h('div', { class: 'aviso-guardar', role: 'status', 'aria-live': 'polite', hidden: true },
      h('span', {}, 'Cambios sin guardar'),
      h('button', { type: 'button', class: 'btn texto', id: 'aj-guardar-aviso', onclick: () => boton.click() }, 'Guardar'));
    let botonVisible = false;
    const pintarAviso = () => { aviso.hidden = boton.disabled || botonVisible; };
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { botonVisible = e.isIntersecting; pintarAviso(); }, { rootMargin: esTelefono() ? '0px 0px -84px 0px' : '0px' }).observe(boton); // en el teléfono la barra de abajo tapa 84 px
    const cambio = () => { boton.disabled = false; pintarAviso(); };
    const t = tasas(ctx), ve = venta(ctx), pa = pagos(ctx, cambio), re = recibo(ctx);
    const secciones = { tasas: t.el, venta: ve.el, pagos: pa.el, recibo: re.el };
    // Un solo botón para guardar; aparece cuando se cambia algo.
    for (const sec of [t.el, ve.el, re.el]) { sec.addEventListener('input', cambio); sec.addEventListener('change', cambio); sec.addEventListener('click', e => { if (e.target.closest('.segmentado button, button[aria-pressed], .modo-bs')) cambio(); }); }
    boton.addEventListener('click', e => unaVez(e.currentTarget, async () => {
      let listo = false;
      boton.replaceChildren(icono('check'), 'Guardando…');
      try {
      if (!(await t.guardar())) return;
      const partes = [await ve.guardar(), await pa.guardar(), await re.guardar()];
      if (partes.some(x => !x)) return;
      const r = await ctx.almacen.guardarAjustes('general', Object.assign({}, ...partes));
      if (!r.ok) { toast('No se pudo guardar', { malo: true }); return; }
      listo = true; document.activeElement?.blur(); toast('Cambios guardados');
      setTimeout(() => { if (listo) { boton.disabled = true; pintarAviso(); } });
      } finally { boton.replaceChildren(icono('check'), 'Guardar cambios'); }
    })());
    const pest = h('div', { class: 'segmentado pestanas-aj', role: 'tablist' });
    const mostrar = id => {
      pestanaActual = id;
      pest.replaceChildren(...PESTANAS.map(([k, txt]) => h('button', { type: 'button', role: 'tab', id: 'aj-tab-' + k, 'aria-selected': String(k === id), 'aria-pressed': String(k === id), onclick: () => mostrar(k) }, txt)));
      for (const [k, el] of Object.entries(secciones)) el.hidden = k !== id;
      if (id === 'recibo') re.pintar();
    };
    mostrar(pestanaActual);
    cont.append(pest, h('div', { class: 'ajustes' }, ...Object.values(secciones)), barra, aviso);
  },
});
