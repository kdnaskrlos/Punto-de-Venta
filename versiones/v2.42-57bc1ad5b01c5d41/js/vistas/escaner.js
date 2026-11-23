// Escáner de códigos de barras del Inventario: copiado de la app «Stock, Comic Shop» (movil/index.html):
// cámara trasera, recuadro verde con línea roja, flash si el teléfono lo permite, foto del código y campo
// para escribirlo (también sirve para un lector USB). Lee con BarcodeDetector y, si no, con @zxing/library 0.21.3.
import { abrirCapaPropia } from '../ui.js';

// Ícono del botón del escáner (el mismo en Inventario y Vender).
export const ICONO_ESCANER = '<svg viewBox="0 0 24 24"><path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16M7 8v8M10.5 8v8M14 8v8M17 8v8"/></svg>';

const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
let cargaZx = null;
function cargarZxing() {
  if (window.ZXing) return Promise.resolve(true);
  return (cargaZx ||= new Promise(res => {
    const s = document.createElement('script');
    s.src = ZXING; s.async = true;
    s.onload = () => res(!!window.ZXing);
    s.onerror = () => { cargaZx = null; res(false); };
    document.head.append(s);
  }));
}

let reader = null, bdet = null;
function zx() {
  if (reader || !window.ZXing) return reader;
  const Z = window.ZXing, h = new Map();
  h.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.QR_CODE]);
  h.set(Z.DecodeHintType.TRY_HARDER, true); reader = new Z.MultiFormatReader(); reader.setHints(h); return reader;
}
async function decodeCanvas(cv) {
  if ('BarcodeDetector' in window) { try { bdet = bdet || new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] }); const r = await bdet.detect(cv); if (r && r[0]) return r[0].rawValue; } catch { /* sigue con zxing */ } }
  const z = zx(); if (z) { try { const Z = window.ZXing; const b = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv))); return z.decode(b).getText(); } catch { /* sin código en este cuadro */ } }
  return null;
}
function frameCanvas(src, w, h, max) { const s = Math.min(1, max / Math.max(w, h)); const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s); cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); return cv; }

const HTML = `<section class="scan" id="scan" role="dialog" aria-modal="true" aria-label="Escáner de códigos de barras">
  <video id="vid" playsinline muted></video>
  <div class="shade"></div><div class="frame" id="frame"></div>
  <div class="tp"><b>Escanear código</b><div class="tbtns"><button class="x" id="torch" type="button" aria-pressed="false" aria-label="Encender el flash" hidden><svg viewBox="0 0 24 24"><path d="M13 2 5 13.5h6L10 22l9-12h-6.5z"/></svg></button><button class="x" id="scanX" type="button" aria-label="Cerrar escáner">×</button></div></div>
  <div class="bt">
    <div class="msg" id="scanMsg"></div>
    <div class="row" style="width:min(100%,420px)">
      <label class="sbtn primary" for="photo">Tomar foto del código</label>
      <input id="photo" type="file" accept="image/*" capture="environment" hidden>
    </div>
    <form class="manual" id="manual"><input id="manualQ" inputmode="numeric" placeholder="O escribe el código" autocomplete="off"><button class="sbtn" type="submit">Buscar</button></form>
  </div>
</section>`;

// Abre el escáner. `alLeer(codigo)` recibe lo leído o escrito; devuelve true si lo encontró (entonces se cierra).
export function abrirEscaner({ tema, alLeer }) {
  const capa = document.createElement('div');
  capa.className = 'stk stk-capa escaner';
  if (tema) capa.dataset.theme = tema;
  capa.innerHTML = HTML;
  const $ = s => capa.querySelector(s);
  let stream = null, tmr = 0, busy = false, torchOn = false, cerrada = false;
  const msg = $('#scanMsg');

  const stopCam = () => { clearTimeout(tmr); torchOn = false; const b = $('#torch'); b.hidden = true; b.setAttribute('aria-pressed', 'false'); if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } $('#vid').srcObject = null; };
  const salir = () => { cerrada = true; stopCam(); document.body.classList.remove('stk-lock'); window.removeEventListener('pagehide', stopCam); capa.remove(); };
  const { cerrar } = abrirCapaPropia(capa, salir);
  document.body.classList.add('stk-lock');
  window.addEventListener('pagehide', stopCam);

  const found = code => {
    try { navigator.vibrate && navigator.vibrate(60); } catch { /* sin vibración */ }
    if (alLeer(code)) cerrar();
    else msg.textContent = 'No encontré ese código';
  };
  async function tick() {
    if (!stream || cerrada) return;
    const v = $('#vid');
    if (v.videoWidth && !busy) { busy = true; try { const c = await decodeCanvas(frameCanvas(v, v.videoWidth, v.videoHeight, 1280)); if (c) { busy = false; found(c); if (cerrada) return; tmr = setTimeout(tick, 1200); return; } } catch { /* sigue */ } busy = false; }
    tmr = setTimeout(tick, 180);
  }
  function torchSetup() {
    const b = $('#torch'); torchOn = false; b.setAttribute('aria-pressed', 'false'); b.hidden = true;
    try { const tr = stream && stream.getVideoTracks()[0]; const cap = tr && tr.getCapabilities && tr.getCapabilities(); b.hidden = !(cap && cap.torch); } catch { /* sin flash */ }
  }
  async function torchToggle() {
    const tr = stream && stream.getVideoTracks()[0]; if (!tr) return; const want = !torchOn;
    try { await tr.applyConstraints({ advanced: [{ torch: want }] }); torchOn = want; const b = $('#torch'); b.setAttribute('aria-pressed', String(want)); b.setAttribute('aria-label', want ? 'Apagar el flash' : 'Encender el flash'); }
    catch { msg.textContent = 'No se pudo encender el flash en este teléfono.'; }
  }
  async function fromPhoto(f) {
    if (!f) return; msg.textContent = 'Leyendo la foto…';
    try {
      await cargarZxing();
      const bmp = await createImageBitmap(f); let c = null;
      for (const m of [1600, 1000, 2400]) { c = await decodeCanvas(frameCanvas(bmp, bmp.width, bmp.height, m)); if (c) break; }
      if (c) found(c); else msg.textContent = 'No pude leer ese código. Acércate, enfoca y que ocupe buena parte de la foto, o escribe el número.';
    } catch { msg.textContent = 'No se pudo abrir la foto. Inténtalo otra vez.'; }
  }

  $('#scanX').onclick = () => cerrar();
  $('#torch').onclick = torchToggle;
  $('#photo').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; fromPhoto(f); });
  $('#manual').addEventListener('submit', e => { e.preventDefault(); const v = $('#manualQ').value.trim(); if (v) found(v); });

  (async () => {
    msg.textContent = 'Abriendo la cámara…';
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('sin cámara en vivo');
      cargarZxing();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (cerrada) { stopCam(); return; }
      const v = $('#vid'); v.srcObject = stream; await v.play();
      msg.textContent = 'Centra el código de barras dentro del recuadro.'; $('#frame').hidden = false; torchSetup(); tick();
    } catch {
      // Sin cámara o sin permiso: queda solo el campo para escribir el código (o un lector USB).
      stream = null; $('#frame').hidden = true; $('#vid').hidden = true; $('.bt .row').hidden = true;
      msg.textContent = 'Aquí no se puede usar la cámara. Escribe el código o pásalo por el lector.';
      setTimeout(() => !cerrada && $('#manualQ').focus(), 60); // listo para un lector USB
    }
  })();
  return { cerrar };
}
