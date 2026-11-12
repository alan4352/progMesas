// Ayudante de las pruebas: levanta el servidor real sobre una COPIA de la base y de los PDF
// (carpeta temporal, con DATOS_DIR), en un puerto libre y sin Google Drive.
// Así las pruebas nunca tocan los datos del proyecto.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

export const RAIZ = path.join(import.meta.dirname, '..');
const jwt = createRequire(path.join(RAIZ, 'backend', 'package.json'))('jsonwebtoken');

/** Clave compartida con el campus en las pruebas. */
export const SECRETO_CAMPUS = 'clave-de-prueba-compartida-con-el-campus-0123456789';

/**
 * Cuentas del campus que usan las pruebas: el pase que manda el campus lleva el id (correo),
 * el nombre y el rol del campus (profesor, directivo, alumno; preceptor sólo consulta).
 */
export const CUENTAS = {
    'asesor@test.com': { nombre: 'Ana', rol: 'directivo' },
    'prof@test.com': { nombre: 'Juan', rol: 'profesor' },
    'alumno@test.com': { nombre: 'Pedro', rol: 'alumno' },
    'preceptor@test.com': { nombre: 'Preceptor', rol: 'preceptor' },
    'nuevo@test.com': { nombre: 'Docente Nuevo', rol: 'profesor' },
    // Coincide con "Grimberg Valeria" de la lista: se vincula sola
    'valeria@test.com': { nombre: 'Valeria Grimberg', rol: 'profesor' },
    // Nombre de otro docente ya vinculado: no se vincula sola
    'otra@test.com': { nombre: 'Lucrecia Fernández', rol: 'profesor' },
    'viejo@test.com': { nombre: 'Docente Viejo', rol: 'profesor' }
};

/** Pase firmado como el que arma el campus (includes/progmesas.php). */
export function paseCampus(email, { secreto = SECRETO_CAMPUS, horas = 8 } = {}) {
    const cuenta = CUENTAS[email];
    if (!cuenta) throw new Error(`No hay una cuenta de prueba ${email}`);
    return jwt.sign({ sub: email, name: cuenta.nombre, email, role: cuenta.rol }, secreto, { algorithm: 'HS256', expiresIn: `${horas}h` });
}

// "prof@test.com" ya está vinculado con "Fernandez Lucrecia" (como en la base del proyecto)
const PREPARAR_BASE = `
    const { default: db } = await import('./backend/db.js');
    await import('./backend/docentes.js');
    db.prepare("INSERT OR IGNORE INTO docentes_usuarios (usuario_id, nombre_usuario, email, docente, estado, confirmado_at, confirmado_por) " +
        "VALUES ('prof@test.com', 'Juan', 'prof@test.com', 'Fernandez Lucrecia', 'confirmado', '2026-10-01T12:00:00Z', 'prueba')").run();
`;

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
        EXTERNO_JWT_SECRET: SECRETO_CAMPUS,
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

    execFileSync(process.execPath, ['--input-type=module', '-e', PREPARAR_BASE + preparar], { cwd: RAIZ, env: ENTORNO, stdio: 'pipe' });

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

    /** Entra como lo hace el campus: con el pase firmado de esa cuenta. */
    async function ingresar(email) {
        const token = paseCampus(email, { secreto: ENTORNO.EXTERNO_JWT_SECRET });
        const r = await pedir('/yo', { token });
        assert.equal(r.datos?.autenticado, true, `no pudo ingresar ${email}: ${JSON.stringify(r.datos)}`);
        return token;
    }

    function subir(token, { asignacion, anio, archivo = PDF, nombre = 'programa.pdf', titulo, tipo }) {
        const form = new FormData();
        form.append('asignacion_id', asignacion);
        if (tipo !== undefined) form.append('tipo', tipo);
        if (anio !== undefined) form.append('anio', String(anio));
        if (titulo !== undefined) form.append('titulo', titulo);
        form.append('pdf', new Blob([archivo], { type: 'application/pdf' }), nombre);
        return pedir('/programas/subir', { method: 'POST', body: form, token });
    }

    /**
     * Carga directo en la base un programa de otro año (por ejemplo, el del año anterior para reutilizarlo).
     * Por la API sólo se puede subir el del año lectivo actual.
     */
    function sembrarPrograma({ asignacion, anio, archivo = PDF, tipo = 'regular' }) {
        const codigo = `
            const [asignacionId, anio, base64, tipo] = process.argv.slice(1);
            const { agregarPrograma } = await import('./backend/store.js');
            const { asignacionPorId } = await import('./backend/asignaciones.js');
            const { guardarPdf } = await import('./backend/almacenamiento.js');
            const a = asignacionPorId(asignacionId);
            const datos = { anio: Number(anio), curso: a.curso, materia: a.materia, profesor: a.docentes.join(' / ') };
            const archivo = await guardarPdf(Buffer.from(base64, 'base64'), datos);
            const id = agregarPrograma({
                title: 'Programa ' + (tipo === 'libre' ? 'libre ' : '') + 'de ' + a.materia + ' - ' + a.curso + ' - ' + anio, materia: a.materia, year: Number(anio),
                curso: a.curso, profesor: datos.profesor, uploaded_by: 'prueba', asignacion_id: a.id, tipo, ...archivo
            });
            process.stdout.write('ID=' + id);
        `;
        const salida = execFileSync(process.execPath, ['--input-type=module', '-e', codigo, asignacion, String(anio), Buffer.from(archivo).toString('base64'), tipo],
            { cwd: RAIZ, env: ENTORNO, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
        return { id: Number(/ID=(\d+)/.exec(salida)[1]) };
    }

    const cantidadDe = async (asignacion, anio = 2026) =>
        (await pedir('/programas')).datos.filter((p) => p.asignacion_id === asignacion && p.year === anio).length;

    function cerrar() {
        proceso.kill();
        fs.rmSync(datos, { recursive: true, force: true });
    }

    return { base, puerto, datos, entorno: ENTORNO, pedir, ingresar, subir, sembrarPrograma, cantidadDe, cerrar, salida: () => salida };
}
