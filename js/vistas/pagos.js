// Panel de pagos reutilizable (cobrar, apartar, abonar, completar): formas por moneda, montos, falta y vuelto (§9.2).
import { h, icono, esTelefono } from '../ui.js';
import { estadoCobro, montoSugerido, vueltoEn } from '../nucleo/cobro.js';
import { fmtCop, fmtMonto, parseMonto } from '../nucleo/dinero.js';
import { formaEfectivo, NOMBRE_MONEDA } from '../nucleo/formas.js';

// En los botones el grupo ya dice la moneda: "Efectivo pesos" → "Efectivo", "Transferencia / Nequi / …" → "Transferencia".
export const nombreCorto = n => (n.split('/')[0].replace(/\(.*?\)/g, '').replace(/\b(pesos|d[oó]lares|bol[ií]vares)\b/gi, '').replace(/\s+/g, ' ').trim()) || n;

const GRUPOS = [['COP', 'Pesos', 'c-cop'], ['USD', 'Dólares', 'c-usd'], ['BS', 'Bs', 'c-bs']];

// total: monto a cubrir en COP. permitirMenos: en abonos de apartado se puede pagar menos que el total.
export function crearPanelPagos(ctx, { total, permitirMenos = false, alCambiar = () => {} }) {
  const formas = (ctx.ajustes.formasPago || []).filter(f => f.activa !== false);
  const pagos = [];
  let botones = null;
  let monedaVuelto = 'COP';
  const lista = h('div', { class: 'pagos' });
  const barra = h('div', { class: 'barra-falta', role: 'status' });
  const red = ctx.ajustes.redondeo || 100;
  let listo = false; // no avisar cambios mientras se construye el panel
  const avisar = () => { if (listo) alCambiar(); };

  const estado = () => estadoCobro({ total, pagos: pagos.map(p => ({ forma: p.forma.id, moneda: p.forma.moneda, monto: p.monto || 0 })), tasas: ctx.tasas, redondeo: red });

  function agregar(forma) {
    if (esTelefono()) document.activeElement?.blur(); // sin borde de foco que parezca una selección
    const e = estado();
    let p = pagos.find(x => x.forma.id === forma.id);
    if (!p) { p = { forma, monto: 0 }; pagos.push(p); }
    if (e.faltaCop > 0) p.monto = (p.monto || 0) + (montoSugerido(e.faltaCop, forma.moneda, ctx.tasas) || 0);
    pintar(forma.id);
  }

  function pintar(enfocar) {
    lista.replaceChildren(...pagos.map(p => {
      const inp = h('input', { class: 'inp num', inputmode: 'decimal', value: p.monto ? fmtMonto(p.monto, p.forma.moneda) : '', 'aria-label': `Monto en ${p.forma.nombre}` });
      inp.addEventListener('input', () => { p.monto = parseMonto(inp.value, p.forma.moneda) || 0; pintarBarra(); avisar(); });
      inp.addEventListener('blur', () => { inp.value = p.monto ? fmtMonto(p.monto, p.forma.moneda) : ''; });
      inp.addEventListener('focus', () => inp.select());
      const eq = h('span', { class: 'nota num equiv' });
      p.pintarEq = () => { const e = estado().pagos.find(x => x.forma === p.forma.id); eq.textContent = p.forma.moneda === 'COP' ? '' : (e?.equivalenteCop != null ? `= ${fmtCop(e.equivalenteCop)} COP` : 'Sin tasa'); };
      p.pintarEq();
      const fila = h('div', { class: 'pago', 'data-forma': p.forma.id },
        h('div', { class: 'pago-nombre' }, h('b', {}, p.forma.nombre), eq),
        h('div', { class: 'pago-monto' }, inp, h('span', { class: `moneda ${GRUPOS.find(g => g[0] === p.forma.moneda)[2]}` }, NOMBRE_MONEDA[p.forma.moneda])),
        h('button', { class: 'ibtn', 'aria-label': `Quitar ${p.forma.nombre}`, onclick: () => { pagos.splice(pagos.indexOf(p), 1); pintar(); avisar(); } }, icono('borrar')));
      if (enfocar === p.forma.id && !esTelefono()) setTimeout(() => { inp.focus(); inp.select(); }, 20);
      return fila;
    }));
    // ✓ en los botones de las formas que ya están en la lista
    botones?.querySelectorAll('.forma').forEach(b => b.classList.toggle('agregada', pagos.some(p => p.forma.id === b.dataset.forma)));
    pintarBarra();
    avisar();
  }

  function pintarBarra() {
    const e = estado();
    pagos.forEach(p => p.pintarEq && p.pintarEq());
    if (e.vueltoCop >= red / 2 && !permitirMenos) {
      const v = vueltoEn(e.vueltoCop, monedaVuelto, ctx.tasas, red);
      barra.className = 'barra-falta vuelto';
      barra.replaceChildren(h('span', {}, 'Vuelto'), ' ', h('span', { class: 'monto num' }, v == null ? 'Sin tasa' : `${fmtMonto(v, monedaVuelto)} ${NOMBRE_MONEDA[monedaVuelto]}`),
        h('div', { class: 'vuelto-moneda segmentado' }, ...GRUPOS.map(([m]) => h('button', { type: 'button', 'data-moneda': m, 'aria-pressed': String(m === monedaVuelto), disabled: vueltoEn(e.vueltoCop, m, ctx.tasas, red) == null, onclick: () => { monedaVuelto = m; pintarBarra(); avisar(); } }, NOMBRE_MONEDA[m]))));
    } else if (e.cuadra || (permitirMenos && e.faltaCop < total)) {
      barra.className = 'barra-falta ok';
      barra.replaceChildren(h('span', {}, permitirMenos && !e.cuadra ? 'Saldo' : 'Falta'), ' ', h('span', { class: 'monto num' }, fmtCop(e.cuadra ? 0 : e.faltaCop)));
    } else {
      barra.className = 'barra-falta falta';
      barra.replaceChildren(h('span', {}, 'Falta'), ' ', h('span', { class: 'monto num' }, fmtCop(e.faltaCop)));
    }
  }

  const sinBs = !ctx.tasas.bsPorUsd;
  botones = h('div', { class: 'formas' }, ...GRUPOS.map(([moneda, titulo, clase]) => {
    const fs = formas.filter(f => f.moneda === moneda);
    if (!fs.length) return null;
    const bloqueada = (moneda === 'BS' && sinBs) || (moneda !== 'COP' && !ctx.tasas.copPorUsd);
    return h('div', { class: 'grupo-formas' },
      h('div', { class: `sec-m ${clase}` }, titulo, bloqueada ? h('span', { class: 'nota' }, moneda === 'BS' ? ' · Sin tasa de Bs' : ' · Sin tasa') : null),
      h('div', { class: 'formas-rejilla' }, ...fs.map(f => h('button', { type: 'button', class: `forma ${clase}`, 'data-forma': f.id, title: f.nombre, disabled: bloqueada, onclick: () => agregar(f) }, h('span', {}, nombreCorto(f.nombre))))));
  }));

  // Los pagos agregados van arriba, a la vista; debajo, los botones para agregar otro.
  const el = h('div', { class: 'panel-pagos' }, lista, botones);
  pintar();
  listo = true;
  return {
    el,
    barra, // la ventana la coloca en el pie, siempre visible
    estado,
    // Pagos y vuelto listos para guardar en la venta o el apartado.
    resultado() {
      const e = estado();
      const pagosOk = e.pagos.filter(p => p.monto > 0).map(p => ({ forma: p.forma, nombre: formas.find(f => f.id === p.forma).nombre, moneda: p.moneda, monto: p.monto, equivalenteCop: p.equivalenteCop }));
      let vuelto = null;
      if (!permitirMenos && e.vueltoCop >= red / 2) {
        const monto = vueltoEn(e.vueltoCop, monedaVuelto, ctx.tasas, red);
        vuelto = { moneda: monedaVuelto, monto, forma: formaEfectivo(formas, monedaVuelto), equivalenteCop: e.vueltoCop };
      }
      return { pagos: pagosOk, vuelto, estado: e };
    },
  };
}
