import express from 'express';
import cors from 'cors';
import multer from 'multer';

import { PORT, ANIO_LECTIVO, CORS_ORIGENES, MAX_PDF_MB, RUTAS, AUTH_MODO, EXTERNO } from './config.js';
import { login, auth, authOpcional, rol } from './auth.js';
import {
    registrarAcceso, vinculoDe, docenteConfirmado, solicitarVinculo, confirmarVinculo, desvincular, resumenVinculos
} from './docentes.js';
import {
    getProgramas, getPrograma, programaDeAsignacion, programasSinAsignacion,
    agregarPrograma, reemplazarPrograma, vincularAsignacion, eliminarPrograma
} from './store.js';
import {
    todasLasAsignaciones, asignacionesRequeridas, asignacionPorId, asignacionesDeDocente,
    docenteDictaAsignacion, buscarAsignacionPara, estadoAsignaciones, listaDocentes
} from './asignaciones.js';
import { guardarPdf, eliminarPdf } from './almacenamiento.js';
import { estadoDrive, verificarDrive } from './drive.js';

const app = express();

// ================= SEGURIDAD BÁSICA =================

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data:",
            "frame-src 'self' https://drive.google.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ')
    );
    next();
});

// Por defecto el frontend se sirve desde este mismo servidor, así que no hace falta CORS.
// Si se aloja en otro dominio, configurá CORS_ORIGIN en el .env.
if (CORS_ORIGENES.length) app.use(cors({ origin: CORS_ORIGENES }));

app.use(express.json({ limit: '100kb' }));

// ================= FRONTEND Y ARCHIVOS =================

app.get(['/', '/index.html'], (req, res) => res.sendFile(RUTAS.index));
app.get('/privacidad.html', (req, res) => res.sendFile(RUTAS.privacidad));
app.use('/frontend', express.static(RUTAS.frontend));
app.use(
    '/uploads',
    express.static(RUTAS.uploads, {
        setHeaders: (res) => res.setHeader('Content-Type', 'application/pdf')
    })
);

// ================= SUBIDA (validación del PDF) =================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_MB * 1024 * 1024, files: 1, fields: 10 },
    fileFilter: (req, file, cb) => {
        const esPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
        cb(esPdf ? null : Object.assign(new Error('Sólo se aceptan archivos PDF'), { status: 400 }), esPdf);
    }
});

function esPdfValido(buffer) {
    return buffer && buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

// ================= HELPERS =================

/** Vínculo del docente en formato para el frontend. */
function vinculoPublico(v) {
    return v ? { docente: v.docente, estado: v.estado } : null;
}

/** Quita datos internos antes de mandar un programa a quien no es asesora. */
function programaPublico(p, esAsesora) {
    const { uploaded_by, archivo_ref, ...resto } = p;
    return esAsesora ? { ...resto, uploaded_by } : resto;
}

/** Vincula los programas cargados antes de esta versión con su asignación (por curso + materia). */
function vincularProgramasViejos() {
    let vinculados = 0;
    for (const p of programasSinAsignacion()) {
        const a = buscarAsignacionPara(p.curso, p.materia);
        if (a) {
            vincularAsignacion(p.id, a);
            vinculados++;
        }
    }
    if (vinculados) console.log(`[Programas] ${vinculados} programa(s) anteriores vinculados a su asignación`);
}

function anioValido(valor) {
    const n = parseInt(valor, 10);
    return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

// ================= API =================

app.post('/api/login', login);

app.get('/api/config', (req, res) => {
    res.json({ anioLectivo: ANIO_LECTIVO, maxPdfMb: MAX_PDF_MB, authModo: AUTH_MODO, loginUrl: EXTERNO.loginUrl || null });
});

// Quién es el usuario actual. Los docentes quedan registrados para que la asesora pueda vincularlos.
app.get('/api/yo', authOpcional, (req, res) => {
    if (!req.user) return res.json({ autenticado: false });
    const { id, nombre, email, role } = req.user;
    const vinculo = role === 'teacher' ? registrarAcceso(req.user) : null;
    res.json({ autenticado: true, id, nombre, email, role, vinculo: vinculoPublico(vinculo) });
});

// ================= VINCULACIÓN DOCENTE ↔ LISTA OFICIAL =================

// Nombres disponibles para que el docente elija el suyo
app.get('/api/docentes/nombres', auth, rol('teacher', 'advisor'), (req, res) => {
    const tomados = new Set(
        resumenVinculos().usuarios
            .filter((u) => u.estado === 'confirmado' && u.usuarioId !== req.user.id)
            .map((u) => u.docente)
    );
    res.json(listaDocentes().map((d) => ({ nombre: d, disponible: !tomados.has(d) })));
});

// El docente elige su nombre (queda pendiente de confirmación)
app.post('/api/docentes/vinculo', auth, rol('teacher'), (req, res) => {
    const v = solicitarVinculo(req.user, req.body?.docente);
    res.json({ ok: true, vinculo: vinculoPublico(v) });
});

app.get('/api/docentes/vinculos', auth, rol('advisor', 'viewer'), (req, res) => {
    res.json(resumenVinculos());
});

// La asesora confirma (opcionalmente con otro nombre) o corrige el vínculo
app.post('/api/docentes/vinculos/:usuarioId/confirmar', auth, rol('advisor'), (req, res) => {
    const v = confirmarVinculo(req.params.usuarioId, req.body?.docente, req.user);
    res.json({ ok: true, vinculo: vinculoPublico(v) });
});

app.delete('/api/docentes/vinculos/:usuarioId', auth, rol('advisor'), (req, res) => {
    desvincular(req.params.usuarioId);
    res.json({ ok: true });
});

// Lista de programas: los docentes ven los de sus materias; el resto ve todos.
app.get('/api/programas', authOpcional, (req, res) => {
    const programas = getProgramas();
    const esAsesora = req.user?.role === 'advisor';

    if (req.user?.role === 'teacher') {
        const ids = new Set(asignacionesDeDocente(docenteConfirmado(req.user.id)).map((a) => a.id));
        const propios = programas.filter(
            (p) => ids.has(p.asignacion_id) || p.uploaded_by === req.user.id || (req.user.email && p.uploaded_by === req.user.email)
        );
        return res.json(propios.map((p) => programaPublico(p, false)));
    }

    res.json(programas.map((p) => programaPublico(p, esAsesora)));
});

// Asignaciones para el formulario de subida: las del docente, o todas si es la asesora.
app.get('/api/asignaciones/mias', auth, rol('teacher', 'advisor'), (req, res) => {
    const anio = anioValido(req.query.anio) || ANIO_LECTIVO;
    const esAsesora = req.user.role === 'advisor';
    const docente = esAsesora ? '' : docenteConfirmado(req.user.id);

    const lista = esAsesora ? todasLasAsignaciones() : asignacionesDeDocente(docente);
    const cargados = new Map();
    for (const p of getProgramas()) {
        if (p.year === anio && p.asignacion_id && !cargados.has(p.asignacion_id)) cargados.set(p.asignacion_id, p);
    }

    res.json({
        anio,
        docente,
        vinculo: esAsesora ? null : vinculoPublico(vinculoDe(req.user.id)),
        asignaciones: lista.map((a) => {
            const p = cargados.get(a.id);
            return {
                id: a.id,
                curso: a.curso,
                turno: a.turno,
                materia: a.materia,
                docentes: a.docentes,
                requiere: a.requiere,
                programa: p ? { id: p.id, title: p.title, fecha: p.fecha } : null
            };
        })
    });
});

app.post('/api/programas/subir', auth, rol('teacher', 'advisor'), upload.single('pdf'), async (req, res) => {
    const esAsesora = req.user.role === 'advisor';
    const docente = esAsesora ? '' : docenteConfirmado(req.user.id);
    if (!esAsesora && !docente) {
        return res.status(403).json({ error: 'Tu cuenta todavía no está vinculada con tu nombre en la lista de docentes' });
    }

    const asignacion = asignacionPorId(req.body?.asignacion_id);
    const anio = anioValido(req.body?.anio);

    if (!asignacion) return res.status(400).json({ error: 'Elegí la materia y el curso del programa' });
    if (!anio) return res.status(400).json({ error: 'El año lectivo no es válido' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo PDF' });
    if (!esPdfValido(req.file.buffer)) return res.status(400).json({ error: 'El archivo no es un PDF válido' });

    if (!esAsesora && !docenteDictaAsignacion(docente, asignacion)) {
        return res.status(403).json({ error: 'Esa materia no figura entre tus asignaciones' });
    }

    const titulo = String(req.body.titulo || '').trim().slice(0, 150) ||
        `Programa de ${asignacion.materia} - ${asignacion.curso} - ${anio}`;
    const profesor = esAsesora ? asignacion.docentes.join(' / ') || req.user.nombre : docente;

    const archivo = await guardarPdf(req.file.buffer, {
        anio,
        curso: asignacion.curso,
        materia: asignacion.materia,
        profesor
    });

    const datos = {
        title: titulo,
        materia: asignacion.materia,
        year: anio,
        curso: asignacion.curso,
        profesor,
        uploaded_by: req.user.id,
        asignacion_id: asignacion.id,
        ...archivo
    };

    const anterior = programaDeAsignacion(asignacion.id, anio);
    let id;
    if (anterior) {
        reemplazarPrograma(anterior.id, datos);
        await eliminarPdf(anterior);
        id = anterior.id;
    } else {
        id = agregarPrograma(datos);
    }

    res.json({ ok: true, id, reemplazado: Boolean(anterior), almacenamiento: archivo.almacenamiento, aviso: archivo.aviso });
});

app.delete('/api/programas/:id', auth, rol('advisor'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const programa = getPrograma(id);
    if (!programa) return res.status(404).json({ error: 'Programa no encontrado' });

    eliminarPrograma(id);
    await eliminarPdf(programa);
    res.json({ ok: true });
});

// Vincular a mano un programa viejo que no se pudo asociar automáticamente
app.patch('/api/programas/:id/asignacion', auth, rol('advisor'), (req, res) => {
    const programa = getPrograma(req.params.id);
    const asignacion = asignacionPorId(req.body?.asignacion_id);
    if (!programa) return res.status(404).json({ error: 'Programa no encontrado' });
    if (!asignacion) return res.status(400).json({ error: 'Asignación inexistente' });
    vincularAsignacion(programa.id, asignacion);
    res.json({ ok: true });
});

// ================= CONTROL DE ASESORÍA =================

function calcularCobertura(anio) {
    vincularProgramasViejos();

    const delAnio = getProgramas().filter((p) => p.year === anio);
    const porAsignacion = new Map();
    for (const p of delAnio) {
        if (p.asignacion_id && !porAsignacion.has(p.asignacion_id)) porAsignacion.set(p.asignacion_id, p);
    }

    const asignaciones = asignacionesRequeridas().map((a) => {
        const p = porAsignacion.get(a.id);
        return {
            id: a.id,
            curso: a.curso,
            turno: a.turno,
            materia: a.materia,
            docentes: a.docentes,
            revisar: a.revisar,
            programa: p
                ? { id: p.id, title: p.title, fecha: p.fecha, created_at: p.created_at, file_url: p.file_url, almacenamiento: p.almacenamiento }
                : null
        };
    });

    const idsValidos = new Set(todasLasAsignaciones().map((a) => a.id));
    const sinAsignacion = delAnio
        .filter((p) => !p.asignacion_id || !idsValidos.has(p.asignacion_id))
        .map((p) => programaPublico(p, true));

    return { anio, asignaciones, sinAsignacion };
}

app.get('/api/cobertura', auth, rol('advisor', 'viewer'), (req, res) => {
    const anio = anioValido(req.query.anio) || ANIO_LECTIVO;
    res.json({
        ...calcularCobertura(anio),
        estado: { drive: estadoDrive(), asignaciones: estadoAsignaciones() }
    });
});

// Compatibilidad con la versión anterior del dashboard
app.get('/api/programas/faltantes', auth, rol('advisor', 'viewer'), (req, res) => {
    const anio = anioValido(req.query.anio) || ANIO_LECTIVO;
    const { asignaciones } = calcularCobertura(anio);
    res.json(
        asignaciones
            .filter((a) => !a.programa)
            .map((a) => ({ id: a.id, curso: a.curso, materia: a.materia, profesor: a.docentes.join(' / '), turno: a.turno }))
    );
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta inexistente' }));

// ================= ERRORES =================

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
            ? `El PDF supera el máximo de ${MAX_PDF_MB} MB`
            : 'No se pudo procesar el archivo enviado';
        return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: mensaje });
    }
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('[Error]', err);
    res.status(status).json({ error: status >= 500 ? 'Error interno del servidor' : err.message });
});

// ================= INICIO =================

vincularProgramasViejos();

// En Express 5 el callback recibe el error si el puerto no se pudo abrir
app.listen(PORT, async (err) => {
    if (err) {
        console.error(
            err.code === 'EADDRINUSE'
                ? `[Servidor] El puerto ${PORT} ya está en uso: hay otro servidor abierto. Cerralo o cambiá PORT en el .env.`
                : `[Servidor] No se pudo iniciar: ${err.message}`
        );
        process.exit(1);
    }
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    const drive = await verificarDrive();
    if (!drive.disponible) console.warn(`[Drive] ${drive.error || 'No disponible'} — los PDF se guardarán en backend/uploads`);
});
