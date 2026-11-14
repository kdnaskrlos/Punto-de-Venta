// Cómo se muestra y agrupa un producto (variante) del inventario de la Carga Masiva.
import { claveGrupo, tituloProducto } from './importar.js';

// Nombre de la tarjeta: la columna nombre sin talla, color ni tela («Franela AS Niño»). Se calcula
// siempre (no se usa el titulo guardado, que en versiones anteriores incluía el modelo).
export const titulo = p => tituloProducto(p || {});
// Tarjeta a la que pertenece la variante (tipo + tela + marca + género + modelo + color).
export const grupoDe = p => p?.grupo || claveGrupo(p || {});
// Línea de detalle bajo el nombre: el color (la tela y el modelo no se muestran; solo clasifican).
export const detalle = p => p?.color || '';
// Texto donde busca el buscador (nombre, sku, código y todos los atributos).
export const textoBusqueda = p => [p.nombre, p.sku, p.codigo, p.tipo, p.tela, p.color, p.talla, p.genero, p.marca, p.modelo].filter(Boolean).join(' ');
// Nombre que queda guardado en cada línea de una venta o apartado («Franela AS Niño Blanco»).
export const nombreVenta = p => [titulo(p), p?.color].filter(Boolean).join(' ');
// Foto de un producto: solo la de su código de imagen (la comparten todas las prendas con ese código).
export const fotoDe = (p, imagenes = {}) => (p?.id_imagen && imagenes?.[p.id_imagen]) || null;
