// Evita que un doble toque repita una acción: el botón queda deshabilitado mientras corre.
export function unaVez(boton, accion) {
  let corriendo = false;
  return async (...args) => {
    if (corriendo) return undefined;
    corriendo = true; boton.disabled = true;
    boton.classList?.add('cargando'); boton.setAttribute?.('aria-busy', 'true');
    try { return await accion(...args); }
    finally { corriendo = false; boton.disabled = false; boton.classList?.remove('cargando'); boton.removeAttribute?.('aria-busy'); }
  };
}
