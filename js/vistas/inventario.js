// Inventario (§7): consulta, ajustes con motivo, ofertas, importar desde la Carga Masiva y fotos masivas.
import { h, icono, abrirVentana, toast, esTelefono, pedirMotivo, sin } from '../ui.js';
import { registrarVista } from '../app.js';
import { miniatura } from './vender.js';
import { colorPrenda } from '../nucleo/colores.js';
import { compararTallas } from '../nucleo/tipo-prenda.js';
import { etiquetaTramo, precioDeTramo } from '../nucleo/tramos.js';
import { leerInventario, planImportacion } from '../nucleo/importar.js';
import { emparejarFotos } from '../nucleo/fotos.js';
import { fmtCop } from '../nucleo/dinero.js';
import { fechaHora } from '../nucleo/fechas.js';
import { comprimirFoto, CLAVE_TOKEN } from '../datos/github-fotos.js';

export const URL_INVENTARIO = 'https://kdnaskrlos.github.io/App-Inventario/data/inventario.json';
const MOTIVOS = ['Conteo', 'Daño', 'Regalo', 'Llegó del taller', 'Otro'];
const MOTIVO_TEXTO = { inicial: 'Existencia inicial', importación: 'Importación', venta: 'Venta', apartado: 'Apartado', anulación: 'Anulación', cancelación: 'Cancelación' };
const norm = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function colorExistencia(p) { return p.existencia <= 0 ? 'r' : p.existencia <= (p.minimo || 0) ? 'y' : 'g'; }

function grupos(productos) {
  const g = {};
  for (const p of Object.values(productos)) {
    if (p.activo === false) continue;
    (g[p.grupo || p.sku] ||= { grupo: p.grupo || p.sku, producto: p.producto || p.nombre, color: p.color, categoria: p.categoria, foto: p.foto, variantes: [] }).variantes.push(p);
  }
  return Object.values(g).sort((a, b) => a.grupo.localeCompare(b.grupo, 'es'));
}

const puedeAdmin = (ctx, accion) => ctx.puedeVer(accion) && !esTelefono();

function abrirAjuste(ctx, p) {
  const cant = h('input', { class: 'inp num', id: 'ajuste-cantidad', inputmode: 'numeric', placeholder: '+3 o -2' });
  const motivo = h('select', { class: 'inp', id: 'ajuste-motivo' }, ...MOTIVOS.map(m => h('option', { value: m }, m)));
  const nota = h('input', { class: 'inp', id: 'ajuste-nota', placeholder: 'Opcional' });
  const err = h('span', { class: 'error' });
  const b = h('button', { class: 'btn primary', id: 'ajuste-final' }, 'Guardar ajuste');
  const v = abrirVentana({ titulo: `Ajustar · ${p.grupo} · Talla ${p.talla || '—'}`, contenido: h('div', { class: 'pila' },
    h('p', { class: 'nota' }, `Existencia actual: ${p.existencia}. Escribe cuánto sumar (o restar con -).`),
    h('div', { class: 'campo' }, h('label', { for: 'ajuste-cantidad' }, 'Cantidad'), cant),
    h('div', { class: 'campo' }, h('label', { for: 'ajuste-motivo' }, 'Motivo'), motivo),
    h('div', { class: 'campo' }, h('label', { for: 'ajuste-nota' }, 'Nota'), nota, err)), acciones: h('div', { class: 'acciones' }, b) });
  b.addEventListener('click', async () => {
    const n = Number(String(cant.value).replace(/\s|\+/g, ''));
    if (!Number.isInteger(n) || !n) { err.textContent = 'Escribe una cantidad entera distinta de 0'; return; }
    const r = await ctx.almacen.ajustarExistencia(p.sku, n, motivo.value, nota.value.trim());
    if (!r.ok) { err.textContent = 'No se pudo guardar'; return; }
    v.cerrar(); toast('Ajuste guardado');
  });
}

function abrirHistorial(ctx, p) {
  const caja = h('div', { class: 'pila' }, h('p', { class: 'nota' }, 'Cargando…'));
  const v = abrirVentana({ titulo: `Historial · Talla ${p.talla || p.sku}`, contenido: caja });
  const quitar = ctx.almacen.escuchar('movimientos', l => {
    const lista = l.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 60);
    caja.replaceChildren(...(lista.length ? lista.map(m => h('div', { class: 'mov' },
      h('span', {}, `${MOTIVO_TEXTO[m.motivo] || m.motivo}${m.nota ? ' · ' + m.nota : ''}`, h('span', { class: 'nota' }, ` · ${fechaHora(m.fecha)} · @${m.usuario || '—'}`)),
      h('b', { class: 'num ' + (m.cantidad < 0 ? 'neg' : 'pos') }, `${m.cantidad > 0 ? '+' : ''}${m.cantidad}`))) : [h('p', { class: 'nota' }, `Sin movimientos registrados. Existencia actual: ${p.existencia}.`)]));
  }, { sku: p.sku });
  v.alCerrar = quitar;
}

function abrirOferta(ctx, g) {
  const actual = g.variantes.find(p => p.oferta)?.oferta;
  const pct = h('input', { class: 'inp num', id: 'oferta-pct', inputmode: 'decimal', value: actual?.pct || '' });
  const err = h('span', { class: 'error' });
  const b = h('button', { class: 'btn primary', id: 'oferta-final' }, 'Activar oferta');
  const quitarBtn = actual?.activa ? h('button', { class: 'btn danger', onclick: async () => { await ctx.almacen.guardarOferta(g.grupo, { pct: 0, activa: false }); v.cerrar(); toast('Oferta quitada'); } }, 'Quitar oferta') : null;
  const v = abrirVentana({ titulo: `Oferta · ${g.grupo}`, contenido: h('div', { class: 'pila' },
    h('p', { class: 'nota' }, 'Descuento sobre el precio de cada tramo. En estas prendas la vendedora gana la comisión reducida.'),
    h('div', { class: 'campo' }, h('label', { for: 'oferta-pct' }, 'Porcentaje'), pct, err)), acciones: h('div', { class: 'acciones' }, quitarBtn, b) });
  b.addEventListener('click', async () => {
    const n = Number(String(pct.value).replace(',', '.'));
    if (!(n > 0 && n <= 100)) { err.textContent = 'Entre 1 y 100'; return; }
    const r = await ctx.almacen.guardarOferta(g.grupo, { pct: n, activa: true });
    if (!r.ok) { err.textContent = 'No se pudo guardar'; return; }
    v.cerrar(); toast('Oferta activa');
  });
}

const mismos = (xs, f) => xs.every(x => JSON.stringify(f(x)) === JSON.stringify(f(xs[0])));

// Precios por cantidad: una fila sencilla por tramo (el precio que realmente se cobra) y el costo al final.
function bloquePrecios(ctx, p, costo, verCostos) {
  return h('div', { class: 'precios' },
    ...p.precios.map((_, i) => { const pr = precioDeTramo(p.precios, i); return h('div', { class: 'precio-tramo' }, h('span', {}, `${etiquetaTramo(i, ctx.ajustes.tramos)} prendas`), h('b', { class: 'num' }, pr ? fmtCop(pr) : '—')); }),
    verCostos ? h('div', { class: 'precio-tramo costo' }, h('span', {}, 'Costo'), h('b', { class: 'num' }, costo != null ? fmtCop(costo) : '—')) : null);
}

// Detalle de una prenda, sencillo: cuántas hay, una casilla por talla con su cantidad y los precios.
// Al tocar una talla se ven su código y, si hay permiso, Historial y Ajustar.
function abrirGrupo(ctx, g, costos) {
  const verCostos = ctx.puedeVer('verCostos');
  const ajustar = puedeAdmin(ctx, 'ajustarInventario');
  const vs = g.variantes.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || compararTallas(a.talla, b.talla) || a.sku.localeCompare(b.sku, 'es', { numeric: true }));
  const iguales = mismos(vs, p => [p.precios, costos[p.sku]?.costo ?? null]);
  const oferta = vs.find(p => p.oferta?.activa)?.oferta;
  const color = colorPrenda(g.color);
  let elegida = null;
  const casillas = h('div', { class: 'casillas-talla', role: 'group', 'aria-label': 'Existencias por talla' });
  const panel = h('div', { class: 'talla-panel' });
  const resumen = h('div', { class: 'dg-total' });
  const pintar = () => {
    const total = vs.reduce((t, p) => t + p.existencia, 0);
    resumen.replaceChildren(h('b', { class: 'num' }, String(total)), h('span', {}, total === 1 ? 'unidad en total' : 'unidades en total'));
    casillas.replaceChildren(...vs.map(p => { const c = colorExistencia(p); return h('button', { type: 'button', class: `barra-talla ${c}` + (elegida === p ? ' elegida' : ''), 'data-sku': p.sku, 'aria-pressed': String(elegida === p),
      'aria-label': `Talla ${p.talla || p.sku}: ${p.existencia} disponibles`, onclick: () => { elegida = elegida === p ? null : p; pintar(); } },
      h('span', { class: 'bt-talla' }, p.talla || p.sku),
      h('span', { class: 'bt-num num' }, String(p.existencia)),
      c !== 'g' ? h('span', { class: 'bt-est' }, c === 'r' ? 'agotada' : 'pocas') : null); }));
    panel.replaceChildren(...(elegida ? [h('div', { class: 'talla-fila', 'data-sku': elegida.sku },
      h('div', { class: 'tp-cab' }, h('b', {}, `Talla ${elegida.talla || '—'}`), elegida.codigo ? h('span', { class: 'nota num' }, `Código ${elegida.codigo}`) : null),
      iguales ? null : bloquePrecios(ctx, elegida, costos[elegida.sku]?.costo, verCostos),
      verCostos || ajustar ? h('div', { class: 'acciones' },
        verCostos ? h('button', { class: 'btn', id: 'talla-historial', 'aria-label': `Historial talla ${elegida.talla}`, onclick: () => abrirHistorial(ctx, elegida) }, icono('historial'), 'Historial') : null,
        ajustar ? h('button', { class: 'btn', id: 'talla-ajustar', onclick: () => abrirAjuste(ctx, elegida) }, icono('caja'), 'Ajustar') : null) : null)] : []));
  };
  pintar();
  const cont = h('div', { class: 'detalle-grupo' },
    h('div', { class: 'dg-cab' }, miniatura(g, 'miniatura grande'), h('button', { class: 'ibtn cerrar dg-x', 'aria-label': 'Cerrar' }, icono('x')),
      h('div', { class: 'dg-tit' }, h('b', {}, g.producto),
        h('span', { class: 'nota dg-color' }, g.color ? h('i', { class: 'punto-color', style: color ? `--pc:${color}` : '' }) : null, g.color || ''),
        oferta ? h('span', { class: 'est y' }, `Oferta ${oferta.pct}%`) : null)),
    resumen,
    h('h3', { class: 'dg-t' }, 'Tallas'),
    casillas, panel,
    iguales ? h('h3', { class: 'dg-t' }, 'Precios') : null,
    iguales ? bloquePrecios(ctx, vs[0], costos[vs[0].sku]?.costo, verCostos) : null);
  const acciones = puedeAdmin(ctx, 'ofertas') ? h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: () => abrirOferta(ctx, g) }, icono('etiqueta'), 'Oferta')) : null;
  const v = abrirVentana({ titulo: `${g.producto}${g.color ? ' · ' + g.color : ''}`, contenido: cont, acciones, clase: 'ventana-grupo', sinCabecera: true });
  // Tras un ajuste, la existencia cambia: volver a pintar con los datos nuevos
  const alDatos = e => { if (e.detail.que === 'productos') { vs.forEach((p, i) => { vs[i] = ctx.productos[p.sku] || p; }); if (elegida) elegida = ctx.productos[elegida.sku] || elegida; pintar(); } };
  window.addEventListener('pos:datos', alDatos);
  v.alCerrar = () => window.removeEventListener('pos:datos', alDatos);
}

async function abrirImportar(ctx, costos) {
  const cuerpo = h('div', { class: 'pila' }, h('p', { class: 'nota' }, 'Leyendo el inventario de la Carga Masiva…'));
  const b = h('button', { class: 'btn primary', id: 'importar-final', disabled: true }, 'Aplicar');
  const archivo = h('input', { type: 'file', accept: '.json,application/json', class: 'sr', id: 'importar-archivo' });
  const elegir = h('label', { class: 'btn', for: 'importar-archivo' }, icono('subir'), 'Elegir archivo');
  const v = abrirVentana({ titulo: 'Importar desde la Carga Masiva', contenido: cuerpo, acciones: h('div', { class: 'acciones' }, archivo, elegir, b) });
  let plan = null;
  const mostrar = json => {
    const { productos, avisos } = leerInventario(json);
    plan = planImportacion(productos, ctx.productos, costos);
    const fila = (n, txt, cls) => h('div', { class: `resumen-imp ${cls}` }, h('b', { class: 'num' }, String(n)), txt);
    cuerpo.replaceChildren(...sin(
      h('div', { class: 'resumenes' },
        fila(plan.nuevos.length, plural(plan.nuevos.length, 'nuevo', 'nuevos').replace(/^\d+ /, ''), 'g'),
        fila(plan.cambios.length, 'con cambios', 'b'),
        fila(plan.iguales.length, 'sin cambios', 'n'),
        fila(plan.faltantes.length, 'ya no están en el archivo', 'y')),
      h('p', { class: 'nota' }, `${plural(plan.nuevos.length, 'nuevo', 'nuevos')} · ${plan.cambios.length} con cambios · ${plan.iguales.length} sin cambios`),
      h('p', { class: 'nota' }, 'Las existencias de los productos que ya están en el punto de venta no se modifican.'),
      ...avisos.map(a => h('div', { class: 'aviso' }, icono('alerta'), a)),
      plan.cambios.length ? h('details', {}, h('summary', {}, 'Ver cambios'), h('div', { class: 'nota' }, plan.cambios.slice(0, 50).map(c => h('div', {}, `${c.sku}: ${Object.keys(c.campos).join(', ')}`)))) : null));
    b.disabled = !plan.nuevos.length && !plan.cambios.length;
  };
  archivo.addEventListener('change', async () => { try { mostrar(JSON.parse(await archivo.files[0].text())); } catch { cuerpo.replaceChildren(h('div', { class: 'aviso' }, icono('alerta'), 'Ese archivo no es un inventario válido')); } });
  b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Aplicando…';
    const r = await ctx.almacen.aplicarImportacion(plan);
    if (!r.ok) { b.disabled = false; b.textContent = 'Aplicar'; toast('No se pudo importar', { malo: true }); return; }
    v.cerrar(); toast('Importación lista');
  });
  try {
    const r = await fetch(`${URL_INVENTARIO}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error();
    mostrar(await r.json());
  } catch {
    cuerpo.replaceChildren(h('div', { class: 'aviso' }, icono('alerta'), 'No se pudo leer el inventario publicado. Elige el archivo inventario.json.'));
  }
}

function abrirFotos(ctx) {
  const lista = grupos(ctx.productos).map(g => g.grupo);
  let archivos = [], res = { asignadas: [], sinAsignar: [] }, manual = {};
  const entrada = h('input', { type: 'file', id: 'fotos-archivos', multiple: true, accept: 'image/*', class: 'sr' });
  const zona = h('label', { class: 'zona-fotos', for: 'fotos-archivos' }, icono('imagen'), h('b', {}, 'Arrastra aquí las fotos o toca para elegirlas'), h('span', { class: 'nota' }, 'El nombre del archivo debe ser el del modelo y color, por ejemplo "Franela AS Niño Blanco.jpg".'));
  const info = h('div', { class: 'pila' });
  const b = h('button', { class: 'btn primary', id: 'fotos-final', disabled: true }, icono('subir'), 'Subir fotos');
  const pintar = () => {
    res = emparejarFotos(archivos.map(f => f.name), lista);
    info.replaceChildren(
      h('p', { class: 'nota' }, `${plural(res.asignadas.length, 'asignada', 'asignadas')} · ${res.sinAsignar.length} sin asignar`),
      res.sinAsignar.length ? h('div', { class: 'sin-asignar pila' }, ...res.sinAsignar.map(n => h('div', { class: 'campo' }, h('label', {}, n),
        h('select', { class: 'inp', onchange: e => { manual[n] = e.target.value; } }, h('option', { value: '' }, 'Elegir modelo y color…'), ...lista.map(g => h('option', { value: g }, g)))))) : null);
    b.disabled = !archivos.length;
  };
  const cargar = fs => { archivos = [...fs].filter(f => f.type.startsWith('image/')); manual = {}; pintar(); };
  entrada.addEventListener('change', () => cargar(entrada.files));
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('encima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('encima'); cargar(e.dataTransfer.files); });
  const v = abrirVentana({ titulo: 'Fotos de productos', contenido: h('div', { class: 'pila' }, entrada, zona, info), acciones: h('div', { class: 'acciones' }, b) });
  b.addEventListener('click', async () => {
    const tareas = [...res.asignadas, ...Object.entries(manual).filter(([, g]) => g).map(([archivo, grupo]) => ({ archivo, grupo }))];
    if (!tareas.length) { toast('No hay fotos asignadas'); return; }
    b.disabled = true;
    let hechas = 0;
    for (const t of tareas) {
      b.textContent = `Subiendo ${hechas + 1} de ${tareas.length}…`;
      const blob = await comprimirFoto(archivos.find(f => f.name === t.archivo));
      let r = await ctx.almacen.guardarFoto(t.grupo, blob);
      if (!r.ok && r.error === 'token') {
        const token = await pedirMotivo({ titulo: 'Token de GitHub', etiqueta: 'Pega el token para subir fotos (se guarda solo en este navegador)', boton: 'Guardar token' });
        if (!token) break;
        try { localStorage.setItem(CLAVE_TOKEN, token.trim()); } catch { /* sin almacenamiento */ }
        r = await ctx.almacen.guardarFoto(t.grupo, blob);
      }
      if (!r.ok) { toast(`No se pudo subir ${t.archivo}`, { malo: true }); break; }
      hechas++;
    }
    v.cerrar(); toast(`${plural(hechas, 'foto subida', 'fotos subidas')}`);
  });
}

registrarVista('/inventario', {
  montar(cont, ctx) {
    let busqueda = '', costos = {}, filtro = '', categoria = '';
    const ESTADOS = [['', 'Todos'], ['bajo', 'Stock bajo'], ['agotado', 'Agotados']];
    const filtros = h('div', { class: 'filtros filtro-inv', role: 'group', 'aria-label': 'Filtrar inventario' });
    const buscar = h('input', { class: 'inp', id: 'buscar-inv', type: 'search', 'aria-label': 'Buscar prenda o código', placeholder: 'Buscar prenda o código', autocomplete: 'off' });
    const lista = h('div', { class: 'lista-inv' });
    const pintar = () => {
      const q = norm(busqueda);
      const todos = grupos(ctx.productos);
      const estadoDe = g => (g.variantes.some(p => colorExistencia(p) === 'r') ? 'agotado' : g.variantes.some(p => colorExistencia(p) === 'y') ? 'bajo' : '');
      const cats = [...new Set(todos.map(g => g.categoria).filter(Boolean))].sort();
      const cuenta = k => todos.filter(g => (k === 'bajo' ? estadoDe(g) !== '' : estadoDe(g) === k)).length;
      filtros.replaceChildren(
        ...ESTADOS.map(([k, t]) => h('button', { type: 'button', class: 'chip' + (k === filtro ? ' activo' : ''), 'data-filtro': k || 'todos', 'aria-pressed': String(k === filtro), onclick: () => { filtro = k; pintar(); } }, t, k ? h('span', { class: 'cuenta' }, String(cuenta(k))) : null)),
        cats.length > 1 ? h('span', { class: 'filtros-sep', 'aria-hidden': 'true' }) : null,
        ...(cats.length > 1 ? cats.map(c => h('button', { type: 'button', class: 'chip' + (c === categoria ? ' activo' : ''), 'aria-pressed': String(c === categoria), onclick: () => { categoria = c === categoria ? '' : c; pintar(); } }, c)) : []));
      const gs = todos.filter(g => (!q || g.variantes.some(p => norm(`${p.grupo} ${p.sku} ${p.codigo} ${p.marca}`).includes(q)))
        && (!filtro || (filtro === 'bajo' ? estadoDe(g) !== '' : estadoDe(g) === filtro))
        && (!categoria || g.categoria === categoria));
      lista.replaceChildren(...(gs.length ? gs.map(g => {
        const total = g.variantes.reduce((s, p) => s + p.existencia, 0);
        const pocas = g.variantes.some(p => colorExistencia(p) === 'y');
        const agotadas = g.variantes.some(p => colorExistencia(p) === 'r');
        const est = agotadas && total <= 0 ? ['r', 'Agotado'] : agotadas || pocas ? ['y', 'Stock bajo'] : ['g', 'En stock'];
        const color = colorPrenda(g.color);
        return h('button', { class: 'grupo-inv', 'data-grupo': g.grupo, onclick: () => abrirGrupo(ctx, g, costos) },
          miniatura(g, 'miniatura'),
          h('span', { class: 'gi-info' }, h('b', {}, g.producto),
            h('span', { class: 'gi-linea' }, g.color ? h('span', { class: 'gi-color' }, h('i', { class: 'punto-color', style: color ? `--pc:${color}` : '' }), g.color) : null,
              h('span', {}, `${g.variantes.length} ${g.variantes.length === 1 ? 'talla' : 'tallas'}`)),
            h('span', { class: 'gi-salud', 'aria-hidden': 'true' }, ...g.variantes.map(p => h('i', { class: colorExistencia(p) })))),
          h('span', { class: 'gi-total' }, h('b', { class: 'num' }, String(total)), h('span', {}, total === 1 ? 'unidad' : 'unidades'),
            h('span', { class: `est ${est[0]}` }, est[1])));
      }) : [h('div', { class: 'vacio' }, busqueda || filtro || categoria ? 'No hay prendas con ese filtro' : 'Todavía no hay productos')]));
    };
    buscar.addEventListener('input', () => { busqueda = buscar.value; pintar(); });
    const quitar = ctx.almacen.escuchar('costos', l => { costos = Object.fromEntries(l.map(c => [c.sku, c])); pintar(); });
    const alDatos = e => { if (e.detail.que === 'productos') pintar(); };
    window.addEventListener('pos:datos', alDatos);
    cont.append(...sin(
      h('div', { class: 'cab-vista' },
        h('div', { class: 'acciones' },
          puedeAdmin(ctx, 'fotosMasivas') ? h('button', { class: 'btn', onclick: () => abrirFotos(ctx) }, icono('imagen'), 'Fotos') : null,
          puedeAdmin(ctx, 'importar') ? h('button', { class: 'btn primary', onclick: () => abrirImportar(ctx, costos) }, icono('subir'), 'Importar') : null)),
      h('div', { class: 'buscar-caja' }, icono('buscar'), buscar),
      filtros,
      lista));
    pintar();
    return () => { quitar(); window.removeEventListener('pos:datos', alDatos); };
  },
});
