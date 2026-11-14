// Inventario (§7): consulta, ajustes con motivo, ofertas, importar desde la Carga Masiva y fotos masivas.
import { h, icono, abrirVentana, toast, esTelefono, pedirMotivo, sin, unaVez } from '../ui.js';
import { titulo, grupoDe, detalle, textoBusqueda, fotoDe } from '../nucleo/producto.js';
import { registrarVista } from '../app.js';
import { miniatura } from './vender.js';
import { colorPrenda } from '../nucleo/colores.js';
import { compararTallas } from '../nucleo/tipo-prenda.js';
import { etiquetaTramo, precioDeTramo } from '../nucleo/tramos.js';
import { leerInventario, planImportacion, detalleCambios } from '../nucleo/importar.js';
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

function grupos(productos, imagenes = {}) {
  const g = {};
  for (const p of Object.values(productos)) {
    if (p.activo === false) continue;
    const k = grupoDe(p);
    const t = (g[k] ||= { grupo: k, titulo: titulo(p), tipo: p.tipo, tela: p.tela, color: p.color, genero: p.genero, foto: null, id_imagen: '', variantes: [] });
    t.foto ||= fotoDe(p, imagenes); // la foto del código de imagen de la tarjeta
    t.id_imagen ||= p.id_imagen || '';
    t.variantes.push(p);
  }
  return Object.values(g).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es') || (a.color || '').localeCompare(b.color || '', 'es') || (a.tela || '').localeCompare(b.tela || '', 'es'));
}

const puedeAdmin = (ctx, accion) => ctx.puedeVer(accion) && !esTelefono();

function abrirAjuste(ctx, p) {
  const cant = h('input', { class: 'inp num', id: 'ajuste-cantidad', inputmode: 'numeric', placeholder: '+3 o -2' });
  const motivo = h('select', { class: 'inp', id: 'ajuste-motivo' }, ...MOTIVOS.map(m => h('option', { value: m }, m)));
  const nota = h('input', { class: 'inp', id: 'ajuste-nota', placeholder: 'Opcional' });
  const err = h('span', { class: 'error' });
  const b = h('button', { class: 'btn primary', id: 'ajuste-final' }, 'Guardar ajuste');
  const v = abrirVentana({ titulo: `Ajustar · ${titulo(p)}${detalle(p) ? ' · ' + detalle(p) : ''} · ${p.talla ? 'Talla ' + p.talla : 'Talla única'}`, contenido: h('div', { class: 'pila' },
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
  const v = abrirVentana({ titulo: `Historial · ${p.talla ? 'Talla ' + p.talla : 'Talla única'}`, contenido: caja });
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
  const v = abrirVentana({ titulo: `Oferta · ${g.titulo}${detalle(g) ? ' · ' + detalle(g) : ''}`, contenido: h('div', { class: 'pila' },
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

function bloquePrecios(ctx, p, costo, verCostos) {
  // El precio que realmente se cobra en cada tramo (si falta, el del tramo anterior con valor)
  return h('div', { class: 'precios' }, ...p.precios.map((_, i) => { const pr = precioDeTramo(p.precios, i); return h('div', { class: 'precio-tramo' }, h('span', { class: 'nota' }, etiquetaTramo(i, ctx.ajustes.tramos)), h('b', { class: 'num' }, pr ? fmtCop(pr) : '—')); }),
    verCostos ? h('div', { class: 'precio-tramo costo' }, h('span', { class: 'nota' }, 'Costo'), h('b', { class: 'num' }, costo != null ? fmtCop(costo) : '—')) : null);
}

// «Foto» / «Cambiar foto» en el detalle: se sube una sola vez al código de imagen de la tarjeta y la
// muestran todas sus variantes. Sin código de imagen no se ofrece (no hay foto por sku).
function botonFoto(ctx, g, cont) {
  const entrada = h('input', { type: 'file', accept: 'image/*', class: 'sr', id: 'foto-grupo-archivo' });
  const b = h('button', { class: 'btn', id: 'foto-grupo', onclick: () => entrada.click() }, icono('imagen'), g.foto ? 'Cambiar foto' : 'Foto');
  entrada.addEventListener('change', async () => {
    const f = entrada.files[0]; if (!f) return;
    b.disabled = true; b.replaceChildren(icono('imagen'), 'Subiendo…');
    const blob = await comprimirFoto(f);
    const r = await subirFoto(ctx, g.id_imagen, blob);
    b.disabled = false; b.replaceChildren(icono('imagen'), r.ok ? 'Cambiar foto' : g.foto ? 'Cambiar foto' : 'Foto');
    entrada.value = '';
    if (!r.ok) { if (r.error !== 'cancelado') toast('No se pudo subir la foto', { malo: true }); return; }
    const vista = cont.querySelector('.foto-grupo');
    if (vista && globalThis.URL?.createObjectURL) vista.firstChild.replaceWith(miniatura({ ...g, foto: URL.createObjectURL(blob) }, 'miniatura'));
    toast(`Foto guardada para ${g.id_imagen}`);
  });
  return h('span', { class: 'foto-acc' }, entrada, b);
}

// Detalle de una prenda: precios una sola vez (si son iguales en todas las tallas) y una fila por talla.
function abrirGrupo(ctx, g, costos) {
  const verCostos = ctx.puedeVer('verCostos');
  const vs = g.variantes.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || compararTallas(a.talla, b.talla) || a.sku.localeCompare(b.sku, 'es', { numeric: true }));
  const iguales = mismos(vs, p => [p.precios, costos[p.sku]?.costo ?? null]);
  const oferta = vs.find(p => p.oferta?.activa)?.oferta;
  const compartida = g.id_imagen ? Object.values(ctx.productos).filter(p => p.activo !== false && p.id_imagen === g.id_imagen).length : 0;
  const cont = h('div', { class: 'pila detalle-grupo' },
    h('div', { class: 'foto-grupo' }, miniatura(g, 'miniatura'),
      h('span', { class: 'nota' }, g.id_imagen ? `Código de imagen ${g.id_imagen}${compartida > 1 ? ` · la comparten ${compartida} productos` : ''}${g.foto ? '' : ' · sin foto'}` : 'Sin código de imagen: sincroniza el inventario para traerlo')),
    oferta ? h('span', { class: 'est y' }, `Oferta ${oferta.pct}%`) : null,
    iguales ? h('div', { class: 'pila' }, h('div', { class: 'sec-m' }, 'Precio por cantidad'), bloquePrecios(ctx, vs[0], costos[vs[0].sku]?.costo, verCostos)) : null,
    h('div', { class: 'sec-m' }, 'TALLAS'),
    vs.map(p => h('div', { class: 'talla-fila', 'data-sku': p.sku },
      h('div', { class: 'tf-info' },
        h('div', { class: 'var-cab' }, h('b', {}, p.talla ? `Talla ${p.talla}` : 'Talla única'), h('span', { class: `est ${colorExistencia(p)}` }, `${p.existencia} disp.`)),
        h('span', { class: 'nota' }, p.codigo ? `Código ${p.codigo}` : p.sku),
        iguales ? null : bloquePrecios(ctx, p, costos[p.sku]?.costo, verCostos)),
      verCostos || puedeAdmin(ctx, 'ajustarInventario') ? h('div', { class: 'acciones' },
        verCostos ? h('button', { class: 'btn', 'aria-label': `Historial talla ${p.talla}`, onclick: () => abrirHistorial(ctx, p) }, icono('historial'), 'Historial') : null,
        puedeAdmin(ctx, 'ajustarInventario') ? h('button', { class: 'btn', onclick: () => abrirAjuste(ctx, p) }, icono('caja'), 'Ajustar') : null) : null)));
  const acciones = puedeAdmin(ctx, 'ofertas') || puedeAdmin(ctx, 'fotosMasivas') ? h('div', { class: 'acciones' },
    puedeAdmin(ctx, 'fotosMasivas') && g.id_imagen ? botonFoto(ctx, g, cont) : null,
    puedeAdmin(ctx, 'ofertas') ? h('button', { class: 'btn', onclick: () => abrirOferta(ctx, g) }, icono('etiqueta'), 'Oferta') : null) : null;
  abrirVentana({ titulo: `${g.titulo}${detalle(g) ? ' · ' + detalle(g) : ''}`, contenido: cont, acciones });
}

// Sincronizar inventario (solo cuando el administrador lo pulsa): descarga el inventario.json de la
// Carga Masiva, muestra la vista previa y únicamente al «Aplicar cambios» guarda (upsert por sku).
const fechaHoraCorta = iso => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?\s?m\.?/i, ' $1m');
function haceCuanto(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (!Number.isFinite(min) || min < 0) return '';
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} ${Math.round(horas / 24) === 1 ? 'día' : 'días'}`;
}

async function abrirSincronizar(ctx, costos, alTerminar) {
  const cuerpo = h('div', { class: 'pila sinc' }, h('p', { class: 'nota' }, 'Descargando el inventario de la Carga Masiva…'));
  const aplicar = h('button', { class: 'btn primary', id: 'sinc-aplicar', disabled: true }, icono('check'), 'Aplicar cambios');
  const cancelar = h('button', { class: 'btn', id: 'sinc-cancelar' }, 'Cancelar');
  const v = abrirVentana({ titulo: 'Sincronizar inventario', contenido: cuerpo, acciones: h('div', { class: 'acciones' }, cancelar, aplicar) });
  cancelar.onclick = () => v.cerrar();
  const fallo = texto => cuerpo.replaceChildren(h('div', { class: 'aviso' }, icono('alerta'), texto), h('p', { class: 'nota' }, 'No se cambió nada en el punto de venta.'));

  let json;
  try {
    if (!navigator.onLine) throw Object.assign(new Error(), { motivo: 'red' });
    const r = await fetch(`${URL_INVENTARIO}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error(), { motivo: `http ${r.status}` });
    try { json = await r.json(); } catch { throw Object.assign(new Error(), { motivo: 'json' }); }
  } catch (e) {
    fallo(e.motivo === 'red' || !e.motivo ? 'Sin conexión: no se pudo descargar el inventario de la Carga Masiva. Revisa el internet e inténtalo de nuevo.'
      : e.motivo === 'json' ? 'El archivo publicado no es un inventario válido (no se pudo leer).'
      : `No se pudo descargar el inventario (respuesta ${e.motivo.replace('http ', '')}). Inténtalo más tarde.`);
    return;
  }

  const { productos, errores, avisos, filas } = leerInventario(json);
  if (!productos.length && errores.length && errores[0].fila === 0) { fallo(errores[0].motivo + '. Publícalo de nuevo desde la Carga Masiva.'); return; }
  const plan = planImportacion(productos, ctx.productos, costos);
  const fila = (n, txt, cls) => h('div', { class: `resumen-imp ${cls}` }, h('b', { class: 'num' }, String(n)), txt);
  const conExist = h('input', { type: 'checkbox', id: 'sinc-existencia' });
  const pintarBoton = () => { aplicar.disabled = !plan.nuevos.length && !plan.cambios.length && !(conExist.checked && plan.existencias.length); };
  conExist.addEventListener('change', pintarBoton);
  const actualizados = plan.cambios.slice(0, 200).map(c => h('div', { class: 'sinc-cambio' }, h('b', {}, c.sku),
    ...detalleCambios(c, ctx.productos[c.sku], costos[c.sku]?.costo ?? null).map(t => h('span', {}, t))));
  cuerpo.replaceChildren(...sin(
    h('p', { class: 'nota sinc-fecha' }, json?.at ? `Archivo del ${fechaHoraCorta(json.at)} (${haceCuanto(json.at)}) · ${filas} filas` : `${filas} filas`),
    h('div', { class: 'resumenes' },
      fila(plan.nuevos.length, plan.nuevos.length === 1 ? 'nuevo' : 'nuevos', 'g'),
      fila(plan.cambios.length, plan.cambios.length === 1 ? 'actualizado' : 'actualizados', 'b'),
      fila(plan.iguales.length, 'sin cambios', 'n'),
      fila(errores.length, errores.length === 1 ? 'con error' : 'con errores', errores.length ? 'r' : 'n')),
    h('label', { class: 'check sinc-check' }, conExist, h('span', {}, h('b', {}, 'Actualizar también existencia'),
      h('span', { class: 'nota' }, plan.existencias.length
        ? `${plural(plan.existencias.length, 'producto que ya existe tiene', 'productos que ya existen tienen')} otra existencia en el archivo. Si no lo marcas, conservan la del punto de venta (con las ventas ya descontadas). Los nuevos siempre toman la del archivo.`
        : 'Las existencias del archivo coinciden con las del punto de venta. Los nuevos toman la del archivo.'))),
    plan.faltantes.length ? h('div', { class: 'aviso' }, icono('alerta'), `${plural(plan.faltantes.length, 'producto del punto de venta no viene', 'productos del punto de venta no vienen')} en el archivo. No se borran.`) : null,
    ...avisos.map(a => h('div', { class: 'aviso' }, icono('alerta'), a)),
    plan.cambios.length ? h('details', { class: 'sinc-lista' }, h('summary', {}, `Ver qué cambia en los actualizados (${plan.cambios.length})`),
      h('div', { class: 'pila' }, ...actualizados, plan.cambios.length > 200 ? h('p', { class: 'nota' }, `Y ${plan.cambios.length - 200} más.`) : null)) : null,
    errores.length ? h('details', { class: 'sinc-lista imp-errores', open: true }, h('summary', {}, `Filas con error (${errores.length}): no se aplican`),
      h('div', { class: 'pila' }, ...errores.slice(0, 200).map(e => h('div', { class: 'sinc-cambio' }, h('b', {}, `Fila ${e.fila}${e.sku ? ' · ' + e.sku : ''}`), h('span', {}, e.motivo))))) : null));
  pintarBoton();

  aplicar.addEventListener('click', unaVez(aplicar, async () => {
    aplicar.replaceChildren(icono('check'), 'Aplicando…');
    const conExistencias = conExist.checked;
    const r = await ctx.almacen.aplicarImportacion(plan, { existencias: conExistencias });
    if (!r.ok) { aplicar.replaceChildren(icono('check'), 'Aplicar cambios'); toast(r.error === 'permiso' ? 'Firebase no dio permiso para guardar' : 'No se pudo sincronizar. No se cambió nada.', { malo: true }); return; }
    const cuando = new Date().toISOString();
    await ctx.almacen.guardarAjustes('general', { ultimaSincronizacion: cuando, archivoSincronizado: json.at || null });
    v.cerrar();
    toast(`Inventario sincronizado: ${plan.nuevos.length} nuevos · ${plan.cambios.length} actualizados${conExistencias && plan.existencias.length ? ` · ${plan.existencias.length} existencias` : ''}`);
    alTerminar && alTerminar(cuando);
  }));
}

// Sube una foto ya comprimida a su código de imagen (una sola para todas sus variantes).
// Si falta el token de GitHub lo pide una vez.
async function subirFoto(ctx, codigo, blob) {
  const subir = () => ctx.almacen.guardarImagen(codigo, blob);
  let r = await subir();
  if (!r.ok && r.error === 'token') {
    const token = await pedirMotivo({ titulo: 'Token de GitHub', etiqueta: 'Pega el token para subir fotos (se guarda solo en este navegador)', boton: 'Guardar token' });
    if (!token) return { ok: false, error: 'cancelado' };
    try { localStorage.setItem(CLAVE_TOKEN, token.trim()); } catch { /* sin almacenamiento */ }
    r = await subir();
  }
  return r;
}

// Cuántos productos ya muestran foto y qué códigos de imagen todavía no tienen una subida.
export function resumenFotos(productos, imagenes = {}) {
  const activos = Object.values(productos).filter(p => p.activo !== false);
  const codigos = [...new Set(activos.map(p => p.id_imagen).filter(Boolean))].sort();
  return { total: activos.length, conFoto: activos.filter(p => fotoDe(p, imagenes)).length, codigos, sinFoto: codigos.filter(c => !imagenes[c]) };
}
const textoResumen = r => `${r.conFoto} de ${r.total} productos con foto · ${plural(r.sinFoto.length, 'código de imagen sin foto', 'códigos de imagen sin foto')}`;

function abrirFotos(ctx) {
  // Cada archivo se llama como su código de imagen (img-0001.jpg): esa foto la muestran todas las
  // prendas con ese código.
  const activos = Object.values(ctx.productos).filter(p => p.activo !== false);
  const { codigos } = resumenFotos(ctx.productos, ctx.imagenes);
  const deCodigo = c => activos.filter(p => p.id_imagen === c);
  const etiquetaCodigo = c => { const ps = deCodigo(c), p = ps[0]; return `${c} — ${titulo(p)}${p.color ? ' · ' + p.color : ''}${ps.length > 1 ? ` (${ps.length} productos)` : ''}${ctx.imagenes?.[c] ? ' · ya tiene foto' : ''}`; };
  let archivos = [], res = { asignadas: [], sinAsignar: [] }, manual = {};
  const resumen = h('p', { class: 'nota', id: 'fotos-resumen' });
  const pintarResumen = () => { resumen.textContent = textoResumen(resumenFotos(ctx.productos, ctx.imagenes)); };
  const entrada = h('input', { type: 'file', id: 'fotos-archivos', multiple: true, accept: 'image/*', class: 'sr' });
  const zona = h('label', { class: 'zona-fotos', for: 'fotos-archivos' }, icono('imagen'), h('b', {}, 'Arrastra aquí las fotos o toca para elegirlas'),
    h('span', { class: 'nota' }, 'Nombra cada archivo con su código de imagen, por ejemplo img-0001.jpg. Una foto sirve para todas las prendas con ese código.'));
  // Productos cargados antes de la v1.73 no traen id_imagen: hay que sincronizar para recibir los códigos.
  const sinCodigos = codigos.length ? null : h('div', { class: 'aviso', id: 'fotos-sin-codigos' }, icono('alerta'), 'Los productos todavía no tienen código de imagen. Pulsa «Sincronizar inventario» para traerlos de la Carga Masiva.');
  const info = h('div', { class: 'pila' });
  const b = h('button', { class: 'btn primary', id: 'fotos-final', disabled: true }, icono('subir'), 'Subir fotos');
  const pintar = () => {
    res = emparejarFotos(archivos.map(f => f.name), codigos);
    const productosCubiertos = res.asignadas.reduce((n, a) => n + deCodigo(a.codigo).length, 0);
    info.replaceChildren(...sin(
      archivos.length ? h('p', { class: 'nota', id: 'fotos-asignadas' }, `${plural(res.asignadas.length, 'foto asignada', 'fotos asignadas')} a ${plural(productosCubiertos, 'producto', 'productos')} · ${res.sinAsignar.length} sin asignar`) : null,
      res.sinAsignar.length ? h('div', { class: 'sin-asignar pila' }, ...res.sinAsignar.map(n => h('div', { class: 'campo' }, h('label', {}, n),
        h('select', { class: 'inp', onchange: e => { manual[n] = e.target.value; } },
          h('option', { value: '' }, 'Elegir el código de imagen…'),
          ...codigos.map(c => h('option', { value: c }, etiquetaCodigo(c))))))) : null));
    b.disabled = !archivos.length;
  };
  const cargar = fs => { archivos = [...fs].filter(f => f.type.startsWith('image/')); manual = {}; pintar(); };
  entrada.addEventListener('change', () => cargar(entrada.files));
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('encima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('encima'); cargar(e.dataTransfer.files); });
  pintarResumen();
  const v = abrirVentana({ titulo: 'Fotos de productos', contenido: h('div', { class: 'pila' }, ...sin(resumen, sinCodigos, entrada, zona, info)), acciones: h('div', { class: 'acciones' }, b) });
  b.addEventListener('click', async () => {
    const elegidas = Object.entries(manual).filter(([, c]) => c).map(([archivo, codigo]) => ({ archivo, codigo }));
    const tareas = [...res.asignadas, ...elegidas];
    if (!tareas.length) { toast('No hay fotos asignadas'); return; }
    b.disabled = true;
    let hechas = 0;
    for (const t of tareas) {
      b.textContent = `Subiendo ${hechas + 1} de ${tareas.length}…`;
      const blob = await comprimirFoto(archivos.find(f => f.name === t.archivo));
      const r = await subirFoto(ctx, t.codigo, blob);
      if (!r.ok) { if (r.error !== 'cancelado') toast(`No se pudo subir ${t.archivo}`, { malo: true }); break; }
      hechas++;
    }
    v.cerrar();
    toast(`${plural(hechas, 'foto subida', 'fotos subidas')} · ${textoResumen(resumenFotos(ctx.productos, ctx.imagenes))}`);
  });
}

registrarVista('/inventario', {
  montar(cont, ctx) {
    let busqueda = '', costos = {}, filtro = '', genero = '';
    const ESTADOS = [['', 'Todos'], ['bajo', 'Stock bajo'], ['agotado', 'Agotados']];
    const filtros = h('div', { class: 'filtros filtro-inv', role: 'group', 'aria-label': 'Filtrar inventario' });
    const buscar = h('input', { class: 'inp', id: 'buscar-inv', type: 'search', 'aria-label': 'Buscar prenda o código', placeholder: 'Buscar prenda o código', autocomplete: 'off' });
    const lista = h('div', { class: 'lista-inv' });
    const pintar = () => {
      const q = norm(busqueda);
      const todos = grupos(ctx.productos, ctx.imagenes);
      const estadoDe = g => (g.variantes.some(p => colorExistencia(p) === 'r') ? 'agotado' : g.variantes.some(p => colorExistencia(p) === 'y') ? 'bajo' : '');
      const generos = [...new Set(todos.map(g => g.genero).filter(Boolean))].sort();
      const cuenta = k => todos.filter(g => (k === 'bajo' ? estadoDe(g) !== '' : estadoDe(g) === k)).length;
      filtros.replaceChildren(
        ...ESTADOS.map(([k, t]) => h('button', { type: 'button', class: 'chip' + (k === filtro ? ' activo' : ''), 'data-filtro': k || 'todos', 'aria-pressed': String(k === filtro), onclick: () => { filtro = k; pintar(); } }, t, k ? h('span', { class: 'cuenta' }, String(cuenta(k))) : null)),
        generos.length > 1 ? h('span', { class: 'filtros-sep', 'aria-hidden': 'true' }) : null,
        ...(generos.length > 1 ? generos.map(c => h('button', { type: 'button', class: 'chip' + (c === genero ? ' activo' : ''), 'aria-pressed': String(c === genero), onclick: () => { genero = c === genero ? '' : c; pintar(); } }, c)) : []));
      const gs = todos.filter(g => (!q || g.variantes.some(p => norm(textoBusqueda(p)).includes(q)))
        && (!filtro || (filtro === 'bajo' ? estadoDe(g) !== '' : estadoDe(g) === filtro))
        && (!genero || g.genero === genero));
      lista.replaceChildren(...(gs.length ? gs.map(g => {
        const total = g.variantes.reduce((s, p) => s + p.existencia, 0);
        const pocas = g.variantes.some(p => colorExistencia(p) === 'y');
        const agotadas = g.variantes.some(p => colorExistencia(p) === 'r');
        const est = agotadas && total <= 0 ? ['r', 'Agotado'] : agotadas || pocas ? ['y', 'Stock bajo'] : ['g', 'En stock'];
        const color = colorPrenda(g.color);
        return h('button', { class: 'grupo-inv', 'data-grupo': g.grupo, 'data-nombre': [g.titulo, g.color].filter(Boolean).join(' '), onclick: () => abrirGrupo(ctx, g, costos) },
          miniatura(g, 'miniatura'),
          h('span', { class: 'gi-info' }, h('b', {}, g.titulo),
            h('span', { class: 'gi-linea' }, g.color ? h('span', { class: 'gi-color' }, h('i', { class: 'punto-color', style: color ? `--pc:${color}` : '' }), g.color) : null,
              h('span', {}, `${g.variantes.length} ${g.variantes.length === 1 ? 'talla' : 'tallas'}`)),
            h('span', { class: 'gi-salud', 'aria-hidden': 'true' }, ...g.variantes.map(p => h('i', { class: colorExistencia(p) })))),
          h('span', { class: 'gi-total' }, h('b', { class: 'num' }, String(total)),
            // Con aviso, la pastilla ocupa el lugar de «unidades»: todas las tarjetas miden lo mismo.
            est[0] === 'g' ? h('span', {}, total === 1 ? 'unidad' : 'unidades') : h('span', { class: `est ${est[0]}` }, h('span', { class: 'sr' }, `${total === 1 ? 'unidad' : 'unidades'}, `), est[1])));
      }) : [h('div', { class: 'vacio' }, busqueda || filtro || genero ? 'No hay prendas con ese filtro' : 'Todavía no hay productos')]));
    };
    buscar.addEventListener('input', () => { busqueda = buscar.value; pintar(); });
    // «Última sincronización» junto al botón (se guarda en Ajustes, así la ven todos los equipos del administrador).
    const ultima = h('span', { class: 'nota sinc-ultima', id: 'sinc-ultima' });
    const pintarUltima = (f = ctx.ajustes?.ultimaSincronizacion) => { ultima.textContent = f ? `Última sincronización: ${fechaHoraCorta(f)}` : 'Aún no se ha sincronizado'; };
    pintarUltima();
    const quitar = ctx.almacen.escuchar('costos', l => { costos = Object.fromEntries(l.map(c => [c.sku, c])); pintar(); });
    const alDatos = e => { if (e.detail.que === 'productos') pintar(); if (e.detail.que === 'ajustes') { pintarUltima(); pintar(); } };
    window.addEventListener('pos:datos', alDatos);
    cont.append(...sin(
      h('div', { class: 'cab-vista' },
        h('div', { class: 'acciones' },
          puedeAdmin(ctx, 'fotosMasivas') ? h('button', { class: 'btn', onclick: () => abrirFotos(ctx) }, icono('imagen'), 'Fotos') : null,
          puedeAdmin(ctx, 'importar') ? h('div', { class: 'sinc-acc' },
            h('button', { class: 'btn primary', id: 'sinc-abrir', onclick: () => abrirSincronizar(ctx, costos, pintarUltima) }, icono('actualizar'), 'Sincronizar inventario'),
            ultima) : null)),
      h('div', { class: 'buscar-caja' }, icono('buscar'), buscar),
      filtros,
      lista));
    pintar();
    return () => { quitar(); window.removeEventListener('pos:datos', alDatos); };
  },
});
