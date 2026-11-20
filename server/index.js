'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const DIR_DATOS = path.join(__dirname, 'data');
const ARCHIVO_PARCELAS = path.join(DIR_DATOS, 'parcelas.json');

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

let timerGuardado = null;

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

cargarParcelasDisco();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/' || urlPath === '/health') {
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
            conexiones: totalConexiones,
            uptimeSegundos: Math.floor(process.uptime())
        }));
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

        if (msg.tipo === 'unirse_sala' && msg.jugador && msg.jugador.id) {
            const codigo = String(msg.codigoSala || 'SALA-PUBLICA')
                .trim()
                .toUpperCase()
                .slice(0, 20) || 'SALA-PUBLICA';

            if (!salas.has(codigo)) {
                salas.set(codigo, new Map());
            }
            const sala = salas.get(codigo);

            salaActual = codigo;
            jugadorId = String(msg.jugador.id);
            const existente = sala.get(jugadorId);
            const esAnfitrion = sala.size === 0 || Boolean(existente?.datos?.esAnfitrion);
            const slotParrilla =
                typeof existente?.datos?.slotParrilla === 'number'
                    ? existente.datos.slotParrilla
                    : asignarSlotParrillaLibre(sala, jugadorId);

            const jugadoresPrevios = [];
            for (const [idOtro, miembro] of sala.entries()) {
                if (idOtro !== jugadorId) {
                    jugadoresPrevios.push(miembro.datos);
                }
            }

            const datosJugador = {
                ...msg.jugador,
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
            difundirASala(salaActual, {
                tipo: 'jugador_actualizado',
                jugador: actual.datos
            }, jugadorId);
            return;
        }

        // Retransmisión genérica + persistencia autoritativa de parcela voxel
        if (msg.tipo === 'evento_experiencia') {
            const datos = msg.datos && typeof msg.datos === 'object' ? msg.datos : {};
            const accion = msg.accion || datos.accion || msg.subtipo || 'generico';

            if (accion === 'pedir_estado_parcela') {
                enviarEstadoParcelaCompleto(ws, salaActual);
                return;
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

        if (sala.size === 0) {
            salas.delete(salaActual);
            return;
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
