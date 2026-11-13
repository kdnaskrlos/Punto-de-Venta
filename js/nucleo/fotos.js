// Emparejar fotos con las variantes por sku: el nombre del archivo (sin extensión) es el sku.
// Se comparan sin mayúsculas, acentos ni signos («fran-as-niño-4-bla-alg.JPG» = «Fran-AS-Niño-4-Bla-Alg»).
export function claveFoto(texto) {
  return String(texto).replace(/\.[a-z0-9]{2,5}$/i, '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function emparejarFotos(nombresArchivo, skus) {
  const porClave = new Map(skus.map(s => [claveFoto(s), s]));
  const asignadas = [], sinAsignar = [];
  for (const archivo of nombresArchivo) {
    const sku = porClave.get(claveFoto(archivo));
    if (sku) asignadas.push({ archivo, sku }); else sinAsignar.push(archivo);
  }
  return { asignadas, sinAsignar };
}
