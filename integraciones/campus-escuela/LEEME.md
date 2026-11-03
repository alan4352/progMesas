# Ingreso desde el campus de la escuela

ProgMesas no tiene login propio: usa el del **campus virtual** (PHP). Esta carpeta tiene lo que hay que
agregar al campus para que, desde el módulo **Programas de examen**, cada persona entre a ProgMesas ya identificada.

| En el campus | En ProgMesas |
|---|---|
| Profesor | Docente: carga los programas de cualquier curso; los suyos aparecen primero (se vincula solo si su nombre coincide con la lista de horarios) |
| Directivo | Asesora: dashboard, fecha límite, vinculaciones, registro |
| Alumno | Alumno: consulta |

## Cómo funciona

1. La persona inicia sesión en el campus como siempre.
2. Al tocar el módulo de programas, `programas.php` arma un **pase** (token JWT firmado con HS256) con su id, nombre,
   correo y rol, y la manda a `PROGMESAS_URL/?token=...`.
3. ProgMesas verifica la firma con la misma clave (`EXTERNO_JWT_SECRET`). Si alguien cambia el pase o lo firma con otra
   clave, lo rechaza. El pase vence a las `PROGMESAS_HORAS` horas (8 por defecto).
4. **Ingresar** en ProgMesas lleva a `programas.php` (si no hay sesión, al login del campus, que vuelve solo).
   **Cerrar sesión** lleva a `logout.php` del campus.

## Archivos nuevos (copiar al campus)

| Archivo | Para qué |
|---|---|
| `includes/progmesas.php` | Arma el pase firmado y el enlace a ProgMesas |
| `programas.php` | Abre ProgMesas con la sesión del campus (o manda al login y vuelve) |

## Cambios en archivos del campus

**`includes/config.php`** — agregar al final:

```php
define('PROGMESAS_URL', 'https://programas.escuela.edu.ar');   // dirección de ProgMesas
define('PROGMESAS_SECRETO', 'CAMBIAR-por-una-clave-larga-y-secreta'); // php -r "echo bin2hex(random_bytes(32));"
define('PROGMESAS_HORAS', 8);
```

Mientras la clave empiece con `CAMBIAR` o tenga menos de 32 caracteres, `programas.php` muestra un aviso y no abre nada.

**`login.php`** — guardar el correo y un id en la sesión, y volver al módulo que se estaba abriendo:

```php
// después de los require_once
function destinoTrasLogin() {
    $destino = $_SESSION['volver_a'] ?? 'dashboard.php';
    unset($_SESSION['volver_a']);
    return preg_match('/^[a-z_]+\.php$/', $destino) ? $destino : 'dashboard.php';
}

// alumno, al ingresar
$_SESSION['correo'] = $alumno['correo'];
$_SESSION['id']     = 'alumno:' . $alumno['dni'];
header('Location: ' . destinoTrasLogin());

// profesor
$_SESSION['correo'] = $profesor['correo'];
$_SESSION['id']     = 'profesor:' . strtolower($profesor['correo']);
header('Location: ' . destinoTrasLogin());

// directivo
$_SESSION['correo'] = $directivo['correo'];
$_SESSION['id']     = 'directivo:' . strtolower($directivo['correo']);
header('Location: ' . destinoTrasLogin());
```

**`dashboard.php`** — los módulos de programas apuntan a `programas.php`, y el directivo tiene el suyo:

```php
if ($rol === 'directivo') { ?>
    <a class="modulo" href="programas.php">
        <h2>Control de programas de examen</h2>
        <p>Vea qué programas faltan por curso y por docente, fije la fecha límite y revise el registro.</p>
    </a>
<?php } elseif ($rol === 'profesor') { ?>
    <a class="modulo" href="programas.php"> … Subir los programas de examen … </a>
<?php } elseif ($rol === 'alumno') { ?>
    <a class="modulo" href="programas.php"> … Programa de examen … </a>
<?php } ?>
```

**`modulo.php`** — quien entre por `modulo.php?m=programa` va a ProgMesas:

```php
$modulo = $_GET['m'] ?? '';
if ($modulo === 'programa') {
    header('Location: programas.php');
    exit;
}
```

## Configuración de ProgMesas (`.env`)

```
EXTERNO_JWT_SECRET=<la misma clave que PROGMESAS_SECRETO>
EXTERNO_LOGIN_URL=https://<campus>/programas.php
EXTERNO_LOGOUT_URL=https://<campus>/logout.php
```

Los nombres de los datos (`sub`, `name`, `email`, `role`) y de los roles (`profesor`, `directivo`, `alumno`) ya son los
que ProgMesas espera por defecto: no hace falta configurar nada más.

## Probar

`npm test` en ProgMesas incluye `tests/campus.test.js`, que genera pases con este mismo `progmesas.php` (hace falta PHP
instalado) y comprueba los roles y que un pase con otra clave o modificado se rechace.
