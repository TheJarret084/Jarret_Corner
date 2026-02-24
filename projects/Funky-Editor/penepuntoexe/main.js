import { descompacter } from "./descompacter.js";
import { MDdata } from "./editor.js";
import { repackFNMM } from "./packer.js";
import { log, showError, showInfo } from "./helper.js";
import { showSpritePanel } from "./panel.js";

import { loadSpritePack } from "./spritepack/loader.js";
import { addPack, getAllPacks } from "./spritepack/manager.js";
import { exportSpritePack } from "./spritepack/exporter.js";

import { exportAll } from "./motor/exportAll.js";
import { exportImages } from "./motor/exportImages.js";

/* =========================
   ELEMENTOS
========================= */

const btnLoad = document.getElementById("cargarNVL");
const btnExport = document.getElementById("exportar");
const btnExportImg = document.getElementById("exportarImg");
const btnAll = document.getElementById("exportarAll");

const bpmInput = document.getElementById("bpm-input");
const nameInput = document.getElementById("namelevel");
const includeMapping = document.getElementById("includeMapping");
const status = document.getElementById("nivelStatus");

let levelData = null;


/* =========================
   CARGAR NIVEL
========================= */

descompacter(btnLoad, {

    onStart: () => {
        status.textContent = "Cargando...";
        status.classList.remove("ok");
    },

   onFinish: (data) => {

    levelData = data;

    status.textContent = `Nivel cargado: ${data.fileName}`;
    status.classList.add("ok");

    showSpritePanel(levelData); // ← pasar data
}

});


/* =========================
   EXPORTAR TODO (ZIP)
========================= */

btnAll.onclick = () => {

    if (!levelData)
        return showError("Carga un nivel primero");

    exportAll(
        levelData,
        `${nameInput.value || "all"}.zip`,
        includeMapping.checked
    );

    showInfo("ZIP completo exportado");
};


/* =========================
   EXPORTAR IMÁGENES DESDE NIVEL
========================= */

btnExportImg.onclick = () => {

    if (!levelData)
        return showError("Carga un nivel primero");

    exportImages(levelData, includeMapping.checked);

    showInfo("Sprites exportados");
};


/* =========================
   EXPORTAR NIVEL FNMM
========================= */

btnExport.onclick = () => {

    if (!levelData)
        return showError("Primero carga un nivel");

    const newname = nameInput.value.trim();
    if (!newname)
        return showError("El nombre no puede estar vacío");

    if (bpmInput.value) {
        MDdata(levelData, "data.json", {
            bpm: Number(bpmInput.value)
        });
    }

    repackFNMM(levelData, `${newname}.FNMM`);

    showInfo("¡Nivel exportado!");
};


/* =========================
   EXPORTAR SPRITEPACKS CARGADOS
========================= */

btnExportImg.addEventListener("dblclick", () => {

    const packs = getAllPacks();

    if (!packs.length)
        return showError("No hay spritepacks cargados");

    packs.forEach(p => exportSpritePack(p, p.id));

    showInfo("Spritepacks exportados");
});


/* =========================
   IMPORTAR PACK (drag & drop)
========================= */

window.addEventListener("dragover", e => e.preventDefault());

window.addEventListener("drop", async e => {

    e.preventDefault();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const pack = await loadSpritePack(file);
    if (!pack) return;

    addPack(pack);

    log("Pack agregado");
});
