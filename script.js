const carrusel = document.getElementById('carrusel');

 function scrollIzquierda() {
    carrusel.scrollBy({ left: -200, behavior: 'smooth' });
  }

 function scrollDerecha() {
   carrusel.scrollBy({ left: 200, behavior: 'smooth' });
  }

  function abrirHTML(ruta) {
   window.location.href = ruta;
 }

 function ejecutarScript() {
   alert('¡Aquí puedes ejecutar tu script!');
   // Aquí puedes poner cualquier código JavaScript
}
const musica = document.getElementById('miMusica');
const boton = document.getElementById('botonMusica');

boton.addEventListener('click', () => {
  if (musica.paused) {
    musica.play();
    boton.textContent = "⏸ Pausar";
  } else {
    musica.pause();
    boton.textContent = "▶ Reproducir";
  }
});
