// Lee el tasa.json que publica la Calculadora de Tasas (Binance P2P y BCV), con tope de tiempo.
export const URL_TASA = 'https://kdnaskrlos.github.io/Calculadora-de-Tasas/tasa.json';

export async function leerTasaRemota(fetchFn, url = URL_TASA, topeMs = 8000) {
  try {
    const r = await Promise.race([fetchFn(`${url}?t=${Date.now()}`, { cache: 'no-store' }), new Promise((_, mal) => setTimeout(() => mal(new Error('tope')), topeMs))]);
    if (!r || !r.ok) return null;
    const j = await r.json();
    return j && typeof j.rate === 'number' && Number.isFinite(j.rate) ? j : null;
  } catch { return null; }
}
