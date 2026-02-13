import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

export async function exportSpritePackFromLevel(levelData, packName = "spritepack") {

    if (!levelData) return;

    const zip = new JSZip();

    const folderPath = `sprites/${packName}/`;

    /* =====================
       sprite.json intacto
    ===================== */

    const spriteJson = levelData.jsons["sprite.json"];

    if (!spriteJson) {
        alert("Este nivel no contiene sprite.json");
        return;
    }

    zip.file("sprite.json", JSON.stringify(spriteJson));


    /* =====================
       PNGs con rutas reales
    ===================== */

    for (const key in levelData.mapping) {

        const realPath = levelData.mapping[key];

        if (!realPath.startsWith("sprites/")) continue;

        const clean = realPath.replace("sprites/", "");

        zip.file(clean, levelData.sprites[key]);
    }


    /* =====================
       meta
    ===================== */

    zip.file("meta.json", JSON.stringify({ name: packName }));


    /* ===================== */

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${packName}.spritepack`;
    a.click();
}
