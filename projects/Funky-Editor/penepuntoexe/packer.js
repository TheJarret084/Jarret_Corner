import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import { log, showError } from "./helper.js";

export async function repackFNMM(levelData, outName = `${newname}.FNMM`) {

    const newname = document.getElementById("namelevel").value.trim();
    if (!newname) return showError("El nombre no puede estar vacío");

    try {

        log("📦 Reempaquetando...");

        const newZip = new JSZip();

        // =========================
        // 1. copiar todo original
        // =========================
        for (const name in levelData.originalZip.files) {

            const f = levelData.originalZip.files[name];
            if (f.dir) continue;

            const data = await f.async("arraybuffer");
            newZip.file(name, data);
        }


        // =========================
        // 2. reemplazar sprites
        // =========================
        for (const [simple, blob] of Object.entries(levelData.sprites)) {

            const originalPath = levelData.mapping[simple];

            if (!originalPath) continue;

            newZip.file(originalPath, blob);
        }


        // =========================
        // 3. reemplazar JSONs
        // =========================
        for (const [name, obj] of Object.entries(levelData.jsons)) {

            newZip.file(
                name,
                JSON.stringify(obj, null, 2)
            );
        }


        // =========================
        // 4. generar archivo
        // =========================
        const blob = await newZip.generateAsync({ type: "blob" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = outName;
        a.click();

        log("✅ FNMM exportado correctamente");

    } catch (err) {
        showError(err.message);
    }
}
