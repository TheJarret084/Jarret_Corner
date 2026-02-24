// VidToSheet.js - Extracción robusta para MOBILE usando libgif / SuperGif
// Requiere en el HTML:
// <script src="https://cdn.jsdelivr.net/npm/libgif@0.0.3/libgif.min.js"></script>
// y ya debes tener jszip + filesaver incluidos.

(() => {
  // Elementos DOM (ya definidos en tu HTML)
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const fileInput = document.getElementById("fileInput");
  const fpsInput = document.getElementById("fpsInput");
  const extractBtn = document.getElementById("extractBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const spritesheetBtn = document.getElementById("spritesheetBtn");
  const statusText = document.getElementById("status-text");
  const resultPanel = document.getElementById("result-panel");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  // Estado
  let frames = [];               // dataURLs de PNG
  let videoName = "VidToSheet";
  let currentFile = null;
  let fileType = "";             // "video" o "gif"
  let objectUrl = null;          // URL.createObjectURL(file)
  const MAX_CANVAS_DIM = 32768;  // límite práctico para spritesheet

  // helpers
  function padNumber(n){ return n.toString().padStart(4,"0"); }
  function setStatus(txt){ if(statusText) statusText.textContent = txt; }
  function setProgress(percent, txt){
    if(progressBar) progressBar.value = Math.max(0, Math.min(100, Math.round(percent)));
    if(progressText) progressText.textContent = txt || "";
  }
  function clearResult(){ resultPanel.innerHTML = ""; }

  // Limpieza de objectURL
  function revokeObjectUrl(){
    if(objectUrl){
      try{ URL.revokeObjectURL(objectUrl); }catch(e){}
      objectUrl = null;
    }
  }

  // --- Selección de archivo (solo guarda el archivo, no procesa aún) ---
  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;

    currentFile = f;
    videoName = f.name.replace(/\.[^/.]+$/, "");
    frames = [];
    clearResult();
    downloadBtn.disabled = true;
    setProgress(0, "Archivo cargado");

    // liberar anterior
    revokeObjectUrl();

    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if(["mp4","webm","mov","mkv"].includes(ext)){
      fileType = "video";
      objectUrl = URL.createObjectURL(f);
      video.src = objectUrl;
      video.style.display = "block";
      setStatus(`Video cargado: ${f.name} — listo para extraer`);
    } else if(ext === "gif"){
      fileType = "gif";
      objectUrl = URL.createObjectURL(f);
      // no arrancamos la decodificación todavía; se hace al apretar Extraer
      setStatus(`GIF cargado: ${f.name} — presiona Extraer Fotogramas`);
    } else {
      fileType = "";
      setStatus("Formato no soportado (usa MP4/WebM/MOV o GIF)");
      alert("Formato no soportado. Usa MP4/WebM/MOV o GIF.");
    }
  });

  // --- Botón: Extraer fotogramas (video o gif) ---
  extractBtn.addEventListener("click", async () => {
    if(!currentFile){
      alert("Carga un archivo primero (MP4 o GIF).");
      return;
    }

    frames = [];
    clearResult();
    downloadBtn.disabled = true;
    setProgress(0, "Iniciando extracción...");

    try {
      if(fileType === "gif"){
        await extractFromGifUsingSuperGif();
      } else if(fileType === "video"){
        // aseguramos metadata
        if(video.readyState < 1){
          await new Promise(res => video.addEventListener("loadedmetadata", res, { once:true }));
        }
        await extractFromVideo();
      } else {
        throw new Error("Tipo de archivo desconocido");
      }

      if(frames.length === 0) throw new Error("0 frames extraídos");

      buildPreview();
      setProgress(100, `Extracción completada: ${frames.length} frames`);
      downloadBtn.disabled = false;

    } catch(err){
      console.error("Error extracción:", err);
      setStatus("Error durante extracción — revisa mensajes");
      setProgress(0, `Error: ${err && err.message ? err.message : err}`);
      // intentar fallback mínimo: si no hay frames, intentar 1 frame si es GIF
      if(fileType === "gif" && frames.length === 0){
        try {
          await fallbackSingleFrame();
          buildPreview();
          downloadBtn.disabled = false;
          setProgress(100, "Fallback completado: 1 frame");
        } catch(e){
          console.error("Fallback falló:", e);
          alert("No se pudieron extraer frames. Revisa la consola (si puedes) o prueba otro GIF.");
        }
      } else {
        alert("Error al extraer frames: " + (err && err.message ? err.message : err));
      }
    }
  });

  // --- Extraer GIF con SuperGif (libgif) ---
  async function extractFromGifUsingSuperGif(){
    if(!objectUrl){
      // si por alguna razón no hay objectURL, crear una
      objectUrl = URL.createObjectURL(currentFile);
    }

    setStatus("Decodificando GIF (SuperGif) ...");
    setProgress(5, "Decodificando GIF...");

    // Crear un <img> oculto para SuperGif
    const img = document.createElement("img");
    img.style.display = "none";
    img.crossOrigin = "anonymous"; // por si acaso
    img.src = objectUrl;
    document.body.appendChild(img);

    // Crear instancia SuperGif
    // max_width reduce memoria en móviles si el GIF es enorme (opcional)
    const rub = new SuperGif({ gif: img, auto_play: false, max_width: 0 });

    // envolver load en promise
    await new Promise((resolve, reject) => {
      rub.load(function(){
        // load callback (no args)
        resolve();
      });
      // timeout de seguridad (20s)
      setTimeout(()=> {
        // si no cargó, no bloquear
        if(!rub.get_loading || rub.get_loading()) {
          // no hacemos reject inmediato; SuperGif puede demorar
        }
      }, 20000);
    });

    // ya cargó — obtener número de frames
    const length = rub.get_length();
    if(!length || length === 0) {
      // liberamos img y rub y tiramos error para fallback
      try{ document.body.removeChild(img); }catch(e){}
      throw new Error("SuperGif: 0 frames detectados");
    }

    setStatus(`GIF decodificado: ${length} frames. Extrayendo...`);
    setProgress(8, `Extrayendo frames (0/${length})`);

    // preparar canvas destino (tamaño gif)
    // SuperGif escala según max_width; la canvas se obtiene con get_canvas()
    const tmpCanvas = document.createElement("canvas");
    const tmpCtx = tmpCanvas.getContext("2d");

    // Extraer frame por frame usando move_to + get_canvas
    for(let i=0;i<length;i++){
      rub.move_to(i);
      // dar un pequeño tick para que SuperGif renderice al canvas interno
      await new Promise(r => setTimeout(r, 20)); // 20ms -> razonable en mobile
      const gifCanvas = rub.get_canvas();
      if(!gifCanvas){
        // si por alguna razón no está, intentar small fallback
        console.warn("No se obtuvo gifCanvas en frame", i);
        continue;
      }
      // copiar a tmp canvas para generar dataURL
      tmpCanvas.width = gifCanvas.width;
      tmpCanvas.height = gifCanvas.height;
      tmpCtx.clearRect(0,0,tmpCanvas.width,tmpCanvas.height);
      tmpCtx.drawImage(gifCanvas, 0, 0);
      // guardar PNG dataURL
      const dataURL = tmpCanvas.toDataURL("image/png");
      frames.push(dataURL);

      setProgress(8 + Math.round(((i+1)/length)*86), `Extrayendo frames (${i+1}/${length})`);
      // yield
      await new Promise(r => setTimeout(r, 0));
    }

    setStatus(`GIF extraído: ${frames.length} frames`);
    // cleanup
    try { document.body.removeChild(img); } catch(e){}
    // SuperGif no expone destructor; permitir GC (rub sola referencia local)
  }

  // --- Fallback simple: obtener 1 frame vía <img> drawing ---
  async function fallbackSingleFrame(){
    if(!objectUrl) objectUrl = URL.createObjectURL(currentFile);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = objectUrl;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0);
    frames = [ canvas.toDataURL("image/png") ];
    setStatus("Fallback: 1 frame extraído");
  }

  // --- Extraer frames desde <video> (MP4/WebM) ---
  async function extractFromVideo(){
    const fps = Math.max(1, parseInt(fpsInput.value) || 1);
    const interval = 1 / fps;
    // asegurar metadatos
    if(video.readyState < 1){
      await new Promise(res => video.addEventListener("loadedmetadata", res, { once:true }));
    }
    const duration = video.duration || 0;
    const estimated = Math.max(1, Math.ceil(duration * fps));
    canvas.width = video.videoWidth || 1;
    canvas.height = video.videoHeight || 1;

    setStatus(`Extrayendo frames de video (est ${estimated})`);
    setProgress(0, `0 / ${estimated}`);

    let count = 0;
    for(let t=0; t < duration; t += interval){
      await captureFrameAt(t);
      count++;
      setProgress(Math.round((count/estimated)*100), `${count} / ${estimated}`);
      // safety break
      if(count > estimated + 3) break;
    }
    // asegurar último frame
    if(count < estimated){
      await captureFrameAt(Math.max(0, duration - 0.001));
      count++;
    }
    setStatus(`Video procesado: ${count} frames`);
  }

  function captureFrameAt(time){
    return new Promise(res => {
      const handler = () => {
        try{ ctx.drawImage(video, 0, 0, canvas.width, canvas.height); }
        catch(e){ console.warn("drawImage fail:", e); }
        frames.push(canvas.toDataURL("image/png"));
        video.removeEventListener("seeked", handler);
        res();
      };
      video.addEventListener("seeked", handler, { once:true });
      try { video.currentTime = Math.min(time, Math.max(0, video.duration || time)); }
      catch(e){ video.removeEventListener("seeked", handler); res(); }
    });
  }

  // --- Vista previa de thumbnails ---
  function buildPreview(){
    clearResult();
    const wrap = document.createElement("div");
    wrap.className = "preview-container";

    const title = document.createElement("div");
    title.className = "preview-title";
    title.textContent = videoName;

    const strip = document.createElement("div");
    strip.className = "preview-strip-wrapper";

    frames.forEach((d,i) => {
      const img = document.createElement("img");
      img.src = d;
      img.alt = `frame-${i}`;
      img.style.maxWidth = "80px";
      img.style.margin = "3px";
      strip.appendChild(img);
    });

    const label = document.createElement("div");
    label.className = "preview-label";
    label.textContent = `${frames.length} frames`;

    wrap.appendChild(title);
    wrap.appendChild(strip);
    wrap.appendChild(label);
    resultPanel.appendChild(wrap);
  }

  // --- Generar spritesheet horizontal (botón) ---
  spritesheetBtn.addEventListener("click", async () => {
    if(!frames || frames.length === 0){
      alert("No hay frames. Extrae primero.");
      return;
    }
    try {
      await generateSpritesheetHorizontal();
    } catch(err){
      console.error("Spritesheet error:", err);
      alert("Error creando spritesheet: " + (err && err.message ? err.message : err));
      // no romper: mantener posibilidad de descargar ZIP
    }
  });

  async function generateSpritesheetHorizontal(){
    setStatus("Generando spritesheet...");
    setProgress(2, "Preparando imágenes...");

    // cargar todas las imágenes (thumbnails) en objetos Image
    const images = await Promise.all(frames.map(src => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = e => rej(new Error("Error cargando frame image"));
      i.src = src;
    })));

    const fw = images[0].width;
    const fh = images[0].height;
    const count = images.length;

    const targetW = fw * count;
    const targetH = fh;

    // Validación de tamaño (para no colapsar memoria)
    if(targetW > MAX_CANVAS_DIM || targetH > MAX_CANVAS_DIM) {
      throw new Error(`Spritesheet demasiado grande: ${targetW}x${targetH} (máx ${MAX_CANVAS_DIM}).`);
    }

    // crear canvas temporal para spritesheet
    const sheet = document.createElement("canvas");
    sheet.width = targetW;
    sheet.height = targetH;
    const sctx = sheet.getContext("2d");

    for(let i=0;i<count;i++){
      sctx.drawImage(images[i], i*fw, 0, fw, fh);
      setProgress(Math.round(((i+1)/count)*95), `Armando spritesheet (${i+1}/${count})`);
      // dar tiempo a navegador (ultil en mobile)
      await new Promise(r=>setTimeout(r, 0));
    }

    setProgress(96, "Exportando spritesheet...");
    // exportar blob
    const blob = await new Promise((res, rej) => {
      sheet.toBlob(b => b ? res(b) : rej(new Error("toBlob devolvió null")), "image/png");
    });

    // descargar con FileSaver
    saveAs(blob, `${videoName}_spritesheet.png`);
    setProgress(100, "Spritesheet listo");
    setStatus("Spritesheet generado ✅");
  }

  // --- Descargar ZIP con frames (si spritesheet falla o sólo quieres frames) ---
  downloadBtn.addEventListener("click", () => {
    createZipFromFrames().catch(err => {
      console.error("ZIP error:", err);
      alert("Error generando ZIP: " + (err && err.message ? err.message : err));
    });
  });

  async function createZipFromFrames(){
    if(!frames || frames.length === 0) throw new Error("No hay frames para crear ZIP");
    setStatus("Generando ZIP...");
    setProgress(3, "Creando ZIP...");
    const zip = new JSZip();
    const folder = zip.folder(videoName);

    for(let i=0;i<frames.length;i++){
      const data = frames[i].split(",")[1];
      const name = `${videoName}_${padNumber(i)}.png`;
      folder.file(name, data, { base64: true });
      setProgress(3 + Math.round(((i+1)/frames.length)*90), `Agregando frames (${i+1}/${frames.length})`);
      await new Promise(r=>setTimeout(r, 0));
    }

    const blob = await zip.generateAsync({ type: "blob" }, meta => {
      setProgress(3 + Math.round((meta.percent||0)*0.9), `Comprimiendo ZIP ${Math.round(meta.percent||0)}%`);
    });

    saveAs(blob, `${videoName}.zip`);
    setProgress(100, "ZIP descargado");
    setStatus("ZIP listo ✅");
  }

  // limpiar object URL cuando la página se cierra/navega
  window.addEventListener("beforeunload", revokeObjectUrl);
})();