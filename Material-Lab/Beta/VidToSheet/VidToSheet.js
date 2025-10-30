// VidToSheet.js - versión robusta y compatible con GIF transparente
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

let frames = [];            // dataURLs PNG
let videoName = "VidToSheet";
let currentFile = null;     // File object
let fileType = "";          // "video" or "gif"
let gifBuffer = null;       // ArrayBuffer para gif

// helpers
function padNumber(n){ return n.toString().padStart(4, "0"); }
function setProgressPct(p, txt){
  if(progressBar){ progressBar.value = Math.max(0, Math.min(100, Math.round(p))); }
  if(progressText) progressText.textContent = txt || "";
}
function clearResultPanel(){ resultPanel.innerHTML = ""; }

// --- file select: SOLO guarda info, no procesar inmediatamente ---
fileInput.addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  currentFile = f;
  videoName = f.name.replace(/\.[^/.]+$/, "");
  frames = [];
  clearResultPanel();
  downloadBtn.disabled = true;
  setProgressPct(0, "Archivo cargado, esperando extracción...");

  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if(["mp4","webm","mov","mkv"].includes(ext)){
    fileType = "video";
    video.style.display = "block";
    video.src = URL.createObjectURL(f);
    // intentar esperar metadata (no bloquear)
    video.addEventListener("loadedmetadata", ()=> {
      setProgressPct(0, `Video listo: ${f.name}`);
    }, { once:true });
  } else if(ext === "gif"){
    fileType = "gif";
    video.style.display = "none";
    // leer buffer para procesar luego
    gifBuffer = await f.arrayBuffer();
    setProgressPct(0, `GIF listo: ${f.name}`);
  } else {
    fileType = "";
    alert("Formato no soportado. Usa MP4/WEBM/MOV o GIF.");
  }
});

// --- extract button: según tipo, procesar ---
extractBtn.addEventListener("click", async () => {
  if(!currentFile){ alert("Carga un archivo primero."); return; }
  frames = [];
  clearResultPanel();
  downloadBtn.disabled = true;
  setProgressPct(0, "Iniciando extracción...");

  try {
    if(fileType === "gif"){
      await processGIFBuffer();         // procesar GIF con gifuct (preserva alfa)
    } else if(fileType === "video"){
      // asegurar metadatos
      if(video.readyState < 1){
        await new Promise(r => video.addEventListener("loadedmetadata", r, { once:true }));
      }
      await processVideoFrames();
    } else {
      throw new Error("Tipo de archivo desconocido");
    }

    buildPreview();
    downloadBtn.disabled = false;
    setProgressPct(100, `Extracción completada (${frames.length} frames)`);

  } catch(err){
    console.error("Error extrayendo:", err);
    alert("Error durante la extracción. Mira la consola para más detalles.");
    setProgressPct(0, "Error durante extracción");
  }
});

// --- procesar GIF (usa global GIF de gifuct-js) ---
async function processGIFBuffer(){
  setProgressPct(5, "Decodificando GIF...");
  try {
    // usar el global GIF expuesto por gifuct-js
    const parsed = GIF.parseGIF(gifBuffer);
    const decoded = GIF.decompressFrames(parsed, true); // true -> build patch
    if(!decoded || decoded.length === 0) throw new Error("GIF vacío o no animado.");

    // determinamos w/h del canvas (from lsd o first frame)
    const w = (parsed.lsd && parsed.lsd.width) ? parsed.lsd.width : (decoded[0].dims && decoded[0].dims.width ? decoded[0].dims.width : 1);
    const h = (parsed.lsd && parsed.lsd.height) ? parsed.lsd.height : (decoded[0].dims && decoded[0].dims.height ? decoded[0].dims.height : 1);
    canvas.width = w;
    canvas.height = h;

    // compositing para respetar disposals/posición y alfa (simplificado)
    // construiremos fullImageData RGBA y lo actualizaremos por frame
    const full = ctx.createImageData(w, h);
    // inicia transparente (ya lo es)

    for(let i=0;i<decoded.length;i++){
      const fr = decoded[i];
      // manejo básico disposal: si prevFrame.disposalType === 2 limpiar región
      if(i>0 && decoded[i-1].disposalType === 2){
        const pd = decoded[i-1].dims;
        for(let yy=0; yy<pd.height; yy++){
          for(let xx=0; xx<pd.width; xx++){
            const idx = ((pd.top+yy)*w + (pd.left+xx)) * 4;
            full.data[idx]=0; full.data[idx+1]=0; full.data[idx+2]=0; full.data[idx+3]=0;
          }
        }
      }

      // copiar patch al full
      const patch = fr.patch; // Uint8Array RGBA w*h*4 of frame.dims size
      const dims = fr.dims;
      if(patch && dims){
        let pi = 0;
        for(let yy=0; yy<dims.height; yy++){
          for(let xx=0; xx<dims.width; xx++){
            const destIdx = ((dims.top + yy)*w + (dims.left + xx)) * 4;
            full.data[destIdx]   = patch[pi++];
            full.data[destIdx+1] = patch[pi++];
            full.data[destIdx+2] = patch[pi++];
            full.data[destIdx+3] = patch[pi++];
          }
        }
      }

      // volcar full en canvas y guardar PNG
      ctx.putImageData(full, 0, 0);
      frames.push(canvas.toDataURL("image/png"));

      // progreso
      setProgressPct(5 + Math.round(((i+1)/decoded.length)*90), `Procesando GIF (${i+1}/${decoded.length})`);
      await new Promise(r=>setTimeout(r,0)); // yield
    }

    if(frames.length === 0) throw new Error("0 frames extraídos del GIF.");

  } catch(err){
    console.warn("gifuct falló:", err);
    // fallback: intentar cargar el gif como <img> y obtener un frame estático (1 frame)
    await fallbackSingleFrameFromGIF();
  }
}

// fallback: si gifuct no pudo, extraer 1 frame visible del GIF
async function fallbackSingleFrameFromGIF(){
  try {
    setProgressPct(30, "Fallback: obteniendo frame estático del GIF...");
    const url = URL.createObjectURL(currentFile);
    const img = new Image();
    await new Promise((res, rej)=>{
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0);
    frames = [canvas.toDataURL("image/png")];
    setProgressPct(100, "Fallback completado: 1 frame (GIF estático)");
  } catch(e){
    console.error("Fallback de GIF falló:", e);
    throw new Error("No se pudieron extraer frames del GIF");
  }
}

// --- procesar video frames ---
async function processVideoFrames(){
  const fps = Math.max(1, parseInt(fpsInput.value) || 1);
  const interval = 1 / fps;
  const duration = video.duration || 0;
  const estimatedCount = Math.max(1, Math.ceil(duration * fps));
  canvas.width = video.videoWidth || 1;
  canvas.height = video.videoHeight || 1;

  let count = 0;
  for(let t=0; t<duration; t += interval){
    await seekAndCapture(t);
    count++;
    setProgressPct( Math.round((count/estimatedCount)*100), `Extrayendo frames (${count}/${estimatedCount})`);
  }
  // intentar captura del último frame si no cayó exactamente
  if(count < estimatedCount){
    await seekAndCapture(duration - 0.001);
    count++;
  }
  setProgressPct(100, `Video procesado: ${count} frames`);
}

function seekAndCapture(time){
  return new Promise((res)=>{
    const handler = () => {
      try{ ctx.drawImage(video,0,0,canvas.width,canvas.height); }
      catch(e){ console.warn("drawImage fallo:",e); }
      frames.push(canvas.toDataURL("image/png"));
      video.removeEventListener("seeked", handler);
      res();
    };
    video.addEventListener("seeked", handler, { once:true });
    try { video.currentTime = Math.min(time, Math.max(0, video.duration || time)); }
    catch(e){ video.removeEventListener("seeked", handler); res(); }
  });
}

// --- construir preview (thumbnails) ---
function buildPreview(){
  clearResultPanel();
  const container = document.createElement("div");
  container.className = "preview-container";

  const title = document.createElement("div"); title.className="preview-title"; title.textContent = videoName;
  const strip = document.createElement("div"); strip.className = "preview-strip-wrapper";

  frames.forEach(s => {
    const img = document.createElement("img");
    img.src = s;
    img.style.maxWidth = "100px";
    img.style.margin = "2px";
    strip.appendChild(img);
  });

  const label = document.createElement("div"); label.className="preview-label";
  label.textContent = `${frames.length} frame${frames.length!==1 ? "s":""}`;
  container.appendChild(title);
  container.appendChild(strip);
  container.appendChild(label);
  resultPanel.appendChild(container);
}

// --- generar spritesheet horizontal (por botón) ---
spritesheetBtn.addEventListener("click", async () => {
  if(!frames || frames.length === 0){ alert("No hay frames: extrae primero."); return; }
  try {
    await generateSpritesheetHorizontal();
  } catch(err){
    console.error("Spritesheet error:", err);
    alert("Error generando spritesheet. Se mantiene el ZIP de frames.");
  }
});

async function generateSpritesheetHorizontal(){
  // preparar imágenes
  const imgs = await Promise.all(frames.map(src => new Promise((res,rej)=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = e=>rej(e);
    i.src = src;
  })));

  const fw = imgs[0].width, fh = imgs[0].height, count = imgs.length;
  const maxDim = 32768; // límite práctico
  if(fw * count > maxDim || fh > maxDim) throw new Error(`Spritesheet demasiado grande: ${fw*count}x${fh}`);

  const sheet = document.createElement("canvas");
  sheet.width = fw * count;
  sheet.height = fh;
  const sctx = sheet.getContext("2d");

  for(let i=0;i<count;i++){
    sctx.drawImage(imgs[i], i*fw, 0);
    setProgressPct(Math.round(((i+1)/count)*95), `Construyendo spritesheet (${i+1}/${count})`);
    await new Promise(r=>setTimeout(r,0));
  }

  // exportar PNG blob y descargar
  const blob = await new Promise((res,rej)=> sheet.toBlob(b=> b ? res(b) : rej(new Error("toBlob devolvió null")), "image/png"));
  saveAs(blob, `${videoName}_spritesheet.png`);
  setProgressPct(100, "Spritesheet listo");
}

// --- descargar ZIP de frames ---
downloadBtn.addEventListener("click", downloadZipOfFrames);
async function downloadZipOfFrames(){
  if(!frames || frames.length === 0){ alert("No hay frames para descargar."); return; }
  setProgressPct(5, "Generando ZIP...");
  const zip = new JSZip();
  const folder = zip.folder(videoName);
  for(let i=0;i<frames.length;i++){
    const data = frames[i].split(",")[1];
    folder.file(`${videoName}_${padNumber(i)}.png`, data, { base64: true });
    setProgressPct(5 + Math.round(((i+1)/frames.length)*90), `Agregando frames al ZIP (${i+1}/${frames.length})`);
    await new Promise(r=>setTimeout(r,0));
  }
  const blob = await zip.generateAsync({ type: "blob" }, meta => {
    setProgressPct(5 + Math.round((meta.percent||0)*0.9), `Comprimiendo ZIP ${Math.round(meta.percent||0)}%`);
  });
  saveAs(blob, `${videoName}.zip`);
  setProgressPct(100, "ZIP listo");
}