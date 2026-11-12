// Quién puede hacer qué (tabla de la especificación §4). La misma regla se repite en firestore.rules.
const TODOS = ['admin', 'encargada', 'vendedora'];
const GESTION = ['admin', 'encargada'];
const ADMIN = ['admin'];

const MATRIZ = {
  vender: TODOS,
  abrirCaja: TODOS,
  descuentoHastaMax: TODOS,
  descuentoSinLimite: GESTION,
  aprobarDescuento: ADMIN,
  verCostos: GESTION,
  verReportesTodos: GESTION,
  importar: ADMIN,
  fotosMasivas: ADMIN,
  ajustarInventario: ADMIN,
  ofertas: ADMIN,
  anularVenta: GESTION,
  cancelarApartado: GESTION,
  pagarComisiones: GESTION,
  cambiarTasas: ADMIN,
  reabrirCaja: ADMIN,
  ajustes: ADMIN,
};

export function puede(rol, accion) {
  const quienes = MATRIZ[accion];
  return !!quienes && quienes.includes(rol);
}
