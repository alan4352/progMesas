import db from './db.js';
import { hashContrasena } from './lib/contrasenas.js';

const ROLES = ['teacher', 'advisor', 'student'];

const stmtPorEmail = db.prepare('SELECT * FROM usuarios WHERE email = ?');
const stmtListar = db.prepare('SELECT id, email, rol, nombre, docente, activo, created_at FROM usuarios ORDER BY rol, nombre');
const stmtCrear = db.prepare(
    'INSERT INTO usuarios (email, password_hash, rol, nombre, docente, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);

export function buscarPorEmail(email) {
    return stmtPorEmail.get(String(email || '').trim());
}

export function listarUsuarios() {
    return stmtListar.all();
}

export function crearUsuario({ email, contrasena, rol, nombre, docente = '' }) {
    email = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email inválido');
    if (!ROLES.includes(rol)) throw new Error(`Rol inválido (usá: ${ROLES.join(', ')})`);
    if (!contrasena || String(contrasena).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
    if (!nombre) throw new Error('Falta el nombre');
    if (buscarPorEmail(email)) throw new Error('Ya existe un usuario con ese email');
    const info = stmtCrear.run(email, hashContrasena(contrasena), rol, String(nombre).trim(), String(docente).trim(), new Date().toISOString());
    return info.lastInsertRowid;
}

export function cambiarContrasena(email, contrasena) {
    if (!contrasena || String(contrasena).length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
    const r = db.prepare('UPDATE usuarios SET password_hash = ? WHERE email = ?').run(hashContrasena(contrasena), email);
    if (r.changes === 0) throw new Error('No existe ese usuario');
}

export function actualizarUsuario(email, campos) {
    const permitidos = ['nombre', 'docente', 'rol', 'activo'];
    const sets = [];
    const valores = [];
    for (const [k, v] of Object.entries(campos)) {
        if (!permitidos.includes(k)) continue;
        if (k === 'rol' && !ROLES.includes(v)) throw new Error('Rol inválido');
        sets.push(`${k} = ?`);
        valores.push(k === 'activo' ? (v ? 1 : 0) : String(v));
    }
    if (sets.length === 0) return;
    const r = db.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE email = ?`).run(...valores, email);
    if (r.changes === 0) throw new Error('No existe ese usuario');
}
