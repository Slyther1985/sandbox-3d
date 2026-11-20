/**
 * Motor compartido de física sandbox en tercera persona:
 * movimiento relativo a la cámara, salto, gravedad configurable,
 * colisiones AABB con plataformas y detección de entidades interactivas.
 */
import {
    ALTURA_AVATAR,
    ALTURA_CAIDA_VACIO,
    DISTANCIA_INTERACCION,
    FUERZA_SALTO,
    GRAVEDAD_BASE,
    LIMITE_MUNDO,
    RADIO_COLISION_AVATAR,
    VELOCIDAD_CAMINAR,
    VELOCIDAD_SPRINT
} from './constantes.js';
import {
    estadoControles,
    estadoJugador,
    estadoSandbox
} from './estado.js';
import { reproducirSonido } from './recursos.js';

export const estadoFisica = {
    vx: 0,
    vy: 0,
    vz: 0,
    enSuelo: true,
    tiempoPaso: 0,
    gestoActivo: null,
    tiempoGesto: 0
};

/**
 * Activa un gesto social temporal en el avatar local.
 * @param {'saludar'|'bailar'|'celebrar'|'sentarse'} tipo
 */
export function activarGestoLocal(tipo = 'saludar') {
    estadoFisica.gestoActivo = tipo;
    estadoFisica.tiempoGesto = tipo === 'sentarse' ? 12.0 : 3.6;
}

/**
 * Activa temporalmente la animación de saludo en el avatar local.
 */
export function activarSaludoLocal() {
    activarGestoLocal('saludar');
}

/**
 * Verifica si un AABB centrado en XZ y apoyado en Y colisiona con un colisionador.
 */
function solapaXZ(px, pz, radio, c) {
    return (
        px + radio > c.minX &&
        px - radio < c.maxX &&
        pz + radio > c.minZ &&
        pz - radio < c.maxZ
    );
}

/**
 * Ejecuta un paso de física para el avatar local heredando multiplicadores
 * de la experiencia activa.
 * @param {number} dt
 * @param {THREE.Object3D} avatarLocal
 * @param {object} [configFisica]
 */
export function actualizarFisicaSandbox(dt, avatarLocal, configFisica = {}) {
    if (estadoJugador.enVehiculo || estadoControles.modoTetrisActivo) {
        estadoControles.animacionActual = estadoJugador.enVehiculo ? 'en_kart' : 'sentarse';
        estadoControles.entidadCercana = null;
        return;
    }

    const dtSeguro = Math.min(dt, 0.05);
    const gravedad = configFisica.gravedad ?? GRAVEDAD_BASE;
    const multVel = configFisica.multiplicadorVelocidad ?? 1;
    const multSalto = configFisica.multiplicadorSalto ?? 1;

    // 1. Entrada de teclado + joystick virtual
    let inputX = 0;
    let inputZ = 0;
    const teclas = estadoControles.teclas;

    if (teclas.has('KeyW') || teclas.has('ArrowUp')) inputZ += 1;
    if (teclas.has('KeyS') || teclas.has('ArrowDown')) inputZ -= 1;
    if (teclas.has('KeyD') || teclas.has('ArrowRight')) inputX += 1;
    if (teclas.has('KeyA') || teclas.has('ArrowLeft')) inputX -= 1;

    if (estadoControles.joystick.activo) {
        inputX += estadoControles.joystick.x;
        inputZ += estadoControles.joystick.y;
    }

    const magnitud = Math.hypot(inputX, inputZ);
    if (magnitud > 1) {
        inputX /= magnitud;
        inputZ /= magnitud;
    }

    // 2. Dirección relativa a la orientación horizontal de la cámara
    const theta = estadoControles.anguloCamaraY;
    const forwardX = -Math.sin(theta);
    const forwardZ = -Math.cos(theta);
    const rightX = Math.cos(theta);
    const rightZ = -Math.sin(theta);

    const dirX = forwardX * inputZ + rightX * inputX;
    const dirZ = forwardZ * inputZ + rightZ * inputX;

    const esSprint =
        estadoControles.sprintActivo ||
        teclas.has('ShiftLeft') ||
        teclas.has('ShiftRight');
    const velocidadBase = (esSprint ? VELOCIDAD_SPRINT : VELOCIDAD_CAMINAR) * multVel;

    estadoFisica.vx = dirX * velocidadBase;
    estadoFisica.vz = dirZ * velocidadBase;

    // 3. Salto
    const quiereSaltar =
        estadoControles.saltarPresionado || teclas.has('Space');
    if (quiereSaltar && estadoFisica.enSuelo) {
        estadoFisica.vy = FUERZA_SALTO * multSalto;
        estadoFisica.enSuelo = false;
        reproducirSonido('salto');
    }

    // 4. Integración horizontal con resolución AABB por eje
    const pos = estadoJugador.posicion;
    const r = RADIO_COLISION_AVATAR;
    const colisionadores = estadoSandbox.colisionadoresEstaticos;

    const rangoVerticalSolapa = (c, yBase) =>
        yBase + ALTURA_AVATAR > c.minY + 0.05 && yBase + 0.12 < c.maxY;

    // Eje X
    pos.x += estadoFisica.vx * dtSeguro;
    for (const c of colisionadores) {
        if (!rangoVerticalSolapa(c, pos.y)) continue;
        if (solapaXZ(pos.x, pos.z, r, c)) {
            if (estadoFisica.vx > 0) {
                pos.x = c.minX - r;
            } else if (estadoFisica.vx < 0) {
                pos.x = c.maxX + r;
            }
        }
    }

    // Eje Z
    pos.z += estadoFisica.vz * dtSeguro;
    for (const c of colisionadores) {
        if (!rangoVerticalSolapa(c, pos.y)) continue;
        if (solapaXZ(pos.x, pos.z, r, c)) {
            if (estadoFisica.vz > 0) {
                pos.z = c.minZ - r;
            } else if (estadoFisica.vz < 0) {
                pos.z = c.maxZ + r;
            }
        }
    }

    pos.x = Math.max(-LIMITE_MUNDO, Math.min(LIMITE_MUNDO, pos.x));
    pos.z = Math.max(-LIMITE_MUNDO, Math.min(LIMITE_MUNDO, pos.z));

    // 5. Integración vertical con detección de plataformas y techos
    const prevY = pos.y;
    estadoFisica.vy += gravedad * dtSeguro;
    pos.y += estadoFisica.vy * dtSeguro;
    estadoFisica.enSuelo = false;

    for (const c of colisionadores) {
        if (!solapaXZ(pos.x, pos.z, r, c)) continue;

        if (estadoFisica.vy <= 0 && prevY >= c.maxY - 0.18 && pos.y <= c.maxY) {
            pos.y = c.maxY;
            estadoFisica.vy = 0;
            estadoFisica.enSuelo = true;
        } else if (
            estadoFisica.vy > 0 &&
            prevY + ALTURA_AVATAR <= c.minY + 0.18 &&
            pos.y + ALTURA_AVATAR >= c.minY
        ) {
            pos.y = c.minY - ALTURA_AVATAR;
            estadoFisica.vy = 0;
        }
    }

    // Reaparición si cae al vacío
    if (pos.y < ALTURA_CAIDA_VACIO) {
        const spawn = estadoSandbox.experienciaActual?.spawnJugador || { x: 0, y: 2, z: 14 };
        pos.x = spawn.x;
        pos.y = spawn.y + 1;
        pos.z = spawn.z;
        estadoFisica.vy = 0;
    }

    // 6. Rotación suave del avatar hacia la dirección de avance
    const rapidezXZ = Math.hypot(estadoFisica.vx, estadoFisica.vz);
    if (rapidezXZ > 0.25) {
        const rotObjetivo = Math.atan2(estadoFisica.vx, estadoFisica.vz);
        let diff = rotObjetivo - estadoJugador.rotacion;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        estadoJugador.rotacion += diff * Math.min(1, dtSeguro * 14);
    }

    if (avatarLocal) {
        avatarLocal.position.set(pos.x, pos.y, pos.z);
        avatarLocal.rotation.y = estadoJugador.rotacion;
    }

    // 7. Estado de animación, gestos sociales y sonido de pasos
    if (estadoFisica.tiempoGesto > 0) {
        estadoFisica.tiempoGesto = Math.max(0, estadoFisica.tiempoGesto - dtSeguro);
        if (estadoFisica.tiempoGesto === 0) {
            estadoFisica.gestoActivo = null;
        }
    }

    if (!estadoFisica.enSuelo) {
        estadoFisica.tiempoGesto = 0;
        estadoFisica.gestoActivo = null;
        estadoControles.animacionActual = 'saltar';
    } else if (rapidezXZ > 0.35) {
        estadoFisica.tiempoGesto = 0;
        estadoFisica.gestoActivo = null;
        estadoControles.animacionActual = esSprint ? 'correr' : 'caminar';
        estadoFisica.tiempoPaso += dtSeguro * (esSprint ? 1.55 : 1);
        if (estadoFisica.tiempoPaso >= 0.36) {
            estadoFisica.tiempoPaso = 0;
            reproducirSonido('paso');
        }
    } else if (estadoFisica.tiempoGesto > 0 && estadoFisica.gestoActivo) {
        estadoControles.animacionActual = estadoFisica.gestoActivo;
    } else {
        estadoControles.animacionActual = 'idle';
        estadoFisica.tiempoPaso = 0.28;
    }

    // 8. Detección de entidades interactivas y recolección automática
    let masCercana = null;
    let distMinima = Infinity;

    for (const entidad of estadoSandbox.entidadesInteractivas) {
        if (entidad.activa === false || !entidad.posicion) continue;
        const dx = pos.x - entidad.posicion.x;
        const dy = pos.y + 1 - entidad.posicion.y;
        const dz = pos.z - entidad.posicion.z;
        const dist = Math.hypot(dx, dy, dz);

        if (entidad.autoRecoger && dist <= (entidad.radio || 1.4)) {
            if (typeof entidad.alRecoger === 'function') {
                entidad.alRecoger(estadoJugador);
            }
            continue;
        }

        const radioInteraccion = entidad.radio || DISTANCIA_INTERACCION;
        if (!entidad.autoRecoger && dist <= radioInteraccion && dist < distMinima) {
            distMinima = dist;
            masCercana = entidad;
        }
    }

    estadoControles.entidadCercana = masCercana;
}
