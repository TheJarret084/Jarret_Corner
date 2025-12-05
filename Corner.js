let dataGlobal = null;
let seccionActual = 'laboratorio';
let logsData = [];
let currentLogFilter = 'all';

// ================== FUNCIÓN DE COPOS DE NIEVE ==================
function crearCoposDeNieve() {
    const snowflakesContainer = document.getElementById('snowflakes');
    if (!snowflakesContainer) return;
    
    // Limpiar copos existentes
    snowflakesContainer.innerHTML = '';
    
    // Crear 50 copos de nieve
    for (let i = 0; i < 50; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';
        
        // Posición aleatoria
        const left = Math.random() * 100;
        const size = Math.random() * 1.5 + 0.5;
        const duration = Math.random() * 5 + 5;
        const delay = Math.random() * 5;
        
        // Aplicar estilos
        snowflake.style.left = `${left}%`;
        snowflake.style.fontSize = `${size}em`;
        snowflake.style.animationDuration = `${duration}s`;
        snowflake.style.animationDelay = `${delay}s`;
        snowflake.style.opacity = `${Math.random() * 0.7 + 0.3}`;
        
        snowflakesContainer.appendChild(snowflake);
    }
}

// ================== PANTALLA DE CARGA ==================
function mostrarCarga(visible) {
    const carga = document.getElementById('pantallaCarga');
    if (carga) {
        carga.style.display = visible ? 'flex' : 'none';
        if (visible) {
            crearCoposDeNieve();
        }
    }
}

// ================== CARGAR DATOS ==================
async function cargarData() {
    mostrarCarga(true);
    try {
        const resp = await fetch('Corner.json', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('No se pudo cargar Corner.json');
        dataGlobal = await resp.json();
        renderizarNav();
        renderizarSeccion(seccionActual);
        cargarLogsData();
        setTimeout(() => mostrarCarga(false), 500);
    } catch(e) {
        console.error('Error cargando JSON:', e);
        mostrarCarga(false);
    }
}

async function cargarLogsData() {
    try {
        const resp = await fetch('CornerLogs.json', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('No se pudo cargar logs');
        logsData = await resp.json();
        if (seccionActual === 'logs') renderizarLogs();
    } catch(e) {
        console.warn('No se pudieron cargar los logs:', e);
        logsData = [
            {
                "id": "0",
                "date": new Date().toISOString(),
                "version": "v2.2.0",
                "title": "Tema Navideño Activado",
                "body": "Se ha aplicado el tema navideño con copos de nieve animados. ¡Felices fiestas!",
                "tags": ["navidad", "ui", "feature"],
                "important": true
            }
        ];
    }
}

// ================== RENDERIZAR NAVBAR ==================
function renderizarNav() {
    const navBar = document.getElementById('nav-bar');
    if (!navBar || !dataGlobal) return;
    navBar.innerHTML = '';

    if (dataGlobal.data.nav) {
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
}

// ================== RENDERIZAR SECCIÓN ==================
function renderizarSeccion(seccion) {
    if (seccion === 'logs') {
        mostrarLogs();
        return;
    }

    document.getElementById('logs-container').style.display = 'none';
    document.getElementById('opciones-container').style.display = 'block';
    
    const cont = document.getElementById('contenido');
    const opciones = document.getElementById('opciones');
    
    if (!dataGlobal || !dataGlobal.data[seccion]) {
        cont.innerHTML = '<p>Sección no encontrada.</p>';
        return;
    }

    const datos = dataGlobal.data[seccion];
    cont.innerHTML = '';
    opciones.innerHTML = '';

    datos.contenido.forEach(texto => {
        const p = document.createElement('p');
        p.textContent = texto;
        cont.appendChild(p);
    });

    datos.opciones.forEach(op => {
        const card = document.createElement('div');
        card.className = 'contenedor-bonito';
        
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
    });
}

// ================== MOSTRAR LOGS ==================
function mostrarLogs() {
    document.getElementById('opciones-container').style.display = 'none';
    document.getElementById('logs-container').style.display = 'block';
    
    const cont = document.getElementById('contenido');
    cont.innerHTML = '<h2 style="text-align: center;">📜 Historial de Actualizaciones</h2>';
    
    document.getElementById('titulo-seccion').textContent = 'CornerLogs';
    renderizarLogs();
}

function renderizarLogs() {
    const container = document.getElementById('logs-list');
    if (!container) return;
    
    container.innerHTML = '';

    let filteredLogs = [...logsData];
    if (currentLogFilter !== 'all') {
        if (currentLogFilter === 'important') {
            filteredLogs = logsData.filter(log => log.important);
        } else {
            filteredLogs = logsData.filter(log => 
                log.tags && log.tags.includes(currentLogFilter)
            );
        }
    }

    if (filteredLogs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #2e7d32;">No hay actualizaciones para mostrar.</p>';
        return;
    }

    filteredLogs.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${log.important ? 'important' : ''}`;
        
        const date = new Date(log.date);
        const formattedDate = date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const tagsHtml = log.tags && log.tags.length > 0 ? 
            `<div class="log-tags">
                ${log.tags.map(tag => `<span class="log-tag">${tag}</span>`).join('')}
            </div>` : '';

        logEntry.innerHTML = `
            <div class="log-header">
                <h3 class="log-title">${log.title}</h3>
                <div class="log-meta">
                    ${log.version ? `<span class="log-version">${log.version}</span>` : ''}
                    <span class="log-date">${formattedDate}</span>
                </div>
            </div>
            <div class="log-body">${log.body}</div>
            ${tagsHtml}
        `;

        container.appendChild(logEntry);
    });
}

// ================== AÑADIR LOG ==================
function añadirNuevoLog() {
    const title = document.getElementById('new-log-title').value.trim();
    const body = document.getElementById('new-log-body').value.trim();
    const version = document.getElementById('new-log-version').value.trim();
    const tagsInput = document.getElementById('new-log-tags').value;
    const important = document.getElementById('new-log-important').checked;

    if (!title || !body) {
        alert('Por favor, completa al menos el título y la descripción.');
        return;
    }

    const tags = tagsInput.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);

    const nuevoLog = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        version: version || '',
        title: title,
        body: body,
        tags: tags,
        important: important
    };

    logsData.unshift(nuevoLog);
    renderizarLogs();
    cerrarModalLog();
    
    document.getElementById('new-log-title').value = '';
    document.getElementById('new-log-body').value = '';
    document.getElementById('new-log-version').value = '';
    document.getElementById('new-log-tags').value = '';
    document.getElementById('new-log-important').checked = false;
}

// ================== EXPORTAR LOGS ==================
function exportarLogs() {
    const dataStr = JSON.stringify(logsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CornerLogs.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('JSON exportado con éxito: CornerLogs.json');
}

// ================== MODAL ==================
function mostrarModalLog() {
    document.getElementById('log-modal').style.display = 'flex';
}

function cerrarModalLog() {
    document.getElementById('log-modal').style.display = 'none';
}

// ================== FILTRO LOGS ==================
function cambiarFiltroLogs(filtro) {
    currentLogFilter = filtro;
    document.querySelectorAll('.logs-control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.logs-control-btn[data-filter="${filtro}"]`)?.classList.add('active');
    renderizarLogs();
}

// ================== EVENTOS ==================
document.addEventListener('DOMContentLoaded', () => {
    cargarData();
    
    // Crear copos en el fondo también (no solo en loading)
    setTimeout(crearCoposDeNieve, 100);

    // Hamburger menu
    const hamburger = document.querySelector('.hamburger');
    hamburger.addEventListener('click', () => {
        document.querySelector('.header').classList.toggle('nav-open');
    });

    document.addEventListener('click', (e) => {
        const header = document.querySelector('.header');
        if (header && !header.contains(e.target)) {
            header.classList.remove('nav-open');
        }
    });

    // Botón Beta
    const betaBtn = document.getElementById('beta-btn');
    betaBtn.addEventListener('click', () => {
        const body = document.body;
        
        if (seccionActual === 'beta') {
            seccionActual = 'laboratorio';
            betaBtn.textContent = '🧪 Beta';
            body.classList.remove('modo-beta');
            document.getElementById('titulo-seccion').textContent = 'Laboratorio de TheJarret084';
        } else if (seccionActual === 'logs') {
            seccionActual = 'beta';
            betaBtn.textContent = '⬅️ Volver';
            body.classList.add('modo-beta');
            document.getElementById('titulo-seccion').textContent = 'Laboratorio de TheJarret084 / Área Beta';
        } else {
            seccionActual = 'beta';
            betaBtn.textContent = '⬅️ Volver';
            body.classList.add('modo-beta');
            document.getElementById('titulo-seccion').textContent = 'Laboratorio de TheJarret084 / Área Beta';
        }
        
        renderizarSeccion(seccionActual);
    });

    // Botón Logs
    const logsBtn = document.getElementById('logs-btn');
    logsBtn.addEventListener('click', () => {
        if (seccionActual === 'logs') {
            seccionActual = 'laboratorio';
            logsBtn.textContent = '📝 Actualizaciones';
            document.body.classList.remove('modo-beta');
            betaBtn.textContent = '🧪 Beta';
            document.getElementById('titulo-seccion').textContent = 'Laboratorio de TheJarret084';
        } else {
            seccionActual = 'logs';
            logsBtn.textContent = '⬅️ Volver';
            document.getElementById('titulo-seccion').textContent = 'CornerLogs';
        }
        
        renderizarSeccion(seccionActual);
    });

    // Eventos logs
    document.querySelectorAll('.logs-control-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', function() {
            cambiarFiltroLogs(this.dataset.filter);
        });
    });

    document.getElementById('add-log-btn').addEventListener('click', mostrarModalLog);
    document.getElementById('export-logs-btn').addEventListener('click', exportarLogs);
    document.getElementById('cancel-log-btn').addEventListener('click', cerrarModalLog);
    document.getElementById('save-log-btn').addEventListener('click', añadirNuevoLog);

    // Cerrar modal
    document.getElementById('log-modal').addEventListener('click', function(e) {
        if (e.target === this) cerrarModalLog();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarModalLog();
    });
});
