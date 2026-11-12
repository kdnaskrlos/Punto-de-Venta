// Convertir el inventario.json de la Carga Masiva en productos del POS y planear la importación (§7.2).
const n = v => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : null; };
const precio = v => { const x = n(v); return x && x > 0 ? x : null; };
const verdad = v => v === true || /^(true|1|si|sí|x)$/i.test(String(v ?? '').trim());
const texto = v => String(v ?? '').trim();

export function leerInventario(json) {
  const head = json.head || [];
  const col = nombre => head.indexOf(nombre);
  const de = (fila, nombre) => { const i = col(nombre); return i >= 0 ? fila[i] : undefined; };
  const iBarcode = col('barcode');
  const productos = [];
  let sinDatos = 0;
  for (const fila of json.rows || []) {
    const sku = texto(de(fila, 'sku'));
    if (!sku) continue;
    const nombre = texto(de(fila, 'name'));
    const producto = texto(de(fila, 'producto')), color = texto(de(fila, 'color')), talla = texto(de(fila, 'talla'));
    if (!producto || !color || !talla) sinDatos++;
    const comisiones = [1, 2, 3, 4, 5].map(k => {
      const valor = n(de(fila, `comm_value${k}`));
      if (de(fila, `comm_type${k}`) === undefined || valor == null || texto(de(fila, `comm_value${k}`)) === '') return null;
      const tipo = /porc|%/i.test(texto(de(fila, `comm_type${k}`))) ? 'Porcentaje' : 'Fijo';
      const reducida = verdad(de(fila, `comm_reduced_active${k}`)) ? (n(de(fila, `comm_reduced_value${k}`)) ?? valor) : valor;
      return { tipo, valor, reducida };
    });
    let codigo = iBarcode >= 0 ? texto(fila[iBarcode]) : '';
    if (!codigo && iBarcode >= 0 && head[iBarcode + 1] === '') codigo = texto(fila[iBarcode + 1]);
    productos.push({
      sku, nombre, producto, color, talla,
      grupo: producto && color ? `${producto} ${color}` : nombre,
      categoria: texto(de(fila, 'category')), marca: texto(de(fila, 'brand')),
      codigo,
      precios: ['price', 'price2', 'price3', 'price4', 'price5'].map(c => precio(de(fila, c))),
      separado: verdad(de(fila, 'separado')),
      comisiones,
      existencia: Math.round((n(de(fila, 'location_fiscalstock')) || 0) + (n(de(fila, 'location_nonfiscalstock')) || 0)),
      minimo: Math.round(n(de(fila, 'location_minstock')) || 0),
      costo: n(de(fila, 'cost')),
      foto: null, oferta: null, activo: true,
    });
  }
  const avisos = sinDatos ? [`${sinDatos} productos sin producto, color y talla: se agrupan por su nombre`] : [];
  return { productos, avisos };
}

const CAMPOS = ['nombre', 'producto', 'grupo', 'color', 'talla', 'categoria', 'marca', 'codigo', 'precios', 'separado', 'comisiones', 'minimo', 'costo'];

export function planImportacion(entrantes, actualesPorSku) {
  const nuevos = [], cambios = [], iguales = [];
  const vistos = new Set();
  for (const p of entrantes) {
    vistos.add(p.sku);
    const a = actualesPorSku[p.sku];
    if (!a) { nuevos.push(p); continue; }
    const campos = {};
    for (const c of CAMPOS) if (JSON.stringify(p[c] ?? null) !== JSON.stringify(a[c] ?? null)) campos[c] = p[c];
    if (Object.keys(campos).length) cambios.push({ sku: p.sku, campos }); else iguales.push(p.sku);
  }
  const faltantes = Object.values(actualesPorSku).filter(a => !vistos.has(a.sku) && a.activo !== false).map(a => a.sku);
  return { nuevos, cambios, iguales, faltantes };
}
