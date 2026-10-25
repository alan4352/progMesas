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

## Cuentas

Las cuentas están en la base de datos con contraseña cifrada. La primera vez se crean las de prueba
(`prof@test.com`, `asesor@test.com`, `alumno@test.com`, con las mismas contraseñas de antes).

```
node scripts/usuarios.js listar
node scripts/usuarios.js crear ana@escuela.edu.ar advisor "Ana Pérez"
node scripts/usuarios.js crear lfernandez@escuela.edu.ar teacher "Lucrecia Fernández" "Fernandez Lucrecia"
node scripts/usuarios.js desactivar prof@test.com
```

Para un docente, el último dato es su nombre **tal como figura en la columna Docentes** del Excel
(si aparece escrito de dos formas, separalas con `;`). Así el sistema sabe qué materias puede cargar.

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
