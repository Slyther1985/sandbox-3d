/**
 * Cliente multijugador WebSocket con degradación automática a modo offline,
 * sincronización a 20 Hz e interpolación de avatares remotos.
 */
import { INTERVALO_ENVIO_MS } from './constantes.js';
import { obtenerUrlHttpServidor, obtenerUrlWebSocket } from './config.js';
import {
    construirResumenPerfil,
    estadoControles,
    estadoJugador,
    estadoRed,
    estadoSandbox,
    notificarEstado,
    suscribirEstado
} from './estado.js';
import {
    actualizarAnimacionAvatar,
    actualizarAparienciaAvatar,
    actualizarEtiquetaAvatar,
    crearAvatar3D,
    montarAvatarEnKart,
    mostrarBurbujaChatAvatar
} from './avatar.js';
import { liberarObjeto3D } from './recursos.js';

let socket = null;
let acumuladorEnvioMs = 0;
let escenaActiva = null;
let receptorEventosExperiencia = null;
let timerSyncPerfil = null;
let timerTimeoutConexion = null;
let errorSalaRecibido = false;

/**
 * Ejecuta `fetch` JSON con timeout para soportar cold-start de Azure sin bloquear la UI.
 * @param {string} url
 * @param {object} [opciones]
 * @param {number} [timeoutMs]
 * @returns {Promise<{ ok: boolean, status: number, data: object }>}
 */
async function fetchJsonConTimeout(url, opciones = {}, timeoutMs = 15000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const res = await fetch(url, {
            ...opciones,
            signal: controller ? controller.signal : undefined
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * Obtiene la lista de perfiles únicos persistidos en el servidor.
 * @returns {Promise<{ ok: boolean, offline?: boolean, perfiles: Array<object> }>}
 */
export async function listarPerfilesServidor() {
    try {
        const { ok, data } = await fetchJsonConTimeout(`${obtenerUrlHttpServidor()}/perfiles`, {
            method: 'GET',
            cache: 'no-store'
        }, 15000);
        if (ok && data?.ok && Array.isArray(data.perfiles)) {
            return { ok: true, perfiles: data.perfiles };
        }
        return { ok: false, offline: true, perfiles: [] };
    } catch (_err) {
        return { ok: false, offline: true, perfiles: [] };
    }
}

/**
 * Registra un perfil único en el servidor rechazando duplicados insensibles a mayúsculas.
 * @param {string} apodo
 * @param {object|null} [perfilInicial]
 * @returns {Promise<{ ok: boolean, duplicado?: boolean, offline?: boolean, perfil?: object, error?: string }>}
 */
export async function crearPerfilServidor(apodo, perfilInicial = null) {
    try {
        const { ok, status, data } = await fetchJsonConTimeout(`${obtenerUrlHttpServidor()}/perfiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apodo, perfil: perfilInicial })
        }, 15000);

        if (status === 409) {
            return {
                ok: false,
                duplicado: true,
                error: data?.error || 'Ese nombre ya existe. Elige otro o selecciona tu jugador.'
            };
        }
        if (ok && data?.ok && data?.perfil) {
            return { ok: true, perfil: data.perfil };
        }
        if (status === 400) {
            return { ok: false, error: data?.error || 'El nombre debe tener entre 2 y 18 caracteres.' };
        }
        return { ok: false, offline: true, error: data?.error || 'Servidor no disponible.' };
    } catch (_err) {
        return { ok: false, offline: true, error: 'Servidor no disponible; iniciando en modo local.' };
    }
}

/**
 * Sincroniza la instantánea del perfil actual hacia `server/data/perfiles.json`.
 * @param {object|null} [resumen]
 * @returns {Promise<{ ok: boolean }>}
 */
export async function guardarPerfilServidor(resumen = null) {
    const perfil = resumen || construirResumenPerfil();
    if (!perfil?.apodo || perfil.apodo.trim().length < 2) {
        return { ok: false };
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            tipo: 'guardar_perfil',
            perfil
        }));
        return { ok: true };
    }
    try {
        const { ok } = await fetchJsonConTimeout(`${obtenerUrlHttpServidor()}/perfiles/guardar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perfil })
        }, 8000);
        return { ok };
    } catch (_err) {
        return { ok: false };
    }
}

// Auto-sincronización throttled/debounced al guardar estado local mientras está en línea
suscribirEstado((evento, detalle) => {
    if (evento !== 'perfil_guardado') return;
    if (estadoControles.pantallaBienvenidaActiva || !estadoRed.conectado) return;
    if (timerSyncPerfil) clearTimeout(timerSyncPerfil);
    timerSyncPerfil = setTimeout(() => {
        timerSyncPerfil = null;
        if (estadoRed.conectado) {
            guardarPerfilServidor(detalle);
        }
    }, 1200);
});

/**
 * Registra un manejador adicional para eventos genéricos de experiencia.
 * @param {Function|null} manejador
 */
export function configurarReceptorEventosExperiencia(manejador) {
    receptorEventosExperiencia = manejador;
}

/**
 * Crea o actualiza el registro de un jugador remoto en la escena 3D.
 * @param {object} datos
 * @param {THREE.Scene} escena
 */
function upsertJugadorRemoto(datos, escena) {
    if (!datos || !datos.id || datos.id === estadoJugador.id) return;

    let remoto = estadoRed.jugadoresRemotos.get(datos.id);
    if (!remoto) {
        const avatar = crearAvatar3D({
            id: datos.id,
            apodo: datos.apodo || 'Jugador',
            nivel: datos.nivel || 1,
            apariencia: datos.apariencia || {},
            equipado: datos.equipado || {}
        });
        if (datos.posicion) {
            avatar.position.set(datos.posicion.x || 0, datos.posicion.y || 0, datos.posicion.z || 0);
        }
        avatar.rotation.y = datos.rotacion || 0;
        if (escena) {
            escena.add(avatar);
        }

        remoto = {
            id: datos.id,
            apodo: datos.apodo || 'Jugador',
            nivel: datos.nivel || 1,
            experienciaActiva: datos.experienciaActiva || 'lobby',
            slotParrilla: typeof datos.slotParrilla === 'number' ? datos.slotParrilla : 0,
            enVehiculo: Boolean(datos.enVehiculo),
            configKart: datos.configKart || null,
            configKartSerial: JSON.stringify(datos.configKart || {}),
            apariencia: datos.apariencia || {},
            equipado: datos.equipado || {},
            aparienciaSerial: JSON.stringify(datos.apariencia || {}),
            equipadoSerial: JSON.stringify(datos.equipado || {}),
            objetivoPos: {
                x: datos.posicion?.x || 0,
                y: datos.posicion?.y || 0,
                z: datos.posicion?.z || 0
            },
            objetivoRot: datos.rotacion || 0,
            animacion: datos.animacion || 'idle',
            gestoRemoto: null,
            tiempoGestoRemoto: 0,
            avatar
        };
        if (remoto.enVehiculo) {
            montarAvatarEnKart(remoto.avatar, remoto.configKart, true);
        }
        estadoRed.jugadoresRemotos.set(datos.id, remoto);
        return;
    }

    if (datos.apodo) remoto.apodo = datos.apodo;
    if (typeof datos.nivel === 'number') remoto.nivel = datos.nivel;
    if (datos.experienciaActiva) remoto.experienciaActiva = datos.experienciaActiva;
    if (typeof datos.slotParrilla === 'number') remoto.slotParrilla = datos.slotParrilla;

    if (datos.posicion) {
        remoto.objetivoPos.x = datos.posicion.x ?? remoto.objetivoPos.x;
        remoto.objetivoPos.y = datos.posicion.y ?? remoto.objetivoPos.y;
        remoto.objetivoPos.z = datos.posicion.z ?? remoto.objetivoPos.z;
    }
    if (typeof datos.rotacion === 'number') {
        remoto.objetivoRot = datos.rotacion;
    }
    if (datos.animacion) {
        remoto.animacion = datos.animacion;
    }

    actualizarEtiquetaAvatar(remoto.avatar, remoto.apodo, remoto.nivel);

    const apNuevo = datos.apariencia ? JSON.stringify(datos.apariencia) : remoto.aparienciaSerial;
    const eqNuevo = datos.equipado ? JSON.stringify(datos.equipado) : remoto.equipadoSerial;
    if (apNuevo !== remoto.aparienciaSerial || eqNuevo !== remoto.equipadoSerial) {
        if (datos.apariencia) {
            remoto.apariencia = datos.apariencia;
            remoto.aparienciaSerial = apNuevo;
        }
        if (datos.equipado) {
            remoto.equipado = datos.equipado;
            remoto.equipadoSerial = eqNuevo;
        }
        actualizarAparienciaAvatar(remoto.avatar, remoto.apariencia, remoto.equipado);
    }

    const nuevoEnVehiculo = Boolean(datos.enVehiculo);
    const serialKartNuevo = datos.configKart ? JSON.stringify(datos.configKart) : remoto.configKartSerial;
    if (nuevoEnVehiculo !== remoto.enVehiculo || serialKartNuevo !== remoto.configKartSerial) {
        remoto.enVehiculo = nuevoEnVehiculo;
        if (datos.configKart) {
            remoto.configKart = datos.configKart;
            remoto.configKartSerial = serialKartNuevo;
        }
        montarAvatarEnKart(remoto.avatar, remoto.configKart, remoto.enVehiculo);
    }
}

/**
 * Elimina un jugador remoto y libera su malla 3D de la GPU.
 * @param {string} idJugador
 */
function eliminarJugadorRemoto(idJugador) {
    const remoto = estadoRed.jugadoresRemotos.get(idJugador);
    if (!remoto) return;
    if (remoto.avatar) {
        liberarObjeto3D(remoto.avatar);
    }
    estadoRed.jugadoresRemotos.delete(idJugador);
}

/**
 * Limpia todos los avatares remotos activos.
 */
function limpiarJugadoresRemotos() {
    for (const id of Array.from(estadoRed.jugadoresRemotos.keys())) {
        eliminarJugadorRemoto(id);
    }
}

/**
 * Procesa mensajes entrantes del servidor WebSocket.
 * @param {string} raw
 */
function procesarMensajeServidor(raw) {
    let msg;
    try {
        msg = JSON.parse(raw);
    } catch (_err) {
        return;
    }

    switch (msg.tipo) {
        case 'bienvenida_sala':
            estadoRed.conectado = true;
            estadoRed.modo = 'online';
            estadoRed.codigoSala = msg.codigoSala;
            estadoRed.esAnfitrion = Boolean(msg.esAnfitrion);
            estadoRed.slotParrilla = typeof msg.slotParrilla === 'number' ? msg.slotParrilla : 0;
            if (Array.isArray(msg.jugadores)) {
                for (const j of msg.jugadores) {
                    upsertJugadorRemoto(j, escenaActiva);
                }
            }
            enviarEventoExperiencia('pedir_estado_parcela', {
                accion: 'pedir_estado_parcela',
                experienciaId: 'construccion'
            });
            guardarPerfilServidor(construirResumenPerfil());
            notificarEstado('red_cambio', { conectado: true, codigoSala: msg.codigoSala });
            break;

        case 'error_sala':
            errorSalaRecibido = true;
            desconectarSalaMultijugador(escenaActiva);
            notificarEstado('aviso', { mensaje: msg.error || 'No se pudo entrar a la sala.' });
            notificarEstado('error_sala', msg);
            break;

        case 'sala_actualizada':
            if (Array.isArray(msg.jugadores)) {
                for (const j of msg.jugadores) {
                    if (!j?.id) continue;
                    if (j.id === estadoJugador.id) {
                        if (typeof j.slotParrilla === 'number') {
                            estadoRed.slotParrilla = j.slotParrilla;
                        }
                        estadoRed.esAnfitrion = Boolean(j.esAnfitrion);
                    } else {
                        upsertJugadorRemoto(j, escenaActiva);
                    }
                }
            }
            notificarEstado('red_cambio', { evento: 'sala_actualizada' });
            break;

        case 'jugador_unido':
            upsertJugadorRemoto(msg.jugador, escenaActiva);
            notificarEstado('red_cambio', { evento: 'jugador_unido' });
            break;

        case 'jugador_actualizado':
            upsertJugadorRemoto(msg.jugador, escenaActiva);
            break;

        case 'jugador_salio':
            eliminarJugadorRemoto(msg.id);
            if (msg.nuevoAnfitrionId === estadoJugador.id) {
                estadoRed.esAnfitrion = true;
            }
            notificarEstado('red_cambio', { evento: 'jugador_salio' });
            break;

        case 'evento_experiencia': {
            if (msg.origenId === estadoJugador.id) break;
            const accionExp = msg.accion || msg.subtipo || msg.datos?.accion;
            if (msg.experienciaId === 'construccion' && accionExp === 'estado_parcela_completo') {
                const bloques = msg.bloques || msg.datos?.bloques;
                if (Array.isArray(bloques)) {
                    estadoRed.bloquesSala = bloques;
                }
            }
            if (estadoSandbox.experienciaActual && typeof estadoSandbox.experienciaActual.alEventoRed === 'function') {
                estadoSandbox.experienciaActual.alEventoRed(msg);
            }
            if (typeof receptorEventosExperiencia === 'function') {
                receptorEventosExperiencia(msg);
            }
            break;
        }

        case 'accion_social': {
            if (msg.origenId === estadoJugador.id) break;
            const remoto = estadoRed.jugadoresRemotos.get(msg.origenId);
            if (msg.subtipo === 'gesto' && remoto) {
                remoto.gestoRemoto = msg.valor || 'saludar';
                remoto.tiempoGestoRemoto = msg.valor === 'sentarse' ? 12.0 : 3.6;
            } else if (msg.subtipo === 'chat' && msg.valor) {
                if (remoto?.avatar) {
                    mostrarBurbujaChatAvatar(remoto.avatar, msg.valor);
                }
                const emisor = remoto?.apodo || msg.apodo || 'Jugador';
                notificarEstado('aviso', { mensaje: `💬 ${emisor}: ${msg.valor}` });
            }
            break;
        }

        default:
            break;
    }
}

/**
 * Serializa el estado compacto del jugador local para transmisión en red.
 * @returns {object}
 */
function serializarEstadoJugadorLocal() {
    return {
        id: estadoJugador.id,
        apodo: estadoJugador.apodo,
        nivel: estadoJugador.nivel,
        apariencia: estadoJugador.apariencia,
        equipado: estadoJugador.equipado,
        posicion: {
            x: Number(estadoJugador.posicion.x.toFixed(3)),
            y: Number(estadoJugador.posicion.y.toFixed(3)),
            z: Number(estadoJugador.posicion.z.toFixed(3))
        },
        rotacion: Number(estadoJugador.rotacion.toFixed(3)),
        animacion: estadoControles.animacionActual,
        enVehiculo: Boolean(estadoJugador.enVehiculo),
        slotParrilla: estadoRed.slotParrilla || 0,
        configKart: estadoJugador.configKart,
        experienciaActiva: estadoJugador.experienciaActiva
    };
}

/**
 * Envía de inmediato el estado actual (apariencia, accesorios, posición) si está en línea.
 */
export function enviarEstadoJugadorInmediato() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
        tipo: 'estado_jugador',
        jugador: serializarEstadoJugadorLocal()
    }));
}

/**
 * Conecta al servidor WebSocket y se une a una sala pública o privada.
 * @param {string} codigoSala
 * @param {string} apodo
 * @param {THREE.Scene} escena
 */
export function conectarSalaMultijugador(codigoSala, apodo, escena) {
    escenaActiva = escena || escenaActiva;
    if (typeof apodo === 'string' && apodo.trim()) {
        estadoJugador.apodo = apodo.trim().slice(0, 18);
    }

    const salaNormalizada = (codigoSala || 'SALA-PUBLICA').trim().toUpperCase().slice(0, 20);

    if (socket) {
        desconectarSalaMultijugador(escenaActiva);
    }
    if (timerTimeoutConexion) {
        clearTimeout(timerTimeoutConexion);
        timerTimeoutConexion = null;
    }
    errorSalaRecibido = false;

    const urlWs = obtenerUrlWebSocket();
    estadoRed.modo = 'conectando';
    notificarEstado('red_cambio', { conectado: false, conectando: true });

    let wsLocal = null;
    try {
        wsLocal = new WebSocket(urlWs);
        socket = wsLocal;
    } catch (_err) {
        estadoRed.conectado = false;
        estadoRed.modo = 'offline';
        notificarEstado('aviso', { mensaje: 'No se pudo iniciar WebSocket. Modo offline activo.' });
        notificarEstado('red_cambio', { conectado: false });
        return;
    }

    timerTimeoutConexion = setTimeout(() => {
        timerTimeoutConexion = null;
        if (wsLocal && wsLocal.readyState === WebSocket.CONNECTING) {
            try {
                wsLocal.close();
            } catch (_err) {
                // Ignorar error de cierre por timeout
            }
            if (socket === wsLocal) {
                socket = null;
                estadoRed.conectado = false;
                estadoRed.modo = 'offline';
                notificarEstado('aviso', {
                    mensaje: 'Servidor multijugador lento o inalcanzable; continuando en modo offline.'
                });
                notificarEstado('red_cambio', { conectado: false });
            }
        }
    }, 14000);

    wsLocal.addEventListener('open', () => {
        if (timerTimeoutConexion) {
            clearTimeout(timerTimeoutConexion);
            timerTimeoutConexion = null;
        }
        if (socket !== wsLocal) return;
        wsLocal.send(JSON.stringify({
            tipo: 'unirse_sala',
            codigoSala: salaNormalizada,
            jugador: serializarEstadoJugadorLocal()
        }));
    });

    wsLocal.addEventListener('message', (evento) => {
        if (socket !== wsLocal) return;
        procesarMensajeServidor(evento.data);
    });

    wsLocal.addEventListener('error', () => {
        if (socket !== wsLocal || errorSalaRecibido) return;
        notificarEstado('aviso', {
            mensaje: 'Servidor multijugador no disponible; continuando en modo offline.'
        });
    });

    wsLocal.addEventListener('close', () => {
        if (timerTimeoutConexion) {
            clearTimeout(timerTimeoutConexion);
            timerTimeoutConexion = null;
        }
        if (socket !== wsLocal) return;
        socket = null;
        limpiarJugadoresRemotos();
        estadoRed.conectado = false;
        estadoRed.modo = 'offline';
        estadoRed.codigoSala = null;
        estadoRed.esAnfitrion = false;
        estadoRed.slotParrilla = 0;
        estadoRed.bloquesSala = null;
        notificarEstado('red_cambio', { conectado: false });
    });
}

/**
 * Desconecta limpiamente del servidor multijugador y limpia avatares remotos.
 * @param {THREE.Scene} [_escena]
 */
export function desconectarSalaMultijugador(_escena) {
    if (timerTimeoutConexion) {
        clearTimeout(timerTimeoutConexion);
        timerTimeoutConexion = null;
    }
    if (socket) {
        const previo = socket;
        socket = null;
        try {
            previo.close();
        } catch (_err) {
            // Ignorar error de cierre
        }
    }
    limpiarJugadoresRemotos();
    estadoRed.conectado = false;
    estadoRed.modo = 'offline';
    estadoRed.codigoSala = null;
    estadoRed.esAnfitrion = false;
    estadoRed.slotParrilla = 0;
    estadoRed.bloquesSala = null;
    notificarEstado('red_cambio', { conectado: false });
}

/**
 * Envía un gesto social o mensaje de chat rápido al resto de la sala.
 * @param {'gesto'|'chat'} subtipo
 * @param {string} valor
 */
export function enviarAccionSocial(subtipo, valor) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
        tipo: 'accion_social',
        subtipo,
        valor: String(valor || '').slice(0, 64),
        apodo: estadoJugador.apodo
    }));
}

/**
 * Envía un evento genérico de experiencia para sincronizar estado de minijuegos.
 * @param {string} subtipo
 * @param {object} [datos]
 */
export function enviarEventoExperiencia(subtipo, datos = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
        tipo: 'evento_experiencia',
        experienciaId: datos.experienciaId || estadoJugador.experienciaActiva,
        subtipo,
        datos
    }));
}

/**
 * Actualiza el envío periódico (20 Hz) e interpola los avatares remotos.
 * @param {number} dt
 * @param {THREE.Scene} [escena]
 */
export function actualizarRed(dt, escena) {
    if (escena) escenaActiva = escena;

    // Interpolación suave de avatares remotos visibles en la misma experiencia
    const factor = Math.min(1, dt * 12);
    for (const remoto of estadoRed.jugadoresRemotos.values()) {
        if (!remoto.avatar) continue;
        const mismaExp = remoto.experienciaActiva === estadoJugador.experienciaActiva;
        remoto.avatar.visible = mismaExp && !estadoControles.modoCeremoniaPodio;
        if (!mismaExp) continue;

        const dx = remoto.objetivoPos.x - remoto.avatar.position.x;
        const dz = remoto.objetivoPos.z - remoto.avatar.position.z;
        remoto.avatar.position.x += dx * factor;
        remoto.avatar.position.y += (remoto.objetivoPos.y - remoto.avatar.position.y) * factor;
        remoto.avatar.position.z += dz * factor;

        let diffRot = remoto.objetivoRot - remoto.avatar.rotation.y;
        while (diffRot > Math.PI) diffRot -= Math.PI * 2;
        while (diffRot < -Math.PI) diffRot += Math.PI * 2;
        remoto.avatar.rotation.y += diffRot * factor;

        if (remoto.enVehiculo) {
            remoto.avatar.userData.velocidadKart = Math.hypot(dx, dz) / Math.max(dt, 0.016);
            remoto.avatar.userData.anguloVolante = Math.max(-1, Math.min(1, diffRot * 3));
        }

        let animObjetivo = remoto.enVehiculo ? 'en_kart' : remoto.animacion;
        if (!remoto.enVehiculo && remoto.tiempoGestoRemoto > 0) {
            remoto.tiempoGestoRemoto = Math.max(0, remoto.tiempoGestoRemoto - dt);
            if (remoto.animacion === 'idle') {
                animObjetivo = remoto.gestoRemoto || 'idle';
            } else {
                remoto.tiempoGestoRemoto = 0;
            }
        }
        actualizarAnimacionAvatar(remoto.avatar, dt, animObjetivo);
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    acumuladorEnvioMs += dt * 1000;
    if (acumuladorEnvioMs >= INTERVALO_ENVIO_MS) {
        acumuladorEnvioMs = 0;
        enviarEstadoJugadorInmediato();
    }
}
