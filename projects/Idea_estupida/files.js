/* Frame Shader Baker
   - ZIP -> applies shader-like effects to every PNG
   - frag.txt -> multi-profile config with rules
   - optimized for single-pass canvas processing
*/

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    zipInput: $('zipInput'),
    cfgInput: $('cfgInput'),
    cfgText: $('cfgText'),
    frameList: $('frameList'),
    preview: $('preview'),
    status: $('status'),
    log: $('log'),
    outName: $('outName'),
    loadSample: $('loadSample'),
    exportCfg: $('exportCfg'),
    processZip: $('processZip'),
  };

  const previewCtx = els.preview.getContext('2d', { willReadFrequently: true });

  const SAMPLE_CFG = `; frag.txt sample
; Valores = máximos. El baker genera variación sin pasarse.

[global]
seed=1337
variation=0.35
randomScope=frame
background=#000000

[profile limbo]
zoom=1.00
rotation=6
hue=0.205
sat=0.12
brt=0.08
chromatic=6
glitchChance=0.22
glitchStrength=11
split=0.08
y1=0.05
y2=-0.05
noise=0.16
scanlines=0.14
shake=0.10

[profile horror]
zoom=1.00
rotation=4
hue=-0.12
sat=0.18
brt=0.05
chromatic=8
glitchChance=0.35
glitchStrength=16
split=0.10
y1=0.08
y2=-0.08
noise=0.20
scanlines=0.18
shake=0.14

[profile purple]
zoom=1.00
rotation=3
hue=0.60
sat=0.10
brt=0.03
chromatic=4
glitchChance=0.15
glitchStrength=8
split=0.04
y1=0.03
y2=-0.03
noise=0.12
scanlines=0.10
shake=0.06

[rules]
Idle*=limbo
Left*=horror
Right*=horror
Up*=purple
Down*=purple
*=limbo
`;

  const state = {
    zip: null,
    files: [],
    selectedIndex: -1,
    cfg: null,
    rawCfg: SAMPLE_CFG,
    previewToken: 0,
  };

  const DEFAULT_PROFILE = () => ({
    zoom: 1,
    rotation: 0,
    hue: 0,
    sat: 0,
    brt: 0,
    chromatic: 0,
    glitchChance: 0,
    glitchStrength: 0,
    split: 0,
    y1: 0,
    y2: 0,
    noise: 0,
    scanlines: 0,
    shake: 0,
  });

  function log(msg) {
    els.log.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + els.log.textContent;
  }

  function setStatus(msg) {
    els.status.textContent = msg;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function xorshift32(seed) {
    let x = seed >>> 0;
    return function rand() {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) / 4294967296);
    };
  }

  function wildcardToRegex(pattern) {
    const esc = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${esc}$`, 'i');
  }

  function cleanLine(line) {
    const idx = line.search(/(^|\\s)[;#]/);
    if (idx >= 0) return line.slice(0, idx).trim();
    return line.trim();
  }

  function parseKV(line) {
    const i = line.indexOf('=');
    if (i < 0) return null;
    return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  }

  function parseConfig(text) {
    const global = {};
    const profiles = new Map();
    const rules = [];
    let section = 'global';
    let currentName = 'global';

    function ensureProfile(name) {
      if (!profiles.has(name)) profiles.set(name, DEFAULT_PROFILE());
      return profiles.get(name);
    }

    const lines = text.replace(/\\r/g, '').split('\\n');
    for (let raw of lines) {
      const line = cleanLine(raw);
      if (!line) continue;

      const sec = line.match(/^\\[(.+?)\\]$/);
      if (sec) {
        const tag = sec[1].trim();
        const parts = tag.split(/\\s+/);
        section = parts[0].toLowerCase();
        currentName = parts.slice(1).join(' ').trim() || section;
        if (section === 'profile' || section === 'config') ensureProfile(currentName);
        continue;
      }

      if (section === 'rules') {
        const kv = parseKV(line);
        if (!kv) continue;
        let [pattern, profile] = kv;
        pattern = pattern.trim();
        profile = profile.trim();
        if (!pattern || !profile) continue;
        rules.push({ pattern, profile });
        continue;
      }

      const kv = parseKV(line);
      if (!kv) continue;
      const [key, value] = kv;
      const lower = key.toLowerCase();
      const target = (section === 'profile' || section === 'config') ? ensureProfile(currentName) : global;

      if (lower === 'rule' || lower === 'map') {
        const m = value.split('=>');
        if (m.length === 2) rules.push({ pattern: m[0].trim(), profile: m[1].trim() });
        continue;
      }

      if (target === global || profiles.has(currentName)) {
        target[lower] = value;
      } else {
        global[lower] = value;
      }
    }

    return {
      global: normalizeGlobal(global),
      profiles: [...profiles.entries()].map(([name, data]) => ({ name, data: normalizeProfile(data) })),
      rules: normalizeRules(rules),
    };
  }

  function normalizeGlobal(obj) {
    const out = {};
    out.seed = Number(obj.seed ?? 1337) | 0;
    out.variation = clamp(Number(obj.variation ?? 0.35), 0, 1);
    out.randomScope = String(obj.randomscope ?? obj.randomScope ?? 'frame').toLowerCase();
    out.background = String(obj.background ?? '#000000');
    out.maxFiles = Math.max(1, Number(obj.maxfiles ?? 999999) | 0);
    return out;
  }

  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function normalizeProfile(obj) {
    const p = DEFAULT_PROFILE();
    for (const k of Object.keys(p)) {
      if (k in obj) p[k] = num(obj[k], p[k]);
    }
    p.seed = num(obj.seed ?? 0, 0);
    p.variation = clamp(num(obj.variation ?? 0.35, 0.35), 0, 1);
    p.lock = String(obj.lock ?? 'false').toLowerCase() === 'true';
    return p;
  }

  function normalizeRules(rules) {
    return rules.map(r => ({
      pattern: String(r.pattern).trim(),
      profile: String(r.profile).trim(),
      regex: wildcardToRegex(String(r.pattern).trim()),
    })).filter(r => r.pattern && r.profile);
  }

  function serializeConfig(cfg) {
    const lines = [];
    lines.push('; frag.txt');
    lines.push('; Valores = máximos. El baker genera variación sin pasarse.');
    lines.push('');
    lines.push('[global]');
    lines.push(`seed=${cfg.global.seed}`);
    lines.push(`variation=${cfg.global.variation}`);
    lines.push(`randomScope=${cfg.global.randomScope}`);
    lines.push(`background=${cfg.global.background}`);
    lines.push('');

    for (const profile of cfg.profiles) {
      lines.push(`[profile ${profile.name}]`);
      const p = profile.data;
      for (const key of Object.keys(DEFAULT_PROFILE())) {
        lines.push(`${key}=${p[key]}`);
      }
      lines.push(`variation=${p.variation ?? 0.35}`);
      lines.push(`lock=${p.lock ? 'true' : 'false'}`);
      lines.push('');
    }

    lines.push('[rules]');
    if (cfg.rules.length) {
      for (const r of cfg.rules) lines.push(`${r.pattern}=${r.profile}`);
    } else {
      lines.push('*=default');
    }
    lines.push('');
    return lines.join('\\n');
  }

  function getParsedCfg() {
    return parseConfig(els.cfgText.value || SAMPLE_CFG);
  }

  function profileMap(cfg) {
    const map = new Map();
    for (const p of cfg.profiles) map.set(p.name.toLowerCase(), p.data);
    if (!map.has('default')) map.set('default', DEFAULT_PROFILE());
    return map;
  }

  function pickProfileForName(cfg, name) {
    const bare = name.toLowerCase();
    for (const rule of cfg.rules) {
      if (rule.regex.test(bare)) return rule.profile;
    }
    return cfg.profiles[0]?.name || 'default';
  }

  function splitBase(name) {
    const idx = name.lastIndexOf('.');
    const ext = idx >= 0 ? name.slice(idx).toLowerCase() : '';
    const base = idx >= 0 ? name.slice(0, idx) : name;
    return { base, ext };
  }

  function animationKey(base) {
    const m = base.match(/^(.*?)(\\d+)$/);
    if (!m) return base.toLowerCase();
    return m[1].toLowerCase();
  }

  function scopeSeed(globalSeed, profileSeed, scope, fileName, animKey) {
    let key = `${globalSeed}|${profileSeed}|${scope}|${fileName}`;
    if (scope === 'anim') key = `${globalSeed}|${profileSeed}|anim|${animKey}`;
    if (scope === 'zip') key = `${globalSeed}|${profileSeed}|zip`;
    return hashString(key);
  }

  function randRange(rand, min, max) {
    return min + (max - min) * rand();
  }

  function variedValue(base, rand, variation) {
    const abs = Math.abs(base);
    if (abs === 0) return 0;
    const spread = clamp(variation, 0, 1);
    const factor = 1 - spread + spread * rand();
    const sign = base < 0 ? -1 : 1;
    return sign * abs * factor;
  }

  function getSelectedFileEntry() {
    if (!state.zip || state.selectedIndex < 0) return null;
    return state.files[state.selectedIndex] || null;
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function hexToRgb(hex) {
    const s = String(hex).trim().replace('#', '');
    if (s.length === 3) {
      const r = parseInt(s[0] + s[0], 16);
      const g = parseInt(s[1] + s[1], 16);
      const b = parseInt(s[2] + s[2], 16);
      return [r, g, b];
    }
    if (s.length >= 6) {
      return [
        parseInt(s.slice(0, 2), 16),
        parseInt(s.slice(2, 4), 16),
        parseInt(s.slice(4, 6), 16),
      ];
    }
    return [0, 0, 0];
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d) % 6; break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
      if (h < 0) h += 1;
    }
    const s = max === 0 ? 0 : d / max;
    return [h, s, max];
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 1) + 1) % 1;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q; break;
    }
    return [r * 255, g * 255, b * 255];
  }

  function sampleRGBA(src, w, h, x, y) {
    x = x < 0 ? 0 : x >= w ? w - 1 : x;
    y = y < 0 ? 0 : y >= h ? h - 1 : y;
    const i = (y * w + x) * 4;
    return [src[i], src[i + 1], src[i + 2], src[i + 3]];
  }

  function renderPreviewForEntry(entry) {
    if (!entry || !state.zip) {
      previewCtx.clearRect(0, 0, els.preview.width, els.preview.height);
      return;
    }
    const token = ++state.previewToken;
    setStatus(`Previsualizando ${entry.name}...`);

    entry.blob.arrayBuffer().then(async (buf) => {
      if (token !== state.previewToken) return;
      const cfg = getParsedCfg();
      state.cfg = cfg;
      const img = await createImageBitmap(new Blob([buf]));
      if (token !== state.previewToken) return;
      const out = processBitmap(img, entry.name, cfg, true);
      drawToPreview(out.canvas);
      setStatus(`Preview listo: ${entry.name}`);
    }).catch(err => {
      console.error(err);
      setStatus(`No se pudo previsualizar ${entry.name}`);
    });
  }

  function drawToPreview(canvas) {
    const target = els.preview;
    const ctx = previewCtx;
    ctx.clearRect(0, 0, target.width, target.height);
    const scale = Math.min(target.width / canvas.width, target.height / canvas.height);
    const dw = Math.max(1, Math.floor(canvas.width * scale));
    const dh = Math.max(1, Math.floor(canvas.height * scale));
    const dx = Math.floor((target.width - dw) / 2);
    const dy = Math.floor((target.height - dh) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, dx, dy, dw, dh);
  }

  function buildTransformCanvas(img, opts, outW, outH) {
    const c = makeCanvas(outW, outH);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;

    const [r, g, b] = hexToRgb(opts.background || '#000000');
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, outW, outH);

    const cx = outW / 2;
    const cy = outH / 2;
    const zoom = opts.zoom || 1;
    const rot = (opts.rotation || 0) * Math.PI / 180;
    const shakeX = opts.shakeX || 0;
    const shakeY = opts.shakeY || 0;

    ctx.save();
    ctx.translate(cx + shakeX, cy + shakeY);
    ctx.rotate(rot);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
    return c;
  }

  function processBitmap(img, fileName, cfg, preview = false) {
    const { base } = splitBase(fileName);
    const animKey = animationKey(base);
    const profileName = pickProfileForName(cfg, base);
    const map = profileMap(cfg);
    const profile = map.get(profileName.toLowerCase()) || map.get('default') || DEFAULT_PROFILE();
    const global = cfg.global;

    const seed = scopeSeed(global.seed, profile.seed || 0, global.randomScope, base, animKey);
    const rand = xorshift32(seed);
    const variation = profile.lock ? 0 : clamp(profile.variation ?? global.variation, 0, 1);

    const actual = {};
    for (const key of Object.keys(DEFAULT_PROFILE())) {
      actual[key] = variedValue(profile[key], rand, variation);
    }

    // Re-seed for repeatable stochastic branches.
    const paintRand = xorshift32(seed ^ 0x9e3779b9);
    const w = img.width;
    const h = img.height;

    const shakeX = actual.shake ? Math.round(randRange(paintRand, -actual.shake, actual.shake) * w) : 0;
    const shakeY = actual.shake ? Math.round(randRange(paintRand, -actual.shake, actual.shake) * h) : 0;

    const transformed = buildTransformCanvas(img, {
      zoom: actual.zoom || 1,
      rotation: actual.rotation || 0,
      shakeX,
      shakeY,
      background: global.background,
    }, w, h);

    const tctx = transformed.getContext('2d', { willReadFrequently: true });
    const src = tctx.getImageData(0, 0, w, h);
    const srcData = src.data;
    const out = tctx.createImageData(w, h);
    const dst = out.data;

    const chrom = Math.round(Math.abs(actual.chromatic || 0));
    const glitchChance = clamp(Math.abs(actual.glitchChance || 0), 0, 1);
    const glitchStrength = Math.round(Math.abs(actual.glitchStrength || 0));
    const splitPx = Math.round((actual.split || 0) * w);
    const y1Px = Math.round((actual.y1 || 0) * h);
    const y2Px = Math.round((actual.y2 || 0) * h);
    const noise = Math.abs(actual.noise || 0);
    const scanlines = clamp(Math.abs(actual.scanlines || 0), 0, 1);
    const hue = actual.hue || 0;
    const sat = actual.sat || 0;
    const brt = actual.brt || 0;

    const rowJitter = new Int16Array(h);
    for (let y = 0; y < h; y++) {
      const rowSeed = hashString(`${seed}|row|${y}`);
      const rr = xorshift32(rowSeed);
      const trigger = rr();
      rowJitter[y] = trigger < glitchChance ? Math.round((rr() * 2 - 1) * glitchStrength) : 0;
    }

    for (let y = 0; y < h; y++) {
      const rowShift = rowJitter[y];
      const barShift = (y < h / 2) ? y1Px : y2Px;
      const scanMul = scanlines > 0 && (y & 1) ? (1 - scanlines) : 1;

      for (let x = 0; x < w; x++) {
        let sx = x + rowShift + barShift + (x < w / 2 ? splitPx : -splitPx);
        let sy = y;

        const rr = sampleRGBA(srcData, w, h, sx, sy);
        const rg = chrom ? sampleRGBA(srcData, w, h, sx + chrom, sy) : rr;
        const rb = chrom ? sampleRGBA(srcData, w, h, sx - chrom, sy) : rr;

        let r = rg[0];
        let g = rr[1];
        let b = rb[2];
        let a = rr[3];

        if (hue !== 0 || sat !== 0 || brt !== 0) {
          let [hh, ss, vv] = rgbToHsv(r, g, b);
          hh += hue;
          ss = clamp(ss + sat, 0, 1);
          vv = clamp(vv * (1 + brt), 0, 1);
          [r, g, b] = hsvToRgb(hh, ss, vv);
        }

        if (noise > 0) {
          const n = (((hashString(`${seed}|${x}|${y}`) & 255) / 255) - 0.5) * 2 * noise;
          r += n * 255;
          g += n * 255;
          b += n * 255;
        }

        r *= scanMul;
        g *= scanMul;
        b *= scanMul;

        const i = (y * w + x) * 4;
        dst[i] = clamp(r | 0, 0, 255);
        dst[i + 1] = clamp(g | 0, 0, 255);
        dst[i + 2] = clamp(b | 0, 0, 255);
        dst[i + 3] = a;
      }
    }

    tctx.putImageData(out, 0, 0);
    return { canvas: transformed, profileName, actual };
  }

  async function readZip(file) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const files = [];
    zip.forEach((relativePath, entry) => {
      if (!entry.dir && /\.(png|jpg|jpeg|webp)$/i.test(relativePath)) {
        files.push({
          name: relativePath.split('/').pop(),
          path: relativePath,
          entry,
          blob: entry,
        });
      }
    });
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return { zip, files };
  }

  function populateFrameList() {
    els.frameList.innerHTML = '';
    for (let i = 0; i < state.files.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = state.files[i].name;
      els.frameList.appendChild(opt);
    }
    if (state.files.length) {
      state.selectedIndex = 0;
      els.frameList.selectedIndex = 0;
      renderPreviewForEntry(state.files[0]);
    } else {
      state.selectedIndex = -1;
      drawToPreview(makeCanvas(1, 1));
    }
  }

  async function processZip() {
    if (!state.zip || !state.files.length) {
      setStatus('Primero carga un ZIP con PNGs.');
      return;
    }

    const cfg = getParsedCfg();
    state.cfg = cfg;

    const outZip = new JSZip();
    const total = state.files.length;
    const baseName = (els.outName.value || 'processed_frames.zip').trim().replace(/[\\/]+/g, '_');
    const folderName = baseName.toLowerCase().endsWith('.zip') ? baseName.slice(0, -4) : baseName;

    setStatus(`Procesando ${total} frame(s)...`);
    log(`Procesando ${total} archivos con ${cfg.profiles.length} perfil(es).`);

    let done = 0;
    for (const f of state.files) {
      const buf = await f.entry.async('arraybuffer');
      const img = await createImageBitmap(new Blob([buf]));
      const result = processBitmap(img, f.name, cfg, false);
      const blob = await new Promise((resolve) => result.canvas.toBlob(resolve, 'image/png'));
      outZip.file(f.name, blob);

      done++;
      if ((done & 3) === 0) {
        setStatus(`Procesando ${done}/${total}...`);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    outZip.file('frag.txt', serializeConfig(cfg));

    const outBlob = await outZip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(outBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = folderName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setStatus(`Listo: ${folderName}`);
    log(`ZIP exportado: ${folderName}`);
  }

  async function loadZipFile(file) {
    setStatus('Leyendo ZIP...');
    log(`Cargando ZIP: ${file.name}`);
    const result = await readZip(file);
    state.zip = result.zip;
    state.files = result.files;
    populateFrameList();
    setStatus(`ZIP cargado: ${state.files.length} frame(s)`);
    log(`Detectados ${state.files.length} PNG/JPG/WEBP.`);
  }

  async function loadCfgFile(file) {
    const text = await file.text();
    els.cfgText.value = text;
    state.rawCfg = text;
    state.cfg = parseConfig(text);
    setStatus(`frag.txt cargado: ${file.name}`);
    log(`Configuración importada: ${file.name}`);
    if (state.selectedIndex >= 0) renderPreviewForEntry(getSelectedFileEntry());
  }

  function exportCfgFile() {
    const text = els.cfgText.value || SAMPLE_CFG;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'frag.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('frag.txt exportado.');
    log('frag.txt descargado.');
  }

  function loadSample() {
    els.cfgText.value = SAMPLE_CFG;
    state.cfg = parseConfig(SAMPLE_CFG);
    setStatus('Ejemplo cargado.');
    log('Se cargó la configuración de ejemplo.');
    if (state.selectedIndex >= 0) renderPreviewForEntry(getSelectedFileEntry());
  }

  // Events
  els.zipInput.addEventListener('change', async () => {
    const file = els.zipInput.files?.[0];
    if (!file) return;
    try {
      await loadZipFile(file);
    } catch (err) {
      console.error(err);
      setStatus('No se pudo abrir el ZIP.');
      log(`Error ZIP: ${err?.message || err}`);
    }
  });

  els.cfgInput.addEventListener('change', async () => {
    const file = els.cfgInput.files?.[0];
    if (!file) return;
    try {
      await loadCfgFile(file);
    } catch (err) {
      console.error(err);
      setStatus('No se pudo abrir el frag.txt.');
      log(`Error frag.txt: ${err?.message || err}`);
    }
  });

  els.frameList.addEventListener('change', () => {
    const idx = Number(els.frameList.value);
    if (!Number.isFinite(idx)) return;
    state.selectedIndex = idx;
    const entry = getSelectedFileEntry();
    if (entry) renderPreviewForEntry(entry);
  });

  els.loadSample.addEventListener('click', loadSample);
  els.exportCfg.addEventListener('click', exportCfgFile);
  els.processZip.addEventListener('click', async () => {
    try {
      els.processZip.disabled = true;
      await processZip();
    } catch (err) {
      console.error(err);
      setStatus('Falló el procesamiento.');
      log(`Error: ${err?.message || err}`);
    } finally {
      els.processZip.disabled = false;
    }
  });

  els.cfgText.addEventListener('input', () => {
    if (state.selectedIndex >= 0) {
      clearTimeout(state._cfgTimer);
      state._cfgTimer = setTimeout(() => renderPreviewForEntry(getSelectedFileEntry()), 180);
    }
  });

  // Boot
  els.cfgText.value = SAMPLE_CFG;
  state.cfg = parseConfig(SAMPLE_CFG);
  log('Listo. Carga un ZIP y empieza.');
  setStatus('Listo para cargar archivos.');
})();