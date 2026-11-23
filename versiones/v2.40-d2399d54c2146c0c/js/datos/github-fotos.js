// Sube una foto al repositorio del POS con la API de contenidos de GitHub.
// El token (permisos limitados a este repositorio) vive solo en el navegador del administrador.
export const REPO_FOTOS = 'kdnaskrlos/Punto-de-Venta';
export const CLAVE_TOKEN = 'pos.githubToken';

async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function subirFotoGitHub({ token, repo = REPO_FOTOS, ruta, blob, fetchFn = fetch }) {
  if (!token) return { ok: false, error: 'token' };
  const url = `https://api.github.com/repos/${repo}/contents/${ruta}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  try {
    // Si ya existe, GitHub exige su sha para reemplazarla (sin él responde 422).
    const previo = await fetchFn(url, { headers });
    if (previo.status === 401 || previo.status === 403) return { ok: false, error: 'token' };
    const sha = previo.ok ? (await previo.json()).sha : undefined;
    const cuerpo = { message: `Foto ${ruta}`, content: await base64(blob), ...(sha ? { sha } : {}) };
    const r = await fetchFn(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    if (r.status === 401 || r.status === 403) return { ok: false, error: 'token' };
    if (!r.ok) return { ok: false, error: `github-${r.status}` };
    return { ok: true, ruta };
  } catch { return { ok: false, error: 'red' }; }
}

// Comprime en el navegador: WebP, lado mayor 800 px, ~100 KB.
export async function comprimirFoto(archivo) {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, 800 / Math.max(img.width, img.height));
  const w = Math.round(img.width * escala), hgt = Math.round(img.height * escala);
  const lienzo = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, hgt) : Object.assign(document.createElement('canvas'), { width: w, height: hgt });
  lienzo.getContext('2d').drawImage(img, 0, 0, w, hgt);
  const aBlob = q => (lienzo.convertToBlob ? lienzo.convertToBlob({ type: 'image/webp', quality: q }) : new Promise(r => lienzo.toBlob(r, 'image/webp', q)));
  let calidad = 0.8, blob = await aBlob(calidad);
  while (blob.size > 120 * 1024 && calidad > 0.4) { calidad -= 0.15; blob = await aBlob(calidad); }
  return blob;
}
