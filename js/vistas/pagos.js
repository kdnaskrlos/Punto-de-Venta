// Panel de pagos reutilizable (cobrar, apartar, abonar, completar): formas por moneda, montos, falta y vuelto (§9.2).
import { h, icono, esTelefono } from '../ui.js';
import { estadoCobro, montoSugerido, vueltoEn } from '../nucleo/cobro.js';
import { fmtCop, fmtMonto, parseMonto } from '../nucleo/dinero.js';
import { formaEfectivo, NOMBRE_MONEDA, iconoForma } from '../nucleo/formas.js';

// En los botones el grupo ya dice la moneda: "Efectivo pesos" → "Efectivo", "Transferencia / Nequi / …" → "Transferencia".
export const nombreCorto = n => (n.split('/')[0].replace(/\(.*?\)/g, '').replace(/\b(pesos|d[oó]lares|bol[ií]vares)\b/gi, '').replace(/\s+/g, ' ').trim()) || n;

const GRUPOS = [['COP', 'Pesos', 'c-cop'], ['USD', 'Dólares', 'c-usd'], ['BS', 'Bs', 'c-bs']];

// total: monto a cubrir en COP. permitirMenos: en abonos de apartado se puede pagar menos que el total.
export function crearPanelPagos(ctx, { total, permitirMenos = false, alCambiar = () => {} }) {
  const formas = (ctx.ajustes.formasPago || []).filter(f => f.activa !== false);
  const pagos = [];
  const lista = h('div', { class: 'pagos' });
  let botones = null;
  let monedaVuelto = 'COP';
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

  // Las formas son tarjetas (como en Ajustes → Pagos) en dos columnas: tocar una la elige (o la quita).
  // Los pagos elegidos se van sumando debajo del total, cada uno con su monto.
  function pintar(enfocar) {
    lista.replaceChildren(...pagos.map(p => {
      const f = p.forma;
      const inp = h('input', { class: 'inp num', inputmode: 'decimal', value: p.monto ? fmtMonto(p.monto, f.moneda) : '', 'aria-label': `Monto en ${f.nombre}` });
      // v1.94: la letra del monto baja de tamaño a medida que crece, para que siempre quepa en el campo.
      const tam = () => { const n = inp.value.length; inp.dataset.largo = n >= 11 ? 'xl' : n >= 8 ? 'l' : ''; };
      inp.addEventListener('input', () => { p.monto = parseMonto(inp.value, f.moneda) || 0; tam(); pintarBarra(); avisar(); });
      inp.addEventListener('blur', () => { inp.value = p.monto ? fmtMonto(p.monto, f.moneda) : ''; tam(); });
      tam();
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); });
      const eq = h('span', { class: 'nota num equiv' });
      p.pintarEq = () => { const e = estado().pagos.find(x => x.forma === f.id); eq.textContent = f.moneda === 'COP' ? '' : (e?.equivalenteCop == null ? 'Sin tasa' : e.equivalenteCop > 0 ? `≈ ${fmtCop(e.equivalenteCop)} COP` : ''); };
      p.pintarEq();
      if (enfocar === f.id && !esTelefono()) setTimeout(() => { inp.focus(); inp.select(); }, 20);
      // Tarjeta de pago (v1.94): ícono; nombre con la moneda debajo (COP, USD, Bs);
      // el monto en su recuadro; un bote de basura al lado para quitarla.
      return h('div', { class: `pago m-${f.moneda.toLowerCase()}`, 'data-forma': f.id },
        h('span', { class: 'forma-ic' }, icono(iconoForma(f))),
        h('span', { class: 'pago-nombre' }, h('b', {}, nombreCorto(f.nombre)), h('span', { class: 'pago-moneda' }, NOMBRE_MONEDA[f.moneda])), // v1.94: sin el equivalente en pesos
        h('label', { class: 'pago-monto' }, inp),
        h('button', { type: 'button', class: 'pago-quitar', 'aria-label': `Quitar ${f.nombre}`, onclick: () => quitarPago(p) }, icono('borrar')));
    }));
    // El pago recién elegido entra abriéndose (como los desplegables de Pedidos).
    const nueva = enfocar && lista.querySelector(`.pago[data-forma="${enfocar}"]`);
    if (nueva && nueva.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const alto = nueva.offsetHeight;
      const cs = getComputedStyle(nueva);
      nueva.style.overflow = 'hidden';
      nueva.animate([
        { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', opacity: 0, transform: 'translateY(-4px)' },
        { height: alto + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, opacity: 1, transform: 'none' }],
        { duration: 210, easing: 'cubic-bezier(.4,0,.2,1)' })
        .onfinish = () => { nueva.style.overflow = ''; };
    }
    botones.replaceChildren(...formas.map(f => {
      const elegida = pagos.some(x => x.forma.id === f.id);
      const bloqueada = (f.moneda === 'BS' && !ctx.tasas.bsPorUsd) || (f.moneda !== 'COP' && !ctx.tasas.copPorUsd);
      return h('button', { type: 'button', class: `forma forma-tarjeta forma-cobro m-${f.moneda.toLowerCase()}` + (elegida ? ' activa' : ''), 'data-forma': f.id, 'data-forma-card': f.id, disabled: bloqueada, 'aria-pressed': String(elegida),
        onclick: () => { if (elegida) quitarPago(pagos.find(x => x.forma.id === f.id)); else agregar(f); } },
        h('span', { class: 'forma-ic' }, icono(iconoForma(f))),
        h('span', { class: 'forma-txt' }, h('b', {}, nombreCorto(f.nombre)),
          h('span', { class: 'forma-pie' }, h('span', { class: 'moneda' }, NOMBRE_MONEDA[f.moneda]), bloqueada ? (f.moneda === 'BS' ? ' · Sin tasa de Bs' : ' · Sin tasa') : f.efectivo && !/efectivo/i.test(nombreCorto(f.nombre)) ? ' · efectivo' : '')));
    }));
    pintarBarra();
    avisar();
  }

  // Quitar un pago: la tarjeta se cierra (alto y opacidad) y luego se recalcula.
  function quitarPago(p) {
    const fila = lista.querySelector(`.pago[data-forma="${p.forma.id}"]`);
    const fin = () => { const i = pagos.indexOf(p); if (i >= 0) pagos.splice(i, 1); pintar(); avisar(); };
    if (!fila || !fila.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { fin(); return; }
    // Un solo movimiento continuo: la tarjeta se encoge y se desvanece a la vez (300 ms), y la forma de pago
    // de abajo se desmarca al instante, para que lo que se ve coincida con lo que se tocó.
    const tarjeta = botones.querySelector(`[data-forma-card="${p.forma.id}"]`);
    tarjeta?.classList.remove('activa'); tarjeta?.setAttribute('aria-pressed', 'false');
    const cs = getComputedStyle(fila);
    fila.style.pointerEvents = 'none'; fila.style.overflow = 'hidden';
    fila.querySelector('.pago-quitar')?.remove();
    fila.animate([
      { height: fila.offsetHeight + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, opacity: 1, transform: 'none' },
      { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', opacity: 0, transform: 'scale(.98)' }],
      { duration: 210, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = fin;
  }

  function pintarBarra() {
    const e = estado();
    pagos.forEach(p => p.pintarEq && p.pintarEq());
    if (e.vueltoCop >= red / 2 && !permitirMenos) {
      const v = vueltoEn(e.vueltoCop, monedaVuelto, ctx.tasas, red);
      barra.className = 'barra-falta vuelto';
      barra.replaceChildren(h('span', {}, 'Vuelto'), ' ', h('span', { class: 'monto num' }, v == null ? 'Sin tasa' : `${fmtMonto(v, monedaVuelto)} ${NOMBRE_MONEDA[monedaVuelto]}`),
        h('div', { class: 'vuelto-moneda segmentado' }, ...GRUPOS.filter(([m]) => formaEfectivo(formas, m)).map(([m]) => h('button', { type: 'button', 'data-moneda': m, 'aria-pressed': String(m === monedaVuelto), disabled: vueltoEn(e.vueltoCop, m, ctx.tasas, red) == null, onclick: () => { monedaVuelto = m; pintarBarra(); avisar(); } }, NOMBRE_MONEDA[m]))));
    } else if (e.cuadra || (permitirMenos && e.faltaCop < total)) {
      barra.className = 'barra-falta ok';
      barra.replaceChildren(h('span', {}, permitirMenos && !e.cuadra ? 'Saldo' : 'Falta'), ' ', h('span', { class: 'monto num' }, fmtCop(e.cuadra ? 0 : e.faltaCop)));
    } else {
      barra.className = 'barra-falta falta';
      barra.replaceChildren(h('span', {}, 'Falta'), ' ', h('span', { class: 'monto num' }, fmtCop(e.faltaCop)));
    }
  }

  botones = h('div', { class: 'formas-cobro' });
  const el = h('div', { class: 'panel-pagos' }, lista, h('div', { class: 'sec-m' }, 'Forma de pago'), botones);
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
