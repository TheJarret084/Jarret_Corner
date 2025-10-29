// Funkier-Pacher!.js
// Good Night Abelito V2.3 :D
// Versión: crea UNA sola cinta con todos los frames (no divide en partes).
// Si el canvas no puede (tamaño o soporte), falla con advertencia.

// Nota: para cambiar el comportamiento a "una cinta por animación", ajusta
// la variable combineIntoSingleStrip a false más abajo actualizacion desde em celular.

(() => {
  let isProcessing = false;
  let createdObjectURLs = [];
  let previewSet = new Set();

  // escala global
  window.currentScale = window.currentScale || 1.0;

  // Behavior toggle: si true -> combinar TODO en una sola cinta; si false -> cinta por animación
  const combineIntoSingleStrip = true;

  // JSON navbar
  window.jsonFile = window.jsonFile || '../../../Corner.json';
  let dataGlobal = null;

  async function cargarData() {
    try {
      const resp = await fetch(window.jsonFile, { cache: 'no-cache' });
      dataGlobal = await resp.json();
      renderizarNav();
    } catch (e) {
      console.warn("No se pudo cargar JSON de navbar:", e);
    }
  }

  function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar || !dataGlobal) return;

    let html = '';
    html += `<a href="../../../index.html" class="nav-link">
                <i class="fa fa-home"></i> Menú Principal
            </a>`;

    (dataGlobal.data?.nav || []).forEach(item => {
      if (item.tipo === 'dropdown') {
        html += `<div class="nav-dropdown">
                    <button class="nav-dropbtn"><i class="fa fa-bars"></i> Más</button>
                    <div class="nav-dropdown-content">`;
        item.opciones.forEach(opt => {
          html += `<a href="${opt.url}" target="_blank">${opt.texto}</a>`;
        });
        html += `</div></div>`;
      }
    });

    navBar.innerHTML = html;
  }

  // ---------------- FunkierPacker ----------------
  class FunkierPacker {
    constructor() { this.frames = []; }

    async processFiles(imageFile, xmlFile, options = {}, onProgress = () => {}) {
      this.frames = [];
      const img = await this._loadImage(imageFile);
      const xmlText = await xmlFile.text();
      const atlas = this._parseXML(xmlText);

      const total = atlas.frames.length || 0;
      for (let i = 0; i < atlas.frames.length; i++) {
        const f = atlas.frames[i];
        const frameCanvas = this._cutFrame(img, f);
        const blob = await this._canvasToBlob(frameCanvas);

        let name = f.name;
        if (name && name.toLowerCase().endsWith('.png')) name = name.slice(0, -4);
        this.frames.push({ name: name || 'unnamed', blob });
        onProgress((i + 1) / Math.max(1, total));
      }
      return this.frames;
    }

    async generateZip() {
      if (!this.frames.length) throw new Error("No hay frames procesados");
      const zip = new JSZip();
      this.frames.forEach(f => zip.file(f.name + '.png', f.blob));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      return { blob, fileName: 'frames.zip' };
    }

    _loadImage(file) {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
    }

    _parseXML(xmlText) {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, "text/xml");
      const frameNodes = Array.from(xml.querySelectorAll('SubTexture'));
      const parseIntOr0 = v => {
        if (v === null || v === undefined || v === '') return 0;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? 0 : n;
      };
      const parseBool = v => {
        if (!v) return false;
        v = v.toString().toLowerCase();
        return (v === 'true' || v === '1');
      };

      return {
        frames: frameNodes.map(n => {
          let name = n.getAttribute('name');
          if (name && name.toLowerCase().endsWith('.png')) name = name.slice(0, -4);
          return {
            name: name || 'unnamed',
            x: parseIntOr0(n.getAttribute('x')),
            y: parseIntOr0(n.getAttribute('y')),
            width: parseIntOr0(n.getAttribute('width')),
            height: parseIntOr0(n.getAttribute('height')),
            rotated: parseBool(n.getAttribute('rotated')),
            frameX: parseIntOr0(n.getAttribute('frameX')),
            frameY: parseIntOr0(n.getAttribute('frameY')),
            frameWidth: parseIntOr0(n.getAttribute('frameWidth')) || parseIntOr0(n.getAttribute('width')),
            frameHeight: parseIntOr0(n.getAttribute('frameHeight')) || parseIntOr0(n.getAttribute('height'))
          };
        })
      };
    }

    _cutFrame(img, frame) {
      const srcW = frame.width, srcH = frame.height;
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = srcW; srcCanvas.height = srcH;
      const sctx = srcCanvas.getContext('2d');
      sctx.drawImage(img, frame.x, frame.y, srcW, srcH, 0, 0, srcW, srcH);

      const finalW = frame.frameWidth, finalH = frame.frameHeight;
      const canvas = document.createElement('canvas');
      canvas.width = finalW; canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      const offsetX = frame.frameX, offsetY = frame.frameY;

      if (!frame.rotated) {
        ctx.drawImage(srcCanvas, -offsetX, -offsetY);
        return canvas;
      }

      const rotatedCanvas = document.createElement('canvas');
      rotatedCanvas.width = srcH; rotatedCanvas.height = srcW;
      const rctx = rotatedCanvas.getContext('2d');
      rctx.translate(0, srcW);
      rctx.rotate(-Math.PI / 2);
      rctx.drawImage(srcCanvas, 0, 0);
      ctx.drawImage(rotatedCanvas, -offsetX, -offsetY);
      return canvas;
    }

    _canvasToBlob(canvas) {
      return new Promise(resolve => {
        const scale = (typeof window !== 'undefined' && window.currentScale) ? window.currentScale : 1;
        if (scale < 1) {
          const scaled = document.createElement('canvas');
          scaled.width = Math.max(1, Math.round(canvas.width * scale));
          scaled.height = Math.max(1, Math.round(canvas.height * scale));
          const sctx = scaled.getContext('2d');
          sctx.imageSmoothingEnabled = true;
          sctx.imageSmoothingQuality = 'high';
          sctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
          scaled.toBlob(resolve, 'image/png');
        } else {
          canvas.toBlob(resolve, 'image/png');
        }
      });
    }
  }

  // ---------------- Helpers ----------------
  function getImageDataFromBitmap(img) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    c.width = img.width; c.height = img.height;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height).data;
  }

  async function areImagesEqual(img1, img2) {
    if (img1.width !== img2.width || img1.height !== img2.height) return false;
    const [d1, d2] = await Promise.all([getImageDataFromBitmap(img1), getImageDataFromBitmap(img2)]);
    for (let i = 0; i < d1.length; i += 4) {
      if (d1[i] !== d2[i] || d1[i + 1] !== d2[i + 1] || d1[i + 2] !== d2[i + 2] || d1[i + 3] !== d2[i + 3]) return false;
    }
    return true;
  }

  // createStrip: intento único de poner TODOS los frames en un único canvas.
  // Si falla por tamaño o soporte -> lanza CANVAS_TOO_LARGE o NO_CANVAS.
  async function createStrip(blobs, options = {}) {
    const limit = (options && typeof options.limit === 'number') ? options.limit : null;
    if (!blobs || blobs.length === 0) {
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      return new Promise(r => c.toBlob(r, 'image/png'));
    }

    const use = (limit && limit > 0 && blobs.length > limit) ? blobs.slice(0, limit) : blobs;

    // Intentar crear bitmaps (si falla -> NO_CANVAS)
    let images;
    try {
      images = await Promise.all(use.map(b => createImageBitmap(b)));
    } catch (err) {
      const e = new Error('El navegador no soporta operaciones de canvas/createImageBitmap');
      e.code = 'NO_CANVAS';
      throw e;
    }

    const maxW = Math.max(...images.map(i => i.width));
    const maxH = Math.max(...images.map(i => i.height));

    // límite estimado para evitar canvases gigantes (ajusta si quieres)
    const EST_MAX = 16000;

    // calcular tamaño total para ponerlos en una sola fila
    const totalW = maxW * images.length;
    const totalH = maxH;

    // si excede límites, fallar (sin dividir)
    if (totalW > EST_MAX || totalH > EST_MAX) {
      const e = new Error('Canvas demasiado grande para generar la cinta con todos los frames.');
      e.code = 'CANVAS_TOO_LARGE';
      throw e;
    }

    // crear canvas único y dibujar todos los frames centrados por celda
    const canvas = document.createElement('canvas');
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const e = new Error('No se obtuvo contexto 2d del canvas.');
      e.code = 'NO_CANVAS';
      throw e;
    }

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const x = i * maxW + Math.floor((maxW - img.width) / 2);
      const y = Math.floor((maxH - img.height) / 2);
      ctx.drawImage(img, x, y);
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  async function createGif(images) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const { width, height } = images[0];
    canvas.width = width; canvas.height = height;
    ctx.drawImage(images[0], 0, 0);
    return new Promise(r => canvas.toBlob(r, 'image/png'));
  }

  async function makeLabeledBlob(imageBitmap, label, width, height) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, c.height - 24, c.width, 24);
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, c.width / 2, c.height - 8);
    return new Promise(r => c.toBlob(r, 'image/png'));
  }

  // ---------------- DOM helpers ----------------
  function ensureDownloadArea() {
    const id = 'download-controls';
    let area = document.getElementById(id);
    if (!area) {
      area = document.createElement('div');
      area.id = id;
      area.className = 'download-area';
      const footer = document.querySelector('footer');
      if (footer && footer.parentNode) footer.parentNode.insertBefore(area, footer);
      else document.body.appendChild(area);
    }
    return area;
  }

  function createFileListFromFile(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt.files;
  }

  // revoke urls created during previews and downloads
  function revokeAllCreatedURLs() {
    createdObjectURLs.forEach(u => {
      try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ }
    });
    createdObjectURLs = [];
  }

  // ----------------- Main UI & Logic -----------------
  document.addEventListener('DOMContentLoaded', () => {
    cargarData();

    // DOM refs
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
    const outputGifCheckbox = document.getElementById('output-gif'); // optional

    const resultContent = document.querySelector('#result-panel .result-content') || document.getElementById('result-panel');

    const scaleRange = document.getElementById('scale-range');
    const scaleValue = document.getElementById('scale-value');
    const scaleWarning = document.getElementById('scale-warning');

    const downloadArea = ensureDownloadArea();

    // local app state
    const state = { mode: 'zip', zipFile: null, imageFile: null, xmlFile: null };
    const packer = new FunkierPacker();

    // inicial UI
    if (zipPanel) zipPanel.style.display = 'block';
    if (pngxmlPanel) pngxmlPanel.style.display = 'none';
    methodZipBtn?.classList.add('active');
    methodPngXmlBtn?.classList.remove('active');

    // --- switch methods (single listener)
    methodZipBtn?.addEventListener('click', () => {
      if (isProcessing) return;
      state.mode = 'zip';
      if (zipPanel) zipPanel.style.display = 'block';
      if (pngxmlPanel) pngxmlPanel.style.display = 'none';
      methodZipBtn.classList.add('active');
      methodPngXmlBtn.classList.remove('active');
      checkReady();
    });

    methodPngXmlBtn?.addEventListener('click', () => {
      if (isProcessing) return;
      state.mode = 'packer';
      if (zipPanel) zipPanel.style.display = 'none';
      if (pngxmlPanel) pngxmlPanel.style.display = 'block';
      methodZipBtn.classList.remove('active');
      methodPngXmlBtn.classList.add('active');
      checkReady();
    });

    // file pickers
    zipBtn?.addEventListener('click', () => zipInput && zipInput.click());
    imageBtn?.addEventListener('click', () => imageInput && imageInput.click());
    xmlBtn?.addEventListener('click', () => xmlInput && xmlInput.click());

    // drag & drop helpers
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
      if (zipInput) zipInput.files = createFileListFromFile(file);
      zipInput?.dispatchEvent(new Event('change'));
    });
    makeDropZoneHandlers(document.getElementById('png-drop-zone'), (file) => {
      if (!file) return;
      if (imageInput) imageInput.files = createFileListFromFile(file);
      imageInput?.dispatchEvent(new Event('change'));
    });
    makeDropZoneHandlers(document.getElementById('xml-drop-zone'), (file) => {
      if (!file) return;
      if (xmlInput) xmlInput.files = createFileListFromFile(file);
      xmlInput?.dispatchEvent(new Event('change'));
    });

    // input change
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
        // disable zip generate while packer selected
        generateBtnZip.disabled = true;
      } else {
        // mode zip
        generateBtnZip.disabled = !state.zipFile;
        if (!state.zipFile) statusTextZip && (statusTextZip.textContent = "Selecciona un archivo ZIP para continuar.");
        // disable pngxml generate while zip selected
        generateBtnPngXml.disabled = true;
      }
      // if processing: ensure both generate buttons disabled
      if (isProcessing) {
        generateBtnZip.disabled = true;
        generateBtnPngXml.disabled = true;
      }
    }

    // scale UI
    if (scaleRange && scaleValue) {
      scaleRange.addEventListener('input', () => {
        const v = parseFloat(scaleRange.value);
        const limited = Math.max(0.5, Math.min(1, v));
        window.currentScale = limited;
        scaleValue.textContent = Math.round(window.currentScale * 100) + '%';
        if (scaleWarning) scaleWarning.style.display = window.currentScale < 1.0 ? 'block' : 'none';
      });
      scaleRange.value = window.currentScale.toString();
      scaleValue.textContent = Math.round(window.currentScale * 100) + '%';
      if (scaleWarning) scaleWarning.style.display = window.currentScale < 1.0 ? 'block' : 'none';
    }

    // helper: scale blob (only when from ZIP)
    async function scaleBlobIfNeeded(blob) {
      const scale = (typeof window !== 'undefined' && window.currentScale) ? window.currentScale : 1;
      if (!blob) return blob;
      if (scale >= 1) return blob;
      try {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(bmp.width * scale));
        c.height = Math.max(1, Math.round(bmp.height * scale));
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        return await new Promise(r => c.toBlob(r, 'image/png'));
      } catch (e) {
        console.warn('scaleBlobIfNeeded fallo, retornando blob original:', e);
        return blob;
      }
    }

    // prevent double-click / reentrancy on generate
    async function onGenerateZip() {
      if (isProcessing) {
        statusTextZip && (statusTextZip.textContent = "Ya se está generando. Espera a que termine...");
        return;
      }
      isProcessing = true;
      setUiProcessing(true, 'zip');
      previewSet.clear();
      revokeAllCreatedURLs();
      clearResultsInner();
      try {
        await runZip(!!removeDuplicatesCheckbox?.checked, !!outputGifCheckbox?.checked);
      } finally {
        isProcessing = false;
        setUiProcessing(false);
        checkReady();
      }
    }

    async function onGeneratePngXml() {
      if (isProcessing) {
        statusTextPngXml && (statusTextPngXml.textContent = "Ya se está generando. Espera a que termine...");
        return;
      }
      isProcessing = true;
      setUiProcessing(true, 'packer');
      previewSet.clear();
      revokeAllCreatedURLs();
      clearResultsInner();
      try {
        await runPacker(!!removeDuplicatesCheckbox?.checked);
      } finally {
        isProcessing = false;
        setUiProcessing(false);
        checkReady();
      }
    }

    // wire generate buttons
    generateBtnZip?.addEventListener('click', onGenerateZip);
    generateBtnPngXml?.addEventListener('click', onGeneratePngXml);

    function setUiProcessing(flag, mode) {
      const elsToDisable = [
        generateBtnZip, generateBtnPngXml,
        zipBtn, imageBtn, xmlBtn,
        zipInput, imageInput, xmlInput,
        methodZipBtn, methodPngXmlBtn
      ];
      elsToDisable.forEach(el => { if (el) el.disabled = !!flag; });
      if (flag) {
        if (mode === 'zip') statusTextZip && (statusTextZip.textContent = "Iniciando proceso...");
        else statusTextPngXml && (statusTextPngXml.textContent = "Iniciando proceso...");
      }
    }

    function clearResultsInner() {
      if (resultContent) {
        const previews = resultContent.querySelectorAll('.preview-container');
        previews.forEach(p => {
          if (p._cleanupPreviewURL) {
            try { URL.revokeObjectURL(p._cleanupPreviewURL); } catch (e) {}
          }
        });
        resultContent.innerHTML = '';
      }
      const area = ensureDownloadArea();
      if (area) area.innerHTML = '';
    }

    function clearResults() {
      previewSet.clear();
      revokeAllCreatedURLs();
      clearResultsInner();
    }

    // Run handlers
    async function runPacker(removeDuplicates = false) {
      try {
        statusTextPngXml && (statusTextPngXml.textContent = "Procesando PNG + XML...");
        if (!state.imageFile || !state.xmlFile) {
          statusTextPngXml && (statusTextPngXml.textContent = "Faltan archivos (PNG o XML).");
          return;
        }
        const frames = await packer.processFiles(state.imageFile, state.xmlFile);
        const animGroups = groupFrames(frames);
        await createTiras(animGroups, state.imageFile.name, removeDuplicates, false);
      } catch (err) {
        statusTextPngXml && (statusTextPngXml.textContent = 'Error: ' + (err && err.message ? err.message : err));
        console.error(err);
      }
    }

    async function runZip(removeDuplicates = false, outputGif = false) {
      try {
        statusTextZip && (statusTextZip.textContent = "Procesando ZIP de frames...");
        if (!state.zipFile) {
          statusTextZip && (statusTextZip.textContent = "Falta el ZIP.");
          return;
        }

        const zip = await JSZip.loadAsync(state.zipFile);
        const framesList = [];
        for (const [filename, entry] of Object.entries(zip.files)) {
          if (!filename.toLowerCase().endsWith('.png')) continue;
          framesList.push({ name: filename.slice(0, -4), entry });
        }

        const animGroups = {};
        for (const f of framesList) {
          const match = f.name.match(/^(.*?)(\d+)$/);
          if (!match) {
            const baseName = f.name.trim();
            if (!animGroups[baseName]) animGroups[baseName] = [];
            animGroups[baseName].push({ name: f.name, frameNumber: 0, entry: f.entry });
            continue;
          }
          const baseName = match[1].trim();
          const frameNumber = parseInt(match[2]);
          if (!animGroups[baseName]) animGroups[baseName] = [];
          animGroups[baseName].push({ name: f.name, frameNumber, entry: f.entry });
        }

        await createTiras(animGroups, state.zipFile.name, removeDuplicates, outputGif);
      } catch (err) {
        statusTextZip && (statusTextZip.textContent = 'Error: ' + (err && err.message ? err.message : err));
        console.error(err);
      }
    }

    // Create strips and previews (ahora soporta combinar TODO en UNA cinta si combineIntoSingleStrip=true)
    async function createTiras(animGroups, originalName, removeDuplicates = false, outputGif = false) {
      const zip = new JSZip();
      const sortedNames = Object.keys(animGroups).sort();

      let total = sortedNames.length;
      let processed = 0;
      const PREVIEW_MAX_FRAMES = 80;

      // prioridad para ordenar animaciones dentro de la cinta combinada
      const priorityOrder = ['idle', 'left', 'down', 'up', 'right'];

      if (combineIntoSingleStrip) {
        // juntar todos los blobs en el orden: prioridad primero, luego el resto alfabético
        const orderedNames = [
          ...priorityOrder.filter(n => sortedNames.includes(n)),
          ...sortedNames.filter(n => !priorityOrder.includes(n))
        ];

        // recolectar blobs en ese orden
        const allBlobsInfo = [];
        for (const name of orderedNames) {
          const framesArr = (animGroups[name] || []).slice();
          framesArr.sort((a, b) => (a.frameNumber || 0) - (b.frameNumber || 0));
          for (const f of framesArr) {
            if (f.blob) {
              allBlobsInfo.push({ blob: f.blob, fromEntry: false, name });
            } else if (f.entry) {
              try {
                const b = await f.entry.async('blob');
                allBlobsInfo.push({ blob: b, fromEntry: true, name });
              } catch (e) {
                console.warn('No pudo extraer blob de entry:', e);
              }
            }
          }
        }

        // opcional: quitar duplicados si pediste
        let blobs = allBlobsInfo.map(i => i.blob).filter(Boolean);
        if (removeDuplicates && blobs.length > 1) {
          const unique = [];
          try {
            unique.push(blobs[0]);
            for (let i = 1; i < blobs.length; i++) {
              try {
                const curBmp = await createImageBitmap(blobs[i]);
                const prevBmp = await createImageBitmap(unique[unique.length - 1]);
                const eq = await areImagesEqual(curBmp, prevBmp);
                if (!eq) unique.push(blobs[i]);
              } catch (e) {
                unique.push(blobs[i]);
              }
            }
            blobs = unique;
          } catch (e) {
            console.warn('Error comparando duplicados, se mantienen todos:', e);
          }
        }

        // aplicar escala si es necesario (solo si vino de ZIP/entry)
        if (window.currentScale < 1) {
          for (let i = 0; i < blobs.length; i++) {
            try {
              blobs[i] = await scaleBlobIfNeeded(blobs[i]);
            } catch (e) {
              console.warn('Error al escalar blob:', e);
            }
          }
        }

        // preview (limitado)
        try {
          if (blobs.length > 0) {
            addPreview('combined', blobs, { previewLimit: Math.min(PREVIEW_MAX_FRAMES, blobs.length) });
          } else {
            // no frames -> nada
          }
        } catch (e) {
          console.warn('addPreview falló para combined:', e);
        }

        // intentar crear la cinta completa UNICA (si falla -> fallo y advertencia)
        try {
          if (blobs.length === 0) {
            // nada que hacer
          } else {
            const fullStripBlob = await createStrip(blobs, { limit: null });
            zip.file(`combined.png`, fullStripBlob);
          }
        } catch (e) {
          if (e && (e.code === 'CANVAS_TOO_LARGE' || e.code === 'NO_CANVAS')) {
            const area = ensureDownloadArea();
            if (area) {
              area.innerHTML = `<div class="build-error-box"><div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="error-text"><strong>Error:</strong> No se pudo generar la cinta combinada porque el canvas es demasiado grande o el navegador no soporta operaciones de canvas. Intenta quitar frames, bajar resolución o usar otro navegador.</div></div>`;
            }
            console.warn('createStrip falló para combined', e);
            // no añadir nada al zip (sigue)
          } else {
            console.warn('No se pudo crear la cinta combinada:', e);
          }
        }

        // generar ZIP final
        try {
          const finalBlob = await zip.generateAsync({ type: 'blob' });
          const baseName = originalName.replace(/\.(png|jpg|jpeg|zip)$/i, '');
          const finalName = `TJ-${baseName}.zip`;
          addDownloadButton(finalBlob, finalName);
        } catch (e) {
          console.error('Error generando ZIP final:', e);
          const area = ensureDownloadArea();
          if (area) {
            area.innerHTML = `<div class="build-error-box"><div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
              <div class="error-text"><strong>Error:</strong> No se pudo generar el ZIP final.</div></div>`;
          }
        }

        if (state.mode === 'zip') statusTextZip && (statusTextZip.textContent = "¡Procesamiento completado!");
        else statusTextPngXml && (statusTextPngXml.textContent = "¡Procesamiento completado!");
        return;
      }

      // si no combinamos, comportamiento tradicional: una cinta por animación
      for (const animName of sortedNames) {
        if (!animGroups[animName] || animGroups[animName].length === 0) {
          processed++; continue;
        }
        const progressText = `Procesando: ${animName} (${processed + 1}/${total})`;
        if (state.mode === 'zip') statusTextZip && (statusTextZip.textContent = progressText);
        else statusTextPngXml && (statusTextPngXml.textContent = progressText);

        let framesArr = animGroups[animName];
        framesArr.sort((a, b) => (a.frameNumber || 0) - (b.frameNumber || 0));

        // obtener blobs (entry.async o blob)
        let blobsInfo = await Promise.all(framesArr.map(async f => {
          if (f.blob) return { blob: f.blob, fromEntry: false };
          try {
            const b = await f.entry.async('blob');
            return { blob: b, fromEntry: true };
          } catch (e) {
            console.warn('No pudo extraer blob de entry:', e);
            return { blob: null, fromEntry: true };
          }
        }));

        // remove duplicates (if requested)
        if (removeDuplicates && blobsInfo.length > 1) {
          const uniqueInfos = [];
          if (blobsInfo[0] && blobsInfo[0].blob) uniqueInfos.push(blobsInfo[0]);
          for (let i = 1; i < blobsInfo.length; i++) {
            const cur = blobsInfo[i];
            if (!cur || !cur.blob) continue;
            try {
              const curBmp = await createImageBitmap(cur.blob);
              const prevBmp = await createImageBitmap(uniqueInfos[uniqueInfos.length - 1].blob);
              const eq = await areImagesEqual(curBmp, prevBmp);
              if (!eq) uniqueInfos.push(cur);
            } catch (e) {
              uniqueInfos.push(cur);
            }
          }
          blobsInfo = uniqueInfos;
        }

        // scale blobs that came from entry and only if scale < 1
        if (window.currentScale < 1) {
          for (let i = 0; i < blobsInfo.length; i++) {
            if (blobsInfo[i] && blobsInfo[i].blob && blobsInfo[i].fromEntry) {
              try {
                const scaled = await scaleBlobIfNeeded(blobsInfo[i].blob);
                blobsInfo[i] = { blob: scaled, fromEntry: false };
              } catch (e) { console.warn('Error al escalar blob:', e); }
            }
          }
        }

        let blobs = blobsInfo.map(i => i ? i.blob : null).filter(Boolean);
        if (blobs.length === 0) { processed++; continue; }

        // always add full strip into zip
        try {
          const fullStripBlob = await createStrip(blobs, { limit: null });
          zip.file(`${animName}.png`, fullStripBlob);
        } catch (e) {
          if (e && (e.code === 'CANVAS_TOO_LARGE' || e.code === 'NO_CANVAS')) {
            const area = ensureDownloadArea();
            if (area) {
              area.innerHTML = `<div class="build-error-box"><div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="error-text"><strong>Error:</strong> No se pudo generar la cinta <em>${animName}</em> porque el canvas es demasiado grande o el navegador no soporta operaciones de canvas. Intenta quitar frames, bajar resolución o usar otro navegador.</div></div>`;
            }
            console.warn('createStrip falló para', animName, e);
          } else {
            console.warn('No se pudo crear strip completo para zip:', e);
          }
        }

        // preview: use limited frames to avoid huge canvases
        const previewLimit = Math.min(PREVIEW_MAX_FRAMES, blobs.length);
        try {
          addPreview(animName, blobs, { previewLimit });
        } catch (e) {
          console.warn('addPreview falló:', e);
        }

        processed++;
      }

      // generar ZIP final y añadir botón en área separada
      try {
        const finalBlob = await zip.generateAsync({ type: 'blob' });
        const baseName = originalName.replace(/\.(png|jpg|jpeg|zip)$/i, '');
        const finalName = `TJ-${baseName}.zip`;
        addDownloadButton(finalBlob, finalName);
      } catch (e) {
        console.error('Error generando ZIP final:', e);
        const area = ensureDownloadArea();
        if (area) {
          area.innerHTML = `<div class="build-error-box"><div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="error-text"><strong>Error:</strong> No se pudo generar el ZIP final.</div></div>`;
        }
      }

      if (state.mode === 'zip') statusTextZip && (statusTextZip.textContent = "¡Procesamiento completado!");
      else statusTextPngXml && (statusTextPngXml.textContent = "¡Procesamiento completado!");
    }

    // addPreview: evita duplicados con previewSet y registra URLs
    async function addPreview(name, blobsArray, options = {}) {
      if (!resultContent) return;
      if (previewSet.has(name)) return; // ya agregado en esta corrida
      previewSet.add(name);

      const container = document.createElement('div');
      container.className = 'preview-container';

      const title = document.createElement('div');
      title.className = 'preview-title';
      title.textContent = name;
      container.appendChild(title);

      const invalid = blobsArray.some(b => !b || (typeof b.size === 'number' && b.size === 0));
      if (invalid) {
        const errorBox = document.createElement('div');
        errorBox.className = 'build-error-box';
        errorBox.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                              <div class="error-text"><strong>Error de construcción:</strong> son demasiados frames o los frames son muy grandes. Intenta <strong>quitar frames duplicados</strong> o <strong>bajar un poco la resolución</strong>.</div>`;
        container.appendChild(errorBox);
        const label = document.createElement('div'); label.className = 'preview-label';
        label.textContent = `${blobsArray.length} frame(s) — vista previa no disponible.`; 
        container.appendChild(label);
        resultContent.appendChild(container);
        return;
      }

      try {
        const previewLimit = (options && options.previewLimit) ? options.previewLimit : Math.min(80, blobsArray.length);
        const truncated = previewLimit < blobsArray.length;

        let previewBlob;
        try {
          previewBlob = await createStrip(blobsArray, { limit: previewLimit });
        } catch (err) {
          if (err && err.code === 'CANVAS_TOO_LARGE') {
            const errorBox = document.createElement('div');
            errorBox.className = 'build-error-box';
            errorBox.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                                  <div class="error-text"><strong>Error:</strong> La cinta es demasiado grande para generar una vista previa. Reduce número de frames o baja resolución.</div>`;
            container.appendChild(errorBox);
            const label = document.createElement('div'); label.className = 'preview-label';
            label.textContent = `${blobsArray.length} frame(s) — vista previa no disponible.`; container.appendChild(label);
            resultContent.appendChild(container);
            return;
          } else if (err && err.code === 'NO_CANVAS') {
            const errorBox = document.createElement('div');
            errorBox.className = 'build-error-box';
            errorBox.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                                  <div class="error-text"><strong>Error:</strong> El navegador no soporta operaciones de canvas necesarias para la vista previa.</div>`;
            container.appendChild(errorBox);
            const label = document.createElement('div'); label.className = 'preview-label';
            label.textContent = `${blobsArray.length} frame(s) — vista previa no disponible.`; container.appendChild(label);
            resultContent.appendChild(container);
            return;
          } else {
            throw err;
          }
        }

        const stripUrl = URL.createObjectURL(previewBlob);
        createdObjectURLs.push(stripUrl);
        container._cleanupPreviewURL = stripUrl;

        const stripWrapper = document.createElement('div');
        stripWrapper.className = 'preview-strip-wrapper';
        stripWrapper.style.overflowX = 'auto';
        stripWrapper.style.whiteSpace = 'nowrap';
        stripWrapper.style.width = '100%';
        stripWrapper.style.boxSizing = 'border-box';
        stripWrapper.style.padding = '6px 0';
        stripWrapper.style.cursor = 'grab';
        stripWrapper.style.WebkitOverflowScrolling = 'touch';

        const img = document.createElement('img');
        img.className = 'preview-strip-image';
        img.src = stripUrl;
        img.alt = `${name} - cinta de frames`;
        img.loading = 'lazy';
        img.style.maxWidth = 'none';
        img.style.height = 'auto';
        img.style.display = 'inline-block';

        stripWrapper.appendChild(img);
        container.appendChild(stripWrapper);

        const label = document.createElement('div');
        label.className = 'preview-label';
        label.textContent = `${previewLimit}${truncated ? '/' + blobsArray.length + ' (mostrando)' : ''} frame(s)`;
        container.appendChild(label);

        // descargar cinta individual (si no está procesando otra corrida)
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'select-file-button';
        downloadBtn.style.marginTop = '8px';
        downloadBtn.textContent = 'Descargar cinta individual';
        downloadBtn.addEventListener('click', async () => {
          if (isProcessing) {
            const err = document.createElement('div');
            err.className = 'build-error-box';
            err.style.marginTop = '8px';
            err.innerHTML = `<div class="error-icon"><i class="fas fa-info-circle"></i></div>
                             <div class="error-text">La aplicación está procesando. Intenta descargar cuando termine.</div>`;
            container.appendChild(err);
            return;
          }
          downloadBtn.disabled = true;
          downloadBtn.textContent = 'Generando...';
          try {
            const fullBlob = await createStrip(blobsArray, { limit: null });
            const url = URL.createObjectURL(fullBlob);
            createdObjectURLs.push(url);
            const a = document.createElement('a');
            a.href = url;
            const safeName = name.replace(/[^\w\-]/g, '_') || 'strip';
            a.download = `${safeName}-strip.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 2500);
          } catch (e) {
            if (e && e.code === 'CANVAS_TOO_LARGE') {
              const errEl = document.createElement('div');
              errEl.className = 'build-error-box';
              errEl.style.marginTop = '8px';
              errEl.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                                 <div class="error-text"><strong>Error:</strong> no se pudo generar la cinta completa porque el canvas sería demasiado grande. Reduce frames o baja resolución.</div>`;
              container.appendChild(errEl);
            } else if (e && e.code === 'NO_CANVAS') {
              const errEl = document.createElement('div');
              errEl.className = 'build-error-box';
              errEl.style.marginTop = '8px';
              errEl.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                                 <div class="error-text"><strong>Error:</strong> el navegador no soporta canvas/createImageBitmap.</div>`;
              container.appendChild(errEl);
            } else {
              console.error('Error generando cinta completa:', e);
              const errEl = document.createElement('div');
              errEl.className = 'build-error-box';
              errEl.style.marginTop = '8px';
              errEl.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                                 <div class="error-text"><strong>Error:</strong> no se pudo generar la cinta completa (posible falta de recursos).</div>`;
              container.appendChild(errEl);
            }
          } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Descargar cinta individual';
          }
        });

        container.appendChild(downloadBtn);

        // drag-to-scroll handlers
        let isDown = false, startX = 0, scrollLeft = 0;
        stripWrapper.addEventListener('mousedown', (e) => {
          isDown = true;
          stripWrapper.style.cursor = 'grabbing';
          startX = e.pageX - stripWrapper.offsetLeft;
          scrollLeft = stripWrapper.scrollLeft;
          e.preventDefault();
        });
        stripWrapper.addEventListener('mouseleave', () => { isDown = false; stripWrapper.style.cursor = 'grab'; });
        stripWrapper.addEventListener('mouseup', () => { isDown = false; stripWrapper.style.cursor = 'grab'; });
        stripWrapper.addEventListener('mousemove', (e) => {
          if (!isDown) return;
          const x = e.pageX - stripWrapper.offsetLeft;
          const walk = (x - startX) * 1;
          stripWrapper.scrollLeft = scrollLeft - walk;
        });
        stripWrapper.addEventListener('touchstart', (e) => {
          startX = e.touches[0].pageX - stripWrapper.offsetLeft;
          scrollLeft = stripWrapper.scrollLeft;
        });
        stripWrapper.addEventListener('touchmove', (e) => {
          const x = e.touches[0].pageX - stripWrapper.offsetLeft;
          const walk = (x - startX) * 1;
          stripWrapper.scrollLeft = scrollLeft - walk;
        });

        resultContent.appendChild(container);
      } catch (e) {
        console.error('addPreview error:', e);
        const errBox = document.createElement('div');
        errBox.className = 'build-error-box';
        errBox.innerHTML = `<div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                            <div class="error-text"><strong>Error de construcción:</strong> no se pudo generar la preview.</div>`;
        resultContent.appendChild(errBox);
      }
    }

    // addDownloadButton: limpia el área y pone 1 solo botón
    function addDownloadButton(blob, fileName) {
      const area = ensureDownloadArea();
      if (!area) return;
      area.innerHTML = '';
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
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        createdObjectURLs.push(url);
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
      });

      wrapper.appendChild(info);
      wrapper.appendChild(btn);
      area.appendChild(wrapper);
    }

    function groupFrames(frames) {
      const animGroups = {};
      for (const f of frames) {
        const match = f.name.match(/^(.*?)(\d+)$/);
        if (!match) {
          const baseName = f.name.trim();
          if (!animGroups[baseName]) animGroups[baseName] = [];
          animGroups[baseName].push({ name: f.name, frameNumber: 0, blob: f.blob });
          continue;
        }
        const baseName = match[1].trim();
        const frameNumber = parseInt(match[2]);
        if (!animGroups[baseName]) animGroups[baseName] = [];
        animGroups[baseName].push({ name: f.name, frameNumber, blob: f.blob });
      }
      return animGroups;
    }

    // initial readiness check
    checkReady();

    // expose clearResults to console if needed for debugging
    window.__fp_clearResults = clearResults;
  });
})();