import fs from 'fs';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { RUTAS, DRIVE_CARPETA_RAIZ, DRIVE_CARPETA_NOMBRE, DRIVE_DESACTIVADO } from './config.js';
import { escaparConsultaDrive } from './lib/normalizar.js';

// ================= CREDENCIALES =================

function leerJson(ruta) {
    try {
        return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    } catch {
        return null;
    }
}

const credenciales = DRIVE_DESACTIVADO ? null : leerJson(RUTAS.oauth);
const app = credenciales?.installed || credenciales?.web || null;

export const oAuth2Client = app
    ? new google.auth.OAuth2(app.client_id, app.client_secret, app.redirect_uris?.[0] || 'http://localhost')
    : null;

let ultimoError = app ? null : DRIVE_DESACTIVADO ? 'Drive desactivado (DRIVE_DESACTIVADO)' : 'Falta backend/oauth.json';

if (oAuth2Client) {
    const token = leerJson(RUTAS.token);
    if (token) {
        oAuth2Client.setCredentials(token);
        // Guardar el token renovado cuando Google entrega uno nuevo
        oAuth2Client.on('tokens', (nuevos) => {
            const actual = leerJson(RUTAS.token) || {};
            fs.writeFileSync(RUTAS.token, JSON.stringify({ ...actual, ...nuevos }, null, 2));
        });
    } else {
        ultimoError = 'Falta backend/token.json (ejecutá: node scripts/autorizar_drive.js)';
    }
}

const drive = oAuth2Client ? google.drive({ version: 'v3', auth: oAuth2Client }) : null;

function traducirError(err) {
    const msg = String(err?.message || err);
    if (msg.includes('invalid_grant')) {
        return 'El permiso de Google Drive venció. Volvé a autorizar con: node scripts/autorizar_drive.js';
    }
    return msg;
}

/** Comprueba al iniciar que el permiso de Drive siga vigente (no bloquea el arranque). */
export async function verificarDrive() {
    if (!drive || !leerJson(RUTAS.token)) return estadoDrive();
    try {
        await oAuth2Client.getAccessToken();
        ultimoError = null;
    } catch (err) {
        ultimoError = traducirError(err);
    }
    return estadoDrive();
}

/** Estado de la conexión con Drive para mostrar a la asesora. */
export function estadoDrive() {
    return { disponible: Boolean(drive) && !ultimoError, error: ultimoError };
}

// ================= CARPETAS =================

async function obtenerOCrearCarpeta(nombre, padre) {
    const q = `'${escaparConsultaDrive(padre)}' in parents and name='${escaparConsultaDrive(nombre)}' ` +
        `and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const busqueda = await drive.files.list({ q, fields: 'files(id,name)' });
    if (busqueda.data.files?.length) return busqueda.data.files[0].id;

    const carpeta = await drive.files.create({
        requestBody: { name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [padre] },
        fields: 'id'
    });
    return carpeta.data.id;
}

/** Carpeta raíz: la configurada, o (con alcance "archivos") una carpeta propia en "Mi unidad". */
let raizCreada = null;
async function carpetaRaiz() {
    if (DRIVE_CARPETA_RAIZ) return DRIVE_CARPETA_RAIZ;
    raizCreada ||= await obtenerOCrearCarpeta(DRIVE_CARPETA_NOMBRE, 'root');
    return raizCreada;
}

// ================= ARCHIVOS =================

/** Sube el PDF a Año/Curso/Materia y lo deja público (sólo lectura). Devuelve el id del archivo. */
export async function subirArchivo(buffer, anio, materia, curso, profesor) {
    if (!drive) throw new Error(ultimoError || 'Google Drive no está configurado');
    try {
        const carpetaAnio = await obtenerOCrearCarpeta(String(anio), await carpetaRaiz());
        const carpetaCurso = await obtenerOCrearCarpeta(curso, carpetaAnio);
        const carpetaMateria = await obtenerOCrearCarpeta(materia, carpetaCurso);

        const archivo = await drive.files.create({
            requestBody: { name: `${anio}-${curso}_${profesor}_${materia}.pdf`, parents: [carpetaMateria] },
            media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
            fields: 'id'
        });

        await drive.permissions.create({
            fileId: archivo.data.id,
            requestBody: { role: 'reader', type: 'anyone' }
        });

        ultimoError = null;
        return archivo.data.id;
    } catch (err) {
        ultimoError = traducirError(err);
        throw new Error(ultimoError);
    }
}

export async function eliminarArchivo(fileId) {
    if (!drive || !fileId) return;
    try {
        await drive.files.delete({ fileId });
    } catch (err) {
        // Si ya no existe no es un problema; cualquier otro error se informa pero no frena el borrado del registro
        if (err?.code !== 404) console.warn('[Drive] No se pudo borrar el archivo', fileId, '-', traducirError(err));
    }
}
