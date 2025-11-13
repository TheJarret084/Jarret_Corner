// Funkier-Pacher!-(soporte de rotado arreglado).js
// Good Night Abelito V2.3.1 :D
// Unificado: soporte para SubTexture rotated="true" usando FunkierPacker de la 1.7
// Requiere: JSZip cargado antes de este script.

(() => {
  'use strict';

  // -----------------------------
  // Configurables
  // -----------------------------
  const DEFAULTS = {
    EST_MAX: 32768,    // límite seguro en px (ajusta si quieres)
    MIN_SCALE: 0.25,   // no reducimos por debajo de esto
    SCALE_STEP: 0.05
  };

  // -----------------------------
  // Helper (FTF) - funciones de imagen y spritesheet
  // -----------------------------
  const FTF = {
    DEFAULTS: { ...DEFAULTS },

    loadImage: function(fileOrBlob) {
      return new Promise((resolve, reject) => {
        try {
          const url = URL.createObjectURL(fileOrBlob);
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('loadImage failed')); };
          img.src = url;
        } catch (e) { reject(e); }
      });
    },

    readFileAsText: function(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result);
        r.onerror = reject;
        r.readAsText(file);
      });
    },

    toBitmap: async function(blobOrImage) {
      try {
        return await createImageBitmap(blobOrImage);
      } catch (e) {
        if (blobOrImage instanceof HTMLImageElement) {
          const c = document.createElement('canvas');
          c.width = blobOrImage.naturalWidth || blobOrImage.width;
          c.height = blobOrImage.naturalHeight || blobOrImage.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(blobOrImage, 0, 0);
          return await createImageBitmap(c);
        }
        throw e;
      }
    },

    getImageDataFromBitmap: function(bitmap) {
      const c = document.createElement('canvas');
      c.width = bitmap.width;
      c.height = bitmap.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    },

    areBitmapsEqual: async function(bmpA, bmpB) {
      if (!bmpA || !bmpB) return false;
      if (bmpA.width !== bmpB.width || bmpA.height !== bmpB.height) return false;
      const d1 = FTF.getImageDataFromBitmap(bmpA);
      const d2 = FTF.getImageDataFromBitmap(bmpB);
      if (d1.length !== d2.length) return false;
      for (let i = 0; i < d1.length; i += 4) {
        if (d1[i] !== d2[i] || d1[i+1] !== d2[i+1] || d1[i+2] !== d2[i+2] || d1[i+3] !== d2[i+3]) return false;
      }
      return true;
    },

    // Crea spritesheet a partir de ImageBitmap[] (una fila horizontal).
    // cellWidth/cellHeight son los "cell" por frame (sin escalar).
    // scale: escala aplicada a cada bitmap dibujo (1 = sin cambiar).
    // devuelve { blob, canvas, usedScale }
    createSpritesheetFromBitmaps: async function(bitmaps, cellWidth, cellHeight, scale = 1, opts = {}) {
      const estMax = opts.estMax ?? DEFAULTS.EST_MAX;
      const minScale = opts.minScale ?? DEFAULTS.MIN_SCALE;
      const scaleStep = opts.scaleStep ?? DEFAULTS.SCALE_STEP;

      if (!bitmaps || bitmaps.length === 0) {
        const c = document.createElement('canvas'); c.width = 1; c.height = 1;
        return { blob: await new Promise(r=>c.toBlob(r,'image/png')), canvas: c, usedScale: scale };
      }

      // calcular dimensiones finales
      const totalW = Math.round(cellWidth * bitmaps.length * scale);
      const totalH = Math.round(cellHeight * scale);

      // si supera límites, intentar reducir iterativamente
      if (totalW > estMax || totalH > estMax) {
        let curScale = scale;
        while ((Math.round(cellWidth * bitmaps.length * curScale) > estMax || Math.round(cellHeight * curScale) > estMax) && (curScale - scaleStep >= minScale)) {
          curScale = +(curScale - scaleStep).toFixed(3);
        }
        // chequeo final preciso
        if (Math.round(cellWidth * bitmaps.length * curScale) > estMax || Math.round(cellHeight * curScale) > estMax) {
          const neededW = estMax / Math.max(1, cellWidth * bitmaps.length);
          const neededH = estMax / Math.max(1, cellHeight);
          const needed = Math.min(neededW, neededH);
          if (needed >= minScale) curScale = needed;
          else {
            const e = new Error('CANVAS_TOO_LARGE');
            e.code = 'CANVAS_TOO_LARGE';
            throw e;
          }
        }
        // intentar con curScale
        return await FTF.createSpritesheetFromBitmaps(bitmaps, cellWidth, cellHeight, curScale, opts);
      }

      // crear canvas
      const canvas = document.createElement('canvas');
      canvas.width = totalW;
      canvas.height = totalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { const e = new Error('NO_CANVAS'); e.code = 'NO_CANVAS'; throw e; }

      // dibujar bitmaps (centrados en celda)
      for (let i = 0; i < bitmaps.length; i++) {
        const bmp = bitmaps[i];
        const drawW = Math.max(1, Math.round(bmp.width * scale));
        const drawH = Math.max(1, Math.round(bmp.height * scale));
        const cellWScaled = Math.round(cellWidth * scale);
        const cellHScaled = Math.round(cellHeight * scale);
        const offsetX = Math.floor((cellWScaled - drawW) / 2);
        const offsetY = Math.floor((cellHScaled - drawH) / 2);

        if (scale !== 1) {
          const temp = document.createElement('canvas');
          temp.width = drawW; temp.height = drawH;
          const tctx = temp.getContext('2d');
          tctx.imageSmoothingEnabled = true;
          tctx.imageSmoothingQuality = 'high';
          tctx.drawImage(bmp, 0, 0, drawW, drawH);
          ctx.drawImage(temp, i * cellWScaled + offsetX, offsetY);
        } else {
          ctx.drawImage(bmp, i * cellWidth + offsetX, offsetY);
        }
      }

      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      return { blob, canvas, usedScale: scale };
    },

    // Dado un array de Blobs (frames), intenta crear una "tira" (spritesheet).
    // Opciones: { estMax, minScale, scaleStep, autoScale }
    // Devuelve Blob o lanza error (CANVAS_TOO_LARGE/NO_CANVAS)
    createStripFromBlobs: async function(blobs, opts = {}) {
      const estMax = opts.estMax ?? DEFAULTS.EST_MAX;
      const minScale = opts.minScale ?? DEFAULTS.MIN_SCALE;
      const scaleStep = opts.scaleStep ?? DEFAULTS.SCALE_STEP;
      const autoScale = (opts.autoScale === undefined) ? true : !!opts.autoScale;
      if (!blobs || blobs.length === 0) {
        const c = document.createElement('canvas'); c.width = 1; c.height = 1;
        return await new Promise(r=>c.toBlob(r,'image/png'));
      }

      // crear bitmaps
      let bitmaps;
      try {
        bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
      } catch (e) {
        const err = new Error('NO_CANVAS'); err.code = 'NO_CANVAS'; throw err;
      }

      const maxW = Math.max(...bitmaps.map(b => b.width));
      const maxH = Math.max(...bitmaps.map(b => b.height));
      // escala inicial (leer valor UI si existe)
      let initialScale = (typeof window !== 'undefined' && window.currentScale) ? window.currentScale : 1;
      initialScale = Math.max(minScale, Math.min(1, initialScale));

      // si autoScale está desactivado, solo intentar con initialScale (puede fallar)
      if (!autoScale && initialScale < 1) {
        const res = await FTF.createSpritesheetFromBitmaps(bitmaps, maxW, maxH, initialScale, { estMax, minScale, scaleStep });
        return res.blob;
      }

      // intentar con initialScale (y la función interna hará reducción si hace falta)
      const res = await FTF.createSpritesheetFromBitmaps(bitmaps, maxW, maxH, initialScale, { estMax, minScale, scaleStep });
      // liberar bitmaps
      bitmaps.forEach(b => b.close?.());
      return res.blob;
    }
  }; // end FTF

  // -----------------------------
  // FunkierPacker class (tu versión integrada)
  // -----------------------------
  class FunkierPacker {
    constructor() {
        this.frames = [];
    }

    // ======== Procesar imagen y XML ========
    async processFiles(imageFile, xmlFile, options = {}, onProgress = ()=>{}) {
        this.frames = [];
        const img = await this._loadImage(imageFile);
        const xmlText = await xmlFile.text();
        const atlas = this._parseXML(xmlText);

        const total = atlas.frames.length;
        for (let i = 0; i < atlas.frames.length; i++) {
            const f = atlas.frames[i];
            const frameCanvas = this._cutFrame(img, f);
            const blob = await this._canvasToBlob(frameCanvas);

            // Limpiar nombre: si termina en .png, quitarlo
            let name = f.name;
            if(name.toLowerCase().endsWith('.png')) name = name.slice(0, -4);

            this.frames.push({ name, blob });
            try { onProgress((i+1)/total); } catch(e){}
        }

        return this.frames;
    }

    // ======== Generar ZIP de frames ========
    async generateZip() {
        if(this.frames.length === 0) throw new Error("No hay frames procesados");
        const zip = new JSZip();
        this.frames.forEach(f => {
            zip.file(f.name + '.png', f.blob);
        });
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        return { blob, fileName: 'frames.zip' };
    }

    // ======== Funciones internas ========
    _loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    _parseXML(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "text/xml");
        const frameNodes = Array.from(xml.querySelectorAll('SubTexture'));

        const parseIntOr0 = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            const n = parseInt(v, 10);
            return Number.isNaN(n) ? 0 : n;
        };
        const parseBool = (v) => {
            if (!v) return false;
            v = v.toString().toLowerCase();
            return (v === 'true' || v === '1');
        };

        return {
            frames: frameNodes.map(n => {
                let name = n.getAttribute('name');
                if(name && name.toLowerCase().endsWith('.png')) name = name.slice(0,-4); // limpiar .png extra
                return {
                    name: name || 'unnamed',
                    x: parseIntOr0(n.getAttribute('x')),
                    y: parseIntOr0(n.getAttribute('y')),
                    width: parseIntOr0(n.getAttribute('width')),
                    height: parseIntOr0(n.getAttribute('height')),
                    rotated: parseBool(n.getAttribute('rotated')) || (n.getAttribute('rotation') === '90'),
                    frameX: parseIntOr0(n.getAttribute('frameX')),
                    frameY: parseIntOr0(n.getAttribute('frameY')),
                    frameWidth: parseIntOr0(n.getAttribute('frameWidth')) || parseIntOr0(n.getAttribute('width')),
                    frameHeight: parseIntOr0(n.getAttribute('frameHeight')) || parseIntOr0(n.getAttribute('height'))
                };
            })
        };
    }

    _cutFrame(img, frame) {
        // src rectangle in atlas
        const srcW = frame.width;
        const srcH = frame.height;

        // extraer el rect original tal como está en el atlas (sin "des-rotar")
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcW;
        srcCanvas.height = srcH;
        const sctx = srcCanvas.getContext('2d');
        sctx.drawImage(
            img,
            frame.x, frame.y, srcW, srcH,
            0, 0, srcW, srcH
        );

        // canvas final con las dimensiones de la "frameWidth/frameHeight" (tam original antes de trimming)
        const finalW = frame.frameWidth;
        const finalH = frame.frameHeight;
        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d');

        const offsetX = frame.frameX; // normalmente negativo si el sprite fue recortado
        const offsetY = frame.frameY;

        if (!frame.rotated) {
            // dibujo directo: la posición dentro del canvas final debe compensar frameX/frameY
            ctx.drawImage(srcCanvas, -offsetX, -offsetY);
            return canvas;
        }

        // Si está rotado en el atlas, debemos rotarlo -90 grados (contra las manecillas) para restaurar la orientación.
        // Primero creamos un canvas intermedio con la imagen rotada -90deg.
        const rotatedCanvas = document.createElement('canvas');
        // al rotar -90°, las dimensiones se invierten
        rotatedCanvas.width = srcH;
        rotatedCanvas.height = srcW;
        const rctx = rotatedCanvas.getContext('2d');

        // trasladar + rotar (-90 grados)
        rctx.translate(0, srcW);
        rctx.rotate(-Math.PI / 2);
        rctx.drawImage(srcCanvas, 0, 0);

        // Ahora rotatedCanvas contiene la imagen en orientación correcta (como era originalmente)
        // Dibujamos la imagen rotada en la posición que corresponde dentro del canvas final, compensando frameX/frameY
        ctx.drawImage(rotatedCanvas, -offsetX, -offsetY);

        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
  }

  // exportación para módulos (opcional)
  if (typeof module !== 'undefined' && module.exports) {
      module.exports = FunkierPacker;
  } else {
      window.FunkierPacker = FunkierPacker;
  }

  // -----------------------------
  // Navbar loader si existe JSON
  // -----------------------------
  window.jsonFile = window.jsonFile || '../../../Corner.json';
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
    try { cargarData(); } catch(e){ /* ignore */ }

    // -----------------------------
    // State
    // -----------------------------
    const state = { mode: 'zip', zipFile: null, imageFile: null, xmlFile: null };
    window.currentScale = window.currentScale || 1.0;

    // track created object URLs for revocation
    let createdObjectURLs = [];
    function registerObjectURL(url) { createdObjectURLs.push(url); return url; }
    function revokeAllCreatedURLs() { createdObjectURLs.forEach(u => { try { URL.revokeObjectURL(u); } catch(e){} }); createdObjectURLs = []; }

    // -----------------------------
    // Initial UI
    // -----------------------------
    if (zipPanel) zipPanel.style.display = 'block';
    if (pngxmlPanel) pngxmlPanel.style.display = 'none';
    methodZipBtn?.classList.add('active');

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
          if (state.imageFile && !state.xmlFile) statusTextPngXml && (statusTextPngXml.textContent = "Falta el XML");
          else if (state.xmlFile && !state.imageFile) statusTextPngXml && (statusTextPngXml.textContent = "Falta la imagen");
          else statusTextPngXml && (statusTextPngXml.textContent = "Selecciona PNG y XML para continuar.");
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
          try { const u = img.getAttribute('data-created-url'); URL.revokeObjectURL(u); } catch(e) {}
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
    // runPacker: PNG + XML path (AHORA usando FunkierPacker)
    // -----------------------------
    async function runPacker(removeDuplicates = false) {
      try {
        statusTextPngXml && (statusTextPngXml.textContent = "Procesando PNG + XML...");
        if (!state.imageFile || !state.xmlFile) { statusTextPngXml && (statusTextPngXml.textContent = "Faltan archivos (PNG o XML)."); return; }

        // usa FunkierPacker para extraer cada SubTexture ya corregida (rotations handled)
        const fp = new FunkierPacker();
        let extractedFrames;
        try {
          extractedFrames = await fp.processFiles(state.imageFile, state.xmlFile, {}, (p) => {
            statusTextPngXml && (statusTextPngXml.textContent = `Extrayendo frames... ${Math.round(p*100)}%`);
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
        Object.keys(animations).forEach(k => animations[k].sort((a,b) => (a.frameNumber || 0) - (b.frameNumber || 0)));

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
        const baseName = (state.imageFile && state.imageFile.name) ? state.imageFile.name.replace(/\.[^/.]+$/,'') : 'spritesheet';
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
          group.sort((a,b) => (a.frameNumber || 0) - (b.frameNumber || 0));

          // extract blobs
          const blobs = [];
          for (const gf of group) {
            try { blobs.push(await gf.entry.async('blob')); } catch(e) { console.warn('zip entry async failed', e); }
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
          try { newZip.file(`${animName}.png`, sheetBlob); } catch(e) { console.error('zip add failed', e); }
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
      stripWrapper.style.overflowX = 'auto';
      stripWrapper.style.padding = '6px 0';
      stripWrapper.style.whiteSpace = 'nowrap';

      const img = document.createElement('img');
      img.src = preview.url;
      img.setAttribute('data-created-url', preview.url);
      img.alt = `${preview.name} - cinta de frames`;
      img.loading = 'lazy';
      img.style.maxWidth = 'none';
      img.style.height = 'auto';
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
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch(e){} }, 2000);
        });
        resultContent.insertBefore(btn, resultContent.firstChild);
        return;
      }

      downloadControls.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'download-wrapper';
      wrapper.style.display = 'flex';
      wrapper.style.gap = '10px';
      wrapper.style.justifyContent = 'center';
      wrapper.style.alignItems = 'center';
      wrapper.style.flexWrap = 'wrap';

      const info = document.createElement('div');
      info.className = 'download-info';
      info.textContent = fileName;
      info.style.color = '#cfe1ff';
      info.style.fontSize = '0.95rem';

      const btn = document.createElement('button');
      btn.className = 'download-btn';
      btn.textContent = 'Descargar ZIP';
      btn.addEventListener('click', () => {
        const url = URL.createObjectURL(blob);
        registerObjectURL(url);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch(e){} }, 2000);
      });

      wrapper.appendChild(info);
      wrapper.appendChild(btn);
      downloadControls.appendChild(wrapper);
    }

    // progreso (si necesitas una barra)
    function updateProgress(current, total) {
      const bar = document.getElementById('progress-bar');
      if (bar && total > 0) bar.style.width = `${Math.round((current / total) * 100)}%`;
    }

    // expose helper shortcuts to window for debugging
    window.__FP = window.__FP || {};
    window.__FP.revokeAllPreviewURLs = revokeAllCreatedURLs;
    window.__FP.createStripFromBlobs = FTF.createStripFromBlobs;
  }); // end DOMContentLoaded
})(); // end IIFE
