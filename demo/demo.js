// ProgMesas — modo demostración para GitHub Pages.
//
// GitHub Pages sólo sirve archivos estáticos, así que acá no hay servidor Node.
// Este script se carga después de common.js y atiende en el navegador las mismas
// rutas /api/... que backend/server.js, con las mismas reglas de permisos.
// Los datos iniciales salen de demo/datos.json (exportado de la base y de
// asignaciones.xlsx en cada despliegue) y los cambios se guardan sólo en este navegador.

(() => {
    'use strict';

    const RAIZ = new URL('../', document.currentScript.src);
    const CLAVE_ESTADO = 'progmesas-demo-v1';

    // Contraseñas de las cuentas de prueba (las mismas de LEEME.md) + dos cuentas extra para la demo
    const CLAVES = {
        'prof@test.com': 'prof123',
        'asesor@test.com': 'asesor123',
        'alumno@test.com': 'alumno123',
        'preceptor@test.com': 'preceptor123',
        'docente2@test.com': 'docente123',
        'docente3@test.com': 'docente123'
    };
    const CUENTAS_EXTRA = [
        { email: 'preceptor@test.com', nombre: 'Preceptor (demo)', rol: 'viewer' },
        { email: 'docente2@test.com', nombre: 'Docente nuevo (demo)', rol: 'teacher' },
        // Su nombre coincide con la lista de horarios ("Grimberg Valeria"): se vincula sola al entrar
        { email: 'docente3@test.com', nombre: 'Valeria Grimberg', rol: 'teacher' }
    ];

    // ================= UTILIDADES =================

    function sinAcentos(t) {
        return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    function claveTexto(t) {
        return sinAcentos(t).toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
    }
    function errorHttp(mensaje, status = 400) {
        return Object.assign(new Error(mensaje), { status });
    }
    function anioValido(v) {
        const n = parseInt(v, 10);
        return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
    }
    function ahora() {
        return new Date().toISOString();
    }

    // ================= DATOS =================

    let datos = null;      // datos.json (fijo)
    let estado = null;     // programas y vínculos (editable, en localStorage)
    let usuarios = [];
    const urlsLocales = new Map(); // /uploads/demo/<clave>.pdf → blob: URL

    function estadoInicial() {
        return {
            version: datos.generado,
            programas: datos.programas.map((p) => ({ ...p })),
            vinculos: datos.vinculos.map((v) => ({ ...v })),
            sigId: Math.max(0, ...datos.programas.map((p) => p.id)) + 1
        };
    }

    function guardarEstado() {
        try {
            localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
        } catch {
            /* sin almacenamiento: la demo funciona igual hasta recargar */
        }
    }

    function leerEstado() {
        try {
            const e = JSON.parse(localStorage.getItem(CLAVE_ESTADO));
            // Si se desplegaron datos nuevos, se empieza de cero
            if (e && e.version === datos.generado) return e;
        } catch {
            /* nada */
        }
        return estadoInicial();
    }

    // PDF subidos en la demo: IndexedDB (localStorage no alcanza para archivos)
    function abrirBase() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('progmesas-demo', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('pdf');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async function operacionPdf(modo, accion) {
        const base = await abrirBase();
        return new Promise((resolve, reject) => {
            const tx = base.transaction('pdf', modo);
            const req = accion(tx.objectStore('pdf'));
            tx.oncomplete = () => resolve(req?.result);
            tx.onerror = () => reject(tx.error);
        });
    }
    async function cargarPdfsLocales() {
        try {
            const claves = await operacionPdf('readonly', (s) => s.getAllKeys());
            for (const clave of claves) {
                const blob = await operacionPdf('readonly', (s) => s.get(clave));
                if (blob) urlsLocales.set(`/uploads/demo/${clave}.pdf`, URL.createObjectURL(blob));
            }
        } catch {
            /* navegador sin IndexedDB */
        }
    }
    async function guardarPdfLocal(blob) {
        const clave = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const ruta = `/uploads/demo/${clave}.pdf`;
        try {
            await operacionPdf('readwrite', (s) => s.put(blob, clave));
        } catch {
            /* se ve hasta recargar */
        }
        urlsLocales.set(ruta, URL.createObjectURL(blob));
        return ruta;
    }
    async function borrarPdfLocal(fileUrl) {
        const m = /^\/uploads\/demo\/(\w+)\.pdf$/.exec(fileUrl || '');
        if (!m) return;
        urlsLocales.delete(fileUrl);
        try {
            await operacionPdf('readwrite', (s) => s.delete(m[1]));
        } catch {
            /* nada */
        }
    }

    const listo = (async () => {
        const res = await fetch(new URL('demo/datos.json', RAIZ), { cache: 'no-cache' });
        datos = await res.json();
        usuarios = [...datos.usuarios, ...CUENTAS_EXTRA.filter((c) => !datos.usuarios.some((u) => u.email === c.email))];
        estado = leerEstado();
        await cargarPdfsLocales();
    })();

    // ================= ASIGNACIONES =================

    const asignacionPorId = (id) => datos.asignaciones.find((a) => a.id === String(id));
    const requeridas = () => datos.asignaciones.filter((a) => a.requiere);

    function clavesDocente(docente) {
        return String(docente || '').split(';').map(claveTexto).filter(Boolean);
    }
    function asignacionesDeDocente(docente) {
        const claves = clavesDocente(docente);
        if (!claves.length) return [];
        return datos.asignaciones.filter((a) => a.docentes.some((d) => claves.includes(claveTexto(d))));
    }
    function docenteDicta(docente, a) {
        const claves = clavesDocente(docente);
        return a.docentes.some((d) => claves.includes(claveTexto(d)));
    }
    function docenteOficial(nombre) {
        const k = claveTexto(nombre);
        return datos.docentesOficiales.find((d) => claveTexto(d) === k) || null;
    }

    // ================= VÍNCULOS DOCENTE ↔ LISTA =================

    const vinculoDe = (id) => estado.vinculos.find((v) => v.usuario_id === String(id)) || null;
    const vinculoPublico = (v) => (v ? { docente: v.docente, estado: v.estado } : null);

    function docenteConfirmado(id) {
        const v = vinculoDe(id);
        return v && v.estado === 'confirmado' ? v.docente : '';
    }
    function confirmadoPorOtro(docente, id) {
        const k = claveTexto(docente);
        return estado.vinculos.find((v) => v.estado === 'confirmado' && v.usuario_id !== id && claveTexto(v.docente) === k) || null;
    }
    // Igual que backend/docentes.js: mismas palabras en cualquier orden, y una sola coincidencia
    function clavePalabras(nombre) {
        return claveTexto(nombre).split(' ').filter(Boolean).sort().join(' ');
    }
    function nombreOficialPara(nombreCuenta) {
        const clave = clavePalabras(nombreCuenta);
        if (!clave.includes(' ')) return null;
        const coincidencias = datos.docentesOficiales.filter((d) => clavePalabras(d) === clave);
        return coincidencias.length === 1 ? coincidencias[0] : null;
    }
    function registrarAcceso(u) {
        let v = vinculoDe(u.id);
        if (!v) {
            v = {
                usuario_id: u.id, nombre_usuario: u.nombre, email: u.email, docente: null, estado: 'sin_vincular',
                ultimo_acceso: null, solicitado_at: null, confirmado_at: null, confirmado_por: null
            };
            estado.vinculos.push(v);
        }
        v.ultimo_acceso = ahora();
        if (v.estado === 'sin_vincular') {
            const docente = nombreOficialPara(u.nombre);
            if (docente && !confirmadoPorOtro(docente, u.id)) {
                Object.assign(v, { docente, estado: 'confirmado', confirmado_at: ahora(), confirmado_por: 'automático' });
            }
        }
        guardarEstado();
        return v;
    }
    function resumenVinculos() {
        const lista = estado.vinculos.slice().sort((a, b) => a.estado.localeCompare(b.estado) || a.nombre_usuario.localeCompare(b.nombre_usuario));
        const usuariosV = lista.map((v) => ({
            usuarioId: v.usuario_id, nombre: v.nombre_usuario, email: v.email, docente: v.docente, estado: v.estado,
            ultimoAcceso: v.ultimo_acceso, solicitado: v.solicitado_at, confirmado: v.confirmado_at,
            confirmadoPor: v.confirmado_por, asignaciones: v.docente ? asignacionesDeDocente(v.docente).length : 0
        }));
        const confirmados = new Set(usuariosV.filter((u) => u.estado === 'confirmado').map((u) => claveTexto(u.docente)));
        const sinCuenta = datos.docentesOficiales
            .filter((d) => !confirmados.has(claveTexto(d)))
            .map((d) => ({ docente: d, asignaciones: asignacionesDeDocente(d).length }));
        return { usuarios: usuariosV, sinCuenta };
    }

    // ================= PROGRAMAS =================

    function programasOrdenados() {
        return estado.programas.slice().sort((a, b) =>
            b.year - a.year || String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
    }
    function programaPublico(p, esAsesora) {
        const { uploaded_by, ...resto } = p;
        return esAsesora ? { ...resto, uploaded_by } : resto;
    }

    function calcularCobertura(anio) {
        const delAnio = programasOrdenados().filter((p) => p.year === anio);
        const porAsignacion = new Map();
        for (const p of delAnio) if (p.asignacion_id && !porAsignacion.has(p.asignacion_id)) porAsignacion.set(p.asignacion_id, p);
        const asignaciones = requeridas().map((a) => {
            const p = porAsignacion.get(a.id);
            return {
                id: a.id, curso: a.curso, turno: a.turno, materia: a.materia, docentes: a.docentes, revisar: a.revisar,
                programa: p ? { id: p.id, title: p.title, fecha: p.fecha, created_at: p.created_at, file_url: p.file_url, almacenamiento: p.almacenamiento } : null
            };
        });
        const ids = new Set(datos.asignaciones.map((a) => a.id));
        const sinAsignacion = delAnio.filter((p) => !p.asignacion_id || !ids.has(p.asignacion_id)).map((p) => programaPublico(p, true));
        return { anio, asignaciones, sinAsignacion };
    }

    // ================= SESIÓN =================

    function usuarioDelToken(headers) {
        const h = headers.Authorization || headers.authorization || '';
        const m = /^Bearer demo\.(.+)$/.exec(h);
        if (!m) return null;
        let email;
        try {
            email = atob(m[1]);
        } catch {
            return null;
        }
        const u = usuarios.find((x) => x.email === email);
        return u ? { id: u.email, email: u.email, nombre: u.nombre, role: u.rol } : null;
    }

    function exigir(user, ...roles) {
        if (!user) throw errorHttp('Tenés que iniciar sesión', 401);
        if (roles.length && !roles.includes(user.role)) throw errorHttp('No tenés permiso para esta acción', 403);
    }

    // ================= RUTAS (las mismas de backend/server.js) =================

    async function atender(metodo, ruta, query, body, user) {
        let m;

        if (metodo === 'POST' && ruta === '/login') {
            const { email, password } = body || {};
            if (!email || !password) throw errorHttp('Email y contraseña requeridos');
            const correo = String(email).toLowerCase();
            if (!usuarios.some((u) => u.email === correo) || CLAVES[correo] !== password) {
                throw errorHttp('Credenciales inválidas', 401);
            }
            return { token: 'demo.' + btoa(correo) };
        }

        if (metodo === 'GET' && ruta === '/config') return datos.config;

        if (metodo === 'GET' && ruta === '/yo') {
            if (!user) return { autenticado: false };
            const v = user.role === 'teacher' ? registrarAcceso(user) : null;
            return { autenticado: true, id: user.id, nombre: user.nombre, email: user.email, role: user.role, vinculo: vinculoPublico(v) };
        }

        if (metodo === 'GET' && ruta === '/docentes/nombres') {
            exigir(user, 'teacher', 'advisor');
            const tomados = new Set(resumenVinculos().usuarios.filter((u) => u.estado === 'confirmado' && u.usuarioId !== user.id).map((u) => u.docente));
            return datos.docentesOficiales.map((d) => ({ nombre: d, disponible: !tomados.has(d) }));
        }

        if (metodo === 'POST' && ruta === '/docentes/vinculo') {
            exigir(user, 'teacher');
            const v = registrarAcceso(user);
            if (v.estado === 'confirmado') throw errorHttp('Tu cuenta ya está vinculada. Si el nombre es incorrecto, pedile a la asesora que lo corrija.', 409);
            const docente = docenteOficial(body?.docente);
            if (!docente) throw errorHttp('Ese nombre no figura en la lista de asignaciones');
            if (confirmadoPorOtro(docente, user.id)) throw errorHttp('Ese nombre ya está vinculado a otra cuenta. Hablá con la asesora.', 409);
            Object.assign(v, { docente, estado: 'confirmado', solicitado_at: ahora(), confirmado_at: ahora(), confirmado_por: 'el docente' });
            guardarEstado();
            return { ok: true, vinculo: vinculoPublico(v) };
        }

        if (metodo === 'GET' && ruta === '/docentes/vinculos') {
            exigir(user, 'advisor', 'viewer');
            return resumenVinculos();
        }

        if (metodo === 'POST' && (m = /^\/docentes\/vinculos\/([^/]+)\/confirmar$/.exec(ruta))) {
            exigir(user, 'advisor');
            const id = decodeURIComponent(m[1]);
            const v = vinculoDe(id);
            if (!v) throw errorHttp('No existe ese usuario', 404);
            const docente = docenteOficial(body?.docente ?? v.docente);
            if (!docente) throw errorHttp('Ese nombre no figura en la lista de asignaciones');
            const otro = confirmadoPorOtro(docente, id);
            if (otro) throw errorHttp(`"${docente}" ya está vinculado a ${otro.nombre_usuario || otro.usuario_id}`, 409);
            Object.assign(v, { docente, estado: 'confirmado', confirmado_at: ahora(), confirmado_por: user.nombre || user.id });
            guardarEstado();
            return { ok: true, vinculo: vinculoPublico(v) };
        }

        if (metodo === 'DELETE' && (m = /^\/docentes\/vinculos\/([^/]+)$/.exec(ruta))) {
            exigir(user, 'advisor');
            const v = vinculoDe(decodeURIComponent(m[1]));
            if (!v) throw errorHttp('No existe ese usuario', 404);
            Object.assign(v, { docente: null, estado: 'sin_vincular', solicitado_at: null, confirmado_at: null, confirmado_por: null });
            guardarEstado();
            return { ok: true };
        }

        if (metodo === 'GET' && ruta === '/programas') {
            const lista = programasOrdenados();
            if (user?.role === 'teacher') {
                const ids = new Set(asignacionesDeDocente(docenteConfirmado(user.id)).map((a) => a.id));
                return lista.filter((p) => ids.has(p.asignacion_id) || p.uploaded_by === user.id).map((p) => programaPublico(p, false));
            }
            return lista.map((p) => programaPublico(p, user?.role === 'advisor'));
        }

        if (metodo === 'GET' && ruta === '/asignaciones/mias') {
            exigir(user, 'teacher', 'advisor');
            const anio = anioValido(query.get('anio')) || datos.config.anioLectivo;
            const esAsesora = user.role === 'advisor';
            const docente = esAsesora ? '' : docenteConfirmado(user.id);
            const lista = esAsesora ? datos.asignaciones : asignacionesDeDocente(docente);
            const cargados = new Map();
            for (const p of programasOrdenados()) if (p.year === anio && p.asignacion_id && !cargados.has(p.asignacion_id)) cargados.set(p.asignacion_id, p);
            return {
                anio, docente,
                vinculo: esAsesora ? null : vinculoPublico(vinculoDe(user.id)),
                asignaciones: lista.map((a) => {
                    const p = cargados.get(a.id);
                    return {
                        id: a.id, curso: a.curso, turno: a.turno, materia: a.materia, docentes: a.docentes, requiere: a.requiere,
                        programa: p ? { id: p.id, title: p.title, fecha: p.fecha } : null
                    };
                })
            };
        }

        if (metodo === 'POST' && ruta === '/programas/subir') {
            exigir(user, 'teacher', 'advisor');
            const esAsesora = user.role === 'advisor';
            const docente = esAsesora ? '' : docenteConfirmado(user.id);
            if (!esAsesora && !docente) throw errorHttp('Tu cuenta todavía no está vinculada con tu nombre en la lista de docentes', 403);
            const a = asignacionPorId(body.get('asignacion_id'));
            const anio = anioValido(body.get('anio'));
            const archivo = body.get('pdf');
            if (!a) throw errorHttp('Elegí la materia y el curso del programa');
            if (!anio) throw errorHttp('El año lectivo no es válido');
            if (!(archivo instanceof Blob)) throw errorHttp('Falta el archivo PDF');
            if (archivo.size > datos.config.maxPdfMb * 1024 * 1024) throw errorHttp(`El PDF supera el máximo de ${datos.config.maxPdfMb} MB`, 413);
            const cabecera = new TextDecoder('latin1').decode(await archivo.slice(0, 5).arrayBuffer());
            if (cabecera !== '%PDF-') throw errorHttp('El archivo no es un PDF válido');
            if (!esAsesora && !docenteDicta(docente, a)) throw errorHttp('Esa materia no figura entre tus asignaciones', 403);

            const titulo = String(body.get('titulo') || '').trim().slice(0, 150) || `Programa de ${a.materia} - ${a.curso} - ${anio}`;
            const nuevo = {
                title: titulo, materia: a.materia, year: anio, curso: a.curso,
                profesor: esAsesora ? a.docentes.join(' / ') || user.nombre : docente,
                file_url: await guardarPdfLocal(archivo.slice(0, archivo.size, 'application/pdf')),
                fecha: new Date().toLocaleDateString('es-AR'), uploaded_by: user.id, asignacion_id: a.id,
                almacenamiento: 'demo', created_at: ahora()
            };
            const anterior = programasOrdenados().find((p) => p.asignacion_id === a.id && p.year === anio);
            let id;
            if (anterior) {
                await borrarPdfLocal(anterior.file_url);
                Object.assign(anterior, nuevo);
                id = anterior.id;
            } else {
                id = estado.sigId++;
                estado.programas.push({ id, ...nuevo });
            }
            guardarEstado();
            return {
                ok: true, id, reemplazado: Boolean(anterior), almacenamiento: 'demo',
                aviso: 'Modo demostración: el PDF quedó guardado sólo en este navegador.'
            };
        }

        if (metodo === 'DELETE' && (m = /^\/programas\/(\d+)$/.exec(ruta))) {
            exigir(user, 'advisor');
            const i = estado.programas.findIndex((p) => p.id === Number(m[1]));
            if (i < 0) throw errorHttp('Programa no encontrado', 404);
            await borrarPdfLocal(estado.programas[i].file_url);
            estado.programas.splice(i, 1);
            guardarEstado();
            return { ok: true };
        }

        if (metodo === 'PATCH' && (m = /^\/programas\/(\d+)\/asignacion$/.exec(ruta))) {
            exigir(user, 'advisor');
            const p = estado.programas.find((x) => x.id === Number(m[1]));
            const a = asignacionPorId(body?.asignacion_id);
            if (!p) throw errorHttp('Programa no encontrado', 404);
            if (!a) throw errorHttp('Asignación inexistente');
            Object.assign(p, { asignacion_id: a.id, curso: a.curso, materia: a.materia });
            guardarEstado();
            return { ok: true };
        }

        if (metodo === 'GET' && ruta === '/cobertura') {
            exigir(user, 'advisor', 'viewer');
            const anio = anioValido(query.get('anio')) || datos.config.anioLectivo;
            return {
                ...calcularCobertura(anio),
                estado: { drive: { disponible: true, error: null }, asignaciones: { cantidad: datos.asignaciones.length, error: null } }
            };
        }

        if (metodo === 'GET' && ruta === '/programas/faltantes') {
            exigir(user, 'advisor', 'viewer');
            const anio = anioValido(query.get('anio')) || datos.config.anioLectivo;
            return calcularCobertura(anio).asignaciones.filter((a) => !a.programa)
                .map((a) => ({ id: a.id, curso: a.curso, materia: a.materia, profesor: a.docentes.join(' / '), turno: a.turno }));
        }

        throw errorHttp('Ruta inexistente', 404);
    }

    // ================= INTERCEPTOR DE fetch =================

    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async (recurso, opciones = {}) => {
        if (typeof recurso !== 'string' || !recurso.startsWith('/api/')) return fetchOriginal(recurso, opciones);
        await listo;
        const url = new URL(recurso, 'https://demo.local');
        const ruta = url.pathname.slice(4);
        const metodo = (opciones.method || 'GET').toUpperCase();
        let body = opciones.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch {
                body = {};
            }
        }
        const json = (cuerpo, status = 200) =>
            new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
        try {
            const user = usuarioDelToken(opciones.headers || {});
            return json(await atender(metodo, ruta, url.searchParams, body, user));
        } catch (err) {
            const status = err.status || 500;
            return json({ error: status >= 500 ? 'Error interno de la demo' : err.message }, status);
        }
    };

    // Los PDF de la base se publican junto a la página; los subidos en la demo son blob: URLs
    const urlPdfOriginal = window.urlPdfSegura;
    window.urlPdfSegura = function (url) {
        const u = String(url || '');
        if (urlsLocales.has(u)) return urlsLocales.get(u);
        if (/^\/uploads\/[\w.-]+\.pdf$/.test(u)) return new URL(u.slice(1), RAIZ).href;
        return urlPdfOriginal(u);
    };

    // ================= AVISO DE DEMO =================

    function mostrarBarra() {
        const barra = document.createElement('div');
        barra.className = 'demo-barra';
        barra.setAttribute('role', 'note');
        barra.innerHTML =
            '<span><b>Modo demostración</b> · los cambios se guardan sólo en este navegador.</span>' +
            '<details><summary>Cuentas de prueba</summary><ul>' +
            '<li><b>asesor@test.com</b> / asesor123 — asesora (dashboard, confirma docentes)</li>' +
            '<li><b>prof@test.com</b> / prof123 — docente vinculado</li>' +
            '<li><b>docente2@test.com</b> / docente123 — docente nuevo (elige su nombre)</li>' +
            '<li><b>docente3@test.com</b> / docente123 — docente que se vincula sola por su nombre</li>' +
            '<li><b>preceptor@test.com</b> / preceptor123 — consulta</li>' +
            '<li><b>alumno@test.com</b> / alumno123 — alumno</li>' +
            '</ul></details>' +
            '<button type="button" class="demo-reiniciar">Restablecer datos</button>';
        barra.querySelector('.demo-reiniciar').addEventListener('click', async () => {
            if (!confirm('¿Volver a los datos originales? Se borran los cambios hechos en la demo.')) return;
            try {
                localStorage.removeItem(CLAVE_ESTADO);
                localStorage.removeItem('token');
                await operacionPdf('readwrite', (s) => s.clear());
            } catch {
                /* nada */
            }
            location.reload();
        });
        document.body.prepend(barra);

        const estilo = document.createElement('style');
        estilo.textContent = `
            .demo-barra { display:flex; flex-wrap:wrap; gap:.5rem 1rem; align-items:center; justify-content:center;
                padding:.55rem 1rem; background:#f5e9c8; color:#3a1a00; font-size:.9rem; border-bottom:2px solid #d4b26a; }
            .demo-barra details { position:relative; }
            .demo-barra summary { cursor:pointer; text-decoration:underline; }
            .demo-barra ul { position:absolute; z-index:50; left:50%; transform:translateX(-50%); top:1.6rem; margin:0;
                padding:.7rem 1rem .7rem 1.8rem; width:max-content; max-width:calc(100vw - 32px);
                background:#fffaf0; color:#3a1a00; border:1px solid #d4b26a; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,.25); }
            .demo-barra li { margin:.2rem 0; }
            .demo-barra button { font:inherit; padding:.2rem .7rem; border-radius:6px; border:1px solid #9d6a00;
                background:#fffaf0; color:#3a1a00; cursor:pointer; }
            :root[data-tema="oscuro"] .demo-barra { background:#2e2410; color:#ecd9b0; border-bottom-color:#5a4520; }
            :root[data-tema="oscuro"] .demo-barra ul,
            :root[data-tema="oscuro"] .demo-barra button { background:#221b10; color:#ecd9b0; border-color:#6b5226; }`;
        document.head.appendChild(estilo);
    }
    mostrarBarra();
})();
