// Pruebas de las funciones puras: normalización de textos, contraseñas, roles y planilla de asignaciones.
// Ejecutar con:  npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// config.js exige un JWT_SECRET para poder importar auth.js
process.env.JWT_SECRET ||= 'prueba-'.padEnd(48, 'x');
process.env.AUTH_MODO = 'prueba';

const { claveTexto, claveCompacta, cursoClave, escaparConsultaDrive } = await import('../backend/lib/normalizar.js');
const { normalizarMateria, separarDocentes } = await import('../backend/lib/parser_horarios.js');
const { hashContrasena, verificarContrasena } = await import('../backend/lib/contrasenas.js');
const { generarId, leerAsignaciones, escribirAsignaciones } = await import('../backend/lib/asignaciones_excel.js');
const { mapearRol } = await import('../backend/auth.js');

const RAIZ = path.join(import.meta.dirname, '..');

test('claveTexto ignora acentos, mayúsculas, signos y espacios de más', () => {
    assert.equal(claveTexto('  Matemática  '), 'matematica');
    assert.equal(claveTexto('FERNÁNDEZ, Lucrecia'), claveTexto('fernandez lucrecia'));
    assert.equal(claveCompacta('Educación Física'), 'educacionfisica');
});

test('cursoClave distingue cada curso y su especialidad', () => {
    assert.equal(cursoClave('2° 1°'), '2-1');
    assert.equal(cursoClave('4° 2° TAE'), '4-2-TAE');
    assert.notEqual(cursoClave('4° 1° TC'), cursoClave('4° 2° TAE'));
});

test('cada curso + materia es una asignación distinta (varios docentes de Matemática no se pisan)', () => {
    const ids = ['1° 1°', '2° 1°', '3° 2°', '5° 1° TG'].map((curso) => generarId(curso, 'Matemática'));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(generarId('2° 1°', 'Matemática'), '2-1_matematica');
});

test('normalizarMateria unifica cómo se escribe una materia', () => {
    assert.equal(normalizarMateria('MATEMATICA'), 'Matemática');
    assert.equal(normalizarMateria('Ed. Fisica'), 'Ed. Física');
});

test('separarDocentes separa los docentes de una misma materia', () => {
    assert.deepEqual(separarDocentes('Perez Juan / Gomez Ana'), ['Perez Juan', 'Gomez Ana']);
});

test('escaparConsultaDrive evita romper la búsqueda de carpetas con comillas', () => {
    assert.equal(escaparConsultaDrive("O'Brien"), "O\\'Brien");
});

test('las contraseñas se guardan con hash y se verifican', () => {
    const hash = hashContrasena('secreta123');
    assert.match(hash, /^scrypt\$/);
    assert.ok(!hash.includes('secreta123'));
    assert.equal(verificarContrasena('secreta123', hash), true);
    assert.equal(verificarContrasena('otra', hash), false);
    assert.equal(verificarContrasena('secreta123', 'basura'), false);
});

test('mapearRol traduce los roles del sistema principal', () => {
    assert.equal(mapearRol('Docente'), 'teacher');
    assert.equal(mapearRol('asesora'), 'advisor');
    assert.equal(mapearRol('preceptor'), 'viewer');
    assert.equal(mapearRol('alumno'), 'student');
    assert.equal(mapearRol(['alumno', 'asesora']), 'advisor'); // gana el de más permisos
    assert.equal(mapearRol('portero'), null);
});

test('la planilla oficial de asignaciones se lee completa', () => {
    const { asignaciones } = leerAsignaciones(path.join(RAIZ, 'backend', 'data', 'asignaciones.xlsx'));
    assert.ok(asignaciones.length > 100);
    for (const a of asignaciones.slice(0, 20)) {
        assert.ok(a.id && a.curso && a.materia, `asignación incompleta: ${JSON.stringify(a)}`);
        assert.ok(Array.isArray(a.docentes));
    }
    const ids = asignaciones.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, 'hay IDs de asignación repetidos');
});

test('la planilla se puede escribir y volver a leer sin cambios', () => {
    const { asignaciones } = leerAsignaciones(path.join(RAIZ, 'backend', 'data', 'asignaciones.xlsx'));
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'progmesas-')), 'asignaciones.xlsx');
    escribirAsignaciones(tmp, asignaciones);
    const releidas = leerAsignaciones(tmp).asignaciones;
    assert.deepEqual(releidas, asignaciones);
});

test('DRIVE_ALCANCE elige el permiso de Google Drive', () => {
    const permiso = (alcance) => execFileSync(process.execPath, [
        '--input-type=module', '-e',
        "const c = await import('./backend/config.js'); console.log(c.DRIVE_PERMISO, '|', c.DRIVE_CARPETA_RAIZ || '(propia)')"
    ], { cwd: RAIZ, env: { ...process.env, DRIVE_ALCANCE: alcance, DRIVE_CARPETA_RAIZ: '' } }).toString().trim();
    assert.match(permiso('completo'), /auth\/drive \| 1EY/);
    assert.match(permiso('archivos'), /auth\/drive\.file \| \(propia\)/);
});
