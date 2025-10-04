const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const resultadosCont = document.getElementById('resultados');
const previewGif = document.getElementById('previewGif');
const gifProgress = document.getElementById('gifProgress');
const progressText = document.getElementById('progressText');
const gifActions = document.getElementById('gifActions');
const btnGenerar = document.getElementById('generar');
const btnDescargar = document.getElementById('descargar');

let framesArray = [];
let gifBlob = null;

// Crear un Worker local (evita errores CORS en móviles)
const gifWorkerBlob = new Blob(
  ["importScripts('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');"],
  { type: 'application/javascript' }
);
const GIF_WORKER_URL = URL.createObjectURL(gifWorkerBlob);

// === FUNCIONES BASE ===

function loadImage(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = err => rej(err);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function drawMovingImage(img, dir, behaviour, frame, total) {
  const p = (total <= 1) ? 1 : frame / (total - 1);
  let x = (canvas.width - img.width) / 2;
  let y = (canvas.height - img.height) / 2;
  const dx = canvas.width - img.width;
  const dy = canvas.height - img.height;

  const move = {
    down:   () => y = -img.height + (dy + img.height) * p,
    up:     () => y = canvas.height - (dy + img.height) * p,
    left:   () => x = canvas.width - (dx + img.width) * p,
    right:  () => x = -img.width + (dx + img.width) * p,
    'down-right': () => { x = -img.width + (dx + img.width) * p; y = -img.height + (dy + img.height) * p; },
    'down-left':  () => { x = canvas.width - (dx + img.width) * p; y = -img.height + (dy + img.height) * p; },
    'up-right':   () => { x = -img.width + (dx + img.width) * p; y = canvas.height - (dy + img.height) * p; },
    'up-left':    () => { x = canvas.width - (dx + img.width) * p; y = canvas.height - (dy + img.height) * p; },
  };
  move[dir]?.();
  ctx.drawImage(img, x, y);
}

function mostrarResultados(frames) {
  resultadosCont.innerHTML = '';
  frames.forEach(f => {
    const thumb = new Image();
    thumb.src = f.dataURL;
    thumb.title = f.name;
    resultadosCont.appendChild(thumb);
  });
}

async function generarGIF(frames, delay = 100) {
  if (!frames.length) throw new Error('No hay frames');
  const gif = new GIF({
    workers: 2, quality: 10,
    width: canvas.width, height: canvas.height,
    workerScript: GIF_WORKER_URL
  });

  const ordenados = [...frames].sort((a,b)=>a.name.localeCompare(b.name));
  const imgs = await Promise.all(ordenados.map(f => new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = rej;
    img.src = f.dataURL;
  })));

  imgs.forEach(img => {
    const temp = document.createElement('canvas');
    temp.width = canvas.width; temp.height = canvas.height;
    const tctx = temp.getContext('2d');
    tctx.drawImage(img, 0, 0);
    gif.addFrame(tctx, { delay, copy: true });
  });

  // Mostrar progreso del renderizado
  return new Promise((resolve, reject)=>{
    gif.on('progress', p => {
      const percent = Math.round(p * 100);
      progressText.textContent = `🌀 Generando GIF... ${percent}%`;
    });
    gif.on('finished', blob => resolve(blob));
    gif.on('abort', ()=>reject(new Error('GIF abortado')));
    gif.on('error', reject);
    gif.render();
  });
}

async function descargarZip(frames, baseName) {
  const zip = new JSZip();
  const ordenados = [...frames].sort((a,b)=>a.name.localeCompare(b.name));
  ordenados.forEach((f,i)=>{
    const base64 = f.dataURL.split(',')[1];
    zip.file(`${baseName}_${i.toString().padStart(4,'0')}.png`, base64, {base64:true});
  });
  if (gifBlob) zip.file('animacion.gif', gifBlob);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}_frames.zip`;
  a.click();
}

// === EVENTOS ===

btnGenerar.addEventListener('click', async () => {
  try {
    btnGenerar.disabled = true;
    btnDescargar.disabled = true;
    resultadosCont.innerHTML = '';
    gifActions.innerHTML = '';
    previewGif.src = '';
    gifBlob = null;
    gifProgress.classList.remove('hidden');

    const file1 = document.getElementById('img1').files[0];
    const file2 = document.getElementById('img2').files[0];
    const dir1El = document.getElementById('dir1');
    const dir2El = document.getElementById('dir2');
    const beh1El = document.getElementById('beh1');
    const beh2El = document.getElementById('beh2');
    const framesEl = document.getElementById('frames');

    if (!file1) return alert('Carga al menos la imagen 1');

    const dir1 = dir1El.value, dir2 = dir2El.value;
    const beh1 = beh1El.value, beh2 = beh2El.value;
    const totalFrames = Math.max(2, parseInt(framesEl.value || '20'));

    const img1 = await loadImage(file1);
    const img2 = file2 ? await loadImage(file2) : null;

    canvas.width = img1.width;
    canvas.height = img1.height;

    framesArray = [];

    for (let f = 0; f < totalFrames; f++) {
      progressText.textContent = `🌀 Generando frame ${f + 1}/${totalFrames}`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawMovingImage(img1, dir1, beh1, f, totalFrames);
      if (img2 && dir2 !== 'none') drawMovingImage(img2, dir2, beh2, f, totalFrames);
      const frameData = canvas.toDataURL('image/png');
      framesArray.push({ name: f.toString().padStart(4, '0'), dataURL: frameData });

      // Espera mínima para refrescar texto en UI
      await new Promise(r => setTimeout(r, 10));
    }

    mostrarResultados(framesArray);
    progressText.textContent = '🌀 Generando GIF... (iniciando)';

    gifBlob = await generarGIF(framesArray, 100);
    previewGif.src = URL.createObjectURL(gifBlob);

    gifActions.innerHTML = `
      <a href="${URL.createObjectURL(gifBlob)}" download="animacion.gif" class="gifBtn">
        Descargar GIF (opcional)
      </a>
    `;

    progressText.textContent = '✅ GIF listo y frames generados';
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  } finally {
    gifProgress.classList.add('hidden');
    btnGenerar.disabled = false;
    btnDescargar.disabled = false;
  }
});

btnDescargar.addEventListener('click', async () => {
  if (!framesArray.length) return alert('Genera primero los frames');
  const file1 = document.getElementById('img1').files[0];
  const baseName = file1 ? file1.name.replace(/\.[^/.]+$/, '') : 'frames';
  await descargarZip(framesArray, baseName);
});