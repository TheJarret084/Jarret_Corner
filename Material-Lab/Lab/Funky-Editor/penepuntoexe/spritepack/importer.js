import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import { log, showError, showWarning, normalizeJson } from "../helper.js";

export async function importSpritePack(levelData, file) {

    try {

        if (!levelData) return false;

        log("📦 Leyendo SpritePack...");

        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        if (!levelData.sprites) levelData.sprites = {};
        if (!levelData.mapping) levelData.mapping = {};
        if (!levelData.jsons) levelData.jsons = {};

        /* =========================
           1️⃣ meta.json obligatorio
        ========================= */

        const metaFile = zip.file("meta.json");

        if (!metaFile) {
            showError("El pack no tiene meta.json");
            return false;
        }

        const meta = JSON.parse(await metaFile.async("text"));

        if (!meta.name) {
            showError("meta.json necesita 'name'");
            return false;
        }

        const folder = meta.name;
        const base = `sprites/${folder}/`;

        log(`📁 Importando: ${base}`);

        /* =========================
           2️⃣ borrar viejo si existe
        ========================= */

        const exists = Object.values(levelData.mapping)
            .some(p => p.startsWith(base));

        if (exists) {

            const ok = confirm(
                `El pack "${folder}" ya existe.\nSe reemplazará completo.\n¿Continuar?`
            );

            if (!ok) {
                showWarning("Importación cancelada");
                return false;
            }

            for (const key of Object.keys(levelData.mapping)) {

                if (levelData.mapping[key].startsWith(base)) {
                    delete levelData.mapping[key];
                    delete levelData.sprites[key];
                }
            }

            delete levelData.jsons[`${base}sprite.json`];

            log("🗑 Pack anterior eliminado");
        }

        /* =========================
           3️⃣ índice libre
        ========================= */

        let nextIndex = Object.keys(levelData.sprites).length;

        /* =========================
           4️⃣ importar archivos
        ========================= */

        for (const f of Object.values(zip.files)) {

            if (f.dir) continue;

            const name = f.name.split("/").pop();
            const ext = name.split(".").pop().toLowerCase();

            /* PNG */
            if (ext === "png") {

                const blob = await f.async("blob");

                const simple = `${nextIndex}.png`;

                levelData.sprites[simple] = blob;
                levelData.mapping[simple] = `${base}${name}`;

                nextIndex++;
            }

            /* sprite.json */
            else if (name === "sprite.json") {

                const text = await f.async("text");

                const parsed = JSON.parse(text);

                // 👇 NORMALIZADO (compacto hardcore)
                levelData.jsons[`${base}sprite.json`] =
                    JSON.parse(normalizeJson(parsed));

                log("sprite.json importado");
            }
        }

        log(`✅ Pack "${folder}" importado correctamente`);

        return true;

    } catch (err) {

        showError("Error importando pack: " + err.message);
        return false;
    }
}
