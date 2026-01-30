// main.js

import { initMobileButton } from './enterButton.js';
import { loadSongs, getSong } from './data.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import {
    showOverlay,
    enableEnterToPlay,
    enableGamepadSupport
} from './infoGeneral.js';

async function start() {
    /* =========================
       🧱 UI BASE
    ========================= */
    UI.initUI('freeplay');

    /* =========================
       🌀 LOADER
    ========================= */
    UI.showLoader();

    // failsafe por si algo muere
    const LOADER_TIMEOUT = setTimeout(() => {
        console.warn('⏱️ Loader forzado');
        UI.hideLoader(true);
    }, 4000);

    /* =========================
       🔊 AUDIO FONDO
    ========================= */
    Audio.initAudio('./assets/music/freakyMenu.ogg');

    const startMusicOnce = () => Audio.tryStartMusic();
    window.addEventListener('click', startMusicOnce, { once: true });
    window.addEventListener('keydown', startMusicOnce, { once: true });

    /* =========================
       📦 CARGAR CANCIONES
    ========================= */
    try {
        await loadSongs([
            './JarretSongs.json',
            './ThiagoSongs.json'
        ]);

        UI.spawnSongs();
    }
    catch (err) {
        console.error('❌ Error cargando canciones', err);
    }
    finally {
        clearTimeout(LOADER_TIMEOUT);
        UI.hideLoader();
    }

    /* =========================
       ⌨️ ENTER x2 (overlay)
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
        './assets/images/botones/SpriteB-0001.png',
        './assets/images/botones/SpriteB-0002.png',
        () => UI.setSelection(UI.getSelected() - 1)
    );

    initMobileButton(
        document.getElementById('btn-right'),
        './assets/images/botones/Sprite-0001.png',
        './assets/images/botones/Sprite-0002.png',
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

        UI.updateLayout(delta);
        UI.updateCircle(delta);

        const bpm = getSong(UI.getSelected())?.bpm ?? 100;
        Audio.updateBeat(bpm, delta);

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}

/* =========================
   🧯 BLINDAJE GLOBAL
========================= */
window.addEventListener('error', () => UI.hideLoader(true));
window.addEventListener('unhandledrejection', () => UI.hideLoader(true));

start().catch(err => {
    console.error('💥 Fatal start error', err);
});
