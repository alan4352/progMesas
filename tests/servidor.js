// Ayudante de las pruebas: levanta el servidor real sobre una COPIA de la base y de los PDF
// (carpeta temporal, con DATOS_DIR), en un puerto libre y sin Google Drive.
// Así las pruebas nunca tocan los datos del proyecto.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

export const RAIZ = path.join(import.meta.dirname, '..');

/** PDF mínimo válido para las subidas de prueba. */
export const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 32), Buffer.from('\n%%EOF\n')]);

function puertoLibre() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.unref();
        s.on('error', reject);
        s.listen(0, '127.0.0.1', () => {
            const { port } = s.address();
            s.close(() => resolve(port));
        });
    });
}

/**
 * @param {object} opciones
 * @param {object} [opciones.entorno]   variables de entorno extra o que reemplazan las de prueba
 * @param {string} [opciones.preparar]  código (módulo ES) que se corre antes de arrancar, con el mismo entorno
 */
export async function iniciarServidor({ entorno = {}, preparar = '' } = {}) {
    const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'progmesas-prueba-'));
    const puerto = await puertoLibre();
    const ENTORNO = {
        ...process.env,
        PORT: String(puerto),
        JWT_SECRET: 'prueba-api-'.padEnd(48, 'x'),
        AUTH_MODO: 'prueba',
        ANIO_LECTIVO: '2026',
        MAX_PDF_MB: '1',
        DATOS_DIR: datos,
        DRIVE_DESACTIVADO: '1',
        TRUST_PROXY: '1',
        RESPALDOS_DIR: '',
        // Que no herede credenciales de Drive de quien corre las pruebas
        GOOGLE_OAUTH_JSON: '',
        GOOGLE_TOKEN_JSON: '',
        ...entorno
    };

    if (preparar) {
        execFileSync(process.execPath, ['--input-type=module', '-e', preparar], { cwd: RAIZ, env: ENTORNO, stdio: 'pipe' });
    }

    const proceso = spawn(process.execPath, ['backend/server.js'], { cwd: RAIZ, env: ENTORNO, stdio: ['ignore', 'pipe', 'pipe'] });
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
        proceso.stdout.on('data', leer);
        proceso.stderr.on('data', leer);
        proceso.on('exit', (code) => reject(new Error(`El servidor terminó (código ${code}):\n${salida}`)));
    });

    const base = `http://127.0.0.1:${puerto}`;

    async function pedir(ruta, { token, ip = '10.0.0.1', crudo = false, ...opciones } = {}) {
        const headers = { 'X-Forwarded-For': ip, ...(opciones.headers || {}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (opciones.json !== undefined) {
            headers['Content-Type'] = 'application/json';
            opciones.body = JSON.stringify(opciones.json);
        }
        const res = await fetch(base + '/api' + ruta, { ...opciones, headers });
        if (crudo) return { status: res.status, headers: res.headers, cuerpo: Buffer.from(await res.arrayBuffer()) };
        const respuesta = await res.json().catch(() => null);
        return { status: res.status, datos: respuesta, headers: res.headers };
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

    function cerrar() {
        proceso.kill();
        fs.rmSync(datos, { recursive: true, force: true });
    }

    return { base, puerto, datos, entorno: ENTORNO, pedir, ingresar, subir, cantidadDe, cerrar, salida: () => salida };
}
