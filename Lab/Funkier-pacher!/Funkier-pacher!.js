// FunkierPacker.js
class FunkierPacker {
    constructor() {
        this.frames = [];
    }

    // ======== Procesar imagen y XML ========
    async processFiles(imageFile, xmlFile, options = {}, onProgress = ()=>{}) {
        this.frames = [];

        // Cargar imagen
        const img = await this._loadImage(imageFile);

        // Leer XML
        const xmlText = await xmlFile.text();
        const atlas = this._parseXML(xmlText);

        const total = atlas.frames.length;
        for (let i = 0; i < atlas.frames.length; i++) {
            const f = atlas.frames[i];

            // Cortar frame respetando offsets y tamaños
            const frameCanvas = this._cutFrame(img, f);

            // Convertir canvas a blob
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
                x: parseInt(n.getAttribute('x')) || 0,
                y: parseInt(n.getAttribute('y')) || 0,
                width: parseInt(n.getAttribute('width')) || 0,
                height: parseInt(n.getAttribute('height')) || 0,
                frameX: parseInt(n.getAttribute('frameX')) || 0,
                frameY: parseInt(n.getAttribute('frameY')) || 0,
                frameWidth: parseInt(n.getAttribute('frameWidth')) || parseInt(n.getAttribute('width')) || 0,
                frameHeight: parseInt(n.getAttribute('frameHeight')) || parseInt(n.getAttribute('height')) || 0
            }))
        };
    }

    _cutFrame(img, frame) {
        // Crear canvas con tamaño completo (frameWidth x frameHeight)
        const canvas = document.createElement('canvas');
        canvas.width = frame.frameWidth;
        canvas.height = frame.frameHeight;
        const ctx = canvas.getContext('2d');

        // Calcular posición donde dibujar el recorte
        const offsetX = -frame.frameX; // Se invierte el offset
        const offsetY = -frame.frameY;

        // Dibujar el recorte
        ctx.drawImage(
            img,
            frame.x, frame.y, frame.width, frame.height, // Recorte del atlas
            offsetX, offsetY, frame.width, frame.height // Posición dentro del canvas
        );

        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
}