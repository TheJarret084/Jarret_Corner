// loader.js
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import { addPack } from "./manager.js";
import { log, showError } from "../helper.js";

export async function loadSpritePack(file) {

    try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        const sprites = {};
        let json = null;

        for (const name in zip.files) {

            const f = zip.files[name];
            if (f.dir) continue;

            if (name === "sprite.json")
                json = JSON.parse(await f.async("text"));

            if (name.endsWith(".png"))
                sprites[name] = await f.async("blob");
        }

        if (!json)
            throw new Error("sprite.json no encontrado");

        const pack = {
            id: file.name.replace(".zip", ""),
            json,
            sprites
        };

        addPack(pack); // 🔥 auto guardar

        log(`Spritepack agregado: ${pack.id}`);

        return pack;

    } catch (err) {
        showError(err.message);
        return null;
    }
}
