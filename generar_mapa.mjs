import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const DIR_JS = path.join(RAIZ, 'js');
const ARCHIVO_SALIDA = path.join(RAIZ, 'MAPA_SIMBOLOS.md');

/**
 * Recolecta recursivamente todos los archivos `.js` bajo un directorio.
 * @param {string} dir
 * @returns {string[]}
 */
function recolectarArchivosJs(dir) {
    const resultados = [];
    if (!fs.existsSync(dir)) return resultados;

    const entradas = fs.readdirSync(dir, { withFileTypes: true });
    entradas.sort((a, b) => a.name.localeCompare(b.name));

    for (const entrada of entradas) {
        const rutaCompleta = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            resultados.push(...recolectarArchivosJs(rutaCompleta));
        } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
            resultados.push(rutaCompleta);
        }
    }
    return resultados;
}

/**
 * Extrae símbolos principales con su línea exacta (base 1).
 * @param {string} contenido
 */
function extraerSimbolos(contenido) {
    const lineas = contenido.split(/\r?\n/);
    const simbolos = {
        imports: [],
        exports: [],
        clases: [],
        funciones: [],
        constantes: []
    };

    for (let i = 0; i < lineas.length; i++) {
        const numLinea = i + 1;
        const linea = lineas[i];
        const trimmed = linea.trim();

        if (/^import\b/.test(trimmed)) {
            let textoImport = trimmed;
            let j = i;
            while (!textoImport.includes(';') && j + 1 < lineas.length && !textoImport.includes(' from ')) {
                j++;
                textoImport += ' ' + lineas[j].trim();
            }
            if (!textoImport.includes(' from ') && j + 1 < lineas.length) {
                while (!textoImport.includes(' from ') && j + 1 < lineas.length) {
                    j++;
                    textoImport += ' ' + lineas[j].trim();
                }
            }
            const matchFrom = textoImport.match(/from\s+['"]([^'"]+)['"]/);
            simbolos.imports.push({
                linea: numLinea,
                detalle: matchFrom ? matchFrom[1] : textoImport
            });
        }

        const matchClass = linea.match(/^(export\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$]+))?/);
        if (matchClass) {
            const nombre = matchClass[3] ? `${matchClass[2]} extends ${matchClass[3]}` : matchClass[2];
            simbolos.clases.push({ linea: numLinea, nombre });
            if (matchClass[1]) simbolos.exports.push({ linea: numLinea, tipo: 'class', nombre: matchClass[2] });
            continue;
        }

        const matchFunc = linea.match(/^(export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
        if (matchFunc) {
            simbolos.funciones.push({ linea: numLinea, nombre: matchFunc[2] });
            if (matchFunc[1]) simbolos.exports.push({ linea: numLinea, tipo: 'function', nombre: matchFunc[2] });
            continue;
        }

        const matchConst = linea.match(/^(export\s+)?const\s+([A-Za-z0-9_$]+)/);
        if (matchConst) {
            simbolos.constantes.push({ linea: numLinea, nombre: matchConst[2] });
            if (matchConst[1]) simbolos.exports.push({ linea: numLinea, tipo: 'const', nombre: matchConst[2] });
            continue;
        }

        const matchOtherExport = linea.match(/^export\s+(let|var|default)\s+([A-Za-z0-9_$]+)?/);
        if (matchOtherExport) {
            simbolos.exports.push({
                linea: numLinea,
                tipo: matchOtherExport[1],
                nombre: matchOtherExport[2] || 'default'
            });
        }
    }

    return simbolos;
}

function generarMapa() {
    const archivos = recolectarArchivosJs(DIR_JS);
    const secciones = [
        '# MAPA_SIMBOLOS.md',
        '',
        'Índice automático de módulos ES6, importaciones, exportaciones, clases, funciones y constantes en `js/**/*.js`.',
        `Total de módulos analizados: **${archivos.length}**`,
        ''
    ];

    for (const archivo of archivos) {
        const rel = path.relative(RAIZ, archivo).replace(/\\/g, '/');
        const contenido = fs.readFileSync(archivo, 'utf8');
        const s = extraerSimbolos(contenido);

        secciones.push(`## \`${rel}\``);
        secciones.push('');

        if (s.imports.length > 0) {
            secciones.push('- **Imports**: ' + s.imports.map((x) => `\`${x.detalle}\` (L${x.linea})`).join(', '));
        } else {
            secciones.push('- **Imports**: *(ninguno — hoja del DAG)*');
        }

        if (s.exports.length > 0) {
            secciones.push('- **Exports**: ' + s.exports.map((x) => `\`${x.nombre}\` [${x.tipo}] (L${x.linea})`).join(', '));
        }

        if (s.clases.length > 0) {
            secciones.push('- **Clases**: ' + s.clases.map((x) => `\`${x.nombre}\` (L${x.linea})`).join(', '));
        }

        if (s.funciones.length > 0) {
            secciones.push('- **Funciones**: ' + s.funciones.map((x) => `\`${x.nombre}\` (L${x.linea})`).join(', '));
        }

        if (s.constantes.length > 0) {
            secciones.push('- **Constantes**: ' + s.constantes.map((x) => `\`${x.nombre}\` (L${x.linea})`).join(', '));
        }

        secciones.push('');
    }

    fs.writeFileSync(ARCHIVO_SALIDA, secciones.join('\n'), 'utf8');
    console.log(`[generar_mapa] MAPA_SIMBOLOS.md generado (${archivos.length} módulos).`);
}

generarMapa();
