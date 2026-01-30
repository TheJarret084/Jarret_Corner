function preload(srcs = []) {
    srcs.forEach(s => {
        const i = new Image();
        i.src = s;
    });
}

export function initMobileButton(el, imgOff, imgOn, onPress) {
    if (!el) return;

    preload([imgOff, imgOn]);

    // estado inicial
    el.style.backgroundImage = `url(${imgOff})`;

    /* ===== MOBILE ===== */
    el.addEventListener('touchstart', e => {
        e.preventDefault();
        el.style.backgroundImage = `url(${imgOn})`;
    });

    el.addEventListener('touchend', e => {
        e.preventDefault();
        el.style.backgroundImage = `url(${imgOff})`;
        onPress?.();
    });

    /* ===== DESKTOP FALLBACK ===== */
    el.addEventListener('mousedown', () => {
        el.style.backgroundImage = `url(${imgOn})`;
    });

    el.addEventListener('mouseup', () => {
        el.style.backgroundImage = `url(${imgOff})`;
        onPress?.();
    });

    el.addEventListener('mouseleave', () => {
        el.style.backgroundImage = `url(${imgOff})`;
    });
}

