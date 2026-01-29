import { setSpriteFrame } from './spriteUtils.js';

const enterIcon = document.getElementById('btn-enter');

export function initMobileEnterButton(onEnter) {
    if (!enterIcon) return;

    // estado OFF inicial
    setSpriteFrame(enterIcon, 'ENTER OFF');

    // Detectar mitad tocada en touchend
    enterIcon.addEventListener('touchend', e => {
        e.preventDefault();
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        const touch = e.changedTouches[0];
        const rect = enterIcon.getBoundingClientRect();
        const y = touch.clientY - rect.top;
        if (y < rect.height / 2) {
            // Mitad superior: solo mostrar OFF
            setSpriteFrame(enterIcon, 'ENTER OFF');
        } else {
            // Mitad inferior: mostrar ON y ejecutar acción
            setSpriteFrame(enterIcon, 'ENTER ON');
            setTimeout(() => setSpriteFrame(enterIcon, 'ENTER OFF'), 100); // Breve feedback visual
            onEnter?.();
        }
    });

    // soporte mouse (por si acaso)
    enterIcon.addEventListener('mousedown', e => {
        setSpriteFrame(enterIcon, 'ENTER ON');
    });

    enterIcon.addEventListener('mouseup', e => {
        setSpriteFrame(enterIcon, 'ENTER OFF');
        onEnter?.();
    });
}