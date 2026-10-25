// Administración de cuentas desde la terminal (carpeta backend).
//
//   node scripts/usuarios.js listar
//   node scripts/usuarios.js crear <email> <rol> "<nombre>" ["<docente>"]
//        rol: teacher (docente) | advisor (asesora) | student (alumno)
//        docente: el nombre tal como figura en data/asignaciones.xlsx (varios separados por ;)
//   node scripts/usuarios.js contrasena <email>
//   node scripts/usuarios.js docente <email> "<docente>"
//   node scripts/usuarios.js desactivar <email>
//   node scripts/usuarios.js activar <email>
//
// Las contraseñas se piden por teclado para que no queden en el historial de la terminal.

import readline from 'readline';
import { listarUsuarios, crearUsuario, cambiarContrasena, actualizarUsuario } from '../usuarios.js';
import { asignacionesDeDocente } from '../asignaciones.js';

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

function avisarDocente(docente) {
    if (!docente) return;
    const n = asignacionesDeDocente(docente).length;
    if (n === 0) console.warn(`Atención: "${docente}" no aparece en data/asignaciones.xlsx. Revisá cómo está escrito.`);
    else console.log(`"${docente}" tiene ${n} asignación(es).`);
}

const ROLES = { teacher: 'Docente', advisor: 'Asesora', student: 'Alumno' };

try {
    switch (comando) {
        case 'listar': {
            const filas = listarUsuarios().map((u) => ({
                email: u.email,
                rol: ROLES[u.rol] || u.rol,
                nombre: u.nombre,
                docente: u.docente,
                activo: u.activo ? 'sí' : 'no'
            }));
            console.table(filas);
            break;
        }
        case 'crear': {
            const [email, rol, nombre, docente = ''] = args;
            if (!email || !rol || !nombre) throw new Error('Uso: crear <email> <rol> "<nombre>" ["<docente>"]');
            if (rol === 'teacher' && !docente) throw new Error('Para un docente indicá el nombre que figura en las asignaciones');
            const contrasena = await pedirContrasena();
            crearUsuario({ email, contrasena, rol, nombre, docente });
            console.log(`Usuario ${email} creado.`);
            avisarDocente(docente);
            break;
        }
        case 'contrasena': {
            const [email] = args;
            if (!email) throw new Error('Uso: contrasena <email>');
            cambiarContrasena(email, await pedirContrasena());
            console.log('Contraseña actualizada.');
            break;
        }
        case 'docente': {
            const [email, docente] = args;
            if (!email || docente === undefined) throw new Error('Uso: docente <email> "<docente>"');
            actualizarUsuario(email, { docente });
            console.log('Docente actualizado.');
            avisarDocente(docente);
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
