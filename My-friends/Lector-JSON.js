fetch('Fichas.json')
  .then(response => response.json())
  .then(data => {
    const track = document.getElementById('carousel-track');
    track.innerHTML = ''; // limpiar por si se recarga

    data.fichas.forEach(ficha => {
      const div = document.createElement('div');
      div.className = 'ficha';

      const imgHtml = ficha.imagen
        ? `<img src="${ficha.imagen}" class="ficha-img" alt="${ficha.titulo}" onerror="this.src='images/Placeholder-avatar.png';">`
        : `<img src="images/Placeholder-avatar.png" class="ficha-img" alt="Avatar por defecto">`;

      const linkHtml = ficha.link
        ? `<a href="${ficha.link}" target="_blank" class="boton">Ver más</a>`
        : `<a href="#" class="boton">Ver más</a>`;

      div.innerHTML = `
        ${imgHtml}
        <div class="ficha-contenido">
          <h3>${ficha.titulo}</h3>
          <p>${ficha.descripcion}</p>
          ${linkHtml}
        </div>
      `;

      track.appendChild(div); // inyectamos la ficha en el carousel
    });

    // 🔹 Aquí agregamos el carrusel después de que las fichas se inyectan
    let index = 0;

    function showSlide(i) {
      const total = track.children.length;
      if (i < 0) index = total - 1;
      else if (i >= total) index = 0;
      else index = i;

      const slideWidth = track.children[0].offsetWidth;
      track.style.transform = `translateX(-${index * slideWidth}px)`;
    }

    document.querySelector('.prev').addEventListener('click', () => showSlide(index - 1));
    document.querySelector('.next').addEventListener('click', () => showSlide(index + 1));

    showSlide(0); // mostrar la primera ficha
  })
  .catch(err => console.error('Error cargando JSON:', err));
fetch('Fichas.json')
  .then(response => response.json())
  .then(data => {
    const track = document.getElementById('carousel-track');
    track.innerHTML = ''; // limpiar por si se recarga

    data.fichas.forEach(ficha => {
      const div = document.createElement('div');
      div.className = 'ficha';

      const imgHtml = ficha.imagen
        ? `<img src="${ficha.imagen}" class="ficha-img" alt="${ficha.titulo}" onerror="this.src='images/Placeholder-avatar.png';">`
        : `<img src="images/Placeholder-avatar.png" class="ficha-img" alt="Avatar por defecto">`;

      const linkHtml = ficha.link
        ? `<a href="${ficha.link}" target="_blank" class="boton">Ver más</a>`
        : `<a href="#" class="boton">Ver más</a>`;

      div.innerHTML = `
        ${imgHtml}
        <div class="ficha-contenido">
          <h3>${ficha.titulo}</h3>
          <p>${ficha.descripcion}</p>
          ${linkHtml}
        </div>
      `;

      track.appendChild(div); // inyectamos la ficha en el carousel
    });

    // 🔹 Aquí agregamos el carrusel después de que las fichas se inyectan
    let index = 0;

    function showSlide(i) {
      const total = track.children.length;
      if (i < 0) index = total - 1;
      else if (i >= total) index = 0;
      else index = i;

      const slideWidth = track.children[0].offsetWidth;
      track.style.transform = `translateX(-${index * slideWidth}px)`;
    }

    document.querySelector('.prev').addEventListener('click', () => showSlide(index - 1));
    document.querySelector('.next').addEventListener('click', () => showSlide(index + 1));

    showSlide(0); // mostrar la primera ficha
  })
  .catch(err => console.error('Error cargando JSON:', err));

  