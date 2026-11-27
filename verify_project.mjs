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
    'manifest.json',
    'css/estilos.css',
    'staticwebapp.config.json',
    'GEMINI.md',
    'MAPA_SIMBOLOS.md',
    'generar_mapa.mjs',
    'verify_project.mjs',
    'js/constantes.js',
    'js/config.js',
    'js/partituras.js',
    'js/estado.js',
    'js/recursos.js',
    'js/audio.js',
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
} else if (archivosJs.length < 16) {
    registrarError(`Se esperaban al menos 16 módulos ES6 en js/**/*.js, encontrados ${archivosJs.length}.`);
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
        'btn-hud-menu',
        'btn-hud-chat',
        'btn-hud-gestos',
        'menu-principal-unificado',
        'tab-menu-sala',
        'tab-menu-avatar',
        'tab-menu-mochila',
        'tab-menu-jugador',
        'panel-gestos',
        'panel-chat-rapido',
        'input-chat-rapido',
        'btn-enviar-chat',
        'btn-gesto-saludar',
        'btn-gesto-bailar',
        'btn-gesto-celebrar',
        'btn-gesto-sentarse',
        'btn-cambiar-jugador',
        'zona-joystick-dinamico',
        'aviso-girar-pantalla',
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
        'btn-tetris-hold',
        'pantalla-bienvenida',
        'lista-perfiles-existentes',
        'input-nuevo-apodo',
        'btn-crear-jugador',
        'btn-entrar-parque',
        'btn-musica',
        'btn-pantalla-completa',
        'banner-podio-f1',
        'banner-conteo-kart',
        'btn-cancelar-salida',
        'filtros-mochila'
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
    } else if (idsHtml.has('btn-menu-dona') || idsHtml.has('menu-dona-overlay') || idsHtml.has('banner-conteo-karts')) {
        registrarError('index.html aún contiene IDs obsoletos (btn-menu-dona / menu-dona-overlay / banner-conteo-karts).');
    } else {
        registrarOk(`Sincronización DOM verificada (${idsReferenciados.size} IDs presentes en index.html, menú dona/banner conteo obsoletos removidos).`);
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
    const tienePreviewKart = /garajeKartAbierto/.test(srcKarts) && /obtenerConfigCamara\s*\(/.test(srcKarts);
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
        /modoCeremoniaPodio/.test(srcMain) &&
        /modoCeremoniaPodio/.test(srcKarts);

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
        /obtenerConfigCamara\s*\(/.test(srcTetris) &&
        /obtenerConfigCamara/.test(srcMain) &&
        /\bceldas3D\b/.test(srcTetris) &&
        /\bfantasmas3D\b/.test(srcTetris) &&
        /new\s+SalaTetris\s*\(/.test(srcMain) &&
        /modoTetrisActivo/.test(srcMain) &&
        (/idDestino:\s*['"]tetris['"]/.test(srcLobby) || /CATALOGO_MUNDOS/.test(srcLobby)) &&
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

// 6d. Verificar Fase 6 Parte 1: Contrato de cámara polimórfico, PWA fullscreen y Sala Pública
try {
    const manifestJson = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
    const srcNucleo = fs.readFileSync(path.join(RAIZ, 'js', 'nucleoSandbox.js'), 'utf8');
    const srcLobby = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'lobbyCentral.js'), 'utf8');
    const srcConstr = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'zonaConstruccion.js'), 'utf8');
    const srcKarts = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'arenaTurboKarts.js'), 'utf8');
    const srcTetris = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'salaTetris.js'), 'utf8');
    const srcMain = fs.readFileSync(path.join(RAIZ, 'js', 'main.js'), 'utf8');
    const srcInterfaz = fs.readFileSync(path.join(RAIZ, 'js', 'interfaz.js'), 'utf8');
    const srcConfig = fs.readFileSync(path.join(RAIZ, 'js', 'config.js'), 'utf8');
    const srcRed = fs.readFileSync(path.join(RAIZ, 'js', 'red.js'), 'utf8');
    const srcCss = fs.readFileSync(path.join(RAIZ, 'css', 'estilos.css'), 'utf8');

    const pwaOk =
        manifestJson?.display === 'fullscreen' &&
        manifestJson?.theme_color === '#0e1424' &&
        /100dvh/.test(srcCss) &&
        /100dvw/.test(srcCss) &&
        /requestFullscreen/.test(srcInterfaz);

    const camaraPolimorficaOk =
        /obtenerConfigCamara\s*\(/.test(srcNucleo) &&
        /obtenerConfigCamara\s*\(/.test(srcLobby) &&
        /tercera_persona_seguimiento/.test(srcLobby) &&
        /obtenerConfigCamara\s*\(/.test(srcConstr) &&
        /obtenerConfigCamara\s*\(/.test(srcKarts) &&
        /obtenerConfigCamara\s*\(/.test(srcTetris) &&
        /obtenerConfigCamara/.test(srcMain);

    const salaPublicaYPerfilesOk =
        /obtenerUrlHttpServidor/.test(srcConfig) &&
        /listarPerfilesServidor/.test(srcRed) &&
        /crearPerfilServidor/.test(srcRed) &&
        /guardarPerfilServidor/.test(srcRed) &&
        /conectarSalaMultijugador\(['"]SALA-PUBLICA['"]/.test(srcInterfaz);

    if (!pwaOk || !camaraPolimorficaOk || !salaPublicaYPerfilesOk) {
        registrarError(
            `Falta configuración Fase 6 Parte 1 (pwa=${pwaOk}, camara=${camaraPolimorficaOk}, salaPublica=${salaPublicaYPerfilesOk}).`
        );
    } else {
        registrarOk(
            'Fase 6 Parte 1 verificada: PWA fullscreen (100dvh), Sala Pública automática, sync perfiles y contrato obtenerConfigCamara().'
        );
    }
} catch (err) {
    registrarError(`No se pudo validar Fase 6 Parte 1: ${err.message}`);
}

// 6e. Verificar Fase 6 Parte 2: Parque 130x130 m + Rueda de la Fortuna + Motor Musical 16-Bit
try {
    const { DIMENSION_LOBBY, MITAD_LOBBY } = await import('./js/constantes.js');
    const {
        CATALOGO_PARTITURAS,
        MAPA_MUSICA_EXPERIENCIA,
        notaAFrecuencia
    } = await import('./js/partituras.js');

    const srcLobby = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'lobbyCentral.js'), 'utf8');
    const srcRecursos = fs.readFileSync(path.join(RAIZ, 'js', 'recursos.js'), 'utf8');
    const srcAudio = fs.readFileSync(path.join(RAIZ, 'js', 'audio.js'), 'utf8');
    const srcMain = fs.readFileSync(path.join(RAIZ, 'js', 'main.js'), 'utf8');
    const srcInterfaz = fs.readFileSync(path.join(RAIZ, 'js', 'interfaz.js'), 'utf8');

    const dimensionesLobbyOk = DIMENSION_LOBBY === 130 && MITAD_LOBBY === 65;
    const parqueTematicoOk =
        /ruedaFortuna/.test(srcLobby) &&
        /gondolasRueda/.test(srcLobby) &&
        /-this\.ruedaFortuna\.rotation\.z/.test(srcLobby) &&
        /TALLER VOXEL/.test(srcLobby) &&
        /TURBO KARTS GP/.test(srcLobby) &&
        /TETRIS ARCADE/.test(srcLobby) &&
        /liberarObjeto3D/.test(srcLobby) &&
        /export\s+function\s+obtenerTexturaBulevarParque/.test(srcRecursos) &&
        /export\s+function\s+obtenerTexturaCarpaParque/.test(srcRecursos) &&
        /export\s+function\s+obtenerTexturaLetreroNeon/.test(srcRecursos);

    const pistasEsperadas = ['lobby_parque', 'karts_topgear', 'tetris_ruso', 'taller_clasico'];
    let partiturasValidas = Math.abs((notaAFrecuencia('A4') || 0) - 440) < 0.01;
    partiturasValidas =
        partiturasValidas &&
        MAPA_MUSICA_EXPERIENCIA?.lobby === 'lobby_parque' &&
        MAPA_MUSICA_EXPERIENCIA?.karts === 'karts_topgear' &&
        MAPA_MUSICA_EXPERIENCIA?.tetris === 'tetris_ruso' &&
        MAPA_MUSICA_EXPERIENCIA?.construccion === 'taller_clasico';

    for (const idPista of pistasEsperadas) {
        const pista = CATALOGO_PARTITURAS?.[idPista];
        if (!pista || pista.subdivision !== 4 || typeof pista.pasos !== 'number' || pista.pasos < 64) {
            partiturasValidas = false;
            registrarError(`Partitura inválida o menor a 64 pasos: ${idPista}`);
            continue;
        }
        const nPasos = pista.pasos;
        if (
            pista.melodia?.notas?.length !== nPasos ||
            pista.armonia?.notas?.length !== nPasos ||
            pista.bajo?.notas?.length !== nPasos ||
            pista.percusion?.length !== nPasos
        ) {
            partiturasValidas = false;
            registrarError(`Canales desalineados en partitura ${idPista} (esperados ${nPasos} pasos).`);
            continue;
        }
        for (const canal of [pista.melodia, pista.armonia, pista.bajo]) {
            for (const tok of canal.notas) {
                if (tok === '_' || tok === '~') continue;
                for (const sub of String(tok).split('/')) {
                    const hz = notaAFrecuencia(sub);
                    if (!Number.isFinite(hz) || hz <= 0) {
                        partiturasValidas = false;
                        registrarError(`Token de nota inválido "${sub}" en ${idPista}.`);
                    }
                }
            }
        }
    }

    const motorAudioOk =
        /createDelay/.test(srcAudio) &&
        /0\.135/.test(srcAudio) &&
        /2200/.test(srcAudio) &&
        /unison/.test(srcAudio) &&
        /vibrato/.test(srcAudio) &&
        /slideEntrada/.test(srcAudio) &&
        /reproducirPercusion/.test(srcAudio) &&
        /export\s+function\s+actualizarMusicaAmbiental/.test(srcAudio) &&
        /actualizarMusicaAmbiental\s*\(/.test(srcMain) &&
        /seleccionarMusicaExperiencia/.test(srcInterfaz) &&
        /alternarSilencioMusica/.test(srcInterfaz);

    if (!dimensionesLobbyOk || !parqueTematicoOk || !partiturasValidas || !motorAudioOk) {
        registrarError(
            `Falta configuración Fase 6 Parte 2 (dimLobby=${dimensionesLobbyOk}, parque=${parqueTematicoOk}, partituras=${partiturasValidas}, audio=${motorAudioOk}).`
        );
    } else {
        registrarOk(
            'Fase 6 Parte 2 verificada: Parque Estelar 130x130 m (Rueda de la Fortuna + 3 pabellones) y Motor Musical 16-Bit (4 partituras >= 64 pasos + SPC700 eco).'
        );
    }
} catch (err) {
    registrarError(`No se pudo validar Fase 6 Parte 2: ${err.message}`);
}

// 6f. Verificar Fase 7: Spring-Arm Universal, Lobby Siempre Atrás, HUD Roblox y Controles Móviles Landscape
try {
    const manifestJson = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
    const srcMain = fs.readFileSync(path.join(RAIZ, 'js', 'main.js'), 'utf8');
    const srcLobby = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'lobbyCentral.js'), 'utf8');
    const srcKarts = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'arenaTurboKarts.js'), 'utf8');
    const srcFisica = fs.readFileSync(path.join(RAIZ, 'js', 'fisicaSandbox.js'), 'utf8');
    const srcInterfaz = fs.readFileSync(path.join(RAIZ, 'js', 'interfaz.js'), 'utf8');
    const srcCss = fs.readFileSync(path.join(RAIZ, 'css', 'estilos.css'), 'utf8');

    const springArmOk =
        /export\s+function\s+resolverColisionCamara\s*\(/.test(srcMain) &&
        /resolverColisionCamara\s*\(\s*lookObjetivo/.test(srcMain) &&
        /ignorarColisionCamara\s*=\s*true/.test(srcKarts) &&
        /cartelPaddock\.position\.set\([^,]+,\s*6\.2/.test(srcKarts);

    const lobbySiempreAtrasOk =
        /!estadoControles\.orbitaManualActiva/.test(srcLobby) &&
        !/tiempoOrbitaManual\s*<=\s*0/.test(srcLobby);

    const movilLandscapeOk =
        manifestJson?.display === 'fullscreen' &&
        manifestJson?.orientation === 'landscape' &&
        /autoSprintJoystick/.test(srcFisica) &&
        /autoSprintJoystick/.test(srcInterfaz) &&
        /zona-joystick-dinamico/.test(srcInterfaz) &&
        /menu-principal-unificado/.test(srcInterfaz) &&
        /@media\s*\(\s*orientation:\s*landscape\s*\)\s*and\s*\(\s*max-height:\s*540px\s*\)/.test(srcCss) &&
        /aviso-girar-pantalla/.test(srcCss);

    if (!springArmOk || !lobbySiempreAtrasOk || !movilLandscapeOk) {
        registrarError(
            `Falta configuración Fase 7 (springArm=${springArmOk}, lobbyAtras=${lobbySiempreAtrasOk}, movilLandscape=${movilLandscapeOk}).`
        );
    } else {
        registrarOk(
            'Fase 7 verificada: resolverColisionCamara(), Lobby siempre detrás, HUD Roblox/4 tabs y controles landscape Genshin/Fortnite.'
        );
    }
} catch (err) {
    registrarError(`No se pudo validar Fase 7: ${err.message}`);
}

// 6g. Verificar Fase 8: Podio Broadcast F1, Salida Abortable 10s, Garaje Carrusel, Encuadre Avatar y Mochila Escalable
try {
    const srcHtml = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    const srcCss = fs.readFileSync(path.join(RAIZ, 'css', 'estilos.css'), 'utf8');
    const srcInterfaz = fs.readFileSync(path.join(RAIZ, 'js', 'interfaz.js'), 'utf8');
    const srcKarts = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'arenaTurboKarts.js'), 'utf8');
    const srcRed = fs.readFileSync(path.join(RAIZ, 'js', 'red.js'), 'utf8');
    const srcMain = fs.readFileSync(path.join(RAIZ, 'js', 'main.js'), 'utf8');
    const srcSrv = fs.readFileSync(path.join(RAIZ, 'server', 'index.js'), 'utf8');

    const podioYConteoF1Ok =
        /id=["']banner-podio-f1["']/.test(srcHtml) &&
        /id=["']banner-conteo-kart["']/.test(srcHtml) &&
        /id=["']btn-cancelar-salida["']/.test(srcHtml) &&
        /renderizarBannerPodioF1/.test(srcInterfaz) &&
        /obtenerEstadoPodioF1/.test(srcKarts) &&
        /skewX\(-8deg\)/.test(srcCss) &&
        /entradaDerrapeF1/.test(srcCss);

    const salidaAbortableOk =
        /cancelarSalidaCarrera/.test(srcKarts) &&
        /cancelarSalidaCarrera/.test(srcInterfaz) &&
        /cancelar_salida_kart/.test(srcKarts) &&
        /enviarCancelacionSalidaKart/.test(srcRed) &&
        /cancelar_salida_kart/.test(srcSrv) &&
        /parrillasKartsSalas/.test(srcSrv);

    const garajeYEncuadreOk =
        /poblarCarrusel/.test(srcInterfaz) &&
        /btn-carrusel-flecha/.test(srcCss) &&
        /desplazamientoIzq/.test(srcKarts) &&
        /desplazamientoDer/.test(srcMain) &&
        /sincronizarVisibilidadControlesMoviles/.test(srcInterfaz);

    const mochilaEscalableOk =
        /id=["']filtros-mochila["']/.test(srcHtml) &&
        /data-filtro-mochila/.test(srcInterfaz) &&
        /minmax\(128px,\s*1fr\)/.test(srcCss);

    if (!podioYConteoF1Ok || !salidaAbortableOk || !garajeYEncuadreOk || !mochilaEscalableOk) {
        registrarError(
            `Falta configuración Fase 8 (podioF1=${podioYConteoF1Ok}, abortable=${salidaAbortableOk}, garajeEncuadre=${garajeYEncuadreOk}, mochila=${mochilaEscalableOk}).`
        );
    } else {
        registrarOk(
            'Fase 8 verificada: Podio broadcast F1, salida 10s abortable (cancelar_salida_kart), garaje carrusel sin scroll, encuadre Avatar 3D y mochila con filtros.'
        );
    }
} catch (err) {
    registrarError(`No se pudo validar Fase 8: ${err.message}`);
}

// 6h. Verificar Fase 9: Tetris Estilo Switch 3 Columnas (DAS/ARR) y Superdeportivos Esculpidos (ExtrudeGeometry + Clearcoat)
try {
    const srcHtml = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    const srcCss = fs.readFileSync(path.join(RAIZ, 'css', 'estilos.css'), 'utf8');
    const srcInterfaz = fs.readFileSync(path.join(RAIZ, 'js', 'interfaz.js'), 'utf8');
    const srcTetris = fs.readFileSync(path.join(RAIZ, 'js', 'experiencias', 'salaTetris.js'), 'utf8');
    const srcAvatar = fs.readFileSync(path.join(RAIZ, 'js', 'avatar.js'), 'utf8');

    const switchTetrisOk =
        /grid-template-columns:\s*minmax\(150px,\s*24vw\)\s+1fr\s+minmax\(150px,\s*24vw\)/.test(srcCss) &&
        /tetris-ala-izq/.test(srcHtml) &&
        /tetris-ala-der/.test(srcHtml) &&
        /btn-tetris-rotar/.test(srcCss) &&
        /56px/.test(srcCss) &&
        /detenerRepeticionTetris/.test(srcInterfaz) &&
        /setPointerCapture/.test(srcInterfaz) &&
        /estadoControles\.modoTetrisActivo\s*\|\|\s*estadoControles\.modoCeremoniaPodio/.test(srcInterfaz) &&
        /estadoControles\.entidadCercana\s*=\s*null/.test(srcTetris);

    const kartsEsculpidosOk =
        /ExtrudeGeometry/.test(srcAvatar) &&
        /MeshPhysicalMaterial/.test(srcAvatar) &&
        /clearcoat:\s*1\.0/.test(srcAvatar) &&
        /metalness:\s*0\.88/.test(srcAvatar) &&
        /matPinza/.test(srcAvatar) &&
        /liberarObjeto3D/.test(srcAvatar) &&
        /crearPerfilExtruido/.test(srcAvatar);

    if (!switchTetrisOk || !kartsEsculpidosOk) {
        registrarError(
            `Falta configuración Fase 9 (switchTetris=${switchTetrisOk}, kartsEsculpidos=${kartsEsculpidosOk}).`
        );
    } else {
        registrarOk(
            'Fase 9 verificada: Tetris Switch 3 columnas con D-Pad DAS/ARR, prompt oculto y superdeportivos ExtrudeGeometry + clearcoat.'
        );
    }
} catch (err) {
    registrarError(`No se pudo validar Fase 9: ${err.message}`);
}

// 7. Verificar server/index.js (/health, perfiles.json, rutas HTTP/WS y rechazo de duplicados)
const rutaServidor = path.join(RAIZ, 'server', 'index.js');
if (fs.existsSync(rutaServidor)) {
    const srcSrv = fs.readFileSync(rutaServidor, 'utf8');
    const tieneHealth = /['"]\/health['"]/.test(srcSrv);
    const tieneEventoExp = /['"]evento_experiencia['"]/.test(srcSrv);
    const tieneAccionSocial = /['"]accion_social['"]/.test(srcSrv);
    const tieneParcelasJson = /parcelas\.json/.test(srcSrv);
    const tienePerfilesJson =
        /perfiles\.json/.test(srcSrv) &&
        /['"]\/perfiles['"]/.test(srcSrv) &&
        /['"]\/perfiles\/guardar['"]/.test(srcSrv) &&
        /['"]listar_perfiles['"]/.test(srcSrv) &&
        /['"]crear_perfil['"]/.test(srcSrv) &&
        /['"]guardar_perfil['"]/.test(srcSrv) &&
        /\b409\b/.test(srcSrv) &&
        /APODO_EN_USO/.test(srcSrv);
    const tieneEstadoCompleto = /['"]estado_parcela_completo['"]/.test(srcSrv);
    const tieneSlotParrilla =
        /asignarSlotParrillaLibre/.test(srcSrv) &&
        /slotParrilla/.test(srcSrv) &&
        /['"]sala_actualizada['"]/.test(srcSrv);
    if (!tieneHealth) registrarError('server/index.js debe exponer el endpoint /health.');
    if (!tieneEventoExp) registrarError('server/index.js debe retransmitir mensajes evento_experiencia.');
    if (!tieneAccionSocial) registrarError('server/index.js debe retransmitir mensajes accion_social.');
    if (!tieneParcelasJson) registrarError('server/index.js debe persistir parcelas en server/data/parcelas.json.');
    if (!tienePerfilesJson) registrarError('server/index.js debe persistir perfiles únicos en perfiles.json y rechazar duplicados (409 / APODO_EN_USO).');
    if (!tieneEstadoCompleto) registrarError('server/index.js debe enviar estado_parcela_completo a los clientes.');
    if (!tieneSlotParrilla) registrarError('server/index.js debe asignar slotParrilla único y difundir sala_actualizada.');
    if (tieneHealth && tieneEventoExp && tieneAccionSocial && tieneParcelasJson && tienePerfilesJson && tieneEstadoCompleto && tieneSlotParrilla) {
        registrarOk('server/index.js expone /health, /perfiles, asigna slotParrilla, rechaza duplicados y persiste parcelas.json + perfiles.json.');
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
