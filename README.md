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
| **Visitante / alumno** | Ver y buscar los programas de todos los años (por materia, curso, año o docente), abrirlos en el visor, compartir el enlace de una búsqueda y descargar todos los de un curso en un ZIP. |
| **Docente** | Subir el programa de sus materias, reemplazarlo (la versión anterior se conserva), reutilizar el del año anterior y ver la fecha límite. |
| **Asesora** | Todo lo anterior para cualquier materia, eliminar programas, corregir la vinculación de los docentes, fijar la fecha límite y usar el dashboard. |
| **Consulta** (preceptor, directivo) | Ver el dashboard y el registro de actividad sin modificar nada. |

**Programas**

- **Historial de versiones:** al reemplazar un programa, la versión anterior queda guardada con su PDF, quién la reemplazó y cuándo.
- **Reutilizar:** si un programa no cambió, se usa el del año anterior para el mismo curso y materia sin volver a subirlo
  (el archivo se comparte, no se duplica).
- **Enlaces por curso:** los filtros quedan en la dirección de la página (`?curso=2° 1°&anio=2026`), así se comparte el
  enlace de un curso. Sin año, muestra **todos los años**: sirve para alumnos que deben materias de años anteriores.
- **ZIP por curso:** todos los programas de un curso en un archivo, ordenados en carpetas por año.

**Dashboard de asesoría**

- Cobertura del año: programas requeridos, entregados, pendientes y porcentaje.
- **Fecha límite** de entrega por año: muestra los atrasados y los entregados fuera de término.
- Avance por curso (con enlace para alumnos y ZIP) y por docente (con **recordatorio por correo** a quien tiene pendientes).
- Lista de pendientes con filtros, exportación a CSV y copia de los correos de los docentes con pendientes.
- **Registro de actividad:** quién subió, reemplazó, reutilizó o eliminó programas, quién cambió vinculaciones o la
  fecha límite, y las tareas automáticas.
- Avisos cuando Google Drive no está disponible o hay programas guardados en el servidor, con el botón **Pasar a Drive ahora**.
- Control y corrección de la vinculación de las cuentas de docentes.
- Vinculación manual de programas viejos que no coinciden con ninguna materia oficial.

**Interfaz**

- Mismo diseño que el sistema principal de la escuela ([PROJECT_ASIST](https://github.com/moshi-azz/PROJECT_ASIST)):
  fondo bordó con el escudo de marca de agua, menú lateral beige con el escudo, el perfil y las secciones,
  encabezado con degradé bordó, tarjetas beige con borde bordó y encabezado degradé, tarjetas de estadísticas
  y tablas con cabecera bordó. En el celular, el menú se abre con el botón **Menú**.
- Modo oscuro como variante del mismo diseño: sigue la preferencia del sistema y se cambia desde el menú (se recuerda).
- Colores en variables al principio de `frontend/styles.css`.
- Íconos SVG propios, sin librerías externas.
- Adaptada a celulares y revisada con axe-core (WCAG 2.1 AA) en los dos modos.

## Cómo funciona

- **Integrado a un sistema más grande** — los usuarios y el inicio de sesión vienen del sistema principal
  (token firmado). Mientras tanto se puede usar un login de prueba (`AUTH_MODO=prueba`).
- **Vinculación de docentes** — las cuentas vienen verificadas del sistema principal. Si el nombre de la cuenta coincide con
  uno de la lista oficial, se vincula solo; si no, el docente lo elige una vez y ya puede cargar. No hace falta aprobación.
- **Lista oficial de asignaciones** — `backend/data/asignaciones.xlsx` indica qué programa tiene que entregar cada curso
  (curso + materia + docentes). Se genera a partir de las planillas de horarios y la asesoría la puede editar con Excel:
  el servidor la relee al guardarla.
- **Cobertura exacta** — cada programa queda asociado a una asignación (curso + materia), así el control no depende de
  cómo se escribió la materia, y Matemática de 2° 1° y de 3° 2° son programas distintos.
- **Almacenamiento** — los PDF se guardan en Google Drive (carpetas Año / Curso / Materia). Si Drive no está disponible,
  se guardan en el servidor y, cuando Drive vuelve, **pasan solos a Drive** (al arrancar y cada 6 horas).
- **Copias de seguridad** — con `RESPALDOS_DIR`, el servidor guarda todos los días la base, los PDF del servidor y la
  planilla, y conserva las últimas copias.

## Tecnologías

- **Backend:** Node.js 20+, Express 5, SQLite (better-sqlite3), Multer, JWT, Google Drive API, SheetJS (xlsx 0.20, desde el sitio oficial de SheetJS)
- **Frontend:** HTML, CSS y JavaScript sin frameworks
- **Pruebas:** `node:test`; interfaz con Playwright y axe-core
- **Despliegue:** GitHub Pages (demo), Render (temporal) y servidor de la escuela

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
| `TRUST_PROXY` | `1` si el servidor está detrás de un proxy (Nginx, Render). Hace que el límite de intentos de login use la IP real. |
| `DATOS_DIR` | Carpeta para la base y los PDF locales, por ejemplo un disco persistente. La primera vez se copian ahí los del repositorio. |
| `RESPALDOS_DIR` | Carpeta donde el servidor guarda una copia de seguridad por día (vacío = sin copias automáticas). |
| `RESPALDO_HORA` | Hora de la copia diaria (0 a 23; 3 por defecto). |
| `RESPALDOS_CONSERVAR` | Cuántas copias se conservan (14 por defecto); las más viejas se borran. |
| `GOOGLE_OAUTH_JSON`, `GOOGLE_TOKEN_JSON` | Contenido de `backend/oauth.json` y `backend/token.json`, para usar Drive en un hosting sin esos archivos. |
| `DRIVE_CARPETA_RAIZ` | ID de la carpeta de Drive donde se guardan los programas. |
| `DRIVE_ALCANCE` | `completo` (permiso `drive`, por defecto) o `archivos` (permiso `drive.file`, carpeta propia de la app). Ver [LEEME.md](LEEME.md#5-google-drive). |
| `DRIVE_CARPETA_NOMBRE` | Nombre de la carpeta propia con `DRIVE_ALCANCE=archivos`. |
| `DRIVE_DESACTIVADO` | `1` guarda todo en el servidor aunque haya credenciales. |
| `DRIVE_SIMULADO` | **Sólo para las pruebas:** carpeta donde un Drive simulado guarda los archivos. |
| `CORS_ORIGIN` | Otros dominios que pueden usar la API (vacío = sólo el mismo servidor). |
| `EXTERNO_*`, `ROL_*` | Datos del sistema principal para `AUTH_MODO=externo` (ver `.env.example` y [LEEME.md](LEEME.md#4-usuarios-e-ingreso)). |

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
npm test             # API y funciones: 51 pruebas, unos segundos
npm run test:ui      # interfaz en un navegador y accesibilidad: 11 pruebas
```

- **API** (`tests/*.test.js`): utilidades, contraseñas, roles, planilla de asignaciones, ingreso y límite de intentos,
  permisos de cada rol, vinculación de docentes, subida, reemplazo y versiones, reutilizar, fecha límite, registro,
  ZIP por curso, copias de seguridad, modo externo (tokens del sistema principal) y Google Drive **simulado**
  (subida, caída de Drive, paso a Drive cuando vuelve y borrado).
- **Interfaz** (`tests/interfaz.ui.js`): recorre la página en Chromium como visitante, asesora, docente, preceptor y alumno,
  prueba el modo oscuro y el celular, y revisa la accesibilidad con axe-core en los dos modos.
  La primera vez hay que instalar el navegador: `npx playwright install chromium`.

Todas usan el servidor real sobre una **copia temporal** de la base y nunca tocan Google Drive ni los datos del proyecto.
GitHub Actions las corre en cada cambio (`.github/workflows/pruebas.yml`, Node 20 y 22) y antes de publicar la demo:
si alguna falla, no se publica.

## Administración

```bash
cd backend

# Importar las planillas de horarios (una hoja por curso) → data/asignaciones.xlsx
node scripts/importar_horarios.js "Horarios_T.Mañana.xlsx" "Horarios_T.Tarde.xlsx"

# Copia de seguridad ahora (base, PDF del servidor y planilla)
node scripts/respaldo.js D:\Respaldos\ProgMesas

# Simular el sistema principal (AUTH_MODO=externo): genera un token y el enlace para entrar
node scripts/token_prueba.js --rol docente --nombre "Valeria Grimberg" --id 1234

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
base y de `asignaciones.xlsx`. Los cambios (subir, borrar, vincular docentes, fecha límite) quedan sólo en el navegador
de quien la usa y se pueden restablecer. Se publica sola en cada push a `main` (`.github/workflows/pages.yml`),
junto con las páginas de privacidad y condiciones. En la demo, el ZIP de un curso no incluye los PDF que están en Google Drive.

Cuentas de la demo: `asesor@test.com` / `asesor123`, `prof@test.com` / `prof123`,
`docente2@test.com` / `docente123` (elige su nombre), `docente3@test.com` / `docente123` (se vincula solo), `preceptor@test.com` / `preceptor123`, `alumno@test.com` / `alumno123`.

Para probarla en la compu: `npm install`, después `node demo/construir_sitio.js` y servir la carpeta `_site`.

### Servidor de la escuela (instalación definitiva)

Los pasos (servicio que arranca solo en Linux o Windows, HTTPS con Nginx, copias de seguridad y actualizaciones)
están en [LEEME.md](LEEME.md#2-instalación-en-el-servidor-de-la-escuela).

### Sistema completo en Render (temporal)

Render se usa mientras tanto, hasta instalarlo en el servidor de la escuela. `render.yaml` configura el servidor real:
en render.com → **New → Blueprint** → elegir este repositorio. Render vuelve a desplegar en cada push a `main`.

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
├── package.json             Arranque desde la raíz (instala backend/ con postinstall) y scripts de pruebas
├── render.yaml              Despliegue en Render
├── .github/workflows/       Pruebas automáticas y publicación de la demo en GitHub Pages
├── tests/                   Pruebas automáticas: API (*.test.js), interfaz (interfaz.ui.js) y servidor de prueba
├── demo/                    Demo estática: datos exportados y API simulada en el navegador
├── frontend/
│   ├── styles.css           Estilos y paleta (modo claro y oscuro)
│   ├── tema.js              Cambio de modo claro / oscuro
│   ├── marco.js             Menú lateral (en el celular) y fecha del encabezado
│   ├── img/escudo.png       Escudo de la escuela (menú y marca de agua)
│   ├── common.js            Utilidades compartidas, sesión, íconos, descargas y fechas
│   ├── app.js               Página principal
│   └── dashboard.html/.js   Dashboard de la asesora
└── backend/
    ├── server.js            API y servidor de archivos
    ├── config.js            Configuración (.env y variables de entorno)
    ├── db.js                Base SQLite y migraciones
    ├── auth.js              Identidad del usuario (sistema principal o login de prueba)
    ├── docentes.js          Vinculación cuenta ↔ nombre en la lista oficial
    ├── asignaciones.js      Lectura de la lista oficial
    ├── store.js             Programas cargados y versiones anteriores
    ├── registro.js          Registro de actividad
    ├── ajustes.js           Fecha límite por año
    ├── almacenamiento.js    Guardado de PDF (Drive o servidor) y paso a Drive
    ├── drive.js             Google Drive
    ├── respaldos.js         Copias de seguridad
    ├── lib/                 Importador de horarios, ZIP, Drive simulado y utilidades
    ├── scripts/             Herramientas de línea de comandos
    ├── data/                asignaciones.xlsx
    └── uploads/             PDF guardados localmente
```

## Seguridad

- El token del sistema principal se verifica con su firma (se rechazan tokens sin firma, vencidos o con roles desconocidos);
  en modo prueba, contraseñas con scrypt y límite de 10 intentos por IP y correo cada 15 minutos
  (con `TRUST_PROXY`, usando la IP real detrás de un proxy).
- Un docente sólo puede cargar programas de las materias del nombre con el que está vinculado, y no puede tomar un nombre
  que ya usa otra cuenta. El historial de versiones lo ven sólo la asesora y el docente de la materia.
- Sólo se aceptan PDF válidos (se revisa el contenido, no sólo la extensión; hasta 10 MB por defecto).
- Todo el contenido cargado por usuarios se escapa antes de mostrarse, con una política CSP que bloquea scripts externos.
- Registro de actividad de todas las acciones que modifican datos.
- La exportación a CSV neutraliza textos que Excel interpretaría como fórmulas.
- Las credenciales (`.env`, `oauth.json`, `token.json`, `clave.json`) están excluidas del repositorio; en un hosting
  se pasan como variables de entorno.
- Dependencias sin vulnerabilidades conocidas (`npm audit`, octubre de 2026).

## Historial de cambios

### 27/10/2026 — Diseño del sistema principal

- Las páginas usan el mismo diseño que el sistema principal de la escuela (PROJECT_ASIST): menú lateral beige con
  escudo, perfil y secciones; encabezado con degradé bordó; fondo bordó con el escudo de marca de agua; tarjetas beige
  con encabezado degradé; tarjetas de estadísticas con ícono; tablas con cabecera bordó.
- En el celular: encabezado con escudo y botón **Menú** que abre el menú lateral (se cierra con Escape o tocando afuera).
- El botón de modo oscuro y los enlaces a privacidad y condiciones pasan al menú lateral.
- Enlace "Saltar al contenido" para teclado y lectores de pantalla.

### 27/10/2026 — Mejoras de uso, control y mantenimiento

- Historial de versiones de cada programa (la versión reemplazada ya no se borra).
- Reutilizar el programa del año anterior para el mismo curso y materia.
- Fecha límite de entrega por año, con atrasados y entregados fuera de término en el dashboard.
- Recordatorio por correo a los docentes con pendientes y copia de sus correos.
- Enlaces por curso (filtros en la dirección, con todos los años) y descarga de los programas de un curso en un ZIP.
- Registro de actividad en el dashboard.
- Los PDF guardados en el servidor pasan solos a Google Drive cuando vuelve a estar disponible (o con un botón).
- Copias de seguridad diarias (`RESPALDOS_DIR`) y `scripts/respaldo.js`.
- Modo externo: `scripts/token_prueba.js` para simular el sistema principal, y pruebas automáticas del ingreso con token.
- Pruebas: 51 de API (con Google Drive simulado) y 11 de interfaz y accesibilidad con Playwright y axe-core,
  todas en GitHub Actions antes de publicar.
- Accesibilidad: mejor contraste de los colores de estado y barras de avance con nombre para lectores de pantalla.
- Arreglo: las copias de seguridad hechas en el mismo segundo no se borraban al pasar el límite.

### 27/10/2026 — Vinculación de docentes sin aprobación

- La asesora ya no tiene que aprobar a los docentes (las cuentas vienen verificadas del sistema principal):
  - vinculación automática cuando el nombre de la cuenta coincide con uno solo de la lista de horarios;
  - si no coincide, el docente elige su nombre y puede cargar en el momento;
  - la asesora sigue pudiendo asignar, cambiar o desvincular nombres; las solicitudes pendientes se confirmaron solas.
- Demo: cuenta `docente3@test.com` para ver la vinculación automática.
- Política de privacidad y condiciones del servicio actualizadas.

### 27/10/2026 — Pruebas automáticas y guía de uso

- Pruebas automáticas (`npm test`) de utilidades y de la API con cada rol, corridas por GitHub Actions
  en cada cambio y antes de publicar la demo.
- Opción `DRIVE_ALCANCE=archivos` para probar el permiso reducido `drive.file` de Google Drive (carpeta propia de la app).
- `DRIVE_DESACTIVADO` para guardar todo en el servidor aunque haya credenciales.
- LEEME: guía de uso para cada rol, preguntas frecuentes e instalación en el servidor de la escuela
  (systemd / NSSM, Nginx con HTTPS, copias de seguridad y actualizaciones).

### 27/10/2026 — Publicación, diseño y seguridad

- Demo pública en GitHub Pages con la API simulada en el navegador y publicación automática.
- Despliegue del sistema completo en Render (`render.yaml`, `DATOS_DIR`, credenciales de Drive por variables de entorno).
- Páginas de política de privacidad y condiciones del servicio, enlazadas desde el pie.
- Íconos SVG en lugar de emojis.
- Nueva paleta institucional y modo oscuro.
- Mejoras de seguridad: dependencias actualizadas (Express, Multer y SheetJS sin vulnerabilidades conocidas),
  `TRUST_PROXY` para el límite de intentos detrás de un proxy, limpieza del registro de intentos y CSV sin fórmulas.
- Arreglos: los filtros ya no se aplastan en el celular y el botón de ver contraseña queda centrado.
