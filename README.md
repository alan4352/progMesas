# ProgMesas

Sistema web para subir, controlar y consultar los **programas de examen** de una escuela secundaria técnica.
Los docentes cargan el PDF de cada materia que dictan, los alumnos lo consultan y la asesoría pedagógica ve qué programas faltan.

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
- Vinculación manual de programas viejos que no coinciden con ninguna materia oficial.

## Cómo funciona

- **Integrado a un sistema más grande** — los usuarios y el inicio de sesión vienen del sistema principal
  (token firmado). Mientras tanto se puede usar un login de prueba (`AUTH_MODO=prueba`).
- **Vinculación de docentes** — la primera vez que entra, cada docente elige su nombre en la lista oficial y la asesora lo confirma.
- **Lista oficial de asignaciones** — `backend/data/asignaciones.xlsx` indica qué programa tiene que entregar cada curso
  (curso + materia + docentes). Se genera a partir de las planillas de horarios y la asesoría la puede editar con Excel:
  el servidor la relee al guardarla.
- **Cobertura exacta** — cada programa queda asociado a una asignación, así el control no depende de cómo se escribió la materia.
- **Almacenamiento** — los PDF se guardan en Google Drive (carpetas Año / Curso / Materia). Si Drive no está disponible,
  se guardan en `backend/uploads` y el dashboard lo avisa.

## Tecnologías

- **Backend:** Node.js, Express 5, SQLite (better-sqlite3), Multer, JWT, Google Drive API, SheetJS (xlsx)
- **Frontend:** HTML, CSS y JavaScript sin frameworks

## Instalación

Requisitos: Node.js 20 o superior.

```bash
cd backend
npm install
```

Creá el archivo `.env` en la raíz del proyecto a partir de `.env.example` y completá `JWT_SECRET` con un valor aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Iniciá el servidor y abrí <http://localhost:3000>:

```bash
npm start
```

### Google Drive (opcional)

Colocá las credenciales OAuth de Google en `backend/oauth.json` y autorizá la cuenta:

```bash
node scripts/autorizar_drive.js
```

## Administración

```bash
# Importar las planillas de horarios (una hoja por curso) → backend/data/asignaciones.xlsx
node scripts/importar_horarios.js "Horarios_T.Mañana.xlsx" "Horarios_T.Tarde.xlsx"

# Cuentas de prueba (sólo con AUTH_MODO=prueba)
node scripts/usuarios.js listar
node scripts/usuarios.js crear docente@test.com teacher "Nombre Apellido"
```

Con `AUTH_MODO=prueba` se crean cuentas de prueba (`prof@test.com`, `asesor@test.com`, `alumno@test.com`).
En la escuela se usa `AUTH_MODO=externo`. Más detalles en [LEEME.md](LEEME.md).

## Estructura

```
├── index.html               Página principal (listado, login y subida)
├── frontend/                Estilos, scripts y dashboard de la asesora
└── backend/
    ├── server.js            API y servidor de archivos
    ├── config.js            Configuración (.env)
    ├── db.js                Base SQLite y migraciones
    ├── auth.js              Identidad del usuario (sistema principal o login de prueba)
    ├── docentes.js          Vinculación cuenta ↔ nombre en la lista oficial
    ├── asignaciones.js      Lectura de la lista oficial
    ├── store.js             Programas cargados
    ├── drive.js             Google Drive
    ├── lib/                 Importador de horarios y utilidades
    ├── scripts/             Herramientas de línea de comandos
    ├── data/                asignaciones.xlsx
    └── uploads/             PDF guardados localmente
```

## Seguridad

- El token del sistema principal se verifica con su firma; en modo prueba, contraseñas con scrypt y límite de intentos.
- Un docente sólo puede cargar programas de sus materias, y sólo después de que la asesora confirme su cuenta.
- Sólo se aceptan PDF válidos (hasta 10 MB por defecto).
- Todo el contenido cargado por usuarios se escapa antes de mostrarse, con una política CSP que bloquea scripts externos.
- Las credenciales (`.env`, `oauth.json`, `token.json`, `clave.json`) están excluidas del repositorio.
