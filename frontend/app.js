// Página principal: listado público de programas, login y subida.

let programas = [];
let usuario = null;          // null = visitante / alumno
let config = { anioLectivo: new Date().getFullYear(), maxPdfMb: 10 };
let asignaciones = [];       // las que el usuario puede cargar

const $ = (id) => document.getElementById(id);

function mostrar(el, visible) {
    if (el) el.classList.toggle('hidden', !visible);
}

// ================= INTERFAZ SEGÚN EL ROL =================

function aplicarRol() {
    const logueado = Boolean(usuario);
    const puedeSubir = usuario?.role === 'teacher' || usuario?.role === 'advisor';

    mostrar($('btnToggleLogin'), !logueado);
    mostrar($('btnLogout'), logueado);
    mostrar($('btnDashboard'), usuario?.role === 'advisor');
    mostrar($('zonaSubida'), puedeSubir);
    if (logueado) mostrar($('zonaLogin'), false);

    const banner = $('bannerDocente');
    if (usuario?.role === 'teacher') {
        banner.innerHTML = `🧑‍🏫 <b>Mis programas:</b> sesión iniciada como <u>${esc(usuario.name)}</u>. ` +
            'Acá se muestran sólo los programas de tus materias.';
        mostrar(banner, true);
    } else {
        mostrar(banner, false);
    }
}

// ================= LOGIN =================

async function login(evento) {
    evento.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;
    try {
        const datos = await api('/login', { method: 'POST', json: { email, password } });
        guardarSesion(datos.token);
        usuario = sesionActual();
        $('password').value = '';
        showToast('¡Sesión iniciada!', 'success');
        aplicarRol();
        await Promise.all([cargarProgramas(), cargarAsignaciones()]);
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

function logout() {
    cerrarSesion();
    location.reload();
}

// ================= LISTADO =================

async function cargarProgramas() {
    try {
        programas = await api('/programas');
    } catch (err) {
        programas = [];
        showToast(err.message, 'danger');
    }
    actualizarFiltros();
    aplicarFiltros();
}

function opciones(select, valores, etiquetaTodos) {
    const actual = select.value;
    select.innerHTML = `<option value="">${esc(etiquetaTodos)}</option>` +
        valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (valores.map(String).includes(actual)) select.value = actual;
}

function actualizarFiltros() {
    const unicos = (campo) => [...new Set(programas.map((p) => p[campo]).filter(Boolean))];
    opciones($('filtroMateria'), unicos('materia').sort((a, b) => a.localeCompare(b, 'es')), 'Todas las materias');
    opciones($('filtroCurso'), unicos('curso').sort(compararCursos), 'Todos los cursos');
    opciones($('filtroAnio'), unicos('year').sort((a, b) => b - a), 'Todos los años');
}

function aplicarFiltros() {
    const texto = $('busqueda').value.trim().toLowerCase();
    const materia = $('filtroMateria').value;
    const curso = $('filtroCurso').value;
    const anio = $('filtroAnio').value;

    const filtrados = programas.filter((p) => {
        if (materia && p.materia !== materia) return false;
        if (curso && p.curso !== curso) return false;
        if (anio && String(p.year) !== anio) return false;
        if (texto) {
            const enTexto = [p.title, p.materia, p.curso, p.profesor].some((v) => String(v || '').toLowerCase().includes(texto));
            if (!enTexto) return false;
        }
        return true;
    });
    render(filtrados);
}

function render(lista) {
    const contenedor = $('lista');

    if (lista.length === 0) {
        const msg = programas.length === 0 && usuario?.role === 'teacher'
            ? 'Todavía no hay programas de tus materias. Podés cargar el primero con el formulario de arriba.'
            : 'No se encontraron programas de examen.';
        contenedor.innerHTML = `<div class="alert-custom">${esc(msg)}</div>`;
        return;
    }

    const porAnio = new Map();
    for (const p of lista) {
        const y = p.year || 'Sin año';
        if (!porAnio.has(y)) porAnio.set(y, []);
        porAnio.get(y).push(p);
    }

    const anios = [...porAnio.keys()].sort((a, b) => b - a);
    contenedor.innerHTML = anios.map((anio, i) => {
        const items = porAnio.get(anio).slice().sort((a, b) => compararCursos(a.curso, b.curso) || a.materia.localeCompare(b.materia, 'es'));
        return `
        <details class="sub-collapsible bloque-anio" ${i === 0 ? 'open' : ''}>
            <summary>
                <span>📅 Programas del año <b>${esc(anio)}</b></span>
                <span class="coverage-badge coverage-high badge-chico">${items.length} cargado(s)</span>
            </summary>
            <div class="bloque-contenido">
                ${items.map(tarjeta).join('')}
            </div>
        </details>`;
    }).join('');
}

function tarjeta(p) {
    const borrar = usuario?.role === 'advisor'
        ? `<button type="button" class="btn-delete" data-accion="eliminar" data-id="${esc(p.id)}">🗑️ Eliminar</button>`
        : '';
    return `
    <div class="card">
        <div class="card-info">
            <b>${esc(p.title)}</b>
            ${esc(p.materia)} — Curso: ${esc(p.curso)}<br>
            <small>Docente: ${esc(p.profesor || 'Sin datos')} | Fecha: ${esc(p.fecha || 'Sin fecha')}</small>
        </div>
        <div class="card-actions">
            <button type="button" class="btn-ver" data-accion="ver" data-id="${esc(p.id)}">👁️ Ver PDF</button>
            ${borrar}
        </div>
    </div>`;
}

// ================= VISOR =================

function verPrograma(id) {
    const p = programas.find((x) => String(x.id) === String(id));
    const url = urlPdfSegura(p?.file_url);
    if (!url) {
        showToast('El archivo no tiene una dirección válida', 'danger');
        return;
    }
    $('tituloVisor').textContent = `Visualizando: ${p.title}`;
    $('visorPDF').src = url;
    mostrar($('seccionVisor'), true);
    $('seccionVisor').scrollIntoView({ behavior: 'smooth' });
}

function cerrarVisor() {
    mostrar($('seccionVisor'), false);
    $('visorPDF').removeAttribute('src');
}

// ================= ELIMINAR =================

async function eliminarPrograma(id) {
    const p = programas.find((x) => String(x.id) === String(id));
    if (!p || !confirm(`¿Eliminar "${p.title}" (${p.materia} — ${p.curso})? También se borra el archivo.`)) return;
    try {
        await api(`/programas/${encodeURIComponent(id)}`, { method: 'DELETE' });
        showToast('Programa eliminado', 'success');
        await Promise.all([cargarProgramas(), cargarAsignaciones()]);
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ================= SUBIDA =================

async function cargarAsignaciones() {
    if (!(usuario?.role === 'teacher' || usuario?.role === 'advisor')) return;
    const anio = Number($('anio').value) || config.anioLectivo;
    let datos;
    try {
        datos = await api(`/asignaciones/mias?anio=${anio}`);
    } catch (err) {
        showToast(err.message, 'danger');
        return;
    }
    asignaciones = datos.asignaciones;

    const aviso = $('avisoSinAsignaciones');
    if (asignaciones.length === 0) {
        aviso.innerHTML = usuario.role === 'teacher'
            ? `Tu cuenta no tiene materias asociadas${datos.docente ? ` (figurás como <b>${esc(datos.docente)}</b>)` : ''}. ` +
              'Pedile a la asesora que revise cómo está escrito tu nombre en la lista de asignaciones.'
            : 'No hay asignaciones cargadas. Generá el archivo con el importador de horarios.';
        mostrar(aviso, true);
        mostrar($('formSubida'), false);
        return;
    }
    mostrar(aviso, false);
    mostrar($('formSubida'), true);

    const select = $('asignacion');
    const elegido = select.value;
    const porCurso = new Map();
    for (const a of asignaciones) {
        if (!porCurso.has(a.curso)) porCurso.set(a.curso, []);
        porCurso.get(a.curso).push(a);
    }
    const cursos = [...porCurso.keys()].sort(compararCursos);
    select.innerHTML = '<option value="">Elegí curso y materia…</option>' + cursos.map((c) => {
        const items = porCurso.get(c).sort((a, b) => a.materia.localeCompare(b.materia, 'es'));
        return `<optgroup label="${esc(c)}${items[0].turno ? ' — ' + esc(items[0].turno) : ''}">` +
            items.map((a) => `<option value="${esc(a.id)}">${esc(a.materia)}${a.programa ? ' ✓ cargado' : ''}</option>`).join('') +
            '</optgroup>';
    }).join('');
    if (asignaciones.some((a) => a.id === elegido)) select.value = elegido;
    mostrarInfoAsignacion();
}

function mostrarInfoAsignacion() {
    const a = asignaciones.find((x) => x.id === $('asignacion').value);
    const info = $('infoAsignacion');
    if (!a) {
        info.textContent = '';
        return;
    }
    let html = `Docentes: <b>${esc(a.docentes.join(' / ') || 'sin datos')}</b>`;
    if (a.programa) {
        html += `<br><span class="texto-aviso">Ya hay un programa cargado para ${esc($('anio').value)} ` +
            `("${esc(a.programa.title)}", ${esc(a.programa.fecha)}). Si subís otro, lo reemplaza.</span>`;
    }
    if (!a.requiere) html += '<br><small>Esta materia está marcada como "no requiere programa".</small>';
    info.innerHTML = html;
}

async function subir(evento) {
    evento.preventDefault();
    const asignacionId = $('asignacion').value;
    const anio = $('anio').value;
    const archivo = $('pdf').files[0];

    if (!asignacionId) return showToast('Elegí el curso y la materia', 'danger');
    if (!archivo) return showToast('Elegí el archivo PDF', 'danger');
    if (!/\.pdf$/i.test(archivo.name) && archivo.type !== 'application/pdf') return showToast('El archivo tiene que ser un PDF', 'danger');
    if (archivo.size > config.maxPdfMb * 1024 * 1024) return showToast(`El PDF supera los ${config.maxPdfMb} MB`, 'danger');

    const a = asignaciones.find((x) => x.id === asignacionId);
    if (a?.programa && !confirm(`Ya hay un programa de ${a.materia} (${a.curso}) para ${anio}. ¿Reemplazarlo?`)) return;

    const datos = new FormData();
    datos.append('asignacion_id', asignacionId);
    datos.append('anio', anio);
    datos.append('titulo', $('titulo').value.trim());
    datos.append('pdf', archivo);

    const boton = $('btnSubir');
    boton.disabled = true;
    boton.textContent = 'Subiendo…';
    try {
        const r = await api('/programas/subir', { method: 'POST', body: datos });
        showToast(r.reemplazado ? 'Programa reemplazado' : '¡Programa subido!', 'success');
        if (r.aviso) showToast(r.aviso, 'warning', 8000);
        $('titulo').value = '';
        $('pdf').value = '';
        await Promise.all([cargarProgramas(), cargarAsignaciones()]);
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        boton.disabled = false;
        boton.textContent = 'Guardar programa';
    }
}

// ================= INICIO =================

function conectarEventos() {
    $('btnToggleLogin').addEventListener('click', () => {
        const zona = $('zonaLogin');
        mostrar(zona, zona.classList.contains('hidden'));
        if (!zona.classList.contains('hidden')) $('email').focus();
    });
    $('btnLogout').addEventListener('click', logout);
    $('formLogin').addEventListener('submit', login);
    $('btnVerPassword').addEventListener('click', () => {
        const input = $('password');
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    $('btnCerrarVisor').addEventListener('click', cerrarVisor);
    $('formSubida').addEventListener('submit', subir);
    $('asignacion').addEventListener('change', mostrarInfoAsignacion);
    $('anio').addEventListener('change', cargarAsignaciones);

    $('busqueda').addEventListener('input', aplicarFiltros);
    for (const id of ['filtroMateria', 'filtroCurso', 'filtroAnio']) $(id).addEventListener('change', aplicarFiltros);

    // Un solo listener para los botones de todas las tarjetas
    $('lista').addEventListener('click', (e) => {
        const boton = e.target.closest('button[data-accion]');
        if (!boton) return;
        if (boton.dataset.accion === 'ver') verPrograma(boton.dataset.id);
        if (boton.dataset.accion === 'eliminar') eliminarPrograma(boton.dataset.id);
    });
}

async function init() {
    conectarEventos();
    mostrarAvisoPendiente();
    try {
        config = await api('/config');
    } catch {
        /* se usan los valores por defecto */
    }
    $('anio').value = config.anioLectivo;
    $('maxPdf').textContent = `(máximo ${config.maxPdfMb} MB)`;

    usuario = sesionActual();
    aplicarRol();
    await Promise.all([cargarProgramas(), cargarAsignaciones()]);
}

init();
