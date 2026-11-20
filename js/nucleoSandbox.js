/**
 * Núcleo del Sandbox: clase base `ExperienciaBase`, registro central
 * `RegistroExperiencias` y sistema de portales físicos 3D.
 */
import { GRAVEDAD_BASE, CATALOGO_ITEMS } from './constantes.js';
import {
    estadoJugador,
    estadoSandbox,
    guardarEstadoLocal,
    notificarEstado,
    obtenerXpParaSiguienteNivel
} from './estado.js';
import {
    liberarObjeto3D,
    obtenerTexturaPortal,
    reproducirSonido
} from './recursos.js';

let tiempoCooldownPortal = 0;

/**
 * Crea una textura temporal de letrero para un portal 3D.
 * @param {string} titulo
 * @param {string} subtitulo
 * @param {number|string} colorHex
 * @returns {THREE.CanvasTexture}
 */
function crearTexturaLetreroPortal(titulo, subtitulo, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const colorCss = typeof colorHex === 'string'
        ? colorHex
        : '#' + (colorHex >>> 0).toString(16).padStart(6, '0');

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = colorCss;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(10, 10, 492, 108, 22);
    } else {
        ctx.rect(10, 10, 492, 108);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titulo, 256, 46);

    ctx.fillStyle = colorCss;
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(subtitulo || 'Camina para entrar', 256, 86);

    const textura = new THREE.CanvasTexture(canvas);
    textura.userData = { esClonTemporal: true };
    return textura;
}

/**
 * Clase base abstracta de la que deben heredar todas las experiencias / minijuegos.
 */
export class ExperienciaBase {
    /**
     * @param {object} config
     * @param {string} config.id
     * @param {string} config.nombre
     * @param {string} [config.descripcion]
     * @param {number} [config.colorPortal]
     * @param {{x:number, y:number, z:number}} [config.posicionPortal]
     * @param {number} [config.minJugadores]
     * @param {{x:number, y:number, z:number}} [config.spawnJugador]
     * @param {object} [config.configFisica]
     */
    constructor(config = {}) {
        this.id = config.id || 'experiencia_base';
        this.nombre = config.nombre || 'Experiencia Sandbox';
        this.descripcion = config.descripcion || 'Módulo base del Sandbox 3D.';
        this.colorPortal = config.colorPortal ?? 0x38bdf8;
        this.posicionPortal = config.posicionPortal || { x: 0, y: 0, z: 0 };
        this.minJugadores = config.minJugadores ?? 1;
        this.spawnJugador = config.spawnJugador || { x: 0, y: 1, z: 14 };

        this.grupoRaiz = new THREE.Group();
        this.grupoRaiz.name = `exp_${this.id}`;

        this.configFisica = {
            gravedad: GRAVEDAD_BASE,
            multiplicadorVelocidad: 1,
            multiplicadorSalto: 1,
            ...(config.configFisica || {})
        };
        this.manejadorRed = null;
    }

    /**
     * Construye el entorno 3D de la experiencia y registra colisionadores y entidades.
     * @param {THREE.Scene} escena
     * @param {object} _contextoSandbox
     */
    montar(escena, _contextoSandbox) {
        estadoSandbox.colisionadoresEstaticos = [];
        estadoSandbox.entidadesInteractivas = [];
        estadoSandbox.portalesActivos = [];

        if (escena && !this.grupoRaiz.parent) {
            escena.add(this.grupoRaiz);
        }
        estadoJugador.experienciaActiva = this.id;
        estadoSandbox.experienciaActual = this;
    }

    /**
     * Actualización por frame (60 FPS) de la lógica de la experiencia.
     * @param {number} _dt
     * @param {object} _contextoSandbox
     */
    actualizar(_dt, _contextoSandbox) {
        // Implementado por cada experiencia hija
    }

    /**
     * Manejador unificado de interacción (`KeyE` o botón móvil de acción).
     * @param {object} _jugador
     * @param {object} _entidad
     */
    alInteractuar(_jugador, _entidad) {
        // Implementado por cada experiencia hija
    }

    /**
     * Hook opcional para procesar eventos multijugador recibidos vía `evento_experiencia`.
     * @param {object} _evento
     */
    alEventoRed(_evento) {
        // Implementado opcionalmente por cada experiencia hija
    }

    /**
     * Delega al núcleo la entrega segura de monedas, XP, subida de nivel e ítems.
     * @param {number} monedas
     * @param {number} xp
     * @param {string|null} itemId
     * @returns {{ monedas: number, xp: number, itemId: string|null, subioNivel: boolean }}
     */
    otorgarRecompensa(monedas = 0, xp = 0, itemId = null) {
        const monedasGanadas = Math.max(0, Math.floor(monedas));
        const xpGanada = Math.max(0, Math.floor(xp));
        let subioNivel = false;
        let itemDesbloqueado = null;

        if (monedasGanadas > 0) {
            estadoJugador.monedas += monedasGanadas;
        }

        if (xpGanada > 0) {
            estadoJugador.xp += xpGanada;
            let meta = obtenerXpParaSiguienteNivel(estadoJugador.nivel);
            while (estadoJugador.xp >= meta) {
                estadoJugador.xp -= meta;
                estadoJugador.nivel += 1;
                subioNivel = true;
                meta = obtenerXpParaSiguienteNivel(estadoJugador.nivel);
            }
        }

        if (itemId) {
            const existeEnCatalogo = CATALOGO_ITEMS.some((item) => item.id === itemId);
            if (existeEnCatalogo && !estadoJugador.inventario.includes(itemId)) {
                estadoJugador.inventario.push(itemId);
                itemDesbloqueado = itemId;
            }
        }

        if (subioNivel) {
            reproducirSonido('nivel');
        } else if (monedasGanadas > 0 || xpGanada > 0 || itemDesbloqueado) {
            reproducirSonido('moneda');
        }

        guardarEstadoLocal();
        notificarEstado('recompensa', {
            monedas: monedasGanadas,
            xp: xpGanada,
            itemId: itemDesbloqueado,
            subioNivel,
            nuevoNivel: estadoJugador.nivel
        });

        return {
            monedas: monedasGanadas,
            xp: xpGanada,
            itemId: itemDesbloqueado,
            subioNivel
        };
    }

    /**
     * Desmonta la experiencia y libera toda su memoria GPU mediante `liberarObjeto3D`.
     * @param {THREE.Scene} _escena
     */
    desmontar(_escena) {
        liberarObjeto3D(this.grupoRaiz);
        estadoSandbox.colisionadoresEstaticos = [];
        estadoSandbox.entidadesInteractivas = [];
        estadoSandbox.portalesActivos = [];

        if (estadoSandbox.experienciaActual === this) {
            estadoSandbox.experienciaActual = null;
        }

        this.grupoRaiz = new THREE.Group();
        this.grupoRaiz.name = `exp_${this.id}`;
    }

    /**
     * Registra una caja AABB estática para colisiones del motor de física.
     */
    registrarColisionadorCaja(minX, minY, minZ, maxX, maxY, maxZ, etiqueta = 'bloque') {
        const colisionador = { minX, minY, minZ, maxX, maxY, maxZ, etiqueta };
        estadoSandbox.colisionadoresEstaticos.push(colisionador);
        return colisionador;
    }

    /**
     * Registra una entidad interactiva (moneda, cofre, NPC, terminal).
     */
    registrarEntidadInteractiva(configEntidad) {
        const entidad = {
            activa: true,
            radio: 1.5,
            autoRecoger: false,
            ...configEntidad
        };
        estadoSandbox.entidadesInteractivas.push(entidad);
        return entidad;
    }

    /**
     * Construye un portal físico 3D con arco, vórtice animado y letrero flotante.
     * @param {object} configPortal
     */
    crearPortalFisico3D(configPortal) {
        const {
            idDestino,
            nombre,
            subtitulo = 'Entrar al portal',
            color = 0x38bdf8,
            posicion = { x: 0, y: 0, z: 0 },
            rotacionY = 0,
            radio = 1.65,
            alEntrar = null
        } = configPortal;

        const grupoPortal = new THREE.Group();
        grupoPortal.position.set(posicion.x, posicion.y, posicion.z);
        grupoPortal.rotation.y = rotacionY;

        const matPiedra = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            metalness: 0.12,
            roughness: 0.55
        });
        const matTrim = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.45,
            roughness: 0.35
        });
        const matNeon = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1.05,
            roughness: 0.2
        });

        // Pedestal escalonado de piedra con borde luminoso
        const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.36, 1.9), matPiedra);
        baseMesh.position.y = 0.18;
        baseMesh.receiveShadow = true;
        baseMesh.castShadow = true;
        grupoPortal.add(baseMesh);

        const trimBase = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 1.45), matNeon);
        trimBase.position.y = 0.4;
        grupoPortal.add(trimBase);

        // Pilares laterales ornamentales con capiteles
        const pilarGeo = new THREE.BoxGeometry(0.55, 3.85, 0.8);
        const pilarIzq = new THREE.Mesh(pilarGeo, matPiedra.clone());
        pilarIzq.position.set(-1.72, 2.25, 0);
        pilarIzq.castShadow = true;
        pilarIzq.receiveShadow = true;
        grupoPortal.add(pilarIzq);

        const pilarDer = new THREE.Mesh(pilarGeo.clone(), matPiedra.clone());
        pilarDer.position.set(1.72, 2.25, 0);
        pilarDer.castShadow = true;
        pilarDer.receiveShadow = true;
        grupoPortal.add(pilarDer);

        const capitelGeo = new THREE.BoxGeometry(0.75, 0.35, 1.0);
        const capIzq = new THREE.Mesh(capitelGeo, matTrim);
        capIzq.position.set(-1.72, 4.18, 0);
        const capDer = new THREE.Mesh(capitelGeo.clone(), matTrim.clone());
        capDer.position.set(1.72, 4.18, 0);
        grupoPortal.add(capIzq, capDer);

        const dintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.52, 0.95), matPiedra.clone());
        dintel.position.set(0, 4.45, 0);
        dintel.castShadow = true;
        grupoPortal.add(dintel);

        const coronaNeon = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.05), matNeon.clone());
        coronaNeon.position.set(0, 4.45, 0);
        grupoPortal.add(coronaNeon);

        // Vórtice giratorio y luz ambiental local
        const vorticeGeo = new THREE.CircleGeometry(1.48, 32);
        const vorticeMat = new THREE.MeshBasicMaterial({
            map: obtenerTexturaPortal(color),
            transparent: true,
            opacity: 0.94,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const vorticeMesh = new THREE.Mesh(vorticeGeo, vorticeMat);
        vorticeMesh.position.set(0, 2.35, 0);
        grupoPortal.add(vorticeMesh);

        const luzPortal = new THREE.PointLight(color, 1.1, 10);
        luzPortal.position.set(0, 2.4, 1.0);
        grupoPortal.add(luzPortal);

        // Letrero flotante
        const texLetrero = crearTexturaLetreroPortal(nombre, subtitulo, color);
        const spriteMat = new THREE.SpriteMaterial({ map: texLetrero, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(0, 5.55, 0);
        sprite.scale.set(4.8, 1.2, 1);
        grupoPortal.add(sprite);

        this.grupoRaiz.add(grupoPortal);

        const registroPortal = {
            idDestino,
            nombre,
            posicion: { ...posicion },
            radio,
            vorticeMesh,
            alEntrar
        };
        estadoSandbox.portalesActivos.push(registroPortal);
        return registroPortal;
    }
}

/**
 * Registro central de experiencias del Sandbox.
 */
export const RegistroExperiencias = {
    experiencias: new Map(),
    contextoGlobal: null,

    /**
     * Registra una instancia que hereda de `ExperienciaBase`.
     * @param {ExperienciaBase} instancia
     */
    registrarExperiencia(instancia) {
        if (!(instancia instanceof ExperienciaBase)) {
            throw new Error('Toda experiencia registrada debe heredar de ExperienciaBase.');
        }
        this.experiencias.set(instancia.id, instancia);
        return instancia;
    },

    /**
     * Desmonta la experiencia actual y monta la experiencia destino.
     * @param {string} idDestino
     * @param {object} [contextoSandbox]
     * @returns {boolean}
     */
    cambiarExperiencia(idDestino, contextoSandbox = this.contextoGlobal) {
        const destino = this.experiencias.get(idDestino);
        if (!destino) {
            notificarEstado('aviso', {
                mensaje: `Experiencia "${idDestino}" aún en construcción. ¡Próximamente!`
            });
            return false;
        }

        const escena = contextoSandbox?.escena;
        if (estadoSandbox.experienciaActual) {
            estadoSandbox.experienciaActual.desmontar(escena);
        }

        destino.montar(escena, contextoSandbox);

        if (destino.spawnJugador) {
            estadoJugador.posicion.x = destino.spawnJugador.x;
            estadoJugador.posicion.y = destino.spawnJugador.y;
            estadoJugador.posicion.z = destino.spawnJugador.z;
            if (contextoSandbox?.avatarLocal) {
                contextoSandbox.avatarLocal.position.set(
                    destino.spawnJugador.x,
                    destino.spawnJugador.y,
                    destino.spawnJugador.z
                );
            }
        }

        tiempoCooldownPortal = 2.5;
        reproducirSonido('portal');
        notificarEstado('experiencia_cambiada', { id: destino.id, nombre: destino.nombre });
        return true;
    },

    /**
     * Devuelve un arreglo con todas las experiencias registradas.
     * @returns {ExperienciaBase[]}
     */
    obtenerExperiencias() {
        return Array.from(this.experiencias.values());
    },

    /**
     * Obtiene una experiencia registrada por su identificador.
     * @param {string} id
     * @returns {ExperienciaBase|undefined}
     */
    obtenerExperiencia(id) {
        return this.experiencias.get(id);
    }
};

/**
 * Anima portales 3D activos y detecta si el jugador entra en alguno.
 * @param {number} dt
 * @param {{x:number, y:number, z:number}} posicionJugador
 * @param {object} contextoSandbox
 */
export function actualizarPortalesFisicos(dt, posicionJugador, contextoSandbox) {
    if (tiempoCooldownPortal > 0) {
        tiempoCooldownPortal = Math.max(0, tiempoCooldownPortal - dt);
    }

    for (const portal of estadoSandbox.portalesActivos) {
        if (portal.vorticeMesh) {
            portal.vorticeMesh.rotation.z += dt * 1.6;
        }

        if (tiempoCooldownPortal > 0 || !posicionJugador) continue;

        const dx = posicionJugador.x - portal.posicion.x;
        const dz = posicionJugador.z - portal.posicion.z;
        const dy = Math.abs(posicionJugador.y - portal.posicion.y);
        const distXZ = Math.hypot(dx, dz);

        if (distXZ <= portal.radio && dy <= 2.6) {
            tiempoCooldownPortal = 2.5;
            reproducirSonido('portal');
            if (typeof portal.alEntrar === 'function') {
                portal.alEntrar(contextoSandbox);
            } else {
                RegistroExperiencias.cambiarExperiencia(portal.idDestino, contextoSandbox);
            }
            break;
        }
    }
}
