// =============================
// CONFIG
// =============================
window.jsonFile = window.jsonFile || '/Jarret_Corner/Corner.json';

let dataGlobal = null;

// =============================
// CARGAR DATA
// =============================
async function cargarData() {
    try {
        const resp = await fetch(window.jsonFile, { cache: 'no-cache' });

        if (!resp.ok) {
            throw new Error('Error cargando JSON');
        }

        dataGlobal = await resp.json();

        renderizarNav();

    } catch (e) {
        console.warn("No se pudo cargar JSON:", e);
    }
}

// =============================
// RENDER NAV
// =============================
function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar || !dataGlobal) return;

    let html = '';

    // botón principal
    html += `
        <a href="/index.html" class="nav-link">
            Menú
        </a>
    `;

    // dropdown desde JSON
    (dataGlobal.data?.nav || []).forEach(item => {
        if (item.tipo === 'dropdown') {
            html += `
                <div class="nav-dropdown">
                    <button class="nav-dropbtn">Más</button>
                    <div class="nav-dropdown-content">
            `;

            item.opciones?.forEach(opt => {
                html += `
                    <a href="${opt.url}" target="_blank">
                        ${opt.texto}
                    </a>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }
    });

    navBar.innerHTML = html;

    attachNavInteractions(navBar);
}

// =============================
// INTERACCIONES
// =============================
function attachNavInteractions(navBar) {
    if (!navBar || navBar.dataset.bound === '1') return;
    navBar.dataset.bound = '1';

    const closeAll = () => {
        navBar.querySelectorAll('.nav-dropdown.open')
            .forEach(d => d.classList.remove('open'));
    };

    navBar.querySelectorAll('.nav-dropdown').forEach(dropdown => {
        const btn = dropdown.querySelector('.nav-dropbtn');

        if (!btn) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const willOpen = !dropdown.classList.contains('open');

            closeAll();

            if (willOpen) {
                dropdown.classList.add('open');
            }
        });
    });

    // click afuera
    document.addEventListener('click', (e) => {
        if (!navBar.contains(e.target)) {
            closeAll();
        }
    });

    // ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAll();
        }
    });
}
