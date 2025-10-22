let dataGlobal = null;
let seccionActual = 'laboratorio';

// Mostrar / ocultar pantalla de carga
function mostrarCarga(visible) {
    const carga = document.getElementById('pantallaCarga');
    if (carga) carga.style.display = visible ? 'flex' : 'none';
}

// Cargar JSON
async function cargarData() {
    mostrarCarga(true);
    try {
        const resp = await fetch(window.jsonFile || 'Corner.json', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('No se pudo cargar el JSON');
        dataGlobal = await resp.json();
        renderizarNav();
        renderizarSeccion(seccionActual);
        setTimeout(() => mostrarCarga(false), 200);
    } catch(e) {
        console.error('Error cargando JSON:', e);
        alert('Error cargando contenido. Revisa la consola.');
        mostrarCarga(false);
    }
}

// Renderizar Navbar
function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar || !dataGlobal) return;
    navBar.innerHTML = '';

    dataGlobal.data.nav.forEach(item => {
        if (item.tipo === 'dropdown') {
            item.opciones.forEach(op => {
                const a = document.createElement('a');
                a.href = op.url;
                a.textContent = op.texto;
                a.target = '_blank';
                navBar.appendChild(a);
            });
        }
    });
}

// Renderizar sección
function renderizarSeccion(seccion) {
    if (!dataGlobal) return;

    const cont = document.getElementById('contenido');
    const opciones = document.getElementById('opciones');
    cont.innerHTML = '';
    opciones.innerHTML = '';

    const datos = dataGlobal.data[seccion];
    if (!datos) return;

    // Contenido textual
    datos.contenido.forEach(texto => {
        const p = document.createElement('p');
        p.textContent = texto;
        cont.appendChild(p);
    });

    // Tarjetas
    datos.opciones.forEach(op => {
        const card = document.createElement('div');
        card.className = 'contenedor-bonito';

        const h2 = document.createElement('h2');
        h2.textContent = op.titulo;

        const p = document.createElement('p');
        p.textContent = op.descripcion;

        const btn = document.createElement('a');
        btn.className = 'boton';
        btn.href = op.url;
        btn.textContent = op.botonTexto;
        btn.target = '_blank';

        card.appendChild(h2);
        card.appendChild(p);
        card.appendChild(btn);

        opciones.appendChild(card);

        /*
        // Esta es la mierda que no quiero que se vea pero, que este aqui
        datos.opciones.forEach(op => {
        const card = document.createElement('div');
        card.className = 'contenedor-bonito';

        // Cambiar color si es sección beta
        if (seccion === 'beta') {
           card.classList.add('beta-card');
        }

        const h2 = document.createElement('h2');
        h2.textContent = op.titulo;

        const p = document.createElement('p');
        p.textContent = op.descripcion;

        const btn = document.createElement('a');
        btn.className = 'boton';
        btn.href = op.url;
        btn.textContent = op.botonTexto;
        btn.target = '_blank';

        card.appendChild(h2);
        card.appendChild(p);
        card.appendChild(btn);

        opciones.appendChild(card);
    }); */
    });
}

// JSON file
window.jsonFile = 'Corner.json';

// Evento DOM
document.addEventListener('DOMContentLoaded', () => {
    cargarData();

    // Hamburger toggle
    const hamburger = document.querySelector('.hamburger');
    hamburger.addEventListener('click', () => {
        document.querySelector('.header').classList.toggle('nav-open');
    });

    // Cierra menú si se hace click fuera
    document.addEventListener('click', (e) => {
        const header = document.querySelector('.header');
        if (!header.contains(e.target)) {
            header.classList.remove('nav-open');
        }
    });

   /*  // Botón para acceder al modo Beta
    const betaBtn = document.createElement('button');
    betaBtn.textContent = '🧪 Beta';
    betaBtn.id = 'beta-btn';
    document.querySelector('.footer').appendChild(betaBtn);

    betaBtn.addEventListener('click', () => {
        if (seccionActual === 'beta') {
            seccionActual = 'laboratorio';
            betaBtn.textContent = '🧪 Beta';
        } else {
            seccionActual = 'beta';
            betaBtn.textContent = '⬅️ Volver';
        }
        renderizarSeccion(seccionActual);
    }); */

   // Botón para acceder al modo Beta
    const betaBtn = document.createElement('button');
    betaBtn.textContent = '🧪 Beta';
    betaBtn.id = 'beta-btn';
        document.querySelector('.footer').appendChild(betaBtn);

    betaBtn.addEventListener('click', () => {
     const body = document.body;

     // Agregamos transición suave
        body.style.transition = 'background 0.6s ease, color 0.6s ease';

      if (seccionActual === 'beta') {
         seccionActual = 'laboratorio';
         betaBtn.textContent = '🧪 Beta';
         body.classList.remove('modo-beta');
         document.getElementById('titulo-seccion').textContent = 'Laboratorio de TheJarret084';
        } else {
         seccionActual = 'beta';
         betaBtn.textContent = '⬅️ Volver';
         body.classList.add('modo-beta');
         document.getElementById('titulo-seccion').textContent = 'Laboratorio de TheJarret084 / Area Beta';
       }

    // Le damos una ligera demora para el render
    setTimeout(() => renderizarSeccion(seccionActual), 150);
});

});
