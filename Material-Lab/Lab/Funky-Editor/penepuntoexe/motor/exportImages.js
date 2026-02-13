import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";



export async function exportImages(levelData, includeMapping = false) {

    if (!levelData) return;

    const zip = new JSZip();

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
    const newname = document.getElementById("namelevel").value.trim() || "este_nivel";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `imagenes_de_${newname}.zip`;
    a.click();
}
