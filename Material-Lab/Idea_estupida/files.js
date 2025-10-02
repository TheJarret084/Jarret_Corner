// files.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { setStatus, updateLoader, shaders, renderShaderList, applyShaderById, setBaseTexture } from './shaders.js';

/* ---------- Load image file and set as base texture ---------- */
export function loadImageFile(file){
    return new Promise((resolve,reject)=>{
        setStatus('Cargando imagen: ' + file.name);
        updateLoader(2);

        const url = URL.createObjectURL(file);
        const loader = new THREE.TextureLoader();

        loader.load(url, tex => {
            // Hand off the texture to shaders module
            setBaseTexture(tex);

            setStatus('Imagen cargada: ' + file.name, true);
            updateLoader(100);
            setTimeout(()=> updateLoader(0), 400);
            resolve();
            // revoke URL after short while
            setTimeout(()=> URL.revokeObjectURL(url), 2000);
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

/* ---------- Read shader file and add to list ---------- */
export async function addShaderFile(file){
    setStatus('Leyendo shader: ' + file.name);
    updateLoader(3);
    try {
        const code = await file.text();
        const id = Math.random().toString(36).slice(2,9);
        const entry = { id, name: file.name, code, material: null, lastError: null };
        shaders.push(entry);
        renderShaderList();
        setStatus('Shader añadido: ' + file.name, true);
        updateLoader(100);
        // try to compile in background quickly
        setTimeout(()=> applyShaderById(id, { selectAfter:false }), 120);
    } catch(err){
        setStatus('Error leyendo shader: ' + (err.message || err), true);
        updateLoader(0);
    }
}
