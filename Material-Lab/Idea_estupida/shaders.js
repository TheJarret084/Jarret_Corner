// shaders.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* ---------- Exports: stateful bindings ---------- */
export let shaders = [];            // lista de shader entries {id,name,code,material,lastError}
export let selectedShaderId = null;
export let hasImage = false;

/* ---------- DOM hooks ---------- */
const canvas = document.getElementById('shaderCanvas');
const statusText = document.getElementById('status-text');
const loaderBar = document.getElementById('loaderBar');
const shaderListEl = document.getElementById('shaderList');
const shaderCodeEl = document.getElementById('shaderCode');
const applyShaderBtn = document.getElementById('applyShaderBtn');
const removeShaderBtn = document.getElementById('removeShaderBtn');
const downloadBtn = document.getElementById('downloadBtn');
const intensitySlider = document.getElementById('intensitySlider');

/* ---------- THREE setup ---------- */
export let renderer, scene, camera, mesh;
let baseTexture = new THREE.Texture();
let compiling = false;

// initialization run once on module import:
(function initRenderer(){
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const MAX_W = Math.min(window.innerWidth, 1000);
    renderer.setSize(MAX_W, Math.round(MAX_W * 0.56), false);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1,1,1,-1,0,10);
    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(2,2);
    mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: baseTexture }));
    scene.add(mesh);

    window.addEventListener('resize', onResize);
    onResize();

    requestAnimationFrame(rafLoop);
})();

/* ---------- Helpers UI ---------- */
export function setStatus(text, important=false){
    statusText.textContent = text;
    statusText.style.color = important ? '#fff' : '#d0d0e0';
}
export function updateLoader(percent){ loaderBar.style.width = `${Math.max(0,Math.min(100,percent))}%`; }

export function enableApplyIfReady(){
    applyShaderBtn.disabled = !(hasImage && selectedShaderId !== null);
    removeShaderBtn.disabled = !(selectedShaderId !== null);
    downloadBtn.disabled = !hasImage;
}

/* ---------- Render shader list ---------- */
export function renderShaderList(){
    shaderListEl.innerHTML = '';
    shaders.forEach(s => {
        const li = document.createElement('li');
        li.className = 'shader-item';

        const title = document.createElement('div');
        title.className = 's-title';
        title.textContent = s.name;
        li.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 's-actions';

        const btnSelect = document.createElement('button');
        btnSelect.textContent = (selectedShaderId === s.id) ? 'Seleccionado' : 'Seleccionar';
        btnSelect.className = 'secondary';
        btnSelect.addEventListener('click', ()=> {
            selectedShaderId = s.id;
            shaderCodeEl.textContent = s.code;
            setStatus(`Shader seleccionado: ${s.name}`);
            renderShaderList();
            enableApplyIfReady();
        });

        const btnPreview = document.createElement('button');
        btnPreview.textContent = 'Ver código';
        btnPreview.className = 'ghost';
        btnPreview.addEventListener('click', ()=> {
            shaderCodeEl.textContent = s.code;
        });

        const btnTest = document.createElement('button');
        btnTest.textContent = 'Probar';
        btnTest.className = 'primary';
        btnTest.addEventListener('click', ()=> {
            applyShaderById(s.id, { selectAfter: true });
        });

        const btnDelete = document.createElement('button');
        btnDelete.textContent = 'Eliminar';
        btnDelete.className = 'danger';
        btnDelete.addEventListener('click', ()=> {
            shaders = shaders.filter(x => x.id !== s.id);
            if(selectedShaderId === s.id) selectedShaderId = null;
            shaderCodeEl.textContent = '';
            renderShaderList();
            enableApplyIfReady();
        });

        actions.appendChild(btnSelect);
        actions.appendChild(btnPreview);
        actions.appendChild(btnTest);
        actions.appendChild(btnDelete);
        li.appendChild(actions);
        shaderListEl.appendChild(li);
    });
}

/* ---------- Shader preamble & vertex shader ---------- */
const FRAG_PREAMBLE = `\
precision mediump float;
varying vec2 vUv;
uniform sampler2D bitmap;
uniform float iTime;
uniform float intensity;
uniform vec2 openfl_TextureSize;
#define openfl_TextureCoordv vUv
#define fragColor gl_FragColor
#define iChannel0 bitmap
#define flixel_texture2D texture2D
#define texture(a,b) texture2D(a,b)
`;

const VERTEX_SHADER = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* ---------- Create material from user code (robust) ---------- */
export async function createMaterialFromCode(userCode){
    // prepare final fragment shader text
    let frag = FRAG_PREAMBLE + "\n" + userCode + "\n";

    // If shader defines mainImage(...) but not void main -> create a Shadertoy-compatible wrapper
    if(/mainImage\s*\(/.test(userCode) && !/void\s+main\s*\(/.test(userCode)){
        frag += `
void main(){
    vec4 color = vec4(0.0);
    // Many mainImage signatures are: mainImage(out vec4, in vec2)
    // call with fragCoord = vUv * resolution
    mainImage(color, gl_FragCoord.xy);
    fragColor = color;
}`;
    } else if(!/void\s+main\s*\(/.test(userCode)){
        // fallback: show original texture if no main found
        frag += `\nvoid main(){ fragColor = texture2D(bitmap, vUv); }\n`;
    }

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            bitmap: { value: baseTexture },
            iTime: { value: 0.0 },
            intensity: { value: parseFloat(intensitySlider.value) || 1.0 },
            openfl_TextureSize: { value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) }
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: frag,
        transparent: true
    });

    // Force compile by rendering once (catch errors early)
    const old = mesh.material;
    try {
        mesh.material = mat;
        renderer.render(scene, camera);
        return mat;
    } catch (err) {
        mesh.material = old;
        throw err;
    }
}

/* ---------- Apply shader by id ---------- */
export async function applyShaderById(id, options = { selectAfter:false }){
    const entry = shaders.find(s => s.id === id);
    if(!entry) return;
    setStatus(`Compilando shader "${entry.name}"...`);
    updateLoader(6);
    compiling = true;

    try {
        const mat = await createMaterialFromCode(entry.code);
        updateLoader(60);
        entry.material = mat;
        entry.lastError = null;
        setStatus(`Shader "${entry.name}" compilado correctamente.`, true);
        updateLoader(100);
        if(options.selectAfter){
            selectedShaderId = id;
            shaderCodeEl.textContent = entry.code;
        }
        enableApplyIfReady();
    } catch (err) {
        entry.lastError = String(err && err.message ? err.message : err);
        shaderCodeEl.textContent = `ERROR: ${entry.lastError}\n\n--- Código del shader ---\n${entry.code}`;
        setStatus(`Error compilando "${entry.name}". Revisa el panel.`, true);
        console.error('Shader compile/render error:', err);
        updateLoader(0);
        // Revert to base texture
        mesh.material = new THREE.MeshBasicMaterial({ map: baseTexture });
    } finally {
        compiling = false;
        setTimeout(()=> updateLoader(0), 500);
    }
}

/* ---------- API to set base texture from files.js ---------- */
export function setBaseTexture(tex){
    baseTexture = tex;
    baseTexture.minFilter = THREE.LinearFilter;
    baseTexture.magFilter = THREE.LinearFilter;
    baseTexture.needsUpdate = true;

    // update uniforms and mesh material
    shaders.forEach(s => { if(s.material && s.material.uniforms && s.material.uniforms.bitmap) s.material.uniforms.bitmap.value = baseTexture; });
    if(mesh.material && mesh.material.map) mesh.material.map = baseTexture;
    mesh.material.needsUpdate = true;

    hasImage = true;
    enableApplyIfReady();
}

/* ---------- Animation & uniforms update ---------- */
function rafLoop(t){
    requestAnimationFrame(rafLoop);
    const time = t * 0.001;
    shaders.forEach(s => {
        if(s.material && s.material.uniforms){
            if('iTime' in s.material.uniforms) s.material.uniforms.iTime.value = time;
            if('intensity' in s.material.uniforms) s.material.uniforms.intensity.value = parseFloat(intensitySlider.value);
            if('bitmap' in s.material.uniforms) s.material.uniforms.bitmap.value = baseTexture;
            if('openfl_TextureSize' in s.material.uniforms){
                s.material.uniforms.openfl_TextureSize.value.set(renderer.domElement.width, renderer.domElement.height);
            }
        }
    });
    if(mesh.material && mesh.material.uniforms){
        if('iTime' in mesh.material.uniforms) mesh.material.uniforms.iTime.value = time;
        if('intensity' in mesh.material.uniforms) mesh.material.uniforms.intensity.value = parseFloat(intensitySlider.value);
        if('bitmap' in mesh.material.uniforms) mesh.material.uniforms.bitmap.value = baseTexture;
    }
    renderer.render(scene, camera);
}

/* ---------- Resize ---------- */
function onResize(){
    const maxW = Math.min(window.innerWidth - 24, 1000);
    const h = Math.max(240, Math.round(maxW * 0.56));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, (maxW < 480 ? 1.25 : 1.5));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(maxW, h, false);
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
}
