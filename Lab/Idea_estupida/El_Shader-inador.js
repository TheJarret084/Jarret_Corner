// El Shader-inador.js (Mobile-adapted)
// Usa three.module.js desde CDN
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* ---------- UI hooks ---------- */
const canvas = document.getElementById('shaderCanvas');
const btnSelectImage = document.getElementById('btnSelectImage');
const btnSelectShader = document.getElementById('btnSelectShader');
const fileImageInput = document.getElementById('imageInput');
const fileShaderInput = document.getElementById('shaderInput');
const applyShaderBtn = document.getElementById('applyShaderBtn');
const removeShaderBtn = document.getElementById('removeShaderBtn');
const intensitySlider = document.getElementById('intensitySlider');
const loaderBar = document.getElementById('loaderBar');
const statusText = document.getElementById('status-text');
const shaderListEl = document.getElementById('shaderList');
const shaderCodeEl = document.getElementById('shaderCode');
const dropHintBtn = document.getElementById('btnDropHint');

/* ---------- Three.js setup (mobile-tuned) ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // limit pixel ratio for perf
const MAX_WIDTH = Math.min(window.innerWidth, 1000);
renderer.setSize(MAX_WIDTH, Math.round(MAX_WIDTH * 0.56), false);

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

/* ---------- Helpers (UI) ---------- */
function setStatus(text, important=false){
    statusText.textContent = text;
    statusText.style.color = important ? '#fff' : '#d0d0e0';
}
function updateLoader(percent){ loaderBar.style.width = `${Math.max(0,Math.min(100,percent))}%`; }
function enableApplyIfReady(){ applyShaderBtn.disabled = !(hasImage && selectedShaderId !== null); removeShaderBtn.disabled = !(selectedShaderId !== null); }

/* ---------- Render shader list ---------- */
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

/* ---------- Create material (compile) ---------- */
async function createMaterialFromCode(code){
    // standard uniforms for common shaders
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            bitmap: { value: baseTexture },
            iTime: { value: 0.0 },
            intensity: { value: parseFloat(intensitySlider.value) || 1.0 },
            openfl_TextureSize: { value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) }
        },
        fragmentShader: code,
        transparent: true
    });

    // try force compile by rendering once
    try {
        // assign temporarily and render to force compile errors
        const old = mesh.material;
        mesh.material = mat;
        renderer.render(scene, camera);
        // restore old only if compile succeeded
        // (we keep mat assigned; if later error occurs it will be caught)
        return mat;
    } catch (err) {
        // restore fallback
        mesh.material = new THREE.MeshBasicMaterial({ map: baseTexture });
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
        // store
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
        entry.lastError = String(err.message || err);
        shaderCodeEl.textContent = `ERROR: ${entry.lastError}\n\n--- Código del shader ---\n${entry.code}`;
        setStatus(`Error compilando "${entry.name}": ${entry.lastError}`, true);
        updateLoader(0);
        mesh.material = new THREE.MeshBasicMaterial({ map: baseTexture });
    } finally {
        compiling = false;
        setTimeout(()=> updateLoader(0), 500);
    }
}

/* ---------- Apply selected shader (permanent) ---------- */
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
        }
    } catch (err) {
        setStatus('Error al aplicar shader: ' + (err.message || err), true);
        updateLoader(0);
    }
});

/* ---------- File loading & drag/drop (mobile-aware) ---------- */
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

// Drag & drop: desktop + some mobile browsers support
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
        } else if(/\.frag$/i.test(f.name) || f.type.startsWith('text/')){
            await addShaderFile(f);
        } else {
            setStatus('Archivo no soportado: ' + f.name, true);
        }
    }
});

/* ---------- Load image helper ---------- */
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
            mesh.material.map = baseTexture;
            mesh.material.needsUpdate = true;
            hasImage = true;
            setStatus('Imagen cargada: ' + file.name, true);
            updateLoader(100);
            enableApplyIfReady();
            setTimeout(()=> updateLoader(0), 400);
            resolve();
        }, xhr=>{
            if(xhr && xhr.lengthComputable){
                updateLoader(Math.round((xhr.loaded/xhr.total)*80));
            }
        }, err=>{
            setStatus('Error cargando imagen', true);
            updateLoader(0);
            reject(err);
        });
    });
}

/* ---------- Add shader helper ---------- */
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

        // compile in background (light delay)
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

/* ---------- Resize handling (mobile friendly) ---------- */
function onResize(){
    const maxW = Math.min(window.innerWidth - 24, 1000);
    const h = Math.max(240, Math.round(maxW * 0.56));
    // For mobile performance, lower resolution when small screen
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