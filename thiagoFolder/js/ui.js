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

    loaderEl.classList.add('hide');
    setTimeout(() => {
        loaderEl?.remove();
        loaderEl = null;
    }, 300);
}


let container = null;
let curSelected = 0;
let circleEl = null;
let items = []; // referencia a los .song-item creados

// CÍRCULO
let circleRot = 0;
let circleRotVel = 0; // velocidad (impulso por diff)
const CIRCLE_DAMP = 6; // amortiguación de la rotación

// CAMARA / ZOOM (pulso en beat)
let cameraZoom = 1;
let cameraZoomTarget = 1;
const ZOOM_DECAY = 4;

// EXIT (salida animada)
let exiting = false;
let exitCallback = null;
let exitProgress = 0; // 0..1
const EXIT_SPEED = 0.9; // factor para acelerar salida

// UTIL
function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * computeDiff: idéntico al Haxe -> devuelve diff circular entre item i y current
 * devuelve (i - cur) estilo original, pero adaptado al uso
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

// Inicializa UI y asegura el menucircle
export function initUI(containerId = 'freeplay') {
    container = document.getElementById(containerId);
    if (!container) throw new Error(`#${containerId} not found`);

    // crear circle si no existe
    if (!document.getElementById('menuCircle')) {
        const circ = document.createElement('div');
        circ.id = 'menuCircle';
        circ.className = 'menu-circle';
        container.appendChild(circ);
    }
    circleEl = document.getElementById('menuCircle');

    // transform origin para hacer zoom tipo "camera"
    container.style.transformOrigin = '50% 50%';
    container.style.willChange = 'transform';
}

// Crea DOM de canciones desde songs[] (data.js)
export function spawnSongs() {
    if (!container) throw new Error('UI not initialized (call initUI)');
    // remove previous song-items (no tocar menuCircle u overlays)
    container.querySelectorAll('.song-item')?.forEach(n => n.remove());
    items = [];

    songs.forEach((song, i) => {
        const item = createSongItem(song, i);
        container.appendChild(item);
        items.push(item);
        initItemState(item);
    });

    // aplicar selección visual inmediata
    applySelectionImmediate();
}

// crea un elemento song-item (estructura HTML)
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

    // optional category
    const category = document.createElement('div');
    category.className = 'song-category';
    category.textContent = song.category ? `Category: ${song.category}` : '';
    item.appendChild(category);

    // click para seleccionar
    item.addEventListener('click', () => setSelection(i));

    return item;
}

// estado animación por item (similar a lo que describiste)
function initItemState(item) {
    item._state = {
        angle: 0, angleTarget: 0,
        y: 0, yTarget: 0,
        scale: 1, scaleTarget: 1,
        opacity: 1, opacityTarget: 1,
        lastDiff: 0
    };

    // will-change para performance
    item.style.willChange = 'transform, opacity';
}

// SELECCIÓN (wrapping seguro)
export function setSelection(index) {
    const len = count();
    if (len === 0) return;
    if (index < 0) index = (index + len) % len;
    if (index >= len) index = index % len;

    // si hubo cambio, dar impulso al círculo
    const diff = index - curSelected;
    if (diff !== 0) {
        // compute shortest diff for impulse
        let half = Math.floor(len / 2);
        let smallDiff = diff;
        if (smallDiff < 0) {
            smallDiff -= half;
            smallDiff %= len;
            smallDiff += half;
        } else {
            smallDiff += half;
            smallDiff %= len;
            smallDiff -= half;
        }
        // impulso proporcional
        circleRotVel += smallDiff * 18; // tweakable
    }

    curSelected = index;
    applySelectionImmediate();
}

export function getSelected() {
    return curSelected;
}

// aplica selección visual inmediata (clase, sprite frame)
export function applySelectionImmediate() {
    const nodes = document.querySelectorAll('.song-item');
    nodes.forEach(n => n.classList.remove('selected', 'dim'));
    const sel = document.querySelector(`.song-item[data-index="${curSelected}"]`);
    if (sel) sel.classList.add('selected');

    // actualizar icon frame (sprite 2 frames: 0 = off, -150px = on)
    nodes.forEach(node => {
        const idx = Number(node.dataset.index);
        const iconEl = (node._state && node._state.iconEl) ? node._state.iconEl : node.querySelector('.song-icon');
        if (!iconEl) return;
        // Ponemos el frame "ON" cuando esté centrado
        iconEl.style.backgroundPosition = (idx === curSelected) ? '-150px 0px' : '0px 0px';
        // guardar referencia si no estaba
        if (!node._state.iconEl) node._state.iconEl = iconEl;
    });
}

/**
 * updateLayout: calcula targets por diff, hace lerp y aplica transform a cada item.
 * También maneja cameraZoom decay y salida (exiting).
 */
export function updateLayout(delta) {
    const nodes = Array.from(document.querySelectorAll('.song-item'));
    const len = count() || nodes.length || 1;

    nodes.forEach((node, i) => {
        const s = node._state;
        if (!s) return;

        let diff = computeDiff(i, curSelected, len);

        // clamp a [-3, 3]
        if (diff > 3) diff = 3;
        if (diff < -3) diff = -3;

        // flip angle si cruzó de lado (mismo comportamiento que Haxe)
        if (Math.abs(s.lastDiff - diff) > 3) {
            s.angle = -s.angle;
        }
        s.lastDiff = diff;

        // TARGETS (idénticos a la conversión Haxe)
        s.angleTarget = diff * 45; // grados
        s.yTarget = diff * 120;    // px
        s.scaleTarget = (diff === 0) ? 1.06 : 0.88;
        s.opacityTarget = (diff === 0) ? 1 : 0.4;

        // si estamos en salida, empuja a todos hacia abajo
        if (exiting) {
            // aumenta la Y target para que salgan hacia abajo
            s.yTarget += 800 * (1 + exitProgress * 2);
            s.opacityTarget = 0;
        }

        // LERP (suavizado)
        const lerpFactor = 0.12; // constante similar al ejemplo
        s.angle = lerp(s.angle, s.angleTarget, lerpFactor);
        s.y = lerp(s.y, s.yTarget, lerpFactor);
        s.scale = lerp(s.scale, s.scaleTarget, lerpFactor);
        s.opacity = lerp(s.opacity, s.opacityTarget, lerpFactor);

        // apply transform
        node.style.transform = `translate(-50%, -50%) translateY(${s.y}px) rotate(${s.angle}deg) scale(${s.scale})`;
        node.style.opacity = s.opacity;
    });

    // camera zoom decay (se va a cameraZoomTarget)
    cameraZoom = lerp(cameraZoom, cameraZoomTarget, Math.min(1, ZOOM_DECAY * delta));
    // aplicar zoom sobre el contenedor
    if (container) {
        container.style.transform = `scale(${cameraZoom})`;
    }

    // exit progress update (si está en salida)
    if (exiting) {
        exitProgress += EXIT_SPEED * delta;
        if (exitProgress >= 1) {
            // terminó la animación, llamar callback si existe
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

    // aplicar vel/ic on rot
    circleRot += circleRotVel * delta;
    // amortiguar
    circleRotVel = lerp(circleRotVel, 0, Math.min(1, CIRCLE_DAMP * delta));

    circleEl.style.transform = `translateX(-50%) rotate(${circleRot}deg)`;
}

/**
 * Trigger visual de beat -> aplica un pulso de zoom (llámalo desde audio.updateBeat o main)
 */
export function triggerBeatPulse() {
    // pulso corto
    cameraZoomTarget = 1.08;
    // volverá a 1 por decay en updateLayout
    // también se puede animar con setTimeout si prefieres:
    setTimeout(() => { cameraZoomTarget = 1; }, 140);
}

/**
 * Inicia salida animada (exiting). callback se ejecuta cuando termina.
 */
export function startExit(cb) {
    if (exiting) return;
    exiting = true;
    exitCallback = cb;
    exitProgress = 0;

    // añade una pequeña rotación final
    circleRotVel += 120;
}

/** Helpers para debug / test */
export function getItems() {
    return items.slice();
}

export function isExiting() {
    return exiting;
}
