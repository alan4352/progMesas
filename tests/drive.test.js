// Pruebas con Google Drive simulado (DRIVE_SIMULADO): subir a Drive, qué pasa cuando Drive se cae,
// y cómo los PDF que quedaron en el servidor pasan a Drive cuando vuelve.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarServidor, PDF } from './servidor.js';
import { leerZip } from '../backend/lib/zip.js';

let srv;
let asesora;
const DRIVE = fs.mkdtempSync(path.join(os.tmpdir(), 'progmesas-drive-'));
const indice = () => JSON.parse(fs.readFileSync(path.join(DRIVE, 'indice.json'), 'utf-8')).items;
const caer = () => fs.writeFileSync(path.join(DRIVE, 'caido'), '');
const volver = () => fs.rmSync(path.join(DRIVE, 'caido'), { force: true });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pdfCon = (texto) => Buffer.concat([PDF, Buffer.from(`\n% ${texto}\n`)]);

before(async () => {
    srv = await iniciarServidor({ entorno: { DRIVE_DESACTIVADO: '', DRIVE_SIMULADO: DRIVE } });
    asesora = await srv.ingresar('asesor@test.com', 'asesor123');
});

after(() => {
    srv?.cerrar();
    fs.rmSync(DRIVE, { recursive: true, force: true });
});

test('al arrancar con Drive disponible, los PDF que estaban en el servidor pasan a Drive', async () => {
    let cob;
    for (let i = 0; i < 30; i++) {
        cob = (await srv.pedir('/cobertura?anio=2026', { token: asesora })).datos;
        if (cob.estado.locales === 0) break;
        await esperar(100);
    }
    assert.equal(cob.estado.locales, 0);
    assert.equal(cob.estado.drive.disponible, true);
    const programas = (await srv.pedir('/programas')).datos;
    assert.ok(programas.every((p) => p.almacenamiento === 'drive'), 'todos quedaron en Drive');
    const registro = (await srv.pedir('/registro', { token: asesora })).datos;
    assert.ok(registro.some((r) => r.accion === 'drive.sincronizado' && r.usuario.id === 'sistema'));
});

test('un programa nuevo se sube a Drive, en carpetas Año / Curso / Materia, y queda público', async () => {
    const r = await srv.subir(asesora, { asignacion: '2-3_matematica', archivo: pdfCon('drive ok') });
    assert.equal(r.status, 200);
    assert.equal(r.datos.almacenamiento, 'drive');
    assert.equal(r.datos.aviso, null);

    const p = (await srv.pedir('/programas')).datos.find((x) => x.id === r.datos.id);
    assert.match(p.file_url, /^https:\/\/drive\.google\.com\/file\/d\/sim\d+\/preview$/);
    const id = p.file_url.split('/')[5];
    const items = indice();
    assert.equal(items[id].publico, true);
    const materia = items[items[id].padre];
    const curso = items[materia.padre];
    const anio = items[curso.padre];
    assert.deepEqual([anio.nombre, curso.nombre, materia.nombre], ['2026', '2° 3°', 'Matemática']);
});

test('si Drive se cae, el programa se guarda en el servidor y avisa', async () => {
    caer();
    try {
        const r = await srv.subir(asesora, { asignacion: '2-4_matematica', archivo: pdfCon('mientras caido') });
        assert.equal(r.status, 200);
        assert.equal(r.datos.almacenamiento, 'local');
        assert.match(r.datos.aviso, /Google Drive no está disponible/);

        // Reemplazo mientras sigue caído: la versión nueva también queda en el servidor
        const r2 = await srv.subir(asesora, { asignacion: '2-4_matematica', archivo: pdfCon('reemplazo caido') });
        assert.equal(r2.datos.reemplazado, true);

        const cob = (await srv.pedir('/cobertura?anio=2026', { token: asesora })).datos;
        assert.equal(cob.estado.locales, 2);
        assert.equal(cob.estado.drive.disponible, false);

        const intento = await srv.pedir('/drive/sincronizar', { method: 'POST', token: asesora });
        assert.equal(intento.datos.pasados, 0, 'con Drive caído no pasa nada');
    } finally {
        volver();
    }
});

test('cuando Drive vuelve, "pasar a Drive" sube los guardados en el servidor y libera el disco', async () => {
    const r = await srv.pedir('/drive/sincronizar', { method: 'POST', token: asesora });
    assert.equal(r.status, 200);
    assert.deepEqual([r.datos.ok, r.datos.pasados, r.datos.pendientes], [true, 2, 0]);

    const p = (await srv.pedir('/programas', { token: asesora })).datos.find((x) => x.asignacion_id === '2-4_matematica');
    assert.equal(p.almacenamiento, 'drive');
    const h = (await srv.pedir(`/programas/${p.id}/versiones`, { token: asesora })).datos;
    assert.equal(h.versiones[0].almacenamiento, 'drive', 'la versión anterior también pasó a Drive');

    await esperar(200);
    assert.deepEqual(fs.readdirSync(path.join(srv.datos, 'uploads')).filter((f) => f.endsWith('.pdf')), []);
    assert.equal((await srv.pedir('/cobertura?anio=2026', { token: asesora })).datos.estado.locales, 0);
});

test('el ZIP del curso trae los PDF desde Drive', async () => {
    const r = await srv.pedir(`/cursos/zip?curso=${encodeURIComponent('2° 4°')}&anio=2026`, { crudo: true });
    assert.equal(r.status, 200);
    const archivos = leerZip(r.cuerpo);
    const mate = archivos.find((a) => a.nombre === '2026/Matemática.pdf');
    assert.ok(mate);
    assert.match(mate.datos.toString('latin1'), /reemplazo caido/);
});

test('eliminar un programa borra sus archivos de Drive (también los de versiones anteriores)', async () => {
    const p = (await srv.pedir('/programas', { token: asesora })).datos.find((x) => x.asignacion_id === '2-4_matematica');
    const h = (await srv.pedir(`/programas/${p.id}/versiones`, { token: asesora })).datos;
    const ids = [p.file_url, h.versiones[0].file_url].map((u) => u.split('/')[5]);
    assert.ok(ids.every((id) => indice()[id]));

    assert.equal((await srv.pedir(`/programas/${p.id}`, { method: 'DELETE', token: asesora })).status, 200);
    assert.ok(ids.every((id) => !indice()[id]), 'los dos archivos se borraron de Drive');
});
