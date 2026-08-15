// Funkier-Pacher! — Godot SpriteFrames (.tres) input
// Helper 100% aislado: NO modifica core.js ni app.js.
// Solo usa la API pública estable de FunkierCore (FTF) y JSZip (globales).
// Si algo aquí se rompe, el resto de la app sigue funcionando normal.
(() => {
  'use strict';

  // -----------------------------
  // 1. Parser de .tres (Godot SpriteFrames)
  // -----------------------------
  function round(v) { return Math.round(parseFloat(v)); }

  function parseGodotTres(text) {
    // ---- Atlas: id -> { region, margin } ----
    // Ojo: "margin" es opcional (formatos viejos no lo traen) y representa
    // el offset de recorte (trim) dentro del frame completo original.
    const atlasMap = {};
    const blockRe = /\[sub_resource type="AtlasTexture" id="([^"]+)"\]([\s\S]*?)(?=\n\[sub_resource|\n\[resource\]|$)/g;
    let m;
    while ((m = blockRe.exec(text)) !== null) {
      const id    = m[1];
      const block = m[2];
      const regionM = block.match(/region\s*=\s*Rect2\(\s*([\d.\-]+),\s*([\d.\-]+),\s*([\d.\-]+),\s*([\d.\-]+)\s*\)/);
      if (!regionM) continue;
      const marginM = block.match(/margin\s*=\s*Rect2\(\s*([\d.\-]+),\s*([\d.\-]+),\s*([\d.\-]+),\s*([\d.\-]+)\s*\)/);
      atlasMap[id] = {
        region: { x: round(regionM[1]), y: round(regionM[2]), w: round(regionM[3]), h: round(regionM[4]) },
        margin: marginM
          ? { x: round(marginM[1]), y: round(marginM[2]), w: round(marginM[3]), h: round(marginM[4]) }
          : { x: 0, y: 0, w: 0, h: 0 }
      };
    }
    if (Object.keys(atlasMap).length === 0) return null;

    // ---- Animaciones ----
    // "loop" puede venir como true/false (tres viejos) o 0/1 (tres nuevos) — se acepta cualquiera.
    const animRe = /"frames":\s*\[([\s\S]*?)\],\s*"loop":\s*(?:true|false|0|1),\s*"name":\s*&?"([^"]+)",\s*"speed":\s*([\d.]+)/g;
    const animations = [];
    while ((m = animRe.exec(text)) !== null) {
      const ids   = [...m[1].matchAll(/SubResource\("([^"]+)"\)/g)].map(x => x[1]);
      const raw   = ids.map(id => atlasMap[id]).filter(Boolean);
      if (!raw.length) continue;

      // tamaño completo del frame (sin trim) = región + el margin de cada lado.
      // se normaliza al máximo del grupo para que la animación no "brinque" de tamaño.
      let sourceW = 0, sourceH = 0;
      for (const f of raw) {
        sourceW = Math.max(sourceW, f.region.w + f.margin.x + f.margin.w);
        sourceH = Math.max(sourceH, f.region.h + f.margin.y + f.margin.h);
      }

      const frames = raw.map(f => ({ region: f.region, margin: f.margin, sourceW, sourceH }));
      animations.push({ name: m[2].trim() || 'animation', frames });
    }
    if (!animations.length) return null;
    return { animations };
  }

  window.FunkierGodotParser = { parseTres: parseGodotTres };

  // -----------------------------
  // 2. UI: tercera pestaña "Godot (.tres)"
  // -----------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const core = window.FunkierCore;
    const JSZip = window.JSZip;
    if (!core || !JSZip) { console.warn('[godot-input] FunkierCore o JSZip no disponibles, tab Godot desactivada.'); return; }
    const { FTF, DEFAULTS } = core;

    const methodGodotBtn = document.getElementById('method-godot-btn');
    const godotPanel     = document.getElementById('godot-upload-panel');
    const methodZipBtn   = document.getElementById('method-zip-btn');
    const methodPngXmlBtn= document.getElementById('method-pngxml-btn');
    const zipPanel        = document.getElementById('zip-upload-panel');
    const pngxmlPanel     = document.getElementById('pngxml-upload-panel');
    if (!methodGodotBtn || !godotPanel) return; // markup no presente, no hacemos nada

    const imageInput  = document.getElementById('godot-image-input');
    const tresInput   = document.getElementById('godot-tres-input');
    const imageBtn    = document.getElementById('godot-image-btn');
    const tresBtn     = document.getElementById('godot-tres-btn');
    const generateBtn = document.getElementById('generate-btn-godot');
    const statusText  = document.getElementById('status-text-godot');

    const resultPanel   = document.getElementById('result-panel');
    const resultContent = document.querySelector('#result-panel .result-content') || document.getElementById('result-panel');
    const downloadControls = document.getElementById('download-controls');
    const removeDuplicatesCheckbox = document.getElementById('remove-duplicates');

    let state = { imageFile: null, tresFile: null };
    let createdURLs = [];
    const registerURL = u => { createdURLs.push(u); return u; };
    const revokeAll = () => { createdURLs.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} }); createdURLs = []; };

    function createFileListFromFile(file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt.files;
    }

    function makeDropZoneHandlers(dropEl, onFile) {
      if (!dropEl) return;
      const prevent = e => { e.preventDefault(); e.stopPropagation(); };
      dropEl.addEventListener('dragover', e => { prevent(e); dropEl.classList.add('dragover'); });
      dropEl.addEventListener('dragleave', e => { prevent(e); dropEl.classList.remove('dragover'); });
      dropEl.addEventListener('drop', e => {
        prevent(e); dropEl.classList.remove('dragover');
        const f = e.dataTransfer?.files?.[0];
        if (f) onFile(f);
      });
    }
    makeDropZoneHandlers(document.getElementById('godot-png-drop-zone'), file => {
      imageInput.files = createFileListFromFile(file);
      imageInput.dispatchEvent(new Event('change'));
    });
    makeDropZoneHandlers(document.getElementById('godot-tres-drop-zone'), file => {
      tresInput.files = createFileListFromFile(file);
      tresInput.dispatchEvent(new Event('change'));
    });

    imageBtn?.addEventListener('click', () => imageInput?.click());
    tresBtn?.addEventListener('click', () => tresInput?.click());

    function checkReady() {
      if (!generateBtn) return;
      generateBtn.disabled = !(state.imageFile && state.tresFile);
      if (!statusText) return;
      if (state.imageFile && state.tresFile) statusText.textContent = `Listo: ${state.imageFile.name} + ${state.tresFile.name}`;
      else if (state.imageFile) statusText.textContent = 'Falta el .tres';
      else if (state.tresFile) statusText.textContent = 'Falta el spritesheet (PNG)';
      else statusText.textContent = 'Selecciona el PNG y el .tres de Godot.';
    }

    imageInput?.addEventListener('change', () => { state.imageFile = imageInput.files?.[0] || null; checkReady(); });
    tresInput?.addEventListener('change', () => { state.tresFile = tresInput.files?.[0] || null; checkReady(); });

    // switcheo de pestaña — desactiva las otras dos sin tocar su código
    methodGodotBtn.addEventListener('click', () => {
      [zipPanel, pngxmlPanel].forEach(p => p && (p.style.display = 'none'));
      godotPanel.style.display = 'block';
      [methodZipBtn, methodPngXmlBtn].forEach(b => b?.classList.remove('active'));
      methodGodotBtn.classList.add('active');
      checkReady();
    });
    // si el usuario clickea las otras pestañas, esta se oculta y se desactiva
    [methodZipBtn, methodPngXmlBtn].forEach(btn => {
      btn?.addEventListener('click', () => {
        godotPanel.style.display = 'none';
        methodGodotBtn.classList.remove('active');
      });
    });

    function loadImage(file) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = e  => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
      });
    }

    function cropFrame(img, frame) {
      const c = document.createElement('canvas');
      c.width  = frame.sourceW;
      c.height = frame.sourceH;
      const ctx = c.getContext('2d');
      // dibuja la región recortada del atlas en su posición real dentro del
      // frame completo (respeta el trim), en vez de pegarla en (0,0).
      ctx.drawImage(
        img,
        frame.region.x, frame.region.y, frame.region.w, frame.region.h,
        frame.margin.x, frame.margin.y, frame.region.w, frame.region.h
      );
      return new Promise(resolve => c.toBlob(resolve, 'image/png'));
    }

    function updateProgress(current, total) {
      const fill = document.getElementById('progress-fill');
      const pct  = document.getElementById('progress-pct');
      const pw   = document.getElementById('progress-wrapper');
      const ratio = total > 0 ? Math.min(current / total, 1) : 0;
      const p = Math.round(ratio * 100);
      if (fill) fill.style.width = p + '%';
      if (pct) pct.textContent = p + '%';
      if (pw) { pw.style.display = 'flex'; pw.setAttribute('aria-valuenow', p); }
    }

    function clearResults() {
      if (resultContent) {
        resultContent.querySelectorAll('img[data-created-url]').forEach(img => {
          try { URL.revokeObjectURL(img.getAttribute('data-created-url')); } catch (e) {}
        });
        resultContent.innerHTML = '';
      }
      revokeAll();
      if (downloadControls) downloadControls.innerHTML = '';
    }

    function addDownloadButton(blob, fileName) {
      if (!downloadControls) return;
      const btn = document.createElement('button');
      btn.className = 'download-btn';
      btn.innerHTML = `<i class="fas fa-download"></i> Descargar ${fileName}`;
      btn.addEventListener('click', () => {
        const url = registerURL(URL.createObjectURL(blob));
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      });
      downloadControls.appendChild(btn);
    }

    function createPreviewElement(preview) {
      const container = document.createElement('div');
      container.className = 'preview-container';
      const title = document.createElement('div');
      title.className = 'preview-title';
      title.textContent = preview.name;
      container.appendChild(title);
      const stripWrapper = document.createElement('div');
      stripWrapper.className = 'preview-strip-wrapper';
      const img = document.createElement('img');
      img.src = preview.url;
      img.setAttribute('data-created-url', preview.url);
      img.alt = `${preview.name} - cinta de frames`;
      img.loading = 'lazy';
      stripWrapper.appendChild(img);
      container.appendChild(stripWrapper);
      const label = document.createElement('div');
      label.className = 'preview-label';
      label.textContent = `${preview.frames} frame${preview.frames > 1 ? 's' : ''}`;
      container.appendChild(label);
      return container;
    }

    function createErrorBox(text) {
      const err = document.createElement('div');
      err.className = 'build-error-box';
      err.style.margin = '8px 0';
      err.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="error-text">${text}</div>`;
      return err;
    }

    async function runGodot() {
      try {
        statusText && (statusText.textContent = 'Leyendo .tres...');
        const tresText = await state.tresFile.text();
        const parsed = parseGodotTres(tresText);
        if (!parsed) { statusText && (statusText.textContent = 'No reconocí el .tres (¿es un SpriteFrames válido?).'); return; }

        const img = await loadImage(state.imageFile);
        const removeDuplicates = !!removeDuplicatesCheckbox?.checked;
        const zip = new JSZip();

        const total = parsed.animations.length;
        updateProgress(0, total || 1);
        let done = 0;

        for (const anim of parsed.animations) {
          done++;
          updateProgress(done, total);
          statusText && (statusText.textContent = `Procesando: ${anim.name} (${done}/${total})`);

          let blobs = [];
          for (const rect of anim.frames) blobs.push(await cropFrame(img, rect));

          if (removeDuplicates && blobs.length > 1) {
            const unique = [blobs[0]];
            for (let i = 1; i < blobs.length; i++) {
              try {
                const curBmp = await createImageBitmap(blobs[i]);
                const prevBmp = await createImageBitmap(unique[unique.length - 1]);
                const eq = await FTF.areBitmapsEqual(curBmp, prevBmp);
                if (!eq) unique.push(blobs[i]);
                curBmp.close?.(); prevBmp.close?.();
              } catch (e) { unique.push(blobs[i]); }
            }
            blobs = unique;
          }
          if (!blobs.length) continue;

          let sheetBlob;
          try {
            sheetBlob = await FTF.createStripFromBlobs(blobs, { autoScale: true, minScale: DEFAULTS.MIN_SCALE, scaleStep: DEFAULTS.SCALE_STEP });
          } catch (e) {
            resultContent && resultContent.appendChild(createErrorBox(`No se pudo generar ${anim.name}: ${e && e.message ? e.message : e}`));
            continue;
          }

          zip.file(`${anim.name}.png`, sheetBlob);
          const url = registerURL(URL.createObjectURL(sheetBlob));
          const bmp = await createImageBitmap(sheetBlob);
          resultContent && resultContent.appendChild(createPreviewElement({ name: anim.name, url, frames: blobs.length, width: bmp.width, height: bmp.height }));
          bmp.close?.();
        }

        const baseName = state.tresFile.name.replace(/\.[^/.]+$/, '');
        const finalBlob = await zip.generateAsync({ type: 'blob' });
        addDownloadButton(finalBlob, `TJ-godot-${baseName}.zip`);
        statusText && (statusText.textContent = '¡Listo!');
      } catch (err) {
        console.error('[godot-input] runGodot error', err);
        statusText && (statusText.textContent = `Error: ${err && err.message ? err.message : err}`);
      }
    }

    generateBtn?.addEventListener('click', async () => {
      clearResults();
      if (resultPanel) resultPanel.style.display = '';
      generateBtn.disabled = true;
      await runGodot();
      generateBtn.disabled = false;
      setTimeout(() => { const pw = document.getElementById('progress-wrapper'); if (pw) pw.style.display = 'none'; }, 700);
    });

    checkReady();
  });
})();
