// El_Shader-inador.js (arreglado y con descarga)
// Import three as module
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* ---------- UI hooks ---------- */
const canvas = document.getElementById('shaderCanvas');
const btnSelectImage = document.getElementById('btnSelectImage');
const btnSelectShader = document.getElementById('btnSelectShader');
const fileImageInput = document.getElementById('imageInput');
const fileShaderInput = document.getElementById('shaderInput');
const applyShaderBtn = document.getElementById('applyShaderBtn');
const removeShaderBtn = document.getElementById('removeShaderBtn');
const downloadBtn = document.getElementById('downloadBtn');
const intensitySlider = document.getElementById('intensitySlider');
const loaderBar = document.getElementById('loaderBar');
const statusText = document.getElementById('status-text');
const shaderListEl = document.getElementById('shaderList');
const shaderCodeEl = document.getElementById('shaderCode');
const dropHintBtn = document.getElementById('btnDropHint');

/* ---------- Three.js setup ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const MAX_W = Math.min(window.innerWidth, 1000);
renderer.setSize(MAX_W, Math.round(MAX_W * 0.56), false);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,10);
camera.position.z = 1;

const geometry = new THREE.PlaneGeometry(2,2);
let baseTexture = new THREE.Texture();
let mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: baseTexture }));
scene.add(mesh);

/* ---------- State ---------- */
let shaders = []; // { id,name,code,material,lastError }
let selectedShaderId = null;
let hasImage = false;
let compiling = false;

/* ---------- Helpers ---------- */
function setStatus(text, important=false){
    statusText.textContent = text;
    statusText.style.color = important ? '#fff' : '#d0d0e0';
}
function updateLoader(percent){ loaderBar.style.width = `${Math.max(0,Math.min(100,percent))}%`; }
function enableApplyIfReady(){ applyShaderBtn.disabled = !(hasImage && selectedShaderId !== null); removeShaderBtn.disabled = !(selectedShaderId !== null); downloadBtn.disabled = !hasImage; }

/* ---------- UI: render shader list ---------- */
function renderShaderList(){
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

/* ---------- Shader preamble & helpers ---------- */
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

// Vertex shader sets vUv
const VERTEX_SHADER = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* ---------- Create material from user code ---------- */
async function createMaterialFromCode(userCode){
    // prepare final fragment shader:
    let frag = FRAG_PREAMBLE + "\n" + userCode + "\n";
    // if user code defines mainImage(...) but not void main, add wrapper:
    if(/mainImage\s*\(/.test(userCode) && !/void\s+main\s*\(/.test(userCode)){
        // wrapper that calls mainImage (many shadertoy-like shaders use mainImage)
        frag += `\nvoid main(){ mainImage(); }\n`;
    } else if(!/void\s+main\s*\(/.test(userCode)){
        // ensure a main exists; if not, create a safe main that samples bitmap
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

    // Force compile by rendering once (catch errors)
    const old = mesh.material;
    try {
        mesh.material = mat;
        renderer.render(scene, camera);
        // keep mat assigned (successful compile)
        return mat;
    } catch (err) {
        // restore old and rethrow
        mesh.material = old;
        throw err;
    }
}

/* ---------- Apply shader by id ---------- */
async function applyShaderById(id, options = { selectAfter:false }){
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
        setStatus(`Error compilando "${entry.name}": revisa la consola y el panel.`, true);
        console.error('Shader compile/render error:', err);
        updateLoader(0);
        mesh.material = new THREE.MeshBasicMaterial({ map: baseTexture });
    } finally {
        compiling = false;
        setTimeout(()=> updateLoader(0), 500);
    }
}

/* ---------- Apply selected shader permanently ---------- */
applyShaderBtn.addEventListener('click', async ()=>{
    if(!selectedShaderId) return;
    const entry = shaders.find(s => s.id === selectedShaderId);
    if(!entry) return;
    setStatus('Aplicando shader seleccionado...');
    updateLoader(5);
    try {
        if(!entry.material) await applyShaderById(entry.id, { selectAfter:true });
        if(entry.material){
            entry.material.uniforms.bitmap.value = baseTexture;
            mesh.material = entry.material;
            setStatus(`Shader "${entry.name}" aplicado.`, true);
            updateLoader(100);
            setTimeout(()=> updateLoader(0), 600);
            downloadBtn.disabled = false;
        }
    } catch (err) {
        setStatus('Error al aplicar shader: ' + (err.message || err), true);
        updateLoader(0);
    }
});

/* ---------- Download canvas as PNG ---------- */
downloadBtn.addEventListener('click', ()=>{
    try {
        // ensure rendering final frame
        renderer.render(scene, camera);
        const dataURL = renderer.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'El_Shader-inador.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus('Descarga iniciada.', true);
    } catch (err) {
        setStatus('Error al descargar: ' + (err.message || err), true);
    }
});

/* ---------- File loading & drag/drop ---------- */
btnSelectImage.addEventListener('click', ()=> fileImageInput.click());
btnSelectShader.addEventListener('click', ()=> fileShaderInput.click());

fileImageInput.addEventListener('change', async (evt)=>{
    const f = evt.target.files[0];
    if(!f) return;
    await loadImageFile(f);
});
fileShaderInput.addEventListener('change', async (evt)=>{
    const f = evt.target.files[0];
    if(!f) return;
    await addShaderFile(f);
});

// Drag & drop handlers (desktop + some mobile browsers)
['dragover','dragenter'].forEach(ev=>{
    document.body.addEventListener(ev, e=> { e.preventDefault(); dropHintBtn.style.opacity = '0.9'; }, {passive:false});
});
['dragleave','drop'].forEach(ev=>{
    document.body.addEventListener(ev, e=> { e.preventDefault(); dropHintBtn.style.opacity = '0.6'; }, {passive:false});
});
document.body.addEventListener('drop', async e=>{
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    for(const f of files){
        if(f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)){
            await loadImageFile(f);
        } else if(/\.frag$/i.test(f.name) || /\.(glsl|txt)$/i.test(f.name) || f.type.startsWith('text/')){
            await addShaderFile(f);
        } else {
            setStatus('Archivo no soportado: ' + f.name, true);
        }
    }
});

/* ---------- Load image ---------- */
function loadImageFile(file){
    return new Promise((resolve,reject)=>{
        setStatus('Cargando imagen: ' + file.name);
        updateLoader(2);

        const url = URL.createObjectURL(file);
        const loader = new THREE.TextureLoader();

        loader.load(url, tex => {
            baseTexture = tex;
            baseTexture.minFilter = THREE.LinearFilter;
            baseTexture.magFilter = THREE.LinearFilter;
            baseTexture.needsUpdate = true;
            // update all compiled materials' bitmap uniform
            shaders.forEach(s => { if(s.material && s.material.uniforms && s.material.uniforms.bitmap) s.material.uniforms.bitmap.value = baseTexture; });
            // also update mesh basic material if used
            if(mesh.material && mesh.material.map) mesh.material.map = baseTexture;
            mesh.material.needsUpdate = true;
            hasImage = true;
            setStatus('Imagen cargada: ' + file.name, true);
            updateLoader(100);
            enableApplyIfReady();
            setTimeout(()=> updateLoader(0), 400);
            resolve();
        }, xhr=>{
            if(xhr && xhr.lengthComputable){
                updateLoader(Math.round((xhr.loaded/xhr.total)*90));
            }
        }, err=>{
            setStatus('Error cargando imagen', true);
            updateLoader(0);
            reject(err);
        });
    });
}

/* ---------- Add shader file ---------- */
async function addShaderFile(file){
    setStatus('Leyendo shader: ' + file.name);
    updateLoader(3);
    try {
        const code = await file.text();
        if(!/(void\s+main\s*\(|mainImage\s*\(|void\s+mainImage\s*\()/i.test(code) && !/gl_FragColor|fragColor|mainImage/i.test(code)){
            setStatus('Atención: el shader puede no tener una función main típica. Igual se añadió.', true);
        }
        const id = Math.random().toString(36).slice(2,9);
        const entry = { id, name: file.name, code, material: null, lastError: null };
        shaders.push(entry);
        renderShaderList();
        setStatus('Shader añadido: ' + file.name, true);
        updateLoader(100);
        // try compile in background to show possible errors
        setTimeout(()=> applyShaderById(id, { selectAfter:false }), 120);
    } catch(err){
        setStatus('Error leyendo shader: ' + (err.message || err), true);
        updateLoader(0);
    }
}

/* ---------- Remove selected shader ---------- */
removeShaderBtn.addEventListener('click', ()=>{
    if(!selectedShaderId) return;
    shaders = shaders.filter(s => s.id !== selectedShaderId);
    selectedShaderId = null;
    shaderCodeEl.textContent = '';
    renderShaderList();
    enableApplyIfReady();
    setStatus('Shader eliminado.');
});

/* ---------- Animation loop (update uniforms) ---------- */
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
requestAnimationFrame(rafLoop);

/* ---------- Resize handling ---------- */
function onResize(){
    const maxW = Math.min(window.innerWidth - 24, 1000);
    const h = Math.max(240, Math.round(maxW * 0.56));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, (maxW < 480 ? 1.25 : 1.5));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(maxW, h, false);
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
    shaders.forEach(s=>{
        if(s.material && s.material.uniforms && s.material.uniforms.openfl_TextureSize){
            s.material.uniforms.openfl_TextureSize.value.set(renderer.domElement.width, renderer.domElement.height);
        }
    });
}
window.addEventListener('resize', onResize);
onResize();

/* ---------- Init ---------- */
setStatus('Listo. Selecciona imagen y agrega shaders, o toca "Arrastrar / Tocar aquí".');
renderShaderList();
enableApplyIfReady();