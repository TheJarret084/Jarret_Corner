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

            // Limpiar nombre: si termina en .png, quitarlo
            let name = f.name;
            if(name.toLowerCase().endsWith('.png')) name = name.slice(0, -4);

            this.frames.push({ name, blob });
            onProgress((i+1)/total);
        }

        return this.frames;
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
            frames: frameNodes.map(n => {
                let name = n.getAttribute('name');
                if(name.toLowerCase().endsWith('.png')) name = name.slice(0,-4); // limpiar .png extra
                return {
                    name,
                    x: parseInt(n.getAttribute('x')) || 0,
                    y: parseInt(n.getAttribute('y')) || 0,
                    width: parseInt(n.getAttribute('width')) || 0,
                    height: parseInt(n.getAttribute('height')) || 0,
                    frameX: parseInt(n.getAttribute('frameX')) || 0,
                    frameY: parseInt(n.getAttribute('frameY')) || 0,
                    frameWidth: parseInt(n.getAttribute('frameWidth')) || parseInt(n.getAttribute('width')) || 0,
                    frameHeight: parseInt(n.getAttribute('frameHeight')) || parseInt(n.getAttribute('height')) || 0
                };
            })
        };
    }

    _cutFrame(img, frame) {
        const w = frame.frameWidth;
        const h = frame.frameHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        const offsetX = frame.frameX;
        const offsetY = frame.frameY;

        // dibujar recorte considerando offsets negativos
        ctx.drawImage(
            img,
            frame.x, frame.y, frame.width, frame.height, // recorte de atlas
            -offsetX, -offsetY, frame.width, frame.height // posición con offset
        );

        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
}