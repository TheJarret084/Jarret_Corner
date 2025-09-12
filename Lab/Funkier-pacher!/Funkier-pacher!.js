// FunkierPacker_rotated.js
// Versión reconstruida: soporta SubTexture rotated="true" (rota -90° para corregir)
// Comentarios en español. Mantiene el API: processFiles(imageFile, xmlFile, options, onProgress) y generateZip().

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

        const parseIntOr0 = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            const n = parseInt(v, 10);
            return Number.isNaN(n) ? 0 : n;
        };
        const parseBool = (v) => {
            if (!v) return false;
            v = v.toString().toLowerCase();
            return (v === 'true' || v === '1');
        };

        return {
            frames: frameNodes.map(n => {
                let name = n.getAttribute('name');
                if(name && name.toLowerCase().endsWith('.png')) name = name.slice(0,-4); // limpiar .png extra
                return {
                    name: name || 'unnamed',
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
        // src rectangle in atlas
        const srcW = frame.width;
        const srcH = frame.height;

        // extraer el rect original tal como está en el atlas (sin "des-rotar")
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcW;
        srcCanvas.height = srcH;
        const sctx = srcCanvas.getContext('2d');
        sctx.drawImage(
            img,
            frame.x, frame.y, srcW, srcH,
            0, 0, srcW, srcH
        );

        // canvas final con las dimensiones de la "frameWidth/frameHeight" (tam original antes de trimming)
        const finalW = frame.frameWidth;
        const finalH = frame.frameHeight;
        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d');

        const offsetX = frame.frameX; // normalmente negativo si el sprite fue recortado
        const offsetY = frame.frameY;

        if (!frame.rotated) {
            // dibujo directo: la posición dentro del canvas final debe compensar frameX/frameY
            ctx.drawImage(srcCanvas, -offsetX, -offsetY);
            return canvas;
        }

        // Si está rotado en el atlas, debemos rotarlo -90 grados (contra las manecillas) para restaurar la orientación.
        // Primero creamos un canvas intermedio con la imagen rotada -90deg.
        const rotatedCanvas = document.createElement('canvas');
        // al rotar -90°, las dimensiones se invierten
        rotatedCanvas.width = srcH;
        rotatedCanvas.height = srcW;
        const rctx = rotatedCanvas.getContext('2d');

        // trasladar + rotar (-90 grados)
        rctx.translate(0, srcW);
        rctx.rotate(-Math.PI / 2);
        rctx.drawImage(srcCanvas, 0, 0);

        // Ahora rotatedCanvas contiene la imagen en orientación correcta (como era originalmente)
        // Dibujamos la imagen rotada en la posición que corresponde dentro del canvas final, compensando frameX/frameY
        ctx.drawImage(rotatedCanvas, -offsetX, -offsetY);

        return canvas;
    }

    _canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
}

// exportación para módulos (opcional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FunkierPacker;
} else {
    window.FunkierPacker = FunkierPacker;
}

// Good morning abelito