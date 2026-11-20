import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const errores = [];
const comprobaciones = [];

function registrarOk(msg) {
    comprobaciones.push(msg);
    console.log(`[OK] ${msg}`);
}

function registrarError(msg) {
    errores.push(msg);
    console.error(`[ERROR] ${msg}`);
}

function recolectarJs(dir) {
    const lista = [];
    if (!fs.existsSync(dir)) return lista;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            lista.push(...recolectarJs(ruta));
        } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
            lista.push(ruta);
        }
    }
    return lista.sort();
}

function quitarComentarios(codigo) {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

// 1. Verificar existencia de archivos base y configuración Azure
const archivosRequeridos = [
    'index.html',
    'css/estilos.css',
    'staticwebapp.config.json',
    'GEMINI.md',
    'MAPA_SIMBOLOS.md',
    'generar_mapa.mjs',
    'verify_project.mjs',
    'js/constantes.js',
    'js/config.js',
    'js/estado.js',
    'js/recursos.js',
    'js/nucleoSandbox.js',
    'js/avatar.js',
    'js/fisicaSandbox.js',
    'js/red.js',
    'js/interfaz.js',
    'js/main.js',
    'js/experiencias/lobbyCentral.js',
    'js/experiencias/zonaConstruccion.js',
    'js/experiencias/arenaTurboKarts.js',
    'js/experiencias/salaTetris.js',
    'server/package.json',
    'server/index.js',
    'server/Dockerfile'
];

let faltantes = 0;
for (const rel of archivosRequeridos) {
    if (!fs.existsSync(path.join(RAIZ, rel))) {
        registrarError(`Archivo requerido faltante: ${rel}`);
        faltantes++;
    }
}
if (faltantes === 0) {
    registrarOk(`Todos los ${archivosRequeridos.length} archivos base y de Azure existen.`);
}

// 2. Verificar GEMINI.md < 200 líneas
const rutaGemini = path.join(RAIZ, 'GEMINI.md');
if (fs.existsSync(rutaGemini)) {
    const lineasGemini = fs.readFileSync(rutaGemini, 'utf8').split(/\r?\n/).length;
    if (lineasGemini >= 200) {
        registrarError(`GEMINI.md tiene ${lineasGemini} líneas (debe ser < 200 líneas).`);
    } else {
        registrarOk(`GEMINI.md cumple límite de brevedad (${lineasGemini} < 200 líneas).`);
    }
}

// 3. Verificar grafo ES6 (existencia de imports y cero dependencias circulares)
const archivosJs = recolectarJs(path.join(RAIZ, 'js'));
const grafo = new Map();

for (const archivo of archivosJs) {
    const codigo = quitarComentarios(fs.readFileSync(archivo, 'utf8'));
    const deps = [];
    const regexImport = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = regexImport.exec(codigo)) !== null) {
        const spec = match[1];
        if (spec.startsWith('.')) {
            const resuelto = path.resolve(path.dirname(archivo), spec);
            if (!fs.existsSync(resuelto)) {
                const relOrigen = path.relative(RAIZ, archivo).replace(/\\/g, '/');
                registrarError(`Import roto en ${relOrigen}: "${spec}" no existe.`);
            } else {
                deps.push(resuelto);
            }
        }
    }
    grafo.set(archivo, deps);
}

const estadoVisita = new Map(); // 0=no visitado, 1=en pila, 2=completado
let cicloEncontrado = null;

function dfs(nodo, pila) {
    estadoVisita.set(nodo, 1);
    const vecinos = grafo.get(nodo) || [];
    for (const vecino of vecinos) {
        const est = estadoVisita.get(vecino) || 0;
        if (est === 1) {
            const idx = pila.indexOf(vecino);
            const ciclo = [...pila.slice(idx), vecino]
                .map((p) => path.relative(RAIZ, p).replace(/\\/g, '/'));
            cicloEncontrado = ciclo.join(' -> ');
            return true;
        }
        if (est === 0 && dfs(vecino, [...pila, vecino])) {
            return true;
        }
    }
    estadoVisita.set(nodo, 2);
    return false;
}

for (const archivo of archivosJs) {
    if ((estadoVisita.get(archivo) || 0) === 0) {
        if (dfs(archivo, [archivo])) break;
    }
}

if (cicloEncontrado) {
    registrarError(`Dependencia circular detectada en grafo ES6: ${cicloEncontrado}`);
} else {
    registrarOk(`Grafo ES6 acíclico (DAG) validado en ${archivosJs.length} módulos.`);
}

// 4. Verificar herencia y limpieza GPU en js/experiencias/*.js
const dirExperiencias = path.join(RAIZ, 'js', 'experiencias');
const archivosExp = recolectarJs(dirExperiencias);
if (archivosExp.length === 0) {
    registrarError('No se encontraron experiencias en js/experiencias/*.js.');
} else {
    for (const archivoExp of archivosExp) {
        const rel = path.relative(RAIZ, archivoExp).replace(/\\/g, '/');
        const contenido = fs.readFileSync(archivoExp, 'utf8');
        const tieneHerencia = /class\s+[A-Za-z0-9_$]+\s+extends\s+ExperienciaBase\b/.test(contenido);
        const tieneMontar = /\bmontar\s*\(/.test(contenido);
        const tieneActualizar = /\bactualizar\s*\(/.test(contenido);
        const tieneDesmontar = /\bdesmontar\s*\(/.test(contenido);
        const tieneEventoRed = /\balEventoRed\s*\(/.test(contenido);
        const usaLiberar = /\bliberarObjeto3D\s*\(/.test(contenido);
        const usaCupulaCielo = /\bcrearCupulaCielo\s*\(/.test(contenido);

        if (!tieneHerencia) registrarError(`${rel} debe declarar una clase que extienda de ExperienciaBase.`);
        if (!tieneMontar) registrarError(`${rel} debe implementar montar().`);
        if (!tieneActualizar) registrarError(`${rel} debe implementar actualizar().`);
        if (!tieneDesmontar) registrarError(`${rel} debe implementar desmontar().`);
        if (!tieneEventoRed) registrarError(`${rel} debe implementar alEventoRed().`);
        if (!usaLiberar) registrarError(`${rel} debe invocar liberarObjeto3D().`);
        if (!usaCupulaCielo) registrarError(`${rel} debe invocar crearCupulaCielo().`);

        if (tieneHerencia && tieneMontar && tieneActualizar && tieneDesmontar && tieneEventoRed && usaLiberar && usaCupulaCielo) {
            registrarOk(`Experiencia válida verificada (incluye cúpula cielo y limpieza GPU): ${rel}`);
        }
    }
}

// 5. Verificar favicon inline y sincronización de IDs del DOM entre JS e index.html
const rutaHtml = path.join(RAIZ, 'index.html');
const rutaInterfaz = path.join(RAIZ, 'js', 'interfaz.js');
if (fs.existsSync(rutaHtml) && fs.existsSync(rutaInterfaz)) {
    const html = fs.readFileSync(rutaHtml, 'utf8');

    const tieneFaviconInline = /<link\s+rel=["']icon["'][^>]*href=["']data:image\/svg\+xml/i.test(html);
    if (!tieneFaviconInline) {
        registrarError('index.html debe incluir un favicon SVG inline (data:image/svg+xml) para evitar 404.');
    } else {
        registrarOk('Favicon SVG inline presente en index.html.');
    }

    const idsHtml = new Set();
    const regexIdHtml = /\bid\s*=\s*["']([^"']+)["']/g;
    let m;
    while ((m = regexIdHtml.exec(html)) !== null) {
        idsHtml.add(m[1]);
    }

    const idsReferenciados = new Set([
        'selector-piel',
        'selector-torso',
        'selector-piernas',
        'btn-menu-dona',
        'menu-dona-overlay',
        'panel-gestos-dona',
        'panel-chat-rapido',
        'input-chat-rapido',
        'btn-enviar-chat',
        'btn-gesto-saludar',
        'btn-gesto-bailar',
        'btn-gesto-celebrar',
        'btn-gesto-sentarse',
        'btn-toggle-bloques',
        'popover-bloques',
        'hud-karts',
        'btn-toggle-kart',
        'popover-kart',
        'selector-kart-chasis',
        'selector-kart-ruedas',
        'selector-kart-aleron',
        'selector-kart-color',
        'barra-stat-vel',
        'barra-stat-acel',
        'barra-stat-ctrl',
        'btn-warp-karts',
        'btn-warp-tetris',
        'pantalla-tetris-fullscreen',
        'canvas-tetris-hold',
        'canvas-tetris-siguientes',
        'tetris-puntaje',
        'tetris-nivel',
        'tetris-lineas',
        'tetris-mejor-puntaje',
        'tetris-butaca-actual',
        'lista-ranking-tetris',
        'overlay-tetris-gameover',
        'btn-tetris-reiniciar',
        'btn-tetris-levantarse',
        'btn-tetris-izq',
        'btn-tetris-der',
        'btn-tetris-rotar',
        'btn-tetris-bajar',
        'btn-tetris-caida',
        'btn-tetris-hold'
    ]);
    const codigoInterfaz = fs.readFileSync(rutaInterfaz, 'utf8');
    const regexEl = /\bel\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = regexEl.exec(codigoInterfaz)) !== null) {
        idsReferenciados.add(m[1]);
    }

    for (const archivoJs of archivosJs) {
        const src = fs.readFileSync(archivoJs, 'utf8');
        const regexDocId = /document\.getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((m = regexDocId.exec(src)) !== null) {
            idsReferenciados.add(m[1]);
        }
    }

    const faltantesDom = [];
    for (const idRef of idsReferenciados) {
        if (!idsHtml.has(idRef)) {
            faltantesDom.push(idRef);
        }
    }

    if (faltantesDom.length > 0) {
        registrarError(`IDs del DOM referenciados en JS pero ausentes en index.html: ${faltantesDom.join(', ')}`);
    } else {
        registrarOk(`Sincronización DOM verificada (${idsReferenciados.size} IDs presentes en index.html).`);
    }
}

// 6. Verificar esquema de persistencia de perfil en js/estado.js
const rutaEstado = path.join(RAIZ, 'js', 'estado.js');
if (fs.existsSync(rutaEstado)) {
    const srcEstado = fs.readFileSync(rutaEstado, 'utf8');
    const clavesPerfil = [
        'apariencia',
        'construccionGuardada',
        'configKart',
        'mejorVueltaKart',
        'mejorPuntajeTetris',
        'exportarCodigoPerfil',
        'importarCodigoPerfil'
    ];
    const faltantesEstado = clavesPerfil.filter((c) => !new RegExp(`\\b${c}\\b`).test(srcEstado));
    if (faltantesEstado.length > 0) {
        registrarError(`js/estado.js carece de claves/funciones requeridas: ${faltantesEstado.join(', ')}`);
    } else {
        registrarOk('Esquema de perfil y persistencia en js/estado.js verificado.');
    }
}

// 6b. Verificar presupuesto exacto de 120 puntos en CATALOGO_KARTS y parámetros GP 4.1 / 4.2
try {
    const {
        CATALOGO_KARTS,
        DIMENSION_PISTA_KARTS,
        VUELTAS_CARRERA_KARTS
    } = await import('./js/constantes.js');
    const arquetiposEsperados = ['kart_batmovil', 'kart_formula', 'kart_lemans', 'kart_tumbler'];
    if (!Array.isArray(CATALOGO_KARTS) || CATALOGO_KARTS.length !== 4) {
        registrarError('CATALOGO_KARTS debe contener exactamente 4 chasis.');
    } else {
        const idsPresentes = CATALOGO_KARTS.map((k) => k.id);
        const faltantes = arquetiposEsperados.filter((id) => !idsPresentes.includes(id));
        const invalidos = CATALOGO_KARTS.filter(
            (k) =>
                k.velocidad + k.aceleracion + k.control !== 120 ||
                typeof k.pesoImpacto !== 'number' ||
                k.pesoImpacto <= 0
        );
        if (faltantes.length > 0) {
            registrarError(`Faltan arquetipos esperados en CATALOGO_KARTS: ${faltantes.join(', ')}`);
        } else if (invalidos.length > 0) {
            registrarError(`Chasis inválidos (!= 120 pts o sin pesoImpacto): ${invalidos.map((k) => k.id).join(', ')}`);
        } else {
            registrarOk('Todos los 4 arquetipos (batmovil/formula/lemans/tumbler) suman 120 pts y definen pesoImpacto.');
        }
    }

    if (DIMENSION_PISTA_KARTS !== 160 || VUELTAS_CARRERA_KARTS !== 2) {
        registrarError(
            `Parámetros GP inválidos: DIMENSION_PISTA_KARTS=${DIMENSION_PISTA_KARTS}, VUELTAS_CARRERA_KARTS=${VUELTAS_CARRERA_KARTS}`
        );
    } else {
        registrarOk('ArenaTurboKarts configurado a 160x160 m y formato oficial de 2 vueltas.');
    }

    const srcKarts = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'arenaTurboKarts.js'), 'utf8');
    const srcMain = fs.readFileSync(path.join(RAIZ, 'js', 'main.js'), 'utf8');
    const srcRecursos = fs.readFileSync(path.join(RAIZ, 'js', 'recursos.js'), 'utf8');
    const srcAvatar = fs.readFileSync(path.join(RAIZ, 'js', 'avatar.js'), 'utf8');

    const tiene6Pads = /TOTAL_BOOST_PADS\s*=\s*6\b/.test(srcKarts);
    const tieneConteo10 = /DURACION_CONTEO_SALIDA\s*=\s*10(?:\.0)?\b/.test(srcKarts);
    const tieneObstaculos = ['bote_basura', 'tronco', 'oso'].every((t) => srcKarts.includes(t));
    const tienePreviewKart = /garajeKartAbierto/.test(srcMain);
    const tieneColisionesKarts =
        /jugadoresRemotos/.test(srcKarts) &&
        /choque_kart/.test(srcKarts) &&
        /obtenerPosicionSlotParrilla/.test(srcKarts) &&
        /obtenerPesoImpactoKart/.test(srcKarts);
    const tieneTexturasPBRKart =
        /export\s+function\s+obtenerTexturaNeumatico/.test(srcRecursos) &&
        /export\s+function\s+obtenerTexturaChasisKart/.test(srcRecursos) &&
        /['"]choque_kart['"]/.test(srcRecursos) &&
        /['"]fuegos_artificiales['"]/.test(srcRecursos) &&
        /obtenerTexturaNeumatico/.test(srcAvatar) &&
        /obtenerTexturaChasisKart/.test(srcAvatar);
    const tienePodioYPaddock =
        /obtenerPosicionPaddock/.test(srcKarts) &&
        /_construirPodioCampeones/.test(srcKarts) &&
        /iniciarCeremoniaPodio/.test(srcKarts) &&
        /DURACION_CEREMONIA_PODIO\s*=\s*12(?:\.0)?\b/.test(srcKarts) &&
        /obtenerMetaFinalistas/.test(srcKarts) &&
        /liberarObjeto3D/.test(srcKarts) &&
        /modoCeremoniaPodio/.test(srcMain);

    if (!tiene6Pads || !tieneConteo10 || !tieneObstaculos || !tienePreviewKart) {
        registrarError(
            `Falta configuración GP 4.1 (pads=${tiene6Pads}, conteo10=${tieneConteo10}, obstaculos=${tieneObstaculos}, previewKart=${tienePreviewKart}).`
        );
    } else if (!tieneColisionesKarts || !tieneTexturasPBRKart) {
        registrarError(
            `Falta configuración GP 4.2 (colisionesKarts=${tieneColisionesKarts}, texturasPBRKart=${tieneTexturasPBRKart}).`
        );
    } else if (!tienePodioYPaddock) {
        registrarError(
            'Falta configuración GP 4.3 (Paddock trasero, meta dinámica 1/2/3 o ceremonia de podio de 12s).'
        );
    } else {
        registrarOk(
            'Verificados 6 turbo pads, Paddock trasero, parrilla 10s, colisiones kart-a-kart, texturas PBR y ceremonia de podio de 12s.'
        );
    }
} catch (err) {
    registrarError(`No se pudo validar CATALOGO_KARTS / GP 4.1-4.3: ${err.message}`);
}

// 6c. Verificar SalaTetris (8 butacas, tablero 10x20, puntaje no lineal, SFX y registro)
try {
    const srcTetris = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'salaTetris.js'), 'utf8');
    const srcLobby = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'lobbyCentral.js'), 'utf8');
    const srcMain = fs.readFileSync(path.join(RAIZ, 'js', 'main.js'), 'utf8');
    const srcRecursos = fs.readFileSync(path.join(RAIZ, 'js', 'recursos.js'), 'utf8');

    const {
        TOTAL_ASIENTOS_TETRIS,
        COLUMNAS_TETRIS,
        FILAS_VISIBLES_TETRIS,
        PUNTAJES_LINEAS_TETRIS
    } = await import('./js/experiencias/salaTetris.js');

    const dimensionesOk =
        TOTAL_ASIENTOS_TETRIS === 8 &&
        COLUMNAS_TETRIS === 10 &&
        FILAS_VISIBLES_TETRIS === 20;
    const puntajeNoLinealOk =
        PUNTAJES_LINEAS_TETRIS?.[1] === 100 &&
        PUNTAJES_LINEAS_TETRIS?.[2] === 300 &&
        PUNTAJES_LINEAS_TETRIS?.[3] === 500 &&
        PUNTAJES_LINEAS_TETRIS?.[4] === 1200;
    const integracionTetrisOk =
        /crearCupulaCielo\(['"]tetris_arcade['"]\)/.test(srcTetris) &&
        /liberarObjeto3D/.test(srcTetris) &&
        /obtenerEncuadreCamaraTetris3D/.test(srcTetris) &&
        /obtenerEncuadreCamaraTetris3D/.test(srcMain) &&
        /\bceldas3D\b/.test(srcTetris) &&
        /\bfantasmas3D\b/.test(srcTetris) &&
        /new\s+SalaTetris\s*\(/.test(srcMain) &&
        /modoTetrisActivo/.test(srcMain) &&
        /idDestino:\s*['"]tetris['"]/.test(srcLobby) &&
        /['"]tetris_cuadruple['"]/.test(srcRecursos);

    if (!dimensionesOk || !puntajeNoLinealOk || !integracionTetrisOk) {
        registrarError(
            `Falta configuración Fase 5 / 5.1 SalaTetris (dimensiones=${dimensionesOk}, puntajeNoLineal=${puntajeNoLinealOk}, integracion=${integracionTetrisOk}).`
        );
    } else {
        registrarOk(
            'SalaTetris 3D validada: 8 estaciones TV Gigante 3D (celdas3D), encuadre primera persona 3D, tablero 10x20 y puntaje no lineal (100/300/500/1200).'
        );
    }
} catch (err) {
    registrarError(`No se pudo validar SalaTetris: ${err.message}`);
}

// 7. Verificar server/index.js (/health, evento_experiencia, accion_social, slotParrilla y parcelas.json)
const rutaServidor = path.join(RAIZ, 'server', 'index.js');
if (fs.existsSync(rutaServidor)) {
    const srcSrv = fs.readFileSync(rutaServidor, 'utf8');
    const tieneHealth = /['"]\/health['"]/.test(srcSrv);
    const tieneEventoExp = /['"]evento_experiencia['"]/.test(srcSrv);
    const tieneAccionSocial = /['"]accion_social['"]/.test(srcSrv);
    const tieneParcelasJson = /parcelas\.json/.test(srcSrv);
    const tieneEstadoCompleto = /['"]estado_parcela_completo['"]/.test(srcSrv);
    const tieneSlotParrilla =
        /asignarSlotParrillaLibre/.test(srcSrv) &&
        /slotParrilla/.test(srcSrv) &&
        /['"]sala_actualizada['"]/.test(srcSrv);
    if (!tieneHealth) registrarError('server/index.js debe exponer el endpoint /health.');
    if (!tieneEventoExp) registrarError('server/index.js debe retransmitir mensajes evento_experiencia.');
    if (!tieneAccionSocial) registrarError('server/index.js debe retransmitir mensajes accion_social.');
    if (!tieneParcelasJson) registrarError('server/index.js debe persistir parcelas en server/data/parcelas.json.');
    if (!tieneEstadoCompleto) registrarError('server/index.js debe enviar estado_parcela_completo a los clientes.');
    if (!tieneSlotParrilla) registrarError('server/index.js debe asignar slotParrilla único y difundir sala_actualizada.');
    if (tieneHealth && tieneEventoExp && tieneAccionSocial && tieneParcelasJson && tieneEstadoCompleto && tieneSlotParrilla) {
        registrarOk('server/index.js expone /health, retransmite eventos, asigna slotParrilla y persiste parcelas.json.');
    }
}

// 8. Verificar .gitignore ignora server/data/
const rutaGitignore = path.join(RAIZ, '.gitignore');
if (fs.existsSync(rutaGitignore) && /server\/data\//.test(fs.readFileSync(rutaGitignore, 'utf8'))) {
    registrarOk('.gitignore protege node_modules/ y server/data/.');
} else {
    registrarError('Debe existir .gitignore ignorando server/data/.');
}

console.log('\n----------------------------------------');
if (errores.length > 0) {
    console.error(`VERIFICACIÓN FALLIDA (${errores.length} error(es), ${comprobaciones.length} ok)`);
    process.exit(1);
}

console.log('VERIFICACIÓN COMPLETA EXITOSA');
process.exit(0);
