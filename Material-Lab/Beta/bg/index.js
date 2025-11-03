const fileInput = document.getElementById("fileInput");
const generateBtn = document.getElementById("generateBtn");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const downloadLink = document.getElementById("downloadLink");

const OUT_W = 800;
const OUT_H = 720;
canvas.width = OUT_W;
canvas.height = OUT_H;

// ================================
// Cargar imagen doorway
// ================================
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ================================
// Dibuja una puerta en posición y escala correctas
// ================================
function drawDoor(ctx, img, centerX, baseY, depth, rows, col) {
  // Configura perspectiva realista
  const depthFactor = 0.08; // escala se reduce más suavemente
  const verticalSpacing = 36; // menos espacio entre filas
  const baseScale = 1.0 - depth * depthFactor; // reduce con la distancia
  if (baseScale <= 0.05) return;

  const scale = baseScale;
  const w = img.width * scale;
  const h = img.height * scale;

  // Separación horizontal
  const colSpacing = 180;
  const x = centerX + col * colSpacing * (1 - depth / rows);
  const y = baseY - depth * verticalSpacing;

  // ligera inclinación (perspectiva lateral)
  const shear = (-col * 0.15) * (depth / rows);

  ctx.save();
  ctx.translate(x, y);
  ctx.transform(scale, 0, shear, scale, 0, 0);
  ctx.drawImage(img, -img.width / 2, -img.height);
  ctx.restore();
}

// ================================
// Genera el fondo completo
// ================================
async function generateBackground(file) {
  try {
    const img = await loadImageFromFile(file);
    ctx.clearRect(0, 0, OUT_W, OUT_H);

    // Fondo base
    const bg = ctx.createLinearGradient(0, 0, 0, OUT_H);
    bg.addColorStop(0, "#888");
    bg.addColorStop(1, "#222");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    const rows = 22;
    const centerX = OUT_W / 2;
    const baseY = OUT_H - 60;

    // Dibuja en orden de profundidad (lejos → cerca)
    for (let d = rows - 1; d >= 0; d--) {
      drawDoor(ctx, img, centerX, baseY, d, rows, -1);
      drawDoor(ctx, img, centerX, baseY, d, rows, 0);
      drawDoor(ctx, img, centerX, baseY, d, rows, 1);
    }

    // Viñeta ligera
    const v = ctx.createRadialGradient(centerX, OUT_H / 2 + 60, 50, centerX, OUT_H / 2, 600);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    // Listo para descargar
    const data = canvas.toDataURL("image/png");
    downloadLink.href = data;
    downloadLink.download = "bg.png";
    downloadLink.style.display = "inline-block";
    downloadLink.textContent = "⬇️ Descargar bg.png";
  } catch (e) {
    console.error(e);
    alert("Error generando fondo: " + e.message);
  }
}

generateBtn.addEventListener("click", () => {
  const file = fileInput.files[0];
  if (!file) return alert("Selecciona doorway.png primero");
  generateBackground(file);
});