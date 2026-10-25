// Cuentas de PRUEBA (sólo sirven con AUTH_MODO=prueba). En producción los usuarios
// vienen del sistema principal y este script no se usa.
//
//   node scripts/usuarios.js listar
//   node scripts/usuarios.js crear <email> <rol> "<nombre>"
//        rol: teacher (docente) | advisor (asesora) | viewer (preceptor/directivo) | student (alumno)
//   node scripts/usuarios.js contrasena <email>
//   node scripts/usuarios.js desactivar <email>
//   node scripts/usuarios.js activar <email>
//
// El nombre del docente en la lista oficial se vincula desde la web (el docente lo elige y la asesora lo confirma).
// Las contraseñas se piden por teclado para que no queden en el historial de la terminal.

import readline from 'readline';
import { listarUsuarios, crearUsuario, cambiarContrasena, actualizarUsuario } from '../usuarios.js';

const [comando, ...args] = process.argv.slice(2);

function preguntarOculto(pregunta) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        rl._writeToOutput = (s) => {
            if (s.includes(pregunta)) rl.output.write(s);
        };
        rl.question(pregunta, (r) => {
            rl.close();
            process.stdout.write('\n');
            resolve(r);
        });
    });
}

async function pedirContrasena() {
    const c1 = await preguntarOculto('Contraseña (mínimo 8 caracteres): ');
    const c2 = await preguntarOculto('Repetila: ');
    if (c1 !== c2) throw new Error('Las contraseñas no coinciden');
    return c1;
}

const ROLES = { teacher: 'Docente', advisor: 'Asesora', viewer: 'Consulta', student: 'Alumno' };

try {
    switch (comando) {
        case 'listar': {
            const filas = listarUsuarios().map((u) => ({
                email: u.email,
                rol: ROLES[u.rol] || u.rol,
                nombre: u.nombre,
                activo: u.activo ? 'sí' : 'no'
            }));
            console.table(filas);
            break;
        }
        case 'crear': {
            const [email, rol, nombre] = args;
            if (!email || !rol || !nombre) throw new Error('Uso: crear <email> <rol> "<nombre>"');
            const contrasena = await pedirContrasena();
            crearUsuario({ email, contrasena, rol, nombre });
            console.log(`Usuario ${email} creado.`);
            break;
        }
        case 'contrasena': {
            const [email] = args;
            if (!email) throw new Error('Uso: contrasena <email>');
            cambiarContrasena(email, await pedirContrasena());
            console.log('Contraseña actualizada.');
            break;
        }
        case 'desactivar':
        case 'activar': {
            const [email] = args;
            if (!email) throw new Error(`Uso: ${comando} <email>`);
            actualizarUsuario(email, { activo: comando === 'activar' });
            console.log(`Usuario ${comando === 'activar' ? 'activado' : 'desactivado'}.`);
            break;
        }
        default: {
            const fs = await import('fs');
            const { fileURLToPath } = await import('url');
            const texto = fs.readFileSync(fileURLToPath(import.meta.url), 'utf-8');
            console.log(texto.split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
        }
    }
} catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
}
