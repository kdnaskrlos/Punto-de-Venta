// Emparejar fotos con los grupos (producto + color) por el nombre del archivo.
export function claveFoto(texto) {
  return String(texto).replace(/\.[a-z0-9]{2,5}$/i, '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function emparejarFotos(nombresArchivo, grupos) {
  const porClave = new Map(grupos.map(g => [claveFoto(g), g]));
  const asignadas = [], sinAsignar = [];
  for (const archivo of nombresArchivo) {
    const g = porClave.get(claveFoto(archivo));
    if (g) asignadas.push({ archivo, grupo: g }); else sinAsignar.push(archivo);
  }
  return { asignadas, sinAsignar };
}
