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

// Crear barra de progreso visual
const progressBar = document.createElement("progress");
progressBar.id = "progressBar";
progressBar.max = 100;
progressBar.value = 0;
progressBar.style.width = "100%";
progressBar.style.display = "none";
statusText.insertAdjacentElement("afterend", progressBar);

// Función para formatear nombres (0000)
function padNumber(num) {
  return num.toString().padStart(4, "0");
}

// Actualizar progreso (visual + texto)
function updateProgress(current, total) {
  const percent = Math.floor((current / total) * 100);
  progressBar.value = percent;
  progressBar.style.display = "block";
  statusText.textContent = `Progreso: ${percent}% (${current}/${total})`;
  if (percent >= 100) {
    setTimeout(() => (progressBar.style.display = "none"), 800);
  }
}

// Cargar archivo
fileInput.addEventListener("change", e => {
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
    reader.onload = e => {
      gifBuffer = e.target.result;
      video.style.display = "none";
    };
    reader.readAsArrayBuffer(file);
  } else {
    const url = URL.createObjectURL(file);
    video.src = url;
    video.style.display = "block";
    statusText.textContent = `Video cargado: ${file.name}`;
  }
});

// Extraer frames
extractBtn.addEventListener("click", async () => {
  try {
    frames = [];
    downloadBtn.disabled = true;
    progressBar.value = 0;

    if (isGIF && gifBuffer) {
      await extractFromGIF();
    } else if (video.src) {
      await extractFromVideo();
    } else {
      alert("Carga un video o GIF primero");
      return;
    }

    buildPreview();

    try {
      await buildSpriteSheet();
      statusText.textContent = "✅ Procesamiento completo (ZIP + Spritesheet listo)";
    } catch (err) {
      console.warn("⚠️ Falló la creación del spritesheet:", err);
      statusText.textContent = "⚠️ Spritesheet falló, pero ZIP listo";
    }

    downloadBtn.disabled = false;
  } catch (err) {
    console.error("Error general:", err);
    alert("⚠️ Error inesperado. Solo se generará el ZIP de frames.");
    buildPreview();
    downloadBtn.disabled = false;
  }
});

// Extraer desde video
async function extractFromVideo() {
  const fps = parseInt(fpsInput.value) || 1;
  const interval = 1 / fps;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  statusText.textContent = "Extrayendo frames del video...";

  const totalFrames = Math.floor(video.duration * fps);
  let count = 0;

  for (let t = 0; t < video.duration; t += interval) {
    await captureFrameAt(t);
    count++;
    updateProgress(count, totalFrames);
  }

  statusText.textContent = `🎞 Video procesado: ${frames.length} frames`;
}

function captureFrameAt(time) {
  return new Promise(resolve => {
    video.currentTime = time;
    video.addEventListener("seeked", function handler() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/png"));
      video.removeEventListener("seeked", handler);
      resolve();
    });
  });
}

// Extraer desde GIF (mantiene transparencia)
async function extractFromGIF() {
  statusText.textContent = "Procesando GIF...";
  const gif = GIF.parseGIF(gifBuffer);
  const decoded = GIF.decompressFrames(gif, true);

  const width = gif.lsd.width;
  const height = gif.lsd.height;
  canvas.width = width;
  canvas.height = height;

  frames = [];

  for (let i = 0; i < decoded.length; i++) {
    const frame = decoded[i];
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(frame.patch);
    ctx.putImageData(imageData, 0, 0);
    frames.push(canvas.toDataURL("image/png"));
    updateProgress(i + 1, decoded.length);
    await new Promise(r => setTimeout(r)); // refrescar UI
  }

  statusText.textContent = `GIF procesado: ${frames.length} frames ✅`;
}

// Crear vista previa
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

// Construir spritesheet horizontal
async function buildSpriteSheet() {
  statusText.textContent = "🧩 Creando spritesheet...";
  const imgObjs = await Promise.all(frames.map(loadImage));

  const frameWidth = imgObjs[0].width;
  const frameHeight = imgObjs[0].height;

  const sheetCanvas = document.createElement("canvas");
  sheetCanvas.width = frameWidth * imgObjs.length;
  sheetCanvas.height = frameHeight;
  const sheetCtx = sheetCanvas.getContext("2d");

  imgObjs.forEach((img, i) => {
    sheetCtx.drawImage(img, i * frameWidth, 0);
  });

  const spriteData = sheetCanvas.toDataURL("image/png");

  const spriteImg = document.createElement("img");
  spriteImg.src = spriteData;
  spriteImg.style.maxWidth = "100%";
  spriteImg.style.marginTop = "10px";
  spriteImg.style.border = "2px solid #666";
  resultPanel.appendChild(spriteImg);

  const link = document.createElement("a");
  link.href = spriteData;
  link.download = `${videoName}_sheet.png`;
  link.textContent = "⬇️ Descargar Spritesheet";
  link.className = "btn";
  resultPanel.appendChild(link);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
});