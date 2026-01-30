// ui.js
// Freeplay UI — arco horizontal estilo FNF
// Importa: { songs, getSong, count } desde data.js

import { songs, count } from './data.js';

/* =========================
   LOADER
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
   ESTADO GENERAL
========================= */

let container = null;
let circleEl = null;
let curSelected = 0;
let items = [];

/* visibles: centro ±2 = 5 */
const VISIBLE_RANGE = 2;

/* arco */
const ARC_RADIUS = 360;
const ARC_ANGLE_STEP = 22;

/* círculo */
let circleRot = 0;
let circleRotVel = 0;
const CIRCLE_DAMP = 6;

/* zoom beat */
let cameraZoom = 1;
let cameraZoomTarget = 1;
const ZOOM_DECAY = 4;

/* salida */
let exiting = false;
let exitCallback = null;
let exitProgress = 0;
const EXIT_SPEED = 0.9;

/* =========================
   UTIL
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
   INIT
========================= */

export function initUI(containerId = 'freeplay') {
    container = document.getElementById(containerId);
    if (!container) throw new Error(`#${containerId} not found`);

    if (!document.getElementById('menuCircle')) {
        const c = document.createElement('div');
        c.id = 'menuCircle';
        c.className = 'menu-circle';
        container.appendChild(c);
    }

    circleEl = document.getElementById('menuCircle');

    container.style.transformOrigin = '50% 50%';
    container.style.willChange = 'transform';
}

/* =========================
   SPAWN
========================= */

export function spawnSongs() {
    container.querySelectorAll('.song-item')?.forEach(n => n.remove());
    items = [];

    songs.forEach((song, i) => {
        const item = createSongItem(song, i);
        container.appendChild(item);
        initItemState(item);
        items.push(item);
    });

    applySelectionImmediate();
}

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
    icon.style.backgroundSize = '300px 150px';
    item.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'song-name';
    name.textContent = song.name || 'Unknown';
    item.appendChild(name);

    const info = document.createElement('div');
    info.className = 'song-info';
    info.textContent = song.info || '';
    item.appendChild(info);

    const mech = document.createElement('div');
    mech.className = 'song-mechanics';
    mech.textContent = song.bpm ? `${song.bpm} BPM` : '';
    item.appendChild(mech);

    item.addEventListener('click', () => setSelection(i));

    return item;
}

function initItemState(item) {
    item._state = {
        x: 0,
        y: -800,
        xTarget: 0,
        yTarget: -800,
        scale: 0.9,
        scaleTarget: 0.9,
        opacity: 0,
        opacityTarget: 0
    };

    item.style.transform =
        'translate(-50%, -50%) translate(0px, -800px) scale(0.9)';
    item.style.opacity = 0;
    item.style.visibility = 'hidden';
    item.style.pointerEvents = 'none';
}

/* =========================
   SELECCIÓN
========================= */

export function setSelection(index) {
    const len = count();
    if (!len) return;

    if (index < 0) index = (index + len) % len;
    if (index >= len) index %= len;

    const diff = index - curSelected;
    if (diff !== 0) circleRotVel += diff * 18;

    curSelected = index;
    applySelectionImmediate();
}

export function getSelected() {
    return curSelected;
}

function applySelectionImmediate() {
    document.querySelectorAll('.song-item').forEach(el => {
        const idx = Number(el.dataset.index);
        el.classList.toggle('selected', idx === curSelected);

        const icon = el.querySelector('.song-icon');
        if (icon) {
            icon.style.backgroundPosition =
                idx === curSelected ? '-150px 0px' : '0px 0px';
        }
    });
}

/* =========================
   UPDATE LAYOUT (ARCO REAL)
========================= */

export function updateLayout(delta) {
    const len = count() || 1;

    items.forEach((item, i) => {
        const s = item._state;
        const diff = computeDiff(i, curSelected, len);
        const visible = Math.abs(diff) <= VISIBLE_RANGE;

        if (visible) {
            const angle = diff * ARC_ANGLE_STEP * (Math.PI / 180);
            const ARC_HEIGHT = 140; // altura del arco (panza)


            s.xTarget = Math.sin(angle) * ARC_RADIUS;
            s.yTarget = (1 - Math.cos(angle)) * ARC_HEIGHT;

            s.scaleTarget = diff === 0 ? 1.08 : 0.9;
            s.opacityTarget = diff === 0 ? 1 : 0.5;

            item.style.zIndex = diff === 0 ? 10 : 5 - Math.abs(diff);
            item.style.visibility = 'visible';
            item.style.pointerEvents = 'auto';
        } else {
            s.xTarget = 0;
            s.yTarget = -900;
            s.scaleTarget = 0.9;
            s.opacityTarget = 0;

            item.style.zIndex = 0;
            item.style.visibility = 'hidden';
            item.style.pointerEvents = 'none';
        }

        if (exiting) {
            s.yTarget += 900 * (1 + exitProgress * 2);
            s.opacityTarget = 0;
        }

        s.x = lerp(s.x, s.xTarget, 0.12);
        s.y = lerp(s.y, s.yTarget, 0.12);
        s.scale = lerp(s.scale, s.scaleTarget, 0.12);
        s.opacity = lerp(s.opacity, s.opacityTarget, 0.12);

        item.style.transform =
            `translate(-50%, -50%) translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
        item.style.opacity = s.opacity;
    });

    cameraZoom = lerp(cameraZoom, cameraZoomTarget, Math.min(1, ZOOM_DECAY * delta));
    container.style.transform = `scale(${cameraZoom})`;

    if (exiting) {
        exitProgress += EXIT_SPEED * delta;
        if (exitProgress >= 1) {
            exiting = false;
            exitProgress = 0;
            exitCallback?.();
            exitCallback = null;
        }
    }
}

/* =========================
   CIRCLE
========================= */

export function updateCircle(delta) {
    circleRot += circleRotVel * delta;
    circleRotVel = lerp(circleRotVel, 0, Math.min(1, CIRCLE_DAMP * delta));

    circleEl.style.transform =
        `translateX(-50%) rotate(${circleRot}deg)`;
}

/* =========================
   BEAT
========================= */

export function triggerBeatPulse() {
    cameraZoomTarget = 1.08;
    setTimeout(() => (cameraZoomTarget = 1), 140);
}

/* =========================
   EXIT
========================= */

export function startExit(cb) {
    if (exiting) return;
    exiting = true;
    exitCallback = cb;
    exitProgress = 0;
    circleRotVel += 120;
}
