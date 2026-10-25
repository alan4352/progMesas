import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_DURACION } from './config.js';
import { buscarPorEmail } from './usuarios.js';
import { verificarContrasena, HASH_FICTICIO } from './lib/contrasenas.js';

// ================= LÍMITE DE INTENTOS =================
// 10 intentos fallidos por IP + email cada 15 minutos.

const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 10;
const intentos = new Map();

function claveIntento(req, email) {
    return `${req.ip}|${String(email).toLowerCase()}`;
}

function bloqueado(clave) {
    const r = intentos.get(clave);
    if (!r) return false;
    if (Date.now() - r.desde > VENTANA_MS) {
        intentos.delete(clave);
        return false;
    }
    return r.cantidad >= MAX_INTENTOS;
}

function registrarFallo(clave) {
    const r = intentos.get(clave);
    if (!r || Date.now() - r.desde > VENTANA_MS) intentos.set(clave, { cantidad: 1, desde: Date.now() });
    else r.cantidad++;
}

// ================= LOGIN =================

export function login(req, res) {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const clave = claveIntento(req, email);
    if (bloqueado(clave)) {
        return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos y volvé a probar.' });
    }

    const usuario = buscarPorEmail(email);
    // Se verifica igual contra un hash ficticio para que la respuesta tarde lo mismo exista o no el email
    const ok = verificarContrasena(password, usuario ? usuario.password_hash : HASH_FICTICIO);

    if (!usuario || !ok || !usuario.activo) {
        registrarFallo(clave);
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    intentos.delete(clave);

    const payload = {
        email: usuario.email,
        role: usuario.rol,
        name: usuario.nombre,
        docente: usuario.docente || ''
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_DURACION });
    res.json({ token, usuario: payload });
}

// ================= MIDDLEWARES =================

function leerToken(req) {
    const header = req.headers.authorization || '';
    return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Exige un token válido. */
export function auth(req, res, next) {
    const token = leerToken(req);
    if (!token) return res.status(401).json({ error: 'Tenés que iniciar sesión' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'La sesión venció. Volvé a iniciar sesión.' });
    }
}

/** Si hay un token válido lo usa; si no, sigue como visitante. */
export function authOpcional(req, res, next) {
    const token = leerToken(req);
    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
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
