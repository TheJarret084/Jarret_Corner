// ui.js (entrypoint)
import { applyShaderById, renderShaderList, enableApplyIfReady, setStatus, updateLoader, shaders, selectedShaderId, mesh, renderer, scene, camera } from './shaders.js';
import { loadImageFile, addShaderFile } from './files.js';

/* ---------- UI hooks ---------- */
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
const shaderCodeEl = document.getElementById('shaderCode');
const dropHintBtn = document.getElementById('btnDropHint');

/* ---------- Apply selected shader permanently ---------- */
applyShaderBtn.addEventListener('click', async ()=>{
    // selectedShaderId is kept in shaders.js. We find the selected entry.
    const entry = shaders.find(s => s.id === selectedShaderId);
    if(!entry){
        setStatus('No hay shader seleccionado.', true);
        return;
    }
    setStatus('Aplicando shader seleccionado...');
    updateLoader(5);
    try {
        if(!entry.material) await applyShaderById(entry.id, { selectAfter:true });
        if(entry.material){
            entry.material.uniforms.bitmap.value = mesh.material.map || entry.material.uniforms.bitmap.value;
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
        // render one final frame
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

// Drag & drop handlers
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

/* ---------- Remove selected shader ---------- */
removeShaderBtn.addEventListener('click', ()=>{
    if(!selectedShaderId) return;
    const idx = shaders.findIndex(s => s.id === selectedShaderId);
    if(idx >= 0) shaders.splice(idx,1);
    // clear selection and UI
    // selectedShaderId is in shaders.js; update by re-rendering (renderShaderList will update displayed state)
    // to avoid direct circular writes, rely on UI state: set selectedShaderId to null by rendering logic
    // We'll force a render
    renderShaderList();
    enableApplyIfReady();
    shaderCodeEl.textContent = '';
    setStatus('Shader eliminado.');
});

/* ---------- Init ---------- */
setStatus('Listo. Selecciona imagen y agrega shaders, o toca "Arrastrar / Tocar aquí".');
renderShaderList();
enableApplyIfReady();
