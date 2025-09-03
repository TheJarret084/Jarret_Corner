document.addEventListener('DOMContentLoaded', () => {
    // ======== Elementos del DOM ========
    const imageBtn = document.getElementById('image-btn');
    const xmlBtn = document.getElementById('xml-btn');
    const generateBtn = document.getElementById('generate-btn');
    const statusText = document.getElementById('status-text');
    const resultPanel = document.getElementById('result-panel');

    const imageInput = document.getElementById('image-input');
    const xmlInput = document.getElementById('xml-input');

    // ======== Estado ========
    let state = {
        imageFile: null,
        xmlFile: null,
        lastSpritesheet: null,
        lastZip: null
    };

    // ======== Instancia del procesador ========
    const processor = new FunkierPacker();

    // ======== Funciones para abrir explorador ========
    imageBtn.addEventListener('click', () => imageInput.click());
    xmlBtn.addEventListener('click', () => xmlInput.click());

    imageInput.addEventListener('change', () => {
        if(imageInput.files.length > 0) {
            state.imageFile = imageInput.files[0];
            statusText.textContent = "Imagen seleccionada: " + state.imageFile.name;
            checkReady();
        }
    });

    xmlInput.addEventListener('change', () => {
        if(xmlInput.files.length > 0) {
            state.xmlFile = xmlInput.files[0];
            statusText.textContent = "XML seleccionado: " + state.xmlFile.name;
            checkReady();
        }
    });

    function checkReady() {
        generateBtn.disabled = !(state.imageFile && state.xmlFile);
    }

    // ======== Generar Spritesheet ========
    generateBtn.addEventListener('click', async () => {
        if(!state.imageFile || !state.xmlFile) return;
        statusText.textContent = "Procesando...";
        resultPanel.innerHTML = '';
        resultPanel.style.display = 'flex';

        try {
            // Procesa los archivos y obtiene frames
            const frames = await processor.processFiles(
                state.imageFile,
                state.xmlFile,
                { removeDuplicates: false }, // puedes agregar un checkbox si quieres
                progress => { statusText.textContent = `Procesando: ${Math.round(progress*100)}%`; }
            );

            // Mostrar previews
            frames.forEach(f => {
                const div = document.createElement('div');
                div.className = 'frame-preview';

                const img = document.createElement('img');
                img.src = URL.createObjectURL(f.blob);
                div.appendChild(img);

                const label = document.createElement('div');
                label.textContent = f.name;
                div.appendChild(label);

                resultPanel.appendChild(div);
            });

            // Spritesheet
            state.lastSpritesheet = await processor.generateSpritesheet();
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = "Descargar Spritesheet";
            downloadBtn.style.marginTop = '10px';
            downloadBtn.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(state.lastSpritesheet.blob);
                a.download = state.lastSpritesheet.fileName;
                a.click();
            });
            resultPanel.appendChild(downloadBtn);

            // ZIP
            state.lastZip = await processor.generateZip();
            const zipBtn = document.createElement('button');
            zipBtn.textContent = "Descargar ZIP de Frames";
            zipBtn.style.marginTop = '10px';
            zipBtn.style.marginLeft = '10px';
            zipBtn.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(state.lastZip.blob);
                a.download = state.lastZip.fileName;
                a.click();
            });
            resultPanel.appendChild(zipBtn);

            statusText.textContent = "¡Procesamiento completado!";
        } catch(err) {
            statusText.textContent = 'Error: ' + err.message;
            console.error(err);
        }
    });
});
