// js/freeplay.js (versión corregida y resistente)
// ------------------------------------------------
const freeplay = document.getElementById('freeplay');
if (!freeplay) {
  console.error('No existe #freeplay en el DOM. Crea <div id="freeplay"></div> en tu HTML.');
}

let songs = [];
let curSelected = 0;
let circle = null; // cache del elemento círculo

// --- CONFIGS ---
const ASSETS = {
  box: 'assets/ui/freeplaybox.png',
  defaultIcon: 'assets/icons/jasmi.png',
  music: 'assets/music/breakfast.ogg'
};

// --- util ---
function lerp(a, b, t) { return a + (b - a) * t; }

// Fetch JSON simple (ahora usamos JSON limpio)
async function fetchJson(path) {
  try {
    const res = await fetch(path);
    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn('fetchJson error:', err);
    return [];
  }
}

// --- LOAD / SPAWN ---
async function loadSongs() {
  const raw = await fetchJson('./anotherSongs.json'); // archivo JSON (sin comentarios)
  songs = Array.isArray(raw) ? raw : (raw.songs || []);

  // Si no hay canciones, usar placeholder NEUTRO 
  if (!songs.length) {
    songs = [{
      name: 'No songs available',
      color: '#2b2b2b',
      info: 'Drop songs into anotherSongs.json',
      icon: '',
      link: '',
      bpm: 100
    }];
  }

  spawnSongs(songs);

  // cache circle reference after spawn (spawnSongs asegura que exista)
  circle = document.getElementById('menuCircle');

  applySelectionImmediate();
}

// Crea los elementos visuales
function spawnSongs(list) {
  // limpia y crea contenedor base
  if (!freeplay) return;
  freeplay.innerHTML = '';

  // crear el círculo si no existe
  if (!document.getElementById('menuCircle')) {
    const circ = document.createElement('div');
    circ.className = 'menu-circle';
    circ.id = 'menuCircle';
    freeplay.appendChild(circ);
  }

  list.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = 'song-item';
    item.dataset.index = i;

    // fondo de la tarjeta
    item.style.background = song.color ?? '#000000';

    // caja (imagen)
    const box = document.createElement('img');
    box.className = 'song-box';
    box.src = ASSETS.box;
    box.alt = '';
    item.appendChild(box);

    // icono como div background (soporta sprite 300x150 con 2 frames)
    const iconWrap = document.createElement('div');
    iconWrap.className = 'song-icon';
    const iconPath = song.icon ? `assets/icons/${song.icon}` : ASSETS.defaultIcon;
    iconWrap.style.backgroundImage = `url("${iconPath}")`;
    iconWrap.style.backgroundPosition = '0px 0px';
    iconWrap.style.backgroundSize = '300px 150px';
    item.appendChild(iconWrap);

    // textos
    const title = document.createElement('div');
    title.className = 'song-name';
    title.textContent = song.name || 'Unknown';
    item.appendChild(title);

    const info = document.createElement('div');
    info.className = 'song-info';
    info.textContent = song.info || '';
    item.appendChild(info);

    const mech = document.createElement('div');
    mech.className = 'song-mechanics';
    mech.textContent = song.mechanics || (song.bpm ? `${song.bpm} BPM` : '');
    item.appendChild(mech);

    // click para seleccionar
    item.addEventListener('click', () => {
      const idx = Number(item.dataset.index);
      setSelection(idx);
    });

    // estado para animaciones
    item._state = {
      angle: 0,
      angleTarget: 0,
      y: 0,
      yTarget: 0,
      scale: 1,
      scaleTarget: 1,
      opacity: 1,
      iconEl: iconWrap
    };

    freeplay.appendChild(item);
  });
}

// --- SELECTION LOGIC ---
function setSelection(index) {
  const len = songs.length;
  if (len === 0) return;
  // wrap safe
  if (index < 0) index = (index + len) % len;
  if (index >= len) index = index % len;
  curSelected = index;
  applySelectionImmediate();
}

function applySelectionImmediate() {
  const nodes = document.querySelectorAll('.song-item');
  nodes.forEach(node => node.classList.remove('selected', 'dim'));
  const sel = document.querySelector(`.song-item[data-index="${curSelected}"]`);
  if (sel) sel.classList.add('selected');

  // ajustar sprite de icono
  nodes.forEach(node => {
    const idx = Number(node.dataset.index);
    const iconDiv = node._state ? node._state.iconEl : node.querySelector('.song-icon');
    if (!iconDiv) return;
    iconDiv.style.backgroundPosition = (idx === curSelected) ? '-150px 0px' : '0px 0px';
  });
}

// --- ANIMATION / ARRANGE (arc) ---
function computeDiff(i, cur, len) {
  if (!len) return 0;
  let diff = i - cur;
  const half = Math.floor(len / 2);
  if (diff < 0) {
    diff -= half;
    diff %= len;
    diff += half;
  } else {
    diff += half;
    diff %= len;
    diff -= half;
  }
  return diff;
}

function applyLayoutSmooth(delta) {
  const nodes = Array.from(document.querySelectorAll('.song-item'));
  const len = songs.length || 1;
  nodes.forEach((node, i) => {
    const s = node._state;
    // safety
    if (!s) return;
    const diff = computeDiff(i, curSelected, len);

    let clamped = diff;
    if (clamped > 3) clamped = 3;
    if (clamped < -3) clamped = -3;

    s.angleTarget = clamped * 12;
    s.yTarget = clamped * 120;
    s.scaleTarget = clamped === 0 ? 1.06 : 0.88;
    s.opacityTarget = clamped === 0 ? 1 : 0.4;

    s.angle = lerp(s.angle, s.angleTarget, 0.12);
    s.y = lerp(s.y, s.yTarget, 0.12);
    s.scale = lerp(s.scale, s.scaleTarget, 0.12);
    s.opacity = lerp(s.opacity, s.opacityTarget, 0.12);

    node.style.transform = `translate(-50%, -50%) translateY(${s.y}px) rotate(${s.angle}deg) scale(${s.scale})`;
    node.style.opacity = s.opacity;
  });
}

// --- CIRCLE ANIMATION ---
let circleRot = 0;
function updateCircle(delta) {
  if (!circle) circle = document.getElementById('menuCircle');
  if (!circle) return;
  circleRot += delta * 10;
  circle.style.transform = `translateX(-50%) rotate(${circleRot}deg)`;
}

// --- MUSIC (solo fondo: breakfast) ---
const music = new Audio(ASSETS.music);
music.preload = 'auto';
music.loop = true;
music.volume = 0.45;

let musicStarted = false;
function tryStartMusic() {
  if (musicStarted) return;
  music.play().catch(() => {/* blocked until user interacts */ });
  musicStarted = true;
}
window.addEventListener('click', tryStartMusic);
window.addEventListener('keydown', tryStartMusic);

// --- BEAT (usa BPM de la canción seleccionada) ---
let beatTimer = 0;
function updateBeat(delta) {
  if (!songs.length) return;
  const curSong = songs[curSelected] || {};
  const bpm = curSong.bpm ?? 100;
  beatTimer += delta;
  const interval = 60 / bpm;
  if (beatTimer >= interval) {
    beatTimer -= interval;
    document.body.classList.add('beat');
    setTimeout(() => document.body.classList.remove('beat'), 90);
  }
}

// --- INPUT (keyboard) ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'd') {
    setSelection(curSelected + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'a') {
    setSelection(curSelected - 1);
  } else if (e.key === 'Enter') {
    const s = songs[curSelected];
    if (s && s.link) window.open(s.link, '_blank');
  }
});

// --- MAIN LOOP ---
let last = performance.now();
function loop(now) {
  const delta = (now - last) / 1000;
  last = now;

  updateCircle(delta);
  applyLayoutSmooth(delta);
  updateBeat(delta);

  requestAnimationFrame(loop);
}

// start
loadSongs().then(() => {
  applySelectionImmediate();
  requestAnimationFrame(loop);
});