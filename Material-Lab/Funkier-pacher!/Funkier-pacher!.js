// funkier-combined.js
// Procesa: (1) imagen + XML -> frames -> spritesheet; (2) ZIP de PNGs -> agrupa secuencias -> spritesheets.
// SOLO cintas (spritesheets). Opción: quitar frames duplicados.
// Requiere: JSZip (ya incluido en HTML).

document.addEventListener('DOMContentLoaded', () => {
  /* ===== DOM ===== */
  const imageBtn = document.getElementById('image-btn');
  const xmlBtn = document.getElementById('xml-btn');
  const zipBtn = document.getElementById('zip-btn');
  const generateBtn = document.getElementById('generate-btn');
  const downloadAgainBtn = document.getElementById('download-again');

  const imageInput = document.getElementById('image-input');
  const xmlInput = document.getElementById('xml-input');
  const zipInput = document.getElementById('zip-input');

  const dropZone = document.getElementById('drop-zone');
  const statusText = document.getElementById('status-text');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');

  const resultPanel = document.getElementById('result-panel');
  const resultContent = document.getElementById('result-content');

  const removeDuplicatesCheckbox = document.getElementById('remove-duplicates');

  /* ===== Estado ===== */
  const state = {
    imageFile: null,
    xmlFile: null,
    zipFile: null,
    lastDownloadUrl: null,
    lastFileName: null
  };

  /* ===== Processor (XML -> frames & spritesheet/ZIP) ===== */
  class FunkierPacker {
    constructor(){ this.frames = []; }
    async processFiles(imageFile, xmlFile, onProgress = ()=>{}) {
      this.frames = [];
      const img = await this._loadImage(imageFile);
      const xmlText = await xmlFile.text();
      const atlas = this._parseXML(xmlText);
      const total = atlas.frames.length || 1;
      for (let i=0;i<atlas.frames.length;i++){
        const f = atlas.frames[i];
        const canvas = this._cutFrame(img, f);
        const blob = await this._canvasToBlob(canvas);
        this.frames.push({ name: f.name, blob, width:canvas.width, height:canvas.height });
        onProgress((i+1)/total);
      }
      return this.frames;
    }
    async generateSpritesheet(){
      if(this.frames.length===0) throw new Error('No hay frames procesados');
      const widths = this.frames.map(f=>f.width||64);
      const heights = this.frames.map(f=>f.height||64);
      const maxW = Math.max(...widths);
      const maxH = Math.max(...heights);
      const canvas = document.createElement('canvas');
      canvas.width = maxW * this.frames.length;
      canvas.height = maxH;
      const ctx = canvas.getContext('2d');
      for(let i=0;i<this.frames.length;i++){
        await new Promise(resolve => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, i*maxW, 0); resolve(); };
          img.onerror = () => resolve();
          img.src = URL.createObjectURL(this.frames[i].blob);
        });
      }
      const blob = await new Promise(res => canvas.toBlob(res));
      return { blob, fileName:'spritesheet.png', canvas, width:canvas.width, height:canvas.height };
    }
    async generateZipSheets(namedBlobArray) {
      const zip = new JSZip();
      namedBlobArray.forEach(nb => zip.file(nb.name, nb.blob));
      const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' });
      return { blob, fileName:'cintas_spritesheets.zip' };
    }
    _loadImage(file){
      return new Promise((res,rej)=>{
        const i = new Image();
        i.onload = ()=>res(i);
        i.onerror = rej;
        i.src = URL.createObjectURL(file);
      });
    }
    _parseXML(xmlText){
      const p = new DOMParser();
      const xml = p.parseFromString(xmlText,'text/xml');
      const nodes = Array.from(xml.querySelectorAll('SubTexture'));
      return { frames: nodes.map(n=>({
        name: n.getAttribute('name') || 'frame',
        x: parseInt(n.getAttribute('x')||0),
        y: parseInt(n.getAttribute('y')||0),
        width: parseInt(n.getAttribute('width')||0),
        height: parseInt(n.getAttribute('height')||0)
      }))};
    }
    _cutFrame(img, frame){
      const c = document.createElement('canvas');
      c.width = frame.width;
      c.height = frame.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, 0,0, frame.width, frame.height);
      return c;
    }
    _canvasToBlob(canvas){ return new Promise(res => canvas.toBlob(res)); }
  }

  const processor = new FunkierPacker();

  /* ===== Bind botones ===== */
  imageBtn.addEventListener('click', ()=> imageInput.click());
  xmlBtn.addEventListener('click', ()=> xmlInput.click());
  zipBtn.addEventListener('click', ()=> zipInput.click());

  imageInput.addEventListener('change', ()=>{
    if(imageInput.files.length>0){ state.imageFile = imageInput.files[0]; statusText.textContent = `Imagen: ${state.imageFile.name}`; updateGenerateState(); }
  });
  xmlInput.addEventListener('change', ()=>{
    if(xmlInput.files.length>0){ state.xmlFile = xmlInput.files[0]; statusText.textContent = `XML: ${state.xmlFile.name}`; updateGenerateState(); }
  });
  zipInput.addEventListener('change', ()=>{
    if(zipInput.files.length>0){ state.zipFile = zipInput.files[0]; statusText.textContent = `ZIP: ${state.zipFile.name}`; updateGenerateState(); }
  });

  /* Drag & drop */
  ['dragover','dragenter'].forEach(e => dropZone.addEventListener(e, (ev)=>{ ev.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave','dragend','drop'].forEach(e => dropZone.addEventListener(e, (ev)=>{ ev.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (ev)=>{
    const files = ev.dataTransfer.files;
    if(files.length>0 && files[0].name.toLowerCase().endsWith('.zip')){
      zipInput.files = files;
      state.zipFile = files[0];
      statusText.textContent = `ZIP: ${state.zipFile.name}`;
      updateGenerateState();
    }
  });

  generateBtn.addEventListener('click', async ()=>{
    clearResults();
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    try{
      if(state.zipFile){
        await processZipFile(state.zipFile);
      } else if(state.imageFile && state.xmlFile){
        await processImageXml(state.imageFile, state.xmlFile);
      } else {
        statusText.textContent = 'Selecciona imagen+XML o un ZIP primero.';
      }
    } catch(err){
      console.error(err);
      statusText.textContent = `Error: ${err.message || err}`;
    }
  });

  downloadAgainBtn.addEventListener('click', ()=>{
    if(state.lastDownloadUrl && state.lastFileName){
      const a = document.createElement('a');
      a.href = state.lastDownloadUrl;
      a.download = state.lastFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });

  function updateGenerateState(){
    generateBtn.disabled = !( (state.imageFile && state.xmlFile) || state.zipFile );
  }

  function clearResults(){
    resultContent.innerHTML = '';
    resultPanel.style.display = 'none';
    state.lastDownloadUrl = null; state.lastFileName = null;
    downloadAgainBtn.style.display = 'none';
  }

  /* ===== ZIP processing ===== */
  async function processZipFile(file){
    statusText.textContent = 'Leyendo ZIP...';
    const zip = await JSZip.loadAsync(file);
    const { imageGroups, singleImages } = await organizeImages(zip);
    const totalItems = Object.keys(imageGroups).length + singleImages.length || 1;
    let processed = 0;
    const previews = [];
    const sheetBlobs = [];

    // single images -> convert to single-frame spritesheet (1 frame)
    for(const single of singleImages){
      statusText.textContent = `Procesando imagen: ${single.name}`;
      const blob = await single.entry.async('blob');
      const imgBitmap = await createImageBitmap(blob);
      // create a 1-frame spritesheet (same image)
      const { blob:sheetBlob, canvas } = await createSpritesheet([imgBitmap], imgBitmap.width, imgBitmap.height);
      const name = sanitizeFilename(single.name.replace(/\.png$/i,'') + '.png');
      sheetBlobs.push({ name, blob:sheetBlob });
      previews.push({ name: name.replace('.png',''), url: URL.createObjectURL(sheetBlob), frames:1, width:canvas.width, height:canvas.height });
      processed++; updateProgress(processed, totalItems);
    }

    // animation groups
    for(const [animName, files] of Object.entries(imageGroups)){
      statusText.textContent = `Procesando animación: ${animName}`;
      const res = await processAnimationSequence(animName, files, removeDuplicatesCheckbox.checked);
      sheetBlobs.push({ name: res.filename, blob: res.blob });
      previews.push(res.preview);
      processed++; updateProgress(processed, totalItems);
    }

    // generar ZIP con todas las cintas
    statusText.textContent = 'Creando ZIP con cintas...';
    const zipRes = await processor.generateZipSheets(sheetBlobs);
    state.lastDownloadUrl = URL.createObjectURL(zipRes.blob);
    state.lastFileName = `cintas_${file.name.replace(/\.zip$/i,'')}.zip`;
    downloadAgainBtn.style.display = 'inline-block';
    state.lastDownloadUrl = URL.createObjectURL(zipRes.blob); state.lastFileName = `cintas_${file.name.replace(/\.zip$/i,'')}.zip`;

    displayResults(previews);
    statusText.textContent = '¡Listo! Descarga disponible.';
    progressBar.style.width = '100%';
  }

  async function organizeImages(zip){
    const temp = {};
    const singleImages = [];
    for(const [filename, entry] of Object.entries(zip.files)){
      if(!filename.toLowerCase().endsWith('.png')) continue;
      const base = filename.slice(0,-4);
      const match = base.match(/^(.*?)(\d+)?$/);
      if(!match) continue;
      const [, baseName, frameNumber] = match;
      const normalized = baseName.replace(/[_-]$/,'');
      if(!temp[normalized]) temp[normalized] = [];
      temp[normalized].push({ name: filename, frameNumber: frameNumber ? parseInt(frameNumber) : 0, entry });
    }
    for(const [k, files] of Object.entries(temp)){
      if(files.length===1 && files[0].frameNumber===0){
        singleImages.push({ name: files[0].name, entry: files[0].entry });
      } else {
        imageGroupsSafeAdd(temp, k, files);
      }
    }
    // we need to return imageGroups properly (temp contains both)
    const imageGroups = {};
    for(const [k, files] of Object.entries(temp)){
      if(files.length>1 || (files.length===1 && files[0].frameNumber!==0)) imageGroups[k] = files;
    }
    return { imageGroups, singleImages };
  }

  function imageGroupsSafeAdd(obj, key, files){
    if(!obj[key]) obj[key] = files;
    else obj[key] = obj[key].concat(files);
  }

  async function processAnimationSequence(animName, files, shouldRemoveDuplicates){
    files.sort((a,b)=>a.frameNumber-b.frameNumber);
    const imageEntries = await Promise.all(files.map(async f=>{
      const blob = await f.entry.async('blob');
      const img = await createImageBitmap(blob);
      return { img, blob, frameNumber: f.frameNumber };
    }));

    // remove duplicates optionally (compare with previous kept)
    let unique = imageEntries;
    let duplicatesRemoved = 0;
    if(shouldRemoveDuplicates && imageEntries.length>1){
      unique = [imageEntries[0]];
      for(let i=1;i<imageEntries.length;i++){
        const curr = imageEntries[i];
        const prev = unique[unique.length-1];
        if(!(await areImagesEqualBitmap(curr.img, prev.img))){
          unique.push(curr);
        } else duplicatesRemoved++;
      }
    }

    const imgs = unique.map(e=>e.img);
    const maxW = Math.max(...imgs.map(i=>i.width));
    const maxH = Math.max(...imgs.map(i=>i.height));
    const { blob, canvas } = await createSpritesheet(imgs, maxW, maxH);
    const cleanName = sanitizeFilename(animName) + '.png';
    const preview = { name: animName, url: URL.createObjectURL(blob), frames: imgs.length, width: canvas.width, height: canvas.height };
    return { filename: cleanName, blob, preview, duplicatesRemoved };
  }

  /* ===== Image utilities ===== */
  async function createSpritesheet(images, maxWidth, maxHeight){
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth * images.length;
    canvas.height = maxHeight;
    const ctx = canvas.getContext('2d');
    images.forEach((img, idx) => {
      const x = idx*maxWidth + Math.round((maxWidth - img.width)/2);
      const y = Math.round((maxHeight - img.height)/2);
      ctx.drawImage(img, x, y);
    });
    const blob = await new Promise(res => canvas.toBlob(res));
    return { blob, canvas };
  }

  async function areImagesEqualBitmap(a, b){
    if(a.width !== b.width || a.height !== b.height) return false;
    const d1 = getImageDataFromBitmap(a);
    const d2 = getImageDataFromBitmap(b);
    // getImageDataFromBitmap returns Uint8ClampedArray, but drawn synchronously so wrap in Promise
    const [data1, data2] = await Promise.all([d1, d2]);
    for(let i=0;i<data1.length;i+=4){
      if(data1[i] !== data2[i] || data1[i+1] !== data2[i+1] || data1[i+2] !== data2[i+2] || data1[i+3] !== data2[i+3]) return false;
    }
    return true;
  }

  function getImageDataFromBitmap(img){
    return new Promise(res=>{
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img,0,0);
      res(ctx.getImageData(0,0,c.width,c.height).data);
    });
  }

  /* ===== Image+XML processing ===== */
  async function processImageXml(imageFile, xmlFile){
    statusText.textContent = 'Procesando imagen + XML...';
    const frames = await processor.processFiles(imageFile, xmlFile, p => {
      progressBar.style.width = `${Math.round(p*100)}%`;
      statusText.textContent = `Procesando: ${Math.round(p*100)}%`;
    });
    // generate spritesheet
    const sheet = await processor.generateSpritesheet();
    // use filename from image (without extension)
    const base = (imageFile.name||'spritesheet').replace(/\.[^/.]+$/,'');
    const fileName = sanitizeFilename(base) + '.png';
    // create a zip with the single spritesheet
    const sheets = [{ name: fileName, blob: sheet.blob }];
    const zipRes = await processor.generateZipSheets(sheets);
    state.lastDownloadUrl = URL.createObjectURL(zipRes.blob);
    state.lastFileName = `cintas_${base}.zip`;
    downloadAgainBtn.style.display = 'inline-block';
    // previews: individual frames and the generated spritesheet preview
    const previews = frames.map(f => ({ name: f.name, url: URL.createObjectURL(f.blob), frames:1, width:f.width, height:f.height }));
    previews.unshift({ name: base + ' (spritesheet)', url: URL.createObjectURL(sheet.blob), frames: frames.length, width: sheet.width, height: sheet.height });
    displayResults(previews);
    statusText.textContent = '¡Listo! Descarga disponible.';
    progressBar.style.width = '100%';
  }

  /* ===== UI render ===== */
  function displayResults(previews){
    resultPanel.style.display = 'block';
    resultContent.innerHTML = '';
    previews.sort((a,b) => a.name.localeCompare(b.name));
    previews.forEach(p => {
      const el = document.createElement('div'); el.className = 'spritesheet-preview';
      const thumb = document.createElement('div'); thumb.className = 'preview-image-container';
      const img = document.createElement('img'); img.src = p.url; img.alt = p.name;
      thumb.appendChild(img);
      const info = document.createElement('div'); info.style.flex='1';
      const title = document.createElement('strong'); title.textContent = p.name;
      const meta = document.createElement('div'); meta.style.color = 'rgba(255,255,255,0.78)'; meta.style.fontSize='0.92rem';
      meta.textContent = p.frames>1 ? `${p.frames} frames • spritesheet ${p.width}×${p.height}` : `Tamaño: ${p.width}×${p.height}`;
      const dlBtn = document.createElement('button'); dlBtn.className='btn'; dlBtn.textContent = 'Descargar';
      dlBtn.addEventListener('click', ()=> {
        const a = document.createElement('a'); a.href = p.url; a.download = sanitizeFilename(p.name) + (p.name.toLowerCase().endsWith('.png') ? '' : '.png');
        document.body.appendChild(a); a.click(); a.remove();
      });
      info.appendChild(title); info.appendChild(meta); info.appendChild(dlBtn);
      el.appendChild(thumb); el.appendChild(info);
      resultContent.appendChild(el);
    });
  }

  function updateProgress(current, total){
    const pct = Math.round((current/total)*100);
    progressBar.style.width = `${pct}%`;
  }

  /* ===== Helpers ===== */
  function sanitizeFilename(name){
    return name.replace(/[\/\\:\*\?"<>\|]/g,'_');
  }
});
