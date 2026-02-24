// index.js
// Generador de pasillo con puertas "infinitas" (fondo transparente).
// Uso: seleccionar doorway.png en el input y pulsar "Generar Fondo".
// Resultado: dibujo en canvas 800x720 y enlace de descarga a bg.png (con transparencia).

const fileInput = document.getElementById("fileInput");
const generateBtn = document.getElementById("generateBtn");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: true });
const downloadLink = document.getElementById("downloadLink");

// Salida fija (coincide con tu HTML)
const OUT_W = 800;
const OUT_H = 720;
canvas.width = OUT_W;
canvas.height = OUT_H;

/**
 * Carga un File (input) como HTMLImageElement.
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
 * Dibuja una puerta usando transform para simular perspectiva.
 * centerX, baseY = punto de referencia en pantalla.
 * zStep = índice de profundidad (0 = más cerca, aumenta hacia atrás).
 * maxDepth = cuántos pasos de profundidad se usan (controla 'infinitud').
 * colOffset = -1 (izq), 0 (centro), 1 (der).
 */
function drawDoorPerspective(ctx, img, centerX, baseY, zStep, maxDepth, colOffset) {
  // Parámetros de apariencia (ajústalos si hace falta)
  const DEPTH_SCALE = 0.085;       // cuánto se reduce la escala por paso de profundidad
  const VERTICAL_STEP = 40;        // píxels que sube cada paso en Y (simula altura)
  const BASE_SCALE = 1.0;          // escala de la puerta más cercana
  const COL_SPREAD = 200;          // separación horizontal entre columnas (cambia con z)
  const MIN_SCALE = 0.03;          // cuando el dibujo es más pequeño que esto lo ignoramos

  // calculamos escala en función de la profundidad (las más lejanas son más pequeñas)
  const scale = BASE_SCALE * Math.max(0, 1 - zStep * DEPTH_SCALE);
  if (scale < MIN_SCALE) return false; // indica que ya podemos parar

  // calcular posición
  // x: centramos y desplazamos según columna; la influencia de la columna disminuye con la profundidad
  const colFactor = (1 - zStep / maxDepth); // 1 cerca, 0 lejos
  const x = centerX + colOffset * COL_SPREAD * colFactor;
  // y sube con la profundidad, esto sitúa las puertas 'en el suelo'
  const y = baseY - zStep * VERTICAL_STEP;

  // ligera inclinación para mayor sensación de perspectiva
  const shear = -colOffset * 0.12 * (zStep / maxDepth);

  // Aplicamos transform: scale + skew
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(scale, 0, shear, scale, 0, 0);
  // dibujamos la imagen centrada horizontalmente y con su base en y
  ctx.drawImage(img, -img.width / 2, -img.height);
  ctx.restore();

  return true; // seguimos dibujando
}

/**
 * Dibuja el pasillo: columnas (izq, centro, der) y repite en profundidad hasta que se haga pequeño.
 * Mantiene fondo TRANSPARENTE (no pinta rectángulos de fondo).
 */
function drawCorridor(img) {
  // Limpia con transparencia
  ctx.clearRect(0, 0, OUT_W, OUT_H);

  // Opciones generales del pasillo
  const centerX = OUT_W / 2;
  const baseY = OUT_H - 30;   // distancia desde la base inferior donde se apoyan las puertas
  const maxDepth = 200;       // límite razonable para iterar; la función deja de dibujar cuando la escala es mínima

  // Para que el stacking sea correcto, dibujamos de atrás hacia adelante:
  // calculamos el z máximo real iterando hasta que drawDoorPerspective devuelva false
  // pero para performance dejamos un techo (maxDepth). Encontramos el índice donde termina.
  let effectiveMax = 0;
  for (let z = 0; z < maxDepth; z++) {
    // comprobamos con la columna central si debe seguir
    const willDraw = (function() {
      const DEPTH_SCALE = 0.085;
      const BASE_SCALE = 1.0;
      const scale = BASE_SCALE * Math.max(0, 1 - z * DEPTH_SCALE);
      return scale >= 0.03;
    })();
    if (!willDraw) { effectiveMax = z; break; }
    if (z === maxDepth - 1) effectiveMax = maxDepth;
  }

  // Dibujar de más lejano a más cercano
  for (let z = effectiveMax - 1; z >= 0; z--) {
    // columna izquierda
    drawDoorPerspective(ctx, img, centerX, baseY, z, effectiveMax, -1);
    // columna central
    drawDoorPerspective(ctx, img, centerX, baseY, z, effectiveMax, 0);
    // columna derecha
    drawDoorPerspective(ctx, img, centerX, baseY, z, effectiveMax, 1);
  }
}

/**
 * Genera el fondo (dibuja y prepara enlace de descarga con transparencia).
 */
async function generateBackgroundFromFile(file) {
  try {
    const img = await loadImageFromFile(file);

    // Ajuste automático: si la puerta es muy ancha, reducir la escala base en canvas
    // para que quepan las 3 columnas; esto ayuda con doorways grandes.
    const maxDoorWidth = OUT_W * 0.36; // ancho máximo deseado de una puerta cercana
    if (img.width > maxDoorWidth) {
      // escalamos la imagen en memoria (usamos un canvas temporal)
      const tmp = document.createElement("canvas");
      const tctx = tmp.getContext("2d");
      const scaleDown = maxDoorWidth / img.width;
      tmp.width = Math.round(img.width * scaleDown);
      tmp.height = Math.round(img.height * scaleDown);
      tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
      const scaledImg = new Image();
      scaledImg.src = tmp.toDataURL("image/png");
      await scaledImg.decode();
      // dibujar pasillo con imagen escalada
      drawCorridor(scaledImg);
    } else {
      drawCorridor(img);
    }

    // Preparar enlace de descarga (PNG con transparencia)
    const dataURL = canvas.toDataURL("image/png");
    downloadLink.href = dataURL;
    downloadLink.download = "bg.png";
    downloadLink.style.display = "inline-block";
    downloadLink.textContent = "⬇️ Descargar bg.png (transparente)";
  } catch (err) {
    console.error(err);
    alert("Error generando el pasillo: " + err.message);
  }
}

// Evento del botón
generateBtn.addEventListener("click", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    alert("Selecciona primero una imagen (doorway.png).");
    return;
  }
  if (!file.type.startsWith("image/")) {
    alert("Selecciona un archivo de imagen válido (PNG/JPG).");
    return;
  }
  generateBackgroundFromFile(file);
});