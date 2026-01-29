// spriteUtils.js

let spriteData = null;
let spriteImage = null;
let readyPromise = null;
let readyResolve = null;

/**
 * Carga el JSON de Aseprite + imagen del spritesheet
 * Devuelve una promesa que se resuelve cuando TODO está listo
 */
export function loadSpriteSheet(
    jsonPath,
    imageBasePath = './assets/images/'
) {
    if (readyPromise) return readyPromise; // evita doble carga

    readyPromise = new Promise(async (resolve, reject) => {
        readyResolve = resolve;

        try {
            const res = await fetch(jsonPath);
            spriteData = await res.json();

            spriteImage = new Image();
            spriteImage.src = imageBasePath + spriteData.meta.image;

            await spriteImage.decode();

            console.log('🧩 SpriteSheet cargado:', spriteData.meta.image);
            resolve(true);
        } catch (err) {
            console.error('❌ Error cargando spritesheet', err);
            reject(err);
        }
    });

    return readyPromise;
}

/**
 * Aplica un frame del JSON a un elemento
 * Si aún no está listo, espera automáticamente
 */
export async function setSpriteFrame(el, frameName) {
    if (!el) return;

    if (!readyPromise) {
        console.warn('⚠️ SpriteSheet no cargado aún');
        return;
    }

    await readyPromise;

    const frame = spriteData.frames[frameName]?.frame;
    if (!frame) {
        console.warn('Frame no encontrado:', frameName);
        return;
    }

    el.style.width = frame.w + 'px';
    el.style.height = frame.h + 'px';
    el.style.backgroundImage = `url(${spriteImage.src})`;
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
    el.style.imageRendering = 'pixelated';
}