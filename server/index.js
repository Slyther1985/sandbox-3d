'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const DIR_DATOS = path.join(__dirname, 'data');
const ARCHIVO_PARCELAS = path.join(DIR_DATOS, 'parcelas.json');
const ARCHIVO_PERFILES = path.join(DIR_DATOS, 'perfiles.json');

const TIPOS_BLOQUE_VALIDOS = new Set([
    'cesped',
    'tierra',
    'piedra',
    'madera',
    'ladrillo',
    'cristal',
    'neon_cian',
    'oro'
]);

const BLOQUES_SEMILLA = [
    { x: -1, y: 0, z: 0, tipo: 'madera' },
    { x: 0, y: 0, z: 0, tipo: 'neon_cian' },
    { x: 1, y: 0, z: 0, tipo: 'madera' },
    { x: 0, y: 1, z: 0, tipo: 'oro' }
];

/** @type {Map<string, Map<string, { ws: WebSocket, datos: object }>>} */
const salas = new Map();

/** @type {Map<string, Map<string, { x: number, y: number, z: number, tipo: string }>>} */
const parcelasSalas = new Map();

/** @type {Map<string, Set<string>>} */
const parrillasKartsSalas = new Map();

/** @type {Map<string, object>} */
const perfiles = new Map();

let timerGuardado = null;
let timerGuardadoPerfiles = null;

/**
 * Normaliza un apodo para usarlo como clave única insensible a mayúsculas.
 * @param {string} apodo
 * @returns {string}
 */
function normalizarApodo(apodo) {
    return String(apodo || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/**
 * Limpia un apodo conservando mayúsculas/minúsculas originales (máx. 18 caracteres).
 * @param {string} apodo
 * @returns {string}
 */
function limpiarApodo(apodo) {
    return String(apodo || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 18);
}

/**
 * Sanitiza y completa el esquema canónico de perfil de jugador.
 * @param {object} datos
 * @param {string} [apodoFallback]
 * @returns {object}
 */
function sanitizarPerfil(datos, apodoFallback = 'Jugador') {
    const src = datos && typeof datos === 'object' ? datos : {};
    const apodoLimpio = limpiarApodo(apodoFallback || src.apodo || 'Jugador') || 'Jugador';
    const bloquesValidos = [];
    if (Array.isArray(src.construccionGuardada)) {
        for (const item of src.construccionGuardada) {
            const b = normalizarBloque(item);
            if (b) bloquesValidos.push(b);
        }
    }

    const apSrc = src.apariencia && typeof src.apariencia === 'object' ? src.apariencia : {};
    const eqSrc = src.equipado && typeof src.equipado === 'object' ? src.equipado : {};
    const kartSrc = src.configKart && typeof src.configKart === 'object' ? src.configKart : {};
    const inv = Array.isArray(src.inventario) && src.inventario.length
        ? Array.from(new Set(src.inventario.map((i) => String(i)).filter(Boolean)))
        : ['gorra_neon'];
    if (!inv.includes('gorra_neon')) inv.unshift('gorra_neon');

    return {
        apodo: apodoLimpio,
        monedas: typeof src.monedas === 'number' && Number.isFinite(src.monedas) && src.monedas >= 0 ? Math.floor(src.monedas) : 50,
        nivel: typeof src.nivel === 'number' && Number.isFinite(src.nivel) && src.nivel >= 1 ? Math.floor(src.nivel) : 1,
        xp: typeof src.xp === 'number' && Number.isFinite(src.xp) && src.xp >= 0 ? Math.floor(src.xp) : 0,
        inventario: inv,
        equipado: {
            cabeza: typeof eqSrc.cabeza === 'string' ? eqSrc.cabeza : (eqSrc.cabeza === null ? null : 'gorra_neon'),
            espalda: typeof eqSrc.espalda === 'string' ? eqSrc.espalda : null,
            aura: typeof eqSrc.aura === 'string' ? eqSrc.aura : null
        },
        apariencia: {
            piel: typeof apSrc.piel === 'string' && /^#[0-9a-fA-F]{6}$/.test(apSrc.piel) ? apSrc.piel : '#ffdbac',
            torso: typeof apSrc.torso === 'string' && /^#[0-9a-fA-F]{6}$/.test(apSrc.torso) ? apSrc.torso : '#2563eb',
            piernas: typeof apSrc.piernas === 'string' && /^#[0-9a-fA-F]{6}$/.test(apSrc.piernas) ? apSrc.piernas : '#1e293b',
            rostro: typeof apSrc.rostro === 'string' ? apSrc.rostro : 'feliz'
        },
        construccionGuardada: bloquesValidos,
        configKart: {
            chasis: typeof kartSrc.chasis === 'string' ? kartSrc.chasis : 'kart_batmovil',
            ruedas: typeof kartSrc.ruedas === 'string' ? kartSrc.ruedas : 'rueda_clasica',
            aleron: typeof kartSrc.aleron === 'string' ? kartSrc.aleron : 'aleron_gt',
            color: typeof kartSrc.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(kartSrc.color) ? kartSrc.color : '#ff2e4c'
        },
        mejorVueltaKart:
            typeof src.mejorVueltaKart === 'number' && Number.isFinite(src.mejorVueltaKart) && src.mejorVueltaKart > 1
                ? src.mejorVueltaKart
                : null,
        mejorPuntajeTetris:
            typeof src.mejorPuntajeTetris === 'number' && Number.isFinite(src.mejorPuntajeTetris) && src.mejorPuntajeTetris >= 0
                ? Math.floor(src.mejorPuntajeTetris)
                : 0,
        favoritosMundos: Array.isArray(src.favoritosMundos)
            ? Array.from(
                  new Set(
                      src.favoritosMundos
                          .filter((id) => typeof id === 'string' && id.trim().length > 0)
                          .map((id) => id.trim().slice(0, 32))
                  )
              )
            : [],
        progresoExperiencias:
            src.progresoExperiencias && typeof src.progresoExperiencias === 'object' && !Array.isArray(src.progresoExperiencias)
                ? Object.fromEntries(
                      Object.entries(src.progresoExperiencias)
                          .filter(([k, v]) => v && typeof v === 'object' && !Array.isArray(v))
                          .map(([k, v]) => [String(k).slice(0, 32), { ...v }])
                  )
                : {},
        ultimaConexion: typeof src.ultimaConexion === 'number' && Number.isFinite(src.ultimaConexion) ? src.ultimaConexion : Date.now()
    };
}

/**
 * Valida y normaliza un bloque voxel recibido del cliente o de disco.
 * @param {object} b
 * @returns {{ x: number, y: number, z: number, tipo: string }|null}
 */
function normalizarBloque(b) {
    if (!b || typeof b !== 'object') return null;
    const x = Math.round(Number(b.x));
    const y = Math.round(Number(b.y));
    const z = Math.round(Number(b.z));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    if (x < -16 || x >= 16 || z < -16 || z >= 16 || y < 0 || y > 23) return null;
    const tipo = TIPOS_BLOQUE_VALIDOS.has(b.tipo) ? b.tipo : 'cesped';
    return { x, y, z, tipo };
}

/**
 * Carga parcelas persistidas desde `server/data/parcelas.json` al iniciar.
 */
function cargarParcelasDisco() {
    try {
        fs.mkdirSync(DIR_DATOS, { recursive: true });
        if (!fs.existsSync(ARCHIVO_PARCELAS)) {
            fs.writeFileSync(ARCHIVO_PARCELAS, '{}', 'utf8');
            return;
        }
        const raw = fs.readFileSync(ARCHIVO_PARCELAS, 'utf8');
        const json = JSON.parse(raw || '{}');
        for (const [codigoSala, lista] of Object.entries(json)) {
            if (!Array.isArray(lista)) continue;
            const mapa = new Map();
            for (const item of lista) {
                const limpio = normalizarBloque(item);
                if (limpio) {
                    mapa.set(`${limpio.x},${limpio.y},${limpio.z}`, limpio);
                }
            }
            parcelasSalas.set(codigoSala, mapa);
        }
    } catch (err) {
        console.error('[sandbox-3d-server] Error cargando parcelas:', err.message);
    }
}

/**
 * Programa escritura asíncrona con debounce a `server/data/parcelas.json`.
 */
function programarGuardadoParcelas() {
    if (timerGuardado) clearTimeout(timerGuardado);
    timerGuardado = setTimeout(() => {
        timerGuardado = null;
        const salida = {};
        for (const [codigoSala, mapa] of parcelasSalas.entries()) {
            salida[codigoSala] = Array.from(mapa.values());
        }
        fs.mkdir(DIR_DATOS, { recursive: true }, () => {
            fs.writeFile(ARCHIVO_PARCELAS, JSON.stringify(salida, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('[sandbox-3d-server] Error guardando parcelas.json:', err.message);
                }
            });
        });
    }, 300);
}

/**
 * Obtiene (o inicializa con bloques semilla) el mapa autoritativo de bloques de una sala.
 * @param {string} codigoSala
 * @returns {Map<string, { x: number, y: number, z: number, tipo: string }>}
 */
function obtenerMapaParcelaSala(codigoSala) {
    if (!parcelasSalas.has(codigoSala)) {
        const mapa = new Map();
        for (const b of BLOQUES_SEMILLA) {
            mapa.set(`${b.x},${b.y},${b.z}`, { ...b });
        }
        parcelasSalas.set(codigoSala, mapa);
        programarGuardadoParcelas();
    }
    return parcelasSalas.get(codigoSala);
}

/**
 * Devuelve la lista serializable de bloques de la parcela de una sala.
 * @param {string} codigoSala
 * @returns {Array<{ x: number, y: number, z: number, tipo: string }>}
 */
function obtenerListaBloquesSala(codigoSala) {
    return Array.from(obtenerMapaParcelaSala(codigoSala).values());
}

/**
 * Obtiene (o crea) el conjunto de jugadores activos en la parrilla de salida de karts de una sala.
 * @param {string} codigoSala
 * @returns {Set<string>}
 */
function obtenerParrillaSala(codigoSala) {
    if (!parrillasKartsSalas.has(codigoSala)) {
        parrillasKartsSalas.set(codigoSala, new Set());
    }
    return parrillasKartsSalas.get(codigoSala);
}

/**
 * Envía un paquete JSON de forma segura a un cliente conectado.
 * @param {WebSocket} ws
 * @param {object} payload
 */
function enviarSeguro(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

/**
 * Envía el estado completo de la parcela voxel autoritativa de la sala al cliente.
 * @param {WebSocket} ws
 * @param {string} codigoSala
 */
function enviarEstadoParcelaCompleto(ws, codigoSala) {
    const bloques = obtenerListaBloquesSala(codigoSala);
    enviarSeguro(ws, {
        tipo: 'evento_experiencia',
        origenId: 'servidor',
        experienciaId: 'construccion',
        subtipo: 'estado_parcela_completo',
        accion: 'estado_parcela_completo',
        bloques,
        datos: {
            accion: 'estado_parcela_completo',
            bloques
        },
        timestamp: Date.now()
    });
}

/**
 * Asigna el menor cajón de parrilla libre (`0` a `7`) dentro de una sala.
 * @param {Map<string, { ws: WebSocket, datos: object }>} sala
 * @param {string|null} [idJugadorActual]
 * @returns {number}
 */
function asignarSlotParrillaLibre(sala, idJugadorActual = null) {
    const ocupados = new Set();
    for (const [id, miembro] of sala.entries()) {
        if (id === idJugadorActual) continue;
        const slot = miembro?.datos?.slotParrilla;
        if (typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < 8) {
            ocupados.add(slot);
        }
    }
    for (let slot = 0; slot < 8; slot++) {
        if (!ocupados.has(slot)) return slot;
    }
    return sala.size % 8;
}

/**
 * Difunde un mensaje JSON a todos los miembros de una sala (excepto emisor opcional).
 * @param {string} codigoSala
 * @param {object} payload
 * @param {string|null} excluirId
 */
function difundirASala(codigoSala, payload, excluirId = null) {
    const sala = salas.get(codigoSala);
    if (!sala) return;
    const serializado = JSON.stringify(payload);
    for (const [idMiembro, miembro] of sala.entries()) {
        if (excluirId && idMiembro === excluirId) continue;
        if (miembro.ws.readyState === WebSocket.OPEN) {
            miembro.ws.send(serializado);
        }
    }
}

/**
 * Carga perfiles persistidos desde `server/data/perfiles.json` al iniciar.
 */
function cargarPerfilesDisco() {
    try {
        fs.mkdirSync(DIR_DATOS, { recursive: true });
        if (!fs.existsSync(ARCHIVO_PERFILES)) {
            fs.writeFileSync(ARCHIVO_PERFILES, '{}', 'utf8');
            return;
        }
        const raw = fs.readFileSync(ARCHIVO_PERFILES, 'utf8');
        const json = JSON.parse(raw || '{}');
        for (const [clave, valor] of Object.entries(json)) {
            const limpio = sanitizarPerfil(valor, valor?.apodo || clave);
            const norm = normalizarApodo(limpio.apodo);
            if (norm.length >= 2) {
                perfiles.set(norm, limpio);
            }
        }
    } catch (err) {
        console.error('[sandbox-3d-server] Error cargando perfiles:', err.message);
    }
}

/**
 * Programa escritura asíncrona con debounce a `server/data/perfiles.json`.
 */
function programarGuardadoPerfiles() {
    if (timerGuardadoPerfiles) clearTimeout(timerGuardadoPerfiles);
    timerGuardadoPerfiles = setTimeout(() => {
        timerGuardadoPerfiles = null;
        const salida = {};
        for (const [clave, perfil] of perfiles.entries()) {
            salida[clave] = perfil;
        }
        fs.mkdir(DIR_DATOS, { recursive: true }, () => {
            fs.writeFile(ARCHIVO_PERFILES, JSON.stringify(salida, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('[sandbox-3d-server] Error guardando perfiles.json:', err.message);
                }
            });
        });
    }, 300);
}

/**
 * Devuelve un Set con los apodos normalizados conectados actualmente en alguna sala.
 * @returns {Set<string>}
 */
function obtenerApodosEnLinea() {
    const activos = new Set();
    for (const sala of salas.values()) {
        for (const miembro of sala.values()) {
            if (miembro?.ws?.readyState === WebSocket.OPEN && miembro?.datos?.apodo) {
                activos.add(normalizarApodo(miembro.datos.apodo));
            }
        }
    }
    return activos;
}

/**
 * Construye la lista pública de perfiles registrados con indicador `enLinea`.
 * @returns {Array<object>}
 */
function construirListaPerfiles() {
    const enLinea = obtenerApodosEnLinea();
    const lista = [];
    for (const [clave, perfil] of perfiles.entries()) {
        lista.push({
            ...perfil,
            enLinea: enLinea.has(clave)
        });
    }
    lista.sort((a, b) => {
        if (a.enLinea !== b.enLinea) return a.enLinea ? -1 : 1;
        return (b.ultimaConexion || 0) - (a.ultimaConexion || 0);
    });
    return lista;
}

/**
 * Intenta crear un perfil único insensible a mayúsculas.
 * @param {string} apodoRaw
 * @param {object} [datosIniciales]
 * @returns {{ ok: boolean, status: number, perfil?: object, error?: string }}
 */
function crearPerfilUnico(apodoRaw, datosIniciales = {}) {
    const apodoLimpio = limpiarApodo(apodoRaw);
    const apodoNorm = normalizarApodo(apodoLimpio);
    if (apodoLimpio.length < 2 || apodoLimpio.length > 18) {
        return {
            ok: false,
            status: 400,
            error: 'El nombre debe tener entre 2 y 18 caracteres.'
        };
    }
    if (perfiles.has(apodoNorm)) {
        return {
            ok: false,
            status: 409,
            error: 'Ese nombre ya existe. Elige otro o selecciona tu jugador.'
        };
    }
    const nuevo = sanitizarPerfil({ ...datosIniciales, ultimaConexion: Date.now() }, apodoLimpio);
    perfiles.set(apodoNorm, nuevo);
    programarGuardadoPerfiles();
    return { ok: true, status: 201, perfil: nuevo };
}

/**
 * Actualiza y persiste la instantánea de un perfil existente (o lo registra si no estaba).
 * @param {object} datosRaw
 * @returns {{ ok: boolean, status: number, perfil?: object, error?: string }}
 */
function guardarPerfilExistente(datosRaw) {
    const src = datosRaw && typeof datosRaw === 'object' ? datosRaw : {};
    const apodoLimpio = limpiarApodo(src.apodo);
    const apodoNorm = normalizarApodo(apodoLimpio);
    if (apodoLimpio.length < 2) {
        return { ok: false, status: 400, error: 'Apodo inválido para guardar perfil.' };
    }
    const previo = perfiles.get(apodoNorm);
    const apodoCanonico = previo?.apodo || apodoLimpio;
    const actualizado = sanitizarPerfil({ ...previo, ...src, ultimaConexion: Date.now() }, apodoCanonico);
    perfiles.set(apodoNorm, actualizado);
    programarGuardadoPerfiles();
    return { ok: true, status: 200, perfil: actualizado };
}

/**
 * Lee y parsea de forma segura el cuerpo JSON de una petición HTTP (máx. 64 KB).
 * @param {http.IncomingMessage} req
 * @param {number} [maxBytes]
 * @returns {Promise<object>}
 */
function leerCuerpoJson(req, maxBytes = 65536) {
    return new Promise((resolve, reject) => {
        let tam = 0;
        const trozos = [];
        req.on('data', (chunk) => {
            tam += chunk.length;
            if (tam > maxBytes) {
                reject(new Error('Cuerpo demasiado grande'));
                req.destroy();
                return;
            }
            trozos.push(chunk);
        });
        req.on('end', () => {
            try {
                const texto = Buffer.concat(trozos).toString('utf8');
                resolve(texto ? JSON.parse(texto) : {});
            } catch (_err) {
                reject(new Error('JSON inválido'));
            }
        });
        req.on('error', (err) => reject(err));
    });
}

cargarParcelasDisco();
cargarPerfilesDisco();

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlPath = (req.url || '/').split('?')[0];
    if (req.method === 'GET' && (urlPath === '/' || urlPath === '/health')) {
        let totalConexiones = 0;
        for (const sala of salas.values()) {
            totalConexiones += sala.size;
        }
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'ok',
            servicio: 'sandbox-3d-ws',
            salasActivas: salas.size,
            parcelasPersistidas: parcelasSalas.size,
            perfilesRegistrados: perfiles.size,
            conexiones: totalConexiones,
            uptimeSegundos: Math.floor(process.uptime())
        }));
        return;
    }

    if (req.method === 'GET' && urlPath === '/perfiles') {
        res.writeHead(200);
        res.end(JSON.stringify({
            ok: true,
            perfiles: construirListaPerfiles()
        }));
        return;
    }

    if (req.method === 'POST' && urlPath === '/perfiles') {
        try {
            const body = await leerCuerpoJson(req);
            const resultado = crearPerfilUnico(body.apodo, body.perfil || body);
            res.writeHead(resultado.status);
            res.end(JSON.stringify(resultado));
        } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: err.message }));
        }
        return;
    }

    if (req.method === 'POST' && urlPath === '/perfiles/guardar') {
        try {
            const body = await leerCuerpoJson(req);
            const datosPerfil = body.perfil && typeof body.perfil === 'object' ? body.perfil : body;
            const resultado = guardarPerfilExistente(datosPerfil);
            res.writeHead(resultado.status);
            res.end(JSON.stringify(resultado));
        } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: err.message }));
        }
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    let salaActual = null;
    let jugadorId = null;

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch (_err) {
            return;
        }

        if (msg.tipo === 'listar_perfiles') {
            enviarSeguro(ws, {
                tipo: 'lista_perfiles',
                solicitudId: msg.solicitudId || null,
                ok: true,
                perfiles: construirListaPerfiles()
            });
            return;
        }

        if (msg.tipo === 'crear_perfil') {
            const resultado = crearPerfilUnico(msg.apodo, msg.perfil || {});
            enviarSeguro(ws, {
                tipo: 'respuesta_crear_perfil',
                solicitudId: msg.solicitudId || null,
                ok: resultado.ok,
                perfil: resultado.perfil || null,
                error: resultado.error || null
            });
            return;
        }

        if (msg.tipo === 'guardar_perfil' && (msg.perfil || msg.apodo)) {
            const resultado = guardarPerfilExistente(msg.perfil || msg);
            if (msg.solicitudId) {
                enviarSeguro(ws, {
                    tipo: 'respuesta_guardar_perfil',
                    solicitudId: msg.solicitudId,
                    ok: resultado.ok,
                    perfil: resultado.perfil || null,
                    error: resultado.error || null
                });
            }
            return;
        }

        if (msg.tipo === 'unirse_sala' && msg.jugador && msg.jugador.id) {
            const codigo = String(msg.codigoSala || 'SALA-PUBLICA')
                .trim()
                .toUpperCase()
                .slice(0, 20) || 'SALA-PUBLICA';

            if (!salas.has(codigo)) {
                salas.set(codigo, new Map());
            }
            const sala = salas.get(codigo);

            const idSolicitante = String(msg.jugador.id);
            const apodoEntrante = limpiarApodo(msg.jugador.apodo || 'Explorador') || 'Explorador';
            const apodoNorm = normalizarApodo(apodoEntrante);

            // Rechazar si el mismo apodo ya está conectado en otro socket activo dentro de la sala
            for (const [idOtro, miembro] of sala.entries()) {
                if (
                    idOtro !== idSolicitante &&
                    miembro?.ws !== ws &&
                    miembro?.ws?.readyState === WebSocket.OPEN &&
                    normalizarApodo(miembro?.datos?.apodo) === apodoNorm
                ) {
                    if (sala.size === 0) salas.delete(codigo);
                    enviarSeguro(ws, {
                        tipo: 'error_sala',
                        codigo: 'APODO_EN_USO',
                        error: 'Ese jugador ya está conectado en la sala.'
                    });
                    return;
                }
            }

            salaActual = codigo;
            jugadorId = idSolicitante;
            const existente = sala.get(jugadorId);
            const esAnfitrion = sala.size === 0 || Boolean(existente?.datos?.esAnfitrion);
            const slotParrilla =
                typeof existente?.datos?.slotParrilla === 'number'
                    ? existente.datos.slotParrilla
                    : asignarSlotParrillaLibre(sala, jugadorId);

            if (perfiles.has(apodoNorm)) {
                const pExistente = perfiles.get(apodoNorm);
                pExistente.ultimaConexion = Date.now();
                programarGuardadoPerfiles();
            }

            const jugadoresPrevios = [];
            for (const [idOtro, miembro] of sala.entries()) {
                if (idOtro !== jugadorId) {
                    jugadoresPrevios.push(miembro.datos);
                }
            }

            const datosJugador = {
                ...msg.jugador,
                apodo: apodoEntrante,
                id: jugadorId,
                esAnfitrion,
                slotParrilla
            };
            sala.set(jugadorId, { ws, datos: datosJugador });

            enviarSeguro(ws, {
                tipo: 'bienvenida_sala',
                codigoSala: codigo,
                esAnfitrion,
                slotParrilla,
                jugadores: jugadoresPrevios
            });

            // Enviar de inmediato el estado autoritativo de bloques voxel de la sala
            enviarEstadoParcelaCompleto(ws, codigo);

            difundirASala(codigo, {
                tipo: 'jugador_unido',
                jugador: datosJugador
            }, jugadorId);

            difundirASala(codigo, {
                tipo: 'sala_actualizada',
                codigoSala: codigo,
                jugadores: Array.from(sala.values()).map((m) => m.datos)
            });
            return;
        }

        if (!salaActual || !jugadorId) return;
        const sala = salas.get(salaActual);
        if (!sala || !sala.has(jugadorId)) return;

        if (msg.tipo === 'estado_jugador' && msg.jugador) {
            const actual = sala.get(jugadorId);
            const slotParrilla =
                typeof actual.datos.slotParrilla === 'number' ? actual.datos.slotParrilla : 0;
            actual.datos = { ...actual.datos, ...msg.jugador, id: jugadorId, slotParrilla };

            if (actual.datos.experienciaActiva !== 'karts') {
                const parrilla = parrillasKartsSalas.get(salaActual);
                if (parrilla && parrilla.delete(jugadorId) && parrilla.size === 0) {
                    difundirASala(salaActual, {
                        tipo: 'evento_experiencia',
                        origenId: jugadorId,
                        experienciaId: 'karts',
                        subtipo: 'cancelar_salida_kart',
                        accion: 'cancelar_salida_kart',
                        datos: {
                            accion: 'cancelar_salida_kart',
                            jugadorId,
                            restantesEnParrilla: 0,
                            cancelarConteo: true,
                            servidorAutoritativo: true
                        },
                        timestamp: Date.now()
                    });
                }
            }

            difundirASala(salaActual, {
                tipo: 'jugador_actualizado',
                jugador: actual.datos
            }, jugadorId);
            return;
        }

        // Retransmisión genérica + persistencia autoritativa de parcela voxel + parrilla karts
        if (msg.tipo === 'evento_experiencia') {
            const datos = msg.datos && typeof msg.datos === 'object' ? msg.datos : {};
            const accion = msg.accion || datos.accion || msg.subtipo || 'generico';

            if (accion === 'pedir_estado_parcela') {
                enviarEstadoParcelaCompleto(ws, salaActual);
                return;
            }

            if (msg.experienciaId === 'karts') {
                if (accion === 'iniciar_conteo_carrera' || accion === 'unirse_parrilla_kart') {
                    obtenerParrillaSala(salaActual).add(jugadorId);
                } else if (accion === 'iniciar_ceremonia_podio') {
                    parrillasKartsSalas.get(salaActual)?.clear();
                } else if (accion === 'cancelar_salida_kart') {
                    const parrilla = obtenerParrillaSala(salaActual);
                    parrilla.delete(jugadorId);
                    const restantes = parrilla.size;
                    const cancelarConteo = restantes === 0;
                    difundirASala(salaActual, {
                        tipo: 'evento_experiencia',
                        origenId: jugadorId,
                        experienciaId: 'karts',
                        subtipo: 'cancelar_salida_kart',
                        accion: 'cancelar_salida_kart',
                        datos: {
                            ...datos,
                            accion: 'cancelar_salida_kart',
                            jugadorId,
                            restantesEnParrilla: restantes,
                            cancelarConteo,
                            servidorAutoritativo: cancelarConteo
                        },
                        timestamp: Date.now()
                    }, cancelarConteo ? null : jugadorId);
                    return;
                }
            }

            if (msg.experienciaId === 'construccion') {
                const mapaParcela = obtenerMapaParcelaSala(salaActual);

                if (accion === 'colocar_bloque') {
                    const bloque = normalizarBloque(datos);
                    if (!bloque) return;
                    mapaParcela.set(`${bloque.x},${bloque.y},${bloque.z}`, bloque);
                    programarGuardadoParcelas();
                } else if (accion === 'romper_bloque') {
                    const gx = Math.round(Number(datos.x));
                    const gy = Math.round(Number(datos.y));
                    const gz = Math.round(Number(datos.z));
                    if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gz)) return;
                    mapaParcela.delete(`${gx},${gy},${gz}`);
                    programarGuardadoParcelas();
                } else if (accion === 'limpiar_parcela') {
                    mapaParcela.clear();
                    programarGuardadoParcelas();
                } else if (accion === 'sincronizar_parcela') {
                    const lista = Array.isArray(datos.bloques) ? datos.bloques : msg.bloques;
                    if (Array.isArray(lista)) {
                        mapaParcela.clear();
                        for (const item of lista) {
                            const limpio = normalizarBloque(item);
                            if (limpio) {
                                mapaParcela.set(`${limpio.x},${limpio.y},${limpio.z}`, limpio);
                            }
                        }
                        programarGuardadoParcelas();
                    }
                    const bloquesActuales = obtenerListaBloquesSala(salaActual);
                    difundirASala(salaActual, {
                        tipo: 'evento_experiencia',
                        origenId: jugadorId,
                        experienciaId: 'construccion',
                        subtipo: 'estado_parcela_completo',
                        accion: 'estado_parcela_completo',
                        bloques: bloquesActuales,
                        datos: {
                            accion: 'estado_parcela_completo',
                            bloques: bloquesActuales
                        },
                        timestamp: Date.now()
                    }, jugadorId);
                    return;
                }
            }

            difundirASala(salaActual, {
                tipo: 'evento_experiencia',
                origenId: jugadorId,
                experienciaId: msg.experienciaId || 'lobby',
                subtipo: msg.subtipo || 'generico',
                datos,
                timestamp: Date.now()
            }, jugadorId);
            return;
        }

        // Retransmisión social (gestos/emotes y burbujas de chat rápido)
        if (msg.tipo === 'accion_social') {
            difundirASala(salaActual, {
                tipo: 'accion_social',
                origenId: jugadorId,
                apodo: String(msg.apodo || '').slice(0, 18),
                subtipo: msg.subtipo === 'gesto' ? 'gesto' : 'chat',
                valor: String(msg.valor || '').slice(0, 64),
                timestamp: Date.now()
            }, jugadorId);
        }
    });

    ws.on('close', () => {
        if (!salaActual || !jugadorId) return;
        const sala = salas.get(salaActual);
        if (!sala) return;

        const saliente = sala.get(jugadorId);
        sala.delete(jugadorId);
        const parrilla = parrillasKartsSalas.get(salaActual);
        const estabaEnParrilla = parrilla ? parrilla.delete(jugadorId) : false;

        if (sala.size === 0) {
            salas.delete(salaActual);
            parrillasKartsSalas.delete(salaActual);
            return;
        }

        if (estabaEnParrilla && parrilla && parrilla.size === 0) {
            difundirASala(salaActual, {
                tipo: 'evento_experiencia',
                origenId: jugadorId,
                experienciaId: 'karts',
                subtipo: 'cancelar_salida_kart',
                accion: 'cancelar_salida_kart',
                datos: {
                    accion: 'cancelar_salida_kart',
                    jugadorId,
                    restantesEnParrilla: 0,
                    cancelarConteo: true,
                    servidorAutoritativo: true
                },
                timestamp: Date.now()
            });
        }

        let nuevoAnfitrionId = null;
        if (saliente && saliente.datos && saliente.datos.esAnfitrion) {
            const primerEntry = sala.entries().next().value;
            if (primerEntry) {
                nuevoAnfitrionId = primerEntry[0];
                primerEntry[1].datos.esAnfitrion = true;
            }
        }

        difundirASala(salaActual, {
            tipo: 'jugador_salio',
            id: jugadorId,
            nuevoAnfitrionId
        });

        difundirASala(salaActual, {
            tipo: 'sala_actualizada',
            codigoSala: salaActual,
            jugadores: Array.from(sala.values()).map((m) => m.datos)
        });
    });
});

server.listen(PORT, () => {
    console.log(`[sandbox-3d-server] Escuchando HTTP/WS en puerto ${PORT}`);
});
