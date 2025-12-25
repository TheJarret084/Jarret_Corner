/* AltForge.js
   - Arrastra/selecciona JSON/JSONC
   - Empareja notas con events por tiempo (tolerancia configurable)
   - Genera y descarga ALT<baseName>.json
*/
(function(){
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const processBtn = document.getElementById("processBtn");
  const toleranceEl = document.getElementById("tolerance");
  const tolVal = document.getElementById("tolVal");
  const matchProps = document.getElementById("matchProps");
  const resultsCard = document.getElementById("resultsCard");
  const matchesTableBody = document.querySelector("#matchesTable tbody");
  const summaryCount = document.getElementById("summaryCount");
  const jsonPreview = document.getElementById("jsonPreview");
  const fileMeta = document.getElementById("fileMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const copyBtn = document.getElementById("copyBtn");

  let lastFile = null;
  let lastOutput = null;

  // Small helper to strip JS-style comments (works for most JSONC)
  function stripComments(text){
    // Remove /* ... */ and //... (simple method)
    return text
      .replace(/\/\*[\s\S]*?\*\//g, "") // block
      .replace(/\/\/.*$/gm, "");        // line
  }

  function prettyJSON(obj){
    return JSON.stringify(obj, null, 2);
  }

  function readFileAsText(file){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsText(file);
    });
  }

  function basename(name){
    return name.replace(/\.[^/.]+$/, "");
  }

  function findDifficultyName(json, filename){
    // try several spots
    if (json.difficulty) return String(json.difficulty);
    if (json.meta && json.meta["document-name"]) return String(json.meta["document-name"]);
    if (json.meta && json.meta.version) return String(basename(filename));
    return basename(filename);
  }

  // match events to notes by time within tolerance
  function matchNotes(json, toleranceMs, alsoProps){
    const events = Array.isArray(json.events) ? json.events : [];
    const strumLines = Array.isArray(json.strumLines) ? json.strumLines : [];

    // pre-map events by time for quick access (not unique times)
    // we'll keep numeric times
    const evs = events.map(e => ({time: Number(e.time), name: e.name, params: e.params || []}));

    const matches = [];
    strumLines.forEach((sl, slIndex) => {
      (sl.notes || []).forEach(note => {
        const noteTime = Number(note.time);
        // find first event within tolerance
        const ev = evs.find(e => Math.abs(e.time - noteTime) <= toleranceMs);
        if (ev){
          matches.push({
            strumLine: slIndex,
            id: note.id,
            time: noteTime,
            sLen: note.sLen ?? 0,
            type: note.type ?? null,
            eventName: ev.name,
            eventParams: ev.params || ev.params === 0 ? ev.params : ev.params || [],
            source: "time"
          });
        } else if (alsoProps && note.props && note.props.onPressEvent){
          // if note.props.onPressEvent exists, see if any event name matches one of them
          const noteEv = Array.isArray(note.props.onPressEvent) ? note.props.onPressEvent[0] : note.props.onPressEvent;
          if (noteEv){
            const evByName = evs.find(e => String(e.name) === String(noteEv));
            if (evByName){
              matches.push({
                strumLine: slIndex,
                id: note.id,
                time: noteTime,
                sLen: note.sLen ?? 0,
                type: note.type ?? null,
                eventName: evByName.name,
                eventParams: evByName.params || [],
                source: "props.onPressEvent"
              });
            }
          }
        }
      });
    });

    return matches;
  }

  // render helpers
  function renderMeta(file){
    fileMeta.innerHTML = `<strong>${file.name}</strong> · ${(file.size/1024|0)} KB`;
  }

  function renderMatches(matches){
    matchesTableBody.innerHTML = "";
    matches.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.strumLine}</td>
        <td>${m.id}</td>
        <td>${m.time}</td>
        <td>${m.sLen}</td>
        <td>${escapeHtml(String(m.eventName))}</td>
        <td>${escapeHtml(JSON.stringify(m.eventParams))}</td>
      `;
      matchesTableBody.appendChild(tr);
    });
    summaryCount.textContent = matches.length;
  }

  function escapeHtml(s){
    return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function prepareOutput(json, matches, difficultyName){
    return {
      difficulty: String(difficultyName),
      matchedNotesWithEvents: matches,
      sourceSummary: {
        originalNotes: (Array.isArray(json.strumLines) ? json.strumLines.reduce((acc,sl)=>acc+ (Array.isArray(sl.notes)?sl.notes.length:0),0) : 0),
        originalEvents: Array.isArray(json.events) ? json.events.length : 0,
        generatedAt: (new Date()).toISOString()
      }
    };
  }

  // Download helper
  function downloadObjectAsFile(obj, filename){
    const blob = new Blob([prettyJSON(obj)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Copy text
  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(e){
      return false;
    }
  }

  // UI wiring
  toleranceEl.addEventListener("input", () => {
    tolVal.textContent = toleranceEl.value;
  });

  // drag & drop UX
  ["dragenter","dragover"].forEach(ev=>{
    dropZone.addEventListener(ev, e=>{
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.add("dragging");
    });
  });
  ["dragleave","drop"].forEach(ev=>{
    dropZone.addEventListener(ev, e=>{
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.remove("dragging");
    });
  });
  dropZone.addEventListener("drop", async (e)=>{
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  fileInput.addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  async function handleFile(file){
    lastFile = file;
    renderMeta(file);
    resultsCard.hidden = true;
    try{
      let text = await readFileAsText(file);
      // first try direct parse (in case it's pure JSON)
      let json;
      try{
        json = JSON.parse(text);
      }catch(e){
        // try stripping comments then parse
        const cleaned = stripComments(text);
        json = JSON.parse(cleaned);
      }
      // store parsed json for processing
      lastOutput = { json, filename: file.name };
      fileMeta.textContent = `Listo: ${file.name}`;
    }catch(err){
      fileMeta.textContent = `Error leyendo/parsing: ${err.message || err}`;
      lastOutput = null;
    }
  }

  processBtn.addEventListener("click", () => {
    if (!lastOutput){
      alert("Primero selecciona un archivo JSON/JSONC.");
      return;
    }
    const tol = Number(toleranceEl.value);
    const alsoProps = Boolean(matchProps.checked);
    const { json, filename } = lastOutput;
    const difficultyName = findDifficultyName(json, filename);

    const matches = matchNotes(json, tol, alsoProps);
    const output = prepareOutput(json, matches, difficultyName);

    // store for download/copy
    lastOutput.output = output;
    lastOutput.outFilename = `ALT${difficultyName}.json`;

    renderMatches(matches);
    jsonPreview.textContent = prettyJSON(output);
    resultsCard.hidden = false;
  });

  downloadBtn.addEventListener("click", () => {
    if (!lastOutput || !lastOutput.output) return alert("No hay salida para descargar.");
    downloadObjectAsFile(lastOutput.output, lastOutput.outFilename);
  });

  copyBtn.addEventListener("click", async () => {
    if (!lastOutput || !lastOutput.output) return alert("No hay salida para copiar.");
    const ok = await copyToClipboard(prettyJSON(lastOutput.output));
    if (ok) alert("JSON copiado al portapapeles.");
    else alert("No fue posible copiar automáticamente. Usa la previsualización y selecciona manualmente.");
  });

  // init
  tolVal.textContent = toleranceEl.value;
})();

// hola abelito jiijijjajajajajajjajaja
// feliz navidad chicos, y los que lean esto son wapos