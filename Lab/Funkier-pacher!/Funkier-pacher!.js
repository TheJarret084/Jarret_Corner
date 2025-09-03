// FunkierPacker.js
class FunkierPacker {
    constructor() {
        this.frames = [];
    }

    // ======== Procesar imagen y XML ========
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
            this.frames.push({ name: f.name, blob });
            onProgress((i+1)/total);
        }

        return this.frames;
    }

    // ======== Generar spritesheet ========
    async generateSpritesheet() {
        if(this.frames.length === 0) throw new Error("No hay frames procesados");
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const frameWidths = this.frames.map(f => f.width || 64);
        const frameHeights = this.frames.map(f => f.height || 64);

        canvas.width = Math.max(...frameWidths) * this.frames.length;
        canvas.height = Math.max(...frameHeights);

        this.frames.forEach((f, i) => {
            const img = new Image();
            img.src = URL.createObjectURL(f.blob);
            img.onload = () => {
                ctx.drawImage(img, i * Math.max(...frameWidths), 0);
            }
        });

        // Esperar a que se dibujen todas las imágenes
        await new Promise(resolve => setTimeout(resolve, 500));

        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        return { blob, fileName: 'spritesheet.png' };
    }

    // ======== Generar ZIP de frames ========
    async generateZip() {
        if(this.frames.length === 0) throw new Error("No hay frames procesados");
        const zip = new JSZip();
        this.frames.forEach(f => {
            zip.file(f.name + '.png', f.blob);
        });
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        return { blob, fileName: 'frames.zip' };
    }

    // ======== Funciones internas ========
    _loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    _parseXML(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "text/xml");
        const frameNodes = Array.from(xml.querySelectorAll('SubTexture'));
        return {
            frames: frameNodes.map(n => ({
                name: n.getAttribute('name'),
                x: parseInt(n.getAttribute('x')),
                y: parseInt(n.getAttribute('y')),
                width: parseInt(n.getAttribute('width')),
                height: parseInt(n.getAttribute('height'))
            }))
        };
    }

    _cutFrame(img, frame) {
        const canvas = document.createElement('canvas');
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
        frame.width = canvas.width;
        frame.height = canvas.height;
        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve));
    }
}
