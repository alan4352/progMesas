import db from './db.js';

// Todas las consultas usan parámetros (?), así los datos del usuario nunca se interpretan como SQL.

const CAMPOS = `id, title, materia, year, curso, profesor, file_url, fecha, uploaded_by,
                asignacion_id, almacenamiento, archivo_ref, created_at`;

const stmtTodos = db.prepare(`SELECT ${CAMPOS} FROM programas ORDER BY year DESC, created_at DESC, id DESC`);
const stmtPorId = db.prepare(`SELECT ${CAMPOS} FROM programas WHERE id = ?`);
const stmtPorAsignacion = db.prepare(
    `SELECT ${CAMPOS} FROM programas WHERE asignacion_id = ? AND year = ? ORDER BY created_at DESC, id DESC LIMIT 1`
);
const stmtSinAsignacion = db.prepare(`SELECT ${CAMPOS} FROM programas WHERE asignacion_id IS NULL OR asignacion_id = ''`);

const stmtInsertar = db.prepare(`
    INSERT INTO programas (title, materia, year, curso, profesor, file_url, fecha, uploaded_by,
                           asignacion_id, almacenamiento, archivo_ref, created_at)
    VALUES (@title, @materia, @year, @curso, @profesor, @file_url, @fecha, @uploaded_by,
            @asignacion_id, @almacenamiento, @archivo_ref, @created_at)
`);

const stmtReemplazar = db.prepare(`
    UPDATE programas SET title = @title, materia = @materia, curso = @curso, profesor = @profesor,
        file_url = @file_url, fecha = @fecha, uploaded_by = @uploaded_by,
        almacenamiento = @almacenamiento, archivo_ref = @archivo_ref, created_at = @created_at
    WHERE id = @id
`);

const stmtVincular = db.prepare('UPDATE programas SET asignacion_id = ?, curso = ?, materia = ? WHERE id = ?');
const stmtEliminar = db.prepare('DELETE FROM programas WHERE id = ?');

export function getProgramas() {
    return stmtTodos.all();
}

export function getPrograma(id) {
    return stmtPorId.get(Number(id));
}

export function programaDeAsignacion(asignacionId, anio) {
    return stmtPorAsignacion.get(String(asignacionId), Number(anio));
}

export function programasSinAsignacion() {
    return stmtSinAsignacion.all();
}

function datosBase(p) {
    const ahora = new Date();
    return {
        title: String(p.title || '').trim(),
        materia: String(p.materia || '').trim(),
        curso: String(p.curso || '').trim(),
        profesor: String(p.profesor || '').trim(),
        file_url: String(p.file_url || '').trim(),
        fecha: ahora.toLocaleDateString('es-AR'),
        uploaded_by: String(p.uploaded_by || '').trim(),
        almacenamiento: p.almacenamiento || '',
        archivo_ref: p.archivo_ref || '',
        created_at: ahora.toISOString()
    };
}

export function agregarPrograma(p) {
    const info = stmtInsertar.run({
        ...datosBase(p),
        year: parseInt(p.year, 10) || new Date().getFullYear(),
        asignacion_id: p.asignacion_id || null
    });
    return Number(info.lastInsertRowid);
}

/** Reemplaza el archivo y los datos de un programa existente (misma asignación y año). */
export function reemplazarPrograma(id, p) {
    stmtReemplazar.run({ ...datosBase(p), id: Number(id) });
}

/** Asocia un programa a una asignación y unifica el curso y la materia con los nombres oficiales. */
export function vincularAsignacion(id, asignacion) {
    stmtVincular.run(asignacion.id, asignacion.curso, asignacion.materia, Number(id));
}

export function eliminarPrograma(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return false;
    return stmtEliminar.run(numericId).changes > 0;
}
