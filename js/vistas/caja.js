// Caja (§11): abrir con fondo, entradas y salidas, esperado por forma de pago, cierre con diferencias y reabrir (admin).
import { h, icono, abrirVentana, toast, unaVez, esTelefono } from '../ui.js';
import { registrarVista } from '../app.js';
import { esperadoCaja, diferenciasCierre } from '../nucleo/caja.js';
import { fmtCop, fmtMonto, parseMonto } from '../nucleo/dinero.js';
import { NOMBRE_MONEDA } from '../nucleo/formas.js';
import { fechaHora } from '../nucleo/fechas.js';

const CLASE = { COP: 'c-cop', USD: 'c-usd', BS: 'c-bs' };
const NIVEL = { ok: 'g', leve: 'y', grave: 'r' };

function campoMonto(id, etiqueta, moneda) {
  const inp = h('input', { class: 'inp num', id, inputmode: 'decimal', autocomplete: 'off' });
  inp.addEventListener('blur', () => { const n = parseMonto(inp.value, moneda); if (n != null) inp.value = fmtMonto(n, moneda); });
  return h('div', { class: 'campo' }, h('label', { for: id, class: CLASE[moneda] }, etiqueta), inp);
}

function formasCaja(ctx) { return ctx.ajustes.formasPago || []; }

// Campos del fondo inicial. Los que quedan vacíos cuentan como 0.
// Solo las monedas que tienen efectivo en las formas de pago (ya no hay efectivo en Bs).
function camposFondo(ctx) {
  const hay = m => !ctx || (ctx.ajustes.formasPago || []).some(f => f.efectivo && f.moneda === m && f.activa !== false);
  const fondos = h('div', { class: 'fondos' }, campoMonto('fondo-cop', 'Pesos (COP)', 'COP'), campoMonto('fondo-usd', 'Dólares (USD)', 'USD'), hay('BS') ? campoMonto('fondo-bs', 'Bs', 'BS') : null);
  fondos.querySelectorAll('input').forEach(i => { i.placeholder = '0'; });
  return fondos;
}

async function confirmarApertura(ctx, raiz, boton) {
  const v = (id, m) => parseMonto(raiz.querySelector('#' + id)?.value, m) || 0;
  boton.disabled = true;
  const r = await ctx.almacen.abrirCaja({ COP: v('fondo-cop', 'COP'), USD: v('fondo-usd', 'USD'), BS: v('fondo-bs', 'BS') });
  boton.disabled = false;
  if (!r.ok) { toast(r.error === 'ya-abierta' ? 'Ya tienes una caja abierta' : 'No se pudo abrir', { malo: true }); return false; }
  document.activeElement?.blur();
  toast('Caja abierta');
  return true;
}

function abrirFormulario(ctx, cont) {
  const b = h('button', { class: 'btn primary grande', id: 'abrir-caja' }, icono('cartera'), 'Abrir caja');
  const form = h('div', { class: 'tarjeta abrir-caja pila' },
    h('h2', { class: 'sec-t' }, icono('cartera'), 'Abrir caja'),
    h('p', { class: 'nota' }, 'Cuenta el efectivo con el que empiezas. Deja en blanco lo que no tengas.'),
    camposFondo(ctx), b);
  b.addEventListener('click', () => confirmarApertura(ctx, form, b));
  cont.replaceChildren(form);
}

// Una lectura única de una colección (para calcular el esperado de una caja ya cerrada).
function leerUnaVez(ctx, coleccion, filtro) {
  return new Promise(res => {
    let listo = false, q = null;
    q = ctx.almacen.escuchar(coleccion, l => { if (listo) return; listo = true; res(l); setTimeout(() => q && q()); }, filtro);
    if (listo) setTimeout(() => q && q());
  });
}

async function esperadoDe(ctx, caja) {
  const [ventas, apartados] = await Promise.all([leerUnaVez(ctx, 'ventas', { cajaId: caja.id }), leerUnaVez(ctx, 'apartados')]);
  const abonos = apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === caja.id));
  return esperadoCaja(caja, ventas, abonos, formasCaja(ctx));
}

// Abrir la caja sin salir de la pantalla en la que se está (Vender, Inicio).
// Si la caja de ayer se cerró sola a medianoche, el conteo de hoy la arquea y sirve de fondo.
export function abrirCajaVentana(ctx, alAbrir) {
  const pendiente = (ctx.porArquear || []).find(c => c.usuario === ctx.sesion.usuario);
  if (pendiente) { arquearYAbrir(ctx, pendiente, alAbrir); return; }
  const b = h('button', { class: 'btn primary grande', id: 'abrir-caja' }, icono('cartera'), 'Abrir caja');
  const cuerpo = h('div', { class: 'pila' }, h('p', { class: 'nota' }, 'Cuenta el efectivo con el que empiezas. Deja en blanco lo que no tengas.'), camposFondo(ctx));
  const v = abrirVentana({ titulo: 'Abrir caja', contenido: cuerpo, acciones: b });
  b.addEventListener('click', async () => { if (await confirmarApertura(ctx, cuerpo, b)) { v.cerrar(); alAbrir && alAbrir(); } });
}

// Para quien vende sin caja: los dueños usan su caja personal (se crea sola); la vendedora debe abrir la suya.
export async function asegurarCaja(ctx) {
  if (ctx.miCaja) return true;
  if (ctx.puedeVer('cajaPersonal')) {
    const r = await ctx.almacen.abrirCaja({}, { tipo: 'personal' });
    return r.ok || r.error === 'ya-abierta';
  }
  abrirCajaVentana(ctx);
  return false;
}

// Ejecuta una operación que necesita caja; si falta y es de un dueño, crea su caja personal y reintenta.
export async function conCaja(ctx, operacion) {
  let r = await operacion();
  if (!r.ok && r.error === 'sin-caja' && await asegurarCaja(ctx)) r = await operacion();
  return r;
}

async function arquearYAbrir(ctx, caja, alAbrir) {
  const esperado = await esperadoDe(ctx, caja);
  const dia = new Date(caja.cierre?.fecha || caja.abierta).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'short' });
  ventanaConteo(ctx, esperado, {
    titulo: 'Abrir caja', boton: 'Abrir caja', botonId: 'arqueo-final', notaObligatoria: false,
    intro: h('div', { class: 'aviso' }, icono('alerta'), h('div', {}, h('b', {}, `Tu caja del ${dia} se cerró sola a medianoche.`),
      h('div', { class: 'nota' }, 'Cuenta lo que hay ahora. Con ese conteo se cierra la de ayer y empieza la de hoy.'))),
    async alConfirmar(datos) {
      const r = await ctx.almacen.arquearCaja(caja.id, datos);
      if (!r.ok && r.error !== 'arqueada') return 'No se pudo guardar el conteo';
      const c = datos.contado;
      const a = await ctx.almacen.abrirCaja({ COP: c['efectivo-cop'] || 0, USD: c['efectivo-usd'] || 0, BS: c['efectivo-bs'] || 0 });
      if (!a.ok && a.error !== 'ya-abierta') return 'No se pudo abrir la caja';
      ctx.porArquear = (ctx.porArquear || []).filter(x => x.id !== caja.id);
      toast('Caja abierta'); alAbrir && alAbrir();
      return null;
    },
  });
}

function abrirMovimiento(ctx, caja) {
  let tipo = 'salida';
  const formas = formasCaja(ctx);
  const seg = h('div', { class: 'segmentado' }, ...[['entrada', 'Entrada'], ['salida', 'Salida']].map(([t, txt]) =>
    h('button', { type: 'button', id: 'mov-tipo-' + t, 'aria-pressed': String(t === tipo), onclick: e => { tipo = t; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === e.currentTarget))); } }, txt)));
  const forma = h('select', { class: 'inp', id: 'mov-forma' }, ...formas.map(f => h('option', { value: f.id }, `${f.nombre} (${NOMBRE_MONEDA[f.moneda]})`)));
  const monto = h('input', { class: 'inp num', id: 'mov-monto', inputmode: 'decimal' });
  const motivo = h('input', { class: 'inp', id: 'mov-motivo', placeholder: 'Pago de luz, retiro, cambio…' });
  const err = h('span', { class: 'error' });
  const b = h('button', { class: 'btn primary', id: 'mov-final' }, 'Guardar');
  const v = abrirVentana({ titulo: 'Entrada o salida de dinero', contenido: h('div', { class: 'pila' }, seg,
    h('div', { class: 'campo' }, h('label', { for: 'mov-forma' }, 'Forma de pago'), forma),
    h('div', { class: 'campo' }, h('label', { for: 'mov-monto' }, 'Monto'), monto),
    h('div', { class: 'campo' }, h('label', { for: 'mov-motivo' }, 'Motivo'), motivo, err)), acciones: h('div', { class: 'acciones' }, b) });
  b.addEventListener('click', unaVez(b, async () => {
    const f = formas.find(x => x.id === forma.value);
    const n = parseMonto(monto.value, f.moneda);
    if (!n || n <= 0) { err.textContent = 'Escribe el monto'; return; }
    if (!motivo.value.trim()) { err.textContent = 'Escribe el motivo'; return; }
    const r = await ctx.almacen.movimientoCaja(caja.id, { tipo, forma: f.id, monto: n, motivo: motivo.value.trim() });
    if (!r.ok) { err.textContent = 'No se pudo guardar'; return; }
    v.cerrar(); toast(tipo === 'salida' ? 'Salida guardada' : 'Entrada guardada');
  }));
}

function ventanaConteo(ctx, esperado, op) {
  const formas = formasCaja(ctx).filter(f => f.efectivo || Math.abs(esperado[f.id] || 0) > 0);
  const contado = {};
  const filas = h('div', { class: 'filas-cierre' });
  const total = h('div', { class: 'total-cierre num' });
  const nota = h('input', { class: 'inp', id: 'cierre-nota', placeholder: 'Qué pasó con la diferencia' });
  const err = h('span', { class: 'error' });
  let calc = diferenciasCierre(esperado, {}, formas, ctx.tasas);
  const pintar = () => {
    const cont = Object.fromEntries(formas.map(f => [f.id, contado[f.id] ?? 0]));
    const esp = Object.fromEntries(formas.map(f => [f.id, esperado[f.id] || 0]));
    calc = diferenciasCierre(esp, cont, formas, ctx.tasas);
    for (const fila of calc.filas) {
      const el = filas.querySelector(`.fila-cierre[data-forma="${fila.forma}"]`);
      el.className = `fila-cierre ${fila.nivel}`;
      el.querySelector('.dif').textContent = fila.diferencia ? `${fila.diferencia > 0 ? '+' : ''}${fmtMonto(fila.diferencia, fila.moneda)}` : '0';
    }
    total.textContent = `Diferencia total: ${calc.totalCop > 0 ? '+' : ''}${fmtCop(calc.totalCop)} COP${calc.totalIncompleto ? ' (sin tasa en alguna moneda)' : ''}`;
  };
  filas.replaceChildren(h('div', { class: 'fila-cierre cab' }, h('span', {}, 'Forma'), h('span', {}, 'Esperado'), h('span', {}, 'Contado'), h('span', {}, 'Diferencia')),
    ...formas.map(f => {
      const inp = h('input', { class: 'inp num', id: 'contado-' + f.id, inputmode: 'decimal', 'aria-label': `Contado en ${f.nombre}` });
      inp.addEventListener('input', () => { contado[f.id] = parseMonto(inp.value, f.moneda) ?? 0; err.textContent = ''; pintar(); });
      return h('div', { class: 'fila-cierre', 'data-forma': f.id },
        h('span', { class: CLASE[f.moneda] }, f.nombre),
        h('span', { class: 'num' }, `${fmtMonto(esperado[f.id] || 0, f.moneda)} ${NOMBRE_MONEDA[f.moneda]}`),
        inp, h('b', { class: 'dif num' }, ''));
    }));
  pintar();
  const b = h('button', { class: 'btn primary', id: op.botonId }, op.boton);
  const v = abrirVentana({ titulo: op.titulo, pantallaCompleta: true,
    contenido: h('div', { class: 'pila' }, op.intro || h('p', { class: 'nota' }, 'Cuenta lo que hay en cada forma de pago y escríbelo.'), filas, total, h('div', { class: 'campo' }, h('label', { for: 'cierre-nota' }, 'Nota'), nota, err)),
    acciones: h('div', { class: 'acciones' }, b) });
  b.addEventListener('click', async () => {
    const hayDif = calc.filas.some(f => f.nivel !== 'ok');
    if (op.notaObligatoria && hayDif && !nota.value.trim()) { err.textContent = 'Escribe una nota sobre la diferencia'; if (!esTelefono()) nota.focus(); return; }
    b.disabled = true;
    const datos = { contado: Object.fromEntries(calc.filas.map(f => [f.forma, f.contado])), filas: calc.filas, totalEsperadoCop: calc.totalEsperadoCop, totalContadoCop: calc.totalContadoCop, totalCop: calc.totalCop, nota: nota.value.trim() };
    const fallo = await op.alConfirmar(datos);
    b.disabled = false;
    if (fallo) { err.textContent = fallo; return; }
    v.cerrar();
  });
}

function abrirCierre(ctx, caja, esperado) {
  ventanaConteo(ctx, esperado, { titulo: 'Cerrar caja', boton: 'Cerrar caja', botonId: 'cierre-final', notaObligatoria: true,
    async alConfirmar(datos) {
      const r = await ctx.almacen.cerrarCaja(caja.id, datos);
      if (!r.ok) return 'No se pudo cerrar';
      toast('Caja cerrada'); return null;
    } });
}

function vistaAbierta(ctx, cont, caja, ventas, apartados) {
  const formas = formasCaja(ctx);
  const abonos = apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === caja.id));
  const esp = esperadoCaja(caja, ventas.filter(v => v.cajaId === caja.id), abonos, formas);
  const usadas = formas.filter(f => f.efectivo || Math.abs(esp[f.id] || 0) > 0);
  cont.replaceChildren(
    h('div', { class: 'cab-vista' }, h('span', { class: 'est g' }, 'Caja abierta')),
    h('p', { class: 'nota' }, `Abierta desde ${fechaHora(caja.abierta)} · ${ventas.filter(v => v.cajaId === caja.id && v.estado !== 'anulada').length} ventas`),
    h('div', { class: 'tarjeta' }, h('h2', { class: 'sec-t' }, icono('monedas'), 'Debería haber'),
      h('div', { class: 'esperados' }, ...usadas.map(f => h('div', { class: 'esperado', 'data-forma': f.id }, h('span', { class: CLASE[f.moneda] }, f.nombre), h('b', { class: 'monto num' }, `${fmtMonto(esp[f.id] || 0, f.moneda)} ${NOMBRE_MONEDA[f.moneda]}`))))),
    h('div', { class: 'tarjeta movimientos' }, h('h2', { class: 'sec-t' }, icono('historial'), 'Entradas y salidas'),
      (caja.movimientos || []).length ? h('div', { class: 'lista-mov' }, ...caja.movimientos.slice().reverse().map(m => {
        const f = formas.find(x => x.id === m.forma);
        return h('div', { class: 'mov' }, h('span', {}, m.motivo, h('span', { class: 'nota' }, ` · ${f?.nombre || m.forma}`)), h('b', { class: 'num ' + (m.tipo === 'salida' ? 'neg' : 'pos') }, `${m.tipo === 'salida' ? '-' : '+'}${fmtMonto(m.monto, f?.moneda || 'COP')}`));
      })) : h('p', { class: 'nota' }, 'Sin movimientos.')),
    h('div', { class: 'acciones' },
      h('button', { class: 'btn', onclick: () => abrirMovimiento(ctx, caja) }, icono('monedas'), 'Entrada o salida'),
      h('button', { class: 'btn', onclick: () => abrirCierre(ctx, caja, esp) }, icono('check'), 'Cerrar caja')));
}

// Dueños (admin, encargada): no abren ni arquean. Solo ven lo que cobraron hoy y las cajas de la tienda.
function vistaDueno(ctx, cont, mia, ventas, apartados, cajas) {
  const formas = formasCaja(ctx);
  const abonos = mia ? apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === mia.id)) : [];
  const esp = mia ? esperadoCaja(mia, ventas.filter(v => v.cajaId === mia.id), abonos, formas) : {};
  const usadas = formas.filter(f => Math.abs(esp[f.id] || 0) > 0);
  const tienda = cajas.filter(c => c.tipo !== 'personal' && (c.estado === 'abierta' || c.cierre?.porArquear));
  cont.replaceChildren(
    h('div', { class: 'tarjeta' }, h('h2', { class: 'sec-t' }, icono('monedas'), 'Cobrado por mí hoy'),
      usadas.length ? h('div', { class: 'esperados' }, ...usadas.map(f => h('div', { class: 'esperado', 'data-forma': f.id }, h('span', { class: CLASE[f.moneda] }, f.nombre), h('b', { class: 'monto num' }, `${fmtMonto(esp[f.id] || 0, f.moneda)} ${NOMBRE_MONEDA[f.moneda]}`))))
        : h('p', { class: 'nota' }, 'Aún no has cobrado nada hoy.'),
      h('p', { class: 'nota' }, 'Solo informativo: no tienes que abrir ni cerrar caja.')),
    h('div', { class: 'tarjeta' }, h('h2', { class: 'sec-t' }, icono('cartera'), 'Cajas de la tienda'),
      tienda.length ? h('div', { class: 'lista-mov' }, ...tienda.map(c => h('div', { class: 'mov' },
        h('span', {}, h('b', {}, `@${c.usuario}`), h('span', { class: 'nota' }, ` · desde ${fechaHora(c.abierta)}`)),
        c.estado === 'abierta' ? h('span', { class: 'est g' }, 'Abierta') : h('span', { class: 'est y' }, 'Por arquear'))))
        : h('p', { class: 'nota' }, 'No hay cajas abiertas.')));
}

function historial(ctx, cajas) {
  const cerradas = cajas.filter(c => c.estado === 'cerrada' && c.tipo !== 'personal' && !c.cierre?.porArquear).sort((a, b) => b.abierta.localeCompare(a.abierta)).slice(0, 15);
  if (!cerradas.length) return null;
  return h('div', { class: 'tarjeta' }, h('h2', { class: 'sec-t' }, icono('historial'), 'Cajas cerradas'),
    ...cerradas.map(c => {
      const peor = (c.cierre?.filas || []).reduce((m, f) => (f.nivel === 'grave' ? 'grave' : m === 'grave' ? m : f.nivel === 'leve' ? 'leve' : m), 'ok');
      return h('div', { class: 'caja-cerrada' },
        h('div', {}, h('b', {}, `@${c.usuario}`), h('div', { class: 'nota' }, `${fechaHora(c.abierta)}${c.cierre?.nota ? ' · ' + c.cierre.nota : ''}`)),
        h('span', { class: `est ${NIVEL[peor]}` }, c.cierre?.totalCop ? `${c.cierre.totalCop > 0 ? '+' : ''}${fmtCop(c.cierre.totalCop)}` : 'Cuadró'),
        ctx.puedeVer('reabrirCaja') ? h('button', { class: 'btn', onclick: async () => { const r = await ctx.almacen.reabrirCaja(c.id); toast(r.ok ? 'Caja reabierta' : r.error === 'ya-abierta' ? 'Esa persona ya tiene otra caja abierta' : 'No se pudo reabrir', { malo: !r.ok }); } }, 'Reabrir') : null);
    }));
}

registrarVista('/caja', {
  montar(cont, ctx) {
    let ventas = [], apartados = [], cajas = [];
    const principal = h('div', { class: 'pila' });
    const abajo = h('div');
    const pintar = () => {
      const mia = ctx.miCaja;
      if (ctx.puedeVer('cajaPersonal')) vistaDueno(ctx, principal, mia && (cajas.find(c => c.id === mia.id) || mia), ventas, apartados, cajas);
      else if (mia) vistaAbierta(ctx, principal, cajas.find(c => c.id === mia.id) || mia, ventas, apartados);
      else if ((ctx.porArquear || []).some(c => c.usuario === ctx.sesion.usuario)) {
        principal.replaceChildren(h('div', { class: 'aviso' }, icono('alerta'), h('div', {}, h('b', {}, 'Tu caja de ayer se cerró sola a medianoche.'), h('div', { class: 'nota' }, 'Cuenta el dinero una vez: cierra la de ayer y abre la de hoy.'))),
          h('button', { class: 'btn primary grande', onclick: () => abrirCajaVentana(ctx) }, icono('cartera'), 'Contar y abrir caja'));
      } else {
        abrirFormulario(ctx, principal);
        if (cajas.some(c => c.usuario === ctx.sesion.usuario && c.estado === 'cerrada')) principal.prepend(h('div', { class: 'aviso ok-aviso' }, icono('check'), 'Caja cerrada'));
      }
      abajo.replaceChildren(historial(ctx, cajas) || '');
    };
    // Ventas de MI caja abierta, por cajaId (aunque lleve varios días abierta).
    let cajaVentas = null, quitarVentas = null;
    const seguirCaja = () => {
      const id = ctx.miCaja?.id || null;
      if (id === cajaVentas) return;
      cajaVentas = id; quitarVentas && quitarVentas(); ventas = [];
      quitarVentas = id ? ctx.almacen.escuchar('ventas', l => { ventas = l; pintar(); }, { cajaId: id }) : null;
    };
    seguirCaja();
    const q = [
      ctx.almacen.escuchar('apartados', l => { apartados = l; pintar(); }),
      ctx.almacen.escuchar('cajas', l => { cajas = l; pintar(); }),
    ];
    const alDatos = e => { if (e.detail.que === 'caja') seguirCaja(); if (['caja', 'ajustes', 'tasas'].includes(e.detail.que)) pintar(); };
    window.addEventListener('pos:datos', alDatos);
    cont.append(principal, abajo);
    pintar();
    return () => { q.forEach(x => x()); quitarVentas && quitarVentas(); window.removeEventListener('pos:datos', alDatos); };
  },
});
