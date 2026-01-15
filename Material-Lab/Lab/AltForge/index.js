let chartBase = null;      // Guarda el chart base cargado del archivo
let chartCount = 0;        // Lleva la cuenta de charts creados

// Referencias a elementos del DOM
const fileInput = document.getElementById("fileInput");
const chartsDiv = document.getElementById("charts");
const addChartBtn = document.getElementById("addChart");
const generateBtn = document.getElementById("generate");
const logEl = document.getElementById("log");

// Función para mostrar mensajes en el área de log
function log(msg) {
  logEl.textContent += msg + "\n";
}

// Cuando se selecciona un archivo JSON, lo lee y lo guarda como chartBase
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  chartBase = JSON.parse(await file.text());
  // Obtener el nombre base sin extensión
  baseFileName = file.name.replace(/\.[^/.]+$/, "");
  chartsDiv.innerHTML = "";
  chartCount = 0;
  generateBtn.disabled = false;
  log("✔ Chart cargado");
});

// Al hacer click en 'Nuevo chart', crea una nueva UI de chart si hay un chart cargado
addChartBtn.addEventListener("click", () => {
  if (!chartBase) return;
  createChartUI();
});

// Crea la interfaz de un chart editable (nombre, tipos de nota, strumLines)
function createChartUI() {
  chartCount++;

  const div = document.createElement("div");
  div.className = "chart";

  // Genera los controles para nombre, tipos de nota y strumLines
  div.innerHTML = `
    <strong>Chart ${chartCount}</strong><br>
    Nombre del JSON:
    <input type="text" placeholder="chart${chartCount}">
    
    <div class="section">
      <strong>NoteTypes</strong>
      ${chartBase.noteTypes.map((n, i) => `
        <label>
          <input type="checkbox" data-type="${i}" checked>
          ${n}
        </label>
      `).join("")}
    </div>

    <div class="section">
      <strong>StrumLines</strong>
      ${chartBase.strumLines.map((_, i) => `
        <label>
          <input type="checkbox" data-strum="${i}" checked>
          StrumLine ${i}
        </label>
      `).join("")}
    </div>
  `;

  chartsDiv.appendChild(div);
}

// Al hacer click en 'Generar ZIP', crea los archivos JSON según la selección y los empaqueta en un ZIP
generateBtn.addEventListener("click", async () => {
  const zip = new JSZip();
  const chartsUI = document.querySelectorAll(".chart");

  let autoIndex = 1;

  for (const ui of chartsUI) {
    // Obtiene el nombre del archivo, o uno automático si está vacío
    const nameInput = ui.querySelector("input[type=text]");
    const name = nameInput.value.trim() || `chart${autoIndex++}`;

    // Obtiene los tipos de nota seleccionados
    const allowedTypes = [...ui.querySelectorAll("input[data-type]:checked")]
      .map(c => Number(c.dataset.type));

    // Obtiene los strumLines seleccionados
    const allowedStrums = [...ui.querySelectorAll("input[data-strum]:checked")]
      .map(c => Number(c.dataset.strum));

    // Crea una copia profunda del chart base
    const out = JSON.parse(JSON.stringify(chartBase));

    // Filtra los strumLines y las notas según la selección
    out.strumLines = out.strumLines
      .map((strum, i) => {
        if (!allowedStrums.includes(i)) return null;

        return {
          ...strum,
          notes: (strum.notes || []).filter(n =>
            allowedTypes.includes(n.type)
          )
        };
      })
      .filter(Boolean);

    // Agrega el archivo JSON al ZIP
    zip.file(`${name}.json`, JSON.stringify(out, null, 0));
    log(`✔ ${name}.json generado`);
  }

  // Genera y descarga el ZIP con todos los charts
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  // Usa el nombre base del archivo cargado para el ZIP
  const zipName = baseFileName ? `TJ-${baseFileName}.zip` : "charts.zip";
  a.href = URL.createObjectURL(blob);
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(a.href);

  log(`📦 ZIP listo (${zipName})`);
});