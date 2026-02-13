import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

export async function exportSpritePackFromFolder(levelData, folder) {

    if (!levelData) return;

    const zip = new JSZip();

    const base = `sprites/${folder}/`;

    /* ======================
       PNGs (mapping real)
    ====================== */

    for (const key in levelData.mapping) {

        const realPath = levelData.mapping[key];

        if (!realPath.startsWith(base)) continue;

        const clean = realPath.replace(base, "");

        zip.file(clean, levelData.sprites[key]);
    }


    /* ======================
       sprite.json seguro
    ====================== */

    const jsonKey = Object.keys(levelData.jsons)
        .find(p => p.startsWith(base) && p.endsWith("sprite.json"));

    if (jsonKey) {
        zip.file(
            "sprite.json",
            JSON.stringify(levelData.jsons[jsonKey])
        );
    }


    /* ======================
       meta
    ====================== */

    zip.file("meta.json", JSON.stringify({ name: folder }));


    /* ====================== */

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${folder}.spritepack`;
    a.click();
}
