// spriteUtils.js

let spriteData = null;
let spriteImage = null;

/**
 * Carga el JSON exportado por Aseprite
 * y precarga la imagen del spritesheet
 */
export async function loadSpriteSheet(jsonPath, imageBasePath = './assets/images/') {
    const res = await fetch(jsonPath);
    spriteData = await res.json();

    spriteImage = new Image();
    spriteImage.src = imageBasePath + spriteData.meta.image;

    await spriteImage.decode();

    console.log('🧩 SpriteSheet cargado:', spriteData.meta.image);
}

/**
 * Aplica un frame del JSON a un elemento
 */
export function setSpriteFrame(el, frameName) {
    if (!spriteData || !spriteImage || !el) return;

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