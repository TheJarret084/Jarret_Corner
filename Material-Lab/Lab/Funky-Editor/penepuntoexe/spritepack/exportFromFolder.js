import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

export async function exportSpritePackFromFolder(levelData, folder) {

    if (!levelData) return;

    const zip = new JSZip();

    const folderPath = `sprites/${folder}/`;

    for (const key in levelData.mapping) {

        const realPath = levelData.mapping[key];

        if (!realPath.startsWith(folderPath)) continue;

        const clean = realPath.replace(folderPath, "");

        zip.file(clean, levelData.sprites[key]);
    }

    // meta compacto (IMPORTANTE)
    zip.file("meta.json", JSON.stringify({ name: folder }));

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${folder}.spritepack`;
    a.click();
}
