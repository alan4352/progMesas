// Guarda los PDF en Google Drive y, si Drive no está disponible, en backend/uploads.

import fs from 'fs';
import path from 'path';
import { RUTAS } from './config.js';
import { subirArchivo, eliminarArchivo } from './drive.js';
import { claveTexto } from './lib/normalizar.js';

fs.mkdirSync(RUTAS.uploads, { recursive: true });

function nombreSeguro(texto) {
    return claveTexto(texto).replace(/\s+/g, '_').slice(0, 60) || 'programa';
}

/**
 * @returns {Promise<{almacenamiento:'drive'|'local', archivo_ref:string, file_url:string, aviso:string|null}>}
 */
export async function guardarPdf(buffer, { anio, curso, materia, profesor }) {
    try {
        const id = await subirArchivo(buffer, anio, materia, curso, profesor);
        return {
            almacenamiento: 'drive',
            archivo_ref: id,
            file_url: `https://drive.google.com/file/d/${id}/preview`,
            aviso: null
        };
    } catch (err) {
        console.warn('[Almacenamiento] Drive no disponible, se guarda en el servidor:', err.message);
        const nombre = `${Date.now()}_${nombreSeguro(`${curso} ${materia}`)}.pdf`;
        fs.writeFileSync(path.join(RUTAS.uploads, nombre), buffer);
        return {
            almacenamiento: 'local',
            archivo_ref: nombre,
            file_url: `/uploads/${encodeURIComponent(nombre)}`,
            aviso: `El programa se guardó en el servidor porque Google Drive no está disponible (${err.message}).`
        };
    }
}

export async function eliminarPdf(programa) {
    if (!programa) return;
    if (programa.almacenamiento === 'drive') {
        await eliminarArchivo(programa.archivo_ref);
    } else if (programa.almacenamiento === 'local' && programa.archivo_ref) {
        // basename evita borrar algo fuera de la carpeta uploads
        const ruta = path.join(RUTAS.uploads, path.basename(programa.archivo_ref));
        fs.rm(ruta, { force: true }, () => {});
    }
}
