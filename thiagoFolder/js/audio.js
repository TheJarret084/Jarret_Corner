// audio.js
/*
let bgMusic = null;
let musicStarted = false;
let beatAcc = 0;

export function initAudio(path = './assets/music/freakyMenu.ogg') {
    bgMusic = new Audio(path);
    bgMusic.preload = 'auto';
    bgMusic.loop = true;
    bgMusic.volume = 0.45;
}

export function tryStartMusic() {
    if (!bgMusic || musicStarted) return;
    bgMusic.play().catch(() => { blocked until user interacts  });
    musicStarted = true;
}

export function updateBeat(bpm, delta) {
    if (!bpm) bpm = 100;
    beatAcc += delta;
    const interval = 60 / bpm;
    if (beatAcc >= interval) {
        beatAcc -= interval;
        document.body.classList.add('beat');
        setTimeout(() => document.body.classList.remove('beat'), 90);
    }
}
*/

// audio.js
let bgMusic = null;
let musicStarted = false;
let beatAcc = 0;
let wasPlaying = false;

export function initAudio(path = './assets/music/freakyMenu.ogg') {
    bgMusic = new Audio(path);
    bgMusic.preload = 'auto';
    bgMusic.loop = true;
    bgMusic.volume = 0.45;

    // 🔒 Control por visibilidad de la página
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', stopMusic);
    window.addEventListener('blur', pauseMusic);
    window.addEventListener('focus', resumeMusic);
}

export function tryStartMusic() {
    if (!bgMusic || musicStarted) return;

    bgMusic.play()
        .then(() => {
            musicStarted = true;
        })
        .catch(() => {
            // bloqueado hasta interacción del usuario
        });
}

/* =========================
   CONTROL DE ESTADO
========================= */

function handleVisibility() {
    if (document.hidden) {
        pauseMusic();
    } else {
        resumeMusic();
    }
}

function pauseMusic() {
    if (!bgMusic || bgMusic.paused) return;
    wasPlaying = true;
    bgMusic.pause();
}

function resumeMusic() {
    if (!bgMusic || !musicStarted || !wasPlaying) return;

    bgMusic.play().catch(() => { });
    wasPlaying = false;
}

function stopMusic() {
    if (!bgMusic) return;
    bgMusic.pause();
    bgMusic.currentTime = 0;
    wasPlaying = false;
}

/* =========================
   BEAT
========================= */

export function updateBeat(bpm = 100, delta) {
    beatAcc += delta;

    const interval = 60 / bpm;
    if (beatAcc >= interval) {
        beatAcc -= interval;
        document.body.classList.add('beat');
        setTimeout(() => {
            document.body.classList.remove('beat');
        }, 90);
    }
}
