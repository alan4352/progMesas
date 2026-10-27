// Arma la carpeta del sitio estático (demo para GitHub Pages).
//
// Uso:  node demo/construir_sitio.js [carpeta de salida]   (por defecto: _site)
// Necesita las dependencias de backend/ instaladas (cd backend && npm ci).

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.resolve(process.argv[2] || path.join(RAIZ, '_site'));

fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });

// Páginas: se agrega demo.js justo después de common.js (antes de app.js / dashboard.js)
function copiarPagina(origen, destino, rutaDemo) {
    const html = fs.readFileSync(path.join(RAIZ, origen), 'utf-8');
    const etiqueta = /<script src="(?:frontend\/)?common\.js"><\/script>/;
    if (!etiqueta.test(html)) throw new Error(`No encontré common.js en ${origen}`);
    const conDemo = html.replace(etiqueta, (m) => `${m}\n    <script src="${rutaDemo}"></script>`);
    fs.mkdirSync(path.dirname(path.join(SALIDA, destino)), { recursive: true });
    fs.writeFileSync(path.join(SALIDA, destino), conDemo);
}

fs.cpSync(path.join(RAIZ, 'frontend'), path.join(SALIDA, 'frontend'), { recursive: true });
copiarPagina('index.html', 'index.html', 'demo/demo.js');
copiarPagina('frontend/dashboard.html', 'frontend/dashboard.html', '../demo/demo.js');

// Política de privacidad (la pide la pantalla de consentimiento de Google OAuth)
fs.copyFileSync(path.join(RAIZ, 'privacidad.html'), path.join(SALIDA, 'privacidad.html'));

// Script de la demo y datos exportados de la base
fs.mkdirSync(path.join(SALIDA, 'demo'), { recursive: true });
fs.copyFileSync(path.join(RAIZ, 'demo', 'demo.js'), path.join(SALIDA, 'demo', 'demo.js'));

// La exportación toca la base (migraciones): se trabaja sobre una copia
const copiaDb = path.join(RAIZ, 'backend', 'database.sqlite');
const respaldo = fs.readFileSync(copiaDb);
try {
    execFileSync(process.execPath, [path.join(RAIZ, 'demo', 'exportar_datos.js'), path.join(SALIDA, 'demo', 'datos.json')], {
        stdio: 'inherit'
    });
} finally {
    fs.writeFileSync(copiaDb, respaldo);
    for (const extra of ['-wal', '-shm', '-journal']) fs.rmSync(copiaDb + extra, { force: true });
}

// PDF guardados localmente
const uploads = path.join(RAIZ, 'backend', 'uploads');
fs.mkdirSync(path.join(SALIDA, 'uploads'), { recursive: true });
for (const f of fs.readdirSync(uploads)) {
    if (/\.pdf$/i.test(f)) fs.copyFileSync(path.join(uploads, f), path.join(SALIDA, 'uploads', f));
}

// GitHub Pages no debe procesar el sitio con Jekyll
fs.writeFileSync(path.join(SALIDA, '.nojekyll'), '');
console.log(`[Demo] Sitio listo en ${SALIDA}`);
