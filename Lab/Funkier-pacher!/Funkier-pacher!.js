<!-- Asegúrate de tener un div para mostrar errores/log -->
<div id="log" style="white-space: pre-wrap; color: red;"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
class FunkierPacker {
    constructor() {
        this.frames = [];
        this.logDiv = document.getElementById('log');
    }

    log(msg) {
        console.log(msg);
        if (this.logDiv) {
            this.logDiv.innerText += msg + '\n';
        }
    }

    async processFiles(imageFile, xmlFile, options = {}, onProgress = ()=>{}) {
        this.frames = [];
        try {
            this.log("Cargando imagen...");
            const img = await this._loadImage(imageFile);
            this.log("Imagen cargada correctamente.");

            const xmlText = await xmlFile.text();
            this.log("XML leído.");
            const atlas = this._parseXML(xmlText);
            this.log(`Frames detectados: ${atlas.frames.length}`);

            const total = atlas.frames.length;
            for (let i = 0; i < total; i++) {
                const f = atlas.frames[i];
                try {
                    const frameCanvas = this._cutFrame(img, f);
                    const blob = await this._canvasToBlob(frameCanvas);
                    this.frames.push({ name: f.name, blob });
                    this.log(`Frame procesado: ${f.name}`);
                    onProgress((i+1)/total);
                } catch(e) {
                    this.log(`Error procesando frame ${f.name}: ${e}`);
                }
            }

            if (this.frames.length === 0) {
                this.log("ADVERTENCIA: No se procesaron frames correctamente.");
            } else {
                this.log("Todos los frames procesados correctamente.");
            }

            return this.frames;
        } catch(e) {
            this.log("Error en processFiles: " + e);
            throw e;
        }
    }

    async generateZip() {
        try {
            if(this.frames.length === 0) throw new Error("No hay frames procesados para generar ZIP");
            const zip = new JSZip();
            this.frames.forEach(f => {
                zip.file(f.name + '.png', f.blob);
            });
            const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            this.log("ZIP generado correctamente.");
            return { blob, fileName: 'frames.zip' };
        } catch(e) {
            this.log("Error generando ZIP: " + e);
            throw e;
        }
    }

    _loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject("No se pudo cargar la imagen: " + e);
            img.src = URL.createObjectURL(file);
        });
    }

    _parseXML(xmlText) {
        try {
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, "text/xml");
            const frameNodes = Array.from(xml.querySelectorAll('SubTexture'));
            if(frameNodes.length === 0) this.log("ADVERTENCIA: No se encontraron nodos SubTexture en el XML");
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
        } catch(e) {
            this.log("Error parseando XML: " + e);
            throw e;
        }
    }

    _cutFrame(img, frame) {
        try {
            const w = frame.frameWidth || frame.width;
            const h = frame.frameHeight || frame.height;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
                img,
                frame.x, frame.y, frame.width, frame.height,
                -frame.frameX, -frame.frameY, frame.width, frame.height
            );

            return canvas;
        } catch(e) {
            this.log(`Error cortando frame ${frame.name}: ${e}`);
            throw e;
        }
    }

    _canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if(blob) resolve(blob);
                else reject("Error convirtiendo canvas a Blob");
            });
        });
    }
}
</script>