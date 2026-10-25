# ProgMesas — puesta en marcha

## Arrancar el servidor

```
cd backend
npm install
npm start
```

Abrí **http://localhost:3000** (ya no hay que abrir `index.html` como archivo: el servidor sirve la página).

El archivo `.env` necesita un `JWT_SECRET` largo y aleatorio. Si falta o es el valor viejo, el servidor no arranca y muestra cómo generarlo.

## Lista oficial de asignaciones

`backend/data/asignaciones.xlsx` es la lista de qué programa tiene que entregar cada curso (curso + materia + docentes).
El sistema controla las entregas con esa lista. Para regenerarla con horarios nuevos:

```
cd backend
node scripts/importar_horarios.js "ruta\Horarios_T.Mañana.xlsx" "ruta\Horarios_T.Tarde.xlsx"
```

Si `asignaciones.xlsx` ya existe, el importador no lo pisa: genera `asignaciones_importadas_<fecha>.xlsx` (con `--reemplazar` lo pisa).

Se puede editar con Excel: el servidor lo relee al guardarlo. Las filas en amarillo (columna *Revisar*) conviene controlarlas:
son docentes del contraturno que el importador ubicó por cercanía o materias sin docente.
Para que una materia no cuente como pendiente, poné `NO` en *Requiere programa*.

## Usuarios e ingreso

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

## Google Drive

Si el permiso de Drive vence, los PDF se guardan en `backend/uploads` y el dashboard lo avisa. Para renovarlo:

```
node scripts/autorizar_drive.js
```

Para que no venza cada 7 días, en Google Cloud Console → *Pantalla de consentimiento de OAuth* pasá la app de "Testing" a "En producción".

## Archivos que ya no se usan

Se pueden borrar: `backend/excel.js`, `backend/procesar_profesores.js`, `backend/exportar_profesores_excel.js`,
`backend/profesores_extraidos.json`, `backend/profesores_extraidos.xlsx`, `backend/horarios_extraidos.json`,
`backend/horarios_profes_2026.json`, `horarios_profes_2026.json`, `backend/materias_profesores_editable.xlsx`,
`backend/clave.json` (cuenta de servicio sin uso) y `backend/programas.json` (ya migrado a la base).
