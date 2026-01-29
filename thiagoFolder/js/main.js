// main.js
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
    await loadSongs('./anotherSongs.json');
    UI.spawnSongs();

    // --------------------
    // ⌨️ ENTER x2 (overlay)
    // --------------------
    enableEnterToPlay();

    // --------------------
    // 🎮 GAMEPAD
    // --------------------
    //enableGamepadSupport(); // <-- Es una mierda por ahora

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