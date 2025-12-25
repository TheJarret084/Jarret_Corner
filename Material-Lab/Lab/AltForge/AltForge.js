// AltForge.js — Versión completa y segura
// - Siempre exporta exactamente 4 strumLines (0..3) para game compatibility
// - Filtra notas por tiempo, id, name/type substring, evento substring, props.onPressEvent
// - Salida COMPACTA (JSON.stringify sin espacios)
// - Opciones UI conectadas: tolerancia, ids, name, event, matchProps, keepInStrum, oneNotePerStrum, oneFilePerStrum
// Nota sobre `oneNotePerStrum`: debido al requisito de 4 strumLines fijas, este modo toma
// la primera nota detectada por cada índice 0..3 (si existe) en vez de crear strumLines extras.

(function () {
  // UI elements (debe coincidir con AltForge.html)
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

  // State
  let parsedJson = null;
  let origFilename = "";
  let lastOutput = null;

  // ---------- Helpers ----------
  function stripComments(t) {
    // crude but effective for JSONC: remove /*...*/ and //...
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
    if (!json) return basename(fname || "unknown");
    if (json.difficulty) return String(json.difficulty);
    if (json.meta && json.meta["document-name"]) return String(json.meta["document-name"]);
    return basename(fname || "unknown");
  }

  function parseIdList(s) {
    if (!s) return null;
    return s.split(",").map(x => x.trim()).filter(Boolean).map(x => {
      const n = Number(x);
      return Number.isFinite(n) ? n : x;
    });
  }

  function collectEvents(json) {
    const events = Array.isArray(json.events) ? json.events : [];
    return events.map(e => ({
      time: Number(e.time),
      name: e.name || "",
      params: e.params ?? []
    }));
  }

  // find event(s) whose name contains substring (case-insensitive)
  function findEventsByNameSub(events, substr) {
    if (!substr) return [];
    const sub = String(substr).toLowerCase();
    return events.filter(e => (e.name || "").toString().toLowerCase().includes(sub));
  }

  // ---------- Matching logic ----------
  // Return array of {strumLine, note, matchedBy, matchedEvent (optional)}
  function findMatches(json, opts) {
    const events = collectEvents(json);
    const strumLines = Array.isArray(json.strumLines) ? json.strumLines : [];

    const ids = opts.ids || null;
    const nameSub = opts.nameSub ? String(opts.nameSub).toLowerCase() : null;
    const eventSub = opts.eventSub ? String(opts.eventSub).toLowerCase() : null;
    const tol = Number(opts.tolerance || 0);
    const alsoProps = !!opts.matchProps;

    const matches = [];

    // If eventSub provided, pre-collect those events
    const eventSubMatches = eventSub ? findEventsByNameSub(events, eventSub) : [];

    strumLines.forEach((sl, slIndex) => {
      const notes = Array.isArray(sl.notes) ? sl.notes : [];
      notes.forEach(note => {
        const t = Number(note.time);
        let matched = false;
        let matchedBy = null;
        let matchedEvent = null;

        // 1) time-based: any event within tolerance
        const evByTime = events.find(e => Math.abs(e.time - t) <= tol);
        if (evByTime) {
          matched = true;
          matchedBy = "time";
          matchedEvent = evByTime;
        }

        // 2) match by props.onPressEvent (exact name match to any event)
        if (!matched && alsoProps && note?.props?.onPressEvent) {
          const values = Array.isArray(note.props.onPressEvent) ? note.props.onPressEvent : [note.props.onPressEvent];
          for (const v of values) {
            const vs = String(v).toLowerCase();
            const evExact = events.find(e => String(e.name).toLowerCase() === vs);
            if (evExact) {
              matched = true;
              matchedBy = "props.onPressEvent (exact)";
              matchedEvent = evExact;
              break;
            }
            // also allow substring match vs eventSub if provided
            if (eventSub && (String(v).toLowerCase().includes(eventSub))) {
              // find any event containing eventSub within tolerance
              const cand = eventSubMatches.find(e => Math.abs(e.time - t) <= tol);
              if (cand) {
                matched = true;
                matchedBy = "props.onPressEvent (eventSub)";
                matchedEvent = cand;
                break;
              }
            }
          }
        }

        // 3) ids filter
        if (!matched && ids && ids.length) {
          const nid = note.id;
          if (ids.some(i => i === nid || String(i) === String(nid))) {
            matched = true;
            matchedBy = "id";
          }
        }

        // 4) name/type substring on note (includes crude detection of weird names like "Fuck You")
        if (!matched && nameSub) {
          const t1 = (note.name || "").toString().toLowerCase();
          const t2 = (note.type || "").toString().toLowerCase();
          if (t1.includes(nameSub) || t2.includes(nameSub)) {
            matched = true;
            matchedBy = "note name/type substring";
          }
        }

        // 5) event name substring rule: if user provided eventSub, check if any event containing substring is near this note
        if (!matched && eventSub) {
          const nearEvent = eventSubMatches.find(e => Math.abs(e.time - t) <= tol);
          if (nearEvent) {
            matched = true;
            matchedBy = "event name substring near note";
            matchedEvent = nearEvent;
          }
        }

        if (matched) {
          matches.push({
            strumLine: slIndex,
            note,
            matchedBy,
            matchedEvent
          });
        }
      });
    });

    return matches;
  }

  // ---------- Output production ----------
  // ALWAYS produce exactly 4 strumLines (indices 0..3).
  // Mapping rule: note.id => index = (note.id % 4 + 4) % 4
  // If oneNotePerStrum option is true: keep only the first matched note per index (earliest by time)
  function produceOutputSameFormat(original, matches, opts) {
    const out = JSON.parse(JSON.stringify(original || {}));
    const templates = Array.isArray(original && original.strumLines) ? original.strumLines : [];
    const baseScrollSpeed = original && (original.scrollSpeed ?? out.scrollSpeed) ? (original.scrollSpeed ?? out.scrollSpeed) : 3.1;

    // prepare 4 empty strumLines based on template 0..3 (preserve keyCount/scrollSpeed minimally)
    const newStrumLines = [];
    for (let i = 0; i < 4; i++) {
      const t = templates[i] || {};
      newStrumLines.push({
        keyCount: (typeof t.keyCount !== "undefined") ? t.keyCount : 4,
        scrollSpeed: (typeof t.scrollSpeed !== "undefined") ? t.scrollSpeed : baseScrollSpeed,
        notes: []
      });
    }

    // group matches by mapped idx
    const grouped = {0: [], 1: [], 2: [], 3: []};
    matches.forEach(m => {
      const nid = (m.note && typeof m.note.id !== "undefined") ? Number(m.note.id) : NaN;
      let idx = 0;
      if (Number.isFinite(nid)) idx = ((nid % 4) + 4) % 4;
      grouped[idx].push(m);
    });

    // if oneNotePerStrum: for each idx pick the earliest note (smallest time)
    if (opts.oneNotePerStrum) {
      for (let i = 0; i < 4; i++) {
        if (grouped[i].length === 0) continue;
        // sort by time and take first
        grouped[i].sort((a,b) => (Number(a.note.time) || 0) - (Number(b.note.time) || 0));
        newStrumLines[i].notes.push(grouped[i][0].note);
      }
    } else {
      // push all matched notes into mapped strumLine
      for (let i = 0; i < 4; i++) {
        for (const m of grouped[i]) {
          newStrumLines[i].notes.push(m.note);
        }
      }
    }

    // final assignment: ensure exactly 4 strumLines
    out.strumLines = newStrumLines;

    // keep original top-level fields like events, scrollSpeed, etc (already via deep clone)
    return out;
  }

  // Download compact JSON object
  function downloadCompactObject(obj, name) {
    const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // If user wants one file per strumLine, produce exactly 4 files SL0..SL3
  function downloadPerStrumFiles(original, matches, baseName, opts) {
    // grouped by idx 0..3
    const grouped = {0: [], 1: [], 2: [], 3: []};
    matches.forEach(m => {
      const nid = (m.note && typeof m.note.id !== "undefined") ? Number(m.note.id) : NaN;
      let idx = 0;
      if (Number.isFinite(nid)) idx = ((nid % 4) + 4) % 4;
      grouped[idx].push(m);
    });

    for (let i = 0; i < 4; i++) {
      const out = JSON.parse(JSON.stringify(original || {}));
      const templates = Array.isArray(original && original.strumLines) ? original.strumLines : [];
      const baseScrollSpeed = original && (original.scrollSpeed ?? out.scrollSpeed) ? (original.scrollSpeed ?? out.scrollSpeed) : 3.1;

      out.strumLines = [];
      for (let j = 0; j < 4; j++) {
        const tpl = templates[j] || {};
        out.strumLines.push({
          keyCount: (typeof tpl.keyCount !== "undefined") ? tpl.keyCount : 4,
          scrollSpeed: (typeof tpl.scrollSpeed !== "undefined") ? tpl.scrollSpeed : baseScrollSpeed,
          notes: (j === i) ? (grouped[i].map(x => x.note)) : []
        });
      }

      const filename = `${baseName}_SL${i}.json`;
      downloadCompactObject(out, filename);
    }
  }

  // ---------- Rendering helpers ----------
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
        <td>${escapeHtml(String(m.matchedBy || ""))}</td>
        <td>${escapeHtml(JSON.stringify(m.matchedEvent ? m.matchedEvent.name : (m.note.props || {})))}</td>
      `;
      matchesTableBody.appendChild(tr);
    });
    summaryCount.textContent = matches.length;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---------- UI wiring ----------
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
      alert("Archivo cargado correctamente.");
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

    // find matches
    const matches = findMatches(parsedJson, opts);

    // produce output (always 4 strumLines)
    const output = produceOutputSameFormat(parsedJson, matches, opts);

    const difficultyName = findDifficultyName(parsedJson, origFilename);
    const mainFilename = `ALT${difficultyName}.json`;

    lastOutput = {
      obj: output,
      filename: mainFilename,
      matches
    };

    // render preview (compact)
    jsonPreview.textContent = JSON.stringify(output);
    renderMatchesTable(matches);
    resultsCard.hidden = false;

    // download main file (compact)
    downloadCompactObject(output, mainFilename);

    // optionally download one file per strumLine (4 files)
    if (opts.oneFilePerStrum) {
      const baseBase = `ALT${difficultyName}`;
      downloadPerStrumFiles(parsedJson, matches, baseBase, opts);
    }

    alert(`Proceso completado. Generado ${mainFilename} (coincidencias: ${matches.length}).`);
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
      alert("No se pudo copiar automáticamente. Usa la previsualización para copiar manualmente.");
    }
  });

  // init
  tolVal.textContent = toleranceEl.value;
})();

// happy navidad a todos