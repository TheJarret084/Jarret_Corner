const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const procesarBtn = document.getElementById('procesar');

let archivosSeleccionados = [];

// 🔧 Limpia nombres tipo "idle (1).png" -> "idle"
function limpiarNombre(nombre) {
    let base = nombre.slice(0, nombre.lastIndexOf('.'));
    return base.replace(/\s*\(\d+\)$/, '');
}

// 📦 Leer ZIP y extraer imágenes válidas
async function procesarZip(file) {
    const zip = await JSZip.loadAsync(file);
    const archivos = [];

    for (const nombre in zip.files) {
        const entry = zip.files[nombre];
        if (!entry.dir && /\.(png|jpe?g|webp)$/i.test(nombre)) {
            const blob = await entry.async('blob');
            archivos.push(new File([blob], nombre, {
                type: "image/" + nombre.split('.').pop()
            }));
        }
    }
    return archivos;
}

// 🔄 Habilita/deshabilita botón
function actualizarBoton() {
    procesarBtn.disabled = archivosSeleccionados.length === 0;
}

// 🖱 Drag & Drop
dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', async e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    archivosSeleccionados = [];

    for (const file of e.dataTransfer.files) {
        if (file.type === "application/zip" || file.name.endsWith(".zip")) {
            const extraidos = await procesarZip(file);
            archivosSeleccionados.push(...extraidos);
        } else if (['image/png','image/jpeg','image/webp'].includes(file.type)) {
            archivosSeleccionados.push(file);
        }
    }
    actualizarBoton();
});

// 📂 Click para abrir selector
dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
    archivosSeleccionados = [];

    for (const file of Array.from(fileInput.files)) {
        if (file.type === "application/zip" || file.name.endsWith(".zip")) {
            const extraidos = await procesarZip(file);
            archivosSeleccionados.push(...extraidos);
        } else if (['image/png','image/jpeg','image/webp'].includes(file.type)) {
            archivosSeleccionados.push(file);
        }
    }
    actualizarBoton();
});

// ▶️ Procesar y generar ZIP
procesarBtn.addEventListener('click', async () => {
    if (!archivosSeleccionados.length) return;

    const grupos = {};
    archivosSeleccionados.forEach(file => {
        const base = limpiarNombre(file.name);
        if (!grupos[base]) grupos[base] = [];
        grupos[base].push(file);
    });

    const zip = new JSZip();

    for (const base in grupos) {
        grupos[base].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        grupos[base].forEach((file, i) => {
            const ext = file.name.slice(file.name.lastIndexOf('.'));
            const nuevoNombre = `${base}_${String(i+1).padStart(4, '0')}${ext}`;
            zip.file(nuevoNombre, file);
        });
    }

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `TJ_renombrado.zip`);
    alert('✅ ZIP generado y descargado!');
});
