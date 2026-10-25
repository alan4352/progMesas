// Utilidades compartidas por index.html y dashboard.html

const API = '/api';

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
