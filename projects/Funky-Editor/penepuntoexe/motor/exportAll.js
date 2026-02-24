import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

export async function exportAll(levelData, fileName = `sprites_de_${newname}.zip`, includeMapping = false) {

    const newname = document.getElementById("namelevel").value.trim();
    if (!newname) return showError("El nombre no puede estar vacío");

    if (!levelData) return;

    const zip = new JSZip();

    // =====================
    // JSONs modificados
    // =====================
    for (const name in levelData.jsons) {
        zip.file(
            name,
            JSON.stringify(levelData.jsons[name], null, 0)
        );
    }

    // =====================
    // Sprites
    // =====================
    for (const name in levelData.sprites) {
        zip.file(name, levelData.sprites[name]);
    }

    // =====================
    // mapping opcional
    // =====================
    if (includeMapping && levelData.mapping) {
        zip.file(
            "mapping.json",
            JSON.stringify(levelData.mapping, null, 2)
        );
    }

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
}
