const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const procesarBtn = document.getElementById('procesar');

let archivosSeleccionados = [];

// Función para limpiar nombres tipo "idle(1)" o "idle (1)"
function limpiarNombre(nombre) {
    let base = nombre.slice(0, nombre.lastIndexOf('.'));
    // Elimina espacios y números entre paréntesis al final
    base = base.replace(/\s*\(\d+\)$/,'');
    return base;
}

// Drag & drop
dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', e => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    archivosSeleccionados = Array.from(e.dataTransfer.files)
        .filter(f => ['image/png','image/jpeg','image/webp'].includes(f.type));
    procesarBtn.disabled = archivosSeleccionados.length === 0;
});

// Click para abrir selector
dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    archivosSeleccionados = Array.from(fileInput.files)
        .filter(f => ['image/png','image/jpeg','image/webp'].includes(f.type));
    procesarBtn.disabled = archivosSeleccionados.length === 0;
});

// Procesar y generar ZIP
procesarBtn.addEventListener('click', async () => {
    if(!archivosSeleccionados.length) return;

    const grupos = {};

    archivosSeleccionados.forEach(file => {
        const base = limpiarNombre(file.name);
        if(!grupos[base]) grupos[base] = [];
        grupos[base].push(file);
    });

    const zip = new JSZip();

    for(const base in grupos){
        grupos[base].sort((a,b) => a.name.localeCompare(b.name));
        grupos[base].forEach((file, i) => {
            const nuevoNombre = `${base}_${String(i).padStart(4,'0')}${file.name.slice(file.name.lastIndexOf('.'))}`;
            zip.file(nuevoNombre, file);
        });
    }

    const blob = await zip.generateAsync({type:"blob"});
    saveAs(blob, `TJ_renombrado.zip`);
    alert('✅ ZIP generado y descargado!');
});
