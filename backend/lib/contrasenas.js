// Hash de contraseñas con scrypt (incluido en Node, no requiere dependencias).
// Formato guardado: scrypt$<N>$<salt hex>$<hash hex>

import crypto from 'crypto';

const N = 16384;
const LARGO = 64;

export function hashContrasena(contrasena) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(contrasena), salt, LARGO, { N });
    return `scrypt$${N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verificarContrasena(contrasena, guardado) {
    const partes = String(guardado || '').split('$');
    if (partes.length !== 4 || partes[0] !== 'scrypt') return false;
    const n = Number(partes[1]);
    const salt = Buffer.from(partes[2], 'hex');
    const esperado = Buffer.from(partes[3], 'hex');
    const calculado = crypto.scryptSync(String(contrasena), salt, esperado.length, { N: n });
    return crypto.timingSafeEqual(calculado, esperado);
}

// Hash fijo para comparar cuando el usuario no existe (evita revelar por tiempo de respuesta qué emails existen)
export const HASH_FICTICIO = hashContrasena(crypto.randomBytes(12).toString('hex'));
