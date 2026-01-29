// main.js
import { loadSongs, getSong } from './data.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';

async function start() {
    // init UI
    UI.initUI('freeplay');

    // init audio (fondo)
    Audio.initAudio('./assets/music/freakyMenu.ogg');
    window.addEventListener('click', Audio.tryStartMusic);
    window.addEventListener('keydown', Audio.tryStartMusic);

    // load songs
    await loadSongs('./anotherSongs.json');
    UI.spawnSongs(); // crea DOM

    // keyboard handlers (selection + enter)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'd') UI.setSelection(UI.getSelected() + 1);
        if (e.key === 'ArrowLeft' || e.key === 'a') UI.setSelection(UI.getSelected() - 1);
        if (e.key === 'Enter') {
            const s = getSong(UI.getSelected());
            if (s && s.link) window.open(s.link, '_blank');
        }
    });

    // start loop
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

start().catch(err => console.error(err));