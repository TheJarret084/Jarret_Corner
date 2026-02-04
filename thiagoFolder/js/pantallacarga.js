
// Muestra la pantalla de carga y la oculta después de 2 segundos

export function startPantallaCarga() {
    const pantalla = document.getElementById('pantallacarga');
    if (!pantalla) return;
    pantalla.style.display = 'block';
}

export function hidePantallaCarga() {
    const pantalla = document.getElementById('pantallacarga');
    if (!pantalla) return;
    pantalla.style.display = 'none';
}

// pantalla de carga para songs

export function startSongLoader() {
    const loader = document.getElementById('songLoader');
    if (!loader) return;
    loader.style.display = 'flex';
}

export function hideSongLoader() {
    const loader = document.getElementById('songLoader');
    if (!loader) return;
    loader.style.display = 'none';
}