// js/freeplay.js
const freeplay = document.getElementById('freeplay');
let songs = [];
let curSelected = 0;

// --- CONFIGS ---
const ASSETS = {
  box: 'assets/ui/freeplaybox.png',
  defaultIcon: 'assets/icons/default.png',
  music: 'assets/music/breakfast.ogg'
};

// --- util ---
function lerp(a, b, t) { return a + (b - a) * t; }

// Intentar parsear JSONC si existe jsoncParser; si no, JSON.parse
async function fetchJsoncOrJson(path) {
  const res = await fetch(path);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    if (typeof jsoncParser !== 'undefined' && jsoncParser.parse) {
      return jsoncParser.parse(text);
    } else {
      console.warn('JSON parse failed and jsonc-parser not found. Returning empty array.');
      return [];
    }
  }
}

// --- LOAD / SPAWN ---
async function loadSongs() {
  const raw = await fetchJsoncOrJson('./anotherSongs.jsonc');
  // soportar tanto { songs: [...] } como array directo
  songs = Array.isArray(raw) ? raw : (raw.songs || []);
  if (!songs.length) {
    // placeholder
    songs = [{
      name: 'test',
      color: '#FFFFFF',
      info: 'cancion de prueba',
      icon: '',
      bpm: 100
    }];
  }
  spawnSongs(songs);
  // marcar seleccionado visual luego de spawn
  applySelectionImmediate();
}

function spawnSongs(list) {
  freeplay.innerHTML = ''; // limpiar
  // opcional: añadir el círculo si no existe dentro del freeplay
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
    item.style.background = song.color ?? '#444';

    // caja (imagen de fondo)
    const box = document.createElement('img');
    box.className = 'song-box';
    box.src = ASSETS.box;
    item.appendChild(box);

    // icono: lo hago como div con background para poder mover el "sprite" usando background-position
    const iconWrap = document.createElement('div');
    iconWrap.className = 'song-icon';
    const iconPath = song.icon ? `assets/icons/${song.icon}` : ASSETS.defaultIcon;
    iconWrap.style.backgroundImage = `url("${iconPath}")`;
    // asumir sprite de 300x150 con 2 frames horizontales (cada frame 150x150)
    // posición inicial (deseleccionada)
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
    item.addEventListener('click', (e) => {
      const idx = Number(item.dataset.index);
      setSelection(idx);
    });

    // guardo refs para animar suavemente
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
  // wrap safe
  if (index < 0) index = (index + len) % len;
  if (index >= len) index = index % len;
  curSelected = index;
  // aplicar efectos (play music change optional)
  applySelectionImmediate();
  // If the new song has bpm we update beat behavior automatically because update() reads songs[curSelected]
}

function applySelectionImmediate() {
  const nodes = document.querySelectorAll('.song-item');
  nodes.forEach(node => node.classList.remove('selected', 'dim'));
  const sel = document.querySelector(`.song-item[data-index="${curSelected}"]`);
  if (sel) sel.classList.add('selected');

  // adjust icon background position (sprite shift)
  nodes.forEach(node => {
    const idx = Number(node.dataset.index);
    const iconDiv = node._state ? node._state.iconEl : node.querySelector('.song-icon');
    if (!iconDiv) return;
    if (idx === curSelected) {
      // seleccionado -> mover sprite a frame derecho (-150px)
      iconDiv.style.backgroundPosition = '-150px 0px';
    } else {
      // deseleccionado -> frame izquierdo
      iconDiv.style.backgroundPosition = '0px 0px';
    }
  });
}

// --- ANIMATION / ARRANGE (arc) ---
function computeDiff(i, cur, len) {
  // compute circular diff so it loops around like el código haxe
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
  const len = songs.length;
  nodes.forEach((node, i) => {
    const s = node._state;
    const diff = computeDiff(i, curSelected, len);

    // clamp visual spread
    let clamped = diff;
    if (clamped > 3) clamped = 3;
    if (clamped < -3) clamped = -3;

    // targets
    s.angleTarget = clamped * 12; // menos angulo para web (12 deg por step)
    s.yTarget = clamped * 120;     // separacion vertical
    s.scaleTarget = clamped === 0 ? 1.06 : 0.88;
    s.opacityTarget = clamped === 0 ? 1 : 0.4;

    // smooth towards targets
    s.angle = lerp(s.angle, s.angleTarget, 0.12);
    s.y = lerp(s.y, s.yTarget, 0.12);
    s.scale = lerp(s.scale, s.scaleTarget, 0.12);
    s.opacity = lerp(s.opacity, s.opacityTarget, 0.12);

    node.style.transform = `translate(-50%, -50%) translateY(${s.y}px) rotate(${s.angle}deg) scale(${s.scale})`;
    node.style.opacity = s.opacity;
  });
}

// --- CIRCLE ANIMATION (safe) ---
const circle = document.getElementById('menuCircle');
let circleRot = 0;
function updateCircle(delta) {
  if (!circle) return;
  circleRot += delta * 10;
  // translateX(-50%) keep center, rotate smooth
  circle.style.transform = `translateX(-50%) rotate(${circleRot}deg)`;
}

// --- MUSIC ---
const music = new Audio(ASSETS.music);
music.preload = 'auto';
music.loop = true;
music.volume = 0.5;

window.addEventListener('click', () => {
  // reproducir musica solo una vez por interaccion
  if (music.paused) {
    music.play().catch(() => {/* autoplay blocked until user interacts */ });
  }
});

// --- BEAT (usa BPM de la cancion seleccionada) ---
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
    // Action on enter - you can use songs[curSelected].link to open funky maker or play detail
    const s = songs[curSelected];
    if (s && s.link) window.open(s.link, '_blank');
  }
});

// --- MAIN LOOP ---
let last = performance.now();
function loop(now) {
  const delta = (now - last) / 1000;
  last = now;

  // update visuals
  updateCircle(delta);
  applyLayoutSmooth(delta);
  updateBeat(delta);

  requestAnimationFrame(loop);
}

// start
loadSongs().then(() => {
  // ensure initial layout applied
  applySelectionImmediate();
  requestAnimationFrame(loop);
});