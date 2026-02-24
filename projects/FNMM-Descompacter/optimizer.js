//-------------- La Nav-Bar Dinámica --------------
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
cargarData();

// optimizer.js - FNMM-Compacter
const logEl = document.getElementById('log');
const progressInner = document.getElementById('progress-inner');

function log(msg) {
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

function setProgress(percent) {
  progressInner.style.width = percent + '%';
}

// =====================
// 1) Extraer sprites
// =====================
document.getElementById('extractBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('fnmmFile');
  const resultsDiv = document.getElementById('extractResults');
  resultsDiv.innerHTML = '';
  log('Iniciando extracción...');

  if (!fileInput.files.length) {
    alert('Selecciona un archivo .FNMM');
    return;
  }

  const zipFile = fileInput.files[0];
  const zip = await JSZip.loadAsync(zipFile);
  const newZip = new JSZip();

  const mapping = {};
  let pngFiles = Object.keys(zip.files).filter(f => f.endsWith('.png') && !zip.files[f].dir);

  log(`Archivos PNG encontrados: ${pngFiles.length}`);

  for (let i = 0; i < pngFiles.length; i++) {
    const name = pngFiles[i];
    const file = zip.files[name];
    const data = await file.async('arraybuffer');
    const simpleName = i + '.png';
    newZip.file(simpleName, data);
    mapping[simpleName] = name;
    setProgress(Math.round((i + 1) / pngFiles.length * 100));
    log(`Procesado: ${name} -> ${simpleName}`);
    await new Promise(r => setTimeout(r, 5));
  }

  newZip.file('mapping.json', JSON.stringify(mapping, null, 2));

  const outBlob = await newZip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(outBlob);
  a.download = zipFile.name.replace('.FNMM', '_sprites.zip');
  a.textContent = 'Descargar ZIP de sprites';
  resultsDiv.appendChild(a);

  log('Extracción completada.');
  setProgress(100);
});

// =====================
// 2) Importar ZIP optimizado y reconstruir FNMM
// =====================
document.getElementById('importBtn').addEventListener('click', async () => {
  const optimizedZipInput = document.getElementById('optimizedZipFile');
  const originalFnmmInput = document.getElementById('fnmmFile');
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (!optimizedZipInput.files.length || !originalFnmmInput.files.length) {
    alert('Debes seleccionar tanto el archivo .FNMM original como el ZIP optimizado');
    return;
  }

  log('Cargando ZIP optimizado...');
  const optimizedZip = await JSZip.loadAsync(optimizedZipInput.files[0]);

  if (!optimizedZip.files['mapping.json']) {
    alert('El ZIP optimizado no contiene un mapping.json');
    return;
  }

  const mappingText = await optimizedZip.files['mapping.json'].async('text');
  const mapping = JSON.parse(mappingText);

  log('Cargando FNMM original...');
  const originalZip = await JSZip.loadAsync(originalFnmmInput.files[0]);

  const newZip = new JSZip();

  const totalSteps = Object.keys(originalZip.files).length;
  let processed = 0;

  for (const fileName in originalZip.files) {
    const file = originalZip.files[fileName];
    if (file.dir) continue;

    let replacement = null;

    // Verificar si el archivo es una imagen que puede ser reemplazada
    const mappedEntry = Object.entries(mapping).find(([simpleName, originalName]) => originalName === fileName);
    if (mappedEntry) {
      const [simpleName] = mappedEntry;
      if (optimizedZip.files[simpleName]) {
        replacement = await optimizedZip.files[simpleName].async('arraybuffer');
        log(`✔️ Reemplazado: ${fileName}`);
      }
    }

    if (!replacement) {
      replacement = await file.async('arraybuffer');
      log(`➡️ Conservado original: ${fileName}`);
    }

    newZip.file(fileName, replacement);
    processed++;
    setProgress(Math.round(processed / totalSteps * 100));
    await new Promise(r => setTimeout(r, 5));
  }

  log('Reconstrucción completada. Generando archivo final...');

  const finalBlob = await newZip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(finalBlob);
  a.download = optimizedZipInput.files[0].name.replace('_sprites.zip', '_OPT.FNMM');
  a.textContent = 'Descargar FNMM optimizado';
  resultsDiv.appendChild(a);

  log('✅ FNMM reconstruido exitosamente.');
  setProgress(100);
});
