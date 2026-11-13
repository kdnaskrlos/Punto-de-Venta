// Tipo de prenda a partir del nombre o la categoría ("Buzo Etanol" → buzo), para elegir el ícono cuando no hay foto.
const REGLAS = [
  ['body', /\b(body|bodys|pañalero|panalero|mameluco|enterizo bebe)\b/],
  ['buzo', /\b(buzo|buzos|sudadera|hoodie|sueter|suéter|sweater|chompa|poleron)\b/],
  ['chaqueta', /\b(chaqueta|chamarra|campera|cortavientos|rompevientos|chaleco)\b/],
  ['pantalon', /\b(jogger|joggers|pantalon|pantalón|mono|monos|jean|jeans|licra|leggin|legging|sudadera larga)\b/],
  ['short', /\b(short|shorts|bermuda|bermudas|boxer|bóxer)\b/],
  ['vestido', /\b(vestido|falda|enterizo)\b/],
  ['gorra', /\b(gorra|gorro|cachucha|visera|sombrero)\b/],
  ['camisa', /\b(camisa|chemise|polo|guayabera|blusa)\b/],
];

export function tipoPrenda(...textos) {
  const t = textos.filter(Boolean).join(' ').toLowerCase();
  for (const [tipo, re] of REGLAS) if (re.test(t)) return tipo;
  return 'franela';
}

// Orden natural de tallas: meses de bebé, números y letras (XS … XXXL). Lo desconocido va al final, en orden alfabético.
const LETRAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL'];
export function claveTalla(t) {
  const s = String(t ?? '').trim().toUpperCase();
  let m;
  if ((m = s.match(/^(\d+)\s*M$/))) return [0, Number(m[1])];
  if ((m = s.match(/^\d+(\.\d+)?$/))) return [1, Number(s)];
  const i = LETRAS.indexOf(s);
  if (i >= 0) return [2, i];
  return [3, s];
}
export function compararTallas(a, b) {
  const [x, y] = [claveTalla(a), claveTalla(b)];
  return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0);
}
