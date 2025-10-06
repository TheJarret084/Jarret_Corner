// script.js - BG usa '|' como separador, ciclo cubre todo el lienzo con wrap-around
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
let uploadedBgImage = null; // { img, url }

const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

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

// ---------- Font loading ----------
async function loadFontFromFile(file) {
  if (!file) return null;
  const name = 'UploadedFont_' + Date.now();
  const url = URL.createObjectURL(file);
  try {
    const ff = new FontFace(name, `url(${url})`);
    await ff.load();
    document.fonts.add(ff);
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
    uploadedFontFamily = f ? await loadFontFromFile(f) : null;
  };
}

// ---------- Background image ----------
if ($('bgImageFile')) {
  $('bgImageFile').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) {
      if (uploadedBgImage?.url) URL.revokeObjectURL(uploadedBgImage.url);
      uploadedBgImage = null; updateBgPreviewInfo(); showFrame(currentFrame);
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      if (uploadedBgImage?.url) URL.revokeObjectURL(uploadedBgImage.url);
      uploadedBgImage = { img, url };
      updateBgPreviewInfo();
      log(`Imagen de fondo cargada: ${f.name}`);
      showFrame(currentFrame);
    };
    img.onerror = () => {
      log('Error cargando imagen de fondo.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
}
if ($('clearBgBtn')) {
  $('clearBgBtn').onclick = () => {
    if (uploadedBgImage?.url) URL.revokeObjectURL(uploadedBgImage.url);
    uploadedBgImage = null;
    if ($('bgImageFile')) $('bgImageFile').value = '';
    updateBgPreviewInfo(); showFrame(currentFrame);
  };
}
function updateBgPreviewInfo() {
  const el = $('bgPreviewInfo');
  if (!el) return;
  if (uploadedBgImage?.img) el.textContent = `Imagen de fondo: ${uploadedBgImage.img.width}x${uploadedBgImage.img.height}`;
  else el.textContent = 'Imagen de fondo: (ninguna)';
}
function drawBackgroundImage(mode) {
  if (!uploadedBgImage?.img) return;
  if ($('transparentBg')?.checked) return;
  const img = uploadedBgImage.img;
  const w = canvas.width, h = canvas.height;
  if (mode === 'cover') {
    const scale = Math.max(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  } else if (mode === 'contain') {
    const scale = Math.min(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  } else if (mode === 'center') {
    ctx.drawImage(img, (w - img.width) / 2, (h - img.height) / 2);
  } else if (mode === 'tile') {
    const p = ctx.createPattern(img, 'repeat');
    ctx.save(); ctx.fillStyle = p; ctx.fillRect(0, 0, w, h); ctx.restore();
  } else {
    // fallback cover
    const scale = Math.max(w / img.width, h / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  }
}

// ---------- Helpers: parse lines, draw, effects ----------
function getSelectedEffects() {
  return [...document.querySelectorAll('.fx:checked')].map(i => i.value);
}

// NEW: BG separator is pipe '|'
function parseLinesForBG(raw) {
  const paragraphs = (raw || '').split(/\r?\n/);
  const lines = [];
  for (const p of paragraphs) {
    // split by pipe '|' and ignore empty pieces. pipe is not printed.
    const parts = p.split('|').map(s => s.trim()).filter(Boolean);
    for (const part of parts) lines.push(part);
  }
  return lines;
}
function parseLinesSimple(raw) {
  return (raw || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
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
  out.x = out.x ?? 0; out.y = out.y ?? 0; out.scale = out.scale ?? 1; out.alpha = out.alpha ?? 1; out.rotate = out.rotate ?? 0;
  for (const e of effects) {
    switch (e) {
      case 'shake':
        out.x += Math.sin(t * 10) * 4; out.y += Math.cos(t * 9) * 4; break;
      case 'pulse':
        out.scale = out.scale * (1 + 0.08 * Math.sin(t * 2)); break;
      case 'bounce':
        if (mode === 'insert') out.x += Math.sin(t * 3) * 12 * (0.5 + 0.5 * (1 - Math.abs(2 * p - 1)));
        else out.y += Math.sin(t * 2) * 6;
        break;
      case 'fade':
        out.alpha = out.alpha * (0.6 + 0.4 * (Math.sin(t * 2) * 0.5 + 0.5)); break;
    }
  }
  return out;
}

// ---------- InsertTextAnimator (unchanged behavior, horizontal movement) ----------
class InsertTextAnimator {
  constructor({ canvas, ctx, lines, framesPerPhase, dir = 'left', effects = [], baseName = 'text', fontFamily = null }) {
    this.canvas = canvas; this.ctx = ctx; this.lines = lines;
    this.framesPerPhase = Math.max(1, framesPerPhase); this.dir = dir;
    this.effects = effects; this.baseName = baseName;
    this.fontFamily = fontFamily || uploadedFontFamily || 'Arial';
  }
  async generate() {
    const res = []; const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(8, +($('fontSize')?.value || 36)); this.ctx.font = `${fontSize}px '${this.fontFamily}'`;
    const maxTextW = measureMaxTextWidth(this.lines, this.fontFamily);
    const offGap = 60;
    const startX = (this.dir === 'left') ? -maxTextW - offGap : w + maxTextW + offGap;
    const centerX = w / 2, centerY = h / 2, lineSpacing = fontSize + 6;

    // entrada
    for (let f=0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked) { ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const baseLines = this.lines.map((t,i) => {
        const y = centerY + (i * lineSpacing) - ((this.lines.length-1)*lineSpacing/2);
        const x = startX + (centerX - startX) * p;
        return { text: t, x, y, alpha: 1, scale: 1 };
      });
      const eff = baseLines.map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(eff, this.fontFamily);
      const blob = await canvasToBlob();
      res.push({ blob, name: `${this.baseName}-insert_entrada${pad(f)}.png` });
    }

    // ciclo
    let lastLayout = [];
    for (let f=0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked) { ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const baseLines = this.lines.map((t,i) => {
        const y = centerY + (i * lineSpacing) - ((this.lines.length-1)*lineSpacing/2);
        return { text: t, x: centerX, y, alpha: 1, scale: 1 };
      });
      const eff = baseLines.map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(eff, this.fontFamily);
      const blob = await canvasToBlob();
      res.push({ blob, name: `${this.baseName}-insert_ciclo${pad(f)}.png` });
      if (f === this.framesPerPhase - 1) lastLayout = eff.map(x => ({ ...x }));
    }

    // salida
    const endX = (this.dir === 'left') ? w + measureMaxTextWidth(this.lines, this.fontFamily) + offGap : -measureMaxTextWidth(this.lines, this.fontFamily) - offGap;
    for (let f=0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked) { ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const frameLines = lastLayout.map((base,i) => {
        const x = base.x + (endX - base.x) * p;
        const alpha = base.alpha * (this.effects.includes('fade') ? (1 - 0.8 * p) : base.alpha);
        return { text: base.text, x, y: base.y, alpha, scale: base.scale };
      }).map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(frameLines, this.fontFamily);
      const blob = await canvasToBlob();
      res.push({ blob, name: `${this.baseName}-insert_salida${pad(f)}.png` });
    }

    return res;
  }
}

// ---------- BGTextAnimator (new tiling-wrap behavior) ----------
class BGTextAnimator {
  constructor({ canvas, ctx, lines, framesPerPhase, effects = [], baseName = 'text', fontFamily = null }) {
    this.canvas = canvas; this.ctx = ctx; this.lines = lines;
    this.framesPerPhase = Math.max(1, framesPerPhase);
    this.effects = effects; this.baseName = baseName;
    this.fontFamily = fontFamily || uploadedFontFamily || 'Arial';
    this.lastCyclePositions = null;
  }

  async generate() {
    const res = [];
    const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(8, +($('fontSize')?.value || 36));
    this.ctx.font = `${fontSize}px '${this.fontFamily}'`;

    const lineSpacing = fontSize + 6;
    // For each line, precompute its text width and step spacing
    const linesMeta = this.lines.map(t => {
      const tw = ctx.measureText(t).width;
      const gap = Math.max(40, Math.round(fontSize * 0.5));
      const step = tw + gap;
      // loops = how many steps needed to cover canvas width (+ buffer)
      const loops = Math.max(2, Math.ceil((w + step * 2) / step));
      return { text: t, tw, step, gap, loops };
    });

    // Phase 1: entry (fade-in)
    for (let f=0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked) { ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const baseLines = linesMeta.map((m, i) => {
        const x = w/2;
        const y = h/2 + (i * lineSpacing) - ((linesMeta.length-1) * lineSpacing / 2);
        return { text: m.text, x, y, alpha: p, scale: 1 };
      }).map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(baseLines, this.fontFamily);
      const blob = await canvasToBlob();
      res.push({ blob, name: `${this.baseName}-bg_entrada${pad(f)}.png` });
    }

    // Phase 2: ciclo (tiling + wrap-around)
    // We'll make each line repeat 'loops' times across width and shift offset across frames.
    for (let f=0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked) { ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      const frameLines = [];
      for (let i=0; i < linesMeta.length; i++) {
        const m = linesMeta[i];
        const dir = (i % 2 === 0) ? 1 : -1; // alternate directions
        const step = m.step;
        const loops = m.loops;
        // rawOffset makes the text shift by loops*step across the framesPerPhase; mapping p in [0..1] to movement across loops*step
        const rawOffset = p * step * loops;
        // mod within step to create smooth tile movement
        const offsetMod = rawOffset % step;
        // compute leftmost anchor so the repeated tiles cover canvas centered
        const leftMost = (w/2) - (loops * step) / 2;
        // apply direction: if dir===1 add offsetMod, else subtract
        const dirOffset = dir === 1 ? offsetMod : -offsetMod;
        // now place each copy j of the text
        for (let j = 0; j < loops; j++) {
          const x = leftMost + j * step + dirOffset;
          const y = h/2 + (i * lineSpacing) - ((linesMeta.length-1) * lineSpacing / 2);
          frameLines.push({ text: m.text, x, y, alpha: 1, scale: 1 });
        }
      }

      // apply effects per frame (effects apply to each copy individually)
      const effApplied = frameLines.map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(effApplied, this.fontFamily);
      const blob = await canvasToBlob();
      res.push({ blob, name: `${this.baseName}-bg_ciclo${pad(f)}.png` });
      if (f === this.framesPerPhase - 1) this.lastCyclePositions = effApplied.map(l => ({ ...l }));
    }

    // Phase 3: salida (fade out using last cycle positions)
    const basePositions = this.lastCyclePositions || this.lines.map((t,i) => {
      const y = h/2 + (i * lineSpacing) - ((this.lines.length-1) * lineSpacing / 2);
      return { text: t, x: w/2, y, alpha: 1, scale: 1 };
    });

    for (let f=0; f < this.framesPerPhase; f++) {
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked) { ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      // basePositions may contain many repeated copies; fade all out uniformly
      const frameLines = basePositions.map(base => ({ text: base.text, x: base.x, y: base.y, alpha: base.alpha * (1 - p), scale: base.scale }));
      const eff = frameLines.map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(eff, this.fontFamily);
      const blob = await canvasToBlob();
      res.push({ blob, name: `${this.baseName}-bg_salida${pad(f)}.png` });
    }

    return res;
  }
}

// ---------- UI wiring ----------
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
  log(`Generación completada. Frames totales: ${frames.length}`);
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
    if (!$('transparentBg')?.checked) { ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,canvas.width,canvas.height); } else ctx.clearRect(0,0,canvas.width,canvas.height);
    if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
  };
  if ($('frameInfo')) $('frameInfo').textContent = `Frame ${i + 1} / ${frames.length} — ${obj.name}`;
}

if ($('nextFrame')) $('nextFrame').onclick = () => { if (!frames.length) return; currentFrame = (currentFrame + 1) % frames.length; showFrame(currentFrame); };
if ($('prevFrame')) $('prevFrame').onclick = () => { if (!frames.length) return; currentFrame = (currentFrame - 1 + frames.length) % frames.length; showFrame(currentFrame); };
if ($('playPause')) $('playPause').onclick = () => {
  if (!frames.length) return;
  if (playInterval) { clearInterval(playInterval); playInterval = null; $('playPause').textContent = 'Play'; }
  else { $('playPause').textContent = 'Pausa'; playInterval = setInterval(()=>{ currentFrame = (currentFrame + 1) % frames.length; showFrame(currentFrame); }, 100); }
};

if ($('downloadZipBtn')) {
  $('downloadZipBtn').onclick = async () => {
    if (!frames.length) { log('No hay frames para descargar.'); return; }
    const zip = new JSZip();
    for (const f of frames) zip.file(f.name, f.blob);
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${$('baseName')?.value || 'text'}_frames.zip`);
    log('ZIP generado y listo.');
  };
}

// init
clearPreview();
updateBgPreviewInfo();
log('Script listo — modo BG ahora usa \"|\" como separador y el ciclo cubre todo el lienzo con wrap-around.');
