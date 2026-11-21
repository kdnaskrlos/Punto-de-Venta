// Un contexto puede volver a ser la misma instancia al salir de práctica o de demo.
// La generación invalida también el trabajo que empezó antes de esa ida y vuelta.
export function capturarContexto(ctx) {
  const { almacen, ambitoPrueba, generacion, vistaRol, sesion } = ctx;
  const sesionVigente = almacen?.vigenciaSesion?.();
  return () => !!sesion && (!sesionVigente || sesionVigente()) && ctx.generacion === generacion && ctx.almacen === almacen &&
    ctx.ambitoPrueba === ambitoPrueba && ctx.vistaRol === vistaRol &&
    ctx.sesion?.uid === sesion.uid && ctx.sesion.usuario === sesion.usuario && ctx.sesion.rol === sesion.rol;
}
