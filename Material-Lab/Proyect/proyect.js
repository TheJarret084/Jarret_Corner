const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultadosCont = document.getElementById("resultados");
const previewGif = document.getElementById("previewGif");
const btnGenerar = document.getElementById("generar");
const btnDescargar = document.getElementById("descargar");

let framesArray = [];
let gifBlob = null;

// Cargar worker directamente del CDN (no usar Blob URL)
const GIF_WORKER_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js";

// --- Utilidades básicas ---
function loadImage(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function drawMovingImage(img, dir, behaviour, frame, total) {
  const p = total <= 1 ? 1 : frame / (total - 1);
  let x = (canvas.width - img.width) / 2;
  let y = (canvas.height - img.height) / 2;
  const dx = canvas.width - img.width;
  const dy = canvas.height - img.height;

  const move = {
    down: () => (y = -img.height + (dy + img.height) * p),
    up: () => (y = canvas.height - (dy + img.height) * p),
    left: () => (x = canvas.width - (dx + img.width) * p),
    right: () => (x = -img.width + (dx + img.width) * p),
    "down-right": () => {
      x = -img.width + (dx + img.width) * p;
      y = -img.height + (dy + img.height) * p;
    },
    "down-left": () => {
      x = canvas.width - (dx + img.width) * p;
      y = -img.height + (dy + img.height) * p;
    },
    "up-right": () => {
      x = -img.width + (dx + img.width) * p;
      y = canvas.height - (dy + img.height) * p;
    },
    "up-left": () => {
      x = canvas.width - (dx + img.width) * p;
      y = canvas.height - (dy + img.height) * p;
    },
  };
  move[dir]?.();
  ctx.drawImage(img, x, y);
}

function mostrarResultados(frames) {
  resultadosCont.innerHTML = "";
  frames.forEach(f => {
    const thumb = new Image();
    thumb.src = f.dataURL;
    thumb.title = f.name;
    resultadosCont.appendChild(thumb);
  });
}

function generarGIF(frames, delay = 100) {
  return new Promise((resolve, reject) => {
    if (!frames.length) return reject("No hay frames");
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: GIF_WORKER_SCRIPT,
    });

    const ordenados = [...frames].sort((a, b) => a.name.localeCompare(b.name));
    let loaded = 0;

    ordenados.forEach(f => {
      const img = new Image();
      img.onload = () => {
        const temp = document.createElement("canvas");
        temp.width = canvas.width;
        temp.height = canvas.height;
        const tctx = temp.getContext("2d");
        tctx.clearRect(0, 0, temp.width, temp.height);
        tctx.drawImage(img, 0, 0);
        gif.addFrame(tctx, { delay, copy: true });
        loaded++;
        if (loaded === ordenados.length) {
          gif.on("finished", blob => resolve(blob));
          gif.on("error", reject);
          gif.render();
        }
      };
      img.onerror = reject;
      img.src = f.dataURL;
    });
  });
}

async function descargarZip(frames, baseName) {
  const zip = new JSZip();
  const ordenados = [...frames].sort((a, b) => a.name.localeCompare(b.name));
  ordenados.forEach((f, i) => {
    const base64 = f.dataURL.split(",")[1];
    zip.file(`${baseName}_${i.toString().padStart(4, "0")}.png`, base64, { base64: true });
  });
  if (gifBlob) zip.file("animacion.gif", gifBlob);
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}_frames.zip`;
  a.click();
}

// --- EVENTO PRINCIPAL ---
btnGenerar.addEventListener("click", async () => {
  try {
    btnGenerar.disabled = true;
    btnDescargar.disabled = true;
    resultadosCont.innerHTML = "";
    previewGif.src = "";
    framesArray = [];
    gifBlob = null;

    const file1 = document.getElementById("img1").files[0];
    const file2 = document.getElementById("img2").files[0];
    const dir1 = document.getElementById("dir1").value;
    const dir2 = document.getElementById("dir2").value;
    const beh1 = document.getElementById("beh1").value;
    const beh2 = document.getElementById("beh2").value;
    const totalFrames = Math.max(2, parseInt(document.getElementById("frames").value || "20"));

    if (!file1) return alert("Carga al menos la imagen 1");

    const img1 = await loadImage(file1);
    const img2 = file2 ? await loadImage(file2) : null;

    canvas.width = img1.width;
    canvas.height = img1.height;

    // Crear frames
    for (let f = 0; f < totalFrames; f++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawMovingImage(img1, dir1, beh1, f, totalFrames);
      if (img2 && dir2 !== "none") drawMovingImage(img2, dir2, beh2, f, totalFrames);
      const dataURL = canvas.toDataURL("image/png");
      framesArray.push({ name: f.toString().padStart(4, "0"), dataURL });
    }

    mostrarResultados(framesArray);

    // Intentar crear GIF (opcional)
    try {
      gifBlob = await generarGIF(framesArray, 100);
      previewGif.src = URL.createObjectURL(gifBlob);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(gifBlob);
      link.download = "animacion.gif";
      link.textContent = "Descargar GIF (opcional)";
      link.className = "gifBtn";
      document.querySelector(".preview-container").appendChild(link);
    } catch (err) {
      console.warn("No se generó el GIF:", err);
    }
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  } finally {
    btnGenerar.disabled = false;
    btnDescargar.disabled = false;
  }
});

btnDescargar.addEventListener("click", async () => {
  if (!framesArray.length) return alert("Genera primero los frames");
  const file1 = document.getElementById("img1").files[0];
  const baseName = file1 ? file1.name.replace(/\.[^/.]+$/, "") : "frames";
  await descargarZip(framesArray, baseName);
});