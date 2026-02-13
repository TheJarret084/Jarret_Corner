import { exportSpritePackFromFolder } from "./spritepack/exportFromLevelFolder.js";
import { getSpriteFolders } from "./spritepack/getFolders.js";
import { importSpritePack } from "./spritepack/importer.js"; // 👈 tu importador
import { log } from "./helper.js";

const panel = document.getElementById("sidePanel");
const content = document.getElementById("panelContent");

export function showSpritePanel(levelData) {

    if (!levelData) return;

    const folders = getSpriteFolders(levelData);

    let html = `
        <h3>Sprites del nivel</h3>

        <button data-action="import">
            ➕ Importar SpritePack
        </button>

        <hr>
    `;

    if (!folders.length) {
        html += "<p>Sin sprites</p>";
    }

    folders.forEach(f => {
        html += `
            <div class="packRow">
                <span>${f}</span>
                <button data-action="export" data-folder="${f}">
                    Exportar
                </button>
            </div>
        `;
    });

    panel.classList.remove("hidden");
    content.innerHTML = html;


    /* =========================
       LISTENER GLOBAL
    ========================= */

    content.onclick = async (e) => {

        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;


        /* ========= EXPORT ========= */

        if (action === "export") {

            const folder = btn.dataset.folder;

            exportSpritePackFromFolder(levelData, folder);

            log(`Pack ${folder} exportado`);
        }


        /* ========= IMPORT ========= */

        if (action === "import") {

            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".zip";

            input.onchange = async (ev) => {

                const file = ev.target.files[0];
                if (!file) return;

                await importSpritePack(levelData, file);

                log("SpritePack importado ✅");

                // refrescar lista
                showSpritePanel(levelData);
            };

            input.click();
        }
    };
}
