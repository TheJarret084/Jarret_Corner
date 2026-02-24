const fs = require("fs");

const RUTA = "data.json";
const BACKUP = "data.json.bak";

const INDICE_STRUMLINE = 3;
const NUEVO_VALOR = 0;

const IGNORAR_SI_PRESS = true;

function aplicarOnMissEvent(nota, nuevoValor) {
  if (!nota || typeof nota !== "object") return;
  if (!nota.props) nota.props = {};

  if (
    IGNORAR_SI_PRESS &&
    "onPressEvent" in nota.props &&
    nota.props.onPressEvent !== -1
  ) {
    return;
  }

  nota.props.onMissEvent = nuevoValor;
}

// FORMATO A: arrows[]
function recorrerFormatoConArrows(strum) {
  if (!Array.isArray(strum.arrows)) return false;
  strum.arrows.forEach(nota => aplicarOnMissEvent(nota, NUEVO_VALOR));
  return true;
}

// FORMATO B: [[ notas ]]
function recorrerFormatoAnidado(strum) {
  if (!Array.isArray(strum)) return false;
  strum.forEach(capa => {
    if (!Array.isArray(capa)) return;
    capa.forEach(nota => aplicarOnMissEvent(nota, NUEVO_VALOR));
  });
  return true;
}

// ✅ FORMATO C: OBJETO TIPO MAP { "0": {...}, "1": {...} }
function recorrerFormatoObjeto(strum) {
  if (typeof strum !== "object" || Array.isArray(strum)) return false;
  Object.values(strum).forEach(nota => aplicarOnMissEvent(nota, NUEVO_VALOR));
  return true;
}

function cambiarStrumLine(strumLines, indice) {
  const strum = strumLines[indice];
  if (!strum) throw new Error("Índice fuera de rango.");

  const ok =
    recorrerFormatoConArrows(strum) ||
    recorrerFormatoAnidado(strum) ||
    recorrerFormatoObjeto(strum);

  if (!ok) throw new Error("Formato de strum no reconocido.");
}

try {
  fs.copyFileSync(RUTA, BACKUP);
  const data = JSON.parse(fs.readFileSync(RUTA, "utf8"));

  cambiarStrumLine(data.strumLines, INDICE_STRUMLINE);

  fs.writeFileSync(RUTA, JSON.stringify(data, null, 2), "utf8");

  console.log("✔️ Miss aplicado correctamente");
} catch (err) {
  console.error("❌ Error:", err.message);
}