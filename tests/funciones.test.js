// Pruebas de: historial de versiones, reutilizar el programa de un año anterior, registro de acciones,
// fecha límite, descarga ZIP por curso, pasar a Drive y copias de seguridad.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { iniciarServidor, PDF, RAIZ } from './servidor.js';
import { leerZip } from '../backend/lib/zip.js';

let srv;
let asesora, prof, preceptor;

const pdfCon = (texto) => Buffer.concat([PDF, Buffer.from(`\n% ${texto}\n`)]);
const archivosEnUploads = () => fs.readdirSync(path.join(srv.datos, 'uploads')).filter((f) => f.endsWith('.pdf'));

before(async () => {
    srv = await iniciarServidor({
        preparar: `
            const { crearUsuario } = await import('./backend/usuarios.js');
            crearUsuario({ email: 'preceptor@test.com', contrasena: 'preceptor123', rol: 'viewer', nombre: 'Preceptor' });
        `
    });
    asesora = await srv.ingresar('asesor@test.com', 'asesor123');
    prof = await srv.ingresar('prof@test.com', 'prof123');
    preceptor = await srv.ingresar('preceptor@test.com', 'preceptor123');
});

after(() => srv?.cerrar());

// ================= VERSIONES =================

test('al reemplazar un programa, la versión anterior queda en el historial con su archivo', async () => {
    const antes = archivosEnUploads().length;
    const v1 = await srv.subir(asesora, { asignacion: '1-2_ingles', titulo: 'Versión 1', archivo: pdfCon('v1') });
    const v2 = await srv.subir(asesora, { asignacion: '1-2_ingles', titulo: 'Versión 2', archivo: pdfCon('v2') });
    assert.equal(v2.datos.reemplazado, true);
    assert.equal(archivosEnUploads().length, antes + 2, 'el PDF anterior no se borra');

    const h = await srv.pedir(`/programas/${v1.datos.id}/versiones`, { token: asesora });
    assert.equal(h.status, 200);
    assert.equal(h.datos.programa.title, 'Versión 2');
    assert.equal(h.datos.versiones.length, 1);
    assert.equal(h.datos.versiones[0].title, 'Versión 1');
    assert.ok(h.datos.versiones[0].reemplazado_at);

    // El PDF de la versión anterior se sigue pudiendo abrir
    const viejo = await fetch(srv.base + h.datos.versiones[0].file_url);
    assert.equal(viejo.status, 200);
    assert.match(Buffer.from(await viejo.arrayBuffer()).toString('latin1'), /% v1/);

    const lista = (await srv.pedir('/programas', { token: asesora })).datos;
    assert.equal(lista.find((p) => p.id === v1.datos.id).versiones, 1);
    const publica = (await srv.pedir('/programas')).datos;
    assert.equal(publica.find((p) => p.id === v1.datos.id).versiones, undefined, 'el público no ve el historial');
});

test('el historial lo ven la asesora y el docente de la materia, no otros', async () => {
    const mias = (await srv.pedir('/asignaciones/mias?anio=2026', { token: prof })).datos.asignaciones;
    const { datos } = await srv.subir(prof, { asignacion: mias[0].id });
    assert.equal((await srv.pedir(`/programas/${datos.id}/versiones`, { token: prof })).status, 200);
    assert.equal((await srv.pedir(`/programas/${datos.id}/versiones`, { token: asesora })).status, 200);
    assert.equal((await srv.pedir(`/programas/${datos.id}/versiones`, { token: preceptor })).status, 403);
    assert.equal((await srv.pedir(`/programas/${datos.id}/versiones`)).status, 401);

    const ajeno = (await srv.subir(asesora, { asignacion: '1-3_ingles' })).datos.id;
    assert.equal((await srv.pedir(`/programas/${ajeno}/versiones`, { token: prof })).status, 403);
    assert.equal((await srv.pedir('/programas/999999/versiones', { token: asesora })).status, 404);
});

test('al eliminar un programa se borran su historial y sus archivos', async () => {
    const antes = archivosEnUploads().length;
    const a = await srv.subir(asesora, { asignacion: '1-5_ingles', archivo: pdfCon('a') });
    await srv.subir(asesora, { asignacion: '1-5_ingles', archivo: pdfCon('b') });
    assert.equal(archivosEnUploads().length, antes + 2);

    assert.equal((await srv.pedir(`/programas/${a.datos.id}`, { method: 'DELETE', token: asesora })).status, 200);
    await new Promise((r) => setTimeout(r, 200)); // el borrado del archivo es asíncrono
    assert.equal(archivosEnUploads().length, antes);
});

// ================= REUTILIZAR =================

test('se puede reutilizar el programa del año anterior sin volver a subirlo', async () => {
    const original = await srv.subir(asesora, { asignacion: '2-1_ingles', anio: 2025, titulo: 'Inglés 2° 1° - 2025', archivo: pdfCon('2025') });
    assert.equal(original.status, 200);

    const mias = (await srv.pedir('/asignaciones/mias?anio=2026', { token: asesora })).datos;
    const a = mias.asignaciones.find((x) => x.id === '2-1_ingles');
    assert.deepEqual([a.anterior.id, a.anterior.year], [original.datos.id, 2025]);

    const antes = archivosEnUploads().length;
    const r = await srv.pedir('/programas/reutilizar', { method: 'POST', json: { asignacion_id: '2-1_ingles', anio: 2026 }, token: asesora });
    assert.equal(r.status, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.desde, 2025);
    assert.equal(archivosEnUploads().length, antes, 'el archivo se comparte, no se copia');

    const nuevo = (await srv.pedir('/programas')).datos.find((p) => p.id === r.datos.id);
    assert.equal(nuevo.year, 2026);
    assert.equal(nuevo.title, 'Inglés 2° 1° - 2026', 'el año del título se actualiza');
    const pdf = await fetch(srv.base + nuevo.file_url);
    assert.match(Buffer.from(await pdf.arrayBuffer()).toString('latin1'), /% 2025/);

    // Borrar el de 2026 no borra el archivo que sigue usando el de 2025
    await srv.pedir(`/programas/${r.datos.id}`, { method: 'DELETE', token: asesora });
    await new Promise((res) => setTimeout(res, 200));
    const sigue = await fetch(srv.base + (await srv.pedir('/programas')).datos.find((p) => p.id === original.datos.id).file_url);
    assert.equal(sigue.status, 200, 'el programa de 2025 sigue teniendo su PDF');
});

test('reutilizar: sin programa anterior responde 404 y un docente sólo reutiliza los suyos', async () => {
    const sin = await srv.pedir('/programas/reutilizar', { method: 'POST', json: { asignacion_id: '6-1-TC_ingles', anio: 2026 }, token: asesora });
    assert.ok([404, 400].includes(sin.status));

    await srv.subir(asesora, { asignacion: '2-2_ingles', anio: 2025 });
    const ajeno = await srv.pedir('/programas/reutilizar', { method: 'POST', json: { asignacion_id: '2-2_ingles', anio: 2026 }, token: prof });
    assert.equal(ajeno.status, 403);

    const mias = (await srv.pedir('/asignaciones/mias?anio=2025', { token: prof })).datos.asignaciones;
    await srv.subir(prof, { asignacion: mias[0].id, anio: 2025 });
    const propio = await srv.pedir('/programas/reutilizar', { method: 'POST', json: { asignacion_id: mias[0].id, anio: 2026 }, token: prof });
    assert.equal(propio.status, 200);
});

// ================= FECHA LÍMITE =================

test('la asesora fija la fecha límite; los demás sólo la ven', async () => {
    assert.equal((await srv.pedir('/fecha-limite?anio=2026')).datos.fecha, null);

    const mal = await srv.pedir('/fecha-limite', { method: 'PUT', json: { anio: 2026, fecha: '2026-02-30' }, token: asesora });
    assert.equal(mal.status, 400, 'fecha inexistente');
    assert.equal((await srv.pedir('/fecha-limite', { method: 'PUT', json: { anio: 2026, fecha: '2026-11-20' }, token: prof })).status, 403);

    const ok = await srv.pedir('/fecha-limite', { method: 'PUT', json: { anio: 2026, fecha: '2026-11-20' }, token: asesora });
    assert.equal(ok.status, 200);
    assert.equal((await srv.pedir('/fecha-limite?anio=2026')).datos.fecha, '2026-11-20');
    assert.equal((await srv.pedir('/config')).datos.fechaLimite, '2026-11-20');
    assert.equal((await srv.pedir('/cobertura?anio=2026', { token: preceptor })).datos.fechaLimite, '2026-11-20');
    assert.equal((await srv.pedir('/asignaciones/mias?anio=2026', { token: prof })).datos.fechaLimite, '2026-11-20');
    assert.equal((await srv.pedir('/fecha-limite?anio=2025')).datos.fecha, null, 'cada año tiene la suya');

    await srv.pedir('/fecha-limite', { method: 'PUT', json: { anio: 2026, fecha: '' }, token: asesora });
    assert.equal((await srv.pedir('/fecha-limite?anio=2026')).datos.fecha, null, 'se puede quitar');
});

// ================= REGISTRO =================

test('el registro anota quién hizo cada acción', async () => {
    const { datos } = await srv.subir(prof, { asignacion: (await srv.pedir('/asignaciones/mias?anio=2026', { token: prof })).datos.asignaciones[1].id });
    await srv.pedir(`/programas/${datos.id}`, { method: 'DELETE', token: asesora });

    const r = await srv.pedir('/registro?limite=50', { token: preceptor });
    assert.equal(r.status, 200);
    const borrado = r.datos.find((x) => x.accion === 'programa.eliminado' && x.detalle.id === datos.id);
    assert.ok(borrado, 'se registra el borrado');
    assert.equal(borrado.usuario.id, 'asesor@test.com');
    const subido = r.datos.find((x) => x.accion === 'programa.subido' && x.detalle.id === datos.id);
    assert.equal(subido.usuario.id, 'prof@test.com');
    assert.ok(r.datos.some((x) => x.accion === 'ajustes.fecha_limite'));
    assert.ok(r.datos.some((x) => x.accion === 'programa.reutilizado'));
    assert.ok(r.datos.some((x) => x.accion === 'programa.reemplazado'));

    assert.equal((await srv.pedir('/registro', { token: prof })).status, 403);
    assert.equal((await srv.pedir('/registro')).status, 401);
});

// ================= ZIP POR CURSO =================

test('se descargan todos los programas de un curso en un ZIP, ordenados por año', async () => {
    await srv.subir(asesora, { asignacion: '3-3_matematica', anio: 2025, archivo: pdfCon('mate 2025') });
    await srv.subir(asesora, { asignacion: '3-3_matematica', anio: 2026, archivo: pdfCon('mate 2026') });
    await srv.subir(asesora, { asignacion: '3-3_ingles', anio: 2026, archivo: pdfCon('ingles 2026') });

    const r = await srv.pedir(`/cursos/zip?curso=${encodeURIComponent('3° 3°')}`, { crudo: true });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/zip');
    assert.match(r.headers.get('content-disposition'), /attachment/);
    const nombres = leerZip(r.cuerpo).map((a) => a.nombre).sort();
    assert.deepEqual(nombres, ['2025/Matemática.pdf', '2026/Inglés.pdf', '2026/Matemática.pdf']);
    const mate25 = leerZip(r.cuerpo).find((a) => a.nombre === '2025/Matemática.pdf');
    assert.match(mate25.datos.toString('latin1'), /mate 2025/);

    const soloAnio = await srv.pedir(`/cursos/zip?curso=${encodeURIComponent('3° 3°')}&anio=2026`, { crudo: true });
    assert.equal(leerZip(soloAnio.cuerpo).length, 2);

    assert.equal((await srv.pedir('/cursos/zip?curso=' + encodeURIComponent('9° 9°'))).status, 404);
    assert.equal((await srv.pedir('/cursos/zip')).status, 400);
});

test('si un PDF no se puede leer, el ZIP lo informa en lugar de fallar', async () => {
    const { datos } = await srv.subir(asesora, { asignacion: '4-1-TC_ingles', anio: 2026 });
    const p = (await srv.pedir('/programas', { token: asesora })).datos.find((x) => x.id === datos.id);
    fs.rmSync(path.join(srv.datos, 'uploads', decodeURIComponent(p.file_url.split('/').pop())));
    const r = await srv.pedir(`/cursos/zip?curso=${encodeURIComponent(p.curso)}&anio=2026`, { crudo: true });
    assert.equal(r.status, 200);
    const aviso = leerZip(r.cuerpo).find((a) => a.nombre === 'NO INCLUIDOS.txt');
    assert.ok(aviso);
    assert.match(aviso.datos.toString('utf8'), /Inglés/);
});

// ================= DRIVE =================

test('pasar a Drive: sin Drive no cambia nada y lo informa; la cobertura cuenta los guardados en el servidor', async () => {
    const cob = (await srv.pedir('/cobertura?anio=2026', { token: asesora })).datos;
    assert.ok(cob.estado.locales > 0);
    assert.equal(cob.estado.drive.disponible, false);

    const r = await srv.pedir('/drive/sincronizar', { method: 'POST', token: asesora });
    assert.equal(r.status, 200);
    assert.equal(r.datos.ok, false);
    assert.equal(r.datos.pasados, 0);
    assert.equal(r.datos.pendientes, cob.estado.locales);
    assert.ok(r.datos.errores.length > 0);
    assert.equal((await srv.pedir('/drive/sincronizar', { method: 'POST', token: preceptor })).status, 403);
});

// ================= RESPALDOS =================

test('el respaldo copia la base, los PDF y la planilla, y conserva sólo las últimas copias', () => {
    const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'progmesas-respaldos-'));
    try {
        const correr = () => execFileSync(process.execPath, ['backend/scripts/respaldo.js', destino], {
            cwd: RAIZ, env: { ...srv.entorno, RESPALDOS_CONSERVAR: '2' }
        }).toString();
        assert.match(correr(), /Copia guardada/);
        correr();
        const salida = correr();
        assert.match(salida, /borraron 1 copia/);

        const copias = fs.readdirSync(destino).sort();
        assert.equal(copias.length, 2, 'conserva las últimas 2');
        const ultima = path.join(destino, copias.at(-1));
        assert.ok(fs.existsSync(path.join(ultima, 'asignaciones.xlsx')));
        assert.ok(fs.readdirSync(path.join(ultima, 'uploads')).length > 0);

        // La base copiada se abre y tiene los programas
        const programas = execFileSync(process.execPath, ['--input-type=module', '-e', `
            const { default: Database } = await import('${path.join(RAIZ, 'backend', 'node_modules', 'better-sqlite3', 'lib', 'index.js').replace(/\\/g, '/')}');
            const db = new Database(${JSON.stringify(path.join(ultima, 'database.sqlite'))}, { readonly: true });
            console.log(db.prepare('SELECT COUNT(*) AS n FROM programas').get().n);
        `]).toString().trim();
        assert.ok(Number(programas) > 5);
    } finally {
        fs.rmSync(destino, { recursive: true, force: true });
    }
});
