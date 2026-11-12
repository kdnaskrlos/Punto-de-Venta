// Caja (§11): abrir con fondo, entradas y salidas, esperado por forma de pago, cierre con diferencias y reabrir (admin).
import { h, icono, abrirVentana, toast } from '../ui.js';
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

function abrirFormulario(ctx, cont) {
  const b = h('button', { class: 'btn primary grande', id: 'abrir-caja' }, icono('cartera'), 'Abrir caja');
  const form = h('div', { class: 'tarjeta abrir-caja pila' },
    h('h2', { class: 'sec-t' }, icono('cartera'), 'Abrir caja'),
    h('p', { class: 'nota' }, 'Cuenta el efectivo con el que empiezas en cada moneda.'),
    h('div', { class: 'fondos' }, campoMonto('fondo-cop', 'Pesos (COP)', 'COP'), campoMonto('fondo-usd', 'Dólares (USD)', 'USD'), campoMonto('fondo-bs', 'Bolívares (Bs)', 'BS')),
    b);
  b.addEventListener('click', async () => {
    const v = (id, m) => parseMonto(form.querySelector('#' + id).value, m) || 0;
    b.disabled = true;
    const r = await ctx.almacen.abrirCaja({ COP: v('fondo-cop', 'COP'), USD: v('fondo-usd', 'USD'), BS: v('fondo-bs', 'BS') });
    b.disabled = false;
    if (!r.ok) toast(r.error === 'ya-abierta' ? 'Ya tienes una caja abierta' : 'No se pudo abrir', { malo: true });
    else toast('Caja abierta');
  });
  cont.replaceChildren(form);
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
  b.addEventListener('click', async () => {
    const f = formas.find(x => x.id === forma.value);
    const n = parseMonto(monto.value, f.moneda);
    if (!n || n <= 0) { err.textContent = 'Escribe el monto'; return; }
    if (!motivo.value.trim()) { err.textContent = 'Escribe el motivo'; return; }
    const r = await ctx.almacen.movimientoCaja(caja.id, { tipo, forma: f.id, monto: n, motivo: motivo.value.trim() });
    if (!r.ok) { err.textContent = 'No se pudo guardar'; return; }
    v.cerrar(); toast(tipo === 'salida' ? 'Salida guardada' : 'Entrada guardada');
  });
}

function abrirCierre(ctx, caja, esperado) {
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
  const b = h('button', { class: 'btn primary', id: 'cierre-final' }, 'Cerrar caja');
  const v = abrirVentana({ titulo: 'Cerrar caja', pantallaCompleta: true,
    contenido: h('div', { class: 'pila' }, h('p', { class: 'nota' }, 'Cuenta lo que hay en cada forma de pago y escríbelo.'), filas, total, h('div', { class: 'campo' }, h('label', { for: 'cierre-nota' }, 'Nota'), nota, err)),
    acciones: h('div', { class: 'acciones' }, b) });
  b.addEventListener('click', async () => {
    const hayDif = calc.filas.some(f => f.nivel !== 'ok');
    if (hayDif && !nota.value.trim()) { err.textContent = 'Escribe una nota sobre la diferencia'; nota.focus(); return; }
    b.disabled = true;
    const r = await ctx.almacen.cerrarCaja(caja.id, { contado: Object.fromEntries(calc.filas.map(f => [f.forma, f.contado])), filas: calc.filas, totalEsperadoCop: calc.totalEsperadoCop, totalContadoCop: calc.totalContadoCop, totalCop: calc.totalCop, nota: nota.value.trim(), tasas: { copPorUsd: ctx.tasas.copPorUsd, bsPorUsd: ctx.tasas.bsPorUsd } });
    b.disabled = false;
    if (!r.ok) { err.textContent = 'No se pudo cerrar'; return; }
    v.cerrar(); toast('Caja cerrada');
  });
}

function vistaAbierta(ctx, cont, caja, ventas, apartados) {
  const formas = formasCaja(ctx);
  const abonos = apartados.flatMap(a => (a.abonos || []).filter(x => x.cajaId === caja.id));
  const esp = esperadoCaja(caja, ventas.filter(v => v.cajaId === caja.id), abonos, formas);
  const usadas = formas.filter(f => f.efectivo || Math.abs(esp[f.id] || 0) > 0);
  cont.replaceChildren(
    h('div', { class: 'cab-vista' }, h('h1', { class: 'sec-t' }, icono('cartera'), 'Mi caja'), h('span', { class: 'est g' }, 'Abierta')),
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
      h('button', { class: 'btn primary', onclick: () => abrirCierre(ctx, caja, esp) }, icono('check'), 'Cerrar caja')));
}

function historial(ctx, cajas) {
  const cerradas = cajas.filter(c => c.estado === 'cerrada').sort((a, b) => b.abierta.localeCompare(a.abierta)).slice(0, 15);
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
      if (mia) vistaAbierta(ctx, principal, cajas.find(c => c.id === mia.id) || mia, ventas, apartados);
      else {
        abrirFormulario(ctx, principal);
        if (cajas.some(c => c.usuario === ctx.sesion.usuario && c.estado === 'cerrada')) principal.prepend(h('div', { class: 'aviso ok-aviso' }, icono('check'), 'Caja cerrada'));
      }
      abajo.replaceChildren(historial(ctx, cajas) || '');
    };
    const desde = new Date(Date.now() - 3 * 864e5).toISOString();
    const q = [
      ctx.almacen.escuchar('ventas', l => { ventas = l; pintar(); }, { desde }),
      ctx.almacen.escuchar('apartados', l => { apartados = l; pintar(); }),
      ctx.almacen.escuchar('cajas', l => { cajas = l; pintar(); }),
    ];
    const alDatos = e => { if (['caja', 'ajustes', 'tasas'].includes(e.detail.que)) pintar(); };
    window.addEventListener('pos:datos', alDatos);
    cont.append(principal, abajo);
    pintar();
    return () => { q.forEach(x => x()); window.removeEventListener('pos:datos', alDatos); };
  },
});
