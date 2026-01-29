// enterButton.js
import { setSpriteFrame } from './spriteUtils.js';

const enterIcon = document.getElementById('btn-enter');

export function initMobileEnterButton(onEnter) {
    if (!enterIcon) return;

    // estado inicial
    setSpriteFrame(enterIcon, 'ENTER OFF');

    /* ===== TOUCH (mobile) ===== */
    enterIcon.addEventListener('touchend', e => {
        e.preventDefault();

        const touch = e.changedTouches?.[0];
        if (!touch) return;

        const rect = enterIcon.getBoundingClientRect();
        const y = touch.clientY - rect.top;

        if (y < rect.height / 2) {
            // mitad superior → solo OFF
            setSpriteFrame(enterIcon, 'ENTER OFF');
        } else {
            // mitad inferior → ON + acción
            setSpriteFrame(enterIcon, 'ENTER ON');

            setTimeout(() => {
                setSpriteFrame(enterIcon, 'ENTER OFF');
            }, 120);

            onEnter?.();
        }
    });

    /* ===== MOUSE (desktop fallback) ===== */
    enterIcon.addEventListener('mousedown', () => {
        setSpriteFrame(enterIcon, 'ENTER ON');
    });

    enterIcon.addEventListener('mouseup', () => {
        setSpriteFrame(enterIcon, 'ENTER OFF');
        onEnter?.();
    });

    enterIcon.addEventListener('mouseleave', () => {
        setSpriteFrame(enterIcon, 'ENTER OFF');
    });
}