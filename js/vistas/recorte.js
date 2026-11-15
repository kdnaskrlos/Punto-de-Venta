// v2.16 · Foto de perfil: elegir una imagen, recortarla en círculo (v2.17: mover el círculo y agrandarlo desde sus asas)
// y editar el nombre. La foto se guarda pequeña (máx. 320 px, JPEG) dentro del usuario.
import { h, icono, abrirVentana, toast, esTelefono } from '../ui.js';

const LADO_MAX = 320;
const MIN = 40; // tamaño mínimo del recuadro, en px de pantalla

// Avatar con foto o con la inicial. tam: 'chico' | 'grande'.
export function avatarDe(u, tam = '') {
  const inicial = (u?.nombre || u?.usuario || '?').slice(0, 1).toUpperCase();
  return h('span', { class: 'avatar' + (tam ? ' ' + tam : '') + (u?.foto ? ' con-foto' : '') },
    u?.foto ? h('img', { src: u.foto, alt: '' }) : inicial);
}

// Abre el recorte libre de una imagen. Devuelve el dataURL recortado o null si se cancela.
export function recortarImagen(archivo) {
  return new Promise(resolver => {
    const url = URL.createObjectURL(archivo);
    const img = h('img', { class: 'rc-img', src: url, alt: '', draggable: 'false' });
    const caja = h('div', { class: 'rc-caja rc-circulo' }, ...['nw', 'ne', 'sw', 'se'].map(k => h('i', { class: 'rc-asa ' + k, 'data-asa': k })));
    const marco = h('div', { class: 'rc-marco' }, img, h('div', { class: 'rc-sombra' }), caja);
    let r = null, listo = false; // recuadro en px dentro del marco
    const pintar = () => { Object.assign(caja.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); };
    img.onload = () => {
      const W = img.clientWidth, H = img.clientHeight, l = Math.min(W, H) * 0.8;
      r = { x: (W - l) / 2, y: (H - l) / 2, w: l, h: l }; listo = true; pintar();
    };
    let arr = null;
    marco.addEventListener('pointerdown', e => {
      if (!listo) return;
      const asa = e.target.dataset?.asa || (e.target === caja ? 'mover' : null);
      if (!asa) return;
      e.preventDefault(); marco.setPointerCapture(e.pointerId);
      arr = { asa, x0: e.clientX, y0: e.clientY, r0: { ...r } };
    });
    marco.addEventListener('pointermove', e => {
      if (!arr) return;
      const W = img.clientWidth, H = img.clientHeight, dx = e.clientX - arr.x0, dy = e.clientY - arr.y0, o = arr.r0;
      let { x, y, w, h: hh } = o;
      if (arr.asa === 'mover') { x = Math.min(Math.max(0, o.x + dx), W - o.w); y = Math.min(Math.max(0, o.y + dy), H - o.h); }
      else {
        // Círculo: el recuadro siempre es cuadrado; cada asa lo agranda o achica desde la esquina opuesta.
        const a = arr.asa, d = a === 'se' ? (dx + dy) / 2 : a === 'nw' ? -(dx + dy) / 2 : a === 'ne' ? (dx - dy) / 2 : (dy - dx) / 2;
        const max = a === 'se' ? Math.min(W - o.x, H - o.y) : a === 'nw' ? Math.min(o.x + o.w, o.y + o.h) : a === 'ne' ? Math.min(W - o.x, o.y + o.h) : Math.min(o.x + o.w, H - o.y);
        w = hh = Math.min(Math.max(MIN, o.w + d), max);
        x = a.includes('w') ? o.x + o.w - w : o.x; y = a.includes('n') ? o.y + o.h - w : o.y;
      }
      r = { x, y, w, h: hh }; pintar();
    });
    const soltar = () => { arr = null; };
    marco.addEventListener('pointerup', soltar); marco.addEventListener('pointercancel', soltar);
    let hecho = false;
    const usar = h('button', { class: 'btn primary grande', id: 'rc-usar' }, icono('check'), 'Usar foto');
    const v = abrirVentana({ titulo: 'Recortar foto', contenido: h('div', { class: 'rc' }, marco, h('p', { class: 'nota' }, 'Mueve el círculo y agrándalo desde sus puntos.')), acciones: h('div', { class: 'acciones' }, usar) });
    v.alCerrar = () => { URL.revokeObjectURL(url); if (!hecho) resolver(null); };
    usar.onclick = () => {
      if (!listo) return;
      const k = img.naturalWidth / img.clientWidth;
      const sw = r.w * k, sh = r.h * k, esc = Math.min(1, LADO_MAX / Math.max(sw, sh));
      const cv = document.createElement('canvas'); cv.width = Math.round(sw * esc); cv.height = Math.round(sh * esc);
      cv.getContext('2d').drawImage(img, r.x * k, r.y * k, sw, sh, 0, 0, cv.width, cv.height);
      hecho = true; resolver(cv.toDataURL('image/jpeg', 0.82)); v.cerrar();
    };
  });
}

// Ventana «Editar perfil»: foto (elegir, recortar o quitar) y nombre.
export function editarPerfil(ctx, u) {
  let foto = u.foto || null;
  const vista = h('div', { class: 'pf-foto' });
  const pintarFoto = () => vista.replaceChildren(avatarDe({ ...u, foto }, 'grande'));
  pintarFoto();
  const archivo = h('input', { type: 'file', accept: 'image/*', hidden: true });
  archivo.onchange = async () => { const f = archivo.files[0]; archivo.value = ''; if (!f) return; const d = await recortarImagen(f); if (d) { foto = d; pintarFoto(); quitar.hidden = false; } };
  const quitar = h('button', { class: 'btn texto peligro pf-quitar', type: 'button', hidden: !foto, onclick: () => { foto = null; pintarFoto(); quitar.hidden = true; } }, icono('borrar'), 'Quitar foto');
  const nombre = h('input', { class: 'inp', id: 'pf-nombre', value: u.nombre || '', autocapitalize: 'words', 'data-no-limpiar': '' });
  const err = h('p', { class: 'error', role: 'alert' });
  const guardar = h('button', { class: 'btn primary grande', id: 'pf-guardar' }, icono('check'), 'Guardar');
  const pc = true; // v2.17: mismo diseño en PC y teléfono
  // v2.17: la foto grande y centrada, con un lápiz abajo a la derecha del círculo para cambiarla.
  const arriba = pc
    ? h('div', { class: 'pf-arriba pf-centro' }, h('div', { class: 'pf-circulo' }, vista, h('button', { class: 'pf-lapiz', type: 'button', id: 'pf-elegir', 'aria-label': 'Cambiar foto', onclick: () => archivo.click() }, icono('lapiz'))), quitar, archivo)
    : h('div', { class: 'pf-arriba' }, vista, h('div', { class: 'pf-botones' }, h('button', { class: 'btn', type: 'button', id: 'pf-elegir', onclick: () => archivo.click() }, icono('imagen'), 'Elegir foto'), quitar), archivo);
  const v = abrirVentana({ titulo: 'Editar perfil', clase: pc ? 'pf-ventana' : undefined, contenido: h('div', { class: 'pila pf' }, arriba,
    h('div', { class: 'campo' }, h('label', { for: 'pf-nombre' }, 'Nombre'), nombre), err), acciones: h('div', { class: 'acciones' }, guardar) });
  guardar.onclick = async () => {
    const n = nombre.value.trim();
    if (n.length < 2) { err.textContent = 'Escribe el nombre'; return; }
    guardar.disabled = true;
    const r = await ctx.almacen.editarPerfil(u.uid, { nombre: n, foto });
    guardar.disabled = false;
    if (!r.ok) { err.textContent = 'No se pudo guardar'; return; }
    v.cerrar(); toast('Perfil guardado');
  };
  return v;
}
