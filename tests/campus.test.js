// Ingreso desde el campus de la escuela (PHP): el campus arma un pase firmado con
// integraciones/campus-escuela/includes/progmesas.php y ProgMesas lo verifica con la misma clave.
// Estas pruebas generan los pases con PHP de verdad; si PHP no está instalado, se saltean.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { iniciarServidor, RAIZ } from './servidor.js';

const SECRETO = 'clave-compartida-entre-el-campus-y-progmesas-0123456789';
const hayPhp = (() => {
    try {
        execFileSync('php', ['-v'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
})();

let srv;
let carpeta;

/** Pase generado por el código PHP del campus. */
function paseDelCampus({ id, nombre, correo, rol }, secreto = SECRETO) {
    fs.writeFileSync(
        path.join(carpeta, 'config.php'),
        `<?php define('PROGMESAS_URL', 'http://progmesas.test'); define('PROGMESAS_SECRETO', ${JSON.stringify(secreto)}); define('PROGMESAS_HORAS', 8);`
    );
    const codigo = `require ${JSON.stringify(path.join(carpeta, 'progmesas.php'))}; echo crearPaseProgMesas($argv[1], $argv[2], $argv[3], $argv[4]);`;
    return execFileSync('php', ['-r', codigo, '--', id, nombre, correo, rol]).toString().trim();
}

before(async () => {
    if (!hayPhp) return;
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-'));
    fs.copyFileSync(path.join(RAIZ, 'integraciones/campus-escuela/includes/progmesas.php'), path.join(carpeta, 'progmesas.php'));
    srv = await iniciarServidor({
        entorno: {
            EXTERNO_JWT_SECRET: SECRETO,
            EXTERNO_LOGIN_URL: 'https://campus.escuela.edu.ar/programas.php',
            EXTERNO_LOGOUT_URL: 'https://campus.escuela.edu.ar/logout.php'
        }
    });
});

after(() => {
    srv?.cerrar();
    if (carpeta) fs.rmSync(carpeta, { recursive: true, force: true });
});

test('el campus manda a ingresar por su puente y a cerrar sesión por su logout', { skip: !hayPhp && 'PHP no está instalado' }, async () => {
    const config = (await srv.pedir('/config')).datos;
    assert.equal(config.loginUrl, 'https://campus.escuela.edu.ar/programas.php');
    assert.equal(config.logoutUrl, 'https://campus.escuela.edu.ar/logout.php');
});

test('los roles del campus se traducen: profesor → docente, directivo → asesora, alumno → alumno', { skip: !hayPhp && 'PHP no está instalado' }, async () => {
    const profesor = paseDelCampus({ id: 'profesor:mg@escuela.edu.ar', nombre: 'Martín Gómez', correo: 'mg@escuela.edu.ar', rol: 'profesor' });
    const yo = (await srv.pedir('/yo', { token: profesor })).datos;
    assert.deepEqual([yo.autenticado, yo.role, yo.nombre, yo.email], [true, 'teacher', 'Martín Gómez', 'mg@escuela.edu.ar']);

    const directivo = paseDelCampus({ id: 'directivo:directora@escuela.edu.ar', nombre: 'Marta Rodríguez', correo: 'directora@escuela.edu.ar', rol: 'directivo' });
    assert.equal((await srv.pedir('/yo', { token: directivo })).datos.role, 'advisor');
    assert.equal((await srv.pedir('/cobertura', { token: directivo })).status, 200);

    const alumno = paseDelCampus({ id: 'alumno:40123456', nombre: 'Lucía Fernández', correo: 'alumno@gmail.com', rol: 'alumno' });
    assert.equal((await srv.pedir('/yo', { token: alumno })).datos.role, 'student');
    assert.equal((await srv.pedir('/cobertura', { token: alumno })).status, 403);
});

test('un pase firmado con otra clave o modificado se rechaza', { skip: !hayPhp && 'PHP no está instalado' }, async () => {
    const falso = paseDelCampus({ id: 'x', nombre: 'Intruso', correo: '', rol: 'directivo' }, 'otra-clave-que-no-es-la-compartida-0000000000');
    assert.equal((await srv.pedir('/cobertura', { token: falso })).status, 401);

    const bueno = paseDelCampus({ id: 'alumno:1', nombre: 'Alumno', correo: '', rol: 'alumno' });
    const [cab, , firma] = bueno.split('.');
    const datos = Buffer.from(JSON.stringify({ sub: 'alumno:1', name: 'Alumno', role: 'directivo' })).toString('base64url');
    assert.equal((await srv.pedir('/cobertura', { token: `${cab}.${datos}.${firma}` })).status, 401);
});
