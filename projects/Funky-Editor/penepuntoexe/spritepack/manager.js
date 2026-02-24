// manager.js
const packs = new Map();

export function addPack(pack) {
    packs.set(pack.id, pack);
}

export function getPack(id) {
    return packs.get(id);
}

export function getAllPacks() {
    return [...packs.values()];
}

export function removePack(id) {
    packs.delete(id);
}

export function clearPacks() {
    packs.clear();
}

