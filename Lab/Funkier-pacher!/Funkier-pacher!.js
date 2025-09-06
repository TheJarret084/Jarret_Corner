// FunkierPacker.js
class FunkierPacker {
    constructor() {
        this.frames = [];
    }

    // ======== Procesar imagen y XML ========
    async processFiles(imageFile, xmlFile, options = {}, onProgress = () => {}) {
        this.frames = [];
        const img = await this._loadImage(imageFile);
        const xmlText = await xmlFile.text();
        const atlas = this._parseXML(xmlText);

        const total = atlas.frames.length;
        for (let i = 0; i < total; i++) {
            const f = atlas.frames[i];
            const frameCanvas = this._cutFrame(img, f);
            const blob = await this._canvasToBlob(frameCanvas);
            this.frames.push({ name: f.name, blob });
            onProgress((i + 1) / total);
        }

        return this.frames;
    }

    // ======== Generar ZIP de frames ========
    async generateZip() {
        if (this.frames.length === 0) throw new Error("No hay frames procesados");
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
                height: parseInt(n.getAttribute('height')),
                frameX: parseInt(n.getAttribute('frameX')) || 0,
                frameY: parseInt(n.getAttribute('frameY')) || 0,
                frameWidth: parseInt(n.getAttribute('frameWidth')) || parseInt(n.getAttribute('width')),
                frameHeight: parseInt(n.getAttribute('frameHeight')) || parseInt(n.getAttribute('height'))
            }))
        };
    }

    _cutFrame(img, frame) {
        // Tamaño total del canvas según frameWidth/Height
        const w = frame.frameWidth;
        const h = frame.frameHeight;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Offset negativo reacomodado
        const offsetX = frame.frameX;
        const offsetY = frame.frameY;

        // Dibuja el recorte exacto del atlas, reacomodando el offset
        ctx.drawImage(
            img,
            frame.x, frame.y, frame.width, frame.height,  // área del atlas
            -offsetX, -offsetY, frame.width, frame.height // posición en el canvas
        );

        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) throw new Error("No se pudo generar el blob de la imagen");
                resolve(blob);
            });
        });
    }
}