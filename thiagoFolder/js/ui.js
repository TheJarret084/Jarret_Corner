// ui.js
// UI de Freeplay — layout, circle, beat-zoom, salida (exiting)
// Importa: { songs, getSong, count } desde data.js

import { songs, getSong, count } from './data.js';

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

let container = null;
let curSelected = 0;
let circleEl = null;
let items = []; // referencia a los .song-item creados

// CONFIG: mostramos centro ± VISIBLE_RANGE (=> total VISIBLE_COUNT = 2*VISIBLE_RANGE+1)
const VISIBLE_RANGE = 0; // muestra 5 fichas (2 a cada lado + la central)
const VISIBLE_COUNT = VISIBLE_RANGE * 2 + 1;

// CÍRCULO
let circleRot = 0;
let circleRotVel = 0;
const CIRCLE_DAMP = 6;

// CAMARA / ZOOM (pulso en beat)
let cameraZoom = 1;
let cameraZoomTarget = 1;
const ZOOM_DECAY = 4;

// EXIT (salida animada)
let exiting = false;
let exitCallback = null;
let exitProgress = 0;
const EXIT_SPEED = 0.9;

// UTIL
function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * computeDiff: devuelve diff circular (mismo algoritmo que Haxe)
 */
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

// Inicializa UI y asegura el menuCircle
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

// Crea DOM de canciones desde songs[] (data.js)
export function spawnSongs() {
    if (!container) throw new Error('UI not initialized (call initUI)');
    container.querySelectorAll('.song-item')?.forEach(n => n.remove());
    items = [];

    // crear todos los elementos (pero solo 5 se verán)
    songs.forEach((song, i) => {
        const item = createSongItem(song, i);
        container.appendChild(item);
        items.push(item);
        initItemState(item);
    });

    applySelectionImmediate();
}

// crea un elemento song-item
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
    title.textContent = song.name || song.displayName || 'Unknown';
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

    return item;
}

// estado animación por item
function initItemState(item) {
    item._state = {
        angle: 0, angleTarget: 0,
        y: -700, yTarget: -700,
        scale: 1, scaleTarget: 1,
        opacity: 0, opacityTarget: 0,
        lastDiff: 0,
        visible: false
    };
    item.style.willChange = 'transform, opacity';
    // situar inicialmente por encima del círculo (no visible)
    item.style.transform = `translate(-50%, -50%) translateY(${-700}px)`;
    item.style.opacity = 0;
    item.style.pointerEvents = 'none';
    item.style.visibility = 'hidden';
}

// SELECCIÓN
export function setSelection(index) {
    const len = count();
    if (len === 0) return;
    if (index < 0) index = (index + len) % len;
    if (index >= len) index = index % len;

    // calcular impulso de círculo (smallest diff)
    const diffRaw = index - curSelected;
    if (diffRaw !== 0) {
        let half = Math.floor(len / 2);
        let smallDiff = diffRaw;
        if (smallDiff < 0) {
            smallDiff -= half;
            smallDiff %= len;
            smallDiff += half;
        } else {
            smallDiff += half;
            smallDiff %= len;
            smallDiff -= half;
        }
        circleRotVel += smallDiff * 18;
    }

    curSelected = index;
    applySelectionImmediate();
}

export function getSelected() { return curSelected; }

// aplica selección visual inmediata
export function applySelectionImmediate() {
    const nodes = document.querySelectorAll('.song-item');
    nodes.forEach(n => n.classList.remove('selected', 'dim'));
    const sel = document.querySelector(`.song-item[data-index="${curSelected}"]`);
    if (sel) sel.classList.add('selected');

    nodes.forEach(node => {
        const idx = Number(node.dataset.index);
        const iconEl = node.querySelector('.song-icon');
        if (!iconEl) return;
        // frame ON cuando esté centrado (ajusta según tu spritesheet)
        iconEl.style.backgroundPosition = (idx === curSelected) ? '-150px 0px' : '0px 0px';
    });
}

/**
 * updateLayout: calcula targets por diff, hace lerp y aplica transform a cada item.
 * Solo VISIBLE_COUNT estarán visibles; las demás se mandan arriba del círculo.
 */
export function updateLayout(delta) {
    const nodes = Array.from(document.querySelectorAll('.song-item'));
    const len = count() || nodes.length || 1;

    // dimensiones de referencia para esconder arriba del circle
    const hideAboveY = - (circleEl?.clientHeight ?? 600) - 200; // encima del menu-circle

    nodes.forEach((node, i) => {
        const s = node._state;
        if (!s) return;

        const actualDiff = computeDiff(i, curSelected, len);

        // visible si |diff| <= VISIBLE_RANGE
        const visible = Math.abs(actualDiff) <= VISIBLE_RANGE;

        // si visible, remitimos diff-clamped a [-VISIBLE_RANGE, VISIBLE_RANGE]
        const diff = visible ? actualDiff : (actualDiff > 0 ? VISIBLE_RANGE + 1 : - (VISIBLE_RANGE + 1));

        // Si estaba en otro side y saltó, invertir ángulo para efecto
        if (Math.abs(s.lastDiff - actualDiff) > (VISIBLE_RANGE + 1)) {
            s.angle = -s.angle;
        }
        s.lastDiff = actualDiff;

        if (visible) {
            // targets para los que sí se ven (distribución radial/lineal alrededor del centro)
            // Ajustes: angleStep y yStep pueden cambiar la "curvatura"
            const angleStep = 18; // grados por paso
            const yStep = 110;    // px por paso

            s.angleTarget = actualDiff * angleStep;
            s.yTarget = actualDiff * yStep;
            s.scaleTarget = (actualDiff === 0) ? 1.06 : 0.88;
            s.opacityTarget = (actualDiff === 0) ? 1 : 0.9; // un poco más opaco para adyacentes
        } else {
            // ocultar fuera del círculo (y arriba)
            s.angleTarget = 0;
            s.yTarget = hideAboveY;
            s.scaleTarget = 0.9;
            s.opacityTarget = 0;
        }

        // si estamos en salida, empuja hacia abajo
        if (exiting) {
            s.yTarget += 800 * (1 + exitProgress * 2);
            s.opacityTarget = 0;
        }

        // LERP
        const lerpFactor = 0.12;
        s.angle = lerp(s.angle, s.angleTarget, lerpFactor);
        s.y = lerp(s.y, s.yTarget, lerpFactor);
        s.scale = lerp(s.scale, s.scaleTarget, lerpFactor);
        s.opacity = lerp(s.opacity, s.opacityTarget, lerpFactor);

        // aplicar transform
        node.style.transform = `translate(-50%, -50%) translateY(${s.y}px) rotate(${s.angle}deg) scale(${s.scale})`;
        node.style.opacity = s.opacity;

        // visibilidad y pointer-events
        if (Math.abs(actualDiff) <= VISIBLE_RANGE) {
            node.style.visibility = 'visible';
            node.style.pointerEvents = 'auto';
            node.classList.remove('dim');
        } else {
            node.style.visibility = 'hidden'; // no se ve y no ocupa clicks
            node.style.pointerEvents = 'none';
            node.classList.add('dim');
        }
    });

    // camera zoom decay
    cameraZoom = lerp(cameraZoom, cameraZoomTarget, Math.min(1, ZOOM_DECAY * delta));
    if (container) container.style.transform = `scale(${cameraZoom})`;

    // salida
    if (exiting) {
        exitProgress += EXIT_SPEED * delta;
        if (exitProgress >= 1) {
            exiting = false;
            const cb = exitCallback;
            exitCallback = null;
            exitProgress = 0;
            if (typeof cb === 'function') cb();
        }
    }
}

/**
 * updateCircle: integra la rotación con amortiguación
 */
export function updateCircle(delta) {
    if (!circleEl) circleEl = document.getElementById('menuCircle');
    if (!circleEl) return;

    circleRot += circleRotVel * delta;
    circleRotVel = lerp(circleRotVel, 0, Math.min(1, CIRCLE_DAMP * delta));

    circleEl.style.transform = `translateX(-50%) rotate(${circleRot}deg)`;
}

/**
 * Trigger visual de beat -> aplica un pulso de zoom
 */
export function triggerBeatPulse() {
    cameraZoomTarget = 1.08;
    setTimeout(() => { cameraZoomTarget = 1; }, 140);
}

/**
 * startExit: iniciar la animación de salida
 */
export function startExit(cb) {
    if (exiting) return;
    exiting = true;
    exitCallback = cb;
    exitProgress = 0;
    circleRotVel += 120;
}

/** Helpers debug */
export function getItems() { return items.slice(); }
export function isExiting() { return exiting; }
