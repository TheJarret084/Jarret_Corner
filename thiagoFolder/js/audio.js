// audio.js v1

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

// audio.js v2

/*
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

 =========================
   CONTROL DE ESTADO
========================= 

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

=========================
   BEAT
========================= 

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

*/

// audio.js v3


let bgMusic;
let musicStarted = false;
let beatAcc = 0;
let wasPlaying = false;

// Array de canciones


const musicList = [
    './assets/music/mainstate/freakyMenu-SaggyAlternateUniverse.ogg',
    './assets/music/mainstate/Diamond-is-unbreakable-deltarune-version.ogg'
    // './assets/music/mainstate/song3.ogg'
    // Agrega más rutas aquí
];

const musicNames = [
    'FreakyMenu - Shaggy Alternate Universe',
    'Diamond is Unbreakable (Deltarune Version)'
    // 'Song 3'
    // Agrega más nombres aquí
];

const imagemusiclist = [
    './assets/music/penepuntoexe/freakyMenu-SaggyAlternateUniverse.png',
    './assets/music/penepuntoexe/Diamond-is-unbreakable-deltarune-version.png'
    // './assets/music/penepuntoexe/song3.png'
    // Agrega más rutas aquí
];

let currentSongIndex = null;


function getRandomSong() {
    const idx = Math.floor(Math.random() * musicList.length);
    currentSongIndex = idx;
    return musicList[idx];
}

function setupMusic(path) {
    if (bgMusic) {
        bgMusic.pause();
        bgMusic = null;
    }
    bgMusic = new Audio(path);
    bgMusic.preload = 'auto';
    bgMusic.loop = false;
    bgMusic.volume = 0.45;
    bgMusic.addEventListener('ended', playNextSong);
}


function playNextSong(callback) {
    const nextPath = getRandomSong();
    setupMusic(nextPath);
    bgMusic.play().then(() => {
        // Espera un pequeño tiempo para asegurar que currentSongIndex esté actualizado
        setTimeout(() => {
            if (typeof callback === 'function') callback();
        }, 50);
    }).catch(() => { });
}
export function changeSongWithLoader(callback) {
    document.body.classList.add('loading-music');
    setTimeout(() => {
        playNextSong(callback);
        document.body.classList.remove('loading-music');
    }, 1000); // tiempo mínimo de carga y efecto visual
}

export function initAudio() {
    const path = getRandomSong();
    setupMusic(path);

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



// función que exporta la imagen de la canción en reproducción
export function whatisthatmusic() {
    if (currentSongIndex === null) return null;
    return imagemusiclist[currentSongIndex] || null;
}

// función que exporta el nombre de la canción en reproducción
export function whatisthenameofmusic() {
    if (currentSongIndex === null) return '';
    return musicNames[currentSongIndex] || '';
}

// función para pausar/reanudar la música y saber el estado
export function toggleMusic() {
    if (!bgMusic) return false;
    if (bgMusic.paused) {
        bgMusic.play().catch(() => { });
        return true; // está sonando
    } else {
        bgMusic.pause();
        return false; // está pausado
    }
}

// función para saber si la música está pausada
export function isMusicPaused() {
    if (!bgMusic) return true;
    return bgMusic.paused;
}

//  funcion que cambia la song
export function otraSong() {
    playNextSong();
}