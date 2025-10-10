// Codigo copiado de Funkier Pacher y adaptado por Jarret para solo la nav-bar.

// -------------------- Navbar dinámico --------------------
window.jsonFile = '../../Corner.json';
let dataGlobal = null;

async function cargarNavData() {
  try {
    const res = await fetch(window.jsonFile);
    if (!res.ok) throw new Error("No se pudo cargar Corner.json");
    dataGlobal = await res.json();
    renderizarNav();
  } catch (err) {
    console.error("Error cargando navbar:", err);
  }
}

function renderizarNav() {
  const navBar = document.getElementById('nav-bar');
  if (!navBar || !dataGlobal) return;

  let html = `
    <a href="../../index.html" class="nav-link">
      <i class="fa fa-home"></i> Menú Principal
    </a>
  `;

  (dataGlobal.data?.nav || []).forEach(item => {
    if (item.tipo === 'dropdown') {
      html += `
        <div class="nav-dropdown">
          <button class="nav-dropbtn">
            <i class="fa fa-bars"></i> ${item.titulo || 'Más'}
          </button>
          <div class="nav-dropdown-content">
            ${item.opciones.map(opt => `
              <a href="${opt.url}" target="_blank">${opt.texto}</a>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      html += `
        <a href="${item.url}" class="nav-link" target="_blank">
          <i class="${item.icono || 'fa fa-link'}"></i> ${item.texto}
        </a>
      `;
    }
  });

  navBar.innerHTML = html;
}

// Cubick tiene depresion GG

// Ejecutar al cargar la página

document.addEventListener('DOMContentLoaded', cargarNavData);


async function cargarData() {
    try {
        const resp = await fetch(window.jsonFile, { cache: 'no-cache' });
        dataGlobal = await resp.json();
        renderizarNav();
    } catch (e) {
        console.warn("No se pudo cargar JSON de navbar:", e);
    }
}


// RenownedBySprites.js - versión final corregida
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

function nombreSinExt(nombreArchivo){
  const nombre = nombreArchivo.split('/').pop();
  return nombre.replace(/\.[^.]+$/, '');
}

// limpiarNombre: devuelve la "base" para agrupar
// - quita sufijo (n) siempre (p.ej. "sprite (1)")
// - quita sufijo con separador + dígitos (p.ej. "_0001", "-12", " 03")
// - quita sufijo de dígitos pegados SOLO si son >=2 dígitos (evita "doom64" => doom64)
function limpiarNombre(nombreArchivo){
  const sinExt = nombreSinExt(nombreArchivo);

  // caso (123)
  if (/\(\d+\)$/.test(sinExt)){
    return sinExt.replace(/\(\d+\)$/, '').trim();
  }
  // caso con separador + número al final (_0001, -12, " 03")
  if (/[_\-\s]\d+$/.test(sinExt)){
    return sinExt.replace(/[_\-\s]\d+$/, '').trim();
  }
  // caso dígitos pegados al final: sólo si hay 2 o más dígitos
  if (/\d{2,}$/.test(sinExt)){
    return sinExt.replace(/\d{2,}$/, '').trim();
  }
  // si no hay patrón, devolvemos el nombre tal cual (sin extensión)
  return sinExt.trim();
}

// extrae número de índice del nombre (antes de la extensión)
// soporta:
//   "name (12).png" -> 12
//   "name_0004.png" -> 4
//   "name-12.png" -> 12
//   "name0004.png" -> 4  (solo si >=2 dígitos al final)
function numeroDeArchivo(nombreArchivo){
  const sinExt = nombreSinExt(nombreArchivo);

  // (n)
  let m = sinExt.match(/\((\d+)\)\s*$/);
  if (m) return parseInt(m[1], 10);

  // separador + número (_- espacio)
  m = sinExt.match(/[_\-\s](\d+)\s*$/);
  if (m) return parseInt(m[1], 10);

  // dígitos pegados al final (solo >=2)
  m = sinExt.match(/(\d{2,})\s*$/);
  if (m) return parseInt(m[1], 10);

  return null;
}

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
    const f = new File([blob], baseName, { type: "image/" + baseName.split('.').pop() });
    arr.push({ file: f, originalPath: path });
  }
  return arr;
}

function addLog(text){
  const time = new Date().toLocaleTimeString();
  logs.innerText = `[${time}] ${text}\n` + logs.innerText;
}
function setStatus(txt){ status.innerText = txt; }
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
fileInput.addEventListener('change', async () => { await manejarFilesArray(fileInput.files); });

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
    // ordenamos por número detectado (si existe), si no existe usamos nombre
    const arr = grupos[base].slice().sort((a,b) => {
      const na = numeroDeArchivo(a.name);
      const nb = numeroDeArchivo(b.name);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null && nb === null) return -1;
      if (na === null && nb !== null) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric:true });
    });

    const total = arr.length;
    let parts;
    if (mode === 'parts'){
      parts = Math.min(requested, total);
    } else {
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

    let idx = 0;
    for (let s=0; s<parts; s++){
      const len = tamañoBase + (resto > 0 ? 1 : 0);
      if (resto > 0) resto--;
      // rango de entrada:
      let entradaMin = null, entradaMax = null;
      if (len > 0){
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

[modeSelect, divisionesInput].forEach(el => el.addEventListener('input', renderPreview));
autoPadding.addEventListener('change', () => { paddingInput.disabled = autoPadding.checked; });

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

    const zip = new JSZip();

    addLog(`Iniciando: ${totalFiles} archivos. Modo=${mode} pet=${requested} autoPad=${autoPad} oneZip=${oneZip}`);

    // para cada grupo
    for (const base of Object.keys(grupos).sort()){
      // ordenamos por número detectado (si existe) para respetar la numeración de entrada
      const arrRaw = grupos[base].slice();
      const arr = arrRaw.sort((a,b) => {
        const na = numeroDeArchivo(a.name);
        const nb = numeroDeArchivo(b.name);
        if (na !== null && nb !== null) return na - nb;
        if (na !== null && nb === null) return -1;
        if (na === null && nb !== null) return 1;
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
        // elegir padding: basado en la cantidad de frames de la parte (len), mínimo 4
        const pad = autoPad ? Math.max(4, String(Math.max(0, len - 1)).length) : fixedPad;
        const folderName = `${base} Sec${s+1}`;

        let innerFolder;
        if (oneZip){
          innerFolder = zip.folder(folderName);
        } else {
          innerFolder = zip.folder(`${base}/${folderName}`);
        }

        // renombramos empezando en 0000 para cada parte
        for (let j=0; j<len; j++){
          const file = arr.shift();
          if (!file) continue;
          const ext = extensionDe(file.name);
          const newName = `${base}_${String(j).padStart(pad,'0')}${ext}`;
          innerFolder.file(newName, file);
          processed++;
          const pct = Math.round((processed/totalFiles)*100);
          progressBar.style.width = `${pct}%`;
          setStatus(`Procesando ${processed} / ${totalFiles} (${pct}%)`);
        }
      }
      addLog(`Grupo "${base}" procesado.`);
    }

    addLog('Generando ZIP (puede tardar según la cantidad)...');
    const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      if (meta && meta.percent){
        progressBar.style.width = `${Math.min(99, Math.round(meta.percent))}%`;
      }
    });

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