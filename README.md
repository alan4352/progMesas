# ProgMesas

Sistema web para subir, controlar y consultar los **programas de examen** de una escuela secundaria técnica.
Los docentes cargan el PDF de cada materia que dictan, los alumnos lo consultan y la asesoría pedagógica ve qué programas faltan.

Proyecto de Práctica Profesional — Escuela Técnica N.º 2 "Independencia".

- **Demo:** <https://alan4352.github.io/progMesas/>
- **Política de privacidad:** <https://alan4352.github.io/progMesas/privacidad.html>
- **Condiciones del servicio:** <https://alan4352.github.io/progMesas/terminos.html>
- **Guía de uso para cada rol e instalación en el servidor de la escuela:** [LEEME.md](LEEME.md)

## Funciones

| Rol | Puede |
|---|---|
| **Visitante / alumno** | Ver y buscar todos los programas cargados (por materia, curso, año o docente) y abrir el PDF en el visor. |
| **Docente** | Subir el programa de sus materias (sólo las asignadas a su nombre) y reemplazarlo por una versión nueva. |
| **Asesora** | Subir para cualquier materia, eliminar programas, confirmar las cuentas de docentes y usar el dashboard de control. |
| **Consulta** (preceptor, directivo) | Ver el dashboard sin modificar nada. |

**Dashboard de asesoría**

- Cobertura del año: programas requeridos, entregados, pendientes y porcentaje.
- Avance por curso y por docente.
- Lista de pendientes con filtros y exportación a CSV.
- Aviso cuando Google Drive no está disponible o hay asignaciones para revisar.
- Confirmación, corrección y desvinculación de las cuentas de docentes.
- Vinculación manual de programas viejos que no coinciden con ninguna materia oficial.

**Interfaz**

- Modo claro y modo oscuro: sigue la preferencia del sistema y se puede cambiar con el botón del encabezado (se recuerda).
- Paleta institucional (bordó y dorado) definida con variables en `frontend/styles.css`.
- Íconos SVG propios, sin librerías externas.
- Adaptada a celulares.

## Cómo funciona

- **Integrado a un sistema más grande** — los usuarios y el inicio de sesión vienen del sistema principal
  (token firmado). Mientras tanto se puede usar un login de prueba (`AUTH_MODO=prueba`).
- **Vinculación de docentes** — la primera vez que entra, cada docente elige su nombre en la lista oficial y la asesora lo confirma.
- **Lista oficial de asignaciones** — `backend/data/asignaciones.xlsx` indica qué programa tiene que entregar cada curso
  (curso + materia + docentes). Se genera a partir de las planillas de horarios y la asesoría la puede editar con Excel:
  el servidor la relee al guardarla.
- **Cobertura exacta** — cada programa queda asociado a una asignación, así el control no depende de cómo se escribió la materia.
- **Almacenamiento** — los PDF se guardan en Google Drive (carpetas Año / Curso / Materia). Si Drive no está disponible,
  se guardan en el servidor (`backend/uploads` o `DATOS_DIR/uploads`) y el dashboard lo avisa.

## Tecnologías

- **Backend:** Node.js 20+, Express 5, SQLite (better-sqlite3), Multer, JWT, Google Drive API, SheetJS (xlsx 0.20, desde el sitio oficial de SheetJS)
- **Frontend:** HTML, CSS y JavaScript sin frameworks
- **Despliegue:** GitHub Pages (demo) y Render (sistema completo)

## Instalación

Requisitos: Node.js 20 o superior.

```bash
npm install        # en la raíz: instala también las dependencias de backend/
```

Creá el archivo `.env` en la raíz del proyecto a partir de `.env.example` y completá `JWT_SECRET` con un valor aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Iniciá el servidor y abrí <http://localhost:3000>:

```bash
npm start
```

### Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `JWT_SECRET` | **Obligatoria** en modo prueba. Clave para firmar las sesiones (32 caracteres o más). |
| `AUTH_MODO` | `prueba` (login propio, por defecto) o `externo` (token del sistema principal). |
| `ANIO_LECTIVO` | Año que usan por defecto el formulario y el dashboard. |
| `PORT` | Puerto del servidor (3000 por defecto). |
| `MAX_PDF_MB` | Tamaño máximo de cada PDF (10 por defecto). |
| `TRUST_PROXY` | `1` si el servidor está detrás de un proxy (Render). Hace que el límite de intentos de login use la IP real. |
| `DATOS_DIR` | Carpeta para la base y los PDF locales, por ejemplo un disco persistente. La primera vez se copian ahí los del repositorio. |
| `GOOGLE_OAUTH_JSON`, `GOOGLE_TOKEN_JSON` | Contenido de `backend/oauth.json` y `backend/token.json`, para usar Drive en un hosting sin esos archivos. |
| `DRIVE_CARPETA_RAIZ` | ID de la carpeta de Drive donde se guardan los programas. |
| `DRIVE_ALCANCE` | `completo` (permiso `drive`, por defecto) o `archivos` (permiso `drive.file`, carpeta propia de la app). Ver [LEEME.md](LEEME.md#5-google-drive). |
| `DRIVE_CARPETA_NOMBRE` | Nombre de la carpeta propia con `DRIVE_ALCANCE=archivos`. |
| `DRIVE_DESACTIVADO` | `1` guarda todo en el servidor aunque haya credenciales (lo usan las pruebas). |
| `CORS_ORIGIN` | Otros dominios que pueden usar la API (vacío = sólo el mismo servidor). |
| `EXTERNO_*`, `ROL_*` | Datos del sistema principal para `AUTH_MODO=externo` (ver `.env.example`). |

### Google Drive (opcional)

Colocá las credenciales OAuth de Google en `backend/oauth.json` y autorizá la cuenta de la escuela:

```bash
cd backend
node scripts/autorizar_drive.js
```

Mientras la app de Google esté en modo "Testing", el permiso vence a los 7 días. Para evitarlo, pasala a
"En producción" en la pantalla de consentimiento de OAuth (usa las páginas de privacidad y condiciones de arriba).

## Pruebas automáticas

```bash
npm test
```

27 pruebas con `node:test` (sin dependencias extra): utilidades, contraseñas, roles, planilla de asignaciones y la API
completa contra un servidor real que usa una copia temporal de la base y no toca Google Drive.
GitHub Actions las corre en cada cambio (`.github/workflows/pruebas.yml`, Node 20 y 22) y antes de publicar la demo:
si alguna falla, no se publica.

## Administración

```bash
cd backend

# Importar las planillas de horarios (una hoja por curso) → data/asignaciones.xlsx
node scripts/importar_horarios.js "Horarios_T.Mañana.xlsx" "Horarios_T.Tarde.xlsx"

# Cuentas de prueba (sólo con AUTH_MODO=prueba)
node scripts/usuarios.js listar
node scripts/usuarios.js crear docente@test.com teacher "Nombre Apellido"
```

Con `AUTH_MODO=prueba` se crean cuentas de prueba (`prof@test.com`, `asesor@test.com`, `alumno@test.com`).
En la escuela se usa `AUTH_MODO=externo`. Más detalles en [LEEME.md](LEEME.md).

## Despliegue

### Demo en GitHub Pages

<https://alan4352.github.io/progMesas/>

GitHub Pages sólo sirve archivos estáticos, así que la demo no usa el servidor: `demo/demo.js` atiende las
mismas rutas `/api/...` dentro del navegador, con las mismas reglas de permisos, a partir de los datos de la
base y de `asignaciones.xlsx`. Los cambios (subir, borrar, confirmar docentes) quedan sólo en el navegador de
quien la usa y se pueden restablecer. Se publica sola en cada push a `main`
(`.github/workflows/pages.yml`), junto con las páginas de privacidad y condiciones.

Cuentas de la demo: `asesor@test.com` / `asesor123`, `prof@test.com` / `prof123`,
`docente2@test.com` / `docente123` (docente sin vincular), `preceptor@test.com` / `preceptor123`, `alumno@test.com` / `alumno123`.

Para probarla en la compu: `npm install`, después `node demo/construir_sitio.js` y servir la carpeta `_site`.

### Servidor de la escuela (instalación definitiva)

Los pasos (servicio que arranca solo en Linux o Windows, HTTPS con Nginx, copias de seguridad y actualizaciones)
están en [LEEME.md](LEEME.md#2-instalación-en-el-servidor-de-la-escuela).

### Sistema completo en Render (temporal)

Render se usa mientras tanto, hasta instalarlo en el servidor de la escuela. `render.yaml` configura el servidor real: en render.com → **New → Blueprint** → elegir este repositorio.
Render vuelve a desplegar en cada push a `main`.

Si el servicio se crea a mano: Build Command `npm install`, Start Command `npm start`, y en **Environment**
cargar `JWT_SECRET`, `AUTH_MODO=prueba`, `ANIO_LECTIVO` y `TRUST_PROXY=1`. Para Drive, agregar
`GOOGLE_OAUTH_JSON` y `GOOGLE_TOKEN_JSON` con el contenido de esos archivos.

En el plan gratis el disco se borra al reiniciar: los PDF guardados en el servidor se pierden. Para conservarlos
hace falta Google Drive o un disco persistente (`DATOS_DIR`, ver `render.yaml`).

## Estructura

```
├── index.html               Página principal (listado, login y subida)
├── privacidad.html          Política de privacidad (pantalla de consentimiento de Google OAuth)
├── terminos.html            Condiciones del servicio
├── package.json             Arranque desde la raíz (instala backend/ con postinstall)
├── render.yaml              Despliegue en Render
├── .github/workflows/       Pruebas automáticas y publicación de la demo en GitHub Pages
├── tests/                   Pruebas automáticas (node:test)
├── demo/                    Demo estática: datos exportados y API simulada en el navegador
├── frontend/
│   ├── styles.css           Estilos y paleta (modo claro y oscuro)
│   ├── tema.js              Cambio de modo claro / oscuro
│   ├── common.js            Utilidades compartidas, sesión e íconos
│   ├── app.js               Página principal
│   └── dashboard.html/.js   Dashboard de la asesora
└── backend/
    ├── server.js            API y servidor de archivos
    ├── config.js            Configuración (.env y variables de entorno)
    ├── db.js                Base SQLite y migraciones
    ├── auth.js              Identidad del usuario (sistema principal o login de prueba)
    ├── docentes.js          Vinculación cuenta ↔ nombre en la lista oficial
    ├── asignaciones.js      Lectura de la lista oficial
    ├── store.js             Programas cargados
    ├── almacenamiento.js    Guardado de PDF (Drive o servidor)
    ├── drive.js             Google Drive
    ├── lib/                 Importador de horarios y utilidades
    ├── scripts/             Herramientas de línea de comandos
    ├── data/                asignaciones.xlsx
    └── uploads/             PDF guardados localmente
```

## Seguridad

- El token del sistema principal se verifica con su firma; en modo prueba, contraseñas con scrypt y límite de
  10 intentos por IP y correo cada 15 minutos (con `TRUST_PROXY`, usando la IP real detrás de Render).
- Un docente sólo puede cargar programas de sus materias, y sólo después de que la asesora confirme su cuenta.
- Sólo se aceptan PDF válidos (se revisa el contenido, no sólo la extensión; hasta 10 MB por defecto).
- Todo el contenido cargado por usuarios se escapa antes de mostrarse, con una política CSP que bloquea scripts externos.
- La exportación a CSV neutraliza textos que Excel interpretaría como fórmulas.
- Las credenciales (`.env`, `oauth.json`, `token.json`, `clave.json`) están excluidas del repositorio; en un hosting
  se pasan como variables de entorno.
- Dependencias sin vulnerabilidades conocidas (`npm audit`, octubre de 2026).

## Historial de cambios

### 27 de octubre de 2026 (tarde)

- Pruebas automáticas (`npm test`): 27 pruebas de utilidades y de la API con cada rol, corridas por GitHub Actions
  en cada cambio y antes de publicar la demo.
- Opción `DRIVE_ALCANCE=archivos` para probar el permiso reducido `drive.file` de Google Drive (carpeta propia de la app).
- `DRIVE_DESACTIVADO` para guardar todo en el servidor aunque haya credenciales.
- LEEME: guía de uso para cada rol, preguntas frecuentes e instalación en el servidor de la escuela
  (systemd / NSSM, Nginx con HTTPS, copias de seguridad y actualizaciones).

### 27 de octubre de 2026 (mañana)

- Demo pública en GitHub Pages con la API simulada en el navegador y publicación automática.
- Despliegue del sistema completo en Render (`render.yaml`, `DATOS_DIR`, credenciales de Drive por variables de entorno).
- Páginas de política de privacidad y condiciones del servicio, enlazadas desde el pie.
- Íconos SVG en lugar de emojis.
- Nueva paleta institucional y modo oscuro.
- Mejoras de seguridad: dependencias actualizadas (Express, Multer y SheetJS sin vulnerabilidades conocidas),
  `TRUST_PROXY` para el límite de intentos detrás de un proxy, limpieza del registro de intentos y CSV sin fórmulas.
- Arreglos: los filtros ya no se aplastan en el celular y el botón de ver contraseña queda centrado.
