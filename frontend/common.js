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

function leerPayload(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
        );
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/** Devuelve el usuario de la sesión o null. Si el token venció lo borra. */
function sesionActual() {
    let token = null;
    try {
        token = localStorage.getItem('token');
    } catch {
        return null;
    }
    if (!token) return null;
    const payload = leerPayload(token);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
        cerrarSesion();
        sessionStorage.setItem('aviso', 'Tu sesión venció. Volvé a iniciar sesión.');
        return null;
    }
    return { ...payload, token };
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

/**
 * fetch con el token y manejo de errores uniforme.
 * Lanza Error con el mensaje del servidor si la respuesta no es OK.
 */
async function api(ruta, opciones = {}) {
    const sesion = sesionActual();
    const headers = { ...(opciones.headers || {}) };
    if (sesion) headers.Authorization = 'Bearer ' + sesion.token;
    if (opciones.json !== undefined) {
        headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(opciones.json);
    }

    let res;
    try {
        res = await fetch(API + ruta, { ...opciones, headers });
    } catch {
        throw new Error('No se pudo conectar con el servidor');
    }

    const datos = await res.json().catch(() => ({}));
    if (res.status === 401 && sesion) {
        cerrarSesion();
        sessionStorage.setItem('aviso', datos.error || 'Tu sesión venció. Volvé a iniciar sesión.');
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
    const aviso = sessionStorage.getItem('aviso');
    if (aviso) {
        sessionStorage.removeItem('aviso');
        showToast(aviso, 'warning', 6000);
    }
}
