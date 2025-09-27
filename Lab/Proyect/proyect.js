const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let framesArray = [];

// === cargar imagen desde file ===
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

// === generar frames ===
document.getElementById("generar").addEventListener("click", async () => {
  const file1 = document.getElementById("img1").files[0];
  const file2 = document.getElementById("img2").files[0];
  const dir1 = document.getElementById("dir1").value;
  const dir2 = document.getElementById("dir2").value;
  const beh1 = document.getElementById("beh1").value;
  const beh2 = document.getElementById("beh2").value;
  const totalFrames = parseInt(document.getElementById("frames").value);

  if (!file1) {
    alert("Carga al menos la imagen 1");
    return;
  }

  const img1 = await loadImage(file1);
  const img2 = file2 ? await loadImage(file2) : null;

  framesArray = [];

  for (let f = 0; f < totalFrames; f++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawMovingImage(img1, dir1, beh1, f, totalFrames);
    if (img2 && dir2 !== "none") {
      drawMovingImage(img2, dir2, beh2, f, totalFrames);
    }

    const dataURL = canvas.toDataURL("image/png");
    framesArray.push({ name: `subimagen${f.toString().padStart(4,"0")}`, dataURL });
  }

  mostrarResultados(framesArray);
});

// === dibujar imagen en canvas ===
function drawMovingImage(img, dir, behaviour, frame, total) {
  const progress = frame / (total - 1);
  let x = (canvas.width - img.width)/2;
  let y = (canvas.height - img.height)/2;

  if (behaviour === "stopCenter") {
    switch(dir) {
      case "down": y = -img.height + ((canvas.height - img.height)/2 + img.height)*progress; break;
      case "up": y = canvas.height - ((canvas.height - img.height)/2 + img.height)*progress; break;
      case "left": x = canvas.width - ((canvas.width - img.width)/2 + img.width)*progress; break;
      case "right": x = -img.width + ((canvas.width - img.width)/2 + img.width)*progress; break;
    }
  } else if (behaviour === "passThrough") {
    switch(dir) {
      case "down": y = -img.height + (canvas.height + img.height)*progress; break;
      case "up": y = canvas.height - (canvas.height + img.height)*progress; break;
      case "left": x = canvas.width - (canvas.width + img.width)*progress; break;
      case "right": x = -img.width + (canvas.width + img.width)*progress; break;
    }
  }

  ctx.drawImage(img, x, y);
}

// === mostrar miniaturas ===
function mostrarResultados(frames) {
  const cont = document.getElementById("resultados");
  cont.innerHTML = "";
  frames.forEach(f => {
    const img = new Image();
    img.src = f.dataURL;
    img.title = f.name;
    cont.appendChild(img);
  });
}

// === descargar ZIP con nombres basados en la primera imagen ===
document.getElementById("descargar").addEventListener("click", async () => {
  const file1 = document.getElementById("img1").files[0];
  if (!framesArray.length || !file1) {
    return alert("Genera primero los frames y carga la imagen 1");
  }

  const baseName = file1.name.replace(/\.[^/.]+$/, ""); // elimina extensión
  const zip = new JSZip();

  framesArray.forEach((f, idx) => {
    const base64 = f.dataURL.split(",")[1];
    const frameName = `${baseName}_${idx.toString().padStart(4,"0")}.png`;
    zip.file(frameName, base64, { base64: true });
  });

  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = `${baseName}_frames.zip`;
  link.click();
});