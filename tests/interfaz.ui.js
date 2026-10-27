// Pruebas de la interfaz en un navegador real (Chromium, con Playwright) y revisión de accesibilidad (axe-core).
// Recorren la página como lo haría cada persona: visitante, asesora, docente y preceptor.
//
// Ejecutar con:  npm run test:ui
// La primera vez hay que instalar el navegador:  npx playwright install chromium

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { iniciarServidor, PDF } from './servidor.js';
import { leerZip } from '../backend/lib/zip.js';

const axe = createRequire(import.meta.url)('axe-core');

let srv;
let navegador;
const archivoPdf = path.join(os.tmpdir(), `progmesas-ui-${process.pid}.pdf`);

before(async () => {
    fs.writeFileSync(archivoPdf, PDF);
    srv = await iniciarServidor({
        preparar: `
            const { crearUsuario } = await import('./backend/usuarios.js');
            crearUsuario({ email: 'nuevo@test.com', contrasena: 'nuevo123', rol: 'teacher', nombre: 'Docente Nuevo' });
            crearUsuario({ email: 'preceptor@test.com', contrasena: 'preceptor123', rol: 'viewer', nombre: 'Preceptor' });
        `
    });
    navegador = await chromium.launch();
});

after(async () => {
    await navegador?.close();
    srv?.cerrar();
    fs.rmSync(archivoPdf, { force: true });
});

/** Página nueva que junta los errores de JavaScript para fallar si aparece alguno. */
async function nuevaPagina({ ancho = 1280, alto = 900, tema = 'light' } = {}) {
    const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema, acceptDownloads: true });
    const pagina = await contexto.newPage();
    pagina.errores = [];
    pagina.on('pageerror', (e) => pagina.errores.push(e.message));
    pagina.on('console', (m) => m.type() === 'error' && pagina.errores.push(m.text()));
    pagina.on('dialog', (d) => d.accept());
    return pagina;
}

async function ingresar(pagina, email, password) {
    await pagina.goto(srv.base + '/');
    // En el celular las opciones están en el menú lateral
    if (await pagina.locator('#btnMenu').isVisible()) await pagina.click('#btnMenu');
    await pagina.click('#btnToggleLogin');
    await pagina.fill('#email', email);
    await pagina.fill('#password', password);
    await pagina.click('#formLogin button[type=submit]');
    await pagina.waitForSelector('#btnLogout:not(.hidden)', { state: 'attached' });
}

/** Revisa accesibilidad (WCAG 2.1 A y AA) y devuelve los problemas graves. */
async function problemasDeAccesibilidad(pagina) {
    await pagina.evaluate(axe.source);
    const r = await pagina.evaluate(() =>
        window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    return r.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact))
        .map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

// ================= VISITANTE =================

test('visitante: ve los programas, filtra por curso con un enlace y descarga el ZIP', async () => {
    const pg = await nuevaPagina();
    await pg.goto(srv.base + '/?curso=' + encodeURIComponent('2° 1°'));
    await pg.waitForSelector('#lista .card');
    assert.equal(await pg.inputValue('#filtroCurso'), '2° 1°', 'el filtro viene de la dirección');
    const tarjetas = await pg.locator('#lista .card').count();
    assert.ok(tarjetas >= 1);
    assert.ok(await pg.locator('#lista .card').allInnerTexts().then((t) => t.every((x) => x.includes('2° 1°'))));

    await pg.selectOption('#filtroAnio', '2026');
    assert.match(pg.url(), /anio=2026/, 'el año queda en la dirección para compartir');
    assert.ok(await pg.locator('button[data-accion="copiar-enlace"]').isVisible());

    const [descarga] = await Promise.all([pg.waitForEvent('download'), pg.click('button[data-accion="zip-curso"]')]);
    const zip = leerZip(fs.readFileSync(await descarga.path()));
    assert.ok(zip.some((a) => a.nombre.startsWith('2026/') && a.nombre.endsWith('.pdf')));

    await pg.click('#lista button[data-accion="ver"] >> nth=0');
    assert.ok(await pg.locator('#seccionVisor').isVisible());
    assert.deepEqual(pg.errores, []);
});

// ================= ASESORA =================

test('asesora: sube, reemplaza y ve las versiones anteriores', async () => {
    const pg = await nuevaPagina();
    await ingresar(pg, 'asesor@test.com', 'asesor123');
    for (const titulo of ['Primera versión', 'Segunda versión']) {
        await pg.selectOption('#asignacion', '1-1_geografia');
        await pg.fill('#titulo', titulo);
        await pg.setInputFiles('#pdf', archivoPdf);
        await pg.click('#btnSubir');
        await pg.waitForSelector(`#lista .card:has-text("${titulo}")`);
    }
    await pg.fill('#busqueda', 'Segunda versión');
    const boton = pg.locator('button[data-accion="versiones"]');
    assert.match(await boton.innerText(), /Versiones anteriores \(1\)/);
    await boton.click();
    await pg.waitForSelector('.lista-versiones .fila-version');
    assert.match(await pg.locator('.lista-versiones').innerText(), /Primera versión/);
    assert.equal(await boton.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(pg.errores, []);
});

test('asesora: reutiliza el programa del año anterior', async () => {
    const asesora = await srv.ingresar('asesor@test.com', 'asesor123');
    await srv.subir(asesora, { asignacion: '3-2_ingles', anio: 2025, titulo: 'Inglés 3° 2° - 2025' });

    const pg = await nuevaPagina();
    await ingresar(pg, 'asesor@test.com', 'asesor123');
    await pg.selectOption('#asignacion', '3-2_ingles');
    await pg.click('button[data-accion="reutilizar"]');
    await pg.waitForSelector('#lista .card:has-text("Inglés 3° 2° - 2026")');
    assert.deepEqual(pg.errores, []);
});

test('asesora: fecha límite, registro, enlace del curso y recordatorio en el dashboard', async () => {
    const pg = await nuevaPagina();
    await ingresar(pg, 'asesor@test.com', 'asesor123');
    await pg.click('#btnDashboard');
    await pg.waitForSelector('#dashboardResumen .dash-card');

    await pg.fill('#campoFechaLimite', '2026-01-15');
    await pg.click('button[data-accion="guardar-fecha"]');
    await pg.waitForSelector('#fechaLimite:has-text("15/1/2026")');
    assert.match(await pg.locator('#dashboardResumen').innerText(), /ATRASADOS|Atrasados/);

    await pg.click('#seccionRegistro summary');
    await pg.waitForSelector('#registro tbody tr');
    assert.match(await pg.locator('#registro').innerText(), /Cambió la fecha límite/);
    await pg.fill('#busquedaRegistro', 'reutilizó');
    assert.match(await pg.locator('#registro').innerText(), /Reutilizó un programa/);

    assert.ok(await pg.locator('#estadoCursos button[data-accion="enlace-curso"]').first().isVisible());

    // Recordatorio por correo para un docente vinculado con programas pendientes
    await pg.click('summary:has-text("Estado por docente")');
    await pg.fill('#busquedaDocente', 'Fernandez Lucrecia');
    const recordatorio = pg.locator('#estadoProfesores a[href^="mailto:"]');
    const href = decodeURIComponent(await recordatorio.getAttribute('href'));
    assert.match(href, /^mailto:prof@test\.com\?subject=/);
    assert.match(href, /15\/1\/2026/);
    assert.deepEqual(pg.errores, []);
});

// ================= DOCENTE =================

test('docente nuevo: elige su nombre y puede cargar enseguida', async () => {
    const pg = await nuevaPagina();
    await ingresar(pg, 'nuevo@test.com', 'nuevo123');
    assert.ok(await pg.locator('#zonaVinculo').isVisible());
    assert.ok(!(await pg.locator('#zonaSubida').isVisible()));
    await pg.fill('#nombreDocente', 'Mattiassi');
    await pg.click('#formVinculo button[type=submit]');
    await pg.waitForSelector('#zonaSubida:not(.hidden)');
    assert.ok((await pg.locator('#asignacion option').count()) > 1);
    assert.match(await pg.locator('#bannerDocente').innerText(), /Mattiassi/);
    assert.deepEqual(pg.errores, []);
});

test('preceptor: entra al dashboard pero no puede modificar', async () => {
    const pg = await nuevaPagina();
    await ingresar(pg, 'preceptor@test.com', 'preceptor123');
    await pg.click('#btnDashboard');
    await pg.waitForSelector('#dashboardResumen .dash-card');
    assert.equal(await pg.locator('#campoFechaLimite').count(), 0);
    assert.equal(await pg.locator('button[data-accion="desvincular-docente"]').count(), 0);
    assert.deepEqual(pg.errores, []);
});

test('alumno: si entra al dashboard lo devuelve al inicio', async () => {
    const pg = await nuevaPagina();
    await ingresar(pg, 'alumno@test.com', 'alumno123');
    await pg.goto(srv.base + '/frontend/dashboard.html');
    await pg.waitForURL(srv.base + '/');
    await pg.waitForSelector('.toast');
});

// ================= MODO OSCURO Y CELULAR =================

test('el modo oscuro sigue al sistema y el botón lo cambia y lo recuerda', async () => {
    const pg = await nuevaPagina({ tema: 'dark' });
    await pg.goto(srv.base + '/');
    assert.equal(await pg.evaluate(() => document.documentElement.dataset.tema), 'oscuro');
    await pg.click('.btn-tema');
    assert.equal(await pg.evaluate(() => document.documentElement.dataset.tema), 'claro');
    await pg.goto(srv.base + '/privacidad.html');
    assert.equal(await pg.evaluate(() => document.documentElement.dataset.tema), 'claro', 'se recuerda entre páginas');
});

test('en el celular no hay desplazamiento horizontal', async () => {
    const pg = await nuevaPagina({ ancho: 375, alto: 800 });
    await ingresar(pg, 'asesor@test.com', 'asesor123');
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'inicio');
    // En el celular el menú está cerrado: se abre con "Menú", se cierra con Escape
    assert.equal(await pg.locator('#btnDashboard').isVisible(), false);
    await pg.click('#btnMenu');
    assert.equal(await pg.getAttribute('#btnMenu', 'aria-expanded'), 'true');
    await pg.keyboard.press('Escape');
    assert.equal(await pg.getAttribute('#btnMenu', 'aria-expanded'), 'false');
    await pg.click('#btnMenu');
    await pg.click('#btnDashboard');
    await pg.waitForSelector('#dashboardResumen .dash-card');
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'dashboard');
});

// ================= ACCESIBILIDAD =================

for (const tema of ['light', 'dark']) {
    test(`accesibilidad (modo ${tema === 'light' ? 'claro' : 'oscuro'}): sin problemas graves`, async () => {
        const pg = await nuevaPagina({ tema });
        const problemas = [];

        await pg.goto(srv.base + '/');
        await pg.waitForSelector('#lista .card');
        problemas.push(...(await problemasDeAccesibilidad(pg)).map((p) => `inicio: ${p}`));

        await pg.click('#btnToggleLogin');
        problemas.push(...(await problemasDeAccesibilidad(pg)).map((p) => `login: ${p}`));

        await ingresar(pg, 'asesor@test.com', 'asesor123');
        await pg.selectOption('#asignacion', '3-2_ingles');
        problemas.push(...(await problemasDeAccesibilidad(pg)).map((p) => `asesora: ${p}`));

        await pg.click('#btnDashboard');
        await pg.waitForSelector('#dashboardResumen .dash-card');
        await pg.click('#seccionRegistro summary');
        await pg.waitForSelector('#registro table');
        problemas.push(...(await problemasDeAccesibilidad(pg)).map((p) => `dashboard: ${p}`));

        for (const pagina of ['/privacidad.html', '/terminos.html']) {
            await pg.goto(srv.base + pagina);
            problemas.push(...(await problemasDeAccesibilidad(pg)).map((p) => `${pagina}: ${p}`));
        }
        assert.deepEqual(problemas, []);
    });
}
