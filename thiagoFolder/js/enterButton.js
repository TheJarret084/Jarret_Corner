import { setSpriteFrame } from './spriteUtils.js';

const enterIcon = document.getElementById('btn-enter');

export function initMobileEnterButton(onEnter) {
    if (!enterIcon) return;

    // estado OFF inicial
    setSpriteFrame(enterIcon, 'ENTER OFF');

    // ⬇️ PRESIONAR
    enterIcon.addEventListener('touchstart', e => {
        e.preventDefault();
        setSpriteFrame(enterIcon, 'ENTER ON');
    });

    // ⬆️ SOLTAR = ENTER
    enterIcon.addEventListener('touchend', e => {
        e.preventDefault();
        setSpriteFrame(enterIcon, 'ENTER OFF');
        onEnter?.();
    });

    // soporte mouse (por si acaso)
    enterIcon.addEventListener('mousedown', () => {
        setSpriteFrame(enterIcon, 'ENTER ON');
    });

    enterIcon.addEventListener('mouseup', () => {
        setSpriteFrame(enterIcon, 'ENTER OFF');
        onEnter?.();
    });
}