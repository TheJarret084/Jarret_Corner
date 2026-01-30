// data.js
export let songs = [];

/*
  Uso:
  loadSongs([
    './JarretSongs.json',
    './ThiagoSongs.json'
  ]);
*/

export async function loadSongs(paths = ["./JarretSongs.json", "./ThiagoSongs.json"]) {
    songs = [];

    if (!paths.length) {
        console.warn('loadSongs: no JSON paths provided');
    }

    try {
        for (const path of paths) {
            const r = await fetch(path);
            if (!r.ok) throw new Error(path);

            const raw = await r.json();
            const list = Array.isArray(raw)
                ? raw
                : (raw.songs || []);

            songs.push(...list);
        }
    } catch (err) {
        console.warn('loadSongs error:', err);
        songs = [];
    }

    // fallback si todo falla
    if (!songs.length) {
        songs = [{
            name: 'No songs available',
            color: '#2b2b2b',
            info: 'No song JSON loaded',
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
