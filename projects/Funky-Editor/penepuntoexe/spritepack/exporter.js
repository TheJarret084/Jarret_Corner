// exporter.js
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

export async function exportSpritePack(pack, name = "spritepack.zip") {

    const zip = new JSZip();

    // JSON intacto
    zip.file(
        "sprite.json",
        JSON.stringify(pack.json, null, 0)
    );

    // PNGs intactos
    for (const fileName in pack.sprites)
        zip.file(fileName, pack.sprites[fileName]);

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}
