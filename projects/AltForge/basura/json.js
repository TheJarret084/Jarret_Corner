// dividir_chart_por_notetype.js
// Genera dos charts:
//  - uno SOLO con las notas del noteType elegido
//  - otro con TODAS LAS DEMÁS notas

const fs = require("fs");

const INPUT = "";

// Nombre del noteType a dividir
const TARGET_NAME = "default";


/*
"codenameChart":true,"stage":"paint",
"noteTypes":["Char 1","fuckyou","default","both"]}
*/


const OUT_WITH = `./mania_con_${TARGET_NAME.replace(/\s+/g, "_")}.json`;
const OUT_WITHOUT = `./mania_sin_${TARGET_NAME.replace(/\s+/g, "_")}.json`;

const chart = JSON.parse(fs.readFileSync(INPUT, "utf8"));

// índice del noteType en el arreglo
const typeIndex = chart.noteTypes.indexOf(TARGET_NAME);

if (typeIndex === -1) {
  console.error("El noteType no existe:", TARGET_NAME);
  process.exit(1);
}

// Copias profundas del chart original
const chartWith = JSON.parse(JSON.stringify(chart));
const chartWithout = JSON.parse(JSON.stringify(chart));

for (const strum of chartWith.strumLines || []) {
  if (!strum.notes) continue;
  // SOLO las notas del type elegido
  strum.notes = strum.notes.filter(n => n.type === typeIndex);
}

for (const strum of chartWithout.strumLines || []) {
  if (!strum.notes) continue;
  // TODAS excepto el type elegido
  strum.notes = strum.notes.filter(n => n.type !== typeIndex);
}

// Guardar resultados
fs.writeFileSync(OUT_WITH, JSON.stringify(chartWith, null, 0));
fs.writeFileSync(OUT_WITHOUT, JSON.stringify(chartWithout, null, 0));

console.log("Hecho 🎹");
console.log("Con notas del tipo:", OUT_WITH);
console.log("Sin notas del tipo:", OUT_WITHOUT);