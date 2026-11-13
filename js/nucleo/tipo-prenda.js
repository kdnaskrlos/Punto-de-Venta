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
