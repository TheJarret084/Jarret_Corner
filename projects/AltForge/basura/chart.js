const fs = require("fs");

const INPUT = "data.json";
const OUTPUT = "data2.json";

const A = 3;
const B = 5;
const TARGET = 0;

function obtenerArregloDeNotas(strum) {
  if (strum && Array.isArray(strum.arrows)) return strum.arrows;
  if (Array.isArray(strum) && Array.isArray(strum[0])) return strum[0];
  return null;
}

function limpiarStrum(strum) {
  if (strum && Array.isArray(strum.arrows)) {
    strum.arrows = [];
    return;
  }

  if (Array.isArray(strum) && Array.isArray(strum[0])) {
    strum[0] = [];
    return;
  }

  throw new Error("Formato de strum desconocido al limpiar.");
}

function asignarNotasAStrum(strum, notas) {
  if (strum && Array.isArray(strum.arrows)) {
    strum.arrows = notas;
    return;
  }

  if (Array.isArray(strum) && Array.isArray(strum[0])) {
    strum[0] = notas;
    return;
  }

  throw new Error("Formato de strum desconocido al asignar.");
}

const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const strums = data.strumLines;

const notasA = obtenerArregloDeNotas(strums[A]) || [];
const notasB = obtenerArregloDeNotas(strums[B]) || [];

// 🔹 Fusionamos SOLO A y B (sin usar lo que había en TARGET)
const fusionadas = [...notasA, ...notasB];

fusionadas.sort((a, b) => {
  if (a?.start == null || b?.start == null) return 0;
  return a.start - b.start;
});

// 🔹 TARGET se limpia primero
limpiarStrum(strums[TARGET]);

// 🔹 Luego recibe la mezcla A+B
asignarNotasAStrum(strums[TARGET], fusionadas);

// 🔹 A y B permanecen intactas
// (no se tocan, no se vacían, no se eliminan)

fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 0), "utf8");

console.log("✔️ TARGET ahora contiene A+B y las originales siguen vivas 🌱");