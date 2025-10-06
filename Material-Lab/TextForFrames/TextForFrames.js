const $ = id => document.getElementById(id);
const log = msg => { $('log').textContent = msg + '\n' + $('log').textContent; };
const pad = (n, w = 4) => String(n).padStart(w, '0');

let frames = [], currentFrame = 0, playInterval = null, uploadedFont = null;
const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

$('fontFile').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const name = 'Font' + Date.now();
  const url = URL.createObjectURL(f);
  const style = document.createElement('style');
  style.innerHTML = `@font-face{font-family:'${name}';src:url('${url}');}`;
  document.head.appendChild(style);
  uploadedFont = name;
  log('Fuente cargada: ' + f.name);
};

function drawFrame(lines) {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!$('transparentBg').checked) {
    ctx.fillStyle = $('bgColor').value;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = $('textColor').value;
  ctx.font = `${$('fontSize').value}px '${uploadedFont || 'Arial'}'`;
  for (const l of lines) {
    ctx.globalAlpha = l.alpha ?? 1;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.scale(l.scale ?? 1, l.scale ?? 1);
    ctx.rotate(l.rotate ?? 0);
    ctx.fillText(l.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function getSelectedEffects() {
  return [...document.querySelectorAll('.fx:checked')].map(el => el.value);
}

function applyEffects(effects, p, base) {
  const t = p * Math.PI * 2;
  let out = { ...base };
  for (const eff of effects) {
    switch (eff) {
      case 'shake':
        out.x += Math.sin(t * 10) * 4;
        out.y += Math.cos(t * 8) * 4;
        break;
      case 'pulse':
        out.scale = (out.scale ?? 1) * (1 + 0.1 * Math.sin(t * 2));
        break;
      case 'bounce':
        out.y += Math.sin(t * 2) * 10;
        break;
      case 'fade':
        out.alpha = (out.alpha ?? 1) * (0.6 + 0.4 * Math.sin(t * 2));
        break;
    }
  }
  return out;
}

async function generatePhase(base, lines, phaseName, framesCount, drawFn) {
  const effects = getSelectedEffects();
  for (let i = 0; i < framesCount; i++) {
    const p = i / (framesCount - 1);
    const frameLines = drawFn(p, lines);
    const effLines = frameLines.map(b => applyEffects(effects, p, b));
    drawFrame(effLines);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    frames.push({ blob, name: `${base}_${phaseName}${pad(i)}.png` });
  }
}

async function generate() {
  frames = [];
  const baseName = $('baseName').value;
  const mode = $('mode').value;
  const lines = $('inputText').value.split('\n').filter(Boolean);
  const fc = +$('framesCount').value;
  const w = canvas.width, h = canvas.height;
  log(`Generando modo: ${mode}`);

  if (mode === 'insert') {
    const dir = $('insertDir').value === 'left' ? -1 : 1;

    // Entrada (desde un lado)
    await generatePhase(`${baseName}-insert_entrada`, lines, 'entrada', fc, p => {
      return lines.map(t => ({
        text: t, x: w / 2 + dir * w * (1 - p), y: h / 2, alpha: 1
      }));
    });

    // Ciclo (quieto con efectos)
    await generatePhase(`${baseName}-insert_ciclo`, lines, 'ciclo', fc, p => {
      return lines.map(t => ({ text: t, x: w / 2, y: h / 2, alpha: 1 }));
    });

    // Salida (al lado contrario)
    await generatePhase(`${baseName}-insert_salida`, lines, 'salida', fc, p => {
      return lines.map(t => ({
        text: t, x: w / 2 - dir * w * p, y: h / 2, alpha: 1
      }));
    });

  } else if (mode === 'bg') {
    // Entrada (fade in)
    await generatePhase(`${baseName}-bg_entrada`, lines, 'entrada', fc, p => {
      return lines.map((t, j) => ({
        text: t, x: w / 2, y: h / 2 + j * 30 - 30, alpha: p
      }));
    });

    // Ciclo (scroll + efectos)
    await generatePhase(`${baseName}-bg_ciclo`, lines, 'ciclo', fc, p => {
      return lines.map((t, j) => ({
        text: t,
        x: w / 2 + ((j % 2 ? -1 : 1) * w * (p - 0.5)),
        y: h / 2 + j * 30 - 30,
        alpha: 1
      }));
    });

    // Salida (fade out desde último frame)
    await generatePhase(`${baseName}-bg_salida`, lines, 'salida', fc, p => {
      return lines.map((t, j) => ({
        text: t, x: w / 2, y: h / 2 + j * 30 - 30, alpha: 1 - p
      }));
    });
  }

  currentFrame = 0;
  showFrame(0);
  log(`Generadas ${frames.length} imágenes.`);
}

function showFrame(i) {
  if (!frames.length) return;
  const img = new Image();
  img.src = URL.createObjectURL(frames[i].blob);
  img.onload = () => ctx.drawImage(img, 0, 0);
  $('frameInfo').textContent = `Frame ${i + 1} / ${frames.length}`;
}

$('generateBtn').onclick = generate;
$('nextFrame').onclick = () => { currentFrame = (currentFrame + 1) % frames.length; showFrame(currentFrame); };
$('prevFrame').onclick = () => { currentFrame = (currentFrame - 1 + frames.length) % frames.length; showFrame(currentFrame); };
$('playPause').onclick = () => {
  if (!frames.length) return;
  if (playInterval) { clearInterval(playInterval); playInterval = null; $('playPause').textContent = 'Play'; }
  else {
    $('playPause').textContent = 'Pausa';
    playInterval = setInterval(() => {
      currentFrame = (currentFrame + 1) % frames.length;
      showFrame(currentFrame);
    }, 100);
  }
};

$('downloadZipBtn').onclick = async () => {
  if (!frames.length) return;
  const zip = new JSZip();
  frames.forEach(f => zip.file(f.name, f.blob));
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${$('baseName').value}_frames.zip`);
  log('ZIP descargado.');
};

