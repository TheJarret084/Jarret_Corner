// index.js - cliente (funciona con el index.html suministrado)
// Guarda este archivo en la misma carpeta que index.html

const fileInput = document.getElementById("fileInput");
const generateBtn = document.getElementById("generateBtn");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const downloadLink = document.getElementById("downloadLink");

// Tamaño de salida definitivo (igual al que pediste antes)
const OUT_W = 800;
const OUT_H = 720;

// Ajusta el canvas visible al tamaño de salida
canvas.width = OUT_W;
canvas.height = OUT_H;

/**
 * Crea una Image desde un File (File -> HTMLImageElement)
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("Error cargando la imagen"));
    };
    img.src = url;
  });
}

/**
 * Dibuja una puerta con una ligera transform (escala + skew) para simular perspectiva.
 * col: -1 = izquierda, 0 = centro, 1 = derecha
 */
function drawDoorWithTransform(ctx, img, centerX, baseY, depthIndex, rows, col) {
  // parámetros que controlan la sensación de profundidad
  const depthFactor = 0.12; // cuánto reduce la escala por paso
  const verticalSpacing = 54; // separación vertical entre filas
  const baseScale = 1.0;
  const scale = baseScale * (1 - depthIndex * depthFactor);
  if (scale <= 0.03) return; // demasiado pequeño, ignora

  // posición horizontal por columna
  const colSpacing = 240; // separación horizontal entre columnas (ajustable)
  const offsetX = col * colSpacing;

  const w = Math.max(6, Math.round(img.width * scale));
  const h = Math.max(6, Math.round(img.height * scale));

  const x = Math.round(centerX - w / 2 + offsetX * (1 - depthIndex / rows));
  const y = Math.round(baseY - depthIndex * verticalSpacing);

  // shear (inclinación) según la columna y profundidad
  const maxShear = 0.25; // cuánto se inclina como máximo
  const shear = (col * 0.25) * (depthIndex / rows); // cambia con la profundidad

  // transformación aproximada: [a c e]
  //                          [b d f]
  // a = scale, d = scale, c = shearX, b = shearY (usamos shear en c)
  ctx.save();
  // mover origen a la esquina donde dibujaremos
  ctx.translate(x, y);
  // aplicar transform: scale + skew en X (c)
  ctx.transform(scale, 0, shear, scale, 0, 0);
  // dibujar con la esquina en (0,0)
  ctx.drawImage(img, -img.width / 2, -img.height); // centramos la imagen en el punto
  ctx.restore();
}

/**
 * Función principal que genera el bg en el canvas OUT_W x OUT_H
 */
async function generateBackgroundFromFile(file) {
  try {
    const img = await loadImageFromFile(file);

    // Limpiar fondo y pintar base
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    // fondo general
    const baseGradient = ctx.createLinearGradient(0, 0, 0, OUT_H);
    baseGradient.addColorStop(0, "#AAAAAA");
    baseGradient.addColorStop(1, "#222222");
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    // parámetros de repetición (ajustables)
    const rows = 18;             // cuántas filas de puertas (profundidad)
    const centerX = OUT_W / 2;  // centro
    const baseY = OUT_H - 40;   // la base donde empiezan las puertas

    // Dibujo de barreras laterales (blancas) para imitar el shader original
    ctx.fillStyle = "rgba(255,255,255,1)";
    // izquierda
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(120, 0);
    ctx.lineTo(120, OUT_H);
    ctx.lineTo(0, OUT_H);
    ctx.closePath();
    ctx.fill();
    // derecha
    ctx.beginPath();
    ctx.moveTo(OUT_W - 120, 0);
    ctx.lineTo(OUT_W, 0);
    ctx.lineTo(OUT_W, OUT_H);
    ctx.lineTo(OUT_W - 120, OUT_H);
    ctx.closePath();
    ctx.fill();

    // Dibuja las puertas por profundidad (de más lejanas a más cercanas)
    // columnas: -1 (izq), 0 (centro), 1 (der)
    for (let depth = rows - 1; depth >= 0; depth--) {
      // center column
      drawDoorWithTransform(ctx, img, centerX, baseY, depth, rows, 0);

      // left column
      drawDoorWithTransform(ctx, img, centerX, baseY, depth, rows, -1);

      // right column
      drawDoorWithTransform(ctx, img, centerX, baseY, depth, rows, 1);
    }

    // Añadir cameos lejanos: simples rectángulos semitransparentes (simula sprites lejanos)
    const cameos = [
      { z: 12000, color: "rgba(255,200,200,0.6)" },
      { z: 19000, color: "rgba(200,255,200,0.6)" },
      { z: 21000, color: "rgba(200,200,255,0.6)" },
      { z: 12000, color: "rgba(255,230,200,0.6)" }
    ];
    for (let i = 0; i < cameos.length; i++) {
      const c = cameos[i];
      const cz = i === 0 ? 12000 : (i === 1 ? 19000 : (i === 2 ? 21000 : 12000));
      const factor = 1 - Math.min(0.9, cz / 25000);
      const w = 360 * factor;
      const h = 240 * factor;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = cameos[i].color;
      const px = (i % 2 === 0) ? OUT_W * 0.25 : OUT_W * 0.75;
      ctx.fillRect(px - w / 2, OUT_H * 0.15 - h / 2, w, h);
      ctx.globalAlpha = 1;
    }

    // Vignette ligero
    const vg = ctx.createRadialGradient(OUT_W / 2, OUT_H / 2 + 60, 50, OUT_W / 2, OUT_H / 2 + 60, Math.max(OUT_W, OUT_H));
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    // Preparar enlace de descarga
    const dataURL = canvas.toDataURL("image/png");
    downloadLink.href = dataURL;
    downloadLink.style.display = "inline-block";
    downloadLink.textContent = "⬇️ Descargar bg.png";
    downloadLink.download = "bg.png";
  } catch (err) {
    console.error(err);
    alert("Error al generar el fondo: " + err.message);
  }
}

// Evento del botón
generateBtn.addEventListener("click", async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    alert("Selecciona primero una imagen (doorway.png).");
    return;
  }

  // validación simple: aceptar imágenes
  if (!file.type.startsWith("image/")) {
    alert("El archivo seleccionado no parece ser una imagen.");
    return;
  }

  // Generar el fondo
  generateBackgroundFromFile(file);
});