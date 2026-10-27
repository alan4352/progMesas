# ProgMesas — guía de uso y puesta en marcha

1. [Cómo usar la página](#1-cómo-usar-la-página)
2. [Instalación en el servidor de la escuela](#2-instalación-en-el-servidor-de-la-escuela)
3. [Lista oficial de asignaciones](#3-lista-oficial-de-asignaciones)
4. [Usuarios e ingreso](#4-usuarios-e-ingreso)
5. [Google Drive](#5-google-drive)
6. [Pruebas automáticas](#6-pruebas-automáticas)
7. [Archivos que ya no se usan](#7-archivos-que-ya-no-se-usan)

---

## 1. Cómo usar la página

Para probar sin instalar nada está la demo: <https://alan4352.github.io/progMesas/>
(cuentas de prueba en la barra amarilla de arriba; lo que se cambia queda sólo en tu navegador).

### Alumnos, familias y visitantes

No hace falta iniciar sesión.

1. Entrá a la página principal: aparecen los programas cargados, agrupados por año. Están **todos los años**, así que
   también se encuentran los programas de materias que se deben de años anteriores.
2. Para encontrar uno, escribí en el buscador (materia, curso, docente o título) o usá los filtros de **materia**, **curso** y **año**.
3. Tocá **Ver PDF** para abrir el programa en el visor de la página. **Cerrar visor** lo oculta.
4. **Compartir:** lo que filtrás queda en la dirección de la página. **Copiar enlace a esta búsqueda** copia esa dirección,
   por ejemplo para mandar al grupo de un curso el enlace con sus programas.
5. **Descargar todos los de un curso:** elegí el curso (y, si querés, el año) y tocá **Descargar los programas de … (ZIP)**.
   El ZIP trae una carpeta por año.

### Docentes

**La primera vez:**

1. Iniciá sesión (en la escuela, desde el sistema principal; en modo prueba, con **Acceso docentes**).
2. Si tu nombre en el sistema principal coincide con el de la lista de horarios, la cuenta se vincula sola y ya podés
   cargar programas: no tenés que hacer nada más.
3. Si no coincide, aparece **Elegí tu nombre en la lista de docentes**: escribí tu apellido, elegí tu nombre tal como
   figura en los horarios y tocá **Confirmar**. Queda vinculado en el momento, sin esperar a nadie.
   Si te equivocaste, pedile a la asesora que lo corrija.

**Cargar un programa:**

1. En **Subir programa de examen**, elegí en **Curso y materia** el curso y la materia. Sólo aparecen las que tenés asignadas;
   si das la misma materia en varios cursos, cada curso aparece por separado y lleva su propio programa.
2. Revisá el **Año lectivo**.
3. El **Título** es opcional: si lo dejás vacío se completa solo (por ejemplo, "Programa de Matemática - 2° 1° - 2026").
4. Elegí el **archivo PDF** (hasta 10 MB) y tocá **Guardar programa**.

Arriba del formulario aparece la **fecha límite** de entrega del año, si la asesora la fijó, y cuántos días faltan.

**Usar el programa del año anterior:** si para ese curso y materia hay un programa de un año anterior, al elegirlo aparece
**Usar el de 2025** (o el año que corresponda). Tocalo y queda cargado para este año sin volver a subir el PDF; si el título
mencionaba el año anterior, se cambia solo.

**Reemplazar un programa:** subí el nuevo PDF para el mismo curso, materia y año. La página avisa que ya hay uno cargado
y, si confirmás, lo reemplaza. La versión anterior **no se borra**: queda en **Versiones anteriores**.

**Versiones anteriores:** en la lista, los programas que se reemplazaron muestran **Versiones anteriores (n)**. Al tocarlo
aparecen las versiones viejas, con quién las reemplazó y cuándo, y se pueden abrir.

En la lista de abajo ves sólo los programas de tus materias.

### Asesora pedagógica

Tiene todo lo de los docentes, para **cualquier** curso y materia, y además puede **Eliminar** programas desde la lista.
El botón **Dashboard Asesora** abre el panel de control:

- **Año** (arriba a la derecha): elegí el año lectivo que querés controlar.
- **Avisos** (arriba de todo): si Google Drive no está disponible o hay programas guardados en el servidor y no en Drive.
  Esos programas pasan solos a Drive cuando vuelve (al arrancar el servidor y cada 6 horas); **Pasar a Drive ahora** lo hace en el momento.
- **Cobertura general:** programas requeridos, entregados, pendientes y porcentaje.
- **Fecha límite:** elegí la fecha y tocá **Guardar fecha** (**Quitar** la borra). Cada año tiene la suya. Los docentes la ven
  al cargar; cuando pasa, los pendientes se muestran como **Atrasados** y se cuentan los entregados **fuera de término**.
- **Notificaciones y alertas:** asignaciones para revisar en la planilla, los primeros pendientes y los
  **Programas sin asignación** (programas viejos que no coinciden con ninguna materia oficial): elegí a cuál corresponden
  y tocá **Vincular**.
- **Estado por curso:** avance de cada curso, con **Copiar enlace para alumnos** (los programas de ese curso, de todos los años)
  y **Descargar todo (ZIP)**.
- **Estado por docente:** avance de cada docente. A los que tienen pendientes y una cuenta con correo, **Enviar recordatorio**
  abre un correo ya escrito con lo que les falta y la fecha límite.
- **Programas pendientes:** lista filtrable por docente, materia y curso. **Descargar pendientes (CSV)** la baja para abrir con Excel
  y **Copiar correos de los docentes con pendientes** copia sus direcciones para escribirles a todos juntos.
- **Cuentas de docentes:**
  No hace falta aprobar a nadie: las cuentas ya vienen verificadas del sistema principal. Esta sección sirve para controlar
  y corregir con qué nombre de la lista quedó cada uno.
  - *Entró pero no eligió su nombre:* podés escribirlo vos y tocar **Asignar**.
  - *Vinculados:* indica si se vinculó automáticamente, lo eligió el docente o lo corregiste vos.
    **Cambiar** corrige el nombre y **Desvincular** le quita la posibilidad de cargar programas.
- **Registro de actividad:** quién subió, reemplazó, reutilizó o eliminó programas, quién cambió vinculaciones o la fecha
  límite, y las tareas automáticas (copias de seguridad, paso a Drive). Se puede buscar por persona, materia, curso o acción.
- **Últimos programas cargados:** los más recientes del año, con su PDF.

### Preceptores y directivos

Con el botón del dashboard ven el mismo panel que la asesora, incluido el registro de actividad, pero sin poder modificar
nada (no fijan la fecha límite, no corrigen vinculaciones ni borran programas).

### Modo claro / oscuro

La página usa el modo de la computadora o el celular. El botón del sol / luna, arriba a la derecha, lo cambia y lo recuerda.

### Preguntas frecuentes

- **No aparece mi materia para cargar:** tu nombre no figura en esa materia en la lista oficial, o te vinculaste con otro nombre.
  Pedile a la asesora que lo revise.
- **"Tu cuenta todavía no está vinculada":** todavía no elegiste tu nombre en la lista; aparece arriba en la página principal.
- **Me vinculé con el nombre equivocado:** la asesora lo corrige desde **Cuentas de docentes** en el dashboard.
- **"El archivo no es un PDF válido":** el archivo está dañado o no es un PDF aunque termine en .pdf. Exportalo de nuevo como PDF.
- **"Se guardó en el servidor porque Google Drive no está disponible":** el programa quedó guardado igual y pasa solo a Drive
  cuando vuelve. Si el aviso sigue, hay que renovar el permiso de Drive (ver [Google Drive](#5-google-drive)).
- **Reemplacé un programa por error:** el anterior está en **Versiones anteriores**; se puede abrir y volver a subir.
- **¿Quién borró un programa?** Está en el **Registro de actividad** del dashboard.

---

## 2. Instalación en el servidor de la escuela

Render se usa sólo de forma temporal. Para la instalación definitiva en un servidor propio:

### Requisitos

- **Node.js 20 o superior** (<https://nodejs.org>) y **Git**.
- Que el servidor sea accesible desde la red de la escuela (o desde internet, si se quiere publicar afuera).

### Instalar

```
git clone https://github.com/alan4352/progMesas.git
cd progMesas
npm install
```

Copiá `.env.example` como `.env` y completalo. Lo mínimo:

```
JWT_SECRET=<valor largo y aleatorio>
AUTH_MODO=externo          # o "prueba" mientras no esté conectado el sistema principal
ANIO_LECTIVO=2026
PORT=3000
```

Para generar `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
Con `AUTH_MODO=externo` hay que completar también los datos `EXTERNO_*` del sistema principal (ver [Usuarios e ingreso](#4-usuarios-e-ingreso)).

Copiá `backend/oauth.json` y generá `backend/token.json` para Google Drive (ver [Google Drive](#5-google-drive)).

Comprobá que todo funcione y arrancá:

```
npm test
npm start
```

Abrí `http://<ip-del-servidor>:3000`.

### Dejarlo funcionando siempre

El servidor tiene que arrancar solo cuando se prende la máquina.

**Linux (systemd).** Creá `/etc/systemd/system/progmesas.service` (ajustá la carpeta y el usuario):

```
[Unit]
Description=ProgMesas
After=network.target

[Service]
WorkingDirectory=/opt/progMesas
ExecStart=/usr/bin/node backend/server.js
Restart=always
User=progmesas
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl enable --now progmesas
sudo systemctl status progmesas      # ver si está andando
journalctl -u progmesas -f           # ver los mensajes
```

**Windows.** Con [NSSM](https://nssm.cc): `nssm install ProgMesas`, en *Path* poné la ruta de `node.exe`,
en *Startup directory* la carpeta del proyecto y en *Arguments* `backend\server.js`. Después `nssm start ProgMesas`.

### Publicarlo con HTTPS (recomendado)

Si la página va a estar en un dominio (por ejemplo `programas.escuela.edu.ar`), conviene ponerla detrás de Nginx con un
certificado de Let's Encrypt. Ejemplo de Nginx:

```
server {
    server_name programas.escuela.edu.ar;
    client_max_body_size 12m;            # un poco más que MAX_PDF_MB
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Con un proxy adelante, agregá `TRUST_PROXY=1` al `.env` (si no, el límite de intentos de login bloquea a todos juntos).
El certificado se saca con `sudo certbot --nginx -d programas.escuela.edu.ar`.

### Copias de seguridad

**Automáticas:** agregá al `.env` la carpeta donde guardarlas (mejor en otro disco):

```
RESPALDOS_DIR=/var/respaldos/progmesas      # en Windows, por ejemplo D:\Respaldos\ProgMesas
RESPALDO_HORA=3                             # hora de la copia diaria (3 de la mañana)
RESPALDOS_CONSERVAR=14                      # cuántas copias guardar; las más viejas se borran
```

Con eso el servidor hace una copia por día, en una carpeta con la fecha y la hora, con:

- `database.sqlite` — programas, versiones, cuentas de docentes, fecha límite y registro de actividad
  (se copia de forma segura con el servidor andando);
- `uploads/` — PDF guardados en el servidor (los que están en Drive ya quedan en Drive);
- `asignaciones.xlsx` — la lista oficial.

Cada copia queda anotada en el **Registro de actividad** del dashboard.

**A mano**, en cualquier momento: `cd backend` y `node scripts/respaldo.js` (o `node scripts/respaldo.js <carpeta>`).

Además, guardá una vez en un lugar seguro `.env`, `backend/oauth.json` y `backend/token.json`, que no entran en la copia
porque tienen claves.

**Restaurar:** detené el servidor, copiá `database.sqlite`, `uploads/` y `asignaciones.xlsx` de la copia a `backend/`
(y `backend/data/` para la planilla; borrá antes `database.sqlite-wal` y `database.sqlite-shm` si existen),
y volvé a arrancarlo. Si se usa `DATOS_DIR`, la base y `uploads` van en esa carpeta.

### Actualizar a una versión nueva

```
git pull
npm install
npm test
sudo systemctl restart progmesas      # o reiniciar el servicio de Windows
```

---

## 3. Lista oficial de asignaciones

`backend/data/asignaciones.xlsx` es la lista de qué programa tiene que entregar cada curso (curso + materia + docentes).
El sistema controla las entregas con esa lista. Cada **curso + materia** es una asignación distinta: Matemática de 2° 1° y
Matemática de 3° 2° son dos programas diferentes, aunque los dé el mismo docente. Para regenerarla con horarios nuevos:

```
cd backend
node scripts/importar_horarios.js "ruta\Horarios_T.Mañana.xlsx" "ruta\Horarios_T.Tarde.xlsx"
```

Si `asignaciones.xlsx` ya existe, el importador no lo pisa: genera `asignaciones_importadas_<fecha>.xlsx` (con `--reemplazar` lo pisa).

Se puede editar con Excel: el servidor lo relee al guardarlo. Las filas en amarillo (columna *Revisar*) conviene controlarlas:
son docentes del contraturno que el importador ubicó por cercanía o materias sin docente.
Para que una materia no cuente como pendiente, poné `NO` en *Requiere programa*.

## 4. Usuarios e ingreso

ProgMesas forma parte de un sistema más grande: **los usuarios y el inicio de sesión vienen del sistema principal**.
Todo lo relacionado está en un solo archivo, `backend/auth.js`, y se configura en el `.env` con `AUTH_MODO`:

- `AUTH_MODO=prueba` (por defecto): login propio con cuentas de prueba (`prof@test.com` / `prof123`,
  `asesor@test.com` / `asesor123`, `alumno@test.com` / `alumno123`). Para crear más: `node scripts/usuarios.js ayuda`.
- `AUTH_MODO=externo`: el usuario llega con un token firmado (JWT) del sistema principal, en el link (`/?token=...`),
  en el encabezado `Authorization` o en una cookie. En `.env.example` están los datos a completar
  (clave para verificar el token, nombre de los campos y nombres de los roles).

Roles: **docente** (carga sus programas), **asesora** (todo), **consulta** (preceptor/directivo: ve el dashboard sin modificar nada)
y **alumno** (ve los programas).

### Vinculación de docentes

El sistema principal ya verifica las cuentas, pero no sabe qué materias dicta cada docente. Por eso cada cuenta se une
con un nombre de `asignaciones.xlsx`:

1. **Automática:** al entrar, si el nombre de la cuenta tiene las mismas palabras que **un solo** nombre de la lista
   (sin importar el orden ni los acentos: "Valeria Grimberg" = "Grimberg Valeria"), se vincula sola.
   Un apellido suelto, un nombre repetido o un nombre que ya usa otra cuenta no se vinculan solos.
2. **Elegida por el docente:** si no hubo coincidencia, el docente elige su nombre una vez y queda vinculado en el momento.
   No puede elegir un nombre que ya tiene otra cuenta.
3. **Corrección:** la asesora puede asignar, cambiar o desvincular nombres desde **Cuentas de docentes**.

Las solicitudes que habían quedado esperando aprobación con la versión anterior se confirman solas al arrancar el servidor.

### Probar el ingreso desde el sistema principal (modo externo)

Mientras no esté la conexión real, `scripts/token_prueba.js` hace de sistema principal: genera un token firmado como el que
mandaría y el enlace para entrar con esa identidad.

1. En el `.env`: `AUTH_MODO=externo` y `EXTERNO_JWT_SECRET=<una clave larga>` (en la escuela, la que comparta el sistema principal).
2. Arrancá el servidor y generá un token:

   ```
   cd backend
   node scripts/token_prueba.js --rol docente --nombre "Valeria Grimberg" --id 1234 --email vgrimberg@escuela.edu.ar
   ```

3. Abrí el enlace que muestra. Con ese nombre, el docente se vincula solo con "Grimberg Valeria".
   Probá también `--rol asesora`, `--rol preceptor` o `--rol alumno`.

### Qué hay que pedirle al equipo del sistema principal

Para conectar ProgMesas de verdad hacen falta estos datos (se cargan en el `.env`, sin tocar código):

| Dato | Variable |
|---|---|
| Cómo firma el token: clave compartida (HS256) o clave pública (RS256) | `EXTERNO_JWT_SECRET` o `EXTERNO_JWT_CLAVE_PUBLICA` |
| Cómo llega el token: en el enlace (`/?token=`), en el encabezado `Authorization` o en una cookie (¿cómo se llama?) | `EXTERNO_COOKIE` |
| Nombre del campo con el identificador único del usuario (por ejemplo `sub` o `usuario.id`) | `EXTERNO_CLAIM_ID` |
| Nombre del campo con el **nombre completo** (para la vinculación automática) | `EXTERNO_CLAIM_NOMBRE` |
| Nombre del campo con el rol, y cómo se llaman los roles (docente, asesora, preceptor, directivo, alumno) | `EXTERNO_CLAIM_ROL`, `ROL_*` |
| Nombre del campo con el correo (para los recordatorios) | `EXTERNO_CLAIM_EMAIL` |
| Dirección de la página de ingreso del sistema principal | `EXTERNO_LOGIN_URL` |

Las pruebas automáticas (`tests/externo.test.js`) ya comprueban este modo: roles, campos anidados, token en cookie,
vinculación automática y rechazo de tokens con otra firma, vencidos, sin firma o con roles desconocidos.

## 5. Google Drive

Los PDF se guardan en Google Drive, en carpetas Año / Curso / Materia. Si Drive no está disponible, se guardan en
`backend/uploads` y el dashboard lo avisa. Cuando Drive vuelve, esos PDF **pasan solos a Drive** (al arrancar el servidor y
cada 6 horas) y se borran del servidor; la asesora también puede hacerlo con **Pasar a Drive ahora**.

### Autorizar o renovar el permiso

```
cd backend
node scripts/autorizar_drive.js
```

Abrí el enlace que aparece, iniciá sesión con la cuenta de la escuela, aceptá y pegá la dirección a la que te redirige.
Se guarda `backend/token.json`; después reiniciá el servidor.

Para que no venza cada 7 días, en Google Cloud Console → *Pantalla de consentimiento de OAuth* pasá la app de
"Testing" a "En producción". La política de privacidad y las condiciones del servicio ya están publicadas
(`/privacidad.html` y `/terminos.html`).

### Probar el permiso reducido (`drive.file`)

Hoy la app pide acceso a **todo** el Drive (`drive`), un permiso que Google considera "restringido": para pasar la app
a producción sin advertencias pide una evaluación de seguridad. Con `drive.file` la app sólo ve los archivos que crea
ella misma, y Google no lo considera restringido. Para probarlo:

1. En Google Cloud Console → *Pantalla de consentimiento de OAuth* → *Acceso a los datos*, agregá el permiso
   `.../auth/drive.file` (y quitá `.../auth/drive`).
2. En el `.env` agregá `DRIVE_ALCANCE=archivos`.
3. Volvé a autorizar: `cd backend` y `node scripts/autorizar_drive.js` (muestra qué permiso pide).
4. Reiniciá el servidor y subí un programa de prueba. En "Mi unidad" tiene que aparecer la carpeta
   **ProgMesas - Programas de examen** con las subcarpetas Año / Curso / Materia (el nombre se cambia con `DRIVE_CARPETA_NOMBRE`).

Con este permiso la app no ve la carpeta anterior: los programas viejos siguen abriéndose, pero si se reemplazan o eliminan
desde la página, su archivo en Drive hay que borrarlo a mano. Para volver atrás: `DRIVE_ALCANCE=completo` y volver a autorizar.

## 6. Pruebas automáticas

```
npm test             # API y funciones: 51 pruebas en unos segundos
npm run test:ui      # interfaz en un navegador y accesibilidad: 11 pruebas
```

- **`npm test`** prueba utilidades, contraseñas, roles y la planilla de asignaciones, y la API completa con cada rol:
  ingreso y límite de intentos, permisos, vinculación de docentes (elegida y automática), subida, reemplazo y versiones,
  reutilizar, subidas simultáneas de varios cursos, fecha límite, registro, cobertura, ZIP por curso, copias de seguridad,
  el modo externo y Google Drive **simulado** (subida, Drive caído, paso a Drive cuando vuelve y borrado).
- **`npm run test:ui`** abre la página en un navegador (Chromium) y la recorre como visitante, asesora, docente, preceptor
  y alumno; prueba el modo oscuro y el celular, y revisa la accesibilidad (WCAG 2.1 AA) en los dos modos.
  La primera vez hay que instalar el navegador: `npx playwright install chromium`.

Usan una **copia temporal** de la base y nunca tocan Google Drive, así que no modifican los datos reales.

En GitHub se corren solas en cada cambio; si alguna falla, la demo no se publica.

## 7. Archivos que ya no se usan

Se pueden borrar: `backend/excel.js`, `backend/procesar_profesores.js`, `backend/exportar_profesores_excel.js`,
`backend/profesores_extraidos.json`, `backend/profesores_extraidos.xlsx`, `backend/horarios_extraidos.json`,
`backend/horarios_profes_2026.json`, `horarios_profes_2026.json`, `backend/materias_profesores_editable.xlsx`,
`backend/clave.json` (cuenta de servicio sin uso) y `backend/programas.json` (ya migrado a la base).
