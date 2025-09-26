//me cago en todo...
document.addEventListener('DOMContentLoaded', () => {
    // ======== Botones de método de entrada ========
    const zipMethodBtn = document.getElementById('zip-method-btn');
    const spritesheetMethodBtn = document.getElementById('spritesheet-method-btn');

    const zipPanel = document.getElementById('zip-upload-panel');
    const spritesheetPanel = document.getElementById('spritesheet-upload-panel');

    // ======== Estado global ========
    const generateBtn = document.getElementById('generate-btn');
    const statusText = document.getElementById('status-text');
    const resultPanel = document.getElementById('result-panel');

    const imageInput = document.getElementById('image-input');
    const xmlInput = document.getElementById('xml-input');
    const zipInput = document.getElementById('zip-input');

    let state = { mode: 'zip', imageFile: null, xmlFile: null, zipFile: null };

    const packer = new FunkierPacker();

    // ======== Función de alternar métodos ========
    function switchMethod(to) {
        if (to === 'zip') {
            zipMethodBtn.classList.add('active');
            spritesheetMethodBtn.classList.remove('active');
            zipPanel.style.display = 'block';
            spritesheetPanel.style.display = 'none';
            state.mode = 'zip';
            generateBtn.disabled = !state.zipFile;
            statusText.textContent = state.zipFile ? "ZIP seleccionado: " + state.zipFile.name : "Selecciona un ZIP";
        } else {
            spritesheetMethodBtn.classList.add('active');
            zipMethodBtn.classList.remove('active');
            spritesheetPanel.style.display = 'block';
            zipPanel.style.display = 'none';
            state.mode = 'packer';
            generateBtn.disabled = !(state.imageFile && state.xmlFile);
            if (state.imageFile && state.xmlFile) {
                statusText.textContent = `Listo para generar: ${state.imageFile.name} + ${state.xmlFile.name}`;
            } else {
                statusText.textContent = "Selecciona PNG y XML";
            }
        }
    }

    // ======== Eventos de alternancia ========
    zipMethodBtn.addEventListener('click', () => switchMethod('zip'));
    spritesheetMethodBtn.addEventListener('click', () => switchMethod('packer'));

    // ======== Inputs ========
    imageInput.addEventListener('change', () => {
        if (imageInput.files.length > 0) state.imageFile = imageInput.files[0];
        if (state.mode === 'packer') checkReady();
    });

    xmlInput.addEventListener('change', () => {
        if (xmlInput.files.length > 0) state.xmlFile = xmlInput.files[0];
        if (state.mode === 'packer') checkReady();
    });

    zipInput.addEventListener('change', () => {
        if (zipInput.files.length > 0) {
            state.zipFile = zipInput.files[0];
            if (state.mode === 'zip') {
                generateBtn.disabled = false;
                statusText.textContent = "ZIP seleccionado: " + state.zipFile.name;
            }
        }
    });

    // ======== Chequeo de disponibilidad ========
    function checkReady() {
        if (state.imageFile && state.xmlFile) {
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
        if (state.mode === 'packer') await runPacker();
        else await runZip();
    });

    // ======== Funciones principales ========
    async function runPacker() {
        try {
            statusText.textContent = "Procesando PNG + XML...";
            const frames = await packer.processFiles(state.imageFile, state.xmlFile);
            const animGroups = groupFrames(frames);
            await createTiras(animGroups, state.imageFile.name);
        } catch (err) {
            statusText.textContent = 'Error: ' + err.message;
            console.error(err);
        }
    }

    async function runZip() {
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

            await createTiras(animGroups, state.zipFile.name);
        } catch (err) {
            statusText.textContent = 'Error: ' + err.message;
            console.error(err);
        }
    }

    // ======== Crear tiras y mostrar previews ========
    async function createTiras(animGroups, originalName) {
        const zip = new JSZip();
        const sortedNames = Object.keys(animGroups).sort();

        for (const animName of sortedNames) {
            const framesArr = animGroups[animName];
            framesArr.sort((a, b) => a.frameNumber - b.frameNumber);

            const blobs = await Promise.all(framesArr.map(async f => f.blob ? f.blob : f.entry.async('blob')));
            const stripBlob = await createStrip(blobs);
            zip.file(`${animName}.png`, stripBlob);
            addPreview(animName, blobs);
        }

        const finalBlob = await zip.generateAsync({ type: 'blob' });
        const baseName = originalName.replace(/\.(png|jpg|jpeg|zip)$/i, '');
        addDownloadButton(finalBlob, `TJ-${baseName}.zip`);

        statusText.textContent = "¡Procesamiento completado!";
    }

    async function createStrip(blobs) {
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
            img.src = URL.createObjectURL(blob);
            stripWrapper.appendChild(img);
        });
        container.appendChild(stripWrapper);

        const label = document.createElement('div');
        label.className = 'preview-label';
        label.textContent = `${blobsArray.length} frame${blobsArray.length > 1 ? 's' : ''}`;
        container.appendChild(label);

        resultPanel.appendChild(container);
    }

    function addDownloadButton(blob, fileName) {
        const btn = document.createElement('button');
        btn.className = 'download-btn';
        btn.textContent = "Descargar ZIP";
        btn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
        });
        resultPanel.appendChild(btn);
    }

    function groupFrames(frames) {
        const animGroups = {};
        for (const f of frames) {
            const match = f.name.match(/^(.*?)(\d+)$/);
            if (!match) continue;
            const baseName = match[1].trim();
            const frameNumber = parseInt(match[2]);
            if (!animGroups[baseName]) animGroups[baseName] = [];
            animGroups[baseName].push({ ...f, frameNumber });
        }
        return animGroups;
    }
});
