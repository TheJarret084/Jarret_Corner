/**
 * spawnImage(options)
 * options:
 *  - src: string (imagen)
 *  - side: 'left'|'right'|'top'|'bottom'
 *  - frames: integer (número de frames de animación; 60 ≈ 1s)
 *  - sizePx: integer (tamaño del lado mayor en px)
 *  - behaviour: 'stopCenter'|'passThrough'
 */

function spawnImage(options) {
  const { src, side, frames = 120, sizePx = 160, behaviour = 'stopCenter' } = options;

  // crear elemento img
  const img = new Image();
  img.className = 'anim-img';
  img.draggable = false;
  img.style.width = sizePx + 'px';
  img.style.height = 'auto';
  img.style.opacity = '0.98';
  img.src = src;

  // añadir al DOM (pero oculto hasta que cargue para calcular tamaño si es necesario)
  document.body.appendChild(img);

  // cuando la imagen esté lista, calcular animación
  img.onload = () => {
    const imgBoxW = img.getBoundingClientRect().width;
    const imgBoxH = img.getBoundingClientRect().height;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let startX, startY, endX, endY;

    if (side === 'left') {
      startX = -imgBoxW - 8;
      startY = (vh - imgBoxH) / 2;
      if (behaviour === 'stopCenter') {
        endX = (vw - imgBoxW) / 2;
        endY = startY;
      } else {
        endX = vw + imgBoxW + 8;
        endY = startY;
      }
    } else if (side === 'right') {
      startX = vw + imgBoxW + 8;
      startY = (vh - imgBoxH) / 2;
      if (behaviour === 'stopCenter') {
        endX = (vw - imgBoxW) / 2;
        endY = startY;
      } else {
        endX = -imgBoxW - 8;
        endY = startY;
      }
    } else if (side === 'top') {
      startY = -imgBoxH - 8;
      startX = (vw - imgBoxW) / 2;
      if (behaviour === 'stopCenter') {
        endY = (vh - imgBoxH) / 2;
        endX = startX;
      } else {
        endY = vh + imgBoxH + 8;
        endX = startX;
      }
    } else if (side === 'bottom') {
      startY = vh + imgBoxH + 8;
      startX = (vw - imgBoxW) / 2;
      if (behaviour === 'stopCenter') {
        endY = (vh - imgBoxH) / 2;
        endX = startX;
      } else {
        endY = -imgBoxH - 8;
        endX = startX;
      }
    } else {
      startX = -imgBoxW - 8;
      startY = (vh - imgBoxH) / 2;
      endX = (vw - imgBoxW) / 2;
      endY = startY;
    }

    img.style.transform = `translate(${startX}px, ${startY}px)`;
    img.style.left = '0';
    img.style.top = '0';

    const totalFrames = Math.max(1, Math.floor(frames));
    let frame = 0;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function step() {
      frame++;
      const t = Math.min(1, frame / totalFrames);
      const e = easeOutCubic(t);

      const curX = startX + (endX - startX) * e;
      const curY = startY + (endY - startY) * e;

      img.style.transform = `translate(${curX}px, ${curY}px)`;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (behaviour === 'passThrough') {
          setTimeout(() => {
            if (img && img.parentNode) img.parentNode.removeChild(img);
          }, 300);
        } else {
          img.style.pointerEvents = 'auto';
        }
      }
    }

    requestAnimationFrame(step);

    const onResize = () => {
      if (frame >= totalFrames && behaviour === 'stopCenter') {
        const newEndX = (window.innerWidth - imgBoxW) / 2;
        const newEndY = (window.innerHeight - imgBoxH) / 2;
        img.style.transform = `translate(${newEndX}px, ${newEndY}px)`;
      }
    };
    window.addEventListener('resize', onResize);

    const obs = new MutationObserver(() => {
      if (!document.body.contains(img)) {
        window.removeEventListener('resize', onResize);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  };

  img.onerror = () => {
    console.warn('No se pudo cargar la imagen:', src);
    if (img.parentNode) img.parentNode.removeChild(img);
  };
}

/* Hook botones de la UI */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('spawn1').addEventListener('click', () => {
    const src = document.getElementById('img1-url').value.trim();
    const side = document.getElementById('img1-side').value;
    const frames = parseInt(document.getElementById('img1-frames').value, 10) || 120;
    const size = parseInt(document.getElementById('img1-size').value, 10) || 160;
    const behaviour = document.getElementById('img1-behaviour').value;
    spawnImage({ src, side, frames, sizePx: size, behaviour });
  });

  document.getElementById('spawn2').addEventListener('click', () => {
    const src = document.getElementById('img2-url').value.trim();
    const side = document.getElementById('img2-side').value;
    const frames = parseInt(document.getElementById('img2-frames').value, 10) || 120;
    const size = parseInt(document.getElementById('img2-size').value, 10) || 140;
    const behaviour = document.getElementById('img2-behaviour').value;
    spawnImage({ src, side, frames, sizePx: size, behaviour });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === '1') document.getElementById('spawn1').click();
    if (e.key === '2') document.getElementById('spawn2').click();
  });
});