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

// Función para formatear números a 4 dígitos
function padNumber(num) {
  return num.toString().padStart(4, "0");
}

// Cargar video
fileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    video.src = url;
    videoName = file.name.replace(/\.[^/.]+$/, "");
    statusText.textContent = `Video cargado: ${file.name}`;
    resultPanel.innerHTML = "";
  }
});

// Extraer fotogramas
extractBtn.addEventListener("click", async () => {
  if (!video.src) {
    alert("Carga un video primero");
    return;
  }

  frames = [];
  resultPanel.innerHTML = "";
  downloadBtn.disabled = true;
  const fps = parseInt(fpsInput.value) || 1;
  const interval = 1 / fps;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  statusText.textContent = "Extrayendo fotogramas...";

  for (let t = 0; t < video.duration; t += interval) {
    await captureFrameAt(t);
  }

  // Crear panel de resultados
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
  downloadBtn.disabled = false;
  statusText.textContent = "Extracción completada ✅";
});

// Capturar un frame
function captureFrameAt(time) {
  return new Promise(resolve => {
    video.currentTime = time;
    video.addEventListener("seeked", function handler() {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/png"));
      video.removeEventListener("seeked", handler);
      resolve();
    });
  });
}

// Descargar ZIP con numeración 0000
downloadBtn.addEventListener("click", () => {
  const zip = new JSZip();
  const folder = zip.folder(videoName);

  frames.forEach((dataURL, i) => {
    const base64Data = dataURL.split(",")[1];
    const fileName = `${videoName}_${padNumber(i)}.png`; // Ej: MiVideo_0000.png
    folder.file(fileName, base64Data, { base64: true });
  });

  zip.generateAsync({ type: "blob" }).then(content => {
    saveAs(content, `${videoName}.zip`);
  });
});