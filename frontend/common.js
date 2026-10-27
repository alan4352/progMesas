// Utilidades compartidas por index.html y dashboard.html

const API = '/api';

// ================= ÍCONOS =================
// Íconos SVG de trazo (estilo Lucide, licencia ISC). Van dentro del código porque la
// política de seguridad del sitio no permite cargar librerías externas.

const ICONOS = {
    candado: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    ingresar: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    tablero: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    ojo: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    ojoTachado: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    documento: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    cerrar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    volver: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>',
    docente: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    calendario: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    eliminar: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    confirmar: '<path d="M20 6 9 17l-5-5"/>',
    descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    curso: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'
};

/** Devuelve el SVG de un ícono para insertar en HTML. */
function icono(nombre) {
    return `<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
        `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONOS[nombre] || ''}</svg>`;
}

/** Reemplaza los <span data-icono="..."> del HTML fijo por su ícono. */
function pintarIconos(raiz = document) {
    for (const el of raiz.querySelectorAll('[data-icono]')) {
        el.outerHTML = icono(el.dataset.icono);
    }
}
pintarIconos();

// ================= TEXTO SEGURO =================

/** Escapa texto para insertarlo en HTML (evita que un título con <script> se ejecute). */
function esc(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Sólo se aceptan PDFs de este servidor o de Google Drive. */
function urlPdfSegura(url) {
    const u = String(url || '');
    if (u.startsWith('/uploads/')) return u;
    if (/^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/preview$/.test(u)) return u;
    return null;
}

function compararCursos(a, b) {
    return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

// ================= SESIÓN =================
// El token puede llegar de dos formas:
//   - desde el sistema principal, en la dirección:  /?token=...  (se guarda y se quita de la barra)
//   - del login de prueba de ProgMesas
// Si el sistema principal usa una cookie, no hay token guardado y el servidor la lee solo.
// Quién es el usuario lo responde siempre el servidor (/api/yo): el navegador no interpreta el token.

function leerToken() {
    try {
        return localStorage.getItem('token');
    } catch {
        return null;
    }
}

function guardarSesion(token) {
    try {
        localStorage.setItem('token', token);
    } catch {
        showToast('El navegador no permite guardar la sesión', 'danger');
    }
}

function cerrarSesion() {
    try {
        localStorage.removeItem('token');
    } catch {
        /* nada */
    }
}

function guardarAviso(mensaje) {
    try {
        sessionStorage.setItem('aviso', mensaje);
    } catch {
        /* nada */
    }
}

/** Toma el token que manda el sistema principal en la dirección y lo saca de la barra. */
function tomarTokenDeLaUrl() {
    const url = new URL(location.href);
    const token = url.searchParams.get('token');
    if (!token) return;
    guardarSesion(token);
    url.searchParams.delete('token');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/** Pregunta al servidor quién es el usuario. Devuelve null si es un visitante. */
async function cargarIdentidad() {
    tomarTokenDeLaUrl();
    const teniaToken = Boolean(leerToken());
    let yo;
    try {
        yo = await api('/yo');
    } catch {
        return null;
    }
    if (!yo.autenticado) {
        if (teniaToken) {
            cerrarSesion();
            showToast('Tu sesión venció. Volvé a ingresar.', 'warning', 6000);
        }
        return null;
    }
    return yo;
}

/**
 * fetch con el token y manejo de errores uniforme.
 * Lanza Error con el mensaje del servidor si la respuesta no es OK.
 */
async function api(ruta, opciones = {}) {
    const token = leerToken();
    const headers = { ...(opciones.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opciones.json !== undefined) {
        headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(opciones.json);
    }

    let res;
    try {
        res = await fetch(API + ruta, { ...opciones, headers, credentials: 'same-origin' });
    } catch {
        throw new Error('No se pudo conectar con el servidor');
    }

    const datos = await res.json().catch(() => ({}));
    if (res.status === 401 && ruta !== '/login') {
        cerrarSesion();
        guardarAviso(datos.error || 'Tu sesión venció. Volvé a ingresar.');
        location.reload();
        throw new Error(datos.error || 'Sesión vencida');
    }
    if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
    return datos;
}

// ================= TOASTS =================

function showToast(mensaje, tipo = 'info', duracion = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast' + (tipo === 'success' ? ' toast-success' : tipo === 'danger' ? ' toast-danger' : tipo === 'warning' ? ' toast-warning' : '');
    toast.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duracion);
}

/** Muestra un aviso guardado antes de recargar la página (por ejemplo, sesión vencida). */
function mostrarAvisoPendiente() {
    let aviso = null;
    try {
        aviso = sessionStorage.getItem('aviso');
        sessionStorage.removeItem('aviso');
    } catch {
        /* nada */
    }
    if (aviso) showToast(aviso, 'warning', 6000);
}
