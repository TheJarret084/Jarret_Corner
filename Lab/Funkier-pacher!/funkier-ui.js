document.addEventListener('DOMContentLoaded', () => {
    const imageBtn = document.getElementById('image-btn');
    const xmlBtn = document.getElementById('xml-btn');
    const zipBtn = document.getElementById('zip-btn');
    const generateBtn = document.getElementById('generate-btn');
    const statusText = document.getElementById('status-text');
    const resultPanel = document.getElementById('result-panel');

    const imageInput = document.getElementById('image-input');
    const xmlInput = document.getElementById('xml-input');
    const zipInput = document.getElementById('zip-input');

    let state = {
        mode: 'packer',
        imageFile: null,
        xmlFile: null,
        zipFile: null
    };

    const packer = new FunkierPacker();

    // ======== Botones ========
    imageBtn.addEventListener('click', () => imageInput.click());
    xmlBtn.addEventListener('click', () => xmlInput.click());
    zipBtn?.addEventListener('click', () => zipInput.click());

    // Inputs
    imageInput.addEventListener('change', () => { 
        if(imageInput.files.length>0){
            state.mode='packer';
            state.imageFile=imageInput.files[0]; 
            checkReady();
            statusText.textContent = "Imagen seleccionada: " + state.imageFile.name;
        }
    });
    xmlInput.addEventListener('change', () => { 
        if(xmlInput.files.length>0){
            state.xmlFile=xmlInput.files[0]; 
            checkReady();
            statusText.textContent = "XML seleccionado: " + state.xmlFile.name;
        }
    });
    zipInput?.addEventListener('change', () => {
        if(zipInput.files.length>0){
            state.mode='zip';
            state.zipFile=zipInput.files[0];
            generateBtn.disabled=false;
            statusText.textContent="ZIP seleccionado: " + state.zipFile.name;
        }
    });

    function checkReady(){
        if(state.mode==='packer') generateBtn.disabled=!(state.imageFile && state.xmlFile);
    }

    // ======== Generar ========
    generateBtn.addEventListener('click', async () => {
        resultPanel.innerHTML='';
        if(state.mode==='packer') await runPacker();
        else await runZip();
    });

    // ------------------- Funciones -------------------
    async function runPacker(){
        try{
            statusText.textContent="Procesando PNG + XML...";
            const frames = await packer.processFiles(state.imageFile,state.xmlFile,{},()=>{});
            const animGroups = groupFrames(frames);
            await createTiras(animGroups,state.imageFile.name);
        }catch(err){
            statusText.textContent='Error: '+err.message;
            console.error(err);
        }
    }

    async function runZip(){
        try{
            statusText.textContent="Procesando ZIP de frames...";
            const zip = await JSZip.loadAsync(state.zipFile);
            const framesList=[];

            for(const [filename,entry] of Object.entries(zip.files)){
                if(!filename.toLowerCase().endsWith('.png')) continue;
                framesList.push({name:filename.slice(0,-4), entry});
            }

            const animGroups={};
            for(const f of framesList){
                const match=f.name.match(/^(.*?)(\d+)$/);
                if(!match) continue;
                const baseName=match[1].trim();
                const frameNumber=parseInt(match[2]);
                if(!animGroups[baseName]) animGroups[baseName]=[];
                animGroups[baseName].push({name:f.name, frameNumber, entry:f.entry});
            }

            await createTiras(animGroups,state.zipFile.name);
        }catch(err){
            statusText.textContent='Error: '+err.message;
            console.error(err);
        }
    }

    async function createTiras(animGroups, originalName){
        const zip=new JSZip();
        const sortedNames=Object.keys(animGroups).sort();

        for(const animName of sortedNames){
            const framesArr=animGroups[animName];
            framesArr.sort((a,b)=>a.frameNumber-b.frameNumber);

            const blobs=await Promise.all(framesArr.map(async f=>{
                if(f.blob) return f.blob;
                else return f.entry.async('blob');
            }));

            const stripBlob=await createStrip(blobs);
            zip.file(`${animName}.png`, stripBlob);
            addPreview(animName, stripBlob, framesArr.length);
        }

        const finalBlob=await zip.generateAsync({type:'blob'});
        const baseName=originalName.replace(/\.(png|jpg|jpeg|zip)$/i,'');
        const finalName=`TJ-${baseName}.zip`;
        addDownloadButton(finalBlob, finalName);
        statusText.textContent="¡Procesamiento completado!";
    }

    async function createStrip(blobs){
        const images=await Promise.all(blobs.map(b=>createImageBitmap(b)));
        const maxWidth=Math.max(...images.map(img=>img.width));
        const maxHeight=Math.max(...images.map(img=>img.height));
        const canvas=document.createElement('canvas');
        canvas.width=maxWidth*images.length;
        canvas.height=maxHeight;
        const ctx=canvas.getContext('2d');

        images.forEach((img,i)=>{
            const x=i*maxWidth + (maxWidth-img.width)/2;
            const y=(maxHeight-img.height)/2;
            ctx.drawImage(img,x,y);
        });

        return new Promise(resolve=>canvas.toBlob(resolve));
    }

    // ------------------- Previews -------------------
    function addPreview(name, blob, frameCount){
        const container = document.createElement('div');
        container.className = 'preview-container';

        // Nombre de la animación fijo arriba
        const title = document.createElement('div');
        title.className = 'preview-title';
        title.textContent = name;
        container.appendChild(title);

        // Wrapper para que la tira tenga scroll horizontal
        const stripWrapper = document.createElement('div');
        stripWrapper.className = 'preview-strip-wrapper';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        stripWrapper.appendChild(img);
        container.appendChild(stripWrapper);

        // Label de frames
        const label = document.createElement('div');
        label.className = 'preview-label';
        label.textContent = `${frameCount} frame${frameCount>1?'s':''}`;
        container.appendChild(label);

        resultPanel.appendChild(container);
    }

    function addDownloadButton(blob, fileName){
        const btn=document.createElement('button');
        btn.textContent="Descargar ZIP";
        btn.style.marginTop='10px';
        btn.addEventListener('click',()=>{
            const a=document.createElement('a');
            a.href=URL.createObjectURL(blob);
            a.download=fileName;
            a.click();
        });
        resultPanel.appendChild(btn);
    }

    function groupFrames(frames){
        const animGroups={};
        for(const f of frames){
            const match=f.name.match(/^(.*?)(\d+)$/);
            if(!match) continue;
            const baseName=match[1].trim();
            const frameNumber=parseInt(match[2]);
            if(!animGroups[baseName]) animGroups[baseName]=[];
            animGroups[baseName].push({...f, frameNumber});
        }
        return animGroups;
    }
});
