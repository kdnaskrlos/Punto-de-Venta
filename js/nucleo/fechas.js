// Fechas en la hora de la tienda (Caracas), para que una venta de las 9 pm cuente en su día.
export const ZONA = 'America/Caracas';

export function diaLocal(fechaISO) {
  return new Date(fechaISO).toLocaleDateString('en-CA', { timeZone: ZONA });
}
