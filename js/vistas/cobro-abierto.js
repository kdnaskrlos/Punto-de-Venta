// Marca de "hay una ventana de cobro o apartado abierta": evita abrir dos (F9 dos veces, doble toque).
let abierto = false;
export const cobroAbierto = () => abierto;
export function marcarCobro(ventana) { abierto = true; const previo = ventana.alCerrar; ventana.alCerrar = () => { abierto = false; previo && previo(); }; }
export function soltarCobro() { abierto = false; }
