// RenownedBySprites.js - versión robusta (soporta "(1)" y "_0000" y renombra empezando en 0000)
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

// obtiene el nombre sin extensión
function nombreSinExt(nombreArchivo){
  const nombre = nombreArchivo.split('/').pop();
  return nombre.replace(/\.[^.]+$/, '');
}

// limpia el "base name" dejando solo la raíz (quita sufijos numéricos o (n) para agrupar)
// NOTA: no elimina por completo la info numérica de los archivos; sólo devuelve la base para agrupar.
function limpiarNombre(nombreArchivo){
  const sinExt = nombreSinExt(nombreArchivo);
  // quitar "(1)" al final, o " name 001" o "_001" o "-001"
  // pero si el nombre tiene un número intermedio (p.ej. "hero_walk_0001_loop") podríamos cortar solo al final
  return sinExt.replace(/\s*\(\d+\)$/, '')   // quita " (1)" al final
               .replace(/[_\-\s]\d+$/, '')   // quita "_0001", "-001", " 001" al final
               .trim();
}

// extrae extensión (.png)
function extensionDe(nombre){
  const i = nombre.lastIndexOf('.');
  return i>=0 ? nombre.slice(i) : '';
}

// intenta extraer un número de la parte final del nombre (antes de la extensión)
// soporta: "name (12).png", "name_0004.png", "name-12.png", "name12.png"
// si no hay número devuelve null
function numeroDeArchivo(nombreArchivo){
  const sinExt = nombreSinExt(nombreArchivo);
  // intenta primeramente (123)
  let m = sinExt.match(/\((\d+)\)\s*$/);
  if (m) return parseInt(m[1], 10);
  // intenta sufijo con separador _- espacio
  m = sinExt.match(/[_\-\s](\d+)\s*$/);
  if (m) return parseInt(m[1], 10);
  // intenta sufijo directo sin separador (poco común)
  m = sinExt.match(/(\d+)\s*$/);
  if (m) return parseInt(m[1], 10);
  return null;
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
    // ordenamos por el número extraído (si existe), si no existe por nombre
    const arr = grupos[base].slice().sort((a,b) => {
      const na = numeroDeArchivo(a.name);
      const nb = numeroDeArchivo(b.name);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric:true });
    });

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

    // calcular rangos de entrada por parte (usando los números detectados si están)
    let idx = 0;
    for (let s=0; s<parts; s++){
      const len = tamañoBase + (resto > 0 ? 1 : 0);
      if (resto > 0) resto--;
      // rango de entrada:
      let entradaMin = null, entradaMax = null;
      if (len > 0){
        // extrae número en la primera y última del slice (seguridad)
        const slice = arr.slice(idx, idx + len);
        const nums = slice.map(f => numeroDeArchivo(f.name)).filter(n => n !== null);
        if (nums.length){
          entradaMin = Math.min(...nums);
          entradaMax = Math.max(...nums);
        } else {
          entradaMin = idx;
          entradaMax = idx + len - 1;
        }
      }
      const salidaMin = 0;
      const salidaMax = Math.max(0, len - 1);

      const p = document.createElement('div');
      p.innerText = `Sec ${s+1}: ${len} imágenes — entrada: ${entradaMin !== null ? entradaMin : 'n/a'}..${entradaMax !== null ? entradaMax : 'n/a'} → salida: ${String(salidaMin).padStart(4,'0')}..${String(salidaMax).padStart(4,'0')}`;
      node.appendChild(p);
      idx += len;
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
      // ordenamos por número detectado (si existe) para respetar la numeración de entrada
      const arrRaw = grupos[base].slice();
      const arr = arrRaw.sort((a,b) => {
        const na = numeroDeArchivo(a.name);
        const nb = numeroDeArchivo(b.name);
        if (na !== null && nb !== null) return na - nb;
        if (na !== null) return -1;
        if (nb !== null) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric:true });
      });

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
        // elegir padding: basado en el índice máximo dentro de la parte (len-1), mínimo 4
        const pad = autoPad ? Math.max(4, String(Math.max(0, len - 1)).length) : fixedPad;
        const folderName = `${base} Sec${s+1}`;

        // determinar carpeta destino (si oneZip -> carpeta dentro del zip; si no -> crear zip por base)
        let targetZip = zip;
        let innerFolder;
        if (oneZip){
          innerFolder = targetZip.folder(folderName);
        } else {
          innerFolder = zip.folder(`${base}/${folderName}`);
        }

        // dentro de esta parte renombramos empezando en 0000
        for (let j=0; j<len; j++){
          const file = arr.shift(); // extrae el primero (ordenado por numeroDeArchivo)
          if (!file) continue;
          const ext = extensionDe(file.name);
          // renombrado empieza en 0 (0000)
          const newName = `${base}_${String(j).padStart(pad,'0')}${ext}`;
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
    setTimeout(()=> { progressWrap.hidden = true; progressBar.style.width='0%'; }, 1200);
  }
});