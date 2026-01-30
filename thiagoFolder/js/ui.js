// ui.js
// UI de Freeplay — arco horizontal real, loader, beat-zoom, salida
// Importa: { songs, getSong, count } desde data.js

import { songs, getSong, count } from './data.js';

/* =========================
   🔄 LOADER
========================= */
let loaderEl = null;
let loaderActive = false;

export function showLoader() {
    if (loaderActive) return;
    loaderActive = true;

    loaderEl = document.createElement('div');
    loaderEl.id = 'loadingScreen';
    loaderEl.innerHTML = `
        <div class="loader-circle"></div>
        <div class="loader-text">Loading songs...</div>
    `;
    document.body.appendChild(loaderEl);
}

export function hideLoader(force = false) {
    if (!loaderActive && !force) return;
    loaderActive = false;

    if (!loaderEl) return;
    loaderEl.classList.add('loading-hidden');
    setTimeout(() => {
        loaderEl?.remove();
        loaderEl = null;
    }, 700);
}

/* =========================
   📦 ESTADO GLOBAL
========================= */
let container = null;
let circleEl = null;
let items = [];
let curSelected = 0;

/* =========================
   👁️ VISIBILIDAD
========================= */
const VISIBLE_RANGE = 2; // 5 fichas visibles

/* =========================
   🌙 ARCO HORIZONTAL
========================= */
const ARC_RADIUS = 320;
const ARC_SPACING = 0.45;

/* =========================
   🔄 CÍRCULO CENTRAL
========================= */
let circleRot = 0;
let circleRotVel = 0;
const CIRCLE_DAMP = 6;

/* =========================
   🎥 CÁMARA / ZOOM
========================= */
let cameraZoom = 1;
let cameraZoomTarget = 1;
const ZOOM_DECAY = 4;

/* =========================
   🚪 SALIDA
========================= */
let exiting = false;
let exitCallback = null;
let exitProgress = 0;
const EXIT_SPEED = 0.9;

/* =========================
   🧰 UTILS
========================= */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

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

/* =========================
   🧱 INIT UI
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

    container.style.transformOrigin = '50% 50%';
    container.style.willChange = 'transform';
}

/* =========================
   🎵 CREAR CANCIONES
========================= */
export function spawnSongs() {
    container.querySelectorAll('.song-item')?.forEach(n => n.remove());
    items = [];

    songs.forEach((song, i) => {
        const item = createSongItem(song, i);
        container.appendChild(item);
        items.push(item);
        initItemState(item);
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
    item.appendChild(box);

    const icon = document.createElement('div');
    icon.className = 'song-icon';
    icon.style.backgroundImage = `url("assets/icons/${song.icon || 'default.png'}")`;
    icon.style.backgroundSize = '300px 150px';
    icon.style.backgroundPosition = '0px 0px';
    item.appendChild(icon);

    const title = document.createElement('div');
    title.className = 'song-name';
    title.textContent = song.name || 'Unknown';
    item.appendChild(title);

    item.addEventListener('click', () => setSelection(i));
    return item;
}

function initItemState(item) {
    item._state = {
        x: 0, xTarget: 0,
        y: -700, yTarget: -700,
        scale: 1, scaleTarget: 1,
        opacity: 0, opacityTarget: 0
    };

    item.style.visibility = 'hidden';
    item.style.pointerEvents = 'none';
    item.style.willChange = 'transform, opacity';
}

/* =========================
   🎯 SELECCIÓN
========================= */
export function setSelection(index) {
    const len = count();
    if (!len) return;

    index = (index + len) % len;
    const diff = index - curSelected;

    if (diff !== 0) {
        circleRotVel += diff * 18;
    }

    curSelected = index;
    applySelectionImmediate();
}

export function getSelected() {
    return curSelected;
}

export function applySelectionImmediate() {
    document.querySelectorAll('.song-item').forEach(n => {
        const idx = Number(n.dataset.index);
        const icon = n.querySelector('.song-icon');
        icon.style.backgroundPosition =
            idx === curSelected ? '-150px 0px' : '0px 0px';
    });
}

/* =========================
   🔁 UPDATE LAYOUT (ARCO REAL)
========================= */
export function updateLayout(delta) {
    const nodes = Array.from(document.querySelectorAll('.song-item'));
    const len = count() || 1;

    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2 + 40;

    nodes.forEach((node, i) => {
        const s = node._state;
        const diff = computeDiff(i, curSelected, len);
        const visible = Math.abs(diff) <= VISIBLE_RANGE;

        if (visible) {
            const ang = diff * ARC_SPACING;
            s.xTarget = Math.cos(ang) * ARC_RADIUS;
            s.yTarget = Math.sin(ang) * ARC_RADIUS * 0.55;
            s.scaleTarget = diff === 0 ? 1.08 : 0.85;
            s.opacityTarget = diff === 0 ? 1 : 0.85;
        } else {
            s.xTarget = 0;
            s.yTarget = -900;
            s.scaleTarget = 0.8;
            s.opacityTarget = 0;
        }

        if (exiting) {
            s.yTarget += 900 * (1 + exitProgress * 2);
            s.opacityTarget = 0;
        }

        const t = 0.14;
        s.x = lerp(s.x, s.xTarget, t);
        s.y = lerp(s.y, s.yTarget, t);
        s.scale = lerp(s.scale, s.scaleTarget, t);
        s.opacity = lerp(s.opacity, s.opacityTarget, t);

        node.style.transform = `
            translate(-50%, -50%)
            translate(${cx + s.x}px, ${cy + s.y}px)
            scale(${s.scale})
        `;
        node.style.opacity = s.opacity;
        node.style.zIndex = 100 - Math.abs(diff);

        node.style.visibility = visible ? 'visible' : 'hidden';
        node.style.pointerEvents = visible ? 'auto' : 'none';
    });

    cameraZoom = lerp(cameraZoom, cameraZoomTarget, Math.min(1, ZOOM_DECAY * delta));
    container.style.transform = `scale(${cameraZoom})`;

    if (exiting) {
        exitProgress += EXIT_SPEED * delta;
        if (exitProgress >= 1) {
            exiting = false;
            exitCallback?.();
            exitCallback = null;
            exitProgress = 0;
        }
    }
}

/* =========================
   🔄 CÍRCULO CENTRAL
========================= */
export function updateCircle(delta) {
    circleRot += circleRotVel * delta;
    circleRotVel = lerp(circleRotVel, 0, Math.min(1, CIRCLE_DAMP * delta));
    circleEl.style.transform = `translateX(-50%) rotate(${circleRot}deg)`;
}

/* =========================
   💓 BEAT PULSE
========================= */
export function triggerBeatPulse() {
    cameraZoomTarget = 1.08;
    setTimeout(() => cameraZoomTarget = 1, 140);
}

/* =========================
   🚪 SALIDA
========================= */
export function startExit(cb) {
    if (exiting) return;
    exiting = true;
    exitCallback = cb;
    exitProgress = 0;
    circleRotVel += 120;
}

/* =========================
   🧪 DEBUG
========================= */
export function getItems() {
    return items.slice();
}
export function isExiting() {
    return exiting;
}
