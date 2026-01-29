// infoGeneral.js
let currentSong = null;
let overlayVisible = false;

// --------------------
// 🔊 SONIDO CONFIRMAR
// --------------------
const confirmSound = new Audio('./assets/sounds/confirm.ogg');
confirmSound.volume = 0.6;

function playConfirmSound() {
    confirmSound.currentTime = 0;
    confirmSound.play().catch(() => { });
}

// --------------------
// 🎴 OVERLAY
// --------------------
export function showOverlay(song) {
    if (!song) return;

    currentSong = song;
    overlayVisible = true;

    const overlay = document.getElementById('infoOverlay');
    const title = document.getElementById('ov-title');
    const info = document.getElementById('ov-info');
    const mechanics = document.getElementById('ov-mechanics');
    const note = document.getElementById('ov-note');
    const img = document.getElementById('ov-image');
    const category = document.getElementById('ov-category');

    // RESET
    mechanics.style.display = 'none';
    note.style.display = 'none';
    img.style.display = 'none';
    category.style.display = 'none';
    overlay.classList.remove('compact');

    // INFO BASE
    title.textContent = song.name ?? '';
    info.textContent = song.info ?? '';

    const extra = song.infoExtra;

    // INFO EXTRA
    if (extra?.gertrudis === true) {
        if (song.mechanics) {
            mechanics.textContent = song.mechanics;
            mechanics.style.display = 'block';
        }

        if (extra.note) {
            note.textContent = extra.note;
            note.style.display = 'block';
        }

        if (song.category) {
            category.textContent = `Category: ${song.category}`;
            category.style.display = 'block';
        }

        if (extra.image) {
            img.src = `assets/images/other/${extra.image}`;
            img.style.display = 'block';
        }
    } else {
        overlay.classList.add('compact');
    }

    // BOTONES
    document.getElementById('ov-play').onclick = confirmAndPlay;
    document.getElementById('ov-back').onclick = hideOverlay;

    overlay.classList.remove('hidden');
}

// --------------------
// ❌ OCULTAR
// --------------------
export function hideOverlay() {
    document.getElementById('infoOverlay').classList.add('hidden');
    overlayVisible = false;
    currentSong = null;
}

// --------------------
// ▶️ CONFIRMAR + JUGAR
// --------------------
function confirmAndPlay() {
    if (!currentSong?.link) return;
    playConfirmSound();
    setTimeout(() => {
        window.open(currentSong.link, '_blank');
    }, 120);
}

// --------------------
// ⌨️ ENTER x2
// --------------------
let enterCount = 0;
let enterTimer = null;

export function enableEnterToPlay() {
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        if (!overlayVisible || !currentSong) return;

        enterCount++;
        playConfirmSound();

        clearTimeout(enterTimer);
        enterTimer = setTimeout(() => {
            enterCount = 0;
        }, 500);

        if (enterCount >= 2) {
            enterCount = 0;
            confirmAndPlay();
        }
    });
}

// --------------------
// 🎮 GAMEPAD SOPORTE
// --------------------
let lastGamepadPress = false;

export function enableGamepadSupport() {

    let lastPressed = false;

    function pollGamepad() {
        const pad = navigator.getGamepads()[0];
        if (!pad) {
            requestAnimationFrame(pollGamepad);
            return;
        }

        // A (0) o Start (9)
        const pressed =
            pad.buttons[0]?.pressed ||
            pad.buttons[9]?.pressed;

        // PRESIONA
        if (pressed && !lastPressed) {
            updateEnterVisual(true);

            // aquí decides qué hace el gamepad
            // 1) simular Enter
            // 2) confirmar directamente
            confirmAndPlay?.();
        }

        // SUELTA
        if (!pressed && lastPressed) {
            updateEnterVisual(false);
        }

        lastPressed = pressed;
        requestAnimationFrame(pollGamepad);
    }

    window.addEventListener('gamepadconnected', () => {
        console.log('🎮 Gamepad conectado');
        pollGamepad();
    });
}