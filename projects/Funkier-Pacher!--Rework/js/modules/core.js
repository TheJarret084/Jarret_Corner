// Funkier-Pacher!-(soporte de rotado arreglado).js
// Unificado: soporte para SubTexture rotated="true" usando FunkierPacker de la 1.7
// Requiere: JSZip cargado antes de este script.

(() => {
  'use strict';

  // -----------------------------
  // Configurables
  // -----------------------------
  const DEFAULTS = {
    EST_MAX: 32768,    // límite seguro en px (ajusta si quieres)
    MIN_SCALE: 0.25,   // no reducimos por debajo de esto
    SCALE_STEP: 0.05
  };

  // -----------------------------
  // Helper (FTF) - funciones de imagen y spritesheet
  // -----------------------------
  const FTF = {
    DEFAULTS: { ...DEFAULTS },

    loadImage: function(fileOrBlob) {
      return new Promise((resolve, reject) => {
        try {
          const url = URL.createObjectURL(fileOrBlob);
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('loadImage failed')); };
          img.src = url;
        } catch (e) { reject(e); }
      });
    },

    readFileAsText: function(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result);
        r.onerror = reject;
        r.readAsText(file);
      });
    },

    toBitmap: async function(blobOrImage) {
      try {
        return await createImageBitmap(blobOrImage);
      } catch (e) {
        if (blobOrImage instanceof HTMLImageElement) {
          const c = document.createElement('canvas');
          c.width = blobOrImage.naturalWidth || blobOrImage.width;
          c.height = blobOrImage.naturalHeight || blobOrImage.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(blobOrImage, 0, 0);
          return await createImageBitmap(c);
        }
        throw e;
      }
    },

    getImageDataFromBitmap: function(bitmap) {
      const c = document.createElement('canvas');
      c.width = bitmap.width;
      c.height = bitmap.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    },

    areBitmapsEqual: async function(bmpA, bmpB) {
      if (!bmpA || !bmpB) return false;
      if (bmpA.width !== bmpB.width || bmpA.height !== bmpB.height) return false;
      const d1 = FTF.getImageDataFromBitmap(bmpA);
      const d2 = FTF.getImageDataFromBitmap(bmpB);
      if (d1.length !== d2.length) return false;
      for (let i = 0; i < d1.length; i += 4) {
        if (d1[i] !== d2[i] || d1[i+1] !== d2[i+1] || d1[i+2] !== d2[i+2] || d1[i+3] !== d2[i+3]) return false;
      }
      return true;
    },

    // Crea spritesheet a partir de ImageBitmap[] (una fila horizontal).
    // cellWidth/cellHeight son los "cell" por frame (sin escalar).
    // scale: escala aplicada a cada bitmap dibujo (1 = sin cambiar).
    // devuelve { blob, canvas, usedScale }
    createSpritesheetFromBitmaps: async function(bitmaps, cellWidth, cellHeight, scale = 1, opts = {}) {
      const estMax = opts.estMax ?? DEFAULTS.EST_MAX;
      const minScale = opts.minScale ?? DEFAULTS.MIN_SCALE;
      const scaleStep = opts.scaleStep ?? DEFAULTS.SCALE_STEP;

      if (!bitmaps || bitmaps.length === 0) {
        const c = document.createElement('canvas'); c.width = 1; c.height = 1;
        return { blob: await new Promise(r=>c.toBlob(r,'image/png')), canvas: c, usedScale: scale };
      }

      // calcular dimensiones finales
      const totalW = Math.round(cellWidth * bitmaps.length * scale);
      const totalH = Math.round(cellHeight * scale);

      // si supera límites, intentar reducir iterativamente
      if (totalW > estMax || totalH > estMax) {
        let curScale = scale;
        while ((Math.round(cellWidth * bitmaps.length * curScale) > estMax || Math.round(cellHeight * curScale) > estMax) && (curScale - scaleStep >= minScale)) {
          curScale = +(curScale - scaleStep).toFixed(3);
        }
        // chequeo final preciso
        if (Math.round(cellWidth * bitmaps.length * curScale) > estMax || Math.round(cellHeight * curScale) > estMax) {
          const neededW = estMax / Math.max(1, cellWidth * bitmaps.length);
          const neededH = estMax / Math.max(1, cellHeight);
          const needed = Math.min(neededW, neededH);
          if (needed >= minScale) curScale = needed;
          else {
            const e = new Error('CANVAS_TOO_LARGE');
            e.code = 'CANVAS_TOO_LARGE';
            throw e;
          }
        }
        // intentar con curScale
        return await FTF.createSpritesheetFromBitmaps(bitmaps, cellWidth, cellHeight, curScale, opts);
      }

      // crear canvas
      const canvas = document.createElement('canvas');
      canvas.width = totalW;
      canvas.height = totalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { const e = new Error('NO_CANVAS'); e.code = 'NO_CANVAS'; throw e; }

      // dibujar bitmaps (centrados en celda)
      for (let i = 0; i < bitmaps.length; i++) {
        const bmp = bitmaps[i];
        const drawW = Math.max(1, Math.round(bmp.width * scale));
        const drawH = Math.max(1, Math.round(bmp.height * scale));
        const cellWScaled = Math.round(cellWidth * scale);
        const cellHScaled = Math.round(cellHeight * scale);
        const offsetX = Math.floor((cellWScaled - drawW) / 2);
        const offsetY = Math.floor((cellHScaled - drawH) / 2);

        if (scale !== 1) {
          const temp = document.createElement('canvas');
          temp.width = drawW; temp.height = drawH;
          const tctx = temp.getContext('2d');
          tctx.imageSmoothingEnabled = true;
          tctx.imageSmoothingQuality = 'high';
          tctx.drawImage(bmp, 0, 0, drawW, drawH);
          ctx.drawImage(temp, i * cellWScaled + offsetX, offsetY);
        } else {
          ctx.drawImage(bmp, i * cellWidth + offsetX, offsetY);
        }
      }

      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      return { blob, canvas, usedScale: scale };
    },

    // Dado un array de Blobs (frames), intenta crear una "tira" (spritesheet).
    // Opciones: { estMax, minScale, scaleStep, autoScale }
    // Devuelve Blob o lanza error (CANVAS_TOO_LARGE/NO_CANVAS)
    createStripFromBlobs: async function(blobs, opts = {}) {
      const estMax = opts.estMax ?? DEFAULTS.EST_MAX;
      const minScale = opts.minScale ?? DEFAULTS.MIN_SCALE;
      const scaleStep = opts.scaleStep ?? DEFAULTS.SCALE_STEP;
      const autoScale = (opts.autoScale === undefined) ? true : !!opts.autoScale;
      if (!blobs || blobs.length === 0) {
        const c = document.createElement('canvas'); c.width = 1; c.height = 1;
        return await new Promise(r=>c.toBlob(r,'image/png'));
      }

      // crear bitmaps
      let bitmaps;
      try {
        bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
      } catch (e) {
        const err = new Error('NO_CANVAS'); err.code = 'NO_CANVAS'; throw err;
      }

      const maxW = Math.max(...bitmaps.map(b => b.width));
      const maxH = Math.max(...bitmaps.map(b => b.height));
      // escala inicial (leer valor UI si existe)
      let initialScale = (typeof window !== 'undefined' && window.currentScale) ? window.currentScale : 1;
      initialScale = Math.max(minScale, Math.min(1, initialScale));

      // si autoScale está desactivado, solo intentar con initialScale (puede fallar)
      if (!autoScale && initialScale < 1) {
        const res = await FTF.createSpritesheetFromBitmaps(bitmaps, maxW, maxH, initialScale, { estMax, minScale, scaleStep });
        return res.blob;
      }

      // intentar con initialScale (y la función interna hará reducción si hace falta)
      const res = await FTF.createSpritesheetFromBitmaps(bitmaps, maxW, maxH, initialScale, { estMax, minScale, scaleStep });
      // liberar bitmaps
      bitmaps.forEach(b => b.close?.());
      return res.blob;
    }
  }; // end FTF

  // -----------------------------
  // FunkierPacker class (tu versión integrada)
  // -----------------------------
  class FunkierPacker {
    constructor() {
      this.frames = [];
    }

    // ======== Procesar imagen + atlas data (XML/JSON/PLIST/ATLAS) ========
    async processFiles(imageFile, dataFile, options = {}, onProgress = () => {}) {
      this.frames = [];
      const img = await this._loadImage(imageFile);
      const dataText = await dataFile.text();
      const atlas = this._parseAtlasData(dataText, dataFile?.name || '');
      if (atlas.type === 'Sparrow') {
        this._applySparrowMaxSize(atlas.frames);
      }

      const total = atlas.frames.length;
      for (let i = 0; i < total; i++) {
        const frame = atlas.frames[i];
        const frameCanvas = this._cutFrame(img, frame);
        const blob = await this._canvasToBlob(frameCanvas);
        this.frames.push({ name: frame.name, blob });
        try { onProgress((i + 1) / total); } catch (e) {}
      }

      return this.frames;
    }

    // ======== Generar ZIP de frames ========
    async generateZip() {
      if (this.frames.length === 0) throw new Error('No hay frames procesados');
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
        const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
      });
    }

    _parseAtlasData(dataText, fileName = '') {
      if (typeof dataText !== 'string' || !dataText.trim()) {
        throw new Error('El archivo de datos está vacío.');
      }

      let text = dataText.replace(/^\uFEFF/, '');
      if (text.startsWith('ï»¿')) text = text.slice(3);

      const ext = this._getFileExt(fileName);
      const parserMap = {
        sparrow: () => this._tryParseSparrowXML(text),
        xml: () => this._tryParseLegacyXML(text),
        jsonHash: () => this._tryParseJsonHash(text),
        jsonArray: () => this._tryParseJsonArray(text),
        uikit: () => this._tryParseUIKitPlist(text),
        spine: () => this._tryParseSpine(text)
      };

      const ordered = this._orderedParserNames(ext);
      const tried = new Set();

      for (const key of ordered) {
        if (!parserMap[key] || tried.has(key)) continue;
        tried.add(key);
        const parsed = parserMap[key]();
        if (parsed && Array.isArray(parsed.frames) && parsed.frames.length > 0) return parsed;
      }

      for (const key of Object.keys(parserMap)) {
        if (tried.has(key)) continue;
        const parsed = parserMap[key]();
        if (parsed && Array.isArray(parsed.frames) && parsed.frames.length > 0) return parsed;
      }

      throw new Error('Formato de atlas no compatible. Usa Sparrow/XML/JSON/PLIST/ATLAS/FNT.');
    }

    _orderedParserNames(ext) {
      switch (ext) {
        case 'xml':
          return ['sparrow', 'xml', 'uikit'];
        case 'json':
          return ['jsonHash', 'jsonArray'];
        case 'plist':
          return ['uikit', 'sparrow', 'xml'];
        case 'atlas':
        case 'txt':
        case 'fnt':
          return ['spine'];
        default:
          return ['sparrow', 'jsonHash', 'jsonArray', 'uikit', 'spine', 'xml'];
      }
    }

    _getFileExt(fileName) {
      if (!fileName || typeof fileName !== 'string') return '';
      const clean = fileName.trim().toLowerCase();
      const idx = clean.lastIndexOf('.');
      if (idx < 0 || idx === clean.length - 1) return '';
      return clean.slice(idx + 1);
    }

    _tryParseSparrowXML(dataText) {
      try {
        const xml = this._parseXMLDocument(dataText);
        if (!xml) return null;
        const nodes = Array.from(xml.getElementsByTagName('SubTexture'));
        if (!nodes.length) return null;

        const frames = [];
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const name = this._normalizeName(n.getAttribute('name'), `frame_${i}`);
          const x = this._toInt(n.getAttribute('x'), 0);
          const y = this._toInt(n.getAttribute('y'), 0);
          const width = this._toInt(n.getAttribute('width'), 0);
          const height = this._toInt(n.getAttribute('height'), 0);
          if (width <= 0 || height <= 0) continue;

          const rotated = this._parseBool(n.getAttribute('rotated')) || this._parseRotation(n.getAttribute('rotation'));
          const spriteW = rotated ? height : width;
          const spriteH = rotated ? width : height;
          const spriteX = -this._toInt(n.getAttribute('frameX'), 0);
          const spriteY = -this._toInt(n.getAttribute('frameY'), 0);
          const sourceW = this._toInt(n.getAttribute('frameWidth'), spriteW);
          const sourceH = this._toInt(n.getAttribute('frameHeight'), spriteH);

          frames.push(this._buildFrame({
            name,
            x,
            y,
            w: width,
            h: height,
            srcW: width,
            srcH: height,
            spriteX,
            spriteY,
            spriteW,
            spriteH,
            sourceW,
            sourceH,
            rotated,
            inverseRotation: false
          }));
        }

        if (!frames.length) return null;
        return { type: 'Sparrow', inverseRotation: false, frames };
      } catch (e) {
        return null;
      }
    }

    _tryParseLegacyXML(dataText) {
      try {
        const xml = this._parseXMLDocument(dataText);
        if (!xml) return null;

        const all = Array.from(xml.getElementsByTagName('*'));
        const nodes = all.filter(node => (node.tagName || '').toLowerCase() === 'sprite');
        if (!nodes.length) return null;

        const frames = [];
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const name = this._normalizeName(n.getAttribute('n') || n.getAttribute('name'), `frame_${i}`);
          const x = this._toInt(n.getAttribute('x'), 0);
          const y = this._toInt(n.getAttribute('y'), 0);
          const w = this._toInt(n.getAttribute('w') ?? n.getAttribute('width'), 0);
          const h = this._toInt(n.getAttribute('h') ?? n.getAttribute('height'), 0);
          if (w <= 0 || h <= 0) continue;

          const rotated = this._parseBool(n.getAttribute('rotated')) ||
            this._parseRotation(n.getAttribute('rotation')) ||
            String(n.getAttribute('r') || '').toLowerCase() === 'y';

          const spriteX = this._toInt(n.getAttribute('oX'), 0);
          const spriteY = this._toInt(n.getAttribute('oY'), 0);
          const sourceW = this._toInt(n.getAttribute('oW'), Math.max(w, spriteX + w));
          const sourceH = this._toInt(n.getAttribute('oH'), Math.max(h, spriteY + h));

          frames.push(this._buildFrame({
            name,
            x,
            y,
            w,
            h,
            spriteX,
            spriteY,
            spriteW: w,
            spriteH: h,
            sourceW,
            sourceH,
            rotated,
            inverseRotation: false
          }));
        }

        if (!frames.length) return null;
        return { type: 'XML', inverseRotation: false, frames };
      } catch (e) {
        return null;
      }
    }

    _tryParseJsonHash(dataText) {
      try {
        const json = JSON.parse(dataText);
        if (!json || !json.frames || Array.isArray(json.frames)) return null;

        const frames = [];
        for (const name of Object.keys(json.frames)) {
          const item = json.frames[name];
          const frame = item && typeof item.frame === 'object' ? item.frame : item;
          const w = this._toInt(frame?.w ?? frame?.width, 0);
          const h = this._toInt(frame?.h ?? frame?.height, 0);
          if (w <= 0 || h <= 0) continue;

          const rotated = this._parseBool(item?.rotated) || this._parseRotation(item?.rotation);
          const sprite = item?.spriteSourceSize || {};
          const source = item?.sourceSize || {};
          const spriteX = this._toInt(sprite.x, 0);
          const spriteY = this._toInt(sprite.y, 0);
          const spriteW = this._toInt(sprite.w, w);
          const spriteH = this._toInt(sprite.h, h);
          const sourceW = this._toInt(source.w, Math.max(spriteW, spriteX + spriteW));
          const sourceH = this._toInt(source.h, Math.max(spriteH, spriteY + spriteH));

          frames.push(this._buildFrame({
            name,
            x: this._toInt(frame.x, 0),
            y: this._toInt(frame.y, 0),
            w,
            h,
            spriteX,
            spriteY,
            spriteW,
            spriteH,
            sourceW,
            sourceH,
            rotated,
            inverseRotation: false
          }));
        }

        if (!frames.length) return null;
        return { type: 'JSON (hash)', inverseRotation: false, frames };
      } catch (e) {
        return null;
      }
    }

    _tryParseJsonArray(dataText) {
      try {
        const json = JSON.parse(dataText);
        if (!json || !Array.isArray(json.frames)) return null;

        const frames = [];
        for (let i = 0; i < json.frames.length; i++) {
          const item = json.frames[i];
          const name = this._normalizeName(item?.filename || item?.name, `frame_${i}`);
          const frame = item && typeof item.frame === 'object' ? item.frame : item;
          const w = this._toInt(frame?.w ?? frame?.width, 0);
          const h = this._toInt(frame?.h ?? frame?.height, 0);
          if (w <= 0 || h <= 0) continue;

          const rotated = this._parseBool(item?.rotated) || this._parseRotation(item?.rotation);
          const sprite = item?.spriteSourceSize || {};
          const source = item?.sourceSize || {};
          const spriteX = this._toInt(sprite.x, 0);
          const spriteY = this._toInt(sprite.y, 0);
          const spriteW = this._toInt(sprite.w, w);
          const spriteH = this._toInt(sprite.h, h);
          const sourceW = this._toInt(source.w, Math.max(spriteW, spriteX + spriteW));
          const sourceH = this._toInt(source.h, Math.max(spriteH, spriteY + spriteH));

          frames.push(this._buildFrame({
            name,
            x: this._toInt(frame.x, 0),
            y: this._toInt(frame.y, 0),
            w,
            h,
            spriteX,
            spriteY,
            spriteW,
            spriteH,
            sourceW,
            sourceH,
            rotated,
            inverseRotation: false
          }));
        }

        if (!frames.length) return null;
        return { type: 'JSON (array)', inverseRotation: false, frames };
      } catch (e) {
        return null;
      }
    }

    _tryParseUIKitPlist(dataText) {
      try {
        const atlas = this._parsePlist(dataText);
        if (!atlas || typeof atlas !== 'object' || !atlas.frames || typeof atlas.frames !== 'object' || Array.isArray(atlas.frames)) {
          return null;
        }

        const frames = [];
        for (const name of Object.keys(atlas.frames)) {
          const item = atlas.frames[name];
          if (!item || typeof item !== 'object') continue;
          const w = this._toInt(item.w, 0);
          const h = this._toInt(item.h, 0);
          if (w <= 0 || h <= 0) continue;

          const spriteX = this._toInt(item.oX, 0);
          const spriteY = this._toInt(item.oY, 0);
          const sourceW = this._toInt(item.oW, Math.max(w, spriteX + w));
          const sourceH = this._toInt(item.oH, Math.max(h, spriteY + h));

          frames.push(this._buildFrame({
            name,
            x: this._toInt(item.x, 0),
            y: this._toInt(item.y, 0),
            w,
            h,
            spriteX,
            spriteY,
            spriteW: w,
            spriteH: h,
            sourceW,
            sourceH,
            rotated: false,
            inverseRotation: false
          }));
        }

        if (!frames.length) return null;
        return { type: 'UIKit', inverseRotation: false, frames };
      } catch (e) {
        return null;
      }
    }

    _tryParseSpine(dataText) {
      try {
        const lines = dataText.replace(/\r/g, '').split('\n');
        if (!lines.length) return null;

        let startIndex = 6;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().toLowerCase().startsWith('repeat:')) {
            startIndex = i + 1;
            break;
          }
        }

        const regions = [];
        let current = null;

        const finalize = () => {
          if (!current) return;
          if (current.frameW > 0 && current.frameH > 0) {
            regions.push(current);
          }
          current = null;
        };

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const trimmed = line.trim();
          if (!trimmed) continue;

          const isTopLevel = line[0] && line[0].trim();
          if (isTopLevel && trimmed.indexOf(':') < 0) {
            finalize();
            current = {
              name: trimmed,
              rotated: false,
              x: 0,
              y: 0,
              frameW: 0,
              frameH: 0,
              sourceW: 0,
              sourceH: 0,
              offX: 0,
              offY: 0
            };
            continue;
          }

          if (!current) continue;

          const sep = trimmed.indexOf(':');
          if (sep <= 0) continue;
          const key = trimmed.slice(0, sep).trim().toLowerCase();
          const val = trimmed.slice(sep + 1).trim();
          const parts = val.split(',').map(v => v.trim());

          switch (key) {
            case 'rotate':
              current.rotated = this._parseBool(val) || this._parseRotation(val);
              break;
            case 'xy':
              current.x = this._toInt(parts[0], current.x);
              current.y = this._toInt(parts[1], current.y);
              break;
            case 'size':
              current.frameW = this._toInt(parts[0], current.frameW);
              current.frameH = this._toInt(parts[1], current.frameH);
              break;
            case 'orig':
              current.sourceW = this._toInt(parts[0], current.sourceW || current.frameW);
              current.sourceH = this._toInt(parts[1], current.sourceH || current.frameH);
              break;
            case 'offset':
              current.offX = this._toInt(parts[0], current.offX);
              current.offY = this._toInt(parts[1], current.offY);
              break;
            default:
              break;
          }
        }
        finalize();

        if (!regions.length) return null;

        const frames = regions.map(item => this._buildFrame({
          name: item.name,
          x: item.x,
          y: item.y,
          w: item.frameW,
          h: item.frameH,
          spriteX: item.offX,
          spriteY: item.offY,
          spriteW: item.frameW,
          spriteH: item.frameH,
          sourceW: item.sourceW || item.frameW,
          sourceH: item.sourceH || item.frameH,
          rotated: item.rotated,
          inverseRotation: true
        }));

        if (!frames.length) return null;
        return { type: 'Spine', inverseRotation: true, frames };
      } catch (e) {
        return null;
      }
    }

    _parseXMLDocument(text) {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');
        if (!xml) return null;
        if (xml.getElementsByTagName('parsererror').length > 0) return null;
        return xml;
      } catch (e) {
        return null;
      }
    }

    _parsePlist(text) {
      const xml = this._parseXMLDocument(text);
      if (!xml) return null;
      const plistNode = xml.documentElement && xml.documentElement.tagName === 'plist'
        ? xml.documentElement
        : xml.querySelector('plist');
      if (!plistNode) return null;
      const root = this._firstElementChild(plistNode);
      if (!root) return null;
      return this._parsePlistNode(root);
    }

    _parsePlistNode(node) {
      if (!node || !node.tagName) return null;
      const tag = node.tagName.toLowerCase();
      switch (tag) {
        case 'dict':
          return this._parsePlistDict(node);
        case 'array':
          return this._parsePlistArray(node);
        case 'string':
        case 'date':
          return (node.textContent || '').trim();
        case 'integer':
        case 'real':
          return this._toNumber(node.textContent) ?? 0;
        case 'true':
          return true;
        case 'false':
          return false;
        default:
          return null;
      }
    }

    _parsePlistDict(node) {
      const obj = {};
      let currentKey = null;
      const children = Array.from(node.childNodes).filter(n => n.nodeType === 1);

      for (const child of children) {
        const tag = (child.tagName || '').toLowerCase();
        if (tag === 'key') {
          currentKey = (child.textContent || '').trim();
          continue;
        }
        if (currentKey !== null) {
          obj[currentKey] = this._parsePlistNode(child);
          currentKey = null;
        }
      }

      return obj;
    }

    _parsePlistArray(node) {
      const list = [];
      const children = Array.from(node.childNodes).filter(n => n.nodeType === 1);
      for (const child of children) list.push(this._parsePlistNode(child));
      return list;
    }

    _firstElementChild(node) {
      if (!node) return null;
      const children = node.childNodes || [];
      for (let i = 0; i < children.length; i++) {
        if (children[i].nodeType === 1) return children[i];
      }
      return null;
    }

    _buildFrame(raw) {
      const rotated = !!raw.rotated;
      const frameW = this._toPositiveInt(raw.w, 1);
      const frameH = this._toPositiveInt(raw.h, 1);
      const spriteX = this._toInt(raw.spriteX, 0);
      const spriteY = this._toInt(raw.spriteY, 0);
      const spriteW = this._toPositiveInt(raw.spriteW, frameW);
      const spriteH = this._toPositiveInt(raw.spriteH, frameH);

      let sourceW = this._toPositiveInt(raw.sourceW, Math.max(spriteW, spriteX + spriteW));
      let sourceH = this._toPositiveInt(raw.sourceH, Math.max(spriteH, spriteY + spriteH));
      sourceW = Math.max(sourceW, spriteW, spriteX + spriteW);
      sourceH = Math.max(sourceH, spriteH, spriteY + spriteH);

      let srcW = this._toPositiveInt(raw.srcW, 0);
      let srcH = this._toPositiveInt(raw.srcH, 0);
      if (!srcW || !srcH) {
        const src = this._resolveSourceRect(frameW, frameH, spriteW, spriteH, rotated);
        srcW = src.w;
        srcH = src.h;
      }

      return {
        name: this._normalizeName(raw.name, 'unnamed'),
        x: this._toInt(raw.x, 0),
        y: this._toInt(raw.y, 0),
        srcW,
        srcH,
        spriteX,
        spriteY,
        spriteW,
        spriteH,
        sourceW,
        sourceH,
        rotated,
        inverseRotation: !!raw.inverseRotation
      };
    }

    _applySparrowMaxSize(frames) {
      const maxMap = {};
      for (const frame of frames) {
        const prefix = this._cleanPrefix(frame.name);
        if (!maxMap[prefix]) maxMap[prefix] = { w: 0, h: 0 };
        maxMap[prefix].w = Math.max(maxMap[prefix].w, frame.sourceW);
        maxMap[prefix].h = Math.max(maxMap[prefix].h, frame.sourceH);
      }

      for (const frame of frames) {
        const prefix = this._cleanPrefix(frame.name);
        const max = maxMap[prefix];
        if (!max) continue;
        frame.sourceW = Math.max(frame.sourceW, max.w);
        frame.sourceH = Math.max(frame.sourceH, max.h);
      }
    }

    _cleanPrefix(str) {
      let value = String(str || '');
      const parts = value.split('.');
      if (parts.length > 1) parts.pop();
      value = parts.join('.');

      let lastDigit = '';
      let c = '';
      do {
        c = value[value.length - 1];
        if (c >= '0' && c <= '9') {
          value = value.slice(0, value.length - 1);
          lastDigit = c;
        }
      } while (c >= '0' && c <= '9');

      return value + lastDigit;
    }

    _resolveSourceRect(frameW, frameH, spriteW, spriteH, rotated) {
      if (!rotated) {
        return { w: frameW, h: frameH };
      }

      const direct = frameW === spriteW && frameH === spriteH;
      const swapped = frameW === spriteH && frameH === spriteW;

      if (swapped && !direct) return { w: frameW, h: frameH };
      if (direct && !swapped) return { w: frameH, h: frameW };

      return { w: frameH, h: frameW };
    }

    _normalizeName(name, fallback = 'unnamed') {
      let n = (name == null ? '' : String(name)).trim();
      if (!n) n = fallback;
      n = n.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      return n || fallback;
    }

    _parseBool(value) {
      if (typeof value === 'boolean') return value;
      if (value === null || value === undefined) return false;
      const v = String(value).trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes' || v === 'y';
    }

    _parseRotation(value) {
      if (value === null || value === undefined || value === '') return false;
      const v = String(value).trim().toLowerCase();
      if (v === 'cw' || v === 'ccw') return true;
      const n = Number(v);
      if (!Number.isFinite(n)) return false;
      const r = Math.abs(n) % 360;
      return r === 90 || r === 270;
    }

    _toNumber(value) {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      const str = String(value).trim();
      if (!str) return null;
      const match = str.match(/-?\d+(\.\d+)?/);
      if (!match) return null;
      const n = Number(match[0]);
      return Number.isFinite(n) ? n : null;
    }

    _toInt(value, fallback = 0) {
      const n = this._toNumber(value);
      if (n === null) return fallback;
      return Math.trunc(n);
    }

    _toPositiveInt(value, fallback = 1) {
      const n = this._toInt(value, fallback);
      return n > 0 ? n : fallback;
    }

    _cutFrame(img, frame) {
      const srcX = this._toInt(frame.x, 0);
      const srcY = this._toInt(frame.y, 0);
      const srcW = this._toPositiveInt(frame.srcW, 1);
      const srcH = this._toPositiveInt(frame.srcH, 1);

      const canvas = document.createElement('canvas');
      canvas.width = this._toPositiveInt(frame.sourceW, Math.max(1, frame.spriteW || srcW));
      canvas.height = this._toPositiveInt(frame.sourceH, Math.max(1, frame.spriteH || srcH));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('NO_CANVAS');

      const dx = this._toInt(frame.spriteX, 0);
      const dy = this._toInt(frame.spriteY, 0);
      const dw = this._toPositiveInt(frame.spriteW, srcW);
      const dh = this._toPositiveInt(frame.spriteH, srcH);

      if (!frame.rotated) {
        ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
        return canvas;
      }

      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = srcW;
      sourceCanvas.height = srcH;
      const sourceCtx = sourceCanvas.getContext('2d');
      if (!sourceCtx) throw new Error('NO_CANVAS');
      sourceCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      const rotatedCanvas = document.createElement('canvas');
      rotatedCanvas.width = srcH;
      rotatedCanvas.height = srcW;
      const rotatedCtx = rotatedCanvas.getContext('2d');
      if (!rotatedCtx) throw new Error('NO_CANVAS');

      if (frame.inverseRotation) {
        rotatedCtx.translate(srcH, 0);
        rotatedCtx.rotate(Math.PI / 2);
      } else {
        rotatedCtx.translate(0, srcW);
        rotatedCtx.rotate(-Math.PI / 2);
      }
      rotatedCtx.drawImage(sourceCanvas, 0, 0);

      ctx.drawImage(rotatedCanvas, dx, dy, dw, dh);
      return canvas;
    }

    _canvasToBlob(canvas) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('No se pudo convertir el frame a PNG.'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      });
    }
  }

  // API pública del núcleo
  window.FunkierCore = {
    DEFAULTS,
    FTF,
    FunkierPacker
  };

  // Compat con código previo
  window.FunkierPacker = FunkierPacker;
})();
