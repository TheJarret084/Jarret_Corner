let dataGlobal = null;
let seccionActual = 'laboratorio'; // 🔑 ahora inicia en laboratorio

// Muestra u oculta la pantalla de carga
function mostrarCarga(visible) {
  const carga = document.getElementById('pantallaCarga');
  carga.style.display = visible ? 'flex' : 'none';
}

// Cargar el JSON y renderizar la sección inicial
async function cargarData() {
  mostrarCarga(true);
  try {
    const resp = await fetch(window.jsonFile || 'Corner.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error('No se pudo cargar el JSON');
    dataGlobal = await resp.json();

    renderizarNav();                  // 🔑 dibuja la barra arriba
    renderizarSeccion(seccionActual); // 🔑 muestra laboratorio por defecto

    setTimeout(() => mostrarCarga(false), 200);
  } catch (e) {
    console.error('Error cargando JSON:', e);
    alert('Error cargando contenido. Revisa la consola.');
    mostrarCarga(false);
  }
}

// Renderiza la barra de navegación desde dataGlobal.nav
function renderizarNav() {
  const navBar = document.getElementById('nav-bar');
  navBar.innerHTML = '';

  if (!dataGlobal || !dataGlobal.nav) return;

  for (let item of dataGlobal.nav) {
    const boton = document.createElement(item.tipo === 'link' ? 'a' : 'button');
    boton.textContent = item.titulo;

    if (item.tipo === 'link') {
      boton.href = item.url;
      boton.target = '_blank';
    } else {
      boton.addEventListener('click', () => {
        if (item.url.startsWith('#')) {
          renderizarSeccion(item.url.slice(1));
        } else {
          window.location.href = item.url;
        }
      });
    }

    navBar.appendChild(boton);
  }
}

// Renderiza cualquier sección definida en el JSON
function renderizarSeccion(seccion) {
  if (!dataGlobal || !dataGlobal[seccion]) return;

  seccionActual = seccion;

  // Cambia el título dinámicamente
  document.getElementById('titulo-seccion').textContent = 'Jarret Labs';


  // Contenido textual
  const contenidoDiv = document.getElementById('contenido');
  contenidoDiv.innerHTML = '';
  for (let texto of dataGlobal[seccion].contenido) {
    const p = document.createElement('p');
    p.textContent = texto;
    contenidoDiv.appendChild(p);
  }

  // Opciones como tarjetas
  const opcionesDiv = document.getElementById('opciones');
  opcionesDiv.innerHTML = '';
  for (let item of dataGlobal[seccion].opciones) {
    const cont = document.createElement('div');
    cont.className = 'contenedor-bonito';

    const h = document.createElement('h2');
    h.textContent = item.titulo;
    cont.appendChild(h);

    if (item.descripcion) {
      const p = document.createElement('p');
      p.textContent = item.descripcion;
      cont.appendChild(p);
    }

    const boton = document.createElement(item.tipo === 'link' ? 'a' : 'button');
    boton.textContent = item.botonTexto || 'Ir';

    if (item.tipo === 'link') {
      boton.href = item.url;
      boton.target = '_blank';
      boton.className = 'boton';
    } else {
      boton.className = 'boton2';
      boton.addEventListener('click', () => {
        if (item.url.startsWith('#')) {
          renderizarSeccion(item.url.slice(1));
        } else {
          window.location.href = item.url;
        }
      });
    }

    cont.appendChild(boton);
    opcionesDiv.appendChild(cont);
  }
}

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  cargarData();
  montarControlMusica();
});
