// Emparejar fotos por nombre de archivo (sin extensión): código de imagen o sku.
// Se comparan sin mayúsculas, acentos ni signos («fran-as-niño-4-bla-alg.JPG» = «Fran-AS-Niño-4-Bla-Alg»).
export function claveFoto(texto) {
  return String(texto).replace(/\.[a-z0-9]{2,5}$/i, '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Primero por código de imagen (img-0001.jpg → img-0001, una foto para todas sus variantes);
// si el nombre no es un código, por sku (foto de respaldo de esa variante).
export function emparejarFotos(nombresArchivo, skus, codigos = []) {
  const porCodigo = new Map(codigos.map(c => [claveFoto(c), c]));
  const porClave = new Map(skus.map(s => [claveFoto(s), s]));
  const asignadas = [], sinAsignar = [];
  for (const archivo of nombresArchivo) {
    const k = claveFoto(archivo);
    const codigo = porCodigo.get(k), sku = porClave.get(k);
    if (codigo) asignadas.push({ archivo, codigo });
    else if (sku) asignadas.push({ archivo, sku });
    else sinAsignar.push(archivo);
  }
  return { asignadas, sinAsignar };
}
