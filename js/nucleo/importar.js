// Importar el inventario.json que publica la Carga Masiva (kdnaskrlos/App-Inventario, data/inventario.json).
// Formato: { app: 'carga-masiva', v: 1, at, head: [...nombres de columna...], rows: [[...valores...], ...] }.
// Siempre se lee por el NOMBRE de la columna en `head` (nunca por posición) y las columnas desconocidas se ignoran.
// Columnas: sku, id_imagen, nombre, tipo, tela, color, talla, genero, marca, modelo, costo, precio1..precio5,
// separado, codigo, existencia, minimo. id_imagen («img-0001») lo comparten las tallas de una prenda (y a veces
// varias prendas): la foto se guarda una vez por código.

export const COLUMNAS = ['sku', 'id_imagen', 'nombre', 'tipo', 'tela', 'color', 'talla', 'genero', 'marca', 'modelo', 'costo',
  'precio1', 'precio2', 'precio3', 'precio4', 'precio5', 'separado', 'codigo', 'existencia', 'minimo'];
const OBLIGATORIAS = ['sku', 'nombre'];

const texto = v => String(v ?? '').trim();
// Número opcional: vacío → null; texto con coma o punto decimal también vale. Inválido → NaN (se reporta).
const numero = v => {
  const t = texto(v);
  if (!t) return null;
  const x = Number(t.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(x) ? x : NaN;
};
const booleano = v => v === true || /^(true|1|si|sí|x)$/i.test(texto(v));

// Clave de la tarjeta: las variantes de una misma tarjeta solo se distinguen por la talla.
export const claveGrupo = p => [p.tipo, p.tela, p.marca, p.genero, p.modelo, p.color].map(texto).join('|');
// Nombre que se muestra en la tarjeta (la tela y el color van aparte, debajo).
// El modelo se omite cuando repite el tipo («Bluson / Bluson», «Chemis / Chemis»).
const igual = (a, b) => texto(a).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === texto(b).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export const tituloProducto = p => [p.tipo, p.marca, p.genero, igual(p.modelo, p.tipo) ? '' : p.modelo].map(texto).filter(Boolean).join(' ') || texto(p.nombre) || p.sku;

export function leerInventario(json) {
  const head = (json?.head || []).map(h => texto(h).toLowerCase());
  const col = Object.fromEntries(COLUMNAS.map(c => [c, head.indexOf(c)]));
  const faltan = OBLIGATORIAS.filter(c => col[c] < 0);
  if (faltan.length) return { productos: [], errores: [{ fila: 0, sku: '', motivo: `Al archivo le falta la columna ${faltan.join(' y ')}` }], avisos: [], filas: (json?.rows || []).length };
  const sinColumna = COLUMNAS.filter(c => col[c] < 0);
  const de = (fila, c) => (col[c] >= 0 ? fila[col[c]] : undefined);

  const productos = [], errores = [], vistos = new Map();
  (json.rows || []).forEach((fila, i) => {
    const n = i + 1; // número de fila de datos (1 = la primera después del encabezado)
    const sku = texto(de(fila, 'sku'));
    const mal = motivo => errores.push({ fila: n, sku, motivo });
    if (!sku) return mal('Sin sku');
    if (vistos.has(sku)) return mal(`sku repetido (ya está en la fila ${vistos.get(sku)})`);
    const codigo = texto(de(fila, 'codigo'));
    if (codigo && !/^\d{13}$/.test(codigo)) return mal(`El código «${codigo}» no tiene 13 dígitos`);
    const nums = {};
    for (const c of ['costo', 'precio1', 'precio2', 'precio3', 'precio4', 'precio5', 'existencia', 'minimo']) {
      nums[c] = numero(de(fila, c));
      if (Number.isNaN(nums[c])) return mal(`«${c}» no es un número válido: ${texto(de(fila, c))}`);
      if (nums[c] != null && nums[c] < 0) return mal(`«${c}» no puede ser negativo`);
    }
    const p = {
      sku,
      nombre: texto(de(fila, 'nombre')),
      tipo: texto(de(fila, 'tipo')), tela: texto(de(fila, 'tela')),
      color: texto(de(fila, 'color')), talla: texto(de(fila, 'talla')),
      genero: texto(de(fila, 'genero')), marca: texto(de(fila, 'marca')), modelo: texto(de(fila, 'modelo')),
      codigo,
      id_imagen: texto(de(fila, 'id_imagen')).toLowerCase(),
      // precio1 = 1-5, precio2 = 6-11, precio3 = 12-23, precio4 = 24-47, precio5 = el quinto del Tarifario.
      precios: ['precio1', 'precio2', 'precio3', 'precio4', 'precio5'].map(c => (nums[c] > 0 ? nums[c] : null)),
      separado: booleano(de(fila, 'separado')), // se guarda; todavía no tiene uso en el POS
      existencia: Math.round(nums.existencia || 0),
      minimo: Math.round(nums.minimo || 0),
      costo: nums.costo,
      foto: null, oferta: null, activo: true,
    };
    if (p.precios[0] == null) return mal('Sin precio1 (el precio de 1 a 5 unidades)');
    p.grupo = claveGrupo(p);
    p.titulo = tituloProducto(p);
    vistos.set(sku, n); // solo una fila importada «ocupa» su sku
    productos.push(p);
  });
  const avisos = sinColumna.length ? [`El archivo no trae: ${sinColumna.join(', ')}. Esos datos quedan vacíos.`] : [];
  return { productos, errores, avisos, filas: (json.rows || []).length };
}

// Campos que se comparan para decidir si un producto cambió. La existencia NO: el archivo solo
// la aporta en la carga inicial (productos nuevos); la de los que ya existen la lleva el POS.
const CAMPOS = ['nombre', 'id_imagen', 'tipo', 'tela', 'color', 'talla', 'genero', 'marca', 'modelo', 'grupo', 'titulo', 'codigo', 'precios', 'separado', 'minimo'];

// El costo vive en costos/{sku} (solo admin y encargada lo leen), por eso se compara aparte.
// Upsert por sku: nuevos se crean, los que cambiaron se actualizan; los que no vienen en el archivo
// solo se listan (nunca se borran). La existencia de los que ya existen va aparte (`existencias`):
// solo se aplica si Carlos marca «Actualizar también existencia».
export function planImportacion(entrantes, actualesPorSku, costosPorSku = {}) {
  const nuevos = [], cambios = [], iguales = [], existencias = [];
  const vistos = new Set();
  for (const p of entrantes) {
    vistos.add(p.sku);
    const a = actualesPorSku[p.sku];
    if (!a) { nuevos.push(p); continue; }
    const campos = {};
    for (const c of CAMPOS) if (JSON.stringify(p[c] ?? null) !== JSON.stringify(a[c] ?? null)) campos[c] = p[c];
    if (p.costo != null && p.costo !== (costosPorSku[p.sku]?.costo ?? null)) campos.costo = p.costo;
    if ((p.existencia ?? 0) !== (a.existencia ?? 0)) existencias.push({ sku: p.sku, antes: a.existencia ?? 0, despues: p.existencia ?? 0 });
    if (Object.keys(campos).length) cambios.push({ sku: p.sku, campos }); else iguales.push(p.sku);
  }
  const faltantes = Object.values(actualesPorSku).filter(a => !vistos.has(a.sku) && a.activo !== false).map(a => a.sku);
  return { nuevos, cambios, iguales, existencias, faltantes };
}

// «precio1 25000 → 27000»: qué cambia en un producto, campo por campo (los precios por separado).
// Los campos internos (grupo, titulo) no se muestran: cambian solos cuando cambia tipo, tela, etc.
const OCULTOS = ['grupo', 'titulo'];
const valor = v => (v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'sí' : 'no') : String(v));
export function detalleCambios({ campos }, actual = {}, costoActual = null) {
  const lineas = [];
  for (const [c, nuevo] of Object.entries(campos)) {
    if (OCULTOS.includes(c)) continue;
    if (c === 'precios') {
      nuevo.forEach((n, i) => { const v = actual.precios?.[i] ?? null; if (v !== n) lineas.push(`precio${i + 1} ${valor(v)} → ${valor(n)}`); });
    } else lineas.push(`${c} ${valor(c === 'costo' ? costoActual : actual[c])} → ${valor(nuevo)}`);
  }
  return lineas;
}
