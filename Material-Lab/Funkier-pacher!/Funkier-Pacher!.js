// Funkier-Pacher!.js
// Consolidado: navbar, UI, FunkierPacker, ZIP/PNG+XML processing, previews y descarga.

// -------------------- Navbar dinámico --------------------
window.jsonFile = '../../Corner.json';
let dataGlobal = null;

function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar || !dataGlobal) return;

    let html = '';
    html += `<a href="../../index.html" class="nav-link">
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

async function cargarData() {
    try {
        const resp = await fetch(window.jsonFile, { cache: 'no-cache' });
        dataGlobal = await resp.json();
        renderizarNav();
    } catch (e) {
        console.warn("No se pudo cargar JSON de navbar:", e);
    }
}

// -------------------- FunkierPacker (rotated support) --------------------
class FunkierPacker {
    constructor() {
        this.frames = [];
    }

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

            let name = f.name;
            if (name && name.toLowerCase().endsWith('.png')) name = name.slice(0, -4);

            this.frames.push({ name, blob });
            onProgress((i+1)/total);
        }

        return this.frames;
    }

    async generateZip() {
        if (this.frames.length === 0) throw new Error("No hay frames procesados");
        const zip = new JSZip();
        this.frames.forEach(f => zip.file(f.name + '.png', f.blob));
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        return { blob, fileName: 'frames.zip' };
    }

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
        const srcW = frame.width;
        const srcH = frame.height;

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcW;
        srcCanvas.height = srcH;
        const sctx = srcCanvas.getContext('2d');
        sctx.drawImage(img, frame.x, frame.y, srcW, srcH, 0, 0, srcW, srcH);

        const finalW = frame.frameWidth;
        const finalH = frame.frameHeight;
        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d');

        const offsetX = frame.frameX;
        const offsetY = frame.frameY;

        if (!frame.rotated) {
            ctx.drawImage(srcCanvas, -offsetX, -offsetY);
            return canvas;
        }

        const rotatedCanvas = document.createElement('canvas');
        rotatedCanvas.width = srcH;
        rotatedCanvas.height = srcW;
        const rctx = rotatedCanvas.getContext('2d');
        rctx.translate(0, srcW);
        rctx.rotate(-Math.PI / 2);
        rctx.drawImage(srcCanvas, 0, 0);

        ctx.drawImage(rotatedCanvas, -offsetX, -offsetY);
        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
}

// -------------------- Helpers comunes --------------------
function getImageDataFromBitmap(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function areImagesEqual(img1, img2) {
    if (img1.width !== img2.width || img1.height !== img2.height) return false;
    const [data1, data2] = await Promise.all([getImageDataFromBitmap(img1), getImageDataFromBitmap(img2)]);
    for (let i = 0; i < data1.length; i += 4) {
        if (data1[i] !== data2[i] || data1[i+1] !== data2[i+1] || data1[i+2] !== data2[i+2] || data1[i+3] !== data2[i+3]) {
            return false;
        }
    }
    return true;
}

async function createStrip(blobs) {
    if (!blobs || blobs.length === 0) {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return new Promise(res => c.toBlob(res, 'image/png'));
    }
    const images = await Promise.all(blobs.map(b => createImageBitmap(b)));
    const maxWidth = Math.max(...images.map(img => img.width));
    const maxHeight = Math.max(...images.map(img => img.height));
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth * images.length;
    canvas.height = maxHeight;
    const ctx = canvas.getContext('2d');

    images.forEach((img, i) => {
        const x = i * maxWidth + (maxWidth - img.width) / 2;
        const y = (maxHeight - img.height) / 2;
        ctx.drawImage(img, x, y);
    });

    return new Promise(resolve => canvas.toBlob(resolve));
}

async function createGif(images) {
    // Placeholder simple (si quieres luego puedo integrar gif.js)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const { width, height } = images[0];
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(images[0], 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function makeLabeledBlob(imageBitmap, label, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, canvas.height - 24, canvas.width, 24);
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, canvas.width / 2, canvas.height - 8);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// -------------------- UI & Lógica (único DOMContentLoaded) --------------------
document.addEventListener('DOMContentLoaded', () => {
    cargarData();

    // DOM references
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
    const outputGifCheckbox = document.getElementById('output-gif'); // puede ser null si no está en HTML

    const resultContent = document.querySelector('#result-panel .result-content') || document.getElementById('result-panel');

    // state
    const state = { mode: 'zip', zipFile: null, imageFile: null, xmlFile: null };

    const packer = new FunkierPacker();

    // Inicial UI: mostrar ZIP por defecto
    zipPanel.style.display = 'block';
    pngxmlPanel.style.display = 'none';
    methodZipBtn?.classList.add('active');
    methodPngXmlBtn?.classList.remove('active');

    // --- Alternar métodos ---
    methodZipBtn?.addEventListener('click', () => {
        state.mode = 'zip';
        zipPanel.style.display = 'block';
        pngxmlPanel.style.display = 'none';
        methodZipBtn.classList.add('active');
        methodPngXmlBtn.classList.remove('active');
        checkReady();
    });

    methodPngXmlBtn?.addEventListener('click', () => {
        state.mode = 'packer';
        zipPanel.style.display = 'none';
        pngxmlPanel.style.display = 'block';
        methodZipBtn.classList.remove('active');
        methodPngXmlBtn.classList.add('active');
        checkReady();
    });

    // --- File buttons open native picker ---
    zipBtn?.addEventListener('click', () => zipInput.click());
    imageBtn?.addEventListener('click', () => imageInput.click());
    xmlBtn?.addEventListener('click', () => xmlInput.click());

    // --- Drag & drop support helpers ---
    function makeDropZoneHandlers(dropEl, onFile) {
        if (!dropEl) return;
        dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('dragover'); });
        dropEl.addEventListener('dragleave', () => { dropEl.classList.remove('dragover'); });
        dropEl.addEventListener('drop', (e) => {
            e.preventDefault();
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

    // small helper to set input.files (FileList is read-only so we create DataTransfer)
    function createFileListFromFile(file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        return dt.files;
    }

    // --- Inputs change ---
    zipInput?.addEventListener('change', () => {
        if (zipInput.files.length > 0) {
            state.zipFile = zipInput.files[0];
            statusTextZip.textContent = `ZIP seleccionado: ${state.zipFile.name}`;
            generateBtnZip.disabled = false;
        } else {
            state.zipFile = null;
            generateBtnZip.disabled = true;
            statusTextZip.textContent = `Selecciona un archivo ZIP para continuar.`;
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
                statusTextPngXml.textContent = `Listo para generar: ${state.imageFile.name} + ${state.xmlFile.name}`;
            } else {
                generateBtnPngXml.disabled = true;
                if (state.imageFile && !state.xmlFile) statusTextPngXml.textContent = "Falta el XML";
                else if (state.xmlFile && !state.imageFile) statusTextPngXml.textContent = "Falta la imagen";
                else statusTextPngXml.textContent = "Selecciona PNG y XML para continuar.";
            }
            // disable zip generate while packer selected
            generateBtnZip.disabled = true;
        } else {
            // mode zip
            generateBtnZip.disabled = !state.zipFile;
            if (!state.zipFile) statusTextZip.textContent = "Selecciona un archivo ZIP para continuar.";
            // disable pngxml generate while zip selected
            generateBtnPngXml.disabled = true;
        }
    }

    // --- Events generate ---
    generateBtnZip?.addEventListener('click', async () => {
        // clear previous results
        clearResults();
        await runZip(!!removeDuplicatesCheckbox?.checked, !!outputGifCheckbox?.checked);
    });

    generateBtnPngXml?.addEventListener('click', async () => {
        clearResults();
        await runPacker(!!removeDuplicatesCheckbox?.checked);
    });

    function clearResults() {
        if (resultContent) resultContent.innerHTML = '';
    }

    // -------------------- Run handlers --------------------
    async function runPacker(removeDuplicates = false) {
        try {
            statusTextPngXml.textContent = "Procesando PNG + XML...";
            if (!state.imageFile || !state.xmlFile) {
                statusTextPngXml.textContent = "Faltan archivos (PNG o XML).";
                return;
            }
            const frames = await packer.processFiles(state.imageFile, state.xmlFile);
            const animGroups = groupFrames(frames);
            await createTiras(animGroups, state.imageFile.name, removeDuplicates, false);
        } catch (err) {
            statusTextPngXml.textContent = 'Error: ' + (err && err.message ? err.message : err);
            console.error(err);
        }
    }

    async function runZip(removeDuplicates = false, outputGif = false) {
        try {
            statusTextZip.textContent = "Procesando ZIP de frames...";
            if (!state.zipFile) {
                statusTextZip.textContent = "Falta el ZIP.";
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
                    // no numbering -> group by full name
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
            statusTextZip.textContent = 'Error: ' + (err && err.message ? err.message : err);
            console.error(err);
        }
    }

    // -------------------- Crear tiras y mostrar previews --------------------
    async function createTiras(animGroups, originalName, removeDuplicates = false, outputGif = false) {
        const zip = new JSZip();
        const sortedNames = Object.keys(animGroups).sort();

        let total = sortedNames.length;
        let processed = 0;

        for (const animName of sortedNames) {
            if (!animGroups[animName] || animGroups[animName].length === 0) {
                processed++;
                continue;
            }
            const progressText = `Procesando: ${animName} (${processed+1}/${total})`;
            if (state.mode === 'zip') statusTextZip.textContent = progressText;
            else statusTextPngXml.textContent = progressText;

            let framesArr = animGroups[animName];
            framesArr.sort((a, b) => (a.frameNumber || 0) - (b.frameNumber || 0));

            let blobs = await Promise.all(framesArr.map(async f => {
                if (f.blob) return f.blob;
                return await f.entry.async('blob');
            }));

            if (removeDuplicates && blobs.length > 1) {
                const uniqueBlobs = [blobs[0]];
                for (let i = 1; i < blobs.length; i++) {
                    const curBmp = await createImageBitmap(blobs[i]);
                    const prevBmp = await createImageBitmap(uniqueBlobs[uniqueBlobs.length - 1]);
                    const equal = await areImagesEqual(curBmp, prevBmp);
                    if (!equal) uniqueBlobs.push(blobs[i]);
                }
                blobs = uniqueBlobs;
            }

            if (outputGif && blobs.length > 1) {
                try {
                    const bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
                    const gifBlob = await createGif(bitmaps);
                    zip.file(`${animName}.gif`, gifBlob);
                    const previewBlob = await makeLabeledBlob(bitmaps[0], `${animName} (GIF)`, bitmaps[0].width, bitmaps[0].height);
                    addPreview(`${animName} (GIF)`, [previewBlob]);
                } catch (e) {
                    const strip = await createStrip(blobs);
                    zip.file(`${animName}.png`, strip);
                    addPreview(animName, blobs);
                }
            } else {
                const stripBlob = await createStrip(blobs);
                zip.file(`${animName}.png`, stripBlob);
                addPreview(animName, blobs);
            }

            processed++;
        }

        const finalBlob = await zip.generateAsync({ type: 'blob' });
        const baseName = originalName.replace(/\.(png|jpg|jpeg|zip)$/i, '');
        const finalName = `TJ-${baseName}.zip`;
        addDownloadButton(finalBlob, finalName);

        if (state.mode === 'zip') statusTextZip.textContent = "¡Procesamiento completado!";
        else statusTextPngXml.textContent = "¡Procesamiento completado!";
    }

    function addPreview(name, blobsArray) {
        if (!resultContent) return;
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
            img.src = URL.createObjectURL(blob);
            stripWrapper.appendChild(img);
        });
        container.appendChild(stripWrapper);

        const label = document.createElement('div');
        label.className = 'preview-label';
        label.textContent = `${blobsArray.length} frame${blobsArray.length > 1 ? 's' : ''}`;
        container.appendChild(label);

        resultContent.appendChild(container);
    }

    function addDownloadButton(blob, fileName) {
        if (!resultContent) return;
        const btn = document.createElement('button');
        btn.className = 'download-btn';
        btn.textContent = "Descargar ZIP";
        btn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
        resultContent.appendChild(btn);
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

    // inicial check
    checkReady();
});

// -------------------- Fin del archivo --------------------

// Good Morning Abelito V2 :D