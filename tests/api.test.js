// Pruebas de la API completa: levanta el servidor real sobre una COPIA de la base y de los PDF
// (carpeta temporal, con DATOS_DIR) y sin Google Drive, así no toca los datos del proyecto.
// Ejecutar con:  npm test

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const RAIZ = path.join(import.meta.dirname, '..');
const DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'progmesas-api-'));
const PUERTO = 3900 + Math.floor(Math.random() * 90);
const API = `http://127.0.0.1:${PUERTO}/api`;

const ENTORNO = {
    ...process.env,
    PORT: String(PUERTO),
    JWT_SECRET: 'prueba-api-'.padEnd(48, 'x'),
    AUTH_MODO: 'prueba',
    ANIO_LECTIVO: '2026',
    MAX_PDF_MB: '1',
    DATOS_DIR: DATOS,
    DRIVE_DESACTIVADO: '1',
    TRUST_PROXY: '1',
    // Que no herede credenciales de Drive de quien corre las pruebas
    GOOGLE_OAUTH_JSON: '',
    GOOGLE_TOKEN_JSON: ''
};

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 32), Buffer.from('\n%%EOF\n')]);
let servidor;

// ================= AYUDANTES =================

async function pedir(ruta, { token, ip = '10.0.0.1', ...opciones } = {}) {
    const headers = { 'X-Forwarded-For': ip, ...(opciones.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opciones.json !== undefined) {
        headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(opciones.json);
    }
    const res = await fetch(API + ruta, { ...opciones, headers });
    const datos = await res.json().catch(() => null);
    return { status: res.status, datos, headers: res.headers };
}

async function ingresar(email, password, ip) {
    const r = await pedir('/login', { method: 'POST', json: { email, password }, ip });
    assert.equal(r.status, 200, `no pudo ingresar ${email}: ${JSON.stringify(r.datos)}`);
    return r.datos.token;
}

function subir(token, { asignacion, anio = 2026, archivo = PDF, nombre = 'programa.pdf', titulo = '' }) {
    const form = new FormData();
    form.append('asignacion_id', asignacion);
    form.append('anio', String(anio));
    form.append('titulo', titulo);
    form.append('pdf', new Blob([archivo], { type: 'application/pdf' }), nombre);
    return pedir('/programas/subir', { method: 'POST', body: form, token });
}

const cantidadDe = async (asignacion, anio = 2026) =>
    (await pedir('/programas')).datos.filter((p) => p.asignacion_id === asignacion && p.year === anio).length;

// ================= SERVIDOR =================

before(async () => {
    // Un docente nuevo, sin vincular, en la copia de la base
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        const { crearUsuario } = await import('./backend/usuarios.js');
        crearUsuario({ email: 'nuevo@test.com', contrasena: 'nuevo123', rol: 'teacher', nombre: 'Docente Nuevo' });
        crearUsuario({ email: 'preceptor@test.com', contrasena: 'preceptor123', rol: 'viewer', nombre: 'Preceptor' });
    `], { cwd: RAIZ, env: ENTORNO, stdio: 'pipe' });

    servidor = spawn(process.execPath, ['backend/server.js'], { cwd: RAIZ, env: ENTORNO, stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    await new Promise((resolve, reject) => {
        const limite = setTimeout(() => reject(new Error('El servidor no arrancó:\n' + salida)), 15000);
        const leer = (d) => {
            salida += d;
            if (salida.includes('Servidor corriendo')) {
                clearTimeout(limite);
                resolve();
            }
        };
        servidor.stdout.on('data', leer);
        servidor.stderr.on('data', leer);
        servidor.on('exit', (code) => reject(new Error(`El servidor terminó (código ${code}):\n${salida}`)));
    });
});

after(() => {
    servidor?.kill();
    fs.rmSync(DATOS, { recursive: true, force: true });
});

// ================= PÚBLICO =================

test('la configuración y el listado son públicos, sin datos internos', async () => {
    const config = await pedir('/config');
    assert.equal(config.status, 200);
    assert.equal(config.datos.anioLectivo, 2026);

    const programas = await pedir('/programas');
    assert.equal(programas.status, 200);
    assert.ok(programas.datos.length > 0);
    for (const p of programas.datos) {
        assert.equal(p.uploaded_by, undefined, 'un visitante no debe ver quién subió el programa');
        assert.equal(p.archivo_ref, undefined);
    }
});

test('el servidor manda las cabeceras de seguridad', async () => {
    const r = await pedir('/config');
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
});

test('las páginas y los PDF guardados se sirven; no se puede salir de la carpeta uploads', async () => {
    for (const pagina of ['/', '/privacidad.html', '/terminos.html', '/frontend/dashboard.html', '/frontend/tema.js']) {
        const r = await fetch(`http://127.0.0.1:${PUERTO}${pagina}`);
        assert.equal(r.status, 200, pagina);
    }
    const pdf = (await pedir('/programas')).datos.find((p) => p.file_url.startsWith('/uploads/'));
    const r = await fetch(`http://127.0.0.1:${PUERTO}${pdf.file_url}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');

    const fuera = await fetch(`http://127.0.0.1:${PUERTO}/uploads/..%2fdatabase.sqlite`);
    assert.notEqual(fuera.status, 200);
});

test('una ruta de la API que no existe responde 404 en JSON', async () => {
    const r = await pedir('/no-existe');
    assert.equal(r.status, 404);
    assert.ok(r.datos.error);
});

// ================= INGRESO =================

test('login: credenciales correctas e incorrectas', async () => {
    const mal = await pedir('/login', { method: 'POST', json: { email: 'asesor@test.com', password: 'mal' }, ip: '10.1.0.1' });
    assert.equal(mal.status, 401);
    const vacio = await pedir('/login', { method: 'POST', json: {}, ip: '10.1.0.1' });
    assert.equal(vacio.status, 400);

    const token = await ingresar('asesor@test.com', 'asesor123', '10.1.0.2');
    const yo = await pedir('/yo', { token });
    assert.deepEqual([yo.datos.autenticado, yo.datos.role], [true, 'advisor']);
});

test('después de 10 intentos fallidos se bloquea esa IP, pero no las demás', async () => {
    const intento = (ip, password) =>
        pedir('/login', { method: 'POST', json: { email: 'prof@test.com', password }, ip });
    for (let i = 0; i < 10; i++) assert.equal((await intento('10.2.0.1', 'mal')).status, 401);
    assert.equal((await intento('10.2.0.1', 'prof123')).status, 429, 'la IP atacante queda bloqueada');
    assert.equal((await intento('10.2.0.2', 'prof123')).status, 200, 'otra IP entra normalmente');
});

test('un token inválido o vencido no da acceso', async () => {
    const r = await pedir('/cobertura', { token: 'esto.no.sirve' });
    assert.equal(r.status, 401);
    const yo = await pedir('/yo', { token: 'esto.no.sirve' });
    assert.equal(yo.datos.autenticado, false);
});

// ================= PERMISOS POR ROL =================

test('cada rol sólo accede a lo suyo', async () => {
    const alumno = await ingresar('alumno@test.com', 'alumno123');
    const preceptor = await ingresar('preceptor@test.com', 'preceptor123');

    assert.equal((await pedir('/cobertura')).status, 401, 'sin sesión');
    assert.equal((await pedir('/cobertura', { token: alumno })).status, 403, 'alumno');
    assert.equal((await pedir('/cobertura', { token: preceptor })).status, 200, 'preceptor ve el dashboard');
    assert.equal((await subir(preceptor, { asignacion: '1-1_ingles' })).status, 403, 'preceptor no sube');
    assert.equal((await subir(alumno, { asignacion: '1-1_ingles' })).status, 403, 'alumno no sube');
    assert.equal((await pedir('/programas/1', { method: 'DELETE', token: preceptor })).status, 403, 'preceptor no borra');
});

// ================= DOCENTES =================

test('un docente sólo ve y sube los programas de sus materias', async () => {
    const prof = await ingresar('prof@test.com', 'prof123');
    const mias = await pedir('/asignaciones/mias?anio=2026', { token: prof });
    assert.equal(mias.status, 200);
    assert.ok(mias.datos.asignaciones.length > 0);
    const propia = mias.datos.asignaciones[0];

    const todas = (await pedir('/asignaciones/mias?anio=2026', { token: await ingresar('asesor@test.com', 'asesor123') })).datos.asignaciones;
    const ajena = todas.find((a) => !mias.datos.asignaciones.some((m) => m.id === a.id));

    const ok = await subir(prof, { asignacion: propia.id });
    assert.equal(ok.status, 200, JSON.stringify(ok.datos));
    assert.equal(ok.datos.almacenamiento, 'local');

    const no = await subir(prof, { asignacion: ajena.id });
    assert.equal(no.status, 403);

    // Ve los de sus materias y los que subió él mismo (los dueños se consultan como asesora)
    const visibles = (await pedir('/programas', { token: prof })).datos;
    const ids = new Set(mias.datos.asignaciones.map((a) => a.id));
    const conDueno = (await pedir('/programas', { token: await ingresar('asesor@test.com', 'asesor123') })).datos;
    const subidosPorEl = new Set(conDueno.filter((p) => p.uploaded_by === 'prof@test.com').map((p) => p.id));
    assert.ok(visibles.every((p) => ids.has(p.asignacion_id) || subidosPorEl.has(p.id)), 'sólo ve lo suyo');
    assert.ok(visibles.length < conDueno.length, 'no ve los programas de otros docentes');
    assert.ok(visibles.some((p) => p.id === ok.datos.id));
});

test('vinculación: el docente nuevo elige su nombre, la asesora confirma y recién ahí puede subir', async () => {
    const nuevo = await ingresar('nuevo@test.com', 'nuevo123');
    const asesora = await ingresar('asesor@test.com', 'asesor123');

    const yo = await pedir('/yo', { token: nuevo });
    assert.equal(yo.datos.vinculo.estado, 'sin_vincular');
    assert.equal((await subir(nuevo, { asignacion: '1-1_ingles' })).status, 403, 'sin vincular no sube');

    const nombres = (await pedir('/docentes/nombres', { token: nuevo })).datos;
    assert.ok(nombres.some((n) => n.nombre === 'Mattiassi' && n.disponible));
    const tomado = nombres.find((n) => n.nombre === 'Fernandez Lucrecia');
    assert.equal(tomado.disponible, false, 'un nombre ya confirmado no está disponible');

    const inexistente = await pedir('/docentes/vinculo', { method: 'POST', json: { docente: 'Nadie Inventado' }, token: nuevo });
    assert.equal(inexistente.status, 400);

    const pedido = await pedir('/docentes/vinculo', { method: 'POST', json: { docente: 'mattiassi' }, token: nuevo });
    assert.equal(pedido.status, 200);
    assert.deepEqual(pedido.datos.vinculo, { docente: 'Mattiassi', estado: 'pendiente' });
    assert.equal((await subir(nuevo, { asignacion: '1-1_ingles' })).status, 403, 'pendiente no sube');

    const confirmar = await pedir('/docentes/vinculos/nuevo%40test.com/confirmar', { method: 'POST', json: {}, token: asesora });
    assert.equal(confirmar.status, 200);

    const sube = await subir(nuevo, { asignacion: '1-1_ingles' });
    assert.equal(sube.status, 200, JSON.stringify(sube.datos));

    const robar = await pedir('/docentes/vinculos/prof%40test.com/confirmar', { method: 'POST', json: { docente: 'Mattiassi' }, token: asesora });
    assert.equal(robar.status, 409, 'un nombre no puede quedar vinculado a dos cuentas');
});

// ================= SUBIDA DE PROGRAMAS =================

test('sólo se aceptan PDF válidos y del tamaño permitido', async () => {
    const asesora = await ingresar('asesor@test.com', 'asesor123');
    const falso = await subir(asesora, { asignacion: '1-1_geografia', archivo: Buffer.from('esto no es un pdf'), nombre: 'x.pdf' });
    assert.equal(falso.status, 400);
    assert.match(falso.datos.error, /PDF válido/);

    const grande = Buffer.concat([PDF, Buffer.alloc(1.2 * 1024 * 1024)]);
    const r = await subir(asesora, { asignacion: '1-1_geografia', archivo: grande });
    assert.equal(r.status, 413);

    assert.equal((await subir(asesora, { asignacion: 'no-existe' })).status, 400);
    assert.equal((await subir(asesora, { asignacion: '1-1_geografia', anio: 1990 })).status, 400);
});

test('subir otra vez el mismo curso y materia reemplaza el programa anterior', async () => {
    const asesora = await ingresar('asesor@test.com', 'asesor123');
    const primero = await subir(asesora, { asignacion: '1-1_geografia', titulo: 'Versión 1' });
    assert.equal(primero.status, 200);
    const segundo = await subir(asesora, { asignacion: '1-1_geografia', titulo: 'Versión 2' });
    assert.equal(segundo.datos.reemplazado, true);
    assert.equal(segundo.datos.id, primero.datos.id);
    assert.equal(await cantidadDe('1-1_geografia'), 1);
    const p = (await pedir('/programas')).datos.find((x) => x.id === primero.datos.id);
    assert.equal(p.title, 'Versión 2');
});

test('varios docentes de Matemática de distintos cursos suben a la vez sin pisarse', async () => {
    const asesora = await ingresar('asesor@test.com', 'asesor123');
    const cursos = ['1-1_matematica', '1-2_matematica', '1-3_matematica', '2-2_matematica'];
    const respuestas = await Promise.all(cursos.map((asignacion) => subir(asesora, { asignacion })));
    for (const r of respuestas) assert.equal(r.status, 200, JSON.stringify(r.datos));
    assert.equal(new Set(respuestas.map((r) => r.datos.id)).size, cursos.length, 'cada curso tiene su propio programa');
    for (const c of cursos) assert.equal(await cantidadDe(c), 1, c);
});

test('dos subidas simultáneas del mismo curso y materia no generan duplicados', async () => {
    const asesora = await ingresar('asesor@test.com', 'asesor123');
    const respuestas = await Promise.all([1, 2, 3].map((n) => subir(asesora, { asignacion: '3-1_matematica', titulo: `Intento ${n}` })));
    for (const r of respuestas) assert.equal(r.status, 200);
    assert.equal(await cantidadDe('3-1_matematica'), 1);
});

// ================= DASHBOARD =================

test('la cobertura cuenta los programas entregados', async () => {
    const asesora = await ingresar('asesor@test.com', 'asesor123');
    const antes = (await pedir('/cobertura?anio=2026', { token: asesora })).datos;
    const pendiente = antes.asignaciones.find((a) => !a.programa);
    assert.ok(pendiente, 'tiene que haber algún pendiente');

    await subir(asesora, { asignacion: pendiente.id });
    const despues = (await pedir('/cobertura?anio=2026', { token: asesora })).datos;
    const entregados = (d) => d.asignaciones.filter((a) => a.programa).length;
    assert.equal(entregados(despues), entregados(antes) + 1);
    assert.ok(despues.asignaciones.find((a) => a.id === pendiente.id).programa);

    const faltantes = (await pedir('/programas/faltantes?anio=2026', { token: asesora })).datos;
    assert.ok(!faltantes.some((f) => f.id === pendiente.id));
});

test('la asesora puede eliminar un programa; un docente no', async () => {
    const asesora = await ingresar('asesor@test.com', 'asesor123');
    const prof = await ingresar('prof@test.com', 'prof123');
    const { datos } = await subir(asesora, { asignacion: '1-4_ingles' });

    assert.equal((await pedir(`/programas/${datos.id}`, { method: 'DELETE', token: prof })).status, 403);
    assert.equal((await pedir(`/programas/${datos.id}`, { method: 'DELETE', token: asesora })).status, 200);
    assert.equal((await pedir(`/programas/${datos.id}`, { method: 'DELETE', token: asesora })).status, 404);
    assert.equal(await cantidadDe('1-4_ingles'), 0);
});
