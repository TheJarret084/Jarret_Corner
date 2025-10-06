// script.js — actualizado: BG usa '|' separador, movimiento suave por speed, fade-out final,
// color de texto aplicado desde UI, imagen de fondo soportada, font loading robusto,
// export individual PNGs + ZIP, preview y playback.

const $ = id => document.getElementById(id);
const logEl = $('log');
const pad = (n, w = 4) => String(n).padStart(w, '0');
const log = (m) => { const t = new Date().toLocaleTimeString(); if (logEl) logEl.textContent = `${t} — ${m}\n` + logEl.textContent; };

let frames = [];
let currentFrame = 0;
let playInterval = null;
let uploadedFontFamily = null;
let uploadedBgImage = null;

const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');

function setCanvasSizeFromInputs(){
  const w = Math.max(1, +($('canvasW')?.value || 512));
  const h = Math.max(1, +($('canvasH')?.value || 128));
  canvas.width = w; canvas.height = h;
}
setCanvasSizeFromInputs();
if ($('canvasW')) $('canvasW').onchange = setCanvasSizeFromInputs;
if ($('canvasH')) $('canvasH').onchange = setCanvasSizeFromInputs;

function clearPreview(){
  if (!$('transparentBg')?.checked){
    ctx.fillStyle = $('bgColor')?.value || '#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else ctx.clearRect(0,0,canvas.width,canvas.height);
}

// ---------- Font loading ----------
async function loadFontFromFile(file){
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
    log('Error cargando fuente: ' + (err?.message || err));
    return null;
  }
}
if ($('fontFile')) $('fontFile').onchange = async e => {
  const f = e.target.files[0];
  uploadedFontFamily = f ? await loadFontFromFile(f) : null;
};

// ---------- Background image ----------
if ($('bgImageFile')) {
  $('bgImageFile').onchange = e => {
    const f = e.target.files[0];
    if (!f) {
      if (uploadedBgImage?.url) URL.revokeObjectURL(uploadedBgImage.url);
      uploadedBgImage = null; updateBgPreviewInfo(); showFrame(currentFrame); return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      if (uploadedBgImage?.url) URL.revokeObjectURL(uploadedBgImage.url);
      uploadedBgImage = { img, url };
      updateBgPreviewInfo(); log(`Imagen cargada: ${f.name}`); showFrame(currentFrame);
    };
    img.onerror = () => { log('Error cargando imagen de fondo'); URL.revokeObjectURL(url); };
    img.src = url;
  };
}
if ($('clearBgBtn')) $('clearBgBtn').onclick = () => {
  if (uploadedBgImage?.url) URL.revokeObjectURL(uploadedBgImage.url);
  uploadedBgImage = null; if ($('bgImageFile')) $('bgImageFile').value = '';
  updateBgPreviewInfo(); showFrame(currentFrame);
};
function updateBgPreviewInfo(){
  const el = $('bgPreviewInfo');
  if (!el) return;
  if (uploadedBgImage && uploadedBgImage.img) el.textContent = `Imagen de fondo: ${uploadedBgImage.img.width}x${uploadedBgImage.img.height}`;
  else el.textContent = 'Imagen de fondo: (ninguna)';
}
function drawBackgroundImage(mode){
  if (!uploadedBgImage || !uploadedBgImage.img) return;
  if ($('transparentBg')?.checked) return;
  const img = uploadedBgImage.img;
  const w = canvas.width, h = canvas.height;
  if (mode === 'cover') {
    const scale = Math.max(w/img.width, h/img.height);
    const iw = img.width*scale, ih = img.height*scale;
    ctx.drawImage(img, (w-iw)/2, (h-ih)/2, iw, ih);
  } else if (mode === 'contain') {
    const scale = Math.min(w/img.width, h/img.height);
    const iw = img.width*scale, ih = img.height*scale;
    ctx.drawImage(img, (w-iw)/2, (h-ih)/2, iw, ih);
  } else if (mode === 'center') {
    ctx.drawImage(img, (w-img.width)/2, (h-img.height)/2);
  } else if (mode === 'tile') {
    const pat = ctx.createPattern(img, 'repeat');
    ctx.save(); ctx.fillStyle = pat; ctx.fillRect(0,0,w,h); ctx.restore();
  } else {
    const scale = Math.max(w/img.width, h/img.height);
    const iw = img.width*scale, ih = img.height*scale;
    ctx.drawImage(img, (w-iw)/2, (h-ih)/2, iw, ih);
  }
}

// ---------- Helpers ----------
function getSelectedEffects(){ return [...document.querySelectorAll('.fx:checked')].map(i => i.value); }
function parseLinesForBG(raw){
  // separator is pipe '|' (not printed)
  const paragraphs = (raw||'').split(/\r?\n/);
  const lines = [];
  for (const p of paragraphs){
    const parts = p.split('|').map(s => s.trim()).filter(Boolean);
    for (const part of parts) lines.push(part);
  }
  return lines;
}
function parseLinesSimple(raw){
  return (raw||'').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function drawLines(items, fontFamily){
  const fontSize = Math.max(6, +($('fontSize')?.value || 36));
  const family = fontFamily || uploadedFontFamily || 'Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = $('textColor')?.value || '#fff';
  ctx.font = `${fontSize}px '${family}'`;
  for (const l of items){
    ctx.save();
    ctx.globalAlpha = (l.alpha==null)?1:l.alpha;
    ctx.translate(l.x, l.y);
    ctx.scale(l.scale==null?1:l.scale, l.scale==null?1:l.scale);
    ctx.rotate(l.rotate==null?0:l.rotate);
    ctx.fillText(l.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
async function canvasToBlob(){ return await new Promise(res => canvas.toBlob(b => res(b), 'image/png')); }
function measureMaxTextWidth(lines, fontFamily){
  const fontSize = Math.max(6, +($('fontSize')?.value || 36));
  ctx.font = `${fontSize}px '${fontFamily||uploadedFontFamily||'Arial'}'`;
  let max=0; for (const t of lines){ const w = ctx.measureText(t).width; if (w>max) max=w; } return max;
}

// apply combined effects (bounce horizontal for insert, subtle vertical for bg)
function applyEffects(base, effects, p, mode){
  const t = p * Math.PI * 2;
  const out = { ...base };
  out.x = out.x ?? 0; out.y = out.y ?? 0; out.scale = out.scale ?? 1; out.alpha = out.alpha ?? 1; out.rotate = out.rotate ?? 0;
  for (const e of effects){
    switch(e){
      case 'shake': out.x += Math.sin(t*10)*4; out.y += Math.cos(t*9)*4; break;
      case 'pulse': out.scale = out.scale * (1 + 0.08 * Math.sin(t*2)); break;
      case 'bounce':
        if (mode==='insert') out.x += Math.sin(t*3) * 12 * (0.5 + 0.5*(1 - Math.abs(2*p-1)));
        else out.y += Math.sin(t*2)*6;
        break;
      case 'fade': out.alpha = out.alpha * (0.6 + 0.4 * (Math.sin(t*2)*0.5 + 0.5)); break;
    }
  }
  return out;
}

// ---------- InsertTextAnimator (unchanged semantics) ----------
class InsertTextAnimator {
  constructor({canvas, ctx, lines, framesPerPhase, dir='left', effects=[], baseName='text', fontFamily=null}){
    this.canvas = canvas; this.ctx = ctx; this.lines = lines;
    this.framesPerPhase = Math.max(1, framesPerPhase); this.dir = dir;
    this.effects = effects; this.baseName = baseName;
    this.fontFamily = fontFamily || uploadedFontFamily || 'Arial';
  }
  async generate(){
    const out = []; const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(6, +($('fontSize')?.value || 36));
    this.ctx.font = `${fontSize}px '${this.fontFamily}'`;
    const maxTextW = measureMaxTextWidth(this.lines, this.fontFamily);
    const offGap = 60;
    const startX = (this.dir==='left') ? -maxTextW - offGap : w + maxTextW + offGap;
    const centerX = w/2, centerY = h/2, lineSpacing = fontSize + 6;

    // Entrada
    for (let f=0; f < this.framesPerPhase; f++){
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked){ ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const baseLines = this.lines.map((t,i)=> {
        const y = centerY + (i*lineSpacing) - ((this.lines.length-1)*lineSpacing/2);
        const x = startX + (centerX-startX)*p;
        return { text: t, x, y, alpha:1, scale:1 };
      });
      const eff = baseLines.map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(eff, this.fontFamily);
      const blob = await canvasToBlob(); out.push({ blob, name: `${this.baseName}-insert_entrada${pad(f)}.png` });
    }

    // Ciclo
    let lastLayout = [];
    for (let f=0; f < this.framesPerPhase; f++){
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked){ ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const baseLines = this.lines.map((t,i)=> {
        const y = centerY + (i*lineSpacing) - ((this.lines.length-1)*lineSpacing/2);
        return { text: t, x: centerX, y, alpha:1, scale:1 };
      });
      const eff = baseLines.map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(eff, this.fontFamily);
      const blob = await canvasToBlob(); out.push({ blob, name: `${this.baseName}-insert_ciclo${pad(f)}.png` });
      if (f === this.framesPerPhase-1) lastLayout = eff.map(l => ({ ...l }));
    }

    // Salida (fade optional via fade effect)
    const endX = (this.dir==='left') ? w + measureMaxTextWidth(this.lines, this.fontFamily) + offGap : -measureMaxTextWidth(this.lines, this.fontFamily) - offGap;
    for (let f=0; f < this.framesPerPhase; f++){
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked){ ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const frameLines = lastLayout.map(base => {
        const x = base.x + (endX - base.x) * p;
        const alpha = base.alpha * (this.effects.includes('fade') ? (1 - 0.8 * p) : base.alpha);
        return { text: base.text, x, y: base.y, alpha, scale: base.scale };
      }).map(b => applyEffects(b, this.effects, p, 'insert'));
      drawLines(frameLines, this.fontFamily);
      const blob = await canvasToBlob(); out.push({ blob, name: `${this.baseName}-insert_salida${pad(f)}.png` });
    }

    return out;
  }
}

// ---------- BGTextAnimator (tiles + smooth wrap; final fade uses last cycle frame) ----------
class BGTextAnimator {
  constructor({canvas, ctx, lines, framesPerPhase, effects=[], baseName='text', fontFamily=null, speed=1}) {
    this.canvas = canvas; this.ctx = ctx; this.lines = lines;
    this.framesPerPhase = Math.max(1, framesPerPhase);
    this.effects = effects; this.baseName = baseName;
    this.fontFamily = fontFamily || uploadedFontFamily || 'Arial';
    this.speed = Math.max(0.1, speed);
    this.lastCyclePositions = null;
  }

  async generate(){
    const out = []; const w = this.canvas.width, h = this.canvas.height;
    const fontSize = Math.max(6, +($('fontSize')?.value || 36));
    this.ctx.font = `${fontSize}px '${this.fontFamily}'`;
    const lineSpacing = fontSize + 6;

    // Precompute metadata for tiling per line
    const meta = this.lines.map(t => {
      const tw = ctx.measureText(t).width;
      const gap = Math.max(40, Math.round(fontSize * 0.5));
      const step = Math.max( Math.round(tw + gap), 1 );
      // estimate loops to cover width + buffer
      const loops = Math.max(2, Math.ceil((w + step*2)/step));
      return { text: t, tw, gap, step, loops };
    });

    // Phase 1: entrada (fade in)
    for (let f=0; f < this.framesPerPhase; f++){
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked){ ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const baseLines = meta.map((m,i) => {
        const x = w/2;
        const y = h/2 + (i*lineSpacing) - ((meta.length-1)*lineSpacing/2);
        return { text: m.text, x, y, alpha: p, scale: 1 };
      }).map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(baseLines, this.fontFamily);
      const blob = await canvasToBlob(); out.push({ blob, name: `${this.baseName}-bg_entrada${pad(f)}.png` });
    }

    // Phase 2: ciclo (smooth tiled movement)
    // We'll shift each line by shift = (frameIndex/framesPerPhase) * step * speed
    for (let f=0; f < this.framesPerPhase; f++){
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked){ ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');

      const frameCopies = [];
      for (let i=0; i < meta.length; i++){
        const m = meta[i];
        const dir = (i % 2 === 0) ? 1 : -1; // alternate direction per line
        const step = m.step;
        const loops = m.loops;
        // shift across frames: total shift across one phase = step * speed
        const totalShift = this.speed * step;
        const shift = (f / this.framesPerPhase) * totalShift;
        // For each loop/replica, compute x position then wrap into tile coverage region
        // leftMost anchor so the set of copies is centered
        const totalWidth = loops * step;
        const leftMost = (w/2) - (totalWidth/2);
        // direction: dir=1 move left->right visually, we'll subtract shift for dir=1 and add for dir=-1
        const dirOffset = dir === 1 ? -shift : shift;
        for (let j=0; j<loops; j++){
          // initial x without wrapping
          let raw = leftMost + j * step + dirOffset;
          // wrap raw into [leftMost, leftMost + totalWidth)
          let rel = ((raw - leftMost) % totalWidth + totalWidth) % totalWidth;
          const x = leftMost + rel;
          const y = h/2 + (i*lineSpacing) - ((meta.length-1)*lineSpacing/2);
          frameCopies.push({ text: m.text, x, y, alpha: 1, scale: 1 });
        }
      }
      // apply effects (per copy)
      const applied = frameCopies.map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(applied, this.fontFamily);
      const blob = await canvasToBlob(); out.push({ blob, name: `${this.baseName}-bg_ciclo${pad(f)}.png` });
      if (f === this.framesPerPhase - 1) this.lastCyclePositions = applied.map(x => ({ ...x }));
    }

    // Phase 3: salida (fade out from lastCyclePositions)
    const basePositions = this.lastCyclePositions || meta.map((m,i) => {
      const y = h/2 + (i*lineSpacing) - ((meta.length-1)*lineSpacing/2);
      return { text: m.text, x: w/2, y, alpha: 1, scale: 1 };
    });

    for (let f=0; f < this.framesPerPhase; f++){
      const p = (this.framesPerPhase===1)?1:(f/(this.framesPerPhase-1));
      if (!$('transparentBg')?.checked){ ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,w,h); } else ctx.clearRect(0,0,w,h);
      if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
      const frame = basePositions.map(b => ({ text: b.text, x: b.x, y: b.y, alpha: (b.alpha || 1) * (1 - p), scale: b.scale }));
      const eff = frame.map(b => applyEffects(b, this.effects, p, 'bg'));
      drawLines(eff, this.fontFamily);
      const blob = await canvasToBlob(); out.push({ blob, name: `${this.baseName}-bg_salida${pad(f)}.png` });
    }

    return out;
  }
}

// ---------- UI wiring ----------
async function generateAllFrames(){
  frames = [];
  const baseName = ($('baseName')?.value || '').trim() || 'text';
  const mode = $('mode')?.value || 'insert';
  const framesPerPhase = Math.max(1, +($('framesCount')?.value || 24));
  const effects = getSelectedEffects();
  const speed = Math.max(0.1, +($('bgSpeed')?.value || 1));
  const fontFamily = uploadedFontFamily || null;

  let lines = [];
  if (mode === 'bg') lines = parseLinesForBG($('inputText')?.value || '');
  else lines = parseLinesSimple($('inputText')?.value || '');

  if (!lines.length) { log('No hay texto para generar.'); return; }

  ctx.font = `${Math.max(6, +($('fontSize')?.value || 36))}px '${fontFamily || uploadedFontFamily || 'Arial'}'`;

  log(`Generando modo "${mode}" — ${framesPerPhase} frames/phase — efectos: ${effects.join(',') || 'ninguno'} — speed: ${speed}`);

  if (mode === 'insert'){
    const dir = $('insertDir')?.value || 'left';
    const gen = new InsertTextAnimator({ canvas, ctx, lines, framesPerPhase, dir, effects, baseName, fontFamily });
    const res = await gen.generate();
    frames.push(...res);
  } else {
    const gen = new BGTextAnimator({ canvas, ctx, lines, framesPerPhase, effects, baseName, fontFamily, speed });
    const res = await gen.generate();
    frames.push(...res);
  }

  currentFrame = 0;
  showFrame(0);
  log(`Generación completa. Frames: ${frames.length}`);
}

if ($('generateBtn')) {
  $('generateBtn').onclick = async () => {
    if ($('fontFile') && $('fontFile').files && $('fontFile').files[0]) uploadedFontFamily = await loadFontFromFile($('fontFile').files[0]);
    await generateAllFrames();
  };
}

function showFrame(i){
  if (!frames.length) { clearPreview(); if ($('frameInfo')) $('frameInfo').textContent = 'Frame 0 / 0'; return; }
  const obj = frames[i]; const img = new Image();
  img.src = URL.createObjectURL(obj.blob);
  img.onload = () => {
    if (!$('transparentBg')?.checked){ ctx.fillStyle = $('bgColor')?.value || '#000'; ctx.fillRect(0,0,canvas.width,canvas.height); } else ctx.clearRect(0,0,canvas.width,canvas.height);
    if (uploadedBgImage?.img) drawBackgroundImage($('bgImageMode')?.value || 'cover');
    ctx.drawImage(img, 0, 0); URL.revokeObjectURL(img.src);
  };
  if ($('frameInfo')) $('frameInfo').textContent = `Frame ${i+1} / ${frames.length} — ${obj.name}`;
}

if ($('nextFrame')) $('nextFrame').onclick = () => { if (!frames.length) return; currentFrame = (currentFrame + 1) % frames.length; showFrame(currentFrame); };
if ($('prevFrame')) $('prevFrame').onclick = () => { if (!frames.length) return; currentFrame = (currentFrame - 1 + frames.length) % frames.length; showFrame(currentFrame); };
if ($('playPause')) $('playPause').onclick = () => {
  if (!frames.length) return;
  if (playInterval) { clearInterval(playInterval); playInterval = null; $('playPause').textContent = 'Play'; }
  else { $('playPause').textContent = 'Pausa'; playInterval = setInterval(()=>{ currentFrame = (currentFrame + 1) % frames.length; showFrame(currentFrame); }, 100); }
};

if ($('downloadAllBtn')) {
  $('downloadAllBtn').onclick = async () => {
    if (!frames.length) { log('No hay PNGs generados.'); return; }
    // save each frame individually
    for (let i=0;i<frames.length;i++){
      const aName = frames[i].name;
      const blob = frames[i].blob;
      saveAs(blob, aName);
    }
    log('Descarga individual completada.');
  };
}

if ($('downloadZipBtn')) {
  $('downloadZipBtn').onclick = async () => {
    if (!frames.length) { log('No hay frames para descargar.'); return; }
    const zip = new JSZip();
    for (const f of frames) zip.file(f.name, f.blob);
    const blob = await zip.generateAsync({ type:'blob' });
    saveAs(blob, `${$('baseName')?.value || 'text'}_frames.zip`);
    log('ZIP generado.');
  };
}

// init UI
clearPreview(); updateBgPreviewInfo(); log('Script cargado — listo.');
