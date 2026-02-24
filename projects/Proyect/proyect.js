// proyect.js - Nav reparada + generador de frames (SIN GIFs)
// Carga Corner.json para la navbar y mantiene el resto de la app.

// Ruta por defecto del JSON de la navbar (ajusta si hace falta)
const NAV_JSON = window.jsonFile || '../../Corner.json';

// DOM refs (se inicializan en DOMContentLoaded)
let canvas, ctx, resultadosCont, btnGenerar, btnDescargar, statusEl, navBar;

document.addEventListener('DOMContentLoaded', () => {
  // Cache DOM
  canvas = document.getElementById('canvas');
  ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  resultadosCont = document.getElementById('resultados');
  btnGenerar = document.getElementById('generar');
  btnDescargar = document.getElementById('descargar');
  statusEl = document.getElementById('status');
  navBar = document.getElementById('nav-bar');

  // Listeners botones
  btnGenerar && btnGenerar.addEventListener('click', onGenerar);
  btnDescargar && btnDescargar.addEventListener('click', onDescargar);

  // Cargar y renderizar navbar
  cargarNav();

  // Estado inicial
  if (btnDescargar) btnDescargar.disabled = true;
  setStatus('Listo. Selecciona imágenes y genera frames.');
});

/* -------------------- NAVBAR (Corner.json) -------------------- */

let dataGlobal = null;

async function cargarNav() {
  if (!navBar) return;
  try {
    const resp = await fetch(NAV_JSON, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    dataGlobal = await resp.json();
    renderizarNav();
    attachNavInteractions();
  } catch (err) {
    console.warn('No se pudo cargar Corner.json:', err);
    // Fallback: un único enlace al index
    navBar.innerHTML = `<a class="nav-link" href="../../index.html"><i class="fa fa-home"></i> Menú Principal</a>`;
  }
}

function renderizarNav() {
  if (!navBar) return;
  navBar.innerHTML = '';

  // Home fijo
  const aHome = document.createElement('a');
  aHome.className = 'nav-link';
  aHome.href = '../../index.html';
  aHome.target = '_self';
  aHome.rel = 'noopener';
  aHome.innerHTML = '<i class="fa fa-home"></i> Menú Principal';
  navBar.appendChild(aHome);

  const items = (dataGlobal && dataGlobal.data && Array.isArray(dataGlobal.data.nav)) ? dataGlobal.data.nav : [];

  items.forEach((item, idx) => {
    // Si es dropdown: crear wrapper con botón y contenido
    if (item && item.tipo === 'dropdown' && Array.isArray(item.opciones)) {
      const wrapper = document.createElement('div');
      wrapper.className = 'nav-dropdown';
      wrapper.setAttribute('data-nav-idx', idx);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-dropbtn';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-haspopup', 'menu');
      // Mostrar título si viene, sino "Más"
      btn.innerHTML = `<i class="fa fa-bars" aria-hidden="true"></i> ${escapeHtml(item.titulo || 'Más')}`;

      const content = document.createElement('div');
      content.className = 'nav-dropdown-content';
      content.setAttribute('role', 'menu');

      item.opciones.forEach(opt => {
        const a = document.createElement('a');
        a.href = opt.url || '#';
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = opt.texto || opt.url || 'Enlace';
        a.setAttribute('role', 'menuitem');
        content.appendChild(a);
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(content);
      navBar.appendChild(wrapper);
    } else if (item && item.texto && item.url) {
      // simple link
      const a = document.createElement('a');
      a.className = 'nav-link';
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = (item.icono ? `<i class="${escapeHtml(item.icono)}" aria-hidden="true"></i> ` : '') + escapeHtml(item.texto);
      navBar.appendChild(a);
    }
  });
}

// Seguridad: escape básico de texto para insertar en HTML
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Interacciones: toggle dropdown, cerrar al click fuera y con Escape
function attachNavInteractions() {
  if (!navBar) return;

  // Toggle de cada dropbtn
  const wrappers = Array.from(navBar.querySelectorAll('.nav-dropdown'));
  wrappers.forEach(wrapper => {
    const btn = wrapper.querySelector('.nav-dropbtn');
    const content = wrapper.querySelector('.nav-dropdown-content');
    if (!btn || !content) return;

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const wasOpen = wrapper.classList.contains('open');
      // cerrar todos
      navBar.querySelectorAll('.nav-dropdown.open').forEach(w => {
        w.classList.remove('open');
        const b = w.querySelector('.nav-dropbtn');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        wrapper.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    // close on ESC when focused inside
    content.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { wrapper.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  });

  // click fuera cierra dropdowns
  document.addEventListener('click', (e) => {
    if (!navBar.contains(e.target)) {
      navBar.querySelectorAll('.nav-dropdown.open').forEach(w => {
        w.classList.remove('open');
        const b = w.querySelector('.nav-dropbtn');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // Esc key global
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      navBar.querySelectorAll('.nav-dropdown.open').forEach(w => {
        w.classList.remove('open');
        const b = w.querySelector('.nav-dropbtn');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

/* -------------------- GENERADOR DE FRAMES (SIN GIFs) -------------------- */

let framesArray = []; // {name, dataURL}

// Generar frames al click
async function onGenerar() {
  if (!btnGenerar) return;
  try {
    btnGenerar.disabled = true;
    if (btnDescargar) btnDescargar.disabled = true;
    resultadosCont && (resultadosCont.innerHTML = '');
    framesArray = [];
    setStatus('Generando frames...');

    const file1 = document.getElementById('img1')?.files?.[0];
    const file2 = document.getElementById('img2')?.files?.[0];
    const dir1 = document.getElementById('dir1')?.value || 'down';
    const dir2 = document.getElementById('dir2')?.value || 'none';
    const totalFrames = Math.max(2, parseInt(document.getElementById('frames')?.value || '20', 10));

    if (!file1) { alert('Carga al menos la Imagen 1'); setStatus('Falta Imagen 1'); return; }

    const img1 = await cargarImagen(file1);
    const img2 = file2 ? await cargarImagen(file2) : null;

    // Ajustar canvas (usa mayor dimensión para que no recorte)
    if (canvas) {
      canvas.width = Math.max(img1.width, img2?.width || img1.width);
      canvas.height = Math.max(img1.height, img2?.height || img1.height);
    }

    for (let f = 0; f < totalFrames; f++) {
      if (!ctx) break;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      dibujarMovimiento(img1, dir1, f, totalFrames);
      if (img2 && dir2 !== 'none') dibujarMovimiento(img2, dir2, f, totalFrames);

      const dataURL = canvas.toDataURL('image/png');
      framesArray.push({ name: f.toString().padStart(4, '0'), dataURL });
    }

    mostrarResultados(framesArray);
    if (btnDescargar) btnDescargar.disabled = framesArray.length === 0;
    setStatus(framesArray.length ? `Generados ${framesArray.length} frames.` : 'No se generaron frames.');
  } catch (err) {
    console.error('Error generando frames:', err);
    alert('Error generando frames: ' + (err && err.message ? err.message : err));
    setStatus('Error durante generación.');
  } finally {
    if (btnGenerar) btnGenerar.disabled = false;
  }
}

// Dibuja movimiento (misma lógica que tenías)
function dibujarMovimiento(img, dir, frame, total) {
  if (!ctx || !canvas) return;
  const p = total <= 1 ? 1 : frame / (total - 1);
  let x = (canvas.width - img.width) / 2;
  let y = (canvas.height - img.height) / 2;
  const dx = canvas.width - img.width;
  const dy = canvas.height - img.height;

  const moves = {
    down: () => (y = -img.height + (dy + img.height) * p),
    up: () => (y = canvas.height - (dy + img.height) * p),
    left: () => (x = canvas.width - (dx + img.width) * p),
    right: () => (x = -img.width + (dx + img.width) * p),
    "down-right": () => { x = -img.width + (dx + img.width) * p; y = -img.height + (dy + img.height) * p; },
    "down-left":  () => { x = canvas.width - (dx + img.width) * p; y = -img.height + (dy + img.height) * p; },
    "up-right":   () => { x = -img.width + (dx + img.width) * p; y = canvas.height - (dy + img.height) * p; },
    "up-left":    () => { x = canvas.width - (dx + img.width) * p; y = canvas.height - (dy + img.height) * p; },
  };

  (moves[dir] || (() => {}))();
  ctx.drawImage(img, x, y);
}

// Mostrar miniaturas
function mostrarResultados(frames) {
  if (!resultadosCont) return;
  resultadosCont.innerHTML = '';
  if (!frames || frames.length === 0) {
    resultadosCont.textContent = 'No hay miniaturas';
    return;
  }
  frames.forEach(f => {
    const img = document.createElement('img');
    img.src = f.dataURL;
    img.alt = f.name;
    img.style.width = '100%';
    img.style.maxWidth = '420px';
    img.style.borderRadius = '8px';
    img.style.marginBottom = '8px';
    resultadosCont.appendChild(img);
  });
}

/* -------------------- DESCARGA ZIP -------------------- */

async function onDescargar() {
  if (!framesArray || framesArray.length === 0) { alert('Genera primero los frames'); return; }
  if (typeof JSZip === 'undefined') { alert('JSZip no cargado'); return; }

  try {
    if (btnDescargar) btnDescargar.disabled = true;
    setStatus('Preparando ZIP...');

    const zip = new JSZip();
    const folder = zip.folder('frames') || zip;
    const ordenados = [...framesArray].sort((a,b) => a.name.localeCompare(b.name));
    ordenados.forEach(f => {
      const base64 = (f.dataURL || '').split(',')[1] || '';
      folder.file(`${f.name}.png`, base64, { base64: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });

    // Use FileSaver if está disponible
    if (typeof saveAs === 'function') {
      saveAs(blob, 'frames.zip');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'frames.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    setStatus('ZIP descargado');
  } catch (err) {
    console.error('Error al generar ZIP:', err);
    alert('Error al generar ZIP: ' + (err && err.message ? err.message : err));
    setStatus('Error generando ZIP');
  } finally {
    if (btnDescargar) btnDescargar.disabled = false;
  }
}

/* -------------------- Utilidades -------------------- */

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// Cargar imagen usando ObjectURL (no base64)
function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('File missing'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = url;
  });
}

// soy gay

// cuanta prov hay que alguien lea esto?
