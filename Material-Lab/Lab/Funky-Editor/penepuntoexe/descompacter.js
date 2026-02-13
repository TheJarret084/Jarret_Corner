import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import { log, showError, showWarning } from "./helper.js";

/**
 * Carga un .FNMM y devuelve todos sus assets
 *
 * @param {HTMLElement} btn botón que dispara el selector
 * @param {Object} options callbacks opcionales
 * @returns Promise<{sprites,jsons,mapping,originalZip}>
 */
export function descompacter(btn, options = {}) {

    const {
        onStart = () => {},
        onProgress = () => {},
        onFinish = () => {}
    } = options;

    return new Promise((resolve) => {

        btn.addEventListener("click", () => {

            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".FNMM";

            input.onchange = async (event) => {

                const file = event.target.files[0];
                if (!file) return;

                try {
                    onStart(file);
                    log("📦 Abriendo FNMM...");

                    const buffer = await file.arrayBuffer();
                    const zip = await JSZip.loadAsync(buffer);

                    const sprites = {};
                    const jsons = {};
                    const mapping = {};

                    let spriteIndex = 0;

                    const files = Object.values(zip.files).filter(f => !f.dir);
                    const total = files.length;

                    for (let i = 0; i < total; i++) {

                        const f = files[i];
                        const name = f.name;
                        const ext = name.split(".").pop().toLowerCase();

                        // ===== PNG =====
                        if (ext === "png") {
                            const blob = await f.async("blob");

                            const simple = `${spriteIndex}.png`;
                            sprites[simple] = blob;
                            mapping[simple] = name;

                            spriteIndex++;
                        }

                        // ===== JSON =====
                        else if (ext === "json") {
                            const text = await f.async("text");

                            try {
                                jsons[name] = JSON.parse(text);
                            } catch {
                                showWarning(`JSON inválido: ${name}`);
                            }
                        }

                        onProgress(Math.round((i + 1) / total * 100));
                    }

                    const data = {
                        sprites,
                        jsons,
                        mapping,
                        originalZip: zip,
                        fileName: file.name
                    };

                    log(`✅ Nivel listo
Sprites: ${Object.keys(sprites).length}
JSONs: ${Object.keys(jsons).length}`);

                    onFinish(data);
                    resolve(data);

                } catch (err) {
                    showError("Error al descomprimir: " + err.message);
                }
            };

            input.click();
        });

    });
}
