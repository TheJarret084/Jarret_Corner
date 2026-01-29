export function showOverlay(song) {
    const title = document.getElementById('ov-title');
    const info = document.getElementById('ov-info');
    const mechanics = document.getElementById('ov-mechanics');
    const note = document.getElementById('ov-note');
    const img = document.getElementById('ov-image');

    title.textContent = song.name ?? '';
    info.textContent = song.info ?? '';

    // RESET visual (importante)
    mechanics.style.display = 'none';
    note.style.display = 'none';
    img.style.display = 'none';

    const extra = song.infoExtra;

    // 👉 SOLO si gertrudis es true
    if (extra?.gertrudis === true) {
        /*
        if (song.mechanics) {
          mechanics.textContent = song.mechanics;
          mechanics.style.display = 'block';
        } */

        if (extra.note) {
            note.textContent = extra.note;
            note.style.display = 'block';
        }

        if (extra.image) {
            img.src = `assets/images/${extra.image}`;
            img.style.display = 'block';
        }
    } else {
        overlay.classList.toggle('compact', extra?.gertrudis !== true);
    }

    document.getElementById('ov-play').onclick = () => {
        window.open(song.link, '_blank');
    };

    document.getElementById('ov-back').onclick = hideOverlay;

    document.getElementById('ov-creator').onclick = () => {
        if (!song.infoCreator) return;
        alert(`Creado por ${song.infoCreator.name}`);
    };

    document.getElementById('infoOverlay').classList.remove('hidden');
}