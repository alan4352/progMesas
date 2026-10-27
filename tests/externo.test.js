// Pruebas de AUTH_MODO=externo: los usuarios llegan con un token firmado por el sistema principal.
// Los tokens se generan con scripts/token_prueba.js, la misma herramienta que se usa para probar a mano.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { iniciarServidor, RAIZ } from './servidor.js';

const jwt = createRequire(path.join(RAIZ, 'backend', 'package.json'))('jsonwebtoken');
const SECRETO = 'clave-compartida-con-el-sistema-principal-1234567890';
let srv;

function tokenDe(opciones) {
    const args = Object.entries(opciones).flatMap(([k, v]) => [`--${k}`, String(v)]);
    const salida = execFileSync(process.execPath, ['backend/scripts/token_prueba.js', ...args], { cwd: RAIZ, env: srv.entorno }).toString();
    return /Token \(vence en [^)]*\):\n(\S+)/.exec(salida)[1];
}

before(async () => {
    srv = await iniciarServidor({
        entorno: {
            AUTH_MODO: 'externo',
            JWT_SECRET: '',
            EXTERNO_JWT_SECRET: SECRETO,
            EXTERNO_CLAIM_ID: 'usuario.id',          // campo anidado, como en muchos sistemas
            EXTERNO_CLAIM_NOMBRE: 'usuario.nombre',
            EXTERNO_CLAIM_ROL: 'rol',
            EXTERNO_COOKIE: 'sesion',
            EXTERNO_LOGIN_URL: 'https://sistema.escuela.edu.ar/ingresar'
        }
    });
});

after(() => srv?.cerrar());

test('en modo externo no hay login propio y el botón lleva al sistema principal', async () => {
    const config = (await srv.pedir('/config')).datos;
    assert.equal(config.authModo, 'externo');
    assert.equal(config.loginUrl, 'https://sistema.escuela.edu.ar/ingresar');
    const login = await srv.pedir('/login', { method: 'POST', json: { email: 'asesor@test.com', password: 'asesor123' } });
    assert.equal(login.status, 404);
});

test('el token del sistema principal identifica al usuario y su rol', async () => {
    const asesora = tokenDe({ rol: 'Asesora', nombre: 'Ana Pérez', id: 'A-1' });
    const yo = (await srv.pedir('/yo', { token: asesora })).datos;
    assert.deepEqual([yo.autenticado, yo.role, yo.nombre, yo.id], [true, 'advisor', 'Ana Pérez', 'A-1']);
    assert.equal((await srv.pedir('/cobertura', { token: asesora })).status, 200);

    const directivo = tokenDe({ rol: 'directivo', nombre: 'Director', id: 'D-1' });
    assert.equal((await srv.pedir('/yo', { token: directivo })).datos.role, 'viewer');

    const alumno = tokenDe({ rol: 'alumno', nombre: 'Alumno', id: 'E-1' });
    assert.equal((await srv.pedir('/cobertura', { token: alumno })).status, 403);
});

test('un docente del sistema principal se vincula solo si su nombre coincide con la lista', async () => {
    const valeria = tokenDe({ rol: 'docente', nombre: 'Valeria Grimberg', id: 'T-77', email: 'vg@escuela.edu.ar' });
    const yo = (await srv.pedir('/yo', { token: valeria })).datos;
    assert.equal(yo.role, 'teacher');
    assert.deepEqual(yo.vinculo, { docente: 'Grimberg Valeria', estado: 'confirmado' });

    const otro = tokenDe({ rol: 'docente', nombre: 'Persona Que No Está', id: 'T-78' });
    assert.equal((await srv.pedir('/yo', { token: otro })).datos.vinculo.estado, 'sin_vincular');
});

test('el token también se acepta en la cookie configurada', async () => {
    const t = tokenDe({ rol: 'preceptor', nombre: 'Preceptora', id: 'P-1' });
    const r = await srv.pedir('/yo', { headers: { Cookie: `otra=1; sesion=${t}` } });
    assert.equal(r.datos.autenticado, true);
    assert.equal(r.datos.role, 'viewer');
});

test('se rechazan tokens con otra firma, vencidos, sin id o con un rol desconocido', async () => {
    const datos = { usuario: { id: 'X-1', nombre: 'X' }, rol: 'asesora' };
    const otraFirma = jwt.sign(datos, 'otra-clave-que-no-es-la-del-sistema-principal', { algorithm: 'HS256' });
    assert.equal((await srv.pedir('/cobertura', { token: otraFirma })).status, 401);

    const vencido = jwt.sign({ ...datos, exp: Math.floor(Date.now() / 1000) - 60 }, SECRETO, { algorithm: 'HS256' });
    assert.equal((await srv.pedir('/cobertura', { token: vencido })).status, 401);

    const sinId = jwt.sign({ usuario: { nombre: 'X' }, rol: 'asesora' }, SECRETO, { algorithm: 'HS256' });
    assert.equal((await srv.pedir('/cobertura', { token: sinId })).status, 401);

    const portero = jwt.sign({ usuario: { id: 'Z-1' }, rol: 'portero' }, SECRETO, { algorithm: 'HS256' });
    const r = await srv.pedir('/cobertura', { token: portero });
    assert.equal(r.status, 401);
    assert.match(r.datos.error, /rol no tiene acceso/);

    const sinFirma = jwt.sign(datos, '', { algorithm: 'none' });
    assert.equal((await srv.pedir('/cobertura', { token: sinFirma })).status, 401, 'un token sin firma no vale');
});
