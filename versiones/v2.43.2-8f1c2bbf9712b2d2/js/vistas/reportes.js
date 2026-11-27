import { nombreVenta, titulo } from '../nucleo/producto.js';
// Reportes (§15) y comisiones (§14).
import { h, icono, toast, sin, unaVez, abrirVentana, largo } from '../ui.js';
import { registrarVista } from '../app.js';
import { MODO_DEMO } from '../datos/index.js';
import { resumenDia, masVendidos, inventarioBajo, valorInventario, ventasPorPeriodo, cobrosEnPesos } from '../nucleo/reportes.js';
import { resumenComisiones, ganaComision } from '../nucleo/comisiones.js';
import { fmtCop, fmtMonto } from '../nucleo/dinero.js';
import { NOMBRE_MONEDA, iconoForma } from '../nucleo/formas.js';
import { hoy, sumarDias, rangoCorto, inicioDia, fechaHora } from '../nucleo/fechas.js';
import { abrirCalendarioRango } from './calendario.js';
import { escucharVentasConCosto, listaVentas } from './ventas-rango.js';
import { abrirActividad } from './actividad.js';

// v1.94: Ventas y Ganancia van en dos columnas iguales; la letra baja antes (desde 8 caracteres) para que no se toquen.
const largoKpi = t => { const n = String(t).length; return n >= 12 ? 'xl' : n >= 10 ? 'l' : n >= 8 ? 'm' : null; };

// Selector de rango: Hoy / Semana / Mes / Año (v2.01), o cualquier rango con el calendario propio.
function selectorRango(alCambiar, inicial = 'hoy') {
  const d = hoy();
  const lunes = sumarDias(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  // v2.16: cada opción es el período completo (lunes a domingo, del 1 al último día del mes, 1 ene – 31 dic).
  const ultimoDelMes = (() => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); })();
  const RANGOS = { hoy: [d, d], semana: [lunes, sumarDias(lunes, 6)], mes: [d.slice(0, 8) + '01', ultimoDelMes], ano: [d.slice(0, 5) + '01-01', d.slice(0, 5) + '12-31'] };
  let [desde, hasta] = RANGOS[inicial];
  let activo = inicial;
  const seg = h('div', { class: 'segmentado' });
  const boton = h('button', { type: 'button', class: 'pill rango-btn', id: 'rango-btn', 'aria-label': 'Elegir fechas' });
  const fijar = (a, b, k) => { [desde, hasta] = [a, b]; activo = k; pintar(); alCambiar(desde, hasta); };
  const pintar = () => {
    seg.replaceChildren(...[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['ano', 'Año']].map(([k, t]) =>
      h('button', { 'aria-pressed': String(k === activo), onclick: () => fijar(...RANGOS[k], k) }, t)));
    boton.replaceChildren(h('span', {}, icono('calendario'), rangoCorto(desde, hasta)));
  };
  boton.addEventListener('click', () => abrirCalendarioRango({ desde, hasta, ancla: boton }, (a, b) => fijar(a, b, Object.keys(RANGOS).find(k => RANGOS[k][0] === a && RANGOS[k][1] === b) || '')));
  pintar();
  return { el: h('div', { class: 'rango' }, seg, boton), valor: () => [desde, hasta] };
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const COLOR_MONEDA = { COP: 'var(--cop)', USD: 'var(--usd)', BS: 'var(--bs)', Bs: 'var(--bs)' };
// Cada forma de pago con un tono propio dentro del color de su moneda (claro → oscuro), para no repetir colores.
function tonosPorForma(ids, monedaDe) {
  const MEZCLA = ['', '#ffffff 45%', '#0f172a 35%', '#ffffff 70%', '#0f172a 60%'];
  const vistos = {}, r = {};
  for (const id of ids) {
    const m = monedaDe(id), base = COLOR_MONEDA[m] || 'var(--muted)', k = vistos[m] = (vistos[m] ?? -1) + 1;
    r[id] = k ? `color-mix(in srgb,${base},${MEZCLA[k % MEZCLA.length]})` : base;
  }
  return r;
}

// Gráfica de barras de ventas (por hora o por día). La barra más alta lleva su monto.
function graficaVentas(p) {
  const max = Math.max(...p.barras.map(b => b.total), 0);
  const salto = p.barras.length > 16 ? Math.ceil(p.barras.length / 8) : p.barras.length > 9 ? 2 : 1;
  return h('div', { class: 'graf', role: 'img', 'aria-label': `Ventas por ${p.modo === 'hora' ? 'hora' : p.modo === 'mes' ? 'mes' : 'día'}` },
    h('div', { class: 'graf-barras' }, ...p.barras.map((b, i) => h('div', { class: 'graf-col' + (max && b.total === max ? ' max' : ''), style: `--i:${i}`, title: `${b.etiqueta}: ${fmtCop(b.total)}` },
      max && b.total === max ? h('span', { class: 'graf-tope num' }, fmtCop(b.total)) : null,
      h('i', { style: `height:${max ? Math.max(b.total ? 3 : 0, (b.total / max) * 100) : 0}%` })))),
    h('div', { class: 'graf-ejes' }, ...p.barras.map((b, i) => h('span', {}, i % salto === 0 ? b.etiqueta : ''))));
}

// v2.01 · Contenido de las ventanas de Reportes: un total arriba y filas con ícono o puesto, nombre, detalle,
// monto y una barra de proporción. Sencillo, con el color de cada forma de pago.
const rdTotal = (et, valor, sub) => h('div', { class: 'rd-tot' }, h('span', {}, et), h('b', { class: 'num', 'data-largo': largo(valor) }, valor), sub ? h('small', {}, sub) : null);
// v2.03 · Encabezado de las ventanas: tarjeta con degradado, la cifra principal y a la derecha dos datos que la
// lista no muestra; debajo, en Montos y Más vendidos, una barra con el reparto.
const rdHero = ({ ic, et, valor, moneda, lado, pila }) => h('div', { class: 'rd-hero' },
  h('div', {}, h('span', { class: 'rh-et' }, icono(ic), et), h('b', { class: 'rh-num num', 'data-largo': largo(valor) }, valor, moneda ? h('small', {}, moneda) : null)),
  lado ? h('div', { class: 'rh-lado' }, ...lado.flatMap((x, i) => (i ? [h('br'), ...x] : x))) : null,
  pila && pila.length ? h('div', { class: 'rh-pila', 'aria-hidden': 'true' }, ...pila.map(([p, c]) => h('i', { style: `width:${p}%;--c2:${c}` }))) : null);
const rdFila = ({ ic, puesto, color, nombre, detalle, valor, sub, pct: p, extra }) => h('div', { class: 'rd-fila' + (p != null ? ' con-barra' : ''), style: color ? `--c:${color}` : '' },
  puesto != null ? h('span', { class: 'rd-puesto num' + (puesto <= 3 ? ' top' : '') }, String(puesto)) : ic ? h('span', { class: 'rd-ic' }, icono(ic)) : null,
  h('span', { class: 'rd-n' }, h('b', {}, nombre), detalle ? h('small', {}, detalle) : null, extra || null),
  h('span', { class: 'rd-v' }, typeof valor === 'string' ? h('b', { class: 'num' }, valor) : valor, sub ? h('small', {}, sub) : null),
  p != null ? h('span', { class: 'rd-barra', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(2, p)}%` })) : null);

// Fila de sección que abre el detalle.
const filaSeccion = (cls, ic, titulo, resumen, alAbrir) => h('button', { type: 'button', class: 'rep-fila ' + cls, onclick: alAbrir },
  h('span', { class: 'rep-fila-ic' }, icono(ic)), h('span', { class: 'rep-fila-t' }, h('b', {}, titulo), resumen ? h('span', { class: 'nota' }, ...[].concat(resumen)) : null), icono('der'));

registrarVista('/reportes', {
  montar(cont, ctx) {
    const gestion = ctx.puedeVer('verReportesTodos');
    let quitar = null, datos = { ventas: [], costosVenta: null, costos: {} }, rangoActual = [hoy(), hoy()];
    const cuerpo = h('div', { class: 'pila rep' });
    // v2.01: al cambiar de Hoy/Semana/Mes/Año el contenido entra con un fundido y las gráficas crecen. Las piezas
    // que no cambian se reusan, para que una actualización de datos no reinicie la animación.
    let animar = true, tAnim = 0;
    const memo = new Map();
    const reusar = (k, clave, armar) => { const m = memo.get(k); if (m && m.clave === clave) return m.el; const el = armar(); memo.set(k, { clave, el }); return el; };
    const pintar = () => {
      if (!animar) cuerpo.classList.remove('rep-anim'); // una actualización posterior no repite la animación
      const r = resumenDia(datos.ventas, datos.costosVenta, ctx.ajustes.formasPago);
      const formas = ctx.ajustes.formasPago;
      const productos = Object.values(ctx.productos);
      const nombreForma = id => formas.find(x => x.id === id) || { nombre: id, moneda: 'COP' };
      const enPesos = Object.entries(cobrosEnPesos(datos.ventas, formas)).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
      const sumaPesos = enPesos.reduce((s, [, m]) => s + m, 0);
      const tono = tonosPorForma(enPesos.map(([id]) => id), id => nombreForma(id).moneda);
      const top = masVendidos(datos.ventas, ctx.productos, 50);
      const bajas = gestion ? inventarioBajo(productos) : [];
      const validas = datos.ventas.filter(v => v.estado !== 'anulada').length;

      const resumen = h('div', { class: 'tarjeta rep-resumen' },
        // Ventas y Ganancia con el mismo tamaño; si alguno es largo, bajan los dos un paso de la escala.
        h('div', { class: 'rep-kpis', 'data-largo': largoKpi(fmtCop(Math.max(r.total || 0, Math.abs(r.ganancia || 0)))) },
          h('div', { class: 'rep-kpi principal', 'data-k': 'total' }, h('span', { class: 'et' }, 'Ventas'), h('b', { class: 'val num' }, fmtCop(r.total))),
          gestion ? h('div', { class: 'rep-kpi', 'data-k': 'ganancia' }, h('span', { class: 'et' }, 'Ganancia'),
            h('b', { class: 'val num' }, r.ganancia == null ? '—' : fmtCop(r.ganancia)),
            r.ganancia != null && r.total ? h('span', { class: 'sub' }, r.gananciaParcial ? 'calculando…' : `${pct(r.ganancia, r.total)}% del total`) : null) : null),
        h('div', { class: 'rep-mini' },
          h('span', {}, h('b', { class: 'num' }, String(r.ventas)), r.ventas === 1 ? ' venta' : ' ventas'),
          h('span', {}, h('b', { class: 'num' }, String(r.unidades)), r.unidades === 1 ? ' prenda' : ' prendas'),
          h('span', {}, 'ticket ', h('b', { class: 'num' }, fmtCop(r.ticketPromedio)))),
        r.ventas ? (() => { const pp = ventasPorPeriodo(datos.ventas, ...rangoActual); return reusar('graf', pp.modo + pp.barras.map(b => b.total).join(','), () => graficaVentas(pp)); })() : null);

      const pagos = h('div', { class: 'tarjeta rep-pagos' }, h('h2', { class: 'sec-t' }, 'Cobros'),
        sumaPesos ? h('div', { class: 'rep-pila', role: 'img', 'aria-label': 'Reparto de cobros por forma de pago' },
          ...enPesos.map(([id, m]) => h('i', { style: `width:${(m / sumaPesos) * 100}%;--c:${tono[id]};--o:1`, title: nombreForma(id).nombre }))) : null,
        sumaPesos ? h('div', { class: 'rep-leyenda' }, ...enPesos.map(([id, m]) => h('span', {},
          h('i', { style: `--c:${tono[id]};--o:1` }), nombreForma(id).nombre, h('b', { class: 'num' }, ` ${pct(m, sumaPesos)}%`)))) : h('p', { class: 'nota' }, 'Sin cobros.'),
        sumaPesos ? h('button', { type: 'button', class: 'rep-ver', onclick: () => abrirVentana({ titulo: 'Cobros por forma de pago', contenido: h('div', { class: 'rd' },
          (() => { const ef = pct(enPesos.filter(([id]) => nombreForma(id).efectivo).reduce((t, [, m]) => t + m, 0), sumaPesos);
            return rdHero({ ic: 'monedas', et: 'Cobrado en total', valor: fmtCop(sumaPesos), moneda: 'COP', lado: [['Efectivo ', h('b', {}, `${ef} %`)], ['Digital ', h('b', {}, `${100 - ef} %`)]],
              pila: enPesos.map(([id, m]) => [(m / sumaPesos) * 100, tono[id]]) }); })(),
          ...enPesos.map(([id, mCop]) => { const f = nombreForma(id), m = r.porForma[id] || 0;
            return rdFila({ ic: iconoForma(f), color: tono[id], nombre: f.nombre, detalle: f.moneda === 'COP' ? 'Pesos' : `${NOMBRE_MONEDA[f.moneda]} · ≈ ${fmtCop(mCop)} COP`,
              valor: `${fmtMonto(m, f.moneda)} ${NOMBRE_MONEDA[f.moneda]}`, sub: `${pct(mCop, sumaPesos)} %`, pct: pct(mCop, sumaPesos) }); })) }) }, 'Ver montos', icono('der')) : null);

      const maxU = top[0]?.unidades || 0;
      const vendidos = h('div', { class: 'tarjeta mas-vendidos' }, h('h2', { class: 'sec-t' }, 'Más vendidos'),
        top.length ? reusar('top', top.slice(0, 5).map(m => m.nombre + m.unidades).join('|'), () => h('div', { class: 'rep-top' }, ...top.slice(0, 5).map((m, i) => h('div', { class: 'rep-top-fila', style: `--i:${i}` },
          h('span', { class: 'rep-top-n' }, m.nombre), h('span', { class: 'rep-top-barra' }, h('i', { style: `width:${pct(m.unidades, maxU)}%` })), h('b', { class: 'num' }, String(m.unidades)))))) : h('p', { class: 'nota' }, 'Sin ventas en este período.'),
        top.length ? h('button', { type: 'button', class: 'rep-ver', id: 'rep-ver-vendidos', onclick: () => abrirVentana({ titulo: 'Más vendidos', contenido: h('div', { class: 'rd' },
          (() => { const u = top.reduce((s2, m) => s2 + m.unidades, 0), tl = {};
            for (const m of top) for (const [t, n] of Object.entries(m.tallas)) tl[t] = (tl[t] || 0) + n;
            const [tt, tn] = Object.entries(tl).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
            const porVenta = r.ventas ? (r.unidades / r.ventas).toLocaleString('es-VE', { maximumFractionDigits: 1 }) : '0';
            const TONOS = ['var(--accent)', 'color-mix(in srgb,var(--accent),#fff 30%)', 'color-mix(in srgb,var(--accent),#fff 50%)', 'color-mix(in srgb,var(--accent),#fff 65%)', 'color-mix(in srgb,var(--accent),#fff 75%)'];
            return rdHero({ ic: 'franela', et: 'Prendas vendidas', valor: String(u), lado: [['Talla top ', h('b', {}, `${tt} · ${tn}`)], [h('b', {}, porVenta), ' por venta']],
              pila: top.map((m, i) => [u ? (m.unidades / u) * 100 : 0, TONOS[Math.min(i, 4)]]) }); })(),
          ...top.map((m, i) => rdFila({ puesto: i + 1, nombre: m.nombre, extra: h('span', { class: 'rd-tallas' }, ...Object.entries(m.tallas).map(([t, n]) => h('span', { class: 'rd-chip num' }, `${t} · ${n}`))),
            valor: String(m.unidades), sub: m.unidades === 1 ? 'prenda' : 'prendas', pct: pct(m.unidades, maxU) }))) }) }, top.length > 5 ? `Ver los ${top.length}` : 'Ver tallas', icono('der')) : null);

      const inv = gestion ? valorInventario(productos, datos.costos) : null;
      cuerpo.replaceChildren(...sin(resumen, h('div', { class: 'rep-dos' }, pagos, vendidos),
        h('div', { class: 'rep-filas tarjeta' },
          filaSeccion('rep-ventas', 'historial', 'Ventas', `${validas} en este período`, () => abrirVentana({ titulo: 'Ventas', contenido: h('div', { class: 'rd' },
            rdHero({ ic: 'historial', et: 'Vendido en el período', valor: fmtCop(r.total), moneda: 'COP', lado: [[h('b', {}, String(validas)), validas === 1 ? ' venta' : ' ventas'], ['ticket ', h('b', {}, fmtCop(r.ticketPromedio || 0))]] }), listaVentas(ctx, datos.ventas, 200)) })),
          gestion ? filaSeccion('bajas', 'alerta', 'Existencias bajas', bajas.length ? `${bajas.length} ${bajas.length === 1 ? 'talla' : 'tallas'} en el mínimo o menos` : 'Todo en orden', () => abrirVentana({ titulo: 'Existencias bajas', contenido: h('div', { class: 'rd bajas-det' },
            ...(bajas.length ? [rdTotal('Tallas en el mínimo o menos', String(bajas.length), `${bajas.filter(p => p.existencia <= 0).length} agotadas`),
              ...bajas.slice(0, 100).map(p => rdFila({ ic: 'alerta', color: p.existencia <= 0 ? 'var(--err)' : 'var(--tono-ambar)', nombre: titulo(p), detalle: [p.talla ? 'Talla ' + p.talla : 'Talla única', p.color, p.tela].filter(Boolean).join(' · '),
                valor: h('span', { class: 'est num ' + (p.existencia <= 0 ? 'r' : 'y') }, p.existencia <= 0 ? 'Agotada' : `${p.existencia} ${p.existencia === 1 ? 'ud.' : 'uds'}`), sub: `mín. ${p.minimo || 0}` }))] : [h('p', { class: 'nota' }, 'Ninguna talla está en el mínimo.')])) })) : null,
          gestion ? filaSeccion('rep-inv', 'caja', 'Valor del inventario', [`${fmtCop(inv.aCosto)} a costo`, h('br'), `${fmtCop(inv.aPrecio)} a precio`], () => abrirVentana({ titulo: 'Valor del inventario', contenido: h('div', { class: 'rd' },
            h('div', { class: 'rd-stats' },
              h('div', { class: 'rd-stat' }, h('span', {}, 'A costo'), h('b', { class: 'num', 'data-largo': largo(fmtCop(inv.aCosto)) }, fmtCop(inv.aCosto))),
              h('div', { class: 'rd-stat' }, h('span', {}, 'A precio detal'), h('b', { class: 'num', 'data-largo': largo(fmtCop(inv.aPrecio)) }, fmtCop(inv.aPrecio)))),
            h('div', { class: 'rd-stat ganancia' }, h('span', {}, 'Ganancia posible'), h('b', { class: 'num', 'data-largo': largo(fmtCop(inv.aPrecio - inv.aCosto)) }, fmtCop(inv.aPrecio - inv.aCosto)),
              h('small', {}, inv.aPrecio ? `${pct(inv.aPrecio - inv.aCosto, inv.aPrecio)} % del precio detal` : ''))) })) : null,
          // v2.27 · Registro de actividad del período (gestión).
          gestion ? filaSeccion('rep-act', 'historial', 'Actividad', rangoCorto(rangoActual[0], rangoActual[1]), () => abrirActividad(ctx, { desde: rangoActual[0], hasta: rangoActual[1] })) : null)));
      if (animar) { animar = false; cuerpo.classList.remove('rep-anim'); void cuerpo.offsetWidth; cuerpo.classList.add('rep-anim'); clearTimeout(tAnim); tAnim = setTimeout(() => cuerpo.classList.remove('rep-anim'), 900); }
    };
    // v2.03: una sola escucha para todo el año (desde el lunes si la semana empezó el año anterior). Hoy, Semana,
    // Mes y Año se sacan de ahí sin volver a pedir datos: el cambio es instantáneo y solo queda la animación.
    // Al entrar se espera a que lleguen ventas y costos (máx. 1,2 s) con lo anterior atenuado; un rango del
    // calendario fuera del año usa su propia escucha.
    const d0 = hoy(), lunes0 = sumarDias(d0, -((new Date(`${d0}T12:00:00Z`).getUTCDay() + 6) % 7));
    const baseDesde = [lunes0, d0.slice(0, 5) + '01-01'].sort()[0];
    let base = null, quitarBase = null, tEspera = 0, esperando = false;
    const recortar = (d, desde, hasta) => {
      const a = inicioDia(desde), b = inicioDia(sumarDias(hasta, 1));
      return { ...d, ventas: d.ventas.filter(v => v.fecha >= a && v.fecha < b) };
    };
    const enBase = (desde, hasta) => desde >= baseDesde && hasta <= d0;
    const soltar = () => { if (!esperando) return; esperando = false; clearTimeout(tEspera); cuerpo.classList.remove('rep-cargando'); pintar(); };
    const esperar = () => { esperando = true; cuerpo.classList.add('rep-cargando'); clearTimeout(tEspera); tEspera = setTimeout(soltar, 1200); };
    const llego = d => { if (esperando) { if (d.listo && !resumenDia(d.ventas, d.costosVenta, ctx.ajustes.formasPago).gananciaParcial) soltar(); return; } pintar(); };
    const cargar = (desde, hasta) => {
      rangoActual = [desde, hasta]; animar = true; memo.clear(); quitar && quitar(); quitar = null;
      if (gestion && enBase(desde, hasta)) {
        if (!quitarBase) { esperar(); quitarBase = escucharVentasConCosto(ctx, { desde: baseDesde, hasta: d0 }, d => { base = d; if (rangoActual && enBase(...rangoActual) && !quitar) { datos = recortar(d, ...rangoActual); llego(datos); } }); }
        else if (base) { datos = recortar(base, desde, hasta); if (esperando) llego(datos); else pintar(); }
        return;
      }
      esperar();
      quitar = escucharVentasConCosto(ctx, { desde, hasta }, d => { datos = d; llego(d); });
    };
    const rango = selectorRango(cargar);
    cont.append(h('div', { class: 'cab-vista' }, gestion ? rango.el : h('span', { class: 'nota' }, 'Tus ventas de hoy')), cuerpo);
    cargar(...(gestion ? rango.valor() : [hoy(), hoy()]));
    return () => { clearTimeout(tAnim); clearTimeout(tEspera); quitar && quitar(); quitarBase && quitarBase(); };
  },
});

// Algunas copias locales conservan ventas registradas por el usuario simulado.
const esVentaDemoHistorica = v => v.usuario === 'demo' && v.uid === 'u-demo';

function abrirComisionesPorVenta(ventas, quien, filtro, pagos, totalPeriodo) {
  const panel = h('div', { class: 'rd' });
  const valorCop = m => Number.isFinite(m) ? `${fmtCop(m)} COP` : 'No disponible';
  const fila = (etiqueta, valor) => h('div', { class: 'det-fila' }, h('span', {}, etiqueta), h('b', { class: 'num' }, valor));
  const detalle = (v, indice) => {
    const lineas = v.lineas || [];
    const completo = lineas.length > 0 && lineas.every(l => Number.isFinite(l.comision));
    const clasificado = completo && lineas.every(l => !l.comision || typeof l.reducida === 'boolean');
    const r = resumenComisiones([v], filtro, pagos);
    const volver = h('button', { type: 'button', class: 'btn', onclick: () => lista(indice) }, 'Volver a las ventas');
    panel.replaceChildren(
      volver,
      rdTotal(v.numero || 'Venta sin número', valorCop(v.total), v.cliente?.nombre || 'Sin cliente'),
      h('p', { class: 'nota' }, [v.fecha ? fechaHora(v.fecha) : null, v.usuario ? `${quien} · @${v.usuario}` : null].filter(Boolean).join(' · ')),
      ...lineas.map(l => rdFila({ ic: 'recibo', nombre: l.nombre || l.sku || 'Producto sin identificación',
        detalle: [l.color, l.talla ? `Talla ${l.talla}` : null,
          Number.isFinite(l.cantidad) ? `${l.cantidad} × ${valorCop(l.precioUnit)}` : null,
          Number.isInteger(l.tramo) && l.tramo >= 0 ? `Tramo ${l.tramo + 1}` : null].filter(Boolean).join(' · '),
        extra: h('small', {}, `Comisión${l.reducida === true ? ' reducida' : l.reducida === false ? ' normal' : ''} · ${valorCop(l.comision)}`),
        valor: valorCop(l.subtotal), sub: 'Subtotal' })),
      fila('Total de prendas', lineas.length && lineas.every(l => Number.isFinite(l.cantidad)) ? String(r.prendas) : 'No disponible'),
      fila('Comisión normal', valorCop(clasificado ? r.normal : null)),
      fila('Comisión reducida', valorCop(clasificado ? r.reducida : null)),
      fila('Comisión total', valorCop(completo ? r.total : null)),
      fila('Comisión pagada', valorCop(completo ? r.pagado : null)),
      fila('Comisión pendiente', valorCop(completo ? r.pendiente : null)),
      fila('Estado de liquidación', !completo ? 'No disponible' : !r.total ? 'Sin comisión' : r.pendiente ? 'Pendiente' : 'Liquidada'));
    panel.closest('.cuerpo').scrollTop = 0;
    volver.focus();
  };
  function lista(indice) {
    const filas = ventas.map((v, i) => {
      const r = resumenComisiones([v], filtro, pagos);
      const prendas = r.prendas === 1 ? '1 prenda' : `${r.prendas} prendas`;
      return h('button', { type: 'button', class: 'venta-hoy', onclick: () => detalle(v, i) },
        h('span', { class: 'vh-info' }, h('b', {}, v.cliente?.nombre || 'Sin cliente'),
          h('span', { class: 'vh-meta' }, [v.numero, Number.isFinite(r.prendas) ? prendas : null].filter(Boolean).join(' · '))),
        h('span', { class: 'num' }, v.lineas?.length && v.lineas.every(l => Number.isFinite(l.comision))
          ? fmtCop(r.total) : 'No disponible'), icono('der'));
    });
    panel.replaceChildren(rdTotal('Comisión en el período', fmtCop(totalPeriodo),
      `${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'}`), h('div', { class: 'lista-ventas' }, ...filas));
    filas[indice]?.focus();
  }
  lista();
  abrirVentana({ titulo: `Ventas de ${quien}`, contenido: panel });
}

registrarVista('/comisiones', {
  accion: 'pagarComisiones',
  montar(cont, ctx) {
    let usuarios = [], ventas = [], pagos = [], vendedor = '', quitarVentas = null;
    let [desde, hasta] = [hoy(), hoy()];
    const sel = h('div', { class: 'segmentado personas', id: 'com-vendedor', role: 'group', 'aria-label': 'Quién' });
    const res = h('div', { class: 'resumen-com' });
    const pintar = () => {
      // Solo quienes ganan comisión (lo marca el administrador en Usuarios; por defecto, la vendedora).
      const opciones = usuarios.filter(u => u.activo !== false && ganaComision(u));
      const demoHistorico = MODO_DEMO && !usuarios.some(u => u.usuario === 'demo') && ventas.some(esVentaDemoHistorica);
      if (demoHistorico) opciones.push({ usuario: 'demo', nombre: 'Demostración (@demo)' });
      if (!opciones.some(u => u.usuario === vendedor)) vendedor = opciones[0]?.usuario || '';
      sel.replaceChildren(...opciones.map(u => h('button', { type: 'button', 'data-usuario': u.usuario, 'aria-pressed': String(u.usuario === vendedor), onclick: () => { vendedor = u.usuario; pintar(); } }, u.nombre)));
      sel.hidden = opciones.length < 2;
      if (!vendedor) {
        res.replaceChildren(h('div', { class: 'tarjeta vacio' }, h('p', {}, 'Nadie gana comisión todavía.'),
          ctx.puedeVer('ajustes') ? h('p', { class: 'nota' }, 'Márcalo en Más → Usuarios con «Gana comisión».') : null));
        return;
      }
      const elegibles = demoHistorico && vendedor === 'demo' ? ventas.filter(esVentaDemoHistorica) : ventas;
      const r = resumenComisiones(elegibles, { vendedor, desde, hasta }, pagos);
      const quien = opciones.find(u => u.usuario === vendedor);
      const pagadoPct = r.total ? Math.round((r.pagado / r.total) * 100) : 0;
      const propias = elegibles.filter(v => v.usuario === vendedor && v.estado !== 'anulada').sort((a, b) => b.fecha.localeCompare(a.fecha));
      res.replaceChildren(
        h('div', { class: 'tarjeta com-hero' },
          h('span', { class: 'et' }, r.pendiente > 0 ? `Por pagar a ${quien?.nombre || vendedor}` : `${quien?.nombre || vendedor} · comisiones`),
          h('b', { class: 'num com-monto', id: 'com-pendiente', 'data-largo': largo(fmtCop(r.pendiente > 0 ? r.pendiente : r.total)) }, fmtCop(r.pendiente > 0 ? r.pendiente : r.total)),
          h('span', { class: 'nota' }, r.total ? (r.pendiente > 0 ? `de ${fmtCop(r.total)} ganados en el período` : 'Todo pagado') : 'Sin comisiones en el período'),
          r.total ? h('div', { class: 'com-prog' }, h('div', { class: 'ap-barra com-barra', role: 'progressbar', 'aria-label': 'Pagado', 'aria-valuenow': String(pagadoPct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${pagadoPct}%` })), h('span', { class: 'nota' }, `${pagadoPct} % pagado`)) : null,
          r.pendiente > 0 ? h('button', { class: 'btn primary grande', id: 'com-pagar', onclick: e => unaVez(e.currentTarget, async () => {
            const x = await ctx.almacen.pagarComisiones({ vendedor, desde, hasta, monto: r.pendiente, ventas: r.idsPendientes });
            toast(x.ok ? 'Comisiones pagadas' : 'No se pudo guardar', { malo: !x.ok });
          })() }, icono('check'), 'Marcar como pagadas') : null),
        h('div', { class: 'tarjeta com-datos' },
          h('div', { class: 'com-fila' }, h('span', {}, 'Ventas'), h('b', { class: 'num' }, String(r.ventas))),
          h('div', { class: 'com-fila' }, h('span', {}, 'Prendas'), h('b', { class: 'num' }, String(r.prendas))),
          h('div', { class: 'com-fila' }, h('span', {}, 'Comisión normal'), h('b', { class: 'num' }, fmtCop(r.normal))),
          h('div', { class: 'com-fila' }, h('span', {}, 'Comisión reducida', h('small', { class: 'nota' }, ' (descuento u oferta)')), h('b', { class: 'num' }, fmtCop(r.reducida))),
          h('div', { class: 'com-fila' }, h('span', {}, 'Ya pagado'), h('b', { class: 'num' }, fmtCop(r.pagado))),
          propias.length ? h('button', { type: 'button', class: 'rep-ver', id: 'com-ver-ventas',
            onclick: () => abrirComisionesPorVenta(propias, quien?.nombre || vendedor, { vendedor, desde, hasta }, pagos, r.total),
          }, 'Ver comisión por venta', icono('der')) : null));
    };
    const cargar = (d, hh) => { desde = d; hasta = hh; quitarVentas && quitarVentas(); quitarVentas = escucharVentasConCosto(ctx, { desde, hasta }, x => { ventas = x.ventas; pintar(); }); };
    const rango = selectorRango(cargar, 'semana');
    const q = [ctx.almacen.escuchar('usuarios', l => { usuarios = l; pintar(); }), ctx.almacen.escuchar('comisiones', l => { pagos = l; pintar(); })];
    cont.append(h('div', { class: 'cab-vista' }, rango.el), sel, res);
    cargar(...rango.valor());
    return () => { q.forEach(x => x()); quitarVentas && quitarVentas(); };
  },
});
