// Lector-JSON.js — Carga Fichas.json y renderiza nav, carrusel, footer y audio
(() => {
  const JSON_PATH = 'Fichas.json';
  const navBar = document.getElementById('nav-bar');
  const track = document.getElementById('carousel-track');
  const dotsWrap = document.getElementById('carousel-dots');
  const prevBtn = document.querySelector('.carousel-btn.prev');
  const nextBtn = document.querySelector('.carousel-btn.next');
  const musicBtn = document.getElementById('music-toggle');
  const audioEl = document.getElementById('Deidad');
  const footerMount = document.getElementById('footer-container');
  const headerEl = document.querySelector('.site-header');

  let currentIndex = 0;
  let slideCount = 0;

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function cargarJSON() {
    try {
      const resp = await fetch(JSON_PATH, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const data = await resp.json();

      const navData = data?.data?.nav || data?.nav || [];
      const fichas = Array.isArray(data.fichas) ? data.fichas : [];
      const footerData = data.footer || null;

      renderNav(navData);
      renderFichas(fichas);
      renderFooter(footerData);

    } catch (err) {
      console.error('Error cargando Fichas.json:', err);
      // fallback visual sencillo
      if (navBar) navBar.innerHTML = `<a class="nav-link" href="../index.html"><i class="fa fa-home"></i> Menú Principal</a>`;
      if (track) track.innerHTML = `<div class="ficha"><div class="ficha-contenido"><h3>Error</h3><p>No se cargaron las fichas.</p></div></div>`;
      if (footerMount) footerMount.innerHTML = `<footer class="site-footer"><p>Error cargando contenido.</p></footer>`;
    }
  }

  /* ---------------- NAV ---------------- */
  function renderNav(items) {
    if (!navBar) return;
    navBar.innerHTML = '';

    // home fijo
    const aHome = document.createElement('a');
    aHome.className = 'nav-link';
    aHome.href = '../index.html';
    aHome.innerHTML = '<i class="fa fa-home"></i> Menú Principal';
    navBar.appendChild(aHome);

    items.forEach(item => {
      try {
        if (item.tipo === 'dropdown') {
          const wrapper = document.createElement('div');
          wrapper.className = 'nav-dropdown';

          const btn = document.createElement('button');
          btn.className = 'nav-dropbtn';
          btn.type = 'button';
          btn.innerHTML = `<i class="fa fa-bars"></i> ${escapeHtml(item.titulo || 'Más')}`;

          const content = document.createElement('div');
          content.className = 'nav-dropdown-content';

          (item.opciones || []).forEach(opt => {
            const link = document.createElement('a');
            link.href = opt.url || '#';
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = opt.texto || opt.url || 'Enlace';
            content.appendChild(link);
          });

          wrapper.appendChild(btn);
          wrapper.appendChild(content);
          navBar.appendChild(wrapper);
        } else {
          // item directo
          const link = document.createElement('a');
          link.className = 'nav-link';
          link.href = item.url || '#';
          link.target = '_blank';
          link.rel = 'noopener';
          link.innerHTML = `${item.icono ? `<i class="${escapeHtml(item.icono)}"></i>` : ''} ${escapeHtml(item.texto || item.url || '')}`;
          navBar.appendChild(link);
        }
      } catch (e) {
        console.warn('Nav item inválido', item, e);
      }
    });

    attachNavHandlers();
  }

  function attachNavHandlers() {
    if (!navBar) return;

    // create/inject hamburger if not present
    let hamb = document.querySelector('.hamburger');
    if (!hamb && headerEl) {
      hamb = document.createElement('button');
      hamb.className = 'hamburger';
      hamb.type = 'button';
      hamb.setAttribute('aria-label', 'Abrir menú');
      hamb.innerHTML = '<span></span><span></span><span></span>';
      headerEl.appendChild(hamb);
    }

    // dropdown toggles
    navBar.querySelectorAll('.nav-dropbtn').forEach(btn => {
      const wrapper = btn.closest('.nav-dropdown');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = wrapper.classList.contains('open');
        // cerrar todos
        navBar.querySelectorAll('.nav-dropdown.open').forEach(w => w.classList.remove('open'));
        if (!open) wrapper.classList.add('open');
      });
    });

    // cerrar dropdowns al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!navBar.contains(e.target)) {
        navBar.querySelectorAll('.nav-dropdown.open').forEach(w => w.classList.remove('open'));
      }
    });

    // hamburger toggling nav-open
    if (hamb) {
      hamb.addEventListener('click', (e) => {
        e.stopPropagation();
        navBar.classList.toggle('nav-open');
      });
    }

    // prevenir enlaces '#' vacíos
    navBar.querySelectorAll('a').forEach(a => {
      if (a.getAttribute('href') === '#') a.addEventListener('click', ev => ev.preventDefault());
    });
  }

  /* ---------------- CARRUSEL ---------------- */
  function renderFichas(fichas) {
    if (!track || !dotsWrap) return;
    track.innerHTML = '';
    dotsWrap.innerHTML = '';

    fichas.forEach((ficha, i) => {
      const card = document.createElement('div');
      card.className = 'ficha';

      const img = document.createElement('img');
      img.className = 'ficha-img';
      img.alt = ficha.titulo || 'Avatar';
      img.src = ficha.imagen || 'images/Placeholder-avatar.png';
      img.onerror = () => { img.src = 'images/Placeholder-avatar.png'; };

      const content = document.createElement('div');
      content.className = 'ficha-contenido';

      const h3 = document.createElement('h3');
      h3.textContent = ficha.titulo || 'Sin título';

      const p = document.createElement('p');
      p.textContent = ficha.descripcion || '';

      const a = document.createElement('a');
      a.className = 'boton';
      a.href = ficha.link || '#';
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Ver más';

      content.appendChild(h3);
      content.appendChild(p);
      content.appendChild(a);

      card.appendChild(img);
      card.appendChild(content);
      track.appendChild(card);

      const dot = document.createElement('button');
      dot.className = 'carousel-dot';
      dot.type = 'button';
      dot.addEventListener('click', () => goToSlide(i));
      dotsWrap.appendChild(dot);
    });

    slideCount = track.children.length || 1;
    currentIndex = 0;
    updateCarousel();
    attachCarouselControls();
    addSwipe(track, prevSlide, nextSlide);
    window.addEventListener('resize', updateCarousel);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    });
  }

  function getSlideWidth() {
    const wrapper = document.querySelector('.carousel-track-wrapper');
    return wrapper ? wrapper.clientWidth : (track.children[0] ? track.children[0].getBoundingClientRect().width : 0);
  }

  function updateCarousel() {
    if (!track || !track.children.length) return;
    const slideWidth = getSlideWidth();
    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
    const dots = dotsWrap.querySelectorAll('.carousel-dot');
    dots.forEach((d, idx) => d.classList.toggle('active', idx === currentIndex));
  }

  function goToSlide(i) {
    if (slideCount === 0) return;
    if (i < 0) i = slideCount - 1;
    if (i >= slideCount) i = 0;
    currentIndex = i;
    updateCarousel();
  }
  function prevSlide() { goToSlide(currentIndex - 1); }
  function nextSlide() { goToSlide(currentIndex + 1); }

  function attachCarouselControls() {
    prevBtn && prevBtn.addEventListener('click', prevSlide);
    nextBtn && nextBtn.addEventListener('click', nextSlide);
  }

  function addSwipe(el, onLeft, onRight) {
    if (!el) return;
    let startX = null;
    function start(e) { startX = (e.touches ? e.touches[0].clientX : e.clientX); }
    function end(e) {
      if (startX === null) return;
      const endX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
      const dx = endX - startX;
      if (Math.abs(dx) > 40) (dx < 0 ? onRight() : onLeft());
      startX = null;
    }
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
  }

  /* ---------------- FOOTER ---------------- */
  function renderFooter(footerData) {
    if (!footerMount) return;
    // preferir datos del JSON pero si no vienen, colocar el footer por defecto
    const text = footerData?.texto || 'No te gusta? No me importa igual... Contáctame en Discord:';
    const url = footerData?.enlace || 'https://discord.com/users/thejarret084';
    const icon = footerData?.icono || 'fa-brands fa-discord';

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <p>${escapeHtml(text)}</p>
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="discord-link" aria-label="Discord">
        <i class="${escapeHtml(icon)}"></i>
      </a>
    `;
    footerMount.innerHTML = '';
    footerMount.appendChild(footer);
  }

  /* ---------------- AUDIO ---------------- */
  function toggleMusic() {
    if (!audioEl || !musicBtn) return;
    if (audioEl.paused) {
      audioEl.play().then(() => {
        musicBtn.setAttribute('aria-pressed', 'true');
        musicBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      }).catch(err => {
        console.warn('No se pudo reproducir audio:', err);
      });
    } else {
      audioEl.pause();
      musicBtn.setAttribute('aria-pressed', 'false');
      musicBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
  }

  /* ---------------- INIT ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    cargarJSON();
    if (musicBtn) musicBtn.addEventListener('click', toggleMusic);

    // cerrar nav si cambia el tamaño a desktop
    window.addEventListener('resize', () => {
      if (navBar && window.innerWidth > 820) navBar.classList.remove('nav-open');
    });
  });

})();
