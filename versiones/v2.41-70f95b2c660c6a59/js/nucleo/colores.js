// Color real de una prenda a partir del nombre que trae el inventario ("Blanco", "Azul marino"…).
const COLORES = {
  blanco: '#ffffff', negro: '#1f2937', gris: '#9ca3af', 'gris claro': '#d1d5db', 'gris oscuro': '#4b5563', jaspe: '#b8bcc4',
  rojo: '#dc2626', vino: '#7f1d1d', rosa: '#f9a8d4', 'rosa palo': '#f4c2c2', fucsia: '#d946ef', morado: '#7c3aed', lila: '#c4b5fd',
  azul: '#2563eb', 'azul marino': '#1e3a8a', 'azul rey': '#1d4ed8', celeste: '#7dd3fc', turquesa: '#06b6d4', verde: '#16a34a',
  'verde militar': '#4d5d2b', 'verde menta': '#a7f3d0', amarillo: '#facc15', mostaza: '#ca8a04', naranja: '#fb923c',
  beige: '#e7d3b0', crema: '#f5ecd7', 'café': '#7c4a2d', cafe: '#7c4a2d', 'marrón': '#7c4a2d', marron: '#7c4a2d', caqui: '#bfa76f',
  dorado: '#d4a017', plateado: '#c0c0c0',
};
const sinTildes = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function colorPrenda(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  if (!n) return null;
  if (COLORES[n]) return COLORES[n];
  const s = sinTildes(n);
  const clave = Object.keys(COLORES).sort((a, b) => b.length - a.length).find(k => s.includes(sinTildes(k)));
  return clave ? COLORES[clave] : null;
}
