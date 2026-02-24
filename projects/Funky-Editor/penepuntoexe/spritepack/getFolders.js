/**
 * Devuelve carpetas dentro de sprites/
 */
export function getSpriteFolders(levelData) {

    const set = new Set();

    for (const key in levelData.mapping) {

        const realPath = levelData.mapping[key];

        if (!realPath.startsWith("sprites/")) continue;

        const parts = realPath.split("/");

        if (parts.length >= 3)
            set.add(parts[1]); // carpeta real
    }

    return [...set];
}

