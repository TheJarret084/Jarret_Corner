// AltForge.js — versión con filtros avanzados y opciones de salida
(function () {
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const processBtn = document.getElementById("processBtn");
  const toleranceEl = document.getElementById("tolerance");
  const tolVal = document.getElementById("tolVal");
  const matchProps = document.getElementById("matchProps");
  const idsFilter = document.getElementById("idsFilter");
  const nameFilter = document.getElementById("nameFilter");
  const eventFilter = document.getElementById("eventFilter");
  const keepInStrum = document.getElementById("keepInStrum");
  const oneNotePerStrum = document.getElementById("oneNotePerStrum");
  const oneFilePerStrum = document.getElementById("oneFilePerStrum");

  const resultsCard = document.getElementById("resultsCard");
  const matchesTableBody = document.querySelector("#matchesTable tbody");
  const summaryCount = document.getElementById("summaryCount");
  const jsonPreview = document.getElementById("jsonPreview");
  const fileMeta = document.getElementById("fileMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const copyBtn = document.getElementById("copyBtn");

  let parsedJson = null;
  let origFilename = "";
  let lastOutput = null;

  function stripComments(t) {
    return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  function readFileAsText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsText(file);
    });
  }

  function basename(n) {
    return n.replace(/\.[^/.]+$/, "");
  }

  function findDifficultyName(json, fname) {
    if (json.difficulty) return String(json.difficulty);
    if (json.meta && json.meta["document-name"]) return String(json.meta["document-name"]);
    return basename(fname);
  }

  function parseIdList(s) {
    if (!s) return null;
    return s.split(",").map(x => x.trim()).filter(Boolean).map(x => {
      const n = Number(x);
      return Number.isFinite(n) ? n : x;
    });
  }

  function anyEventMatchByTime(eventsMap, t, tol) {
    return eventsMap.some(e => Math.abs(e.time - t) <= tol);
  }

  function anyEventNameContains(eventsMap, substr) {
    if (!substr) return false;
    const sub = String(substr).toLowerCase();
    return eventsMap.some(e => (e.name || "").toString().toLowerCase().includes(sub));
  }

  function noteHasPropEventMatch(note, eventsMap, substrMatchForEventName) {
    if (!note || !note.props) return false;
    const ope = note.props.onPressEvent;
    if (!ope) return false;
    const values = Array.isArray(ope) ? ope : [ope];
    // if any of those values matches an event name exactly or contains substr filter, return true
    for (const v of values) {
      const vs = String(v).toLowerCase();
      // exact match with event names
      if (eventsMap.some(e => String(e.name).toLowerCase() === vs)) return true;
      // substring match if user asked for eventFilter
      if (substrMatchForEventName && anyEventNameContains(eventsMap, v)) return true;
    }
    return false;
  }

  function collectEvents(json) {
    const events = Array.isArray(json.events) ? json.events : [];
    return events.map(e => ({ time: Number(e.time), name: e.name || "", params: e.params || [] }));
  }

  // filter logic: returns an array of matched note descriptors {strumLineIndex, note}
  function findMatches(json, options) {
    const eventsMap = collectEvents(json);
    const sls = Array.isArray(json.strumLines) ? json.strumLines : [];

    const ids = options.ids || null;
    const nameSub = options.nameSub ? String(options.nameSub).toLowerCase() : null;
    const eventSub = options.eventSub ? String(options.eventSub).toLowerCase() : null;
    const tol = Number(options.tolerance || 0);
    const alsoProps = !!options.matchProps;

    const matches = [];

    sls.forEach((sl, slIndex) => {
      const notes = Array.isArray(sl.notes) ? sl.notes : [];
      notes.forEach(note => {
        const t = Number(note.time);
        let matched = false;
        let matchedBy = "";

        // by time (event near note time)
        if (anyEventMatchByTime(eventsMap, t, tol)) {
          matched = true;
          matchedBy = "time";
        }

        // by props.onPressEvent
        if (!matched && alsoProps && noteHasPropEventMatch(note, eventsMap, true)) {
          matched = true;
          matchedBy = "props.onPressEvent";
        }

        // by ids list
        if (!matched && ids && ids.length) {
          // id in original JSON is note.id (might be numeric or string)
          const nid = note.id;
          if (ids.some(i => i === nid || String(i) === String(nid))) {
            matched = true;
            matchedBy = "id";
          }
        }

        // by name/type substring
        if (!matched && nameSub) {
          const t1 = (note.name || "").toString().toLowerCase();
          const t2 = (note.type || "").toString().toLowerCase();
          if (t1.includes(nameSub) || t2.includes(nameSub)) {
            matched = true;
            matchedBy = "name/type";
          }
        }

        // by event name substring match (if user provided)
        if (!matched && eventSub) {
          if (anyEventNameContains(eventsMap, eventSub)) {
            // but ensure there's at least an event containing that substring — we could accept the note if event substring exists anywhere
            matched = true;
            matchedBy = "event name substring";
          }
        }

        if (matched) {
          matches.push({
            strumLine: slIndex,
            note: note,
            matchedBy
          });
        }
      });
    });

    return matches;
  }

  // produce an output JSON that matches original format but with filtered notes
  function produceOutputSameFormat(original, matches, opts) {
    // deep-ish clone original but we will replace strumLines notes arrays
    const out = JSON.parse(JSON.stringify(original));
    const slCount = Array.isArray(original.strumLines) ? original.strumLines.length : 0;
    // Initialize empty notes arrays
    out.strumLines = (original.strumLines || []).map(sl => {
      // copy everything but set notes to []
      const copy = Object.assign({}, sl);
      copy.notes = [];
      return copy;
    });

    // place matches
    if (opts.oneNotePerStrum) {
      // create new strumLines where each matched note becomes its own strumLine
      const generated = matches.map(m => {
        const originalSL = original.strumLines && original.strumLines[m.strumLine] ? original.strumLines[m.strumLine] : {};
        const keyCount = originalSL.keyCount || 4;
        // copy a minimal strumLine object
        return {
          ... (originalSL ? { ...originalSL } : { keyCount }),
          notes: [m.note]
        };
      });
      out.strumLines = generated;
    } else {
      // usual: keep matched notes in their original strumLine index
      matches.forEach(m => {
        const idx = m.strumLine;
        // if out.strumLines lacks that index (safe-guard)
        if (!out.strumLines[idx]) {
          // create placeholder strumLine
          out.strumLines[idx] = { keyCount: 4, notes: [] };
        }
        out.strumLines[idx].notes.push(m.note);
      });
    }

    // compact: return as object (downstream we'll stringify compact)
    return out;
  }

  function downloadCompactObject(obj, name) {
    const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // multiples: one file per strumLine with matches
  function downloadPerStrumFiles(original, matches, baseName) {
    // group matches by strumLine
    const grouped = {};
    matches.forEach(m => {
      (grouped[m.strumLine] = grouped[m.strumLine] || []).push(m);
    });

    Object.keys(grouped).forEach(slIndexStr => {
      const slIndex = Number(slIndexStr);
      // build new json where only this strumline has its matched notes
      const out = JSON.parse(JSON.stringify(original));
      out.strumLines = (original.strumLines || []).map((sl, idx) => {
        return idx === slIndex ? { ...sl, notes: grouped[slIndex].map(x => x.note) } : { ...sl, notes: [] };
      });
      const filename = `${baseName}_SL${slIndex}.json`;
      downloadCompactObject(out, filename);
    });
  }

  function renderMeta(file) {
    fileMeta.innerHTML = `<strong>${file.name}</strong> · ${(file.size / 1024 | 0)} KB`;
  }

  function renderMatchesTable(matches) {
    matchesTableBody.innerHTML = "";
    matches.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.strumLine}</td>
        <td>${escapeHtml(String(m.note.id ?? ""))}</td>
        <td>${escapeHtml(String(m.note.time ?? ""))}</td>
        <td>${escapeHtml(String(m.note.sLen ?? ""))}</td>
        <td>${escapeHtml(String(m.matchedBy))}</td>
        <td>${escapeHtml(JSON.stringify(m.note.props ?? {}))}</td>
      `;
      matchesTableBody.appendChild(tr);
    });
    summaryCount.textContent = matches.length;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Wiring events
  toleranceEl.addEventListener("input", () => {
    tolVal.textContent = toleranceEl.value;
  });

  // Drag & drop UX
  ["dragenter", "dragover"].forEach(ev => {
    dropZone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach(ev => {
    dropZone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.remove("dragging");
    });
  });
  dropZone.addEventListener("drop", async (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await handleFile(f);
  });

  fileInput.addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0];
    if (f) await handleFile(f);
  });

  async function handleFile(file) {
    origFilename = file.name;
    renderMeta(file);
    try {
      let txt = await readFileAsText(file);
      let j;
      try {
        j = JSON.parse(txt);
      } catch (err) {
        j = JSON.parse(stripComments(txt));
      }
      parsedJson = j;
      fileMeta.textContent = `Listo: ${file.name}`;
    } catch (err) {
      parsedJson = null;
      fileMeta.textContent = `Error leyendo/parsing: ${err.message || err}`;
      alert("Error leyendo/parsing el archivo. Asegúrate que sea JSON o JSONC válido.");
    }
  }

  processBtn.addEventListener("click", () => {
    if (!parsedJson) return alert("Carga primero un JSON/JSONC válido.");

    const opts = {
      tolerance: Number(toleranceEl.value),
      matchProps: matchProps.checked,
      ids: parseIdList(idsFilter.value),
      nameSub: (nameFilter.value || "").trim(),
      eventSub: (eventFilter.value || "").trim(),
      oneNotePerStrum: oneNotePerStrum.checked,
      oneFilePerStrum: oneFilePerStrum.checked,
      keepInStrum: keepInStrum.checked
    };

    const matches = findMatches(parsedJson, opts);
    // if keepInStrum is false and oneNotePerStrum false, but user still wants a single file: we'll still place matches by original strumline
    const output = produceOutputSameFormat(parsedJson, matches, opts);

    lastOutput = {
      obj: output,
      filename: `ALT${findDifficultyName(parsedJson, origFilename)}.json`,
      matches
    };

    // show preview compact
    jsonPreview.textContent = JSON.stringify(output);
    renderMatchesTable(matches);
    resultsCard.hidden = false;

    // automatic downloads depending on options
    // main file
    downloadCompactObject(output, lastOutput.filename);

    // if user requested one file per strumline, generate those too
    if (opts.oneFilePerStrum) {
      const baseBase = `ALT${findDifficultyName(parsedJson, origFilename)}`;
      downloadPerStrumFiles(parsedJson, matches, baseBase);
    }

    // If user requested oneNotePerStrum but also oneFilePerStrum, we already downloaded main, and per strumline files.
    alert(`Proceso completado. Se descargó: ${lastOutput.filename} (${matches.length} coincidencias).`);
  });

  downloadBtn.addEventListener("click", () => {
    if (!lastOutput) return alert("No hay salida generada.");
    downloadCompactObject(lastOutput.obj, lastOutput.filename);
  });

  copyBtn.addEventListener("click", async () => {
    if (!lastOutput) return alert("No hay salida generada.");
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastOutput.obj));
      alert("JSON compacto copiado al portapapeles.");
    } catch (e) {
      alert("No se pudo copiar automáticamente. Puedes usar la previsualización para copiar manualmente.");
    }
  });

  // util
  function parseIdList(s) {
    if (!s) return null;
    return s.split(",").map(x => x.trim()).filter(Boolean).map(x => {
      const n = Number(x);
      return Number.isFinite(n) ? n : x;
    });
  }

  // init
  tolVal.textContent = toleranceEl.value;
})();