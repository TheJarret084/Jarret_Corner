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
            const frameCanvas = this._cutFrame(img, f);

            if (!frameCanvas) {
                console.warn(`Frame ${f.name} no se pudo cortar`);
                continue;
            }

            const blob = await this._canvasToBlob(frameCanvas);
            if (!blob) {
                console.warn(`Frame ${f.name} generó blob vacío`);
                continue;
            }

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
            img.onerror = (e) => reject(`No se pudo cargar la imagen: ${e}`);
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
                width: parseInt(n.getAttribute('width')) || 1,
                height: parseInt(n.getAttribute('height')) || 1,
                frameX: parseInt(n.getAttribute('frameX')) || 0,
                frameY: parseInt(n.getAttribute('frameY')) || 0,
                frameWidth: parseInt(n.getAttribute('frameWidth')) || parseInt(n.getAttribute('width')) || 1,
                frameHeight: parseInt(n.getAttribute('frameHeight')) || parseInt(n.getAttribute('height')) || 1
            }))
        };
    }

    _cutFrame(img, frame) {
        try {
            const w = frame.frameWidth;
            const h = frame.frameHeight;
            if (w <= 0 || h <= 0) return null;

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            // Posición del frame dentro del atlas y offsets
            const offsetX = frame.frameX;
            const offsetY = frame.frameY;

            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(
                img,
                frame.x, frame.y, frame.width, frame.height, // recorte de atlas
                -offsetX, -offsetY, frame.width, frame.height // posición con offset
            );

            return canvas;
        } catch (err) {
            console.error(`Error cortando frame ${frame.name}: ${err}`);
            return null;
        }
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) {
                    // fallback: generar desde dataURL
                    const dataURL = canvas.toDataURL('image/png');
                    const byteString = atob(dataURL.split(',')[1]);
                    const array = new Uint8Array(byteString.length);
                    for (let i = 0; i < byteString.length; i++) {
                        array[i] = byteString.charCodeAt(i);
                    }
                    resolve(new Blob([array], { type: 'image/png' }));
                } else {
                    resolve(blob);
                }
            }, 'image/png');
        });
    }
}