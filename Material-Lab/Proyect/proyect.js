/* proyect.js
 - Genera frames en canvas, crea miniaturas, genera GIF (usando gif.js)
 - Descarga ZIP con PNGs (ordenados 0000...) y opcionalmente incluye GIF en el ZIP si ya está creado
 - Muestra enlace de descarga del GIF en la previsualización
*/

// --- Referencias DOM
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const resultadosCont = document.getElementById('resultados');
const previewGif = document.getElementById('previewGif');

const btnGenerar = document.getElementById('generar');
const btnDescargar = document.getElementById('descargar');

let framesArray = []; // { name: '0000', dataURL: 'data:image/png...' }
let gifBlob = null;

// Asegúrate de que gif.js tenga acceso al worker (CDN worker)
const GIF_WORKER_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js';

// --- Carga File -> Image
function loadImage(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = (err) => rej(err);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// --- Dibujar movimiento según dirección y comportamiento
function drawMovingImage(img, dir, behaviour, frame, total) {
  const progress = (total <= 1) ? 1 : frame / (total - 1);
  let x = (canvas.width - img.width) / 2;
  let y = (canvas.height - img.height) / 2;

  if (behaviour === 'stopCenter') {
    switch (dir) {
      case 'down': y = -img.height + ((canvas.height - img.height) / 2 + img.height) * progress; break;
      case 'up': y = canvas.height - ((canvas.height - img.height) / 2 + img.height) * progress; break;
      case 'left': x = canvas.width - ((canvas.width - img.width) / 2 + img.width) * progress; break;
      case 'right': x = -img.width + ((canvas.width - img.width) / 2 + img.width) * progress; break;
      case 'down-right':
        x = -img.width + ((canvas.width - img.width) / 2 + img.width) * progress;
        y = -img.height + ((canvas.height - img.height) / 2 + img.height) * progress;
        break;
      case 'down-left':
        x = canvas.width - ((canvas.width - img.width) / 2 + img.width) * progress;
        y = -img.height + ((canvas.height - img.height) / 2 + img.height) * progress;
        break;
      case 'up-right':
        x = -img.width + ((canvas.width - img.width) / 2 + img.width) * progress;
        y = canvas.height - ((canvas.height - img.height) / 2 + img.height) * progress;
        break;
      case 'up-left':
        x = canvas.width - ((canvas.width - img.width) / 2 + img.width) * progress;
        y = canvas.height - ((canvas.height - img.height) / 2 + img.height) * progress;
        break;
    }
  } else if (behaviour === 'passThrough') {
    switch (dir) {
      case 'down': y = -img.height + (canvas.height + img.height) * progress; break;
      case 'up': y = canvas.height - (canvas.height + img.height) * progress; break;
      case 'left': x = canvas.width - (canvas.width + img.width) * progress; break;
      case 'right': x = -img.width + (canvas.width + img.width) * progress; break;
      case 'down-right':
        x = -img.width + (canvas.width + img.width) * progress;
        y = -img.height + (canvas.height + img.height) * progress;
        break;
      case 'down-left':
        x = canvas.width - (canvas.width + img.width) * progress;
        y = -img.height + (canvas.height + img.height) * progress;
        break;
      case 'up-right':
        x = -img.width + (canvas.width + img.width) * progress;
        y = canvas.height - (canvas.height + img.height) * progress;
        break;
      case 'up-left':
        x = canvas.width - (canvas.width + img.width) * progress;
        y = canvas.height - (canvas.height + img.height) * progress;
        break;
    }
  }

  ctx.drawImage(img, x, y);
}

// --- Mostrar miniaturas
function mostrarResultados(frames) {
  resultadosCont.innerHTML = '';
  frames.forEach(f => {
    const img = new Image();
    img.src = f.dataURL;
    img.title = f.name;
    resultadosCont.appendChild(img);
  });
}

// --- Generar GIF con gif.js; retorna Promise<Blob>
function generarGIF(frames, delay = 100) {
  return new Promise((resolve, reject) => {
    if (!frames.length) return reject(new Error('No hay frames'));

    // crear gif con ruta al worker para evitar fallos por CORS o path
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: GIF_WORKER_SCRIPT
    });

    // Ordenar por nombre (espera nombres tipo "0000", "0001", ...)
    const ordenados = [...frames].sort((a, b) => a.name.localeCompare(b.name));

    let loaded = 0;
    ordenados.forEach(f => {
      const img = new Image();
      img.src = f.dataURL;
      img.onload = () => {
        // crear canvas temporal y añadirlo (usamos copy: true para seguridad)
        const temp = document.createElement('canvas');
        temp.width = canvas.width;
        temp.height = canvas.height;
        const tctx = temp.getContext('2d');
        tctx.clearRect(0, 0, temp.width, temp.height);
        tctx.drawImage(img, 0, 0);
        gif.addFrame(temp, { delay: delay, copy: true });
        loaded++;
        if (loaded === ordenados.length) {
          gif.on('finished', blob => {
            gifBlob = blob;
            resolve(blob);
          });
          gif.on('abort', () => reject(new Error('GIF abortado')));
          gif.on('error', err => reject(err));
          gif.render();
        }
      };
      img.onerror = () => reject(new Error('Error cargando frame para GIF'));
    });
  });
}

// --- Obtener base name del archivo 1 (sin extension)
function getBaseName(file) {
  if (!file || !file.name) return 'frames';
  return file.name.replace(/\.[^/.]+$/, '');
}

// --- Descargar ZIP con imágenes (y opcionalmente GIF dentro del zip si ya existe)
async function descargarZip(frames, baseName) {
  if (!frames.length) { alert('Genera primero los frames'); return; }
  const zip = new JSZip();
  // ordenar por nombre
  const ordenados = [...frames].sort((a, b) => a.name.localeCompare(b.name));
  ordenados.forEach((f, idx) => {
    const base64 = f.dataURL.split(',')[1];
    const filename = `${baseName}_${idx.toString().padStart(4,'0')}.png`;
    zip.file(filename, base64, { base64: true });
  });
  // si GIF ya fue generado, incluirlo también
  if (gifBlob) {
    zip.file('animacion.gif', gifBlob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${baseName}_frames.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// --- Crear enlace de descarga del GIF en la UI (debajo de la previsualización)
function showGifDownloadLink(blob) {
  // elimina enlaces previos
  const existing = document.getElementById('gifDownloadLink');
  if (existing) existing.remove();

  if (!blob) return;
  const a = document.createElement('a');
  a.id = 'gifDownloadLink';
  a.href = URL.createObjectURL(blob);
  a.download = 'animacion.gif';
  a.textContent = 'Descargar GIF';
  a.style.display = 'inline-block';
  a.style.marginTop = '8px';
  a.style.padding = '8px 12px';
  a.style.background = '#333366';
  a.style.color = '#fff';
  a.style.borderRadius = '8px';
  a.style.textDecoration = 'none';
  a.style.fontWeight = '700';
  document.querySelector('.preview-container').appendChild(a);
}

// --- Habilitar / deshabilitar botones mientras procesa
function setButtonsDisabled(disabled) {
  btnGenerar.disabled = disabled;
  btnDescargar.disabled = disabled;
}

// --- Evento: Generar frames
btnGenerar.addEventListener('click', async () => {
  try {
    setButtonsDisabled(true);
    framesArray = [];
    gifBlob = null;
    previewGif.src = '';

    const file1 = document.getElementById('img1').files[0];
    const file2 = document.getElementById('img2').files[0];
    const dir1 = document.getElementById('dir1').value;
    const dir2 = document.getElementById('dir2').value;
    const beh1 = document.getElementById('beh1').value;
    const beh2 = document.getElementById('beh2').value;
    const totalFrames = Math.max(2, parseInt(document.getElementById('frames').value || '20'));

    if (!file1) { alert('Carga al menos la imagen 1'); setButtonsDisabled(false); return; }

    // cargar imagen principal y ajustar canvas
    const img1 = await loadImage(file1);
    canvas.width = img1.width;
    canvas.height = img1.height;

    // imagen secundaria opcional
    const img2 = file2 ? await loadImage(file2) : null;

    // generar frames en memoria
    for (let f = 0; f < totalFrames; f++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // dibujar imagen 1 y 2 (si existe)
      drawMovingImage(img1, dir1, beh1, f, totalFrames);
      if (img2 && dir2 !== 'none') drawMovingImage(img2, dir2, beh2, f, totalFrames);

      const dataURL = canvas.toDataURL('image/png');
      // nombre simple '0000' para ordenar correctamente
      const name = f.toString().padStart(4, '0');
      framesArray.push({ name, dataURL });
    }

    // mostrar miniaturas
    mostrarResultados(framesArray);

    // generar GIF (espera a que termine)
    try {
      const blob = await generarGIF(framesArray, 100); // delay 100ms por frame (ajustable)
      previewGif.src = URL.createObjectURL(blob);
      showGifDownloadLink(blob);
    } catch (gifErr) {
      console.error('Error generando GIF:', gifErr);
      alert('Se generaron los frames pero falló la creación del GIF. Revisa la consola.');
    }
  } catch (err) {
    console.error(err);
    alert('Ocurrió un error: ' + (err.message || err));
  } finally {
    setButtonsDisabled(false);
  }
});

// --- Evento: Descargar ZIP (contiene PNGs ordenados; incluye GIF si ya existe)
btnDescargar.addEventListener('click', async () => {
  if (!framesArray.length) { alert('Genera primero los frames'); return; }
  const file1 = document.getElementById('img1').files[0];
  const baseName = getBaseName(file1) || 'frames';
  setButtonsDisabled(true);
  try {
    await descargarZip(framesArray, baseName);
  } catch (err) {
    console.error('Error creando ZIP:', err);
    alert('Error creando ZIP. Revisa la consola.');
  } finally {
    setButtonsDisabled(false);
  }
});