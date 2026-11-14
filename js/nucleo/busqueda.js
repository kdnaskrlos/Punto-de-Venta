// Búsqueda de la app (v1.92): sin importar mayúsculas, tildes ni el orden de las palabras.
// - Cada palabra escrita tiene que aparecer (en cualquier orden): «jogger negro m».
// - Palabras de 1 o 2 letras buscan el comienzo de una palabra (la talla «m» no encuentra «Caballero»).
// - Plurales: «franelas» encuentra «franela»; «joggers» encuentra «jogger».
// - Guiones, puntos y espacios no importan en códigos: «fb4» encuentra «F-B-4».
// - Números: los teléfonos se encuentran aunque tengan espacios, guiones, el +58 o el 0 delante (0412…).
export const normalizar = t => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function prepararTexto(texto) {
  const n = normalizar(texto);
  const palabras = n.split(/[^a-z0-9ñ]+/).filter(Boolean);
  return { n, palabras, junto: palabras.join(''), digitos: n.replace(/\D/g, '') };
}

const variantes = w => {
  const vs = [w];
  if (w.length > 3 && w.endsWith('es')) vs.push(w.slice(0, -2));
  if (w.length > 3 && w.endsWith('s')) vs.push(w.slice(0, -1));
  return vs;
};

function terminoCoincide(t, w) {
  // Teléfono escrito como 0412…: también sin el 0 (se guarda 58412…).
  if (/^\d+$/.test(w)) return t.digitos.includes(w) || (w.length > 3 && w[0] === '0' && t.digitos.includes(w.slice(1)));
  if (w.length <= 2) return t.palabras.some(p => p.startsWith(w));
  return variantes(w).some(v => t.n.includes(v) || t.junto.includes(v.replace(/[^a-z0-9ñ]+/g, '')));
}

// consulta vacía → coincide siempre. texto puede ser un string o lo que devuelve prepararTexto.
export function coincide(texto, consulta) {
  const terms = normalizar(consulta).split(/\s+/).map(w => w.replace(/^[^a-z0-9ñ+]+|[^a-z0-9ñ]+$/g, '').replace(/^\+/, '')).filter(Boolean);
  if (!terms.length) return true;
  const t = typeof texto === 'string' ? prepararTexto(texto) : texto;
  return terms.every(w => terminoCoincide(t, w));
}
