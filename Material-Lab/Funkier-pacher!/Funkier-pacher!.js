// funkier-combined.js (solo JS, sin UI, auto-contenido)
// Requiere JSZip para la manipulación de ZIP (si no se usa ZIP, es opcional)

class FunkierPacker {
    constructor() {
        this.frames = []; // { name, blob }
    }

    // ======== Procesar imagen + XML (soporta rotated="true") ========
    async processFiles(imageFile, xmlFile, options = {}, onProgress = ()=>{}) {
        this.frames = [];
        const img = await this._loadImage(imageFile);
        const xmlText = await xmlFile.text();
        const atlas = this._parseXML(xmlText);

        const total = atlas.frames.length;
        for (let i = 0; i < atlas.frames.length; i++) {
            const f = atlas.frames[i];
            const frameCanvas = this._cutFrame(img, f);
            const blob = await this._canvasToBlob(frameCanvas);

            let name = f.name;
            if (name && name.toLowerCase().endsWith('.png')) name = name.slice(0, -4);

            this.frames.push({ name: name || `frame_${i}`, blob });
            onProgress((i+1)/total);
        }

        return this.frames;
    }

    // ======== Procesar ZIP de frames ========
    async processZip(zipFile, options = {}, onProgress = ()=>{}) {
        if (!window.JSZip) throw new Error("JSZip no está cargado");
        const zip = await JSZip.loadAsync(zipFile);
        const framesList = [];

        for (const filename of Object.keys(zip.files)) {
            if (!filename.toLowerCase().endsWith('.png')) continue;
            framesList.push({ name: filename.slice(0, -4), entry: zip.files[filename] });
        }

        const animGroups = {};
        for (const f of framesList) {
            const match = f.name.match(/^(.*?)(\d+)$/);
            if (!match) {
                const baseName = f.name;
                if (!animGroups[baseName]) animGroups[baseName] = [];
                animGroups[baseName].push({ name: f.name, frameNumber: 0, entry: f.entry });
                continue;
            }
            const baseName = match[1].trim();
            const frameNumber = parseInt(match[2], 10);
            if (!animGroups[baseName]) animGroups[baseName] = [];
            animGroups[baseName].push({ name: f.name, frameNumber, entry: f.entry });
        }

        // Convertir a blobs
        const resultGroups = {};
        for (const [name, frames] of Object.entries(animGroups)) {
            resultGroups[name] = await Promise.all(frames.map(async f => {
                if (f.blob) return f;
                if (f.entry) {
                    const blob = await f.entry.async('blob');
                    return { name: f.name, frameNumber: f.frameNumber || 0, blob };
                }
                return f;
            }));
        }

        return resultGroups;
    }

    // ======== Crear tiras horizontales (Blobs) ========
    async createStrips(animGroups, options = {}) {
        const maxPerStrip = options.maxPerStrip || 0;
        const removeDuplicates = options.removeDuplicates !== false; // default true

        const stripsResult = {};

        for (const [name, framesArr] of Object.entries(animGroups)) {
            let blobs = framesArr.map(f => f.blob);
            if (removeDuplicates) blobs = await this._removeDuplicateBlobs(blobs);

            const strips = (maxPerStrip > 0) ? this._chunkArray(blobs, maxPerStrip) : [blobs];

            stripsResult[name] = [];
            for (let i = 0; i < strips.length; i++) {
                const stripBlob = await this._createStrip(strips[i]);
                const stripName = strips.length > 1 ? `${name}_part${i+1}.png` : `${name}.png`;
                stripsResult[name].push({ name: stripName, blob: stripBlob });
            }
        }

        return stripsResult; // { animName: [{name, blob}, ...], ... }
    }

    // ======== Generar ZIP final ========
    async generateZip(stripsResult, zipName = 'frames.zip') {
        if (!window.JSZip) throw new Error("JSZip no está cargado");
        const zip = new JSZip();
        for (const strips of Object.values(stripsResult)) {
            for (const s of strips) zip.file(s.name, s.blob);
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        return { blob, fileName: zipName };
    }

    // ======== Internas ========
    _loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error("No se pudo cargar la imagen: " + (e?.message || 'error')));
            img.src = URL.createObjectURL(file);
        });
    }

    _parseXML(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "text/xml");
        const frameNodes = Array.from(xml.querySelectorAll('SubTexture'));

        const parseIntOr0 = v => (v === null || v === undefined || v === '') ? 0 : (Number.isNaN(parseInt(v,10)) ? 0 : parseInt(v,10));
        const parseBool = v => v ? (v.toString().toLowerCase() === 'true' || v.toString() === '1') : false;

        return {
            frames: frameNodes.map(n => {
                let name = n.getAttribute('name') || 'unnamed';
                if (name.toLowerCase().endsWith('.png')) name = name.slice(0,-4);
                return {
                    name,
                    x: parseIntOr0(n.getAttribute('x')),
                    y: parseIntOr0(n.getAttribute('y')),
                    width: parseIntOr0(n.getAttribute('width')),
                    height: parseIntOr0(n.getAttribute('height')),
                    rotated: parseBool(n.getAttribute('rotated')),
                    frameX: parseIntOr0(n.getAttribute('frameX')),
                    frameY: parseIntOr0(n.getAttribute('frameY')),
                    frameWidth: parseIntOr0(n.getAttribute('frameWidth')) || parseIntOr0(n.getAttribute('width')),
                    frameHeight: parseIntOr0(n.getAttribute('frameHeight')) || parseIntOr0(n.getAttribute('height'))
                };
            })
        };
    }

    _cutFrame(img, frame) {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = frame.width;
        srcCanvas.height = frame.height;
        const sctx = srcCanvas.getContext('2d');
        sctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);

        const canvas = document.createElement('canvas');
        canvas.width = frame.frameWidth;
        canvas.height = frame.frameHeight;
        const ctx = canvas.getContext('2d');

        if (!frame.rotated) {
            ctx.drawImage(srcCanvas, -frame.frameX, -frame.frameY);
            return canvas;
        }

        // rotado -90° para corregir
        const rotatedCanvas = document.createElement('canvas');
        rotatedCanvas.width = frame.height;
        rotatedCanvas.height = frame.width;
        const rctx = rotatedCanvas.getContext('2d');
        rctx.translate(0, frame.width);
        rctx.rotate(-Math.PI/2);
        rctx.drawImage(srcCanvas, 0, 0);

        ctx.drawImage(rotatedCanvas, -frame.frameX, -frame.frameY);
        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    _createStrip(blobs) {
        return new Promise(async resolve => {
            if (!blobs || blobs.length === 0) {
                const c = document.createElement('canvas'); c.width=1;c.height=1;
                return resolve(await this._canvasToBlob(c));
            }
            const images = await Promise.all(blobs.map(b => createImageBitmap(b)));
            const maxWidth = Math.max(...images.map(img => img.width));
            const maxHeight = Math.max(...images.map(img => img.height));
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth * images.length;
            canvas.height = maxHeight;
            const ctx = canvas.getContext('2d');
            images.forEach((img,i) => {
                const x = i*maxWidth + (maxWidth - img.width)/2;
                const y = (maxHeight - img.height)/2;
                ctx.drawImage(img,x,y);
            });
            resolve(await this._canvasToBlob(canvas));
        });
    }

    _chunkArray(arr, size) {
        if (size <= 0) return [arr.slice()];
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i,i+size));
        return out;
    }

    async _removeDuplicateBlobs(blobs) {
        if (!blobs || blobs.length<=1) return blobs;
        const checksums = [], results = [];
        for (const blob of blobs) {
            try {
                const bmp = await createImageBitmap(blob);
                const c = document.createElement('canvas'); c.width=bmp.width;c.height=bmp.height;
                const ctx=c.getContext('2d'); ctx.drawImage(bmp,0,0);
                const data = ctx.getImageData(0,0,c.width,c.height).data;
                let s=0; for (let i=0;i<data.length;i+=4) s=(s+data[i]+data[i+1]*3+data[i+2]*7+data[i+3]*11)>>>0;
                if (!checksums.includes(s)) { checksums.push(s); results.push(blob); }
                bmp.close?.();
            } catch(e){ results.push(blob); }
        }
        return results;
    }
}

// export / global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FunkierPacker;
} else {
    window.FunkierPacker = FunkierPacker;
}
