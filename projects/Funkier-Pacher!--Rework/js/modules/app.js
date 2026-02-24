(() => {
  'use strict';

  const core = window.FunkierCore;
  if (!core) {
    console.error('FunkierCore no está disponible.');
    return;
  }

  const JSZip = window.JSZip;
  if (!JSZip) {
    console.error('JSZip no está cargado.');
    return;
  }

  const { DEFAULTS, FTF, FunkierPacker } = core;

  // Navbar loader si existe JSON
  // -----------------------------
  window.jsonFile = window.jsonFile || '../../../../Corner.json';
  let dataGlobal = null;
  function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar || !dataGlobal) return;
    let html = '';
    html += `<a href="../../../index.html" class="nav-link"><i class="fa fa-home"></i> Menú Principal</a>`;
    (dataGlobal.data?.nav || []).forEach(item => {
      if (item.tipo === 'dropdown') {
        html += `<div class="nav-dropdown"><button class="nav-dropbtn"><i class="fa fa-bars"></i> Más</button><div class="nav-dropdown-content">`;
        item.opciones.forEach(opt => { html += `<a href="${opt.url}" target="_blank">${opt.texto}</a>`; });
        html += `</div></div>`;
      }
    });
    navBar.innerHTML = html;
    attachNavInteractions(navBar);
  }

  function attachNavInteractions(navBar) {
    if (!navBar || navBar.dataset.dropdownBound === '1') return;
    navBar.dataset.dropdownBound = '1';

    const closeAll = () => {
      navBar.querySelectorAll('.nav-dropdown.open').forEach(dropdown => {
        dropdown.classList.remove('open');
      });
    };

    navBar.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      const btn = dropdown.querySelector('.nav-dropbtn');
      if (!btn) return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !dropdown.classList.contains('open');
        closeAll();
        if (willOpen) dropdown.classList.add('open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!navBar.contains(e.target)) closeAll();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
  }

  async function cargarData() {
    try {
      const resp = await fetch(window.jsonFile, { cache: 'no-cache' });
      dataGlobal = await resp.json();
      renderizarNav();
    } catch (e) { console.warn("No se pudo cargar JSON de navbar:", e); }
  }

  // -----------------------------
  // Main UI + lógica (DOMContentLoaded)
  // -----------------------------
  document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------
    // DOM refs
    // -----------------------------
    const methodZipBtn = document.getElementById('method-zip-btn');
    const methodPngXmlBtn = document.getElementById('method-pngxml-btn');
    const zipPanel = document.getElementById('zip-upload-panel');
    const pngxmlPanel = document.getElementById('pngxml-upload-panel');

    const zipBtn = document.getElementById('zip-btn');
    const zipInput = document.getElementById('zip-input');
    const generateBtnZip = document.getElementById('generate-btn-zip');
    const statusTextZip = document.getElementById('status-text-zip');

    const imageBtn = document.getElementById('image-btn');
    const xmlBtn = document.getElementById('xml-btn');
    const imageInput = document.getElementById('image-input');
    const xmlInput = document.getElementById('xml-input');
    const generateBtnPngXml = document.getElementById('generate-btn-pngxml');
    const statusTextPngXml = document.getElementById('status-text-pngxml');

    const removeDuplicatesCheckbox = document.getElementById('remove-duplicates');
    const scaleRange = document.getElementById('scale-range');
    const scaleValue = document.getElementById('scale-value');
    const scaleWarning = document.getElementById('scale-warning');

    const resultPanel = document.getElementById('result-panel');
    const resultContent = document.querySelector('#result-panel .result-content') || document.getElementById('result-panel');

    const downloadControls = document.getElementById('download-controls');

    // attempt to load navbar JSON
    try { cargarData(); } catch (e) { /* ignore */ }

    // -----------------------------
    // State
    // -----------------------------
    const state = { mode: 'zip', zipFile: null, imageFile: null, xmlFile: null };
    window.currentScale = window.currentScale || 1.0;

    // track created object URLs for revocation
    let createdObjectURLs = [];
    function registerObjectURL(url) { createdObjectURLs.push(url); return url; }
    function revokeAllCreatedURLs() { createdObjectURLs.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { } }); createdObjectURLs = []; }

    // -----------------------------
    // Initial UI
    // -----------------------------
    if (zipPanel) zipPanel.style.display = 'block';
    if (pngxmlPanel) pngxmlPanel.style.display = 'none';
    methodZipBtn?.classList.add('active');
    if (xmlInput) xmlInput.accept = '.xml,.json,.plist,.atlas,.txt,.fnt';

    // scale UI
    if (scaleRange && scaleValue) {
      scaleRange.addEventListener('input', () => {
        const v = parseFloat(scaleRange.value);
        window.currentScale = Math.max(DEFAULTS.MIN_SCALE, Math.min(1, v));
        scaleValue.textContent = Math.round(window.currentScale * 100) + '%';
        if (scaleWarning) scaleWarning.style.display = window.currentScale < 1 ? 'block' : 'none';
      });
      scaleRange.value = window.currentScale.toString();
      scaleValue.textContent = Math.round(window.currentScale * 100) + '%';
      if (scaleWarning) scaleWarning.style.display = window.currentScale < 1 ? 'block' : 'none';
    }

    // -----------------------------
    // Utility: set FileList
    // -----------------------------
    function createFileListFromFile(file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt.files;
    }

    // -----------------------------
    // Drag & drop helpers
    // -----------------------------
    function makeDropZoneHandlers(dropEl, onFile) {
      if (!dropEl) return;
      let prevent = e => { e.preventDefault(); e.stopPropagation(); };
      dropEl.addEventListener('dragover', (e) => { prevent(e); dropEl.classList.add('dragover'); });
      dropEl.addEventListener('dragleave', (e) => { prevent(e); dropEl.classList.remove('dragover'); });
      dropEl.addEventListener('drop', (e) => {
        prevent(e);
        dropEl.classList.remove('dragover');
        const f = e.dataTransfer?.files?.[0];
        if (f) onFile(f);
      });
    }

    makeDropZoneHandlers(document.getElementById('zip-drop-zone'), (file) => {
      if (!file) return;
      zipInput.files = createFileListFromFile(file);
      zipInput.dispatchEvent(new Event('change'));
    });
    makeDropZoneHandlers(document.getElementById('png-drop-zone'), (file) => {
      if (!file) return;
      imageInput.files = createFileListFromFile(file);
      imageInput.dispatchEvent(new Event('change'));
    });
    makeDropZoneHandlers(document.getElementById('xml-drop-zone'), (file) => {
      if (!file) return;
      xmlInput.files = createFileListFromFile(file);
      xmlInput.dispatchEvent(new Event('change'));
    });

    // -----------------------------
    // File pickers wiring
    // -----------------------------
    zipBtn?.addEventListener('click', () => zipInput && zipInput.click());
    imageBtn?.addEventListener('click', () => imageInput && imageInput.click());
    xmlBtn?.addEventListener('click', () => xmlInput && xmlInput.click());

    zipInput?.addEventListener('change', () => {
      if (zipInput.files.length > 0) {
        state.zipFile = zipInput.files[0];
        statusTextZip && (statusTextZip.textContent = `ZIP seleccionado: ${state.zipFile.name}`);
        generateBtnZip && (generateBtnZip.disabled = false);
      } else {
        state.zipFile = null;
        generateBtnZip && (generateBtnZip.disabled = true);
        statusTextZip && (statusTextZip.textContent = `Selecciona un archivo ZIP para continuar.`);
      }
    });

    imageInput?.addEventListener('change', () => {
      state.imageFile = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
      checkReady();
    });

    xmlInput?.addEventListener('change', () => {
      state.xmlFile = xmlInput.files && xmlInput.files[0] ? xmlInput.files[0] : null;
      checkReady();
    });

    // -----------------------------
    // Mode switching and readiness
    // -----------------------------
    methodZipBtn?.addEventListener('click', () => {
      state.mode = 'zip';
      if (zipPanel) zipPanel.style.display = 'block';
      if (pngxmlPanel) pngxmlPanel.style.display = 'none';
      methodZipBtn.classList.add('active'); methodPngXmlBtn?.classList.remove('active');
      checkReady();
    });

    methodPngXmlBtn?.addEventListener('click', () => {
      state.mode = 'packer';
      if (zipPanel) zipPanel.style.display = 'none';
      if (pngxmlPanel) pngxmlPanel.style.display = 'block';
      methodZipBtn.classList.remove('active'); methodPngXmlBtn.classList.add('active');
      checkReady();
    });

    function checkReady() {
      if (state.mode === 'packer') {
        if (state.imageFile && state.xmlFile) {
          generateBtnPngXml.disabled = false;
          statusTextPngXml && (statusTextPngXml.textContent = `Listo para generar: ${state.imageFile.name} + ${state.xmlFile.name}`);
        } else {
          generateBtnPngXml.disabled = true;
          if (state.imageFile && !state.xmlFile) statusTextPngXml && (statusTextPngXml.textContent = "Falta el archivo de datos (XML/JSON/PLIST/ATLAS/FNT)");
          else if (state.xmlFile && !state.imageFile) statusTextPngXml && (statusTextPngXml.textContent = "Falta la imagen");
          else statusTextPngXml && (statusTextPngXml.textContent = "Selecciona PNG y archivo de datos para continuar.");
        }
        if (generateBtnZip) generateBtnZip.disabled = true;
      } else {
        if (generateBtnZip) generateBtnZip.disabled = !state.zipFile;
        if (!state.zipFile) statusTextZip && (statusTextZip.textContent = "Selecciona un archivo ZIP para continuar.");
        if (generateBtnPngXml) generateBtnPngXml.disabled = true;
      }
    }

    // initial readiness check
    checkReady();

    // -----------------------------
    // Clear results helper
    // -----------------------------
    function clearResults() {
      // revoke preview object URLs inside resultContent
      if (resultContent) {
        const imgs = resultContent.querySelectorAll('img[data-created-url]');
        imgs.forEach(img => {
          try { const u = img.getAttribute('data-created-url'); URL.revokeObjectURL(u); } catch (e) { }
        });
        resultContent.innerHTML = '';
      }
      revokeAllCreatedURLs();
      if (downloadControls) downloadControls.innerHTML = '';
    }

    // -----------------------------
    // Generate buttons wiring
    // -----------------------------
    generateBtnZip?.addEventListener('click', async () => {
      clearResults();
      await runZip(!!removeDuplicatesCheckbox?.checked);
    });
    generateBtnPngXml?.addEventListener('click', async () => {
      clearResults();
      await runPacker(!!removeDuplicatesCheckbox?.checked);
    });

    // -----------------------------
    // runPacker: PNG + DATA path (detecta formato automáticamente)
    // -----------------------------
    async function runPacker(removeDuplicates = false) {
      try {
        statusTextPngXml && (statusTextPngXml.textContent = "Procesando PNG + archivo de datos...");
        if (!state.imageFile || !state.xmlFile) { statusTextPngXml && (statusTextPngXml.textContent = "Faltan archivos (imagen o data)."); return; }

        // usa FunkierPacker para extraer y normalizar frames de varios formatos de atlas
        const fp = new FunkierPacker();
        let extractedFrames;
        try {
          extractedFrames = await fp.processFiles(state.imageFile, state.xmlFile, {}, (p) => {
            statusTextPngXml && (statusTextPngXml.textContent = `Extrayendo frames... ${Math.round(p * 100)}%`);
          });
        } catch (e) {
          console.error('FunkierPacker failed', e);
          statusTextPngXml && (statusTextPngXml.textContent = `Error extrayendo frames: ${e && e.message ? e.message : e}`);
          return;
        }

        // extractedFrames: [{name, blob}]
        // agrupar en animaciones por sufijo numérico como antes
        const animations = {};
        for (const ef of extractedFrames) {
          let name = ef.name || '';
          // attempt to detect trailing digits
          let match = name.match(/^(.*?)(\d+)$/);
          let animName, frameNum;
          if (match) {
            animName = match[1].replace(/[_.-]$/, '') || 'animation';
            frameNum = parseInt(match[2], 10);
          } else {
            match = name.match(/^(.*[_.-])?(.+?)(\d+)([_.-].*)?$/);
            if (match) {
              animName = ((match[1] || '') + (match[2] || '') + (match[4] || '')).replace(/[_.-]$/, '') || 'animation';
              frameNum = parseInt(match[3] || '0', 10);
            } else {
              const dm = name.match(/(\d+)/);
              if (dm) {
                const idx = name.indexOf(dm[0]);
                animName = name.substring(0, idx).replace(/[_.-]$/, '') || name;
                frameNum = parseInt(dm[0], 10);
                if (!animName) animName = (name.substring(idx + dm[0].length) || 'animation');
              } else { animName = name || 'animation'; frameNum = 0; }
            }
          }
          if (!animations[animName]) animations[animName] = [];
          animations[animName].push({ name: ef.name, blob: ef.blob, frameNumber: frameNum });
        }

        // sort frames inside anims
        Object.keys(animations).forEach(k => animations[k].sort((a, b) => (a.frameNumber || 0) - (b.frameNumber || 0)));

        // process each animation: create spritesheet, add to zip, preview
        const zip = new JSZip();
        const previews = [];
        const animEntries = Object.entries(animations);
        let processed = 0;
        const total = animEntries.length;
        for (const [animName, frames] of animEntries) {
          processed++;
          statusTextPngXml && (statusTextPngXml.textContent = `Procesando animación: ${animName} (${processed}/${total})`);

          // collect blobs and optionally remove duplicates
          let blobs = frames.map(f => f.blob);

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

          if (blobs.length === 0) continue;

          // create spritesheet blob using helper (it auto-reduces if needed)
          let sheetBlob = null;
          let sheetDims = null;
          try {
            sheetBlob = await FTF.createStripFromBlobs(blobs, { estMax: FTF.DEFAULTS.EST_MAX, minScale: FTF.DEFAULTS.MIN_SCALE, scaleStep: FTF.DEFAULTS.SCALE_STEP, autoScale: true });
            const bmp = await createImageBitmap(sheetBlob);
            sheetDims = { width: bmp.width, height: bmp.height };
            bmp.close?.();
          } catch (e) {
            if (e && e.code === 'CANVAS_TOO_LARGE') {
              resultContent && resultContent.appendChild(createErrorBox(`No se pudo generar ${animName}: canvas demasiado grande incluso reduciendo resolución.`));
              continue;
            } else if (e && e.code === 'NO_CANVAS') {
              resultContent && resultContent.appendChild(createErrorBox(`No se pudo generar ${animName}: operaciones de canvas no disponibles.`));
              continue;
            } else {
              console.error('Error generando spritesheet', animName, e);
              resultContent && resultContent.appendChild(createErrorBox(`Error generando ${animName}: ${e && e.message ? e.message : e}`));
              continue;
            }
          }

          // add to zip
          try { zip.file(`${animName}.png`, sheetBlob); } catch (e) { console.error('Error añadiendo al zip', e); }

          // create preview and append
          const url = registerObjectURL(URL.createObjectURL(sheetBlob));
          const preview = { name: animName, url, frames: blobs.length, width: sheetDims ? sheetDims.width : 0, height: sheetDims ? sheetDims.height : 0 };
          previews.push(preview);
          resultContent && resultContent.appendChild(createPreviewElement(preview));
        }

        // finalize zip
        const baseName = (state.imageFile && state.imageFile.name) ? state.imageFile.name.replace(/\.[^/.]+$/, '') : 'spritesheet';
        const finalBlob = await zip.generateAsync({ type: 'blob' });
        addDownloadButton(finalBlob, `TJ_${baseName}.zip`);
        statusTextPngXml && (statusTextPngXml.textContent = "¡Procesamiento completado!");
      } catch (err) {
        console.error('runPacker error', err);
        statusTextPngXml && (statusTextPngXml.textContent = `Error: ${err && err.message ? err.message : err}`);
      }
    } // end runPacker

    // -----------------------------
    // runZip: ZIP path (sin cambios funcionales, conserva comportamiento)
    // -----------------------------
    async function runZip(removeDuplicates = false) {
      try {
        statusTextZip && (statusTextZip.textContent = "Procesando ZIP de frames...");
        if (!state.zipFile) { statusTextZip && (statusTextZip.textContent = "Falta el ZIP."); return; }

        const zip = await JSZip.loadAsync(state.zipFile);
        const framesList = [];
        for (const [filename, entry] of Object.entries(zip.files)) {
          if (!filename.toLowerCase().endsWith('.png')) continue;
          framesList.push({ name: filename.slice(0, -4), entry });
        }

        // group frames into animations (robusto)
        const animGroups = {};
        for (const f of framesList) {
          let match = f.name.match(/^(.*?)(\d+)$/);
          if (!match) {
            const baseName = f.name.trim();
            if (!animGroups[baseName]) animGroups[baseName] = [];
            animGroups[baseName].push({ name: f.name, frameNumber: 0, entry: f.entry });
            continue;
          }
          const baseName = match[1].trim();
          const frameNumber = parseInt(match[2], 10);
          if (!animGroups[baseName]) animGroups[baseName] = [];
          animGroups[baseName].push({ name: f.name, frameNumber, entry: f.entry });
        }

        // process each animation group
        const newZip = new JSZip();
        const groupNames = Object.keys(animGroups).sort();
        let processedCount = 0;
        for (const animName of groupNames) {
          processedCount++;
          statusTextZip && (statusTextZip.textContent = `Procesando: ${animName} (${processedCount}/${groupNames.length})`);
          const group = animGroups[animName];
          group.sort((a, b) => (a.frameNumber || 0) - (b.frameNumber || 0));

          // extract blobs
          const blobs = [];
          for (const gf of group) {
            try { blobs.push(await gf.entry.async('blob')); } catch (e) { console.warn('zip entry async failed', e); }
          }
          if (blobs.length === 0) continue;

          // remove duplicates if requested
          let processedBlobs = blobs;
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
            processedBlobs = unique;
          }

          // attempt to create spritesheet (auto-reduce)
          let sheetBlob = null;
          let sheetDims = null;
          try {
            sheetBlob = await FTF.createStripFromBlobs(processedBlobs, { estMax: FTF.DEFAULTS.EST_MAX, minScale: FTF.DEFAULTS.MIN_SCALE, scaleStep: FTF.DEFAULTS.SCALE_STEP, autoScale: true });
            const bmp = await createImageBitmap(sheetBlob);
            sheetDims = { width: bmp.width, height: bmp.height };
            bmp.close?.();
          } catch (e) {
            if (e && e.code === 'CANVAS_TOO_LARGE') {
              resultContent && resultContent.appendChild(createErrorBox(`No se pudo generar ${animName}: canvas demasiado grande incluso reduciendo resolución.`));
              continue;
            } else if (e && e.code === 'NO_CANVAS') {
              resultContent && resultContent.appendChild(createErrorBox(`No se pudo generar ${animName}: operaciones de canvas no disponibles.`));
              continue;
            } else {
              console.error('createStrip error', e);
              resultContent && resultContent.appendChild(createErrorBox(`Error creando cinta para ${animName}: ${e && e.message ? e.message : e}`));
              continue;
            }
          }

          // add to zip and preview
          try { newZip.file(`${animName}.png`, sheetBlob); } catch (e) { console.error('zip add failed', e); }
          const url = registerObjectURL(URL.createObjectURL(sheetBlob));
          resultContent && resultContent.appendChild(createPreviewElement({ name: animName, url, frames: processedBlobs.length, width: sheetDims?.width || 0, height: sheetDims?.height || 0 }));
        }

        // finalize zip
        const baseName = state.zipFile.name.replace(/\.[^/.]+$/, '');
        const finalBlob = await newZip.generateAsync({ type: 'blob' });
        addDownloadButton(finalBlob, `TJ-${baseName}.zip`);
        statusTextZip && (statusTextZip.textContent = "¡Procesamiento completado!");
      } catch (err) {
        console.error('runZip error', err);
        statusTextZip && (statusTextZip.textContent = `Error: ${err && err.message ? err.message : err}`);
      }
    } // end runZip

    // -----------------------------
    // UI helpers: preview, errors, download
    // -----------------------------
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

    function addDownloadButton(blob, fileName) {
      if (!downloadControls) {
        // fallback: append to resultContent top
        if (!resultContent) return;
        const btn = document.createElement('button');
        btn.className = 'download-btn';
        btn.textContent = `Descargar ${fileName}`;
        btn.addEventListener('click', () => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = fileName;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } }, 2000);
        });
        resultContent.insertBefore(btn, resultContent.firstChild);
        return;
      }

      downloadControls.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'download-wrapper';

      const info = document.createElement('div');
      info.className = 'download-info';
      info.textContent = fileName;

      const btn = document.createElement('button');
      btn.className = 'download-btn';
      btn.textContent = 'Descargar ZIP';
      btn.addEventListener('click', () => {
        const url = URL.createObjectURL(blob);
        registerObjectURL(url);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } }, 2000);
      });

      wrapper.appendChild(info);
      wrapper.appendChild(btn);
      downloadControls.appendChild(wrapper);
    }

    // expose helper shortcuts to window for debugging
    window.__FP = window.__FP || {};
    window.__FP.revokeAllPreviewURLs = revokeAllCreatedURLs;
    window.__FP.createStripFromBlobs = FTF.createStripFromBlobs;
  }); // end DOMContentLoaded
})(); // end IIFE
