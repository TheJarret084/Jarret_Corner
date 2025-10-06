// script.js - Actualizado: toggle de separador para modo BG (coma / punto / ambos)
// Inserta automáticamente un select en la UI si no existe.
// Basado en la versión previa (font loading, bg image, InsertTextAnimator, BGTextAnimator, export ZIP, preview).

const $ = id => document.getElementById(id);
const logEl = $('log');
const log = (m) => {
  const t = new Date().toLocaleTimeString();
  if (logEl) logEl.textContent = `${t} — ${m}\n` + logEl.textContent;
};
const pad = (n, w = 4) => String(n).padStart(w, '0');

let frames = [];
let currentFrame = 0;
let playInterval = null;
let uploadedFontFamily = null;
let uploadedBgImage = null; // { img: Image, url: objectURL }

const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

// --- Ensure canvas size sync
function setCanvasSizeFromInputs() {
  const w = Math.max(1, +($('canvasW')?.value || 512));
  const h = Math.max(1, +($('canvasH')?.value || 128));
  canvas.width = w;
  canvas.height = h;
}
setCanvasSizeFromInputs();
if ($('canvasW')) $('canvasW').onchange = setCanvasSizeFromInputs;
if ($('canvasH')) $('canvasH').onchange = setCanvasSizeFromInputs;

function clearPreview() {
  if (!$('transparentBg')?.checked) {
    ctx.fillStyle = $('bgColor')?.value || '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ---------------- Inject BG separator selector into UI if missing ----------------
(function ensureBGSeparatorControl() {
  // if there's already an element with id 'bgSeparator', do nothing
  if ($('bgSeparator')) return;
  // find sidebar to insert into
  const sidebar = document.querySelector('.sidebar') || document.body;
  // create container
  const wrapper = document.createElement('div');
  wrapper.style.marginTop = '8px';
  wrapper.style.fontSize = '13px';
  wrapper.style.color = '#a9c0d9';
  wrapper.innerHTML = `<label for="bgSeparator" style="display:block;margin-top:10px">Separador (modo BG)</label>`;
  const select = document.createElement('select');
  select.id = 'bgSeparator';
  select.style.width = '100%';
  select.style.padding = '8px';
  select.innerHTML = `
    <option value="comma">Coma (',') — nueva línea por coma</option>
    <option value="dot">Punto ('.') — nueva línea por punto</option>
    <option value="both">Ambos (',' y '.')</option>
  `;
  wrapper.appendChild(select);
  // try to place it after bgPreviewInfo if exists
  const ref = document.getElementById('bgPreviewInfo');
  if (ref && ref.parentNode) ref.parentNode.insertBefore(wrapper, ref.nextSibling);
  else sidebar.appendChild(wrapper);
  // default to comma
  select.value = 'comma';
})();

// ---------------- Font loading ----------------
async function loadFontFromFile(file) {
  if (!file) return null;
  const name = 'UploadedFont_' + Date.now();
  const url = URL.createObjectURL(file);
  try {
    const fontFace = new FontFace(name, `url(${url})`);
    await fontFace.load();
    document.fonts.add(fontFace);
    await document.fonts.ready;
    log(`Fuente cargada: ${file.name} (${name})`);
    return name;
  } catch (err) {
    log(`Error cargando fuente: ${err?.message || err}`);
    return null;
  }
}
if ($('fontFile')) {
  $('fontFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) { uploadedFontFamily = null; return; }
    uploadedFontFamily = await loadFontFromFile(f);
  };
}

// ---------------- Background image loading ----------------
if ($('bgImageFile')) {
  $('bgImageFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) {
      if (uploadedBgImage && uploadedBgImage.url) URL.revokeObjectURL(uploadedBgImage.url);
      uploadedBgImage = null; updateBgPreviewInfo(); return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      if (uploadedBgImage && uploadedBgImage.url) URL.revokeObjectURL(uploadedBgImage.url);
      uploadedBgImage = { img, url };
      updateBgPreviewInfo();
      log(`Imagen de fondo cargada: ${f.name}`);
      showFrame(currentFrame);
    };
    img.onerror = () => {
      log('Error cargando la imagen de fondo.');
      if (url) URL.revokeObjectURL(url);
    };
  };
}

if ($('clearBgBtn')) {
  $('clearBgBtn').onclick = () => {
    if (uploadedBgImage && uploadedBgImage.url) URL.revokeObjectURL(uploadedBgImage.url);
    uploadedBgImage = null;
    if ($('bgImageFile')) $('bgImageFile').value = '';
    updateBgPreviewInfo();
    showFrame(currentFrame);
  };
}

function updateBgPreviewInfo() {
  const el = $('bgPreviewInfo');
  if (!el) return;
  if (uploadedBgImage && uploadedBgImage.img) {
    el.textContent = `Imagen de fondo: ${uploadedBgImage.img.width}x${uploadedBgImage.img.height}`;
  } else {
    el.textContent = 'Imagen de fondo: (ninguna)';
  }
}

// draw background image according to mode
function drawBackgroundImage(mode) {
  if (!uploadedBgImage || !uploadedBgImage.img) return;
  if ($('transparentBg') && $('transparentBg').checked) return; // ignore if transparent requested
  const img = uploadedBgImage.img;
  const w = canvas.width, h = canvas.height;

  if (mode === 'cover') {
    const scale = Math.max(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    const x = (w - iw) / 2, y = (h - ih) / 2;
    ctx.drawImage(img, x, y, iw, ih);
  } else if (mode === 'contain') {
    const scale = Math.min(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    const x = (w - iw) / 2, y = (h - ih) / 2;
    ctx.drawImage(img, x, y, iw, ih);
  } else if (mode === 'center') {
    const x = (w - img.width) / 2, y = (h - img.height) / 2;
    ctx.drawImage(img, x, y);
  } else if (mode === 'tile') {
    const pattern = ctx.createPattern(img, 'repeat');
    ctx.save();
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else {
    const scale = Math.max(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    const x = (w - iw) / 2, y = (h - ih) / 2;
    ctx.drawImage(img, x, y, iw, ih);
  }
}

// ---------------- Helpers de texto y efectos ----------------
function getSelectedEffects() {
  return [...document.querySelectorAll('.fx:checked')].map(i => i.value);
}

// ---------- parseLinesForBG ahora soporta separador dinámico (coma / punto / ambos) ----------
function parseLinesForBG(raw) {
  const sepControl = $('bgSeparator');
  const sep = sepControl ? sepControl.value : 'comma';
  const paragraphs = raw.split(/\r?\n/);
  const lines = [];
  for (const p of paragraphs) {
    let parts = [];
    if (sep === 'comma') {
      parts = p.split(',').map(s => s.trim()).filter(Boolean);
    } else if (sep === 'dot') {
      parts = p.split('.').map(s => s.trim()).filter(Boolean);
    } else { // both
      parts = p.split(/[.,]/).map(s => s.trim()).filter(Boolean);
    }
    for (const part of parts) lines.push(part);
  }
  return lines;
}

function parseLinesSimple(raw) {
  return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function drawLines(lines, fontFamily) {
  const fontSize = Math.max(8, +($('fontSize')?.value || 36));
  const family = fontFamily || uploadedFontFamily || 'Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = $('textColor')?.value || '#fff';
  ctx.font = `${fontSize}px '${family}'`;
  for (const l of lines) {
    ctx.save();
    ctx.globalAlpha = (l.alpha == null) ? 1 : l.alpha;
    ctx.translate(l.x, l.y);
    ctx.scale(l.scale == null ? 1 : l.scale, l.scale == null ? 1 : l.scale);
    ctx.rotate(l.rotate == null ? 0 : l.rotate);
    ctx.fillText(l.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

async function canvasToBlob() {
  return await new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
}

function measureMaxTextWidth(lines, fontFamily) {
  const fontSize = Math.max(8, +($('fontSize')?.value || 36));
  ctx.font = `${fontSize}px '${fontFamily || uploadedFontFamily || 'Arial'}'`;
  let max = 0;
  for (const t of lines) {
    const w = ctx.measureText(t).width;
    if (w > max) max = w;
  }
  return max;
}

function applyEffects(base, effects, p, mode) {
  const t = p * Math.PI * 2;
  const out = { ...base };
  out.x = out.x ?? 0;
  out.y = out.y ?? 0;
  out.scale = out.scale ?? 1;
  out.alpha = out.alpha ?? 1;
  out.rotate = out.rotate ?? 0;

  for (const e of effects) {
    switch (e) {
      case 'shake':
        out.x += Math.sin(t * 10) * 4;
        out.y += Math.cos(t * 9) * 4;
        break;
      case 'pulse':
        out.scale = out.scale * (1 + 0.08 * Math.sin(t * 2));
        break;
      case 'bounce':
        if (mode === 'insert') {
          out.x += Math.sin(t * 3) * 12 * (0.5 + 0.5 * (1 - Math.abs(2 * p - 1)));
        } else {
          out.y += Math.sin(t * 2) * 6;
        }
        break;
      case 'fade':
        out.alpha = out.alpha * (0.6 + 0.4 * (Math.sin(t * 2) * 0.5 + 0.5));
        break;
    }
  }
  return out;
}

// ---------------- InsertTextAnimator ----------------
class InsertTextAnimator {
  constructor({ canvas, ctx, lines, framesPerPhase, dir = 'left', effects = [], baseName = 'text', fontFamily = null }) {
    this.canvas = canvas; this.ctx = ctx; this.lines = lines;
    this.framesPerPhase = Math.max(1, framesPerPhase); this.dir = dir;
    this.effects = effects; this.baseName = baseName;
    this.fontFamily = fontFamily || uploadedFontFamily || 'Arial';
  }

  async generate() {
    const results = [];
    const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(8, +($('fontSize')?.value || 36));
    this.ctx.font = `${fontSize}px '${this.fontFamily}'`;

    const maxTextW = measureMaxTextWidth(this.lines, this.fontFamily);
    const offGap = 60;
    const startX = (this.dir === 'left') ? -maxTextW - offGap : w + maxTextW + offGap;
    const centerX = w / 2;
    const centerY = h / 2;
    const lineSpacing = fontSize + 6;

    // Phase 1: entrada
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : f / (this.framesPerPhase - 1);
      if (!$('transparentBg')?.checked) {
        ctx.fillStyle = $('bgColor')?.value || '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      if (uploadedBgImage && uploadedBgImage.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      const baseLines = this.lines.map((t, i) => {
        const targetY = centerY + (i * lineSpacing) - ((this.lines.length - 1) * lineSpacing / 2);
        const x = startX + (centerX - startX) * p;
        return { text: t, x, y: targetY, alpha: 1, scale: 1 };
      });
      const effLines = baseLines.map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(effLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-insert_entrada${pad(f)}.png`;
      results.push({ blob, name });
    }

    // Phase 2: ciclo
    let lastCycleLayout = [];
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : f / (this.framesPerPhase - 1);
      if (!$('transparentBg')?.checked) {
        ctx.fillStyle = $('bgColor')?.value || '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      if (uploadedBgImage && uploadedBgImage.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      const baseLines = this.lines.map((t, i) => {
        const targetY = centerY + (i * lineSpacing) - ((this.lines.length - 1) * lineSpacing / 2);
        return { text: t, x: centerX, y: targetY, alpha: 1, scale: 1 };
      });
      const effLines = baseLines.map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(effLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-insert_ciclo${pad(f)}.png`;
      results.push({ blob, name });
      if (f === this.framesPerPhase - 1) lastCycleLayout = effLines.map(x => ({ ...x }));
    }

    // Phase 3: salida
    const endX = (this.dir === 'left') ? w + measureMaxTextWidth(this.lines, this.fontFamily) + offGap : -measureMaxTextWidth(this.lines, this.fontFamily) - offGap;
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : f / (this.framesPerPhase - 1);
      if (!$('transparentBg')?.checked) {
        ctx.fillStyle = $('bgColor')?.value || '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      if (uploadedBgImage && uploadedBgImage.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      const frameLines = lastCycleLayout.map((base, i) => {
        const x = base.x + (endX - base.x) * p;
        const alpha = base.alpha * (this.effects.includes('fade') ? (1 - 0.8 * p) : base.alpha);
        return { text: base.text, x, y: base.y, alpha, scale: base.scale };
      }).map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-insert_salida${pad(f)}.png`;
      results.push({ blob, name });
    }

    return results;
  }
}

// ---------------- BGTextAnimator ----------------
class BGTextAnimator {
  constructor({ canvas, ctx, lines, framesPerPhase, effects = [], baseName = 'text', fontFamily = null }) {
    this.canvas = canvas; this.ctx = ctx; this.lines = lines;
    this.framesPerPhase = Math.max(1, framesPerPhase);
    this.effects = effects; this.baseName = baseName;
    this.fontFamily = fontFamily || uploadedFontFamily || 'Arial';
    this.lastCyclePositions = null;
  }

  async generate() {
    const results = [];
    const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(8, +($('fontSize')?.value || 36));
    this.ctx.font = `${fontSize}px '${this.fontFamily}'`;

    const maxTextW = measureMaxTextWidth(this.lines, this.fontFamily);
    const travel = w + maxTextW + 200;
    const centerX = w / 2;
    const startX = -maxTextW - 100;
    const lineSpacing = fontSize + 6;

    // Entry: fade in
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : f / (this.framesPerPhase - 1);
      if (!$('transparentBg')?.checked) {
        ctx.fillStyle = $('bgColor')?.value || '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      if (uploadedBgImage && uploadedBgImage.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const baseLines = this.lines.map((t, i) => {
        const x = centerX;
        const y = h / 2 + (i * lineSpacing) - ((this.lines.length - 1) * lineSpacing / 2);
        return { text: t, x, y, alpha: p, scale: 1 };
      });
      const effLines = baseLines.map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(effLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-bg_entrada${pad(f)}.png`;
      results.push({ blob, name });
    }

    // Cycle: horizontal wrap & alternate directions
    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : f / (this.framesPerPhase - 1);
      if (!$('transparentBg')?.checked) {
        ctx.fillStyle = $('bgColor')?.value || '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      if (uploadedBgImage && uploadedBgImage.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      const frameLines = this.lines.map((t, i) => {
        const dir = (i % 2 === 0) ? 1 : -1;
        const offset = dir * (travel * (p - 0.5));
        const range = travel;
        const rawX = centerX + offset;
        let rel = (rawX - startX) % range;
        if (rel < 0) rel += range;
        const x = startX + rel;
        const y = h / 2 + (i * lineSpacing) - ((this.lines.length - 1) * lineSpacing / 2);
        return { text: t, x, y, alpha: 1, scale: 1 };
      }).map(b => applyEffects(b, this.effects, p, 'bg'));

      drawLines(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-bg_ciclo${pad(f)}.png`;
      results.push({ blob, name });
      if (f === this.framesPerPhase - 1) this.lastCyclePositions = frameLines.map(l => ({ ...l }));
    }

    // Exit: fade out from lastCyclePositions
    const basePositions = this.lastCyclePositions || this.lines.map((t, i) => {
      const y = h / 2 + (i * lineSpacing) - ((this.lines.length - 1) * lineSpacing / 2);
      return { text: t, x: centerX, y, alpha: 1, scale: 1 };
    });

    for (let f = 0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase === 1) ? 1 : f / (this.framesPerPhase - 1);
      if (!$('transparentBg')?.checked) {
        ctx.fillStyle = $('bgColor')?.value || '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      if (uploadedBgImage && uploadedBgImage.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      const frameLines = basePositions.map(base => {
        const alpha = base.alpha * (1 - p);
        return { text: base.text, x: base.x, y: base.y, alpha, scale: base.scale };
      }).map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      const name = `${this.baseName}-bg_salida${pad(f)}.png`;
      results.push({ blob, name });
    }

    return results;
  }
}

// ---------------- UI wiring ----------------
async function generateAllFrames() {
  frames = [];
  const baseName = ($('baseName')?.value || '').trim() || 'text';
  const mode = $('mode')?.value || 'insert';
  const framesPerPhase = Math.max(1, +($('framesCount')?.value || 24));
  const effects = getSelectedEffects();
  const fontFamily = uploadedFontFamily || null;

  let lines = [];
  if (mode === 'bg') lines = parseLinesForBG($('inputText')?.value || '');
  else lines = parseLinesSimple($('inputText')?.value || '');

  if (!lines.length) { log('No hay texto para generar.'); return; }

  ctx.font = `${Math.max(8, +($('fontSize')?.value || 36))}px '${fontFamily || uploadedFontFamily || 'Arial'}'`;

  log(`Generando modo "${mode}" — ${framesPerPhase} frames/phase — efectos: ${effects.join(', ') || 'ninguno'}`);

  if (mode === 'insert') {
    const dir = $('insertDir')?.value || 'left';
    const gen = new InsertTextAnimator({ canvas, ctx, lines, framesPerPhase, dir, effects, baseName, fontFamily });
    const res = await gen.generate();
    frames.push(...res);
  } else {
    const gen = new BGTextAnimator({ canvas, ctx, lines, framesPerPhase, effects, baseName, fontFamily });
    const res = await gen.generate();
    frames.push(...res);
  }

  currentFrame = 0;
  showFrame(0);
  log(`Generación completada. Frames: ${frames.length}`);
}

if ($('generateBtn')) {
  $('generateBtn').onclick = async () => {
    if ($('fontFile') && $('fontFile').files && $('fontFile').files[0]) {
      uploadedFontFamily = await loadFontFromFile($('fontFile').files[0]);
    }
    await generateAllFrames();
  };
}

function showFrame(i) {
  if (!frames.length) { clearPreview(); if ($('frameInfo')) $('frameInfo').textContent = 'Frame 0 / 0'; return; }
  const obj = frames[i];
  const img = new Image();
  img.src = URL.createObjectURL(obj.blob);
  img.onload = () => {
    if (!$('transparentBg')?.checked) {
      ctx.fillStyle = $('bgColor')?.value || '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (uploadedBgImage && uploadedBgImage.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
  };
  if ($('frameInfo')) $('frameInfo').textContent = `Frame ${i + 1} / ${frames.length} — ${obj.name}`;
}

if ($('nextFrame')) {
  $('nextFrame').onclick = () => {
    if (!frames.length) return;
    currentFrame = (currentFrame + 1) % frames.length;
    showFrame(currentFrame);
  };
}
if ($('prevFrame')) {
  $('prevFrame').onclick = () => {
    if (!frames.length) return;
    currentFrame = (currentFrame - 1 + frames.length) % frames.length;
    showFrame(currentFrame);
  };
}

if ($('playPause')) {
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
}

if ($('downloadZipBtn')) {
  $('downloadZipBtn').onclick = async () => {
    if (!frames.length) { log('No hay frames para descargar.'); return; }
    const zip = new JSZip();
    for (const f of frames) zip.file(f.name, f.blob);
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${$('baseName')?.value || 'text'}_frames.zip`);
    log('ZIP generado y listo para descargar.');
  };
}

// initialize
clearPreview();
updateBgPreviewInfo();
log('Script cargado — listo. Selector BG separador activado (coma, punto o ambos).');
