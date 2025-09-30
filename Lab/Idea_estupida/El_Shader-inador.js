import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvasContainer = document.getElementById('shaderCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvasContainer, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,10);
camera.position.z = 1;

let texture = new THREE.Texture();
let material;
const geometry = new THREE.PlaneGeometry(2,2);
let mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
scene.add(mesh);

function animate(time){
    if(material){
        material.uniforms.iTime.value = time*0.001;
        if(material.uniforms.intensity){
            material.uniforms.intensity.value = parseFloat(document.getElementById('intensitySlider').value);
        }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

// Cargar imagen
document.getElementById('imageInput').addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(url, tex=>{
        texture = tex;
        if(material) material.uniforms.bitmap.value = texture;
        else mesh.material.map = texture;
    });
});

// Cargar shader
document.getElementById('shaderInput').addEventListener('change', async e=>{
    const file = e.target.files[0];
    if(!file) return;
    const shaderText = await file.text();

    material = new THREE.ShaderMaterial({
        uniforms: {
            bitmap: { value: texture },
            iTime: { value: 0 },
            intensity: { value: parseFloat(document.getElementById('intensitySlider').value) },
            openfl_TextureSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        fragmentShader: shaderText
    });

    mesh.material = material;
});

// Slider de intensidad
document.getElementById('intensitySlider').addEventListener('input', e=>{
    if(material && material.uniforms.intensity){
        material.uniforms.intensity.value = parseFloat(e.target.value);
    }
});

// Resize
window.addEventListener('resize', ()=>{
    renderer.setSize(window.innerWidth, window.innerHeight);
    if(material) material.uniforms.openfl_TextureSize.value.set(window.innerWidth, window.innerHeight);
});