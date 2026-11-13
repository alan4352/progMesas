// Pruebas de la versión PHP (api.php) con Google Drive simulado: subir a Drive en carpetas
// Año / Curso / Materia, renovar el permiso, qué pasa cuando Drive se cae, pasar a Drive lo que
// quedó en el servidor, borrar y armar el ZIP desde Drive.
// Necesitan PHP 8 en la línea de comandos (con pdo_sqlite); si no está, se saltean.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { RAIZ, PDF, SECRETO_CAMPUS, paseCampus } from './servidor.js';
import { leerZip } from '../backend/lib/zip.js';

const tienePhp = (() => {
    try {
        return /pdo_sqlite/i.test(execFileSync('php', ['-m']).toString());
    } catch {
        return false;
    }
})();
const opciones = { skip: tienePhp ? false : 'PHP con pdo_sqlite no está instalado' };
const ANIO = new Date().getFullYear();
const pdfCon = (texto) => Buffer.concat([PDF, Buffer.from(`\n% ${texto}\n`)]);

// ================= GOOGLE DRIVE SIMULADO (HTTP) =================

function crearDriveSimulado() {
    const estado = { items: { raiz: { nombre: 'raiz', carpeta: true } }, sig: 1, tokens: new Set(), renovaciones: 0, caido: false };

    function leerCuerpo(req) {
        return new Promise((resolve) => {
            const partes = [];
            req.on('data', (d) => partes.push(d));
            req.on('end', () => resolve(Buffer.concat(partes)));
        });
    }
    const json = (res, codigo, datos) => {
        res.writeHead(codigo, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(datos));
    };

    const servidor = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://x');
        const cuerpo = await leerCuerpo(req);
        if (estado.caido) return json(res, 503, { error: { message: 'Servicio no disponible' } });

        if (url.pathname === '/token') {
            const datos = new URLSearchParams(cuerpo.toString());
            if (datos.get('refresh_token') !== 'refresco-valido') return json(res, 400, { error: 'invalid_grant' });
            const token = `acceso-${++estado.renovaciones}`;
            estado.tokens.add(token);
            return json(res, 200, { access_token: token, expires_in: 3600 });
        }
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        if (!estado.tokens.has(token)) return json(res, 401, { error: { message: 'Token inválido' } });

        let m;
        if (req.method === 'GET' && url.pathname === '/drive/v3/files') {
            const q = url.searchParams.get('q') || '';
            const [, padre, nombre] = /^'((?:\\.|[^'])*)' in parents and name='((?:\\.|[^'])*)'/.exec(q) || [];
            const sinEscape = (t) => String(t || '').replace(/\\(.)/g, '$1');
            const files = Object.entries(estado.items)
                .filter(([, i]) => i.carpeta && i.padre === sinEscape(padre) && i.nombre === sinEscape(nombre))
                .map(([id, i]) => ({ id, name: i.nombre }));
            return json(res, 200, { files });
        }
        if (req.method === 'POST' && url.pathname === '/drive/v3/files') {
            const datos = JSON.parse(cuerpo.toString());
            const id = `carpeta${estado.sig++}`;
            estado.items[id] = { nombre: datos.name, padre: datos.parents[0], carpeta: true };
            return json(res, 200, { id });
        }
        if (req.method === 'POST' && url.pathname === '/upload/drive/v3/files') {
            const limite = /boundary=(\S+)/.exec(req.headers['content-type'] || '')?.[1];
            const texto = cuerpo.toString('latin1');
            const partes = texto.split(`--${limite}`).slice(1, -1).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4, -2));
            const meta = JSON.parse(Buffer.from(partes[0], 'latin1').toString('utf8'));
            const id = `archivo${estado.sig++}`;
            estado.items[id] = { nombre: meta.name, padre: meta.parents[0], contenido: Buffer.from(partes[1], 'latin1'), publico: false };
            return json(res, 200, { id });
        }
        if ((m = /^\/drive\/v3\/files\/([^/]+)\/permissions$/.exec(url.pathname)) && req.method === 'POST') {
            if (!estado.items[m[1]]) return json(res, 404, { error: { message: 'No existe' } });
            const datos = JSON.parse(cuerpo.toString());
            estado.items[m[1]].publico = datos.type === 'anyone' && datos.role === 'reader';
            return json(res, 200, { id: 'permiso' });
        }
        if ((m = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname))) {
            const item = estado.items[m[1]];
            if (!item) return json(res, 404, { error: { message: 'No existe' } });
            if (req.method === 'DELETE') {
                delete estado.items[m[1]];
                res.writeHead(204);
                return res.end();
            }
            if (url.searchParams.get('alt') === 'media') {
                res.writeHead(200, { 'Content-Type': 'application/pdf' });
                return res.end(item.contenido);
            }
            return json(res, 200, { id: m[1] });
        }
        json(res, 404, { error: { message: 'Ruta desconocida' } });
    });
    return { servidor, estado };
}

// ================= SERVIDOR PHP SOBRE UNA COPIA =================

let drive, php, base, dir, asesora, profesor;

async function puertoDe(servidor) {
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
    return servidor.address().port;
}

before(async () => {
    if (!tienePhp) return;
    drive = crearDriveSimulado();
    const puertoDrive = await puertoDe(drive.servidor);

    // Misma estructura que en el campus: <raíz>/campus/includes/config.php y <raíz>/progmesas/
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'progmesas-php-'));
    const pm = path.join(dir, 'progmesas');
    fs.mkdirSync(path.join(pm, 'backend', 'data'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'campus', 'includes'), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, 'api.php'), path.join(pm, 'api.php'));
    fs.copyFileSync(path.join(RAIZ, 'backend', 'drive.php'), path.join(pm, 'backend', 'drive.php'));
    fs.copyFileSync(path.join(RAIZ, 'backend', 'data', 'asignaciones.xlsx'), path.join(pm, 'backend', 'data', 'asignaciones.xlsx'));
    fs.writeFileSync(path.join(dir, 'campus', 'includes', 'config.php'),
        `<?php define('PROGMESAS_SECRETO', '${SECRETO_CAMPUS}');\n`);
    fs.writeFileSync(path.join(pm, 'backend', 'oauth.json'),
        JSON.stringify({ installed: { client_id: 'cliente', client_secret: 'secreto', redirect_uris: ['http://localhost'] } }));
    // Token vencido: la primera llamada tiene que renovarlo con el refresh_token
    fs.writeFileSync(path.join(pm, 'backend', 'token.json'),
        JSON.stringify({ access_token: 'viejo', refresh_token: 'refresco-valido', expiry_date: Date.now() - 1000 }));

    const libre = http.createServer();
    const puertoPhp = await puertoDe(libre);
    await new Promise((r) => libre.close(r));
    php = spawn('php', ['-S', `127.0.0.1:${puertoPhp}`, '-t', dir], {
        env: {
            ...process.env,
            DRIVE_API: `http://127.0.0.1:${puertoDrive}`,
            DRIVE_TOKEN_URL: `http://127.0.0.1:${puertoDrive}/token`,
            DRIVE_CARPETA_RAIZ: 'raiz',
            DRIVE_DESACTIVADO: '',
            GOOGLE_OAUTH_JSON: '',
            GOOGLE_TOKEN_JSON: ''
        },
        stdio: 'ignore'
    });
    base = `http://127.0.0.1:${puertoPhp}/progmesas/api.php?r=`;
    for (let i = 0; i < 50; i++) {
        try {
            if ((await fetch(base + '/config')).ok) break;
        } catch {
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    asesora = paseCampus('asesor@test.com');
    profesor = paseCampus('prof@test.com');
});

after(() => {
    php?.kill();
    drive?.servidor.close();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

async function pedir(ruta, { token = asesora, json, form, crudo } = {}) {
    const headers = { Authorization: `Bearer ${token}` };
    let body;
    if (json !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    }
    if (form) body = form;
    const metodo = json !== undefined || form ? 'POST' : 'GET';
    const res = await fetch(base + ruta, { method: metodo, headers, body });
    if (crudo) return { status: res.status, cuerpo: Buffer.from(await res.arrayBuffer()) };
    return { status: res.status, datos: await res.json().catch(() => null) };
}

function subir(asignacion, contenido, { tipo, token = asesora } = {}) {
    const form = new FormData();
    form.append('asignacion_id', asignacion);
    if (tipo) form.append('tipo', tipo);
    form.append('pdf', new Blob([contenido], { type: 'application/pdf' }), 'programa.pdf');
    return pedir('/programas/subir', { form, token });
}

const programa = async (id) => (await pedir('/programas')).datos.find((p) => p.id === id);

// ================= PRUEBAS =================

test('PHP: un programa nuevo se sube a Drive en Año / Curso / Materia y queda público', opciones, async () => {
    const r = await subir('2-3_matematica', pdfCon('php drive'), { token: profesor });
    assert.equal(r.status, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.almacenamiento, 'drive');
    assert.equal(r.datos.aviso, null);
    assert.equal(drive.estado.renovaciones, 1, 'renovó el permiso vencido con el refresh_token');

    const p = await programa(r.datos.id);
    assert.match(p.file_url, /^https:\/\/drive\.google\.com\/file\/d\/archivo\d+\/preview$/);
    const id = p.file_url.split('/')[5];
    const items = drive.estado.items;
    assert.equal(items[id].publico, true);
    assert.match(items[id].contenido.toString('latin1'), /php drive/);
    const materia = items[items[id].padre];
    const curso = items[materia.padre];
    const anio = items[curso.padre];
    assert.deepEqual([anio.nombre, curso.nombre, materia.nombre, anio.padre], [String(ANIO), '2° 3°', 'Matemática', 'raiz']);

    // El permiso renovado quedó guardado: la segunda subida no lo vuelve a pedir, y reusa las carpetas
    const carpetas = Object.values(items).filter((i) => i.carpeta).length;
    const libre = await subir('2-3_matematica', pdfCon('libre'), { tipo: 'libre' });
    assert.equal(libre.datos.almacenamiento, 'drive');
    assert.equal(drive.estado.renovaciones, 1);
    assert.equal(Object.values(drive.estado.items).filter((i) => i.carpeta).length, carpetas);
    const nombre = drive.estado.items[(await programa(libre.datos.id)).file_url.split('/')[5]].nombre;
    assert.match(nombre, /_libre\.pdf$/);

    const cob = (await pedir(`/cobertura&anio=${ANIO}`)).datos;
    assert.equal(cob.estado.drive.disponible, true);
    assert.equal(cob.estado.drive.modo, 'drive');
});

test('PHP: si Drive se cae, el PDF queda en el servidor con aviso y después pasa a Drive', opciones, async () => {
    drive.estado.caido = true;
    const r = await subir('2-4_matematica', pdfCon('sin drive'));
    assert.equal(r.status, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.almacenamiento, 'local');
    assert.match(r.datos.aviso, /Google Drive no está disponible/);
    const p = await programa(r.datos.id);
    assert.match(p.file_url, /^\/uploads\//);

    let cob = (await pedir(`/cobertura&anio=${ANIO}`)).datos;
    assert.equal(cob.estado.drive.disponible, false);
    assert.equal(cob.estado.locales, 1);

    // Con Drive caído, "Pasar a Drive ahora" informa el error y no cambia nada
    const fallo = (await pedir('/drive/sincronizar', { json: {} })).datos;
    assert.equal(fallo.pasados, 0);
    assert.ok(fallo.errores.length > 0);

    drive.estado.caido = false;
    const ok = (await pedir('/drive/sincronizar', { json: {} })).datos;
    assert.deepEqual([ok.ok, ok.pasados, ok.pendientes], [true, 1, 0]);
    const ahora = await programa(r.datos.id);
    assert.equal(ahora.almacenamiento, 'drive');
    assert.match(drive.estado.items[ahora.file_url.split('/')[5]].contenido.toString('latin1'), /sin drive/);
    assert.equal(fs.readdirSync(path.join(dir, 'progmesas', 'backend', 'uploads')).length, 0, 'se borró la copia del servidor');

    cob = (await pedir(`/cobertura&anio=${ANIO}`)).datos;
    assert.equal(cob.estado.drive.disponible, true);
    assert.equal(cob.estado.locales, 0);
    const registro = (await pedir('/registro')).datos;
    assert.ok(registro.some((x) => x.accion === 'drive.sincronizado'));
});

test('PHP: el ZIP del curso trae los PDF desde Drive y eliminar borra el archivo de Drive', opciones, async () => {
    const r = await subir('2-4_ingles', pdfCon('ingles zip'));
    const z = await pedir(`/cursos/zip&curso=${encodeURIComponent('2° 4°')}&anio=${ANIO}`, { crudo: true });
    assert.equal(z.status, 200);
    const ingles = leerZip(z.cuerpo).find((a) => a.nombre === `${ANIO}/Inglés.pdf`);
    assert.ok(ingles, 'el PDF de Drive está en el ZIP');
    assert.match(ingles.datos.toString('latin1'), /ingles zip/);

    const id = (await programa(r.datos.id)).file_url.split('/')[5];
    const borrar = await fetch(base + `/programas/${r.datos.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${asesora}` } });
    assert.equal(borrar.status, 200);
    assert.equal(drive.estado.items[id], undefined, 'se borró de Drive');
});

test('PHP: sin permiso de Drive todo sigue funcionando en el servidor y el dashboard lo avisa', opciones, async () => {
    const token = path.join(dir, 'progmesas', 'backend', 'token.json');
    const guardado = fs.readFileSync(token);
    fs.rmSync(token);
    try {
        const r = await subir('3-1_ingles', pdfCon('sin permiso'));
        assert.equal(r.datos.almacenamiento, 'local');
        assert.equal(r.datos.aviso, null, 'si Drive no está configurado no se repite el aviso en cada carga');
        const cob = (await pedir(`/cobertura&anio=${ANIO}`)).datos;
        assert.deepEqual([cob.estado.drive.configurado, cob.estado.drive.disponible], [false, false]);
        assert.match(cob.estado.drive.error, /autorizar_drive\.php/);
    } finally {
        fs.writeFileSync(token, guardado);
    }
    const ok = (await pedir('/drive/sincronizar', { json: {} })).datos;
    assert.equal(ok.pasados, 1);
});

test('PHP: drive.php y autorizar_drive.php no se pueden abrir desde el navegador', opciones, async () => {
    const raiz = base.replace('api.php?r=', '');
    fs.copyFileSync(path.join(RAIZ, 'backend', 'autorizar_drive.php'), path.join(dir, 'progmesas', 'backend', 'autorizar_drive.php'));
    for (const archivo of ['backend/drive.php', 'backend/autorizar_drive.php']) {
        const res = await fetch(raiz + archivo);
        assert.equal(res.status, 404, archivo);
    }
});
