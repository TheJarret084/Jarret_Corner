// ui.js
import { songs, count } from './data.js';

let container = null;
let curSelected = 0;
let circleEl = null;

/* =========================
   INIT
========================= */

export function initUI(containerId = 'freeplay') {
    container = document.getElementById(containerId);
    if (!container) throw new Error(`#${containerId} not found`);

    if (!document.getElementById('menuCircle')) {
        const circ = document.createElement('div');
        circ.id = 'menuCircle';
        circ.className = 'menu-circle';
        container.appendChild(circ);
    }

    circleEl = document.getElementById('menuCircle');
}

/* =========================
   SPAWN SONGS
========================= */

export function spawnSongs() {
    if (!container) throw new Error('UI not initialized');

    container.querySelectorAll('.song-item').forEach(n => n.remove());

    songs.forEach((song, i) => {
        const item = createSongItem(song, i);
        container.appendChild(item);
    });

    applySelectionImmediate();

    // 🔥 CLAVE: layout inicial
    updateLayout(1);
}

/* =========================
   CREATE ITEM
========================= */

function createSongItem(song, i) {
    const item = document.createElement('div');
    item.className = 'song-item';
    item.dataset.index = i;

    const box = document.createElement('img');
    box.className = 'song-box';
    box.src = 'assets/images/freeplaybox.png';
    item.appendChild(box);

    const icon = document.createElement('div');
    icon.className = 'song-icon';
    icon.style.backgroundImage = `url("assets/icons/${song.icon || 'default.png'}")`;
    item.appendChild(icon);

    const title = document.createElement('div');
    title.className = 'song-name';
    title.textContent = song.name || 'Unknown';
    item.appendChild(title);

    const info = document.createElement('div');
    info.className = 'song-info';
    info.textContent = song.info || '';
    item.appendChild(info);

    const bpm = document.createElement('div');
    bpm.className = 'song-mechanics';
    bpm.textContent = song.bpm ? `${song.bpm} BPM` : '';
    item.appendChild(bpm);

    item._state = {
        y: 0,
        yTarget: 0,
        angle: 0,
        angleTarget: 0,
        scale: 1,
        scaleTarget: 1,
        opacity: 1,
        opacityTarget: 1,
        icon
    };

    item.addEventListener('click', () => setSelection(i));
    return item;
}

/* =========================
   SELECTION
========================= */

export function setSelection(index) {
    const len = count();
    if (!len) return;

    curSelected = (index + len) % len;
    applySelectionImmediate();
}

function applySelectionImmediate() {
    document.querySelectorAll('.song-item').forEach(node => {
        const idx = Number(node.dataset.index);
        node.classList.toggle('selected', idx === curSelected);
        node.classList.toggle('dim', idx !== curSelected);

        const icon = node._state.icon;
        icon.style.backgroundPosition =
            idx === curSelected ? '0px 0px' : '-150px 0px';
    });
}

/* =========================
   LAYOUT MATH (FNF STYLE)
========================= */

function computeDiff(i, cur, len) {
    let diff = i - cur;
    const half = Math.floor(len / 2);

    if (diff < -half) diff += len;
    if (diff > half) diff -= len;

    return diff;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/* =========================
   UPDATE LOOP
========================= */

export function updateLayout(delta) {
    const nodes = document.querySelectorAll('.song-item');
    const len = count() || 1;

    nodes.forEach((node, i) => {
        const s = node._state;
        const diff = computeDiff(i, curSelected, len);
        const d = Math.max(-3, Math.min(3, diff));

        s.yTarget = d * 120;
        s.angleTarget = d * 10;
        s.scaleTarget = d === 0 ? 1.05 : 0.88;
        s.opacityTarget = d === 0 ? 1 : 0.4;

        s.y = lerp(s.y, s.yTarget, 0.15);
        s.angle = lerp(s.angle, s.angleTarget, 0.15);
        s.scale = lerp(s.scale, s.scaleTarget, 0.15);
        s.opacity = lerp(s.opacity, s.opacityTarget, 0.15);

        node.style.transform =
            `translate(-50%, -50%) translateY(${s.y}px) rotate(${s.angle}deg) scale(${s.scale})`;

        node.style.opacity = s.opacity;
    });
}
