const canvas = document.getElementById("lienzo");
const ctx = canvas.getContext("2d");

document.getElementById("generar").addEventListener("click", async () => {
  const file1 = document.getElementById("img1").files[0];
  const file2 = document.getElementById("img2").files[0];
  const dir1 = document.getElementById("dir1").value;
  const dir2 = document.getElementById("dir2").value;
  const totalFrames = parseInt(document.getElementById("frames").value);

  if (!file1) {
    alert("Carga al menos la imagen 1");
    return;
  }

  const img1 = await loadImage(file1);
  const img2 = file2 ? await loadImage(file2) : null;

  const framesArray = [];

  for (let f = 0; f < totalFrames; f++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // dibujar imagen 1
    drawMovingImage(img1, dir1, f, totalFrames);

    // dibujar imagen 2 si existe
    if (img2 && dir2 !== "none") {
      drawMovingImage(img2, dir2, f, totalFrames);
    }

    const dataURL = canvas.toDataURL("image/png");
    framesArray.push({ name: `subimagen${f.toString().padStart(4, "0")}`, dataURL });
  }

  mostrarResultados(framesArray);
});

// ==== Helpers ====
function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => resolve(img);
  });
}

function drawMovingImage(img, dir, frame, total) {
  const progress = frame / (total - 1);

  let x = (canvas.width - img.width) / 2;
  let y = (canvas.height - img.height) / 2;

  switch (dir) {
    case "down":
      y = -img.height + (canvas.height / 2 + img.height / 2) * progress;
      break;
    case "up":
      y = canvas.height - (canvas.height / 2 + img.height / 2) * progress;
      break;
    case "left":
      x = canvas.width - (canvas.width / 2 + img.width / 2) * progress;
      break;
    case "right":
      x = -img.width + (canvas.width / 2 + img.width / 2) * progress;
      break;
  }

  ctx.drawImage(img, x, y);
}

function mostrarResultados(framesArray) {
  const cont = document.getElementById("resultados");
  cont.innerHTML = "";
  framesArray.forEach(f => {
    const img = document.createElement("img");
    img.src = f.dataURL;
    img.alt = f.name;
    cont.appendChild(img);
  });
}