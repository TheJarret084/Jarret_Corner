// RenownedBySprites.js - versión robusta
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const procesarBtn = document.getElementById('procesar');
const divisionesInput = document.getElementById('divisiones');
const modeSelect = document.getElementById('mode');
const paddingInput = document.getElementById('padding');
const autoPadding = document.getElementById('autoPadding');
const oneZipCheckbox = document.getElementById('oneZip');
const status = document.getElementById('status');
const preview = document.getElementById('preview');
const logs = document.getElementById('logs');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');

let archivosSeleccionados = []; // array de objetos { file: File, originalPath: string }

// ---------- utilidades ----------

// limpia el "base name" de un archivo tratando varios patrones comunes:
function limpiarNombre(nombreArchivo){
  // quitar rutas si las trae
  const nombre = nombreArchivo.split('/').pop();
  const idx = nombre.lastIndexOf('.');
  const sinExt = idx >= 0 ? nombre.slice(0, idx) : nombre;
  // quitar "(1)" al final, o " name 001" o "_001" o "-001"
  return sinExt.replace(/\s*\(\d+\)$/, '')
               .replace(/[_\-\s]\d+$/,'')
               .trim();
}

// extrae extensión (.png)
function extensionDe(nombre){
  const i = nombre.lastIndexOf('.');
  return i>=0 ? nombre.slice(i) : '';
}

// lee ZIP (JSZip) y devuelve array de objetos {file, originalPath}
async function procesarZip(file){
  const zip = await JSZip.loadAsync(file);
  const arr = [];
  for (const path in zip.files){
    const entry = zip.files[path];
    if (entry.dir) continue;
    if (!/\.(png|jpe?g|webp)$/i.test(path)) continue;
    const blob = await entry.async('blob');
    const baseName = path.split('/').pop();
    // creamos File para compatibilidad con folder.file de JSZip más adelante
    const f = new File([blob], baseName, { type: "image/" + baseName.split('.').pop() });
    arr.push({ file: f, originalPath: path });
  }
  return arr;
}

// escribe log sencillo
function addLog(text){
  const time = new Date().toLocaleTimeString();
  logs.innerText = `[${time}] ${text}\n` + logs.innerText;
}

// actualiza estado
function setStatus(txt){ status.innerText = txt; }

// actualiza botón
function actualizarBoton(){
  procesarBtn.disabled = archivosSeleccionados.length === 0;
  setStatus(`${archivosSeleccionados.length} archivos listos`);
}

// ---------- eventos de UI ----------

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

dropzone.addEventListener('drop', async e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  await manejarFilesArray(e.dataTransfer.files);
});

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  await manejarFilesArray(fileInput.files);
});

// manejar array de FileList (arranca vacío si nuevo)
async function manejarFilesArray(list){
  archivosSeleccionados = []; // reset
  addLog('Cargando archivos...');
  for (const f of Array.from(list)){
    try{
      if (f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip")){
        addLog(`Leyendo ZIP: ${f.name}`);
        const extraidos = await procesarZip(f);
        archivosSeleccionados.push(...extraidos);
      } else if (/\.(png|jpe?g|webp)$/i.test(f.name)){
        archivosSeleccionados.push({ file: f, originalPath: f.name });
      } else {
        addLog(`Ignorado (no imagen/zip): ${f.name}`);
      }
    } catch (err){
      addLog(`Error al procesar ${f.name}: ${err.message}`);
    }
  }
  addLog(`Total imágenes detectadas: ${archivosSeleccionados.length}`);
  // limitar por seguridad (opcional)
  if (archivosSeleccionados.length > 10000) addLog('Advertencia: demasiadas imágenes (>10000). Puede tardar o agotar memoria.');
  actualizarBoton();
  renderPreview();
}

// actualiza la previsualización de cómo se dividirá cada grupo
function renderPreview(){
  preview.innerHTML = '';
  if (!archivosSeleccionados.length){
    preview.innerText = 'No hay archivos.';
    return;
  }

  // agrupar por base
  const grupos = {};
  archivosSeleccionados.forEach(obj => {
    const base = limpiarNombre(obj.file.name);
    if (!grupos[base]) grupos[base] = [];
    grupos[base].push(obj.file);
  });

  const mode = modeSelect.value;
  const requested = Math.max(1, parseInt(divisionesInput.value) || 1);

  for (const base of Object.keys(grupos).sort()){
    const arr = grupos[base].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric:true }));
    const total = arr.length;
    let parts;
    if (mode === 'parts'){
      parts = Math.min(requested, total);
    } else {
      // size mode => requested = maxPerPart
      const maxPerPart = Math.max(1, requested);
      parts = Math.ceil(total / maxPerPart);
    }
    const tamañoBase = Math.floor(total / parts);
    let resto = total % parts;

    const node = document.createElement('div');
    node.className = 'group-row';
    const title = document.createElement('b');
    title.innerText = `${base} — ${total} imágenes → ${parts} partes`;
    node.appendChild(title);

    for (let s=0; s<parts; s++){
      const len = tamañoBase + (resto > 0 ? 1 : 0);
      if (resto > 0) resto--;
      const p = document.createElement('div');
      p.innerText = `Sec ${s+1}: ${len} imágenes`;
      node.appendChild(p);
    }
    preview.appendChild(node);
  }
}

// recalcular preview al cambiar opciones
[modeSelect, divisionesInput].forEach(el => el.addEventListener('input', renderPreview));
autoPadding.addEventListener('change', () => {
  paddingInput.disabled = autoPadding.checked;
});

// ---------- procesamiento final y generación ZIP ----------

procesarBtn.addEventListener('click', async () => {
  if (!archivosSeleccionados.length) return;
  try{
    procesarBtn.disabled = true;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    logs.innerText = '';

    // reagrupamos
    const grupos = {};
    archivosSeleccionados.forEach(obj => {
      const base = limpiarNombre(obj.file.name);
      if (!grupos[base]) grupos[base] = [];
      grupos[base].push(obj.file);
    });

    // parámetros
    const mode = modeSelect.value;
    const requested = Math.max(1, parseInt(divisionesInput.value) || 1);
    const autoPad = autoPadding.checked;
    const fixedPad = Math.max(1, parseInt(paddingInput.value) || 4);
    const oneZip = oneZipCheckbox.checked;

    // contar totales para progress
    let totalFiles = 0;
    for (const k in grupos) totalFiles += grupos[k].length;
    let processed = 0;

    const zip = new JSZip(); // principal (si oneZip) o contenedor

    addLog(`Iniciando: ${totalFiles} archivos. Modo=${mode} pet=${requested} autoPad=${autoPad} oneZip=${oneZip}`);

    // para cada grupo
    for (const base of Object.keys(grupos).sort()){
      const arr = grupos[base].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric:true }));
      const total = arr.length;
      let parts;
      if (mode === 'parts') parts = Math.min(requested, total);
      else {
        const maxPer = Math.max(1, requested);
        parts = Math.ceil(total / maxPer);
      }
      const tamañoBase = Math.floor(total / parts);
      let resto = total % parts;

      for (let s=0; s<parts; s++){
        const len = tamañoBase + (resto>0 ? 1 : 0);
        if (resto>0) resto--;
        // elegir padding
        const pad = autoPad ? Math.max(4, String(len).length) : fixedPad;
        const folderName = `${base} Sec${s+1}`;

        // determinar carpeta destino (si oneZip -> carpeta dentro del zip; si no -> crear zip por base)
        let targetZip = zip;
        let innerFolder = targetZip.folder(folderName);
        // si no oneZip, en su lugar creamos un zip temporal por base y lo convertimos más abajo
        if (!oneZip){
          // carpeta temporal en zip con el nombre del zip final (contenedor)
          // Para simplicidad, aún usamos la misma estructura: vamos a crear *un* zip y dentro de él una carpeta por base,
          // luego comprimiremos el zip principal: esto evita múltiples blobs simultáneos.
          innerFolder = zip.folder(`${base}/${folderName}`);
        }

        for (let j=0; j<len; j++){
          const file = arr.shift(); // extrae el primero
          const ext = extensionDe(file.name);
          const newName = `${base}_${String(j+1).padStart(pad,'0')}${ext}`;
          innerFolder.file(newName, file);
          processed++;
          // actualizar progreso
          const pct = Math.round((processed/totalFiles)*100);
          progressBar.style.width = `${pct}%`;
          setStatus(`Procesando ${processed} / ${totalFiles} (${pct}%)`);
        }
      }
      addLog(`Grupo "${base}" procesado.`);
    }

    // generar blob
    addLog('Generando ZIP (puede tardar según la cantidad)...');
    const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      // meta.percent disponible, actualizar progreso fino al 99% si lo deseamos
      if (meta && meta.percent){
        progressBar.style.width = `${Math.min(99, Math.round(meta.percent))}%`;
      }
    });

    // finalizar progreso
    progressBar.style.width = '100%';
    setStatus('Completado — descargando ZIP');
    saveAs(blob, 'TJ_renombrado_dividido.zip');
    addLog('ZIP descargado.');

  } catch (err){
    console.error(err);
    addLog('ERROR: ' + (err && err.message ? err.message : err));
    alert('Ocurrió un error: ' + (err && err.message ? err.message : err));
  } finally {
    procesarBtn.disabled = false;
    // ocultar progress after short delay
    setTimeout(()=> { progressWrap.hidden = true; progressBar.style.width='0%'; }, 1200);
  }
});