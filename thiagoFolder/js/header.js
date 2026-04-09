let dataGlobal = null;

// ================== PANTALLA DE CARGA ==================
function mostrarCarga(visible) {
    const carga = document.getElementById('pantallaCarga');
    if (carga) {
        carga.style.display = visible ? 'flex' : 'none';
    }
}

// ================== CARGAR DATOS ==================
async function cargarData() {
    mostrarCarga(true);

    try {
        const resp = await fetch('/Jarret_Corner/Corner.json', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('No se pudo cargar Corner.json');

        dataGlobal = await resp.json();

        renderizarNav();
        renderizarSeccion?.(seccionActual);
        cargarLogsData?.();

        setupHamburger();

        setTimeout(() => mostrarCarga(false), 300);

    } catch (e) {
        console.error('Error cargando JSON:', e);
        mostrarCarga(false);
    }
}

// ================== RENDERIZAR NAVBAR ==================
function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar) return;

    navBar.innerHTML = '';

    const navData = dataGlobal?.data?.nav;
    if (!navData) return;

    navData.forEach(item => {
        if (item.tipo === 'dropdown' && item.opciones) {
            item.opciones.forEach(op => {
                const a = document.createElement('a');
                a.href = op.url || "#";
                a.textContent = op.texto || "link";
                a.target = '_blank';

                navBar.appendChild(a);
            });
        }
    });
}

// ================== HAMBURGER (PRO) ==================
function setupHamburger() {
    const header = document.querySelector('.header');
    const btn = document.querySelector('.hamburger');

    if (!header || !btn) return;

    // toggle menu
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // evita cerrar instantáneo
        header.classList.toggle('nav-open');
    });

    // cerrar al hacer click afuera
    document.addEventListener('click', (e) => {
        if (!header.contains(e.target)) {
            header.classList.remove('nav-open');
        }
    });

    // cerrar con ESC (god UX)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            header.classList.remove('nav-open');
        }
    });
}

// click

/*
const clickSound = new Audio('/sounds/click.ogg');

btn.addEventListener('click', () => {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
});
*/
