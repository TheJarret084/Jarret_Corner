// main.js
import { initMobileEnterButton } from './enterButton.js';
import { loadSongs, getSong } from './data.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import {
    showOverlay,
    enableEnterToPlay,
    enableGamepadSupport
} from './infoGeneral.js';

async function start() {
    // --------------------
    // 🧱 UI
    // --------------------
    UI.initUI('freeplay');

    // --------------------
    // 🔊 AUDIO FONDO
    // --------------------
    Audio.initAudio('./assets/music/freakyMenu.ogg');
    window.addEventListener('click', Audio.tryStartMusic);
    window.addEventListener('keydown', Audio.tryStartMusic);

    // --------------------
    // 📦 CARGAR CANCIONES (1 sola vez)
    // --------------------
    loadSongs([
        './JarretSongs.json',
        './ThiagoSongs.json'
    ]);
    UI.spawnSongs();

    // --------------------
    // ⌨️ ENTER x2 (overlay)
    // --------------------
    enableEnterToPlay();

    // --------------------
    // Mobile ENTER BUTTON
    // --------------------
    const song = getSong(UI.getSelected());
    if (song) {
        // es EXACTAMENTE como presionar Enter
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter' })
        );
        initMobileEnterButton(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
    }


    // --------------------
    // ⌨️ TECLADO - NAVEGACIÓN
    // --------------------
    window.addEventListener('keydown', (e) => {

        // mover selección
        if (e.key === 'ArrowRight' || e.key === 'd') {
            UI.setSelection(UI.getSelected() + 1);
        }

        if (e.key === 'ArrowLeft' || e.key === 'a') {
            UI.setSelection(UI.getSelected() - 1);
        }

        // ENTER = abrir overlay (1er Enter)
        if (e.key === 'Enter') {
            const song = getSong(UI.getSelected());
            if (song) {
                showOverlay(song);
            }
        }
    });

    // --------------------
    // 🔁 LOOP PRINCIPAL
    // --------------------
    let last = performance.now();

    function loop(now) {
        const delta = (now - last) / 1000;
        last = now;

        UI.updateCircle(delta);
        UI.updateLayout(delta);

        const bpm = getSong(UI.getSelected())?.bpm ?? 100;
        Audio.updateBeat(bpm, delta);

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}

start().catch(console.error);