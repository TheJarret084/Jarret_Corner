//me cago en todo...
// funkier-ui.js (versión con progreso por animación y limpieza de URLs)
document.addEventListener('DOMContentLoaded', () => {
    // ======== DOM ========
    const zipMethodBtn = document.getElementById('zip-method-btn');
    const spritesheetMethodBtn = document.getElementById('spritesheet-method-btn');

    const zipUploadPanel = document.getElementById('zip-upload-panel');
    const spritesheetUploadPanel = document.getElementById('spritesheet-upload-panel');

    const zipDropZone = document.getElementById('zip-drop-zone');
    const dualDropZones = document.querySelectorAll('.dual-upload-container .drop-zone');

    const zipInput = document.getElementById('zip-input');
    const imageInput = document.getElementById('image-input');
    const xmlInput = document.getElementById('xml-input');

    const generateBtn = document.getElementById('generate-btn');
    const removeDupCheckbox = document.getElementById('remove-duplicates');

    const loadingOverlay = document.getElementById('loading-overlay');
    const statusText = document.getElementById('status-text');
    const resultPanel = document.getElementById('result-panel');
    const resultInfo = document.getElementById('result-info');
    const downloadAgainBtn = document.getElementById('download-again');

    // ======== Estado ========
    let state = {
        mode: 'zip', // 'zip' or 'packer'
        zipFile: null,
        imageFile: null,
        xmlFile: null,
        lastOutputUrl: null,
        lastOutputName: null,
        previewUrls: [] // para revocar
    };

    // try to use FunkierPacker if available
    let packer = null;
    if (typeof FunkierPacker !== 'undefined') {
        try { packer = new FunkierPacker(); } catch (e) { console.warn('FunkierPacker init failed', e); }
    } else {
        console.warn('FunkierPacker not found — spritesheet+XML mode will error.');
    }

    // ======== Utilidades UI ========
    function switchMethod(to) {
        state.mode = to === 'zip' ? 'zip' : 'packer';
        if (state.mode === 'zip') {
            zipUploadPanel.style.display = 'block';
            spritesheetUploadPanel.style.display = 'none';
            zipMethodBtn.classList.add('active');
            spritesheetMethodBtn.classList.remove('active');
        } else {
            zipUploadPanel.style.display = 'none';
            spritesheetUploadPanel.style.display = 'flex';
            zipMethodBtn.classList.remove('active');
            spritesheetMethodBtn.classList.add('active');
        }
        updateGenerateBtn();
        updateStatusFromState();
    }

    function updateGenerateBtn() {
        if (state.mode === 'zip') {
            generateBtn.disabled = !state.zipFile;
        } else {
            generateBtn.disabled = !(state.imageFile && state.xmlFile);
        }
    }

    function updateStatusFromState() {
        if (state.mode === 'zip') {
            statusText.textContent = state.zipFile ? `ZIP seleccionado: ${state.zipFile.name}` : 'Selecciona un ZIP';
        } else {
            if (state.imageFile && state.xmlFile) statusText.textContent = `Listo para generar: ${state.imageFile.name} + ${state.xmlFile.name}`;
            else if (state.imageFile && !state.xmlFile) statusText.textContent = 'Falta el archivo XML';
            else if (state.xmlFile && !state.imageFile) statusText.textContent = 'Falta el archivo PNG';
            else statusText.textContent = 'Selecciona PNG y XML';
        }
    }

    // showLoading tiene soporte de texto y porcentaje (si el overlay contiene #loading-subtext y #loading-progress)
    function showLoading(show, text = 'Cargando...', percent = null) {
        if (!loadingOverlay) return;
        loadingOverlay.style.display = show ? 'flex' : 'none';
        try {
            const sub = loadingOverlay.querySelector('#loading-subtext');
            const prog = loadingOverlay.querySelector('#loading-progress');
            if (sub) sub.textContent = text;
            else loadingOverlay.textContent = text;
            if (prog) prog.style.width = (typeof percent === 'number') ? `${Math.max(0, Math.min(100, Math.round(percent)))}%` : prog.style.width;
        } catch (e) {
            loadingOverlay.textContent = show ? text : '';
        }
    }

    // revoca todas las URLs de preview almacenadas
    function revokePreviewUrls() {
        if (!state.previewUrls) return;
        state.previewUrls.forEach(u => {
            try { URL.revokeObjectURL(u); } catch (e) {}
        });
        state.previewUrls = [];
    }

    // revoca última salida ZIP si existe
    function revokeLastOutputUrl() {
        if (state.lastOutputUrl) {
            try { URL.revokeObjectURL(state.lastOutputUrl); } catch (e) {}
            state.lastOutputUrl = null;
            state.lastOutputName = null;
        }
    }

    function clearResults() {
        // eliminar previews y revocar sus URLs
        revokePreviewUrls();
        const previews = resultPanel.querySelectorAll('.preview-container');
        previews.forEach(p => p.remove());
        // eliminar download button(s) generados
        const dlBtns = resultPanel.querySelectorAll('button.download-btn');
        dlBtns.forEach(b => b.remove());
        if (resultInfo) resultInfo.textContent = '';
        resultPanel.style.display = 'none';
    }

    function setResultZip(blob, filename) {
        // revocar anterior si había
        revokeLastOutputUrl();
        const url = URL.createObjectURL(blob);
        state.lastOutputUrl = url;
        state.lastOutputName = filename;
        resultPanel.style.display = 'block';
        resultInfo.innerHTML = `Archivo listo: <strong>${filename}</strong>`;
        downloadAgainBtn.onclick = () => {
            if (!state.lastOutputUrl) return;
            const a = document.createElement('a');
            a.href = state.lastOutputUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
        };
    }

    // ======== Eventos de alternancia ========
    zipMethodBtn.addEventListener('click', () => switchMethod('zip'));
    spritesheetMethodBtn.addEventListener('click', () => switchMethod('packer'));

    // ======== Inputs change handlers ========
    zipInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        state.zipFile = f;
        updateGenerateBtn();
        updateStatusFromState();
    });

    imageInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        state.imageFile = f;
        updateGenerateBtn();
        updateStatusFromState();
    });

    xmlInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        state.xmlFile = f;
        updateGenerateBtn();
        updateStatusFromState();
    });

    // ======== Drag & drop setup ========
    function setupDropZone(zone, handler) {
        if (!zone) return;
        zone.addEventListener('dragover', (ev) => { ev.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', (ev) => { ev.preventDefault(); zone.classList.remove('dragover'); });
        zone.addEventListener('drop', (ev) => {
            ev.preventDefault();
            zone.classList.remove('dragover');
            const files = ev.dataTransfer.files;
            if (!files || files.length === 0) return;
            handler(files[0]);
        });
    }

    setupDropZone(zipDropZone, (file) => {
        state.zipFile = file;
        try { zipInput.files = (new DataTransfer()).files; } catch (e) {}
        updateGenerateBtn();
        updateStatusFromState();
    });

    if (dualDropZones && dualDropZones.length >= 2) {
        setupDropZone(dualDropZones[0], (file) => {
            state.imageFile = file;
            try { const dt = new DataTransfer(); dt.items.add(file); imageInput.files = dt.files; } catch(e) {}
            updateGenerateBtn();
            updateStatusFromState();
        });
        setupDropZone(dualDropZones[1], (file) => {
            state.xmlFile = file;
            try { const dt = new DataTransfer(); dt.items.add(file); xmlInput.files = dt.files; } catch(e) {}
            updateGenerateBtn();
            updateStatusFromState();
        });
    }

    // ======== Generar ========
    generateBtn.addEventListener('click', async () => {
        clearResults();
        revokeLastOutputUrl(); // si hay salida anterior, la revocamos (evitar fugas)
        showLoading(true, 'Iniciando...', 0);
        try {
            if (state.mode === 'packer') {
                await runPackerMode();
            } else {
                await runZipMode();
            }
        } catch (err) {
            console.error(err);
            statusText.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
            alert('Error: ' + (err && err.message ? err.message : String(err)));
        } finally {
            // pequeño retardo para que el usuario vea el 100%
            setTimeout(() => showLoading(false), 300);
        }
    });

    // ======== Run Packer (spritesheet + xml) ========
    async function runPackerMode() {
        if (!packer) throw new Error('FunkierPacker no disponible.');
        if (!state.imageFile || !state.xmlFile) {
            statusText.textContent = 'Falta PNG o XML';
            return;
        }

        statusText.textContent = 'Procesando PNG + XML...';
        const frames = await packer.processFiles(state.imageFile, state.xmlFile, {}, (progress) => {
            const pct = 5 + Math.round(progress * 80);
            showLoading(true, `Procesando sprites... ${Math.round(pct)}%`, pct);
        });

        showLoading(true, 'Agrupando frames...', 85);
        const animGroups = groupFrames(frames);

        await createTiras(animGroups, state.imageFile.name, { removeDuplicates: !!removeDupCheckbox.checked });
        statusText.textContent = '¡Procesamiento completado!';
    }

    // ======== Run ZIP mode ========
    async function runZipMode() {
        if (!state.zipFile) {
            statusText.textContent = 'No hay ZIP seleccionado';
            return;
        }

        statusText.textContent = 'Procesando ZIP...';
        showLoading(true, 'Leyendo ZIP...', 5);

        const zip = await JSZip.loadAsync(state.zipFile);
        const framesList = [];
        let count = 0;
        for (const [filename, entry] of Object.entries(zip.files)) {
            if (!filename.toLowerCase().endsWith('.png')) continue;
            const base = filename.replace(/^.*[\\/]/, '').slice(0, -4);
            framesList.push({ name: base, entry });
            count++;
        }
        showLoading(true, `Encontradas ${count} imágenes`, 15);

        const animGroups = {};
        for (const f of framesList) {
            const m = f.name.match(/^(.*?)(\d+)$/);
            if (!m) continue;
            const baseName = m[1].trim();
            const frameNumber = parseInt(m[2], 10);
            if (!animGroups[baseName]) animGroups[baseName] = [];
            animGroups[baseName].push({ name: f.name, frameNumber, entry: f.entry });
        }
        showLoading(true, 'Agrupando animaciones...', 25);

        await createTiras(animGroups, state.zipFile.name, { removeDuplicates: !!removeDupCheckbox.checked });
        statusText.textContent = '¡Procesamiento completado!';
    }

    // ======== createTiras (con progreso por animación) ========
    async function createTiras(animGroups, originalName, options = {}) {
        const zipOut = new JSZip();
        const names = Object.keys(animGroups).sort();
        const total = names.length;
        let processed = 0;

        for (const animName of names) {
            processed++;
            // progreso general inicio de anim
            showLoading(true, `Procesando ${animName} (${processed}/${total})`, 10 + Math.round((processed - 1) / total * 80));
            let framesArr = animGroups[animName];

            if (framesArr.every(f => typeof f.frameNumber === 'number')) {
                framesArr.sort((a, b) => a.frameNumber - b.frameNumber);
            }

            // convertir a blobs con micro-progreso
            const blobs = [];
            for (let i = 0; i < framesArr.length; i++) {
                const f = framesArr[i];
                if (f.blob) {
                    blobs.push(f.blob);
                } else if (f.entry && typeof f.entry.async === 'function') {
                    showLoading(true, `Cargando frame ${i+1}/${framesArr.length} de ${animName}`, 10 + Math.round(((processed-1) + (i / framesArr.length)) / total * 80));
                    const b = await f.entry.async('blob');
                    blobs.push(b);
                } else if (f.file instanceof File) {
                    blobs.push(f.file);
                } else {
                    throw new Error('Entrada de frame no reconocida: ' + animName);
                }
            }

            // deduplicado (comparando blobs consecutivos) con micro-progreso
            let finalBlobs = blobs;
            if (options.removeDuplicates && blobs.length > 1) {
                finalBlobs = [blobs[0]];
                for (let i = 1; i < blobs.length; i++) {
                    showLoading(true, `Comparando frames ${i}/${blobs.length} de ${animName}`, 10 + Math.round(((processed-1) + (i / blobs.length)) / total * 80));
                    try {
                        const eq = await areBlobsEqual(blobs[i], blobs[i - 1]);
                        if (!eq) finalBlobs.push(blobs[i]);
                    } catch (e) {
                        finalBlobs.push(blobs[i]); // si falla comparación, conservar
                    }
                }
            }

            // crear strip
            showLoading(true, `Creando tira para ${animName}`, 10 + Math.round((processed / total) * 80));
            const stripBlob = await createStrip(finalBlobs);
            zipOut.file(`${animName}.png`, stripBlob);

            // mostrar preview (guardamos URLs para revocarlas después)
            addPreview(animName, finalBlobs);
        }

        showLoading(true, 'Generando ZIP final...', 95);
        const finalBlob = await zipOut.generateAsync({ type: 'blob' });
        const baseName = originalName.replace(/\.(png|jpg|jpeg|zip)$/i, '');
        const finalName = `TJ-${baseName}.zip`;

        setResultZip(finalBlob, finalName);
        addDownloadButton(finalBlob, finalName);

        showLoading(true, 'Completado', 100);
    }

    // ======== createStrip (horizontal) ========
    async function createStrip(blobs) {
        if (!blobs || blobs.length === 0) {
            const c = document.createElement('canvas'); c.width = 1; c.height = 1;
            return new Promise(r => c.toBlob(r, 'image/png'));
        }
        const images = await Promise.all(blobs.map(b => createImageBitmap(b)));
        const maxW = Math.max(...images.map(i => i.width));
        const maxH = Math.max(...images.map(i => i.height));
        const canvas = document.createElement('canvas');
        canvas.width = maxW * images.length;
        canvas.height = maxH;
        const ctx = canvas.getContext('2d');
        images.forEach((img, i) => {
            const x = i * maxW + Math.floor((maxW - img.width) / 2);
            const y = Math.floor((maxH - img.height) / 2);
            ctx.drawImage(img, x, y);
        });
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    // ======== addPreview (tira individual) ========
    function addPreview(name, blobsArray) {
        const container = document.createElement('div');
        container.className = 'preview-container';

        const title = document.createElement('div');
        title.className = 'preview-title';
        title.textContent = name;
        container.appendChild(title);

        const stripWrapper = document.createElement('div');
        stripWrapper.className = 'preview-strip-wrapper';
        blobsArray.forEach(blob => {
            const img = document.createElement('img');
            const url = URL.createObjectURL(blob);
            state.previewUrls.push(url); // almacenar para revocar luego
            img.src = url;
            stripWrapper.appendChild(img);
        });
        container.appendChild(stripWrapper);

        const label = document.createElement('div');
        label.className = 'preview-label';
        label.textContent = `${blobsArray.length} frame${blobsArray.length > 1 ? 's' : ''}`;
        container.appendChild(label);

        resultPanel.appendChild(container);
        resultPanel.style.display = 'block';
    }

    // ======== addDownloadButton ========
    function addDownloadButton(blob, fileName) {
        const btn = document.createElement('button');
        btn.className = 'download-btn';
        btn.textContent = 'Descargar ZIP';
        btn.addEventListener('click', () => {
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            // revoke local url a los 2s
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
        });
        resultPanel.appendChild(btn);
    }

    // ======== compare blobs by pixels ========
    async function areBlobsEqual(blobA, blobB) {
        const [imgA, imgB] = await Promise.all([createImageBitmap(blobA), createImageBitmap(blobB)]);
        if (imgA.width !== imgB.width || imgA.height !== imgB.height) return false;
        const dataA = await imageBitmapToRGBA(imgA);
        const dataB = await imageBitmapToRGBA(imgB);
        if (dataA.length !== dataB.length) return false;
        // comparación rápida por bloques (int32 view) puede mejorar velocidad:
        const a32 = new Uint32Array(dataA.buffer);
        const b32 = new Uint32Array(dataB.buffer);
        for (let i = 0; i < a32.length; i++) if (a32[i] !== b32[i]) return false;
        return true;
    }

    function imageBitmapToRGBA(imgBitmap) {
        const c = document.createElement('canvas');
        c.width = imgBitmap.width;
        c.height = imgBitmap.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(imgBitmap, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
    }

    // ======== groupFrames helper (for packer output) ========
    function groupFrames(frames) {
        const animGroups = {};
        for (const f of frames) {
            if (!f || !f.name) continue;
            const m = f.name.match(/^(.*?)(\d+)$/);
            if (!m) continue;
            const base = m[1].trim();
            const frameNumber = parseInt(m[2], 10);
            if (!animGroups[base]) animGroups[base] = [];
            animGroups[base].push({ name: f.name, frameNumber, blob: f.blob });
        }
        return animGroups;
    }

    // ======== Inicializar UI ========
    resultPanel.style.display = 'none';
    switchMethod(state.mode);
    updateStatusFromState();

    // revocar URLs al cerrar la página para seguridad
    window.addEventListener('beforeunload', () => {
        revokePreviewUrls();
        revokeLastOutputUrl();
    });
});
