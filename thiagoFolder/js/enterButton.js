const enterIcon = document.getElementById('btn-enter');

const IMG_OFF = './assets/images/boton-0001.png';
const IMG_ON = './assets/images/boton-0002.png';

function preloadImages() {
    [IMG_OFF, IMG_ON].forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

export function initMobileEnterButton(onEnter) {
    if (!enterIcon) return;

    preloadImages();

    // estado inicial
    enterIcon.style.backgroundImage = `url(${IMG_OFF})`;

    /* ===== MOBILE ===== */
    enterIcon.addEventListener('touchend', e => {
        e.preventDefault();

        enterIcon.style.backgroundImage = `url(${IMG_ON})`;

        setTimeout(() => {
            enterIcon.style.backgroundImage = `url(${IMG_OFF})`;
        }, 120);

        onEnter?.();
    });

    /* ===== DESKTOP (fallback) ===== */
    enterIcon.addEventListener('mousedown', () => {
        enterIcon.style.backgroundImage = `url(${IMG_ON})`;
    });

    enterIcon.addEventListener('mouseup', () => {
        enterIcon.style.backgroundImage = `url(${IMG_OFF})`;
        onEnter?.();
    });

    enterIcon.addEventListener('mouseleave', () => {
        enterIcon.style.backgroundImage = `url(${IMG_OFF})`;
    });
}
