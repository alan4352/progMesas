// Configuración central. Lee el .env de la raíz del proyecto (o de backend/) y
// valida lo imprescindible antes de levantar el servidor.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const RAIZ = path.join(__dirname, '..');
export const BACKEND = __dirname;

for (const archivo of [path.join(RAIZ, '.env'), path.join(BACKEND, '.env')]) {
    if (fs.existsSync(archivo)) dotenv.config({ path: archivo, quiet: true });
}

// Secreto publicado en versiones anteriores del código: no se acepta.
const SECRETOS_INVALIDOS = new Set(['progmesas_super_secret_jwt_key_2026_x89a!', 'tu_clave_secreta_jwt_aqui']);

function leerSecreto() {
    const secreto = process.env.JWT_SECRET || '';
    if (!secreto || secreto.length < 32 || SECRETOS_INVALIDOS.has(secreto)) {
        console.error(
            '\n[Config] Falta JWT_SECRET o es inseguro.\n' +
            'Generá uno con:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
            'y guardalo en el archivo .env como  JWT_SECRET=<valor>\n'
        );
        process.exit(1);
    }
    return secreto;
}

export const JWT_SECRET = leerSecreto();
export const JWT_DURACION = process.env.JWT_DURACION || '8h';
export const PORT = Number(process.env.PORT) || 3000;
export const ANIO_LECTIVO = Number(process.env.ANIO_LECTIVO) || new Date().getFullYear();

// Orígenes permitidos para CORS (separados por coma). Vacío = sólo el mismo servidor.
export const CORS_ORIGENES = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

export const MAX_PDF_MB = Number(process.env.MAX_PDF_MB) || 10;

export const RUTAS = {
    db: path.join(BACKEND, 'database.sqlite'),
    uploads: path.join(BACKEND, 'uploads'),
    asignaciones: path.join(BACKEND, 'data', 'asignaciones.xlsx'),
    oauth: path.join(BACKEND, 'oauth.json'),
    token: path.join(BACKEND, 'token.json'),
    frontend: path.join(RAIZ, 'frontend'),
    index: path.join(RAIZ, 'index.html')
};

// ID de la carpeta raíz de Drive donde se guardan los programas
export const DRIVE_CARPETA_RAIZ = process.env.DRIVE_CARPETA_RAIZ || '1EY74DSygnNwaxm6hWhKm5-alO-0X0Lnl';
