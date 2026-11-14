// Inventario (§7): consulta con la apariencia de la app «Stock, Comic Shop», escáner, ajustes con motivo,
// ofertas, sincronizar con la Carga Masiva y fotos por código de imagen.
import { h, icono, abrirVentana, abrirCapaPropia, abrirMenu, toast, esTelefono, pedirMotivo, sin, unaVez } from '../ui.js';
import { titulo, grupoDe, detalle, textoBusqueda, fotoDe, nombreVariante } from '../nucleo/producto.js';
import { abrirEscaner } from './escaner.js';
import { compararTallas } from '../nucleo/tipo-prenda.js';
import { registrarVista } from '../app.js';
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
    h('p', { class: 'nota sinc-ultima-v' }, ctx.ajustes?.ultimaSincronizacion ? `Última sincronización: ${fechaHoraCorta(ctx.ajustes.ultimaSincronizacion)} (${haceCuanto(ctx.ajustes.ultimaSincronizacion)})` : 'Todavía no se ha sincronizado'),
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

// ===================== Vista: copia de la app «Stock, Comic Shop» =====================
// Misma estructura, medidas y animaciones que movil/index.html (v14) de kdnaskrlos/App-Inventario,
// con los datos, el buscador y los permisos del POS. Estilos en css/stock.css (todo dentro de .stk).

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = n => { const r = Math.round((Number(n) || 0) * 100) / 100; return r.toLocaleString('es-VE', { maximumFractionDigits: 2 }); };
const st = p => (p.existencia <= 0 ? 'out' : p.existencia <= (p.minimo || 0) ? 'low' : 'ok');
const checkDigit = b => { let s = 0; for (let i = 0; i < 12; i++) s += (+b[i]) * (i % 2 ? 3 : 1); return (10 - (s % 10)) % 10; };
// Siempre en claro, como el resto del POS (sin selector de tema).
const TEMA = 'light';
try { localStorage.removeItem('pos.temaInventario'); } catch { /* sin almacenamiento */ }

const SVG = {
  sync: '<svg viewBox="0 0 24 24"><path d="M20.5 12a8.5 8.5 0 0 1-14.7 5.8L3.5 15.5"/><path d="M3.5 12a8.5 8.5 0 0 1 14.7-5.8l2.3 2.3"/><path d="M20.5 3.5v5h-5M3.5 20.5v-5h5"/></svg>',
  datos: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16M7 8v8M10.5 8v8M14 8v8M17 8v8"/></svg>',
  caja: '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
  alerta: '<svg viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  agotado: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  ir: '<svg viewBox="0 0 24 24" class="ti-ir"><path d="m9 6 6 6-6 6"/></svg>',
  imagen: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5L6.5 19.5"/></svg>',
};

// Busca por código de barras (también sin el dígito verificador o con un 0 delante) o por sku.
export function buscarCodigo(productos, raw) {
  const c = String(raw ?? '').trim().replace(/\s/g, ''); if (!c) return [];
  const dig = c.replace(/\D/g, '');
  const keys = new Set([c.toLowerCase()]);
  if (dig) { keys.add(dig); if (dig.length === 12) keys.add(dig + checkDigit(dig)); if (dig.length === 13 && dig[0] === '0') keys.add(dig.slice(1)); }
  return productos.filter(p => keys.has(String(p.codigo || '')) || keys.has(String(p.sku).toLowerCase()) || (p.codigo && p.codigo[0] === '0' && keys.has(p.codigo.slice(1))));
}

// Hoja inferior (bottom sheet) con la animación y el gesto de la app; Atrás/Escape la cierran sin salir del POS.
export function abrirHojaStock({ tema, llenar, clase = '' }) {
  const capa = document.createElement('div');
  capa.className = 'stk stk-capa' + (clase ? ' ' + clase : '');
  if (tema) capa.dataset.theme = tema;
  capa.innerHTML = '<div class="scrim" id="scrim"></div><section class="sheet" id="detail" role="dialog" aria-modal="true" aria-label="Detalle del producto"></section>';
  const sc = capa.querySelector('.scrim'), sh = capa.querySelector('.sheet');
  llenar(sh);
  const salir = () => {
    document.body.classList.remove('stk-lock');
    sc.classList.remove('on'); sc.style.opacity = ''; sh.classList.remove('in');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) capa.remove(); else setTimeout(() => capa.remove(), 340);
  };
  const { cerrar } = abrirCapaPropia(capa, salir);
  sh.scrollTop = 0; void sh.offsetHeight; sc.classList.add('on'); sh.classList.add('in'); document.body.classList.add('stk-lock');
  sc.addEventListener('click', cerrar);
  sh.addEventListener('click', e => { if (e.target.closest('[data-act="close"]')) cerrar(); });
  // Bajar la hoja con un gesto (copiado de swipeClose).
  let y0 = 0, dy = 0, off = 0, t0 = 0, on = false, can = false, raf = 0;
  const paint = () => { raf = 0; const d = Math.max(0, dy - off); sh.style.transform = `translate3d(0,${d}px,0)`; sc.style.opacity = String(Math.max(0, 1 - d / (sh.offsetHeight || 600))); };
  const release = () => { cancelAnimationFrame(raf); raf = 0; sh.classList.remove('drag'); sc.classList.remove('drag'); sh.style.transform = ''; sc.style.opacity = ''; };
  sh.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; off = 0; on = false; can = sh.scrollTop <= 0 || !!e.target.closest('.grab,.sh'); }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (!can) return; dy = e.touches[0].clientY - y0;
    if (!on) { if (dy > 8 && sh.scrollTop <= 0) { on = true; off = dy; sh.classList.add('drag'); sc.classList.add('drag'); } else if (dy < -4) { can = false; return; } else return; }
    e.preventDefault(); if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: false });
  const end = () => { if (!on) return; on = false; const d = dy - off, v = d / Math.max(1, Date.now() - t0); if (d > 110 || (d > 40 && v > 0.5)) { release(); cerrar(); } else release(); };
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', () => { if (on) { on = false; release(); } });
  return { cerrar, sh };
}


// Tarjeta de detalle del producto: la de la app, más la foto (si hay) y las acciones del POS.
function abrirDetalle(ctx, sku, costos, tema) {
  let hoja = null;
  const pintar = sh => {
    const p = ctx.productos[sku]; if (!p) return;
    const k = st(p), foto = fotoDe(p, ctx.imagenes);
    const kv = (a, b, m) => (b ? `<dt>${a}</dt><dd${m ? ' class="mono"' : ''}>${esc(b)}</dd>` : '');
    const pri = (p.precios || []).map((v, i) => ({ v, i })).filter(o => o.v || o.i === 0);
    const oferta = p.oferta?.activa ? ` <span class="oferta">· Oferta ${p.oferta.pct}%</span>` : '';
    const costo = costos[p.sku]?.costo;
    const verCostos = ctx.puedeVer('verCostos');
    sh.innerHTML = `<div class="grab"></div><div class="sh"><h2>${esc(nombreVariante(p))}</h2><button class="x" type="button" data-act="close" aria-label="Cerrar">×</button></div>
  <div class="mono muted" style="font-size:12.5px;margin-top:4px;overflow-wrap:anywhere">${esc(p.sku)}</div>
  ${foto ? `<div class="card fotocard"><img src="${esc(foto)}" alt="Foto de ${esc(titulo(p))}"></div>` : ''}
  <div class="card"><h3>Stock</h3><div class="big"><div class="stk ${k}"><b>${fmtN(p.existencia)}</b><span>${k === 'out' ? 'agotado' : k === 'low' ? 'stock bajo' : 'en total'}</span></div>
   <dl class="kv" style="flex:1"><dt>Existencia</dt><dd class="mono">${fmtN(p.existencia)}</dd><dt>Mínimo</dt><dd class="mono">${fmtN(p.minimo || 0)}</dd></dl></div></div>
  <div class="card"><h3>Precios${oferta}</h3><div class="prices">${pri.map(o => `<div><span>Precio ${o.i + 1}</span><b>${o.v ? fmtCop(o.v) : '—'}</b></div>`).join('')}</div></div>
  <div class="card"><h3>Ficha</h3><dl class="kv">${kv('Tipo', p.tipo)}${kv('Tela', p.tela)}${kv('Color', p.color)}${kv('Talla', p.talla)}${kv('Género', p.genero)}${kv('Marca', p.marca)}${kv('Modelo', p.modelo)}${kv('Código de imagen', p.id_imagen, true)}
   ${verCostos ? `<dt>Costo</dt><dd><button class="reveal" type="button" data-cost="${costo != null ? fmtCop(costo) : '—'}">Mostrar</button></dd>` : ''}</dl></div>
  <div class="card" id="det-acciones" hidden><h3>Acciones</h3><div class="acc"></div></div>`;
    const acc = sin(
      verCostos ? h('button', { class: 'sbtn', type: 'button', id: 'det-historial', onclick: () => abrirHistorial(ctx, p) }, 'Historial') : null,
      puedeAdmin(ctx, 'ajustarInventario') ? h('button', { class: 'sbtn', type: 'button', id: 'det-ajustar', onclick: () => abrirAjuste(ctx, p) }, 'Ajustar existencia') : null,
      null);
    if (acc.length) { sh.querySelector('#det-acciones').hidden = false; sh.querySelector('.acc').append(...acc); }
  };
  hoja = abrirHojaStock({ tema, llenar: pintar });
  hoja.sh.addEventListener('click', e => {
    const co = e.target.closest('[data-cost]'); if (co) { co.outerHTML = `<b class="mono">${esc(co.dataset.cost)}</b>`; }
  });
  return { repintar: () => pintar(hoja.sh), cerrar: hoja.cerrar, sh: hoja.sh, sku };
}

// Prendas: las variantes agrupadas como en Vender (tipo, tela, marca, género, modelo y color), con sus tallas
// en orden. Estado de la prenda: «out» si no queda ninguna unidad; «low» si alguna talla está en el mínimo o
// menos (o agotada); si no, «ok».
export function prendas(R) {
  const g = new Map();
  for (const p of R) { const k = grupoDe(p); let x = g.get(k); if (!x) g.set(k, x = { k, vs: [] }); x.vs.push(p); }
  for (const x of g.values()) {
    x.vs.sort((a, b) => compararTallas(a.talla || '', b.talla || '') || a.sku.localeCompare(b.sku));
    x.p = x.vs[0];
    x.total = x.vs.reduce((n, p) => n + Math.max(0, p.existencia), 0);
    x.st = x.vs.every(p => st(p) === 'out') ? 'out' : x.vs.some(p => st(p) !== 'ok') ? 'low' : 'ok';
    x.nombre = [titulo(x.p), x.p.color].filter(Boolean).join(' ');
    x.tallas = x.vs.map(p => p.talla).filter(Boolean);
  }
  return [...g.values()];
}
const unidades = x => (x.st === 'out' ? 'agotado' : x.st === 'low' ? `${fmtN(x.total)} uds · stock bajo` : `${fmtN(x.total)} uds`);

// Tarjeta de detalle de una prenda: stock total, sus tallas (cada una abre su detalle para ajustar o ver
// el historial), precios, ficha y acciones de la prenda (oferta y foto).
function abrirPrenda(ctx, clave, costos, tema, abrirTalla) {
  const pintar = sh => {
    const x = prendas(Object.values(ctx.productos).filter(p => p.activo !== false && grupoDe(p) === clave))[0];
    if (!x) return;
    const p = x.p, foto = fotoDe(p, ctx.imagenes);
    const kv = (a, b) => (b ? `<dt>${a}</dt><dd>${esc(b)}</dd>` : '');
    const pri = (p.precios || []).map((v, i) => ({ v, i })).filter(o => o.v || o.i === 0);
    const oferta = p.oferta?.activa ? ` <span class="oferta">· Oferta ${p.oferta.pct}%</span>` : '';
    const verCostos = ctx.puedeVer('verCostos'), costo = costos[p.sku]?.costo;
    sh.innerHTML = `<div class="grab"></div><div class="sh"><h2>${esc(x.nombre)}</h2><button class="x" type="button" data-act="close" aria-label="Cerrar">×</button></div>
  <div class="muted" style="font-size:12.5px;margin-top:4px">${esc([p.tela, `${x.vs.length} ${x.vs.length === 1 ? 'talla' : 'tallas'}`].filter(Boolean).join(' · '))}</div>
  ${foto ? `<div class="card fotocard"><img src="${esc(foto)}" alt="Foto de ${esc(x.nombre)}"></div>` : ''}
  <div class="card"><h3>Stock</h3><div class="big"><div class="stk ${x.st}"><b>${fmtN(x.total)}</b><span>${x.st === 'out' ? 'agotado' : x.st === 'low' ? 'stock bajo' : 'en total'}</span></div>
   <dl class="kv" style="flex:1"><dt>Unidades</dt><dd class="mono">${fmtN(x.total)}</dd><dt>Tallas</dt><dd class="mono">${x.vs.length}</dd></dl></div></div>
  <div class="card"><h3>Tallas</h3><div class="tallas-inv">${x.vs.map(v => { const k = st(v); return `<button type="button" class="talla-inv" data-sku="${esc(v.sku)}"><span class="ti-t"><b>${esc(v.talla ? 'Talla ' + v.talla : 'Talla única')}</b><span>${esc(v.sku)}</span></span><span class="ti-u ${k}"><b>${k === 'out' ? 'Agotada' : fmtN(v.existencia) + ' uds'}</b><span>mín. ${fmtN(v.minimo || 0)}</span></span>${SVG.ir}</button>`; }).join('')}</div></div>
  <div class="card"><h3>Precios${oferta}</h3><div class="prices">${pri.map(o => `<div><span>Precio ${o.i + 1}</span><b>${o.v ? fmtCop(o.v) : '—'}</b></div>`).join('')}</div></div>
  <div class="card"><h3>Ficha</h3><dl class="kv">${kv('Tipo', p.tipo)}${kv('Tela', p.tela)}${kv('Color', p.color)}${kv('Género', p.genero)}${kv('Marca', p.marca)}${kv('Modelo', p.modelo)}${kv('Código de imagen', p.id_imagen)}
   ${verCostos ? `<dt>Costo</dt><dd><button class="reveal" type="button" data-cost="${costo != null ? fmtCop(costo) : '—'}">Mostrar</button></dd>` : ''}</dl></div>
  <div class="card" id="prenda-acciones" hidden><h3>Acciones</h3><div class="acc"></div></div>`;
    const g = { grupo: clave, titulo: titulo(p), color: p.color, tela: p.tela, variantes: x.vs, id_imagen: p.id_imagen, foto };
    const acc = sin(
      puedeAdmin(ctx, 'ofertas') ? h('button', { class: 'sbtn', type: 'button', id: 'det-oferta', onclick: () => abrirOferta(ctx, g) }, 'Oferta') : null,
      puedeAdmin(ctx, 'fotosMasivas') && p.id_imagen ? botonFotoCodigo(ctx, p.id_imagen, !!foto) : null);
    if (acc.length) { sh.querySelector('#prenda-acciones').hidden = false; sh.querySelector('.acc').append(...acc); }
  };
  const hoja = abrirHojaStock({ tema, llenar: pintar });
  hoja.sh.addEventListener('click', e => {
    const t = e.target.closest('.talla-inv'); if (t) { abrirTalla(t.dataset.sku); return; }
    const co = e.target.closest('[data-cost]'); if (co) { co.outerHTML = `<b class="mono">${esc(co.dataset.cost)}</b>`; }
  });
  return { repintar: () => pintar(hoja.sh), cerrar: hoja.cerrar, sh: hoja.sh };
}

// «Foto» / «Cambiar foto»: se sube una sola vez al código de imagen y la muestran todas sus variantes.
function botonFotoCodigo(ctx, codigo, tiene) {
  const entrada = h('input', { type: 'file', accept: 'image/*', hidden: true, id: 'foto-codigo-archivo' });
  const b = h('button', { class: 'sbtn', type: 'button', id: 'foto-codigo', onclick: () => entrada.click() }, tiene ? 'Cambiar foto' : 'Subir foto');
  entrada.addEventListener('change', async () => {
    const f = entrada.files[0]; if (!f) return;
    b.disabled = true; b.textContent = 'Subiendo…';
    const r = await subirFoto(ctx, codigo, await comprimirFoto(f));
    entrada.value = ''; b.disabled = false; b.textContent = r.ok ? 'Cambiar foto' : tiene ? 'Cambiar foto' : 'Subir foto';
    if (!r.ok) { if (r.error !== 'cancelado') toast('No se pudo subir la foto', { malo: true }); return; }
    toast(`Foto guardada para ${codigo}`);
  });
  return h('span', { style: 'display:contents' }, entrada, b);
}

registrarVista('/inventario', {
  montar(cont, ctx) {
    cont.classList.add('stk', 'stk-vista');
    cont.dataset.theme = TEMA;
    // Sin barra de desplazamiento visible mientras se ve el inventario (se sigue desplazando igual).
    document.documentElement.classList.add('stk-sin-barra');
    let costos = {}; const abiertas = new Set();
    const F = { q: '', st: 'all', cat: '', brand: '', sort: 'name', shown: 80 };
    const admSinc = puedeAdmin(ctx, 'importar'), admFotos = puedeAdmin(ctx, 'fotosMasivas');
    cont.innerHTML = `<div class="wrap">
  <header class="top${admSinc || admFotos ? ' con-adm' : ''}">
    <div class="seg" id="seg" role="group" aria-label="Estado del stock"></div>
    <div class="search">
      <div class="f"><input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Nombre, SKU o código" aria-label="Buscar por nombre, SKU o código"><button class="clr" id="qc" type="button" aria-label="Borrar búsqueda" hidden>×</button></div>
      <button class="scanbtn" id="bScan" type="button" aria-label="Escanear código de barras">${SVG.scan}</button>
    </div>
    <div class="filters">
      <button type="button" class="chip filtro-menu" id="fCat" aria-haspopup="listbox"></button>
      <button type="button" class="chip filtro-menu" id="fBrand" aria-haspopup="listbox"></button>
      <button type="button" class="chip filtro-menu" id="fSt" aria-haspopup="listbox"></button>
    </div>
    ${admSinc || admFotos ? `<div class="adm">
      ${admFotos ? `<button class="sbtn" id="bData" type="button">${SVG.datos}<span>Fotos</span></button>` : ''}
      ${admSinc ? `<button class="sbtn primary" id="bSync" type="button" title="Sincronizar inventario con la Carga Masiva">${SVG.sync}<span>Sincronizar</span></button>` : ''}
    </div>` : ''}
  </header>
  <main>
    <ul class="list" id="list"></ul>
    <button class="more" id="more" type="button" hidden></button>
    <section class="empty" id="empty" hidden></section>
  </main>
</div>`;
    const $ = s => cont.querySelector(s);
    const filas = () => Object.values(ctx.productos).filter(p => p.activo !== false);
    // Filtros Género / Marca / Stock: botones como los filtros del resto de la app; al tocarlos abren un menú
    // propio. Con un valor elegido el botón se marca y muestra ese valor.
    const ESTADOS = [['all', 'Todos'], ['low', 'Stock bajo'], ['out', 'Agotados']];
    let opGenero = [], opMarca = [];
    const chev = '<svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    const pintarFiltros = () => {
      const poner = (id, nombre, valor) => { const b = $(id); b.classList.toggle('activo', !!valor); b.innerHTML = `<span>${esc(valor || nombre)}</span>${chev}`; b.setAttribute('aria-label', `${nombre}: ${valor || 'todos'}`); };
      poner('#fCat', 'Género', F.cat); poner('#fBrand', 'Marca', F.brand); poner('#fSt', 'Stock', F.st === 'all' ? '' : ESTADOS.find(e => e[0] === F.st)[1]);
    };
    const build = () => {
      const R = filas(), orden = xs => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
      opGenero = orden(R.map(p => p.genero)); opMarca = orden(R.map(p => p.marca));
      pintarFiltros();
    };
    // Filtra prendas: una prenda entra si alguna de sus tallas coincide con la búsqueda.
    const filtered = G => {
      const terms = norm(F.q).split(/\s+/).filter(Boolean);
      const a = G.filter(x => {
        if (F.st !== 'all' && x.st !== F.st) return false; if (F.cat && x.p.genero !== F.cat) return false; if (F.brand && x.p.marca !== F.brand) return false;
        if (!terms.length) return true; return x.vs.some(p => { const t = norm(textoBusqueda(p)); return terms.every(w => t.includes(w)); });
      });
      const nm = x => x.nombre;
      const cmp = { name: (x, y) => nm(x).localeCompare(nm(y), 'es', { numeric: true }), sku: (x, y) => x.p.sku.localeCompare(y.p.sku, 'es', { numeric: true }), lo: (x, y) => x.total - y.total || nm(x).localeCompare(nm(y), 'es'), hi: (x, y) => y.total - x.total || nm(x).localeCompare(nm(y), 'es') }[F.sort];
      return a.sort(cmp);
    };
    const render = () => {
      const R = filas(), has = R.length > 0, G = prendas(R);
      const low = G.filter(x => x.st === 'low').length, out = G.filter(x => x.st === 'out').length;
      const seg = [['all', 'Todos', G.length, '', SVG.caja], ['low', 'Stock bajo', low, 'w', SVG.alerta], ['out', 'Agotados', out, 'x', SVG.agotado]];
      // Solo informativas (filtrar es con «Stock»).
      $('#seg').innerHTML = seg.map(([, l, n, c]) => `<div class="tj ${c}"><b>${fmtN(n)}</b><span>${l}</span></div>`).join('');
      $('#qc').hidden = !F.q;
      const list = has ? filtered(G) : [], part = list.slice(0, F.shown);
      $('#list').innerHTML = part.map(x => {
        const p = x.p, foto = fotoDe(p, ctx.imagenes);
        // Tarjeta: foto a la izquierda; nombre y unidades; estado arriba a la derecha y precio abajo a la derecha.
        const estado = x.st === 'out' ? 'Agotado' : x.st === 'low' ? 'Stock bajo' : 'En stock';
        return `<li><button type="button" class="item item-prenda" data-grupo="${esc(x.k)}" data-skus="${esc(x.vs.map(v => v.sku).join(' '))}"><div class="foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" width="58" height="58">` : SVG.imagen}</div><div class="tx"><div class="nm">${esc(x.nombre || '(sin nombre)')}</div><div class="uds">${fmtN(x.total)} ${x.total === 1 ? 'unidad' : 'unidades'}</div></div><div class="der"><span class="est-p ${x.st}">${estado}</span><b class="precio">${p.precios?.[0] ? fmtCop(p.precios[0]) : '—'}</b></div></button></li>`;
      }).join('');
      const m = $('#more'); m.hidden = list.length <= part.length; m.textContent = `Mostrar ${Math.min(100, list.length - part.length)} más`;
      const f = ctx.ajustes?.ultimaSincronizacion;
      // La fecha de la última sincronización va en el botón Sincronizar (al pasar el ratón) y en su ventana.
      const bs = cont.querySelector('#bSync'); if (bs) bs.title = f ? `Última sincronización: ${fechaHoraCorta(f)}` : 'Sincronizar inventario con la Carga Masiva';
      const e = $('#empty'); e.hidden = has;
      if (!has) e.innerHTML = `<p class="muted" style="margin:0;text-align:center">Sin inventario.${admSinc ? ' Toca el icono de arriba a la derecha para sincronizarlo.' : ''}</p>`;
      else if (!list.length) $('#list').innerHTML = '<li class="muted" style="padding:18px 4px">Nada coincide con esos filtros.</li>';
      cont.querySelector('.search').style.opacity = has ? 1 : 0.55;
    };
    const seguir = d => { abiertas.add(d); const c = d.cerrar; d.cerrar = () => { abiertas.delete(d); c(); }; return d; };
    const abrir = sku => seguir(abrirDetalle(ctx, sku, costos, TEMA));
    const abrirGrupo = clave => seguir(abrirPrenda(ctx, clave, costos, TEMA, abrir));
    // Código leído o escrito: un producto → su detalle; varios → filtra la lista.
    const lookup = (raw, desdeBuscador) => {
      const hit = buscarCodigo(filas(), raw);
      if (hit.length === 1) { abrir(hit[0].sku); return true; }
      if (hit.length > 1) { F.q = String(raw).trim(); F.shown = 80; $('#q').value = F.q; render(); toast(`${hit.length} productos comparten ese código`); return true; }
      if (desdeBuscador) toast('No encontré ese código');
      return false;
    };

    cont.addEventListener('click', e => {
      const t = e.target;
      const it = t.closest('.item'); if (it) { abrirGrupo(it.dataset.grupo); return; }
    });
    $('#more').onclick = () => { F.shown += 100; render(); };
    let qt;
    $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { F.q = e.target.value; F.shown = 80; render(); }, 120); });
    $('#q').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); clearTimeout(qt); F.q = e.target.value; const v = e.target.value.trim();
      if (/^\d{8,14}$/.test(v) || (/^[A-Za-z0-9_.-]+$/.test(v) && filas().some(p => p.sku.toLowerCase() === v.toLowerCase()))) lookup(v, true); else render();
      e.target.blur();
    });
    $('#qc').onclick = () => { F.q = ''; $('#q').value = ''; render(); $('#q').focus(); };
    const menu = (id, titulo, opciones, actual, poner) => { $(id).onclick = e => abrirMenu(e.currentTarget, { titulo, opciones: opciones(), actual: actual(), alElegir: v => { poner(v); F.shown = 80; pintarFiltros(); render(); } }); };
    menu('#fCat', 'Género', () => [['', 'Todos'], ...opGenero.map(g => [g, g])], () => F.cat, v => { F.cat = v; });
    menu('#fBrand', 'Marca', () => [['', 'Todas'], ...opMarca.map(m => [m, m])], () => F.brand, v => { F.brand = v; });
    menu('#fSt', 'Stock', () => ESTADOS, () => F.st, v => { F.st = v; });
    $('#bScan').onclick = () => {
      if (!filas().length) { toast('Primero sincroniza el inventario'); return; }
      abrirEscaner({ tema: TEMA, alLeer: c => lookup(c, false) });
    };
    if (admSinc) $('#bSync').onclick = () => abrirSincronizar(ctx, costos, () => render());
    if (admFotos) $('#bData').onclick = () => abrirFotos(ctx);

    const quitar = ctx.almacen.escuchar('costos', l => { costos = Object.fromEntries(l.map(c => [c.sku, c])); });
    const alDatos = e => {
      if (!['productos', 'ajustes'].includes(e.detail.que)) return;
      if (e.detail.que === 'productos') build();
      render();
      if (document.body.contains(cont)) for (const d of abiertas) { if (!d.sh.isConnected) abiertas.delete(d); else d.repintar(); }
    };
    window.addEventListener('pos:datos', alDatos);
    build(); render();
    return () => { quitar(); window.removeEventListener('pos:datos', alDatos); document.documentElement.classList.remove('stk-sin-barra'); };
  },
});
