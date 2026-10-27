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

1. Entrá a la página principal: aparecen los programas cargados, agrupados por año.
2. Para encontrar uno, escribí en el buscador (materia, curso, docente o título) o usá los filtros de **materia**, **curso** y **año**.
3. Tocá **Ver PDF** para abrir el programa en el visor de la página. **Cerrar visor** lo oculta.

### Docentes

**La primera vez:**

1. Iniciá sesión (en la escuela, desde el sistema principal; en modo prueba, con **Acceso docentes**).
2. Aparece **Elegí tu nombre en la lista de docentes**: escribí tu apellido, elegí tu nombre tal como figura en los horarios y tocá **Enviar**.
3. Queda pendiente: la asesora tiene que confirmarlo. Hasta entonces no podés cargar programas.
   Si te equivocaste de nombre, tocá **Elegir otro nombre**.

**Cargar un programa** (una vez confirmada tu cuenta):

1. En **Subir programa de examen**, elegí en **Curso y materia** el curso y la materia. Sólo aparecen las que tenés asignadas;
   si das la misma materia en varios cursos, cada curso aparece por separado y lleva su propio programa.
2. Revisá el **Año lectivo**.
3. El **Título** es opcional: si lo dejás vacío se completa solo (por ejemplo, "Programa de Matemática - 2° 1° - 2026").
4. Elegí el **archivo PDF** (hasta 10 MB) y tocá **Guardar programa**.

**Reemplazar un programa:** subí el nuevo PDF para el mismo curso, materia y año. La página avisa que ya hay uno cargado
y, si confirmás, lo reemplaza (el anterior se borra).

En la lista de abajo ves sólo los programas de tus materias.

### Asesora pedagógica

Tiene todo lo de los docentes, para **cualquier** curso y materia, y además puede **Eliminar** programas desde la lista.
El botón **Dashboard Asesora** abre el panel de control:

- **Año** (arriba a la derecha): elegí el año lectivo que querés controlar.
- **Cobertura general:** programas requeridos, entregados, pendientes y porcentaje.
- **Notificaciones y alertas:** avisos de Google Drive, asignaciones para revisar en la planilla, los primeros pendientes y los
  **Programas sin asignación** (programas viejos que no coinciden con ninguna materia oficial): elegí a cuál corresponden
  y tocá **Vincular**.
- **Estado por curso** y **Estado por docente:** avance de cada uno.
- **Programas pendientes:** lista filtrable por docente, materia y curso. **Descargar pendientes (CSV)** la baja para abrir con Excel.
- **Cuentas de docentes:**
  - *Esperando confirmación:* revisá el nombre que eligió el docente (podés corregirlo) y tocá **Confirmar**, o **Rechazar**.
  - *Entró pero no eligió su nombre:* podés escribirlo vos y tocar **Asignar**.
  - *Vinculado:* **Cambiar** corrige el nombre y **Desvincular** le quita la posibilidad de cargar programas.
- **Últimos programas cargados:** los más recientes del año, con su PDF.

### Preceptores y directivos

Con el botón del dashboard ven el mismo panel que la asesora, pero sin poder modificar nada
(no confirman cuentas ni borran programas).

### Modo claro / oscuro

La página usa el modo de la computadora o el celular. El botón del sol / luna, arriba a la derecha, lo cambia y lo recuerda.

### Preguntas frecuentes

- **No aparece mi materia para cargar:** tu nombre no figura en esa materia en la lista oficial, o te vinculaste con otro nombre.
  Pedile a la asesora que lo revise.
- **"Tu cuenta todavía no está vinculada":** falta que la asesora confirme tu nombre.
- **"El archivo no es un PDF válido":** el archivo está dañado o no es un PDF aunque termine en .pdf. Exportalo de nuevo como PDF.
- **"Se guardó en el servidor porque Google Drive no está disponible":** el programa quedó guardado igual; hay que
  renovar el permiso de Drive (ver [Google Drive](#5-google-drive)).

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

Guardá periódicamente (por ejemplo, todas las noches):

- `backend/database.sqlite` — programas cargados y cuentas de docentes. Para copiarla con el servidor andando:
  `sqlite3 backend/database.sqlite ".backup respaldo.sqlite"` (o detené el servidor y copiá el archivo).
- `backend/uploads/` — PDF guardados en el servidor (los que están en Drive ya quedan en Drive).
- `backend/data/asignaciones.xlsx`, `.env`, `backend/oauth.json` y `backend/token.json`.

Si se usa `DATOS_DIR`, la base y `uploads` están en esa carpeta.

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

El sistema principal identifica a cada docente con un usuario único, pero no sabe qué materias dicta. Por eso:

1. La primera vez que un docente entra, elige su nombre tal como figura en `asignaciones.xlsx`.
2. La asesora lo confirma en el dashboard (sección **Cuentas de docentes**). Recién ahí el docente puede cargar programas.
3. La asesora también puede asignar, corregir o desvincular nombres desde esa sección.

## 5. Google Drive

Los PDF se guardan en Google Drive, en carpetas Año / Curso / Materia. Si Drive no está disponible, se guardan en
`backend/uploads` y el dashboard lo avisa.

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
npm test
```

Corren 27 pruebas en unos segundos: funciones de normalización, contraseñas, roles y planilla de asignaciones, y la API
completa con cada rol (ingreso y límite de intentos, permisos, vinculación de docentes, subida y reemplazo de PDF,
subidas simultáneas de varios cursos, cobertura y borrado). Usan una **copia temporal** de la base y no tocan Google Drive,
así que no modifican los datos reales.

En GitHub se corren solas en cada cambio; si alguna falla, la demo no se publica.

## 7. Archivos que ya no se usan

Se pueden borrar: `backend/excel.js`, `backend/procesar_profesores.js`, `backend/exportar_profesores_excel.js`,
`backend/profesores_extraidos.json`, `backend/profesores_extraidos.xlsx`, `backend/horarios_extraidos.json`,
`backend/horarios_profes_2026.json`, `horarios_profes_2026.json`, `backend/materias_profesores_editable.xlsx`,
`backend/clave.json` (cuenta de servicio sin uso) y `backend/programas.json` (ya migrado a la base).
