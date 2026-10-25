// Identidad del usuario. Es la ÚNICA parte de ProgMesas que sabe de dónde viene el usuario:
//
//   AUTH_MODO=prueba  → login propio con las cuentas de prueba de la base (desarrollo)
//   AUTH_MODO=externo → el usuario llega autenticado desde el sistema principal con un token firmado
//
// El resto del sistema sólo usa req.user = { id, nombre, email, role }, donde role es uno de:
//   teacher (docente) | advisor (asesora) | viewer (consulta: preceptor, directivo) | student (alumno)
// Para conectar con el formato real del sistema principal sólo hace falta tocar este archivo y el .env.

import jwt from 'jsonwebtoken';
import { AUTH_MODO, JWT_SECRET, JWT_DURACION, EXTERNO, ROLES } from './config.js';

// ================= ROLES =================

const PRIORIDAD = ['advisor', 'teacher', 'viewer', 'student'];

/** Traduce el rol del sistema principal (texto o lista) al rol interno. Devuelve null si no se reconoce. */
export function mapearRol(valor) {
    const valores = (Array.isArray(valor) ? valor : String(valor ?? '').split(','))
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean);
    for (const interno of PRIORIDAD) {
        if (valores.some((v) => v === interno || ROLES[interno].includes(v))) return interno;
    }
    return null;
}

// ================= LECTURA DEL TOKEN =================

function leerCookie(req, nombre) {
    const cookies = req.headers.cookie || '';
    for (const parte of cookies.split(';')) {
        const [k, ...v] = parte.trim().split('=');
        if (k === nombre) return decodeURIComponent(v.join('='));
    }
    return null;
}

function leerToken(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
    if (AUTH_MODO === 'externo' && EXTERNO.cookie) return leerCookie(req, EXTERNO.cookie);
    return null;
}

function valorClaim(payload, ruta) {
    // admite claims anidados, por ejemplo "usuario.id"
    return ruta.split('.').reduce((obj, k) => (obj == null ? undefined : obj[k]), payload);
}

/**
 * Devuelve la identidad normalizada o lanza un error con status 401.
 * @returns {{ id: string, nombre: string, email: string, role: string }}
 */
function verificarToken(token) {
    if (AUTH_MODO === 'prueba') {
        const p = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        return { id: String(p.sub), nombre: p.name || '', email: p.email || '', role: p.role };
    }

    const clave = EXTERNO.clavePublica || EXTERNO.secreto;
    const algoritmos = EXTERNO.clavePublica ? ['RS256', 'RS384', 'RS512', 'ES256', 'ES384'] : ['HS256', 'HS384', 'HS512'];
    const p = jwt.verify(token, clave, { algorithms: algoritmos });

    const id = valorClaim(p, EXTERNO.claimId);
    const role = mapearRol(valorClaim(p, EXTERNO.claimRol));
    if (id === undefined || id === null || id === '') throw new Error(`El token no trae el dato "${EXTERNO.claimId}"`);
    if (!role) throw new Error('Rol no reconocido');
    return {
        id: String(id),
        nombre: String(valorClaim(p, EXTERNO.claimNombre) || ''),
        email: String(valorClaim(p, EXTERNO.claimEmail) || ''),
        role
    };
}

// ================= LOGIN DE PRUEBA =================
// Sólo existe en AUTH_MODO=prueba. 10 intentos fallidos por IP + email cada 15 minutos.

const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 10;
const intentos = new Map();

export async function login(req, res) {
    if (AUTH_MODO !== 'prueba') {
        return res.status(404).json({ error: 'El inicio de sesión se hace desde el sistema principal' });
    }
    // Importación diferida: las cuentas locales sólo se usan en modo prueba
    const { buscarPorEmail } = await import('./usuarios.js');
    const { verificarContrasena, HASH_FICTICIO } = await import('./lib/contrasenas.js');

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const clave = `${req.ip}|${String(email).toLowerCase()}`;
    const r = intentos.get(clave);
    if (r && Date.now() - r.desde < VENTANA_MS && r.cantidad >= MAX_INTENTOS) {
        return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos y volvé a probar.' });
    }

    const usuario = buscarPorEmail(email);
    const ok = verificarContrasena(password, usuario ? usuario.password_hash : HASH_FICTICIO);
    if (!usuario || !ok || !usuario.activo) {
        if (!r || Date.now() - r.desde > VENTANA_MS) intentos.set(clave, { cantidad: 1, desde: Date.now() });
        else r.cantidad++;
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    intentos.delete(clave);

    const token = jwt.sign(
        { sub: usuario.email, email: usuario.email, name: usuario.nombre, role: usuario.rol },
        JWT_SECRET,
        { expiresIn: JWT_DURACION, algorithm: 'HS256' }
    );
    res.json({ token });
}

// ================= MIDDLEWARES =================

/** Exige un usuario identificado. */
export function auth(req, res, next) {
    const token = leerToken(req);
    if (!token) return res.status(401).json({ error: 'Tenés que iniciar sesión' });
    try {
        req.user = verificarToken(token);
        next();
    } catch (err) {
        const mensaje = err.message === 'Rol no reconocido'
            ? 'Tu rol no tiene acceso a ProgMesas'
            : 'La sesión venció o no es válida. Volvé a ingresar.';
        res.status(401).json({ error: mensaje });
    }
}

/** Si hay un usuario identificado lo usa; si no, sigue como visitante. */
export function authOpcional(req, res, next) {
    const token = leerToken(req);
    req.user = null;
    if (token) {
        try {
            req.user = verificarToken(token);
        } catch {
            req.user = null;
        }
    }
    next();
}

export function rol(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tenés permiso para esta acción' });
        }
        next();
    };
}
