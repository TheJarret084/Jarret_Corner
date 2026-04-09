// main.js

import { initMobileButton } from './enterButton.js';
import { loadSongs, getSong } from './data.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import { startPantallaCarga, hidePantallaCarga } from './pantallacarga.js';
import {
    showOverlay,
    enableEnterToPlay,
    enableGamepadSupport
} from './infoGeneral.js';

// navbar
import * as nav from "./header.js";

/* =========================
   💥 ERROR UI GLOBAL
========================= */
function showFatalError(message, err = null) {
    console.error('💥 UI ERROR:', message, err);

    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.background = 'rgba(0,0,0,0.9)';
    div.style.color = '#ff4d4d';
    div.style.fontFamily = 'monospace';
    div.style.padding = '20px';
    div.style.zIndex = '99999';
    div.style.overflow = 'auto';

    div.innerHTML = `
        <h2>💥 Algo explotó</h2>
        <p>${message}</p>
        <pre>${err ? (err.stack || err) : ''}</pre>
    `;

    document.body.appendChild(div);
}

// disponible global (para header.js)
window.showFatalError = showFatalError;

/* =========================
   🚀 START
========================= */
async function start() {

    /* =========================
       🧱 UI BASE
    ========================= */
    UI.initUI('freeplay');

    /* =========================
       🌀 LOADER
    ========================= */
    startPantallaCarga();

    const LOADER_TIMEOUT = setTimeout(() => {
        console.warn('⏱️ Loader forzado');

        hidePantallaCarga();

        showFatalError(
            'Timeout: la app tardó demasiado en cargar.',
            new Error('Loader > 4s')
        );
    }, 4000);

    /* =========================
       🧭 NAVBAR
    ========================= */
    try {
        await nav.cargarData?.();
    } catch (e) {
        showFatalError('Error cargando navbar', e);
    }

    /* =========================
       🔊 AUDIO FONDO
    ========================= */
    Audio?.initAudio();

    function updateMusicUI() {
        const banner = document.getElementById('banner-music');
        const title = document.getElementById('title-music');

        const img = Audio.whatisthatmusic?.();
        const name = Audio.whatisthenameofmusic?.();

        if (banner) banner.src = img || '';
        if (title) title.textContent = name || '';
    }

    updateMusicUI();

    const origPlayNextSong = Audio.playNextSong;
    if (origPlayNextSong) {
        Audio.playNextSong = function () {
            origPlayNextSong();
            updateMusicUI();
        };
    }

    const startMusicOnce = () => {
        Audio.tryStartMusic?.();
        updateMusicUI();
    };

    window.addEventListener('click', startMusicOnce, { once: true });
    window.addEventListener('keydown', startMusicOnce, { once: true });

    /* =========================
       📦 CARGAR CANCIONES
    ========================= */
    try {
        await loadSongs([
            './ThiagoSongs.json',
            './JarretSongs.json'
        ]);

        UI.spawnSongs();
        hidePantallaCarga();
    }
    catch (err) {
        hidePantallaCarga();
        showFatalError('Error cargando canciones', err);
    }
    finally {
        clearTimeout(LOADER_TIMEOUT);
    }

    /* =========================
       ⌨️ ENTER x2
    ========================= */
    enableEnterToPlay();

    /* =========================
       🎮 GAMEPAD
    ========================= */
    enableGamepadSupport?.();

    /* =========================
       📱 BOTONES MOBILE
    ========================= */

    initMobileButton(
        document.getElementById('player-music'),
        './assets/images/botones/Spritep-0001.png',
        './assets/images/botones/Spritep-0002.png',
        () => {
            Audio.toggleMusic?.();
            updateMusicUI();
        }
    );

    const otherBtn = document.getElementById('other-music');
    initMobileButton(
        otherBtn,
        './assets/images/botones/Spriteh-0001.png',
        './assets/images/botones/Spriteh-0002.png',
        () => {
            Audio.changeSongWithLoader?.(() => {
                updateMusicUI();
            });
        }
    );

    initMobileButton(
        document.getElementById('btn-enter'),
        './assets/images/botones/boton-0001.png',
        './assets/images/botones/boton-0002.png',
        () => {
            const song = getSong(UI.getSelected());
            if (song) showOverlay(song);
        }
    );

    initMobileButton(
        document.getElementById('btn-left'),
        './assets/images/botones/Sprite-0001.png',
        './assets/images/botones/Sprite-0002.png',
        () => UI.setSelection(UI.getSelected() - 1)
    );

    initMobileButton(
        document.getElementById('btn-right'),
        './assets/images/botones/SpriteB-0001.png',
        './assets/images/botones/SpriteB-0002.png',
        () => UI.setSelection(UI.getSelected() + 1)
    );

    /* =========================
       ⌨️ TECLADO
    ========================= */
    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;

        if (e.key === 'ArrowRight' || e.key === 'd') {
            UI.setSelection(UI.getSelected() + 1);
        }

        if (e.key === 'ArrowLeft' || e.key === 'a') {
            UI.setSelection(UI.getSelected() - 1);
        }

        if (e.key === 'Enter') {
            const song = getSong(UI.getSelected());
            if (song) showOverlay(song);
        }
    });

    /* =========================
       🔁 LOOP PRINCIPAL
    ========================= */
    let last = performance.now();

    function loop(now) {
        const delta = (now - last) / 1000;
        last = now;

        UI.updateLayout?.(delta);
        UI.updateCircle?.(delta);

        const bpm = getSong(UI.getSelected())?.bpm ?? 100;
        Audio.updateBeat?.(bpm, delta);

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}

/* =========================
   🧯 BLINDAJE GLOBAL
========================= */
window.addEventListener('error', (e) => {
    hidePantallaCarga();
    showFatalError('Error global', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    hidePantallaCarga();
    showFatalError('Promise no manejada', e.reason);
});

/* =========================
   🚀 INIT
========================= */
start().catch(err => {
    showFatalError('💥 Fatal start error', err);
});