// Dashboard de la asesora: todos los números salen de /api/cobertura,
// que compara cada asignación oficial con el programa cargado (sin coincidencias aproximadas).

const $ = (id) => document.getElementById(id);

let datos = { anio: null, asignaciones: [], sinAsignacion: [], estado: {} };
let vinculos = { usuarios: [], sinCuenta: [] };
let usuario = null;
let esAsesora = false;   // los roles de consulta (preceptor, directivo) ven todo pero no modifican
let pendientes = [];
let limiteCursos = 8;
let limiteDocentes = 10;
let limiteFaltantes = 5;

function porcentaje(a, b) {
    return b > 0 ? Math.round((a / b) * 100) : 0;
}

function barra(pct) {
    return `<div class="barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="barra-fill" style="width:${pct}%"></div></div>`;
}

function botonMas(cantidad, accion, texto) {
    return cantidad > 0
        ? `<button type="button" class="btn-load-more" data-accion="${accion}">${icono('abajo')}${esc(texto)} (${cantidad} más)</button>`
        : '';
}

// ================= CARGA =================

async function cargar() {
    const anio = $('anioDashboard').value;
    try {
        [datos, vinculos] = await Promise.all([
            api(`/cobertura?anio=${encodeURIComponent(anio)}`),
            api('/docentes/vinculos')
        ]);
    } catch (err) {
        showToast(err.message, 'danger');
        return;
    }
    pendientes = datos.asignaciones.filter((a) => !a.programa);
    renderEstadoSistema();
    renderResumen();
    renderNotificaciones();
    renderCursos();
    renderDocentes();
    actualizarFiltrosFaltantes();
    renderFaltantes();
    renderUltimos();
    renderVinculos();
}

// ================= ESTADO DEL SISTEMA =================

function renderEstadoSistema() {
    const avisos = [];
    const porConfirmar = vinculos.usuarios.filter((u) => u.estado === 'pendiente').length;
    if (porConfirmar) {
        avisos.push(`Hay <b>${porConfirmar}</b> docente(s) esperando que confirmes su nombre. ` +
            'Están en la sección <b>Cuentas de docentes</b>, más abajo.');
    }
    const drive = datos.estado?.drive;
    if (drive && !drive.disponible) {
        avisos.push(`<b>Google Drive no está disponible:</b> ${esc(drive.error || 'sin conexión')}. ` +
            'Los programas nuevos se guardan en el servidor (carpeta backend/uploads).');
    }
    const asig = datos.estado?.asignaciones;
    if (asig?.error === 'falta') {
        avisos.push('<b>No hay lista de asignaciones.</b> Generala con <code>node scripts/importar_horarios.js</code>.');
    } else if (asig?.error) {
        avisos.push(`<b>No se pudo leer data/asignaciones.xlsx:</b> ${esc(asig.error)}`);
    }
    const aRevisar = datos.asignaciones.filter((a) => a.revisar).length;
    if (aRevisar) {
        avisos.push(`Hay <b>${aRevisar}</b> asignación(es) marcadas para revisar en <code>data/asignaciones.xlsx</code> ` +
            '(docentes del contraturno o materias sin docente).');
    }
    $('estadoSistema').innerHTML = avisos.map((a) => `<div class="aviso">${a}</div>`).join('');
}

// ================= RESUMEN =================

function renderResumen() {
    const total = datos.asignaciones.length;
    const entregados = total - pendientes.length;
    const pct = porcentaje(entregados, total);
    const [clase, texto] = pct >= 80 ? ['coverage-high', 'Alta'] : pct >= 50 ? ['coverage-mid', 'Media'] : ['coverage-low', 'Baja'];

    $('dashboardResumen').innerHTML = `
        <div class="dash-card"><h3>Programas requeridos</h3><p>${total}</p></div>
        <div class="dash-card"><h3>Entregados</h3><p>${entregados}</p></div>
        <div class="dash-card"><h3>Pendientes</h3><p class="numero-pendiente">${pendientes.length}</p></div>
        <div class="dash-card"><h3>Cobertura ${esc(datos.anio)}</h3><p>${pct}%</p>
            <span class="coverage-badge ${clase}">${texto}</span></div>`;
}

// ================= NOTIFICACIONES =================

function renderNotificaciones() {
    let html = '';

    if (pendientes.length === 0 && datos.asignaciones.length > 0) {
        html += '<div class="alert-custom alert-success">¡Están todos los programas requeridos!</div>';
    } else if (pendientes.length > 0) {
        html += `<p class="texto-suave">Hay ${pendientes.length} programa(s) pendiente(s). Los primeros:</p>`;
        html += pendientes.slice(0, 5).map((f) =>
            `<div class="alert-box"><b>${esc(f.materia)}</b> (${esc(f.curso)}) — <i>${esc(f.docentes.join(' / ') || 'sin docente')}</i></div>`
        ).join('');
    }

    // Programas que no corresponden a ninguna asignación (cargados con la versión anterior)
    if (datos.sinAsignacion.length && esAsesora) {
        const opcionesAsignaciones = (curso) => {
            const cc = curso.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
            const delCurso = datos.asignaciones.filter((a) => a.curso.replace(/[^0-9A-Za-z]/g, '').toUpperCase() === cc);
            const lista = delCurso.length ? delCurso : datos.asignaciones;
            return lista.slice().sort((a, b) => compararCursos(a.curso, b.curso) || a.materia.localeCompare(b.materia, 'es'))
                .map((a) => `<option value="${esc(a.id)}">${esc(a.curso)} — ${esc(a.materia)}</option>`).join('');
        };
        html += `<h3 class="subtitulo">Programas sin asignación (${datos.sinAsignacion.length})</h3>
            <p class="texto-suave">No coinciden con ninguna materia de la lista oficial. Elegí a cuál corresponden o eliminálos desde el inicio.</p>`;
        html += datos.sinAsignacion.map((p) => `
            <div class="alert-box fila-vincular">
                <span><b>${esc(p.title)}</b> — ${esc(p.materia)} (${esc(p.curso)}), ${esc(p.profesor)}</span>
                <select class="form-select select-chico" data-programa="${esc(p.id)}" aria-label="Asignación">
                    <option value="">Elegí la materia…</option>${opcionesAsignaciones(p.curso)}
                </select>
                <button type="button" class="btn-ver" data-accion="vincular" data-id="${esc(p.id)}">Vincular</button>
            </div>`).join('');
    }

    $('notificaciones').innerHTML = html || '<p>No hay alertas.</p>';
}

async function vincular(id) {
    const select = document.querySelector(`select[data-programa="${CSS.escape(String(id))}"]`);
    if (!select?.value) return showToast('Elegí la materia a la que corresponde', 'danger');
    try {
        await api(`/programas/${encodeURIComponent(id)}/asignacion`, { method: 'PATCH', json: { asignacion_id: select.value } });
        showToast('Programa vinculado', 'success');
        cargar();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ================= POR CURSO =================

function renderCursos() {
    const cursos = new Map();
    for (const a of datos.asignaciones) {
        if (!cursos.has(a.curso)) cursos.set(a.curso, { turno: a.turno, total: 0, completos: 0 });
        const c = cursos.get(a.curso);
        c.total++;
        if (a.programa) c.completos++;
    }
    const lista = [...cursos.keys()].sort(compararCursos);
    if (lista.length === 0) {
        $('estadoCursos').innerHTML = '<p>No hay datos de cursos.</p>';
        return;
    }
    $('estadoCursos').innerHTML = lista.slice(0, limiteCursos).map((nombre) => {
        const c = cursos.get(nombre);
        const pct = porcentaje(c.completos, c.total);
        return `<div class="curso-box">
            <div class="fila-titulo"><h3>${esc(nombre)} <small>${esc(c.turno)}</small></h3><span><b>${c.completos} / ${c.total}</b> entregados</span></div>
            ${barra(pct)}
            <small class="texto-suave">${pct}% completo (${c.total - c.completos} pendientes)</small>
        </div>`;
    }).join('') + botonMas(lista.length - limiteCursos, 'mas-cursos', 'Mostrar más cursos');
}

// ================= POR DOCENTE =================

function renderDocentes() {
    const docentes = new Map();
    for (const a of datos.asignaciones) {
        for (const d of a.docentes.length ? a.docentes : ['Sin docente']) {
            if (!docentes.has(d)) docentes.set(d, { total: 0, completos: 0 });
            const x = docentes.get(d);
            x.total++;
            if (a.programa) x.completos++;
        }
    }
    const filtro = $('busquedaDocente').value.trim().toLowerCase();
    // Primero los que más deben
    const lista = [...docentes.entries()]
        .filter(([n]) => !filtro || n.toLowerCase().includes(filtro))
        .sort((a, b) => (b[1].total - b[1].completos) - (a[1].total - a[1].completos) || a[0].localeCompare(b[0], 'es'));

    $('estadoProfesores').innerHTML = lista.slice(0, limiteDocentes).map(([nombre, x]) => {
        const pct = porcentaje(x.completos, x.total);
        return `<div class="prof-box">
            <div class="fila-titulo"><h3>${esc(nombre)}</h3><span><b>${x.completos} / ${x.total}</b> entregados</span></div>
            ${barra(pct)}
        </div>`;
    }).join('') + botonMas(lista.length - limiteDocentes, 'mas-docentes', 'Mostrar más docentes') ||
        '<p>No hay docentes que coincidan.</p>';
}

// ================= PENDIENTES =================

function filtroValores() {
    return {
        texto: $('busquedaFaltantes').value.trim().toLowerCase(),
        profesor: $('filtroProfesorFaltantes').value,
        materia: $('filtroMateriaFaltantes').value,
        curso: $('filtroCursoFaltantes').value
    };
}

function pasaFiltro(a, f, ignorar = '') {
    if (ignorar !== 'profesor' && f.profesor && !a.docentes.includes(f.profesor)) return false;
    if (ignorar !== 'materia' && f.materia && a.materia !== f.materia) return false;
    if (ignorar !== 'curso' && f.curso && a.curso !== f.curso) return false;
    if (f.texto && ![a.materia, a.curso, ...a.docentes].some((v) => v.toLowerCase().includes(f.texto))) return false;
    return true;
}

function llenarSelect(select, valores, etiqueta, actual, orden) {
    const unicos = [...new Set(valores)].sort(orden);
    select.innerHTML = `<option value="">${esc(etiqueta)} (${unicos.length})</option>` +
        unicos.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (unicos.includes(actual)) select.value = actual;
}

function actualizarFiltrosFaltantes() {
    const f = filtroValores();
    const alfa = (a, b) => a.localeCompare(b, 'es');
    llenarSelect($('filtroProfesorFaltantes'), pendientes.filter((a) => pasaFiltro(a, f, 'profesor')).flatMap((a) => a.docentes), 'Todos los docentes', f.profesor, alfa);
    llenarSelect($('filtroMateriaFaltantes'), pendientes.filter((a) => pasaFiltro(a, f, 'materia')).map((a) => a.materia), 'Todas las materias', f.materia, alfa);
    llenarSelect($('filtroCursoFaltantes'), pendientes.filter((a) => pasaFiltro(a, f, 'curso')).map((a) => a.curso), 'Todos los cursos', f.curso, compararCursos);
}

function pendientesFiltrados() {
    const f = filtroValores();
    return pendientes.filter((a) => pasaFiltro(a, f));
}

function renderFaltantes() {
    const lista = pendientesFiltrados();
    const div = $('faltantes');
    if (lista.length === 0) {
        div.innerHTML = '<div class="alert-custom alert-success">No hay pendientes con estos filtros.</div>';
        return;
    }
    const porCurso = new Map();
    for (const a of lista) {
        if (!porCurso.has(a.curso)) porCurso.set(a.curso, []);
        porCurso.get(a.curso).push(a);
    }
    const cursos = [...porCurso.keys()].sort(compararCursos);

    div.innerHTML = `<p class="texto-suave">${lista.length} pendiente(s) en ${cursos.length} curso(s)</p>` +
        cursos.slice(0, limiteFaltantes).map((curso, i) => {
            const items = porCurso.get(curso).sort((a, b) => a.materia.localeCompare(b.materia, 'es'));
            return `<details class="sub-collapsible" ${i === 0 ? 'open' : ''}>
                <summary><span>${icono('curso')}<b>${esc(curso)}</b></span>
                    <span class="coverage-badge coverage-low badge-chico">${items.length} pendiente(s)</span></summary>
                <div class="bloque-contenido">
                    <table class="custom-table">
                        <thead><tr><th>Materia</th><th>Docente(s)</th><th>Turno</th></tr></thead>
                        <tbody>${items.map((a) => `<tr>
                            <td><b>${esc(a.materia)}</b>${a.revisar ? ` <span class="marca-revisar" title="${esc(a.revisar)}">revisar</span>` : ''}</td>
                            <td>${esc(a.docentes.join(' / ') || 'Sin docente')}</td>
                            <td><small>${esc(a.turno || '-')}</small></td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </details>`;
        }).join('') + botonMas(cursos.length - limiteFaltantes, 'mas-faltantes', 'Mostrar más cursos');
}

function exportarCsv() {
    const lista = pendientesFiltrados();
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['Curso', 'Turno', 'Materia', 'Docentes'], ...lista.map((a) => [a.curso, a.turno, a.materia, a.docentes.join(' / ')])];
    const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    enlace.download = `programas_pendientes_${datos.anio}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

// ================= ÚLTIMOS =================

function renderUltimos() {
    const cargados = datos.asignaciones
        .filter((a) => a.programa)
        .sort((a, b) => String(b.programa.created_at).localeCompare(String(a.programa.created_at)))
        .slice(0, 8);

    if (cargados.length === 0) {
        $('ultimosProgramas').innerHTML = '<p>Todavía no se cargaron programas este año.</p>';
        return;
    }
    $('ultimosProgramas').innerHTML = cargados.map((a) => {
        const url = urlPdfSegura(a.programa.file_url);
        return `<div class="card">
            <div class="card-info">
                <b>${esc(a.programa.title)}</b>
                ${esc(a.materia)} — ${esc(a.curso)}<br>
                <small>Docente(s): ${esc(a.docentes.join(' / '))} | Fecha: ${esc(a.programa.fecha)}${a.programa.almacenamiento === 'local' ? ' | guardado en el servidor' : ''}</small>
            </div>
            <div class="card-actions">
                ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="btn-ver">${icono('documento')}Ver PDF</a>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ================= CUENTAS DE DOCENTES =================

const ESTADOS = {
    pendiente: 'Esperando confirmación',
    sin_vincular: 'Entró pero no eligió su nombre',
    confirmado: 'Vinculado'
};

function fechaCorta(iso) {
    return iso ? new Date(iso).toLocaleDateString('es-AR') : '-';
}

function campoNombre(u, valor) {
    return `<input class="form-control campo-docente" list="listaDocentesLibres" data-usuario="${esc(u.usuarioId)}"
        value="${esc(valor || '')}" placeholder="Nombre en la lista…" aria-label="Nombre en la lista de docentes">`;
}

function filaCuenta(u) {
    const quien = `<b>${esc(u.nombre || u.usuarioId)}</b>${u.email ? ` <small>${esc(u.email)}</small>` : ''}`;
    let detalle = '';
    let acciones = '';

    if (u.estado === 'pendiente') {
        detalle = `Eligió <b>${esc(u.docente)}</b> (${u.asignaciones} materia(s)) el ${fechaCorta(u.solicitado)}`;
        acciones = esAsesora ? `${campoNombre(u, u.docente)}
            <button type="button" class="btn-ver" data-accion="confirmar-docente" data-usuario="${esc(u.usuarioId)}">${icono('confirmar')}Confirmar</button>
            <button type="button" class="btn-delete" data-accion="desvincular-docente" data-usuario="${esc(u.usuarioId)}">Rechazar</button>` : '';
    } else if (u.estado === 'sin_vincular') {
        detalle = `Último ingreso: ${fechaCorta(u.ultimoAcceso)}`;
        acciones = esAsesora ? `${campoNombre(u, '')}
            <button type="button" class="btn-ver" data-accion="confirmar-docente" data-usuario="${esc(u.usuarioId)}">Asignar</button>` : '';
    } else {
        const alerta = u.asignaciones === 0
            ? ' <span class="marca-revisar" title="El nombre ya no aparece en data/asignaciones.xlsx">sin materias</span>' : '';
        detalle = `<b>${esc(u.docente)}</b> — ${u.asignaciones} materia(s)${alerta} · confirmado por ${esc(u.confirmadoPor || '-')}`;
        acciones = esAsesora ? `${campoNombre(u, u.docente)}
            <button type="button" class="btn-secondary-auth btn-chico" data-accion="confirmar-docente" data-usuario="${esc(u.usuarioId)}">Cambiar</button>
            <button type="button" class="btn-delete" data-accion="desvincular-docente" data-usuario="${esc(u.usuarioId)}" data-confirmar="si">Desvincular</button>` : '';
    }

    return `<div class="fila-cuenta">
        <div class="fila-cuenta-info">${quien}<br><small>${detalle}</small></div>
        ${acciones ? `<div class="fila-cuenta-acciones">${acciones}</div>` : ''}
    </div>`;
}

function renderVinculos() {
    const grupos = ['pendiente', 'sin_vincular', 'confirmado'].map((estado) => ({
        estado,
        lista: vinculos.usuarios.filter((u) => u.estado === estado)
    }));

    $('listaDocentesLibres').innerHTML = vinculos.sinCuenta
        .map((d) => `<option value="${esc(d.docente)}"></option>`).join('');

    let html = grupos.map(({ estado, lista }) => `
        <h3 class="subtitulo">${ESTADOS[estado]} (${lista.length})</h3>
        ${lista.length ? lista.map(filaCuenta).join('') : '<p class="texto-suave">Ninguno.</p>'}`).join('');

    html += `<details class="sub-collapsible">
        <summary><span>Docentes de la lista que todavía no tienen cuenta</span>
            <span class="coverage-badge coverage-mid badge-chico">${vinculos.sinCuenta.length}</span></summary>
        <div class="bloque-contenido lista-columnas">
            ${vinculos.sinCuenta.map((d) => `<span>${esc(d.docente)} <small>(${d.asignaciones})</small></span>`).join('')}
        </div>
    </details>`;

    $('panelDocentes').innerHTML = html;
    $('resumenCuentas').textContent =
        `${grupos[2].lista.length} vinculados · ${grupos[0].lista.length} por confirmar`;
}

async function confirmarDocente(usuarioId) {
    const campo = document.querySelector(`input.campo-docente[data-usuario="${CSS.escape(usuarioId)}"]`);
    const docente = campo?.value.trim();
    if (!docente) return showToast('Escribí el nombre tal como figura en la lista', 'danger');
    try {
        await api(`/docentes/vinculos/${encodeURIComponent(usuarioId)}/confirmar`, { method: 'POST', json: { docente } });
        showToast(`Cuenta vinculada con ${docente}`, 'success');
        cargar();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function desvincularDocente(usuarioId, preguntar) {
    if (preguntar && !confirm('¿Desvincular esta cuenta? El docente no va a poder cargar programas hasta que se vuelva a vincular.')) return;
    try {
        await api(`/docentes/vinculos/${encodeURIComponent(usuarioId)}`, { method: 'DELETE' });
        showToast('Listo', 'success');
        cargar();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ================= INICIO =================

function conectarEventos() {
    $('anioDashboard').addEventListener('change', cargar);
    $('busquedaDocente').addEventListener('input', () => { limiteDocentes = 10; renderDocentes(); });
    const refiltrar = () => { limiteFaltantes = 5; actualizarFiltrosFaltantes(); renderFaltantes(); };
    $('busquedaFaltantes').addEventListener('input', refiltrar);
    for (const id of ['filtroProfesorFaltantes', 'filtroMateriaFaltantes', 'filtroCursoFaltantes']) $(id).addEventListener('change', refiltrar);
    $('btnExportar').addEventListener('click', exportarCsv);

    document.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-accion]');
        if (!b) return;
        switch (b.dataset.accion) {
            case 'mas-cursos': limiteCursos += 8; renderCursos(); break;
            case 'mas-docentes': limiteDocentes += 10; renderDocentes(); break;
            case 'mas-faltantes': limiteFaltantes += 5; renderFaltantes(); break;
            case 'vincular': vincular(b.dataset.id); break;
            case 'confirmar-docente': confirmarDocente(b.dataset.usuario); break;
            case 'desvincular-docente': desvincularDocente(b.dataset.usuario, b.dataset.confirmar === 'si'); break;
        }
    });
}

async function init() {
    usuario = await cargarIdentidad();
    if (!usuario || !['advisor', 'viewer'].includes(usuario.role)) {
        guardarAviso('Para entrar al dashboard tenés que ingresar como asesora, preceptor o directivo.');
        location.href = '../';
        return;
    }
    esAsesora = usuario.role === 'advisor';
    if (!esAsesora) $('tituloDashboard').textContent = 'Dashboard de programas';
    mostrarAvisoPendiente();

    let anio = new Date().getFullYear();
    try {
        anio = (await api('/config')).anioLectivo;
    } catch {
        /* valor por defecto */
    }
    $('anioDashboard').innerHTML = [anio + 1, anio, anio - 1, anio - 2]
        .map((y) => `<option value="${y}" ${y === anio ? 'selected' : ''}>${y}</option>`).join('');

    conectarEventos();
    await cargar();
}

init();
