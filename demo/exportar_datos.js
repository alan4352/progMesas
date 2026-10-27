// Exporta los datos reales del proyecto (base SQLite + asignaciones.xlsx) a un JSON
// que usa la demo estática de GitHub Pages.
//
// Uso:  node demo/exportar_datos.js <archivo de salida>
// (necesita las dependencias de backend/ instaladas)

import fs from 'fs';
import path from 'path';

// La demo no firma tokens: sólo hace falta un valor válido para que config.js no corte la ejecución.
process.env.AUTH_MODO = 'prueba';
process.env.JWT_SECRET ||= 'demo-'.padEnd(48, 'x');

const salida = path.resolve(process.argv[2] || 'datos.json');

const { ANIO_LECTIVO, MAX_PDF_MB } = await import('../backend/config.js');
const store = await import('../backend/store.js');
const asig = await import('../backend/asignaciones.js');
await import('../backend/docentes.js'); // crea la tabla de vínculos
const { default: db } = await import('../backend/db.js');

// Igual que el servidor al arrancar: vincula los programas viejos con su asignación
for (const p of store.programasSinAsignacion()) {
    const a = asig.buscarAsignacionPara(p.curso, p.materia);
    if (a) store.vincularAsignacion(p.id, a);
}

const asignaciones = asig.todasLasAsignaciones().map((a) => ({
    id: a.id,
    curso: a.curso,
    cursoClave: a.cursoClave,
    turno: a.turno,
    materia: a.materia,
    docentes: a.docentes,
    requiere: a.requiere,
    revisar: a.revisar
}));

// Sin datos internos de almacenamiento
const programas = store.getProgramas().map(({ archivo_ref, ...p }) => p);

const vinculos = db.prepare('SELECT * FROM docentes_usuarios').all();

// Cuentas de prueba sin contraseñas (la demo usa las claves documentadas en LEEME.md)
let usuarios = [];
try {
    usuarios = db.prepare('SELECT email, nombre, rol FROM usuarios WHERE activo = 1').all();
} catch {
    /* base sin tabla de usuarios */
}

const datos = {
    generado: new Date().toISOString(),
    config: { anioLectivo: ANIO_LECTIVO, maxPdfMb: MAX_PDF_MB, authModo: 'prueba', loginUrl: null },
    asignaciones,
    programas,
    vinculos,
    usuarios,
    docentesOficiales: asig.listaDocentes()
};

fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify(datos));
console.log(`[Demo] ${asignaciones.length} asignaciones, ${programas.length} programas → ${salida}`);
