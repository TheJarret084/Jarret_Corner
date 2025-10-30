// VidToSheet.js - Versión mejorada con spritesheet horizontal y barra de progreso
// Requiere: jszip, FileSaver.js, gifuct-js (ya los incluyes en tu HTML)

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

let frames = [];            // array de dataURLs (PNG) de cada frame
let videoName = "VidToSheet";
let isGIF = false;
let gifBuffer = null;
const MAX_CANVAS_DIM = 32768; // límite práctico para evitar crear canvas inmensos (ajustable)

// ********** utilidades **********
function padNumber(num) {
  return num.toString().padStart(4, "0");
}

function waitForEvent(target, eventName) {
  return new Promise(resolve => {
    const handler = e => {
      target.removeEventListener(eventName, handler);
      resolve(e);
    };
    target.addEventListener(eventName, handler);
  });
}

function setProgress(percent, text) {
  if (progressBar) progressBar.value = Math.max(0, Math.min(100, Math.round(percent)));
  if (progressText) progressText.textContent = text || "";
}

// carga de imagen desde dataURL -> Promise<HTMLImageElement>
function loadImg(dataURL) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = (e) => rej(new Error("Error cargando imagen de frame"));
    img.src = dataURL;
    // si es dataURL con transparencia y origen local, no hay problemas de CORS
  });
}

// ********** manejo de archivo cargado **********
fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  videoName = file.name.replace(/\.[^/.]+$/, "");
  resultPanel.innerHTML = "";
  downloadBtn.disabled = true;
  frames = [];
  setProgress(0, "Archivo cargado, esperando acción...");

  const ext = file.name.split(".").pop().toLowerCase();
  isGIF = ext === "gif";

  if (isGIF) {
    statusText.textContent = `GIF cargado: ${file.name}`;
    const reader = new FileReader();
    reader.onload = (ev) => {
      gifBuffer = ev.target.result; // ArrayBuffer
      video.style.display = "none";
    };
    reader.readAsArrayBuffer(file);
  } else {
    const url = URL.createObjectURL(file);
    video.src = url;
    video.style.display = "block";
    statusText.textContent = `Video cargado: ${file.name} — esperando metadatos...`;
    if (video.readyState < 1) {
      await waitForEvent(video, "loadedmetadata");
    }
    statusText.textContent = `Video listo: ${file.name}`;
  }
});

// ********** extracción de frames (video/gif) **********
extractBtn.addEventListener("click", async () => {
  setProgress(0, "Iniciando extracción...");
  if (isGIF && gifBuffer) {
    await extractFromGIF();
  } else if (video.src) {
    if (video.readyState < 1) {
      setProgress(0, "Esperando metadatos del video...");
      await waitForEvent(video, "loadedmetadata");
    }
    await extractFromVideo();
  } else {
    alert("Carga un video o GIF primero");
    return;
  }

  buildPreview();
  downloadBtn.disabled = false;
  setProgress(100, "Extracción completada ✅");
});

// --- extracción desde VIDEO ---
async function extractFromVideo() {
  frames = [];
  const fps = Math.max(1, parseInt(fpsInput.value) || 1);
  const interval = 1 / fps;
  const estimated = Math.max(1, Math.ceil(video.duration / interval));

  canvas.width = video.videoWidth || 1;
  canvas.height = video.videoHeight || 1;

  statusText.textContent = "Extrayendo frames del video...";
  setProgress(0, `Extrayendo frames (0 / ${estimated})`);

  let count = 0;
  for (let t = 0; t <= video.duration + 1e-6; t += interval) {
    await captureFrameAt(t);
    count++;
    setProgress((count / estimated) * 100, `Extrayendo frames (${count} / ${estimated})`);
    // prevenir bucle infinito
    if (count > estimated + 3) break;
  }

  statusText.textContent = `Video procesado: ${frames.length} frames ✅`;
}

// captura frame en tiempo dado (usa seeked con once)
function captureFrameAt(time) {
  return new Promise(resolve => {
    const handler = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // si falla drawImage, intentamos igualmente toDataURL (puede producir imagen vacía)
      }
      frames.push(canvas.toDataURL("image/png"));
      resolve();
    };
    video.addEventListener("seeked", handler, { once: true });
    try {
      video.currentTime = Math.min(time, Math.max(0, video.duration));
    } catch (e) {
      video.removeEventListener("seeked", handler);
      resolve();
    }
  });
}

// --- extracción desde GIF (mantiene transparencia y compone frames) ---
async function extractFromGIF() {
  statusText.textContent = "Procesando GIF (manteniendo transparencia)...";
  setProgress(0, "Decodificando GIF...");

  const gif = gifuct.parseGIF(gifBuffer);
  const decoded = gifuct.decompressFrames(gif, true);
  if (!decoded || decoded.length === 0) {
    alert("No se pudieron decodificar los frames del GIF");
    statusText.textContent = "Error: no se pudo decodificar el GIF";
    return;
  }

  // ancho/alto del GIF
  const width = (gif.lsd && gif.lsd.width) ? gif.lsd.width : (decoded[0].dims && decoded[0].dims.width) ? decoded[0].dims.width : canvas.width || 1;
  const height = (gif.lsd && gif.lsd.height) ? gif.lsd.height : (decoded[0].dims && decoded[0].dims.height) ? decoded[0].dims.height : canvas.height || 1;

  canvas.width = width;
  canvas.height = height;

  frames = [];
  // buffer RGBA completo
  let fullImageData = ctx.createImageData(width, height);

  function clearRectInImageData(imgData, left, top, w, h) {
    const W = imgData.width;
    const data = imgData.data;
    for (let yy = 0; yy < h; yy++) {
      const destRow = (top + yy) * W;
      for (let xx = 0; xx < w; xx++) {
        const idx = (destRow + (left + xx)) * 4;
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
      }
    }
  }

  function compositePatchIntoFull(imgData, patch, dims) {
    const W = imgData.width;
    const data = imgData.data;
    const { left, top, width: w, height: h } = dims;
    let pIndex = 0;
    for (let yy = 0; yy < h; yy++) {
      const destRow = (top + yy) * W;
      for (let xx = 0; xx < w; xx++) {
        const destIdx = (destRow + (left + xx)) * 4;
        data[destIdx] = patch[pIndex++];     // r
        data[destIdx + 1] = patch[pIndex++]; // g
        data[destIdx + 2] = patch[pIndex++]; // b
        data[destIdx + 3] = patch[pIndex++]; // a
      }
    }
  }

  let prevFrame = null;
  const total = decoded.length;
  for (let i = 0; i < decoded.length; i++) {
    const frame = decoded[i];

    // disposalType === 2 -> restore to background (clear la región del prevFrame)
    if (prevFrame && prevFrame.disposalType === 2) {
      const pd = prevFrame.dims;
      clearRectInImageData(fullImageData, pd.left, pd.top, pd.width, pd.height);
    }

    if (frame.patch && frame.dims) {
      compositePatchIntoFull(fullImageData, frame.patch, frame.dims);
    }

    // poner el fullImageData al canvas y capturar png
    ctx.putImageData(fullImageData, 0, 0);
    frames.push(canvas.toDataURL("image/png"));

    prevFrame = frame;
    setProgress(((i + 1) / total) * 100, `Procesando GIF (${i + 1} / ${total})`);
    // Pequeña pausa para mantener UI responsiva
    await new Promise(r => setTimeout(r, 0));
  }

  statusText.textContent = `GIF procesado: ${frames.length} frames ✅`;
}

// ********** vista previa **********
function buildPreview() {
  resultPanel.innerHTML = "";
  const container = document.createElement("div");
  container.className = "preview-container";

  const title = document.createElement("div");
  title.className = "preview-title";
  title.textContent = videoName;

  const strip = document.createElement("div");
  strip.className = "preview-strip-wrapper";

  frames.forEach(imgSrc => {
    const img = document.createElement("img");
    img.src = imgSrc;
    strip.appendChild(img);
  });

  const label = document.createElement("div");
  label.className = "preview-label";
  label.textContent = `${frames.length} frames`;

  container.appendChild(title);
  container.appendChild(strip);
  container.appendChild(label);
  resultPanel.appendChild(container);
}

// ********** generar ZIP (frames individuales) **********
downloadBtn.addEventListener("click", () => {
  if (!frames || frames.length === 0) {
    alert("No hay frames para descargar. Extrae primero.");
    return;
  }
  createZipFromFrames();
});

async function createZipFromFrames() {
  setProgress(0, "Generando ZIP de frames...");
  const zip = new JSZip();
  const folder = zip.folder(videoName);

  for (let i = 0; i < frames.length; i++) {
    const dataURL = frames[i];
    const base64Data = dataURL.split(",")[1];
    const fileName = `${videoName}_${padNumber(i)}.png`;
    folder.file(fileName, base64Data, { base64: true });
    setProgress(((i + 1) / frames.length) * 100, `Agregando frames al ZIP (${i + 1} / ${frames.length})`);
    await new Promise(r => setTimeout(r, 0));
  }

  setProgress(95, "Comprimiendo ZIP...");
  const content = await zip.generateAsync({ type: "blob" }, metadata => {
    // metadata.percent puede ser usado para progreso más fino
    // pero lo usamos solo para visual feedback
    const p = metadata.percent || 0;
    setProgress(5 + (p * 0.9), `Comprimiendo ZIP ${Math.round(p)}%`);
  });

  saveAs(content, `${videoName}.zip`);
  setProgress(100, "ZIP listo ✅");
  statusText.textContent = "ZIP con frames descargado";
}

// ********** generar spritesheet HORIZONTAL (y descargar) **********
spritesheetBtn.addEventListener("click", async () => {
  if (!frames || frames.length === 0) {
    alert("No hay frames. Extrae primero para poder crear el spritesheet.");
    return;
  }
  setProgress(0, "Iniciando generación de spritesheet...");
  try {
    await generateSpritesheetHorizontal();
  } catch (err) {
    // Si falla, mostrar error y mantener disponible solo el ZIP
    console.error("Error generando spritesheet:", err);
    statusText.textContent = `Error: no se pudo generar spritesheet (se mantendrá el ZIP de frames). Revisa consola.`;
    setProgress(0, "Error al crear spritesheet — ZIP de frames disponible");
    alert("Error creando spritesheet: " + (err && err.message ? err.message : err));
    return;
  }
});

async function generateSpritesheetHorizontal() {
  // cargar primer frame para obtener dimensiones
  const firstImg = await loadImg(frames[0]);
  const fw = firstImg.width;
  const fh = firstImg.height;
  const count = frames.length;
  const targetWidth = fw * count;
  const targetHeight = fh;

  // Validación preventiva: comparar con limites razonables
  if (targetWidth > MAX_CANVAS_DIM || targetHeight > MAX_CANVAS_DIM) {
    throw new Error(`Dimensiones del spritesheet demasiado grandes: ${targetWidth}x${targetHeight} (máx ${MAX_CANVAS_DIM}).`);
  }

  // Intenta crear canvas temporal para el spritesheet
  let sheetCanvas;
  let sheetCtx;
  try {
    sheetCanvas = document.createElement("canvas");
    sheetCanvas.width = targetWidth;
    sheetCanvas.height = targetHeight;
    sheetCtx = sheetCanvas.getContext("2d");

    if (!sheetCtx) throw new Error("No se pudo obtener contexto del canvas para spritesheet.");
  } catch (err) {
    // cualquier fallo aquí se trata como "error de canvas"
    throw new Error("Fallo al crear canvas para spritesheet: " + (err.message || err));
  }

  // Dibujar cada frame en su posición, actualizando progreso
  for (let i = 0; i < count; i++) {
    const img = await loadImg(frames[i]);
    try {
      sheetCtx.drawImage(img, i * fw, 0, fw, fh);
    } catch (err) {
      // error al dibujar -> abortar
      throw new Error("Error al dibujar frame en spritesheet: " + (err.message || err));
    }
    setProgress(((i + 1) / count) * 100, `Generando spritesheet (${i + 1} / ${count})`);
    // ligera pausa para que la UI refresque
    await new Promise(r => setTimeout(r, 0));
  }

  // convertir a blob y descargar
  setProgress(90, "Exportando spritesheet...");
  const blob = await new Promise((res, rej) => {
    sheetCanvas.toBlob(b => {
      if (b) res(b);
      else rej(new Error("toBlob devolvió null"));
    }, "image/png");
  });

  // Forzar descarga del spritesheet
  const fileName = `${videoName}_spritesheet.png`;
  saveAs(blob, fileName);

  statusText.textContent = `Spritesheet generado: ${fileName}`;
  setProgress(100, "Spritesheet listo ✅");
}

// hola amigos oslsndbalvzbw

/* // VidToSheet.js (versión revisada)
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const fileInput = document.getElementById("fileInput");
const fpsInput = document.getElementById("fpsInput");
const extractBtn = document.getElementById("extractBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusText = document.getElementById("status-text");
const resultPanel = document.getElementById("result-panel");

let frames = [];
let videoName = "VidToSheet";
let isGIF = false;
let gifBuffer = null;

// Formato 0000
function padNumber(num) {
  return num.toString().padStart(4, "0");
}

// Util: espera evento una sola vez
function waitForEvent(target, eventName) {
  return new Promise(resolve => {
    const handler = e => {
      target.removeEventListener(eventName, handler);
      resolve(e);
    };
    target.addEventListener(eventName, handler);
  });
}

// Cargar archivo
fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  videoName = file.name.replace(/\.[^/.]+$/, "");
  resultPanel.innerHTML = "";
  downloadBtn.disabled = true;
  frames = [];

  const ext = file.name.split(".").pop().toLowerCase();
  isGIF = ext === "gif";

  if (isGIF) {
    statusText.textContent = `GIF cargado: ${file.name}`;
    const reader = new FileReader();
    reader.onload = (ev) => {
      gifBuffer = ev.target.result; // ArrayBuffer
      video.style.display = "none";
    };
    reader.readAsArrayBuffer(file);
  } else {
    // video
    const url = URL.createObjectURL(file);
    video.src = url;
    video.style.display = "block";
    statusText.textContent = `Video cargado: ${file.name} — esperando metadatos...`;
    // Espera metadata por si el usuario carga el archivo e intenta extraer rápido
    if (video.readyState < 1) {
      await waitForEvent(video, "loadedmetadata");
    }
    statusText.textContent = `Video listo: ${file.name}`;
  }
});

// Extraer frames
extractBtn.addEventListener("click", async () => {
  if (isGIF && gifBuffer) {
    await extractFromGIF();
  } else if (video.src) {
    // asegurar metadata
    if (video.readyState < 1) {
      statusText.textContent = "Esperando metadatos del video...";
      await waitForEvent(video, "loadedmetadata");
    }
    await extractFromVideo();
  } else {
    alert("Carga un video o GIF primero");
    return;
  }

  buildPreview();
  downloadBtn.disabled = false;
});

// --- VIDEO ---
async function extractFromVideo() {
  frames = [];
  const fps = Math.max(1, parseInt(fpsInput.value) || 1);
  const interval = 1 / fps;

  // asegurar dimensiones válidas
  canvas.width = video.videoWidth || 1;
  canvas.height = video.videoHeight || 1;

  statusText.textContent = "Extrayendo frames del video...";

  // itera por tiempo; usar <= para incluir final si aplica
  for (let t = 0; t <= video.duration; t += interval) {
    await captureFrameAt(t);
  }

  statusText.textContent = `Video procesado: ${frames.length} frames ✅`;
}

function captureFrameAt(time) {
  return new Promise(resolve => {
    // Agregar listener una sola vez para evitar duplicados
    const handler = () => {
      // limpiar canvas y dibujar
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // drawImage puede fallar si el frame no está listo; aun así usamos toDataURL fallback
      }
      frames.push(canvas.toDataURL("image/png"));
      resolve();
    };
    video.addEventListener("seeked", handler, { once: true });
    // forzar el seek
    try {
      video.currentTime = Math.min(time, Math.max(0, video.duration));
    } catch (e) {
      // algunos navegadores lanzan si el time es inválido; en ese caso resolvemos
      video.removeEventListener("seeked", handler);
      resolve();
    }
  });
}

// --- GIF ---
async function extractFromGIF() {
  statusText.textContent = "Procesando GIF (manteniendo transparencia)...";

  const gif = gifuct.parseGIF(gifBuffer);
  const decoded = gifuct.decompressFrames(gif, true); // true -> buildPatch
  if (!decoded || decoded.length === 0) {
    alert("No se pudieron decodificar los frames del GIF");
    statusText.textContent = "Error: no se pudo decodificar el GIF";
    return;
  }

  // Determinar ancho/alto del canvas GIF: preferir lsd, fallback a dims del primer frame
  const width = (gif.lsd && gif.lsd.width) ? gif.lsd.width : (decoded[0].dims && decoded[0].dims.width) ? decoded[0].dims.width : canvas.width || 1;
  const height = (gif.lsd && gif.lsd.height) ? gif.lsd.height : (decoded[0].dims && decoded[0].dims.height) ? decoded[0].dims.height : canvas.height || 1;

  canvas.width = width;
  canvas.height = height;

  frames = [];

  // buffer que mantiene la composición completa (RGBA)
  let fullImageData = ctx.createImageData(width, height);
  // inicialmente transparente (ya viene con zeros)

  // función helper: limpiar rect en fullImageData (restaurar a fondo transparente)
  function clearRectInImageData(imgData, left, top, w, h) {
    const W = imgData.width;
    const data = imgData.data;
    for (let yy = 0; yy < h; yy++) {
      const destRow = (top + yy) * W;
      const srcRow = yy * w;
      for (let xx = 0; xx < w; xx++) {
        const idx = (destRow + (left + xx)) * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }
  }

  // helper: copiar patch (frame.patch) en fullImageData en la región dims
  function compositePatchIntoFull(imgData, patch, dims) {
    const W = imgData.width;
    const data = imgData.data;
    const { left, top, width: w, height: h } = dims;
    // patch es Uint8Array o Array con length = w*h*4
    let pIndex = 0;
    for (let yy = 0; yy < h; yy++) {
      const destRow = (top + yy) * W;
      for (let xx = 0; xx < w; xx++) {
        const destIdx = (destRow + (left + xx)) * 4;
        data[destIdx] = patch[pIndex++];     // r
        data[destIdx + 1] = patch[pIndex++]; // g
        data[destIdx + 2] = patch[pIndex++]; // b
        data[destIdx + 3] = patch[pIndex++]; // a
      }
    }
  }

  let prevFrame = null;

  for (let i = 0; i < decoded.length; i++) {
    const frame = decoded[i];

    // manejo básico de disposal: si el frame previo pedía "restore to background", borramos su región
    if (prevFrame && prevFrame.disposalType === 2) {
      const pd = prevFrame.dims;
      clearRectInImageData(fullImageData, pd.left, pd.top, pd.width, pd.height);
    }

    // composite patch del frame actual en el fullImageData
    if (frame.patch && frame.dims) {
      compositePatchIntoFull(fullImageData, frame.patch, frame.dims);
    } else {
      // si no hay patch, intentar crear ImageData directo (fallback)
      try {
        const w = frame.dims.width, h = frame.dims.height;
        const imgData = new ImageData(new Uint8ClampedArray(frame.patch), w, h);
        ctx.putImageData(imgData, frame.dims.left, frame.dims.top);
        frames.push(canvas.toDataURL("image/png"));
        prevFrame = frame;
        continue;
      } catch (e) {
        // nada
      }
    }

    // Volcar fullImageData al canvas para capturar PNG con transparencia correcta
    ctx.putImageData(fullImageData, 0, 0);
    frames.push(canvas.toDataURL("image/png"));

    prevFrame = frame;
  }

  statusText.textContent = `GIF procesado: ${frames.length} frames ✅`;
}

// Construir vista previa
function buildPreview() {
  resultPanel.innerHTML = "";
  const container = document.createElement("div");
  container.className = "preview-container";

  const title = document.createElement("div");
  title.className = "preview-title";
  title.textContent = videoName;

  const strip = document.createElement("div");
  strip.className = "preview-strip-wrapper";

  frames.forEach(imgSrc => {
    const img = document.createElement("img");
    img.src = imgSrc;
    strip.appendChild(img);
  });

  const label = document.createElement("div");
  label.className = "preview-label";
  label.textContent = `${frames.length} frames`;

  container.appendChild(title);
  container.appendChild(strip);
  container.appendChild(label);
  resultPanel.appendChild(container);
}

// Descargar ZIP
downloadBtn.addEventListener("click", () => {
  const zip = new JSZip();
  const folder = zip.folder(videoName);

  frames.forEach((dataURL, i) => {
    const base64Data = dataURL.split(",")[1];
    const fileName = `${videoName}_${padNumber(i)}.png`;
    folder.file(fileName, base64Data, { base64: true });
  });

  zip.generateAsync({ type: "blob" }).then(content => {
    saveAs(content, `${videoName}.zip`);
  });
}); */