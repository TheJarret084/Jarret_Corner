// Navbar dinámica

// Renderizar Navbar
function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar || !dataGlobal) return;

    let html = '';

    // Botón para volver al menú principal
    html += `<a href="../../index.html" class="nav-link">
                <i class="fa fa-home"></i> Menú Principal
            </a>`;

    // Dropdown del JSON
    dataGlobal.data.nav.forEach(item => {
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

// ...existing code...

window.jsonFile = 'FP!.json';

async function cargarData() {
    try {
        const resp = await fetch(window.jsonFile, { cache: 'no-cache' });
        dataGlobal = await resp.json();
        renderizarNav();
    } catch(e) {
        console.error("Error cargando JSON de navbar:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarData();

    // ...resto de tu código...
});

// Proceso de selección de método (ZIP vs PNG+XML)
document.addEventListener('DOMContentLoaded', () => {
    // ZIP
    const zipBtn = document.getElementById('zip-btn');
    const zipInput = document.getElementById('zip-input');
    const generateBtnZip = document.getElementById('generate-btn-zip');
    const statusTextZip = document.getElementById('status-text-zip');

    let zipFile = null;

    zipBtn.addEventListener('click', () => zipInput.click());
    zipInput.addEventListener('change', () => {
        if (zipInput.files.length > 0) {
            zipFile = zipInput.files[0];
            generateBtnZip.disabled = false;
            statusTextZip.textContent = "ZIP seleccionado: " + zipFile.name;
        }
    });

    // PNG + XML
    const imageBtn = document.getElementById('image-btn');
    const imageInput = document.getElementById('image-input');
    const xmlBtn = document.getElementById('xml-btn');
    const xmlInput = document.getElementById('xml-input');
    const generateBtnPngXml = document.getElementById('generate-btn-pngxml');
    const statusTextPngXml = document.getElementById('status-text-pngxml');

    let imageFile = null;
    let xmlFile = null;

    imageBtn.addEventListener('click', () => imageInput.click());
    xmlBtn.addEventListener('click', () => xmlInput.click());

    imageInput.addEventListener('change', () => {
        if (imageInput.files.length > 0) {
            imageFile = imageInput.files[0];
            checkReadyPngXml();
        }
    });

    xmlInput.addEventListener('change', () => {
        if (xmlInput.files.length > 0) {
            xmlFile = xmlInput.files[0];
            checkReadyPngXml();
        }
    });

    function checkReadyPngXml() {
        if (imageFile && xmlFile) {
            generateBtnPngXml.disabled = false;
            statusTextPngXml.textContent = `Listo para generar: ${imageFile.name} + ${xmlFile.name}`;
        } else {
            generateBtnPngXml.disabled = true;
            if (imageFile && !xmlFile) statusTextPngXml.textContent = "Falta el XML";
            if (xmlFile && !imageFile) statusTextPngXml.textContent = "Falta la imagen";
        }
    }

    // Aquí debes agregar la lógica de procesamiento cuando se haga click en los botones de generar
    // Ejemplo:
    generateBtnZip.addEventListener('click', () => {
        // Procesa el ZIP
        statusTextZip.textContent = "Procesando ZIP...";
        // Tu lógica aquí...
    });

    generateBtnPngXml.addEventListener('click', () => {
        // Procesa PNG + XML
        statusTextPngXml.textContent = "Procesando PNG + XML...";
        // Tu lógica aquí...
    });
});

// FunkierPacher + UI + procesamiento ZIP y PNG+XML Contiene: FunkierPacker (rotated support) + UI para seleccionar archivos + quitar frames duplicados + creación de ZIP final

/* =========================
   FunkierPacker_rotated.js
   ========================= */
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
            onProgress((i+1)/total);
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FunkierPacker;
} else {
    window.FunkierPacker = FunkierPacker;
}

/* =========================
   UI + lógica de procesamiento
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
    const imageBtn = document.getElementById('image-btn');
    const xmlBtn = document.getElementById('xml-btn');
    const zipBtn = document.getElementById('zip-btn');
    const generateBtn = document.getElementById('generate-btn');
    const statusText = document.getElementById('status-text');
    const resultPanel = document.getElementById('result-panel');

    const imageInput = document.getElementById('image-input');
    const xmlInput = document.getElementById('xml-input');
    const zipInput = document.getElementById('zip-input');

    const removeDuplicatesCheckbox = document.getElementById('remove-duplicates');
    const outputGifCheckbox = document.getElementById('output-gif');

    let state = { mode: 'packer', imageFile: null, xmlFile: null, zipFile: null };

    const packer = new FunkierPacker();

    // ======== Botones ========
    imageBtn.addEventListener('click', () => imageInput.click());
    xmlBtn.addEventListener('click', () => xmlInput.click());
    zipBtn?.addEventListener('click', () => zipInput.click());

    // ======== Inputs ========
    imageInput.addEventListener('change', () => {
        if (imageInput.files.length > 0) {
            state.imageFile = imageInput.files[0];
            checkReady();
        }
    });

    xmlInput.addEventListener('change', () => {
        if (xmlInput.files.length > 0) {
            state.xmlFile = xmlInput.files[0];
            checkReady();
        }
    });

    zipInput?.addEventListener('change', () => {
        if (zipInput.files.length > 0) {
            state.mode = 'zip';
            state.zipFile = zipInput.files[0];
            generateBtn.disabled = false;
            statusText.textContent = "ZIP seleccionado: " + state.zipFile.name;
        }
    });

    // ======== Chequeo de disponibilidad ========
    function checkReady() {
        if (state.imageFile && state.xmlFile) {
            state.mode = 'packer';
            generateBtn.disabled = false;
            statusText.textContent = `Listo para generar: ${state.imageFile.name} + ${state.xmlFile.name}`;
        } else {
            generateBtn.disabled = true;
            if (state.imageFile && !state.xmlFile) statusText.textContent = "Falta el XML";
            if (state.xmlFile && !state.imageFile) statusText.textContent = "Falta la imagen";
        }
    }

    // ======== Generar ========
    generateBtn.addEventListener('click', async () => {
        resultPanel.innerHTML = '';
        // leer opción de quitar duplicados
        const removeDuplicates = !!removeDuplicatesCheckbox?.checked;
        const outputGif = !!outputGifCheckbox?.checked;

        if (state.mode === 'packer') await runPacker(removeDuplicates);
        else await runZip(removeDuplicates, outputGif);
    });

    // ======== Funciones principales ========
    async function runPacker(removeDuplicates = false) {
        try {
            statusText.textContent = "Procesando PNG + XML...";
            const frames = await packer.processFiles(state.imageFile, state.xmlFile);
            const animGroups = groupFrames(frames);
            await createTiras(animGroups, state.imageFile.name, removeDuplicates, false);
        } catch (err) {
            statusText.textContent = 'Error: ' + (err && err.message ? err.message : err);
            console.error(err);
        }
    }

    async function runZip(removeDuplicates = false, outputGif = false) {
        try {
            statusText.textContent = "Procesando ZIP de frames...";
            const zip = await JSZip.loadAsync(state.zipFile);
            const framesList = [];

            for (const [filename, entry] of Object.entries(zip.files)) {
                if (!filename.toLowerCase().endsWith('.png')) continue;
                framesList.push({ name: filename.slice(0, -4), entry });
            }

            const animGroups = {};
            for (const f of framesList) {
                const match = f.name.match(/^(.*?)(\d+)$/);
                if (!match) continue;
                const baseName = match[1].trim();
                const frameNumber = parseInt(match[2]);
                if (!animGroups[baseName]) animGroups[baseName] = [];
                animGroups[baseName].push({ name: f.name, frameNumber, entry: f.entry });
            }

            await createTiras(animGroups, state.zipFile.name, removeDuplicates, outputGif);
        } catch (err) {
            statusText.textContent = 'Error: ' + (err && err.message ? err.message : err);
            console.error(err);
        }
    }

    // ======== Crear tiras y mostrar previews ========
    async function createTiras(animGroups, originalName, removeDuplicates = false, outputGif = false) {
        const zip = new JSZip();
        const sortedNames = Object.keys(animGroups).sort();

        let total = sortedNames.length;
        let processed = 0;

        for (const animName of sortedNames) {
            statusText.textContent = `Procesando: ${animName} (${processed+1}/${total})`;
            let framesArr = animGroups[animName];
            // si vienen desde packer, framesArr items tienen .name and .blob (no frameNumber)
            // si vienen de zip, tienen entry+frameNumber
            framesArr.sort((a, b) => (a.frameNumber || 0) - (b.frameNumber || 0));

            // Convertir a blobs (si ya tienen blob, usarlo)
            let blobs = await Promise.all(framesArr.map(async f => {
                if (f.blob) return f.blob;
                return await f.entry.async('blob');
            }));

            // Quitar frames duplicados si se pidió
            if (removeDuplicates && blobs.length > 1) {
                const uniqueBlobs = [blobs[0]];
                for (let i = 1; i < blobs.length; i++) {
                    const curBmp = await createImageBitmap(blobs[i]);
                    const prevBmp = await createImageBitmap(uniqueBlobs[uniqueBlobs.length - 1]);
                    const equal = await areImagesEqual(curBmp, prevBmp);
                    // liberar bitmaps si el navegador los admite
                    if (!equal) uniqueBlobs.push(blobs[i]);
                }
                blobs = uniqueBlobs;
            }

            // Si se pidió GIF y hay más de 1 frame, crear GIF (placeholder simple)
            if (outputGif && blobs.length > 1) {
                try {
                    const bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
                    const gifBlob = await createGif(bitmaps);
                    zip.file(`${animName}.gif`, gifBlob);
                    // preview como imagen fija con etiqueta GIF
                    const previewBlob = await makeLabeledBlob(bitmaps[0], `${animName} (GIF)`, bitmaps[0].width, bitmaps[0].height);
                    const previewUrl = URL.createObjectURL(previewBlob);
                    addPreview(animName + ' (GIF)', [previewBlob]);
                } catch (e) {
                    // si falla la creación de GIF, hacemos spritesheet en su lugar
                    const strip = await createStrip(blobs);
                    zip.file(`${animName}.png`, strip);
                    addPreview(animName, blobs);
                }
            } else {
                // Crear tira (spritesheet)
                const stripBlob = await createStrip(blobs);
                zip.file(`${animName}.png`, stripBlob);
                addPreview(animName, blobs);
            }

            processed++;
        }

        // Botón de descarga
        const finalBlob = await zip.generateAsync({ type: 'blob' });
        const baseName = originalName.replace(/\.(png|jpg|jpeg|zip)$/i, '');
        const finalName = `TJ-${baseName}.zip`;
        addDownloadButton(finalBlob, finalName);

        statusText.textContent = "¡Procesamiento completado!";
    }

    // ======== Crear tira desde blobs (centra cada frame en celda) ========
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

    // ======== Mostrar previews por animación ========
    function addPreview(name, blobsArray) {
        const container = document.createElement('div');
        container.className = 'preview-container';

        // Nombre de la animación
        const title = document.createElement('div');
        title.className = 'preview-title';
        title.textContent = name;
        container.appendChild(title);

        // Contenedor horizontal de frames
        const stripWrapper = document.createElement('div');
        stripWrapper.className = 'preview-strip-wrapper';
        blobsArray.forEach(blob => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            stripWrapper.appendChild(img);
        });
        container.appendChild(stripWrapper);

        // Número de frames
        const label = document.createElement('div');
        label.className = 'preview-label';
        label.textContent = `${blobsArray.length} frame${blobsArray.length > 1 ? 's' : ''}`;
        container.appendChild(label);

        resultPanel.appendChild(container);
    }

    // ======== Botón de descarga ========
    function addDownloadButton(blob, fileName) {
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
        resultPanel.appendChild(btn);
    }

    // ======== Agrupar frames por animación (para packer output) ========
    function groupFrames(frames) {
        const animGroups = {};
        for (const f of frames) {
            // f.name puede venir sin número (single) o con número (walk0001)
            const match = f.name.match(/^(.*?)(\d+)$/);
            if (!match) {
                // si no tiene número, usar todo el nombre como base y poner 0
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

    // ======== Comparar imágenes para duplicados ========
    async function areImagesEqual(img1, img2) {
        // img1, img2: ImageBitmap or HTMLImageElement
        if (img1.width !== img2.width || img1.height !== img2.height) return false;
        const [data1, data2] = await Promise.all([getImageData(img1), getImageData(img2)]);
        for (let i = 0; i < data1.length; i += 4) {
            if (data1[i] !== data2[i] || data1[i+1] !== data2[i+1] || data1[i+2] !== data2[i+2] || data1[i+3] !== data2[i+3]) {
                return false;
            }
        }
        return true;
    }

    function getImageData(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }

    // ======== GIF creation (simplified placeholder) ========
    async function createGif(images) {
        // images: array of ImageBitmap
        // Esto es un placeholder simple: creamos un PNG del primer frame y lo devolvemos como "gif"
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
        ctx.fillText(label, canvas.width/2, canvas.height - 8);
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    // Fin DOMContentLoaded
});

// Good morning abelito V2 :D