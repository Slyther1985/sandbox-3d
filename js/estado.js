/**
 * Estado reactivo centralizado del jugador, red, sandbox y controles,
 * junto con persistencia local y exportación/importación de perfil.
 */
import {
    CATALOGO_BLOQUES,
    CATALOGO_ITEMS,
    CATALOGO_KARTS,
    CATALOGO_PIEZAS_KART,
    MONEDAS_INICIALES,
    PALETA_AVATAR,
    XP_BASE_NIVEL
} from './constantes.js';

const CLAVE_ALMACENAMIENTO = 'sandbox3d_jugador_v1';
const CLAVE_PERFILES_LOCALES = 'sandbox3d_perfiles_locales_v1';

const MAPA_MIGRACION_CHASIS = {
    kart_gt: 'kart_batmovil',
    kart_monster: 'kart_tumbler',
    kart_cyber: 'kart_lemans'
};

export const estadoJugador = {
    id: 'jug_' + Math.random().toString(36).substring(2, 9),
    apodo: 'Explorador',
    monedas: MONEDAS_INICIALES,
    nivel: 1,
    xp: 0,
    inventario: ['gorra_neon'],
    equipado: { cabeza: 'gorra_neon', espalda: null, aura: null },
    apariencia: {
        piel: '#f1c27d',
        torso: '#00a8ff',
        piernas: '#2f3640',
        rostro: 'feliz'
    },
    construccionGuardada: [],
    configKart: {
        chasis: 'kart_batmovil',
        ruedas: 'rueda_clasica',
        aleron: 'aleron_gt',
        color: '#ff2e4c'
    },
    mejorVueltaKart: null,
    mejorPuntajeTetris: 0,
    posicion: { x: 0, y: 0, z: 14 },
    rotacion: 0,
    enVehiculo: false,
    experienciaActiva: 'lobby'
};

export const estadoRed = {
    conectado: false,
    modo: 'offline',
    codigoSala: null,
    esAnfitrion: false,
    slotParrilla: 0,
    bloquesSala: null,
    jugadoresRemotos: new Map()
};

export const estadoSandbox = {
    experienciaActual: null,
    portalesActivos: [],
    entidadesInteractivas: [],
    colisionadoresEstaticos: []
};

export const estadoControles = {
    teclas: new Set(),
    joystick: { x: 0, y: 0, magnitud: 0, activo: false },
    saltarPresionado: false,
    sprintActivo: false,
    autoSprintJoystick: false,
    anguloCamaraY: 0,
    anguloCamaraPitch: 0.32,
    tiempoOrbitaManual: 0,
    orbitaManualActiva: false,
    pantallaBienvenidaActiva: true,
    modoPreviewAvatar: false,
    anguloPreviewAvatar: 0,
    entidadCercana: null,
    animacionActual: 'idle',
    bloqueSeleccionado: 'cesped',
    modoConstruccion: 'colocar',
    acelerarKart: false,
    frenarKart: false,
    derraparKart: false,
    garajeKartAbierto: false,
    modoCeremoniaPodio: false,
    camaraPodio: null,
    modoTetrisActivo: false,
    asientoTetrisActual: -1
};

const suscriptores = new Set();

/**
 * Registra una función oyente para cambios de estado.
 * @param {Function} listener
 * @returns {Function} Función para desuscribir
 */
export function suscribirEstado(listener) {
    suscriptores.add(listener);
    return () => suscriptores.delete(listener);
}

/**
 * Notifica a todos los suscriptores sobre un evento de estado.
 * @param {string} evento
 * @param {*} detalle
 */
export function notificarEstado(evento, detalle = null) {
    for (const listener of suscriptores) {
        try {
            listener(evento, detalle);
        } catch (err) {
            console.error('Error en suscriptor de estado:', err);
        }
    }
}

/**
 * Calcula la experiencia requerida para alcanzar el siguiente nivel.
 * @param {number} nivel
 * @returns {number}
 */
export function obtenerXpParaSiguienteNivel(nivel) {
    return nivel * XP_BASE_NIVEL;
}

/**
 * Extrae una instantánea serializable del perfil del jugador.
 * @returns {object}
 */
export function construirResumenPerfil() {
    return {
        apodo: estadoJugador.apodo,
        monedas: estadoJugador.monedas,
        nivel: estadoJugador.nivel,
        xp: estadoJugador.xp,
        inventario: [...estadoJugador.inventario],
        equipado: { ...estadoJugador.equipado },
        apariencia: { ...estadoJugador.apariencia },
        construccionGuardada: [...estadoJugador.construccionGuardada],
        configKart: { ...estadoJugador.configKart },
        mejorVueltaKart: estadoJugador.mejorVueltaKart,
        mejorPuntajeTetris: estadoJugador.mejorPuntajeTetris
    };
}

/**
 * Valida y aplica un objeto de perfil cargado desde almacenamiento, servidor o código Base64.
 * @param {object} datos
 */
export function aplicarDatosPerfil(datos) {
    if (!datos || typeof datos !== 'object') {
        throw new Error('Datos de perfil inválidos.');
    }

    const idsItemsValidos = new Set(CATALOGO_ITEMS.map((item) => item.id));
    const tiposBloqueValidos = new Set(CATALOGO_BLOQUES.map((b) => b.id));

    if (typeof datos.apodo === 'string' && datos.apodo.trim().length > 0) {
        estadoJugador.apodo = datos.apodo.trim().slice(0, 18);
    }
    if (typeof datos.monedas === 'number' && Number.isFinite(datos.monedas) && datos.monedas >= 0) {
        estadoJugador.monedas = Math.floor(datos.monedas);
    }
    if (typeof datos.nivel === 'number' && Number.isFinite(datos.nivel) && datos.nivel >= 1) {
        estadoJugador.nivel = Math.floor(datos.nivel);
    }
    if (typeof datos.xp === 'number' && Number.isFinite(datos.xp) && datos.xp >= 0) {
        estadoJugador.xp = Math.floor(datos.xp);
    }

    if (Array.isArray(datos.inventario)) {
        const filtrado = datos.inventario.filter((id) => idsItemsValidos.has(id));
        if (!filtrado.includes('gorra_neon')) filtrado.unshift('gorra_neon');
        estadoJugador.inventario = Array.from(new Set(filtrado));
    }

    if (datos.equipado && typeof datos.equipado === 'object') {
        for (const slot of ['cabeza', 'espalda', 'aura']) {
            const valor = slot === 'aura' ? (datos.equipado.aura ?? datos.equipado.efecto ?? null) : datos.equipado[slot];
            if (valor === null || (idsItemsValidos.has(valor) && estadoJugador.inventario.includes(valor))) {
                estadoJugador.equipado[slot] = valor;
            }
        }
    }

    if (datos.apariencia && typeof datos.apariencia === 'object') {
        for (const parte of ['piel', 'torso', 'piernas']) {
            if (typeof datos.apariencia[parte] === 'string' && /^#[0-9a-fA-F]{6}$/.test(datos.apariencia[parte])) {
                estadoJugador.apariencia[parte] = datos.apariencia[parte];
            }
        }
        if (PALETA_AVATAR.rostros.includes(datos.apariencia.rostro)) {
            estadoJugador.apariencia.rostro = datos.apariencia.rostro;
        }
    }

    if (Array.isArray(datos.construccionGuardada)) {
        estadoJugador.construccionGuardada = datos.construccionGuardada
            .filter(
                (b) =>
                    b &&
                    Number.isInteger(b.x) &&
                    Number.isInteger(b.y) &&
                    Number.isInteger(b.z) &&
                    b.y >= 0 &&
                    b.y < 32 &&
                    tiposBloqueValidos.has(b.tipo)
            )
            .map((b) => ({ x: b.x, y: b.y, z: b.z, tipo: b.tipo }));
    }

    if (datos.configKart && typeof datos.configKart === 'object') {
        const chasisValidos = new Set(CATALOGO_KARTS.map((k) => k.id));
        const ruedasValidas = new Set(CATALOGO_PIEZAS_KART.ruedas.map((r) => r.id));
        const aleronesValidos = new Set(CATALOGO_PIEZAS_KART.alerones.map((a) => a.id));
        const chasisMigrado = MAPA_MIGRACION_CHASIS[datos.configKart.chasis] || datos.configKart.chasis;
        if (chasisValidos.has(chasisMigrado)) {
            estadoJugador.configKart.chasis = chasisMigrado;
        }
        if (ruedasValidas.has(datos.configKart.ruedas)) {
            estadoJugador.configKart.ruedas = datos.configKart.ruedas;
        }
        if (aleronesValidos.has(datos.configKart.aleron)) {
            estadoJugador.configKart.aleron = datos.configKart.aleron;
        }
        if (typeof datos.configKart.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(datos.configKart.color)) {
            estadoJugador.configKart.color = datos.configKart.color;
        }
    }

    if (
        datos.mejorVueltaKart === null ||
        (typeof datos.mejorVueltaKart === 'number' &&
            Number.isFinite(datos.mejorVueltaKart) &&
            datos.mejorVueltaKart > 1)
    ) {
        estadoJugador.mejorVueltaKart = datos.mejorVueltaKart;
    }

    if (
        typeof datos.mejorPuntajeTetris === 'number' &&
        Number.isFinite(datos.mejorPuntajeTetris) &&
        datos.mejorPuntajeTetris >= 0
    ) {
        estadoJugador.mejorPuntajeTetris = Math.floor(datos.mejorPuntajeTetris);
    }
}

/**
 * Devuelve la lista de perfiles almacenados localmente en el navegador (respaldo offline).
 * @returns {Array<object>}
 */
export function cargarPerfilesLocales() {
    if (typeof localStorage === 'undefined') return [];
    const mapa = new Map();
    try {
        const rawMapa = localStorage.getItem(CLAVE_PERFILES_LOCALES);
        if (rawMapa) {
            const parsed = JSON.parse(rawMapa);
            if (parsed && typeof parsed === 'object') {
                for (const [k, v] of Object.entries(parsed)) {
                    if (v && typeof v === 'object' && typeof v.apodo === 'string' && v.apodo.trim().length >= 2) {
                        mapa.set(k.trim().toLowerCase(), v);
                    }
                }
            }
        }
        const rawActual = localStorage.getItem(CLAVE_ALMACENAMIENTO);
        if (rawActual) {
            const actual = JSON.parse(rawActual);
            if (actual && typeof actual.apodo === 'string' && actual.apodo.trim().length >= 2) {
                const key = actual.apodo.trim().toLowerCase();
                if (!mapa.has(key)) {
                    mapa.set(key, actual);
                }
            }
        }
    } catch (_err) {
        // Ignorar almacenamiento corrupto
    }
    return Array.from(mapa.values()).sort((a, b) => (b.ultimaConexion || 0) - (a.ultimaConexion || 0));
}

/**
 * Reinicia el estado del jugador con valores iniciales limpios para un nuevo perfil.
 * @param {string} apodo
 * @returns {object}
 */
export function restablecerPerfilNuevo(apodo) {
    const limpio = String(apodo || 'Explorador').trim().replace(/\s+/g, ' ').slice(0, 18) || 'Explorador';
    estadoJugador.apodo = limpio;
    estadoJugador.monedas = MONEDAS_INICIALES;
    estadoJugador.nivel = 1;
    estadoJugador.xp = 0;
    estadoJugador.inventario = ['gorra_neon'];
    estadoJugador.equipado = { cabeza: 'gorra_neon', espalda: null, aura: null };
    estadoJugador.apariencia = {
        piel: '#ffdbac',
        torso: '#2563eb',
        piernas: '#1e293b',
        rostro: 'feliz'
    };
    estadoJugador.construccionGuardada = [];
    estadoJugador.configKart = {
        chasis: 'kart_batmovil',
        ruedas: 'rueda_clasica',
        aleron: 'aleron_gt',
        color: '#ff2e4c'
    };
    estadoJugador.mejorVueltaKart = null;
    estadoJugador.mejorPuntajeTetris = 0;
    guardarEstadoLocal();
    return construirResumenPerfil();
}

/**
 * Guarda progreso completo del jugador (apariencia, inventario y construcción) en localStorage
 * y emite `'perfil_guardado'` para sincronización en red sin crear dependencias circulares.
 */
export function guardarEstadoLocal() {
    const resumen = { ...construirResumenPerfil(), ultimaConexion: Date.now() };
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(resumen));
            const rawMapa = localStorage.getItem(CLAVE_PERFILES_LOCALES);
            const mapa = rawMapa ? JSON.parse(rawMapa) : {};
            if (mapa && typeof mapa === 'object' && !Array.isArray(mapa) && resumen.apodo) {
                mapa[resumen.apodo.trim().toLowerCase()] = resumen;
                localStorage.setItem(CLAVE_PERFILES_LOCALES, JSON.stringify(mapa));
            }
        } catch (_err) {
            // Ignorar en entornos sin acceso a almacenamiento
        }
    }
    notificarEstado('perfil_guardado', resumen);
}

/**
 * Carga progreso previo desde localStorage validando esquema e ítems existentes.
 */
export function cargarEstadoLocal() {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(CLAVE_ALMACENAMIENTO);
        if (!raw) return;
        aplicarDatosPerfil(JSON.parse(raw));
    } catch (_err) {
        // Ignorar almacenamiento corrupto y mantener valores por defecto
    }
}

/**
 * Exporta el perfil completo del jugador en formato Base64 compatible con UTF-8.
 * @returns {string}
 */
export function exportarCodigoPerfil() {
    const json = JSON.stringify(construirResumenPerfil());
    const bytes = new TextEncoder().encode(json);
    let binario = '';
    for (const byte of bytes) {
        binario += String.fromCharCode(byte);
    }
    return btoa(binario);
}

/**
 * Importa y valida un código de perfil Base64, actualizando estado y localStorage.
 * @param {string} codigoBase64
 * @returns {boolean}
 */
export function importarCodigoPerfil(codigoBase64) {
    if (typeof codigoBase64 !== 'string' || !codigoBase64.trim()) {
        return false;
    }
    try {
        const binario = atob(codigoBase64.trim());
        const bytes = new Uint8Array(binario.length);
        for (let i = 0; i < binario.length; i++) {
            bytes[i] = binario.charCodeAt(i);
        }
        const json = new TextDecoder().decode(bytes);
        aplicarDatosPerfil(JSON.parse(json));
        guardarEstadoLocal();
        notificarEstado('perfil_actualizado', estadoJugador);
        return true;
    } catch (_err) {
        return false;
    }
}
