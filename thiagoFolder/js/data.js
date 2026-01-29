// data.js
export let songs = [];

export async function loadSongs(path = 'anotherSongs.json') {
    try {
        const r = await fetch(path);
        const txt = await r.text();
        const raw = JSON.parse(txt);
        songs = Array.isArray(raw) ? raw : (raw.songs || []);
    } catch (err) {
        console.warn('loadSongs:', err);
        songs = [];
    }

    if (!songs.length) {
        // placeholder neutral (no confundir con la música de fondo)
        songs = [{
            name: 'No songs available',
            color: '#2b2b2b',
            info: 'Add entries to anotherSongs.json',
            icon: '',
            link: '',
            bpm: 100
        }];
    }

    return songs;
}

export function getSong(i) {
    return songs[i] ?? null;
}

export function count() {
    return songs.length;
}