// Emparejar fotos por nombre de archivo (sin extensión) con su código de imagen.
// Se comparan sin mayúsculas, acentos ni signos («fran-as-niño-4-bla-alg.JPG» = «Fran-AS-Niño-4-Bla-Alg»).
export function claveFoto(texto) {
  return String(texto).replace(/\.[a-z0-9]{2,5}$/i, '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Por código de imagen: img-0001.jpg → img-0001, una foto para todas sus variantes.
export function emparejarFotos(nombresArchivo, codigos) {
  const porCodigo = new Map(codigos.map(c => [claveFoto(c), c]));
  const asignadas = [], sinAsignar = [];
  for (const archivo of nombresArchivo) {
    const codigo = porCodigo.get(claveFoto(archivo));
    if (codigo) asignadas.push({ archivo, codigo }); else sinAsignar.push(archivo);
  }
  return { asignadas, sinAsignar };
}
