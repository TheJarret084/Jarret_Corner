// script.js - versión corregida con dos clases separadas y font loading robusto
const $ = id => document.getElementById(id);
const log = msg => { $('log').textContent = `${new Date().toLocaleTimeString()} — ${msg}\n` + $('log').textContent; };
const pad = (n, w = 4) => String(n).padStart(w, '0');

let frames = [], currentFrame = 0, playInterval = null, uploadedFontFamily = null;
const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

// --- Font loader (returns font family name) ---
async function loadFontFromFile(file) {
  if (!file) return null;
  const name = 'UploadedFont_' + Date.now();
  const url = URL.createObjectURL(file);
  try {
    const fontFace = new FontFace(name, `url(${url})`);
    await fontFace.load();
    document.fonts.add(fontFace);
    // wait for it to be available
    await document.fonts.ready;
    log(`Fuente cargada: ${file.name} -> ${name}`);
    return name;
  } catch (e) {
    log('Error cargando fuente: ' + e.message);
    return null;
  }
}

// --- Helpers ---
function getSelectedEffects() {
  return [...document.querySelectorAll('.fx:checked')].map(el => el.value);
}
function setCanvasSizeFromInputs() {
  const w = Math.max(1, +$('canvasW').value);
  const h = Math.max(1, +$('canvasH').value);
  canvas.width = w;
  canvas.height = h;
}
setCanvasSizeFromInputs();
$('canvasW').onchange = setCanvasSizeFromInputs;
$('canvasH').onchange = setCanvasSizeFromInputs;

function clearPreview() {
  if (!$('transparentBg').checked) {
    ctx.fillStyle = $('bgColor').value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// apply combined visual effects to a base line object (non-destructive)
function applyEffectsToLine(base, effects, progress) {
  const t = progress * Math.PI * 2;
  const out = { ...base }; // copy base
  // ensure defaults
  out.x = out.x ?? 0;
  out.y = out.y ?? 0;
  out.scale = out.scale ?? 1;
  out.alpha = out.alpha ?? 1;
  out.rotate = out.rotate ?? 0;

  for (const eff of effects) {
    switch (eff) {
      case 'shake':
        out.x += Math.sin(t * 10) * 4;
        out.y += Math.cos(t * 9) * 4;
        break;
      case 'pulse':
        out.scale = out.scale * (1 + 0.08 * Math.sin(t * 2));
        break;
      case 'bounce':
        out.y += Math.sin(t * 2) * 8;
        break;
      case 'fade':
        out.alpha = out.alpha * (0.6 + 0.4 * (Math.sin(t * 2) * 0.5 + 0.5));
        break;
    }
  }
  return out;
}

function drawLinesOnCanvas(lines, fontFamily) {
  // clear or fill background
  if (!$('transparentBg').checked) {
    ctx.fillStyle = $('bgColor').value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const fontSize = Math.max(8, +$('fontSize').value);
  const family = fontFamily || uploadedFontFamily || 'Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = $('textColor').value;
  ctx.font = `${fontSize}px '${family}'`;

  for (const l of lines) {
    ctx.save();
    ctx.globalAlpha = l.alpha ?? 1;
    ctx.translate(l.x, l.y);
    ctx.scale(l.scale ?? 1, l.scale ?? 1);
    ctx.rotate(l.rotate ?? 0);
    ctx.fillText(l.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

async function canvasToBlob() {
  return await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}

// --- InsertTextGenerator class ---
class InsertTextGenerator {
  constructor(options) {
    this.canvas = options.canvas;
    this.ctx = options.ctx;
    this.lines = options.lines; // array of string
    this.framesPerPhase = options.framesPerPhase;
    this.dir = options.dir || 'left'; // 'left' or 'right'
    this.fontFamily = options.fontFamily;
    this.effects = options.effects || [];
    this.baseName = options.baseName || 'text';
  }

  // measure maximum text width (used for offscreen positions)
  measureMaxWidth() {
    const fontSize = Math.max(8, +$('fontSize').value);
    this.ctx.font = `${fontSize}px '${this.fontFamily || uploadedFontFamily || 'Arial'}'`;
    let maxW = 0;
    for (const t of this.lines) {
      const m = this.ctx.measureText(t).width;
      if (m > maxW) maxW = m;
    }
    return maxW;
  }

  // generate returns array of {blob, name}
  async generate() {
    const results = [];
    const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(8, +$('fontSize').value);
    this.ctx.font = `${fontSize}px '${this.fontFamily || uploadedFontFamily || 'Arial'}'`;

    const maxTextW = this.measureMaxWidth();
    const startOffLeft = -Math.max(100, maxTextW + 50);
    const startOffRight = w + Math.max(100, maxTextW + 50);
    const centerX = w / 2;
    const centerY = h / 2;

    const dirSign = (this.dir === 'left') ? 1 : -1; // when 'left' we enter from left -> center, sign positive for startX = left (-)
    // but simpler handle below

    // Phase 1: entrada (from side to center)
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : (f / (this.framesPerPhase - 1));
      const frameLines = this.lines.map((t, i) => {
        const startX = (this.dir === 'left') ? startOffLeft : startOffRight;
        const x = startX + (centerX - startX) * p;
        return { text: t, x, y: centerY + (i * (fontSize + 4)) - ((this.lines.length - 1) * (fontSize + 4) / 2), alpha: 1, scale: 1 };
      }).map(base => applyEffectsToLine(base, this.effects, p));
      drawLinesOnCanvas(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-insert_entrada${pad(f)}.png`;
      results.push({ blob, name });
    }

    // Phase 2: ciclo (centered, effects applied). Will use same center positions.
    // We'll keep positions centered; effects animate across frames.
    const lastCycleFrames = [];
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : (f / (this.framesPerPhase - 1));
      const frameLines = this.lines.map((t, i) => {
        const x = centerX;
        const y = centerY + (i * (fontSize + 4)) - ((this.lines.length - 1) * (fontSize + 4) / 2);
        return { text: t, x, y, alpha: 1, scale: 1 };
      }).map(base => applyEffectsToLine(base, this.effects, p));

      drawLinesOnCanvas(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-insert_ciclo${pad(f)}.png`;
      results.push({ blob, name });
      // keep last frame's layout (positions & alpha) to use as base for exit
      if (f === this.framesPerPhase - 1) {
        lastCycleFrames.push(...frameLines.map(l => ({ ...l })));
      }
    }

    // Phase 3: salida (from center to opposite side). We must use last frame of cycle as base.
    // Calculate endX opposite side
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : (f / (this.framesPerPhase - 1));
      const frameLines = this.lines.map((t, i) => {
        const baseLine = lastCycleFrames[i] || { x: centerX, y: centerY, alpha: 1, scale: 1 };
        const endX = (this.dir === 'left') ? startOffRight : startOffLeft; // exit to opposite side
        const x = baseLine.x + (endX - baseLine.x) * p;
        const y = baseLine.y; // keep same vertical
        // optionally fade out? keep alpha 1 (spec didn't request fade). If you want fade-out multiply alpha: (1 - p)
        return { text: t, x, y, alpha: 1 - p * (this.effects.includes('fade') ? 0.6 : 0), scale: baseLine.scale ?? 1 };
      }).map(base => applyEffectsToLine(base, this.effects, p));
      drawLinesOnCanvas(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-insert_salida${pad(f)}.png`;
      results.push({ blob, name });
    }

    return results;
  }
}

// --- BackgroundTextGenerator class ---
class BackgroundTextGenerator {
  constructor(options) {
    this.canvas = options.canvas;
    this.ctx = options.ctx;
    this.lines = options.lines; // array of string
    this.framesPerPhase = options.framesPerPhase;
    this.fontFamily = options.fontFamily;
    this.effects = options.effects || [];
    this.baseName = options.baseName || 'text';
  }

  measureMaxWidth() {
    const fontSize = Math.max(8, +$('fontSize').value);
    this.ctx.font = `${fontSize}px '${this.fontFamily || uploadedFontFamily || 'Arial'}'`;
    let maxW = 0;
    for (const t of this.lines) {
      const m = this.ctx.measureText(t).width;
      if (m > maxW) maxW = m;
    }
    return maxW;
  }

  async generate() {
    const results = [];
    const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(8, +$('fontSize').value);
    this.ctx.font = `${fontSize}px '${this.fontFamily || uploadedFontFamily || 'Arial'}'`;

    const centerX = w / 2;
    const startX = -Math.max(100, this.measureMaxWidth() + 50);
    const endX = w + Math.max(100, this.measureMaxWidth() + 50);

    // Phase 1: entrada (fade in quickly)
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : (f / (this.framesPerPhase - 1));
      const frameLines = this.lines.map((t, i) => {
        const x = centerX;
        const y = h / 2 + (i * (fontSize + 4)) - ((this.lines.length - 1) * (fontSize + 4) / 2);
        return { text: t, x, y, alpha: p, scale: 1 };
      }).map(base => applyEffectsToLine(base, this.effects, p));
      drawLinesOnCanvas(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-bg_entrada${pad(f)}.png`;
      results.push({ blob, name });
    }

    // Phase 2: ciclo (scroll horizontally). For each line alternate direction.
    // We'll make text traverse a wide range across frames.
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : (f / (this.framesPerPhase - 1));
      const frameLines = this.lines.map((t, i) => {
        const dir = (i % 2 === 0) ? 1 : -1; // alternate directions
        // x varies from end to start (so text seems to slide)
        // when p=0 -> off-right (endX) if dir=1 or off-left if dir=-1
        const travel = w + this.measureMaxWidth() + 200;
        const x = centerX + dir * (travel * (p - 0.5));
        const y = h / 2 + (i * (fontSize + 4)) - ((this.lines.length - 1) * (fontSize + 4) / 2);
        return { text: t, x, y, alpha: 1, scale: 1 };
      }).map(base => applyEffectsToLine(base, this.effects, p));
      drawLinesOnCanvas(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-bg_ciclo${pad(f)}.png`;
      results.push({ blob, name });
      // store last frame layout to use in exit (we can compute again below)
      if (f === this.framesPerPhase - 1) {
        // we'll reuse positions computed here as lastCyclePositions
        this.lastCyclePositions = frameLines.map(l => ({ ...l }));
      }
    }

    // Phase 3: salida — starting from last cycle positions, fade out using alpha decreasing
    // If lastCyclePositions not set (framesPerPhase=0 edge), recompute centered
    const basePositions = this.lastCyclePositions || this.lines.map((t, i) => ({
      text: t,
      x: centerX,
      y: h / 2 + (i * (fontSize + 4)) - ((this.lines.length - 1) * (fontSize + 4) / 2),
      alpha: 1,
      scale: 1
    }));

    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : (f / (this.framesPerPhase - 1));
      const frameLines = basePositions.map((base, i) => {
        const alpha = base.alpha * (1 - p);
        return { ...base, alpha };
      }).map(base => applyEffectsToLine(base, this.effects, p));
      drawLinesOnCanvas(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-bg_salida${pad(f)}.png`;
      results.push({ blob, name });
    }

    return results;
  }
}

// --- UI wiring ---
$('fontFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) { uploadedFontFamily = null; return; }
  uploadedFontFamily = await loadFontFromFile(f);
};

async function generateAll() {
  frames = [];
  const baseName = $('baseName').value || 'text';
  const mode = $('mode').value;
  const lines = $('inputText').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) { log('No hay líneas de texto.'); return; }
  const framesCount = Math.max(1, +$('framesCount').value);
  const effects = getSelectedEffects();
  const fontFamily = uploadedFontFamily || null;

  // set canvas font earlier to ensure measureText uses the right font
  ctx.font = `${Math.max(8, +$('fontSize').value)}px '${fontFamily || 'Arial'}'`;

  log(`Generando modo "${mode}" con ${framesCount} frames por fase. Efectos: ${effects.join(', ') || 'ninguno'}`);

  if (mode === 'insert') {
    const dir = $('insertDir').value || 'left';
    const gen = new InsertTextGenerator({
      canvas, ctx, lines, framesPerPhase: framesCount, dir, fontFamily, effects, baseName
    });
    const res = await gen.generate();
    frames.push(...res);
  } else {
    const gen = new BackgroundTextGenerator({
      canvas, ctx, lines, framesPerPhase: framesCount, fontFamily, effects, baseName
    });
    const res = await gen.generate();
    frames.push(...res);
  }

  currentFrame = 0;
  showFrame(0);
  log(`Generadas ${frames.length} imágenes (${frames[0]?.name || 'sin nombre'} ...).`);
}

$('generateBtn').onclick = async () => {
  // ensure font is loaded if user just selected it
  if ($('fontFile').files && $('fontFile').files[0]) {
    // load again to be safe (loadFontFromFile handles duplicates but returns a new family)
    uploadedFontFamily = await loadFontFromFile($('fontFile').files[0]);
  }
  await generateAll();
};

function showFrame(i) {
  if (!frames.length) { clearPreview(); $('frameInfo').textContent = 'Frame 0 / 0'; return; }
  const obj = frames[i];
  const img = new Image();
  img.src = URL.createObjectURL(obj.blob);
  img.onload = () => {
    // draw onto canvas (preserve transparency)
    clearPreview();
    ctx.drawImage(img, 0, 0);
  };
  $('frameInfo').textContent = `Frame ${i + 1} / ${frames.length} — ${obj.name}`;
}

$('nextFrame').onclick = () => {
  if (!frames.length) return;
  currentFrame = (currentFrame + 1) % frames.length;
  showFrame(currentFrame);
};
$('prevFrame').onclick = () => {
  if (!frames.length) return;
  currentFrame = (currentFrame - 1 + frames.length) % frames.length;
  showFrame(currentFrame);
};

$('playPause').onclick = () => {
  if (!frames.length) return;
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
    $('playPause').textContent = 'Play';
  } else {
    $('playPause').textContent = 'Pausa';
    playInterval = setInterval(() => {
      currentFrame = (currentFrame + 1) % frames.length;
      showFrame(currentFrame);
    }, 100);
  }
};

$('downloadZipBtn').onclick = async () => {
  if (!frames.length) { log('No hay frames para descargar.'); return; }
  const zip = new JSZip();
  for (const f of frames) zip.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${$('baseName').value || 'text'}_frames.zip`);
  log('ZIP listo para descargar.');
};

// initialize preview
clearPreview();
