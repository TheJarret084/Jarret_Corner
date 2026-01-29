// ui.js
import { songs, getSong, count } from './data.js';

let container = null;
let curSelected = 0;
let circleEl = null;

export function initUI(containerId = 'freeplay') {
    container = document.getElementById(containerId);
    if (!container) throw new Error(`#${containerId} not found`);
    // ensure circle exists
    if (!document.getElementById('menuCircle')) {
        const circ = document.createElement('div');
        circ.id = 'menuCircle';
        circ.className = 'menu-circle';
        container.appendChild(circ);
    }
    circleEl = document.getElementById('menuCircle');
}

export function spawnSongs() {
    if (!container) throw new Error('UI not initialized (call initUI)');
    container.querySelectorAll('.song-item')?.forEach(n => n.remove());
    // append songs
    songs.forEach((song, i) => {
        const item = createSongItem(song, i);
        container.appendChild(item);
    });
    applySelectionImmediate();
}

function createSongItem(song, i) {
    const item = document.createElement('div');
    item.className = 'song-item';
    item.dataset.index = i;
    item.style.background = song.color ?? '#444';

    const box = document.createElement('img');
    box.className = 'song-box';
    box.src = 'assets/images/freeplaybox.png';
    box.alt = '';
    item.appendChild(box);

    const iconWrap = document.createElement('div');
    iconWrap.className = 'song-icon';
    const iconPath = song.icon ? `assets/icons/${song.icon}` : 'assets/icons/default.png';
    iconWrap.style.backgroundImage = `url("${iconPath}")`;
    iconWrap.style.backgroundPosition = '0px 0px';
    iconWrap.style.backgroundSize = '300px 150px';
    item.appendChild(iconWrap);

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

    const category = document.createElement('div');
    category.className = 'song-category';
    category.textContent = song.category ? `Category: ${song.category}` : '';
    item.appendChild(category);

    item.addEventListener('click', () => setSelection(i));

    // animation state
    item._state = {
        angle: 0, angleTarget: 0,
        y: 0, yTarget: 0,
        scale: 1, scaleTarget: 1,
        opacity: 1, iconEl: iconWrap
    };

    return item;
}

export function setSelection(index) {
    const len = count();
    if (len === 0) return;
    if (index < 0) index = (index + len) % len;
    if (index >= len) index = index % len;
    curSelected = index;
    applySelectionImmediate();
}

export function getSelected() {
    return curSelected;
}

export function applySelectionImmediate() {
    const nodes = document.querySelectorAll('.song-item');
    nodes.forEach(n => n.classList.remove('selected', 'dim'));
    const sel = document.querySelector(`.song-item[data-index="${curSelected}"]`);
    if (sel) sel.classList.add('selected');

    nodes.forEach(node => {
        const idx = Number(node.dataset.index);
        const iconEl = (node._state && node._state.iconEl) ? node._state.iconEl : node.querySelector('.song-icon');
        if (!iconEl) return;
        iconEl.style.backgroundPosition = (idx === curSelected) ? '0px 0px' : '-150px 0px';
    });
}

// layout math copied from earlier (arc)
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

function lerp(a, b, t) { return a + (b - a) * t; }

export function updateLayout(delta) {
    const nodes = Array.from(document.querySelectorAll('.song-item'));
    const len = count() || 1;
    nodes.forEach((node, i) => {
        const s = node._state;
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

let circleRot = 0;
export function updateCircle(delta) {
    if (!circleEl) circleEl = document.getElementById('menuCircle');
    if (!circleEl) return;
    circleRot += delta * 10;
    circleEl.style.transform = `translateX(-50%) rotate(${circleRot}deg)`;
}