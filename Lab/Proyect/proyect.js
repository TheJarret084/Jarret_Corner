/* proyect.js */

/**
 * spawnImage(options)
 * options:
 *  - src: string (imagen URL | objectURL)
 *  - side: 'left'|'right'|'top'|'bottom'
 *  - frames: integer (número de frames de animación; 60 ≈ 1s)
 *  - sizePx: integer (tamaño del lado mayor en px)
 *  - behaviour: 'stopCenter'|'passThrough'
 */

// almacenamiento global
const subimagen = {};         // map: "0000" => <img>
const subimagenOrder = [];    // order of keys
let subimagenCount = 0;
const createdObjectURLs = []; // para revoke luego

function pad(n) {
  return n.toString().padStart(4, '0');
}

function spawnImage(options) {
  const { src, side, frames = 120, sizePx = 160, behaviour = 'stopCenter' } = options;

  const img = new Image();
  img.className = 'anim-img';
  img.draggable = false;
  img.style.width = sizePx + 'px';
  img.style.height = 'auto';
  img.style.opacity = '0.98';
  img.style.position = 'absolute';
  img.style.pointerEvents = 'none'; // no interactuar mientras se mueve
  img.src = src;

  // guardar en map y orden con numeración 0000...
  const numStr = pad(subimagenCount);
  subimagen[numStr] = img;
  subimagenOrder.push(numStr);
  subimagenCount++;

  // si src es objectURL, guardarla para liberar después
  if (src && src.startsWith && src.startsWith('blob:')) {
    createdObjectURLs.push(src);
  }

  // añadir al DOM (stage)
  const stage = document.getElementById('stage') || document.body;
  stage.appendChild(img);

  // animación y posicionamiento (igual que tu lógica)
  img.onload = () => {
    const imgBoxW = img.getBoundingClientRect().width;
    const imgBoxH = img.getBoundingClientRect().height;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let startX, startY, endX, endY;

    if (side === 'left') {
      startX = -imgBoxW - 8;
      startY = (vh - imgBoxH) / 2;
      if (behaviour === 'stopCenter') {
        endX = (vw - imgBoxW) / 2;
        endY = startY;
      } else {
        endX = vw + imgBoxW + 8;
        endY = startY;
      }
    } else if (side === 'right') {
      startX = vw + imgBoxW + 8;
      startY = (vh - imgBoxH) / 2;
      if (behaviour === 'stopCenter') {
        endX = (vw - imgBoxW) / 2;
        endY = startY;
      } else {
        endX = -imgBoxW - 8;
        endY = startY;
      }
    } else if (side === 'top') {
      startY = -imgBoxH - 8;
      startX = (vw - imgBoxW) / 2;
      if (behaviour === 'stopCenter') {
        endY = (vh - imgBoxH) / 2;
        endX = startX;
      } else {
        endY = vh + imgBoxH + 8;
        endX = startX;
      }
    } else if (side === 'bottom') {
      startY = vh + imgBoxH + 8;
      startX = (vw - imgBoxW) / 2;
      if (behaviour === 'stopCenter') {
        endY = (vh - imgBoxH) / 2;
        endX = startX;
      } else {
        endY = -imgBoxH - 8;
        endX = startX;
      }
    } else {
      startX = -imgBoxW - 8;
      startY = (vh - imgBoxH) / 2;
      endX = (vw - imgBoxW) / 2;
      endY = startY;
    }

    img.style.transform = `translate(${startX}px, ${startY}px)`;
    img.style.left = '0';
    img.style.top = '0';

    const totalFrames = Math.max(1, Math.floor(frames));
    let frame = 0;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function step() {
      frame++;
      const t = Math.min(1, frame / totalFrames);
      const e = easeOutCubic(t);

      const curX = startX + (endX - startX) * e;
      const curY = startY + (endY - startY) * e;

      img.style.transform = `translate(${curX}px, ${curY}px)`;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (behaviour === 'passThrough') {
          setTimeout(() => {
            if (img && img.parentNode) img.parentNode.removeChild(img);
            // no removemos de subimagen automáticamente — queda en el map para export
          }, 300);
        } else {
          img.style.pointerEvents = 'auto';
        }
      }
    }

    requestAnimationFrame(step);

    const onResize = () => {
      if (frame >= totalFrames && behaviour === 'stopCenter') {
        const newEndX = (window.innerWidth - imgBoxW) / 2;
        const newEndY = (window.innerHeight - imgBoxH) / 2;
        img.style.transform = `translate(${newEndX}px, ${newEndY}px)`;
      }
    };
    window.addEventListener('resize', onResize);

    const obs = new MutationObserver(() => {
      if (!document.body.contains(img)) {
        window.removeEventListener('resize', onResize);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  };

  img.onerror = () => {
    console.warn('No se pudo cargar la imagen:', src);
    if (img.parentNode) img.parentNode.removeChild(img);
  };

  return numStr; // devuelve la key asignada si quieres usarla
}

/* helpers para export */
function imageToBlob(img, preferDisplayedSize = false) {
  return new Promise((resolve, reject) => {
    // Asegurar que la imagen esté decodificada
    const ensureDecode = img.decode ? img.decode() : Promise.resolve();
    ensureDecode.then(() => {
      // elegir dimensiones: natural si disponible, si no la mostrada
      let w = img.naturalWidth || img.getBoundingClientRect().width;
      let h = img.naturalHeight || img.getBoundingClientRect().height;

      // Si preferDisplayedSize true, usa bounding rect
      if (preferDisplayedSize) {
        const rect = img.getBoundingClientRect();
        w = Math.max(1, Math.round(rect.width));
        h = Math.max(1, Math.round(rect.height));
      }

      // crear canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w));
      canvas.height = Math.max(1, Math.round(h));
      const ctx = canvas.getContext('2d');

      // dibujar la imagen escalada a canvas
      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        return reject(err);
      }

      // toBlob
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      }, 'image/png');
    }).catch(reject);
  });
}

async function exportAllToZip() {
  const status = document.getElementById('exportStatus');
  status.textContent = 'Preparando...';
  const zip = new JSZip();
  const folder = zip.folder('subimagenes');

  // recorre en orden subimagenOrder
  for (let i = 0; i < subimagenOrder.length; i++) {
    const key = subimagenOrder[i];
    const img = subimagen[key];
    if (!img) continue;

    status.textContent = `Procesando ${key} (${i+1}/${subimagenOrder.length})...`;

    try {
      // preferimos la resolución natural para calidad
      const blob = await imageToBlob(img, false);
      const filename = `subimagen_${key}.png`;
      folder.file(filename, blob);
    } catch (err) {
      console.warn('No se pudo convertir imagen', key, err);
    }
  }

  status.textContent = 'Comprimiendo ZIP...';

  try {
    const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      status.textContent = `Comprimiendo: ${Math.round(metadata.percent)}%`;
    });

    // descargar
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subimagenes.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    status.textContent = 'Listo — descarga iniciada';
  } catch (err) {
    console.error('Error generando zip', err);
    status.textContent = 'Error al generar ZIP';
  }

  // liberar object URLs creadas anteriormente
  createdObjectURLs.forEach(u => {
    try { URL.revokeObjectURL(u); } catch(e) {}
  });
  createdObjectURLs.length = 0;
}

/* Hook botones de la UI */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('spawn1').addEventListener('click', () => {
    const fileInput = document.getElementById('img1-file');
    if (!fileInput.files.length) {
      alert("Primero selecciona una imagen para Imagen 1");
      return;
    }
    const file = fileInput.files[0];
    const src = URL.createObjectURL(file);
    // guardamos para luego revoke
    createdObjectURLs.push(src);

    const side = document.getElementById('img1-side').value;
    const frames = parseInt(document.getElementById('img1-frames').value, 10) || 120;
    const size = parseInt(document.getElementById('img1-size').value, 10) || 160;
    const behaviour = document.getElementById('img1-behaviour').value;
    spawnImage({ src, side, frames, sizePx: size, behaviour });
  });

  document.getElementById('spawn2').addEventListener('click', () => {
    const fileInput = document.getElementById('img2-file');
    if (!fileInput.files.length) {
      alert("Primero selecciona una imagen para Imagen 2");
      return;
    }
    const file = fileInput.files[0];
    const src = URL.createObjectURL(file);
    createdObjectURLs.push(src);

    const side = document.getElementById('img2-side').value;
    const frames = parseInt(document.getElementById('img2-frames').value, 10) || 120;
    const size = parseInt(document.getElementById('img2-size').value, 10) || 140;
    const behaviour = document.getElementById('img2-behaviour').value;
    spawnImage({ src, side, frames, sizePx: size, behaviour });
  });

  document.getElementById('exportZip').addEventListener('click', () => {
    if (subimagenOrder.length === 0) {
      alert('No hay subimágenes para exportar.');
      return;
    }
    exportAllToZip();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === '1') document.getElementById('spawn1').click();
    if (e.key === '2') document.getElementById('spawn2').click();
  });
});