/**
 * Experiencia: Torre Celeste Parkour (sala arcade escalable).
 * Circuito vertical de plataformas flotantes con plataforma móvil,
 * cronómetro, récord guardado en `estadoJugador.progresoExperiencias.parkour`
 * y portal de regreso al Lobby Central.
 */
import { GRAVEDAD_BASE } from '../constantes.js';
import { estadoJugador, guardarEstadoLocal, notificarEstado } from '../estado.js';
import {
    crearCupulaCielo,
    liberarObjeto3D,
    obtenerTexturaPlataforma,
    reproducirSonido
} from '../recursos.js';
import { ExperienciaBase, RegistroExperiencias } from '../nucleoSandbox.js';
import { enviarEventoExperiencia } from '../red.js';

export class ArenaParkour extends ExperienciaBase {
    constructor() {
        super({
            id: 'parkour',
            nombre: 'Torre Celeste Parkour',
            descripcion: 'Salta entre plataformas celestes hasta la cima y bate tu mejor tiempo.',
            colorPortal: 0x06b6d4,
            posicionPortal: { x: -16, y: 0, z: 32 },
            minJugadores: 1,
            spawnJugador: { x: 0, y: 1.0, z: 0 }
        });

        this.cupulaCielo = null;
        this.trofeoCima = null;
        this.plataformaMovil = null;
        this.colisionadorMovil = null;
        this.tiempoTotal = 0;
        this.tiempoCarrera = 0;
        this.carreraActiva = false;
        this.recompensaEntregada = false;
    }

    montar(escena, contextoSandbox) {
        super.montar(escena, contextoSandbox);
        this.tiempoTotal = 0;
        this.tiempoCarrera = 0;
        this.carreraActiva = true;
        this.recompensaEntregada = false;
        this.plataformaMovil = null;
        this.colisionadorMovil = null;
        this.trofeoCima = null;

        this.configFisica = {
            gravedad: GRAVEDAD_BASE * 0.92,
            multiplicadorVelocidad: 1.05,
            multiplicadorSalto: 1.12,
            limiteMundo: 45
        };

        this._construirCircuito(contextoSandbox);

        this.cupulaCielo = crearCupulaCielo('taller_atardecer');
        this.grupoRaiz.add(this.cupulaCielo);
        if (escena) {
            escena.background = new THREE.Color(0x1e1b4b);
            escena.fog = new THREE.FogExp2(0x312e81, 0.0055);
        }

        notificarEstado('aviso', {
            mensaje: '☁️ ¡Torre Celeste iniciada! Llega a la cima y pulsa [E] en el Trofeo.'
        });
    }

    _construirCircuito(contextoSandbox) {
        // Plataforma inicial amplia
        this._agregarPlataforma(0, 0, 0, 8, 0.8, 8, 0x38bdf8, 'parkour_inicio');

        // Portal de regreso al Lobby en la plataforma inicial
        this.crearPortalFisico3D({
            idDestino: 'lobby',
            nombre: 'Volver al Parque',
            subtitulo: 'Regresar al Lobby Central',
            color: 0x38bdf8,
            posicion: { x: -3.0, y: 0.4, z: -2.6 },
            rotacionY: 0.65,
            alEntrar: (ctx) => {
                RegistroExperiencias.cambiarExperiencia('lobby', ctx || contextoSandbox);
            }
        });

        // Secuencia ascendente de plataformas
        const pasos = [
            { x: 0, y: 1.2, z: 6.2, w: 3.4, d: 3.4, color: 0x06b6d4 },
            { x: 3.8, y: 2.5, z: 9.8, w: 3.2, d: 3.2, color: 0x22d3ee },
            { x: 7.4, y: 3.9, z: 7.2, w: 3.0, d: 3.0, color: 0x38bdf8 },
            { x: 9.5, y: 5.3, z: 2.6, w: 3.0, d: 3.0, color: 0x818cf8 },
            { x: 7.2, y: 6.7, z: -2.4, w: 3.0, d: 3.0, color: 0xa855f7 },
            { x: 2.4, y: 8.1, z: -5.2, w: 3.2, d: 3.2, color: 0xd946ef }
        ];

        pasos.forEach((p, idx) => {
            this._agregarPlataforma(p.x, p.y, p.z, p.w, 0.6, p.d, p.color, `celeste_${idx + 1}`);
        });

        // Plataforma móvil hacia la cima
        const matMovil = new THREE.MeshStandardMaterial({
            map: obtenerTexturaPlataforma(0xf97316),
            roughness: 0.35,
            metalness: 0.2
        });
        this.plataformaMovil = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 3.4), matMovil);
        this.plataformaMovil.position.set(-2.5, 9.2, -5.2);
        this.plataformaMovil.castShadow = true;
        this.plataformaMovil.receiveShadow = true;
        this.grupoRaiz.add(this.plataformaMovil);
        this.colisionadorMovil = this.registrarColisionadorCaja(
            -4.2, 8.9, -6.9, -0.8, 9.5, -3.5, 'parkour_movil'
        );

        // Plataforma Cima
        this._agregarPlataforma(-7.5, 10.6, -5.2, 6.4, 0.8, 6.4, 0xfacc15, 'parkour_cima');

        // Trofeo interactivo en la cima
        const matTrofeo = new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0xd97706,
            emissiveIntensity: 0.75,
            metalness: 0.8,
            roughness: 0.2
        });
        this.trofeoCima = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), matTrofeo);
        this.trofeoCima.position.set(-7.5, 12.1, -5.2);
        this.trofeoCima.castShadow = true;
        this.grupoRaiz.add(this.trofeoCima);

        this.registrarEntidadInteractiva({
            id: 'trofeo_cima_parkour',
            etiqueta: 'Trofeo Celeste (Reclamar Victoria)',
            posicion: { x: -7.5, y: 11.4, z: -5.2 },
            radio: 3.2,
            autoRecoger: false,
            activa: true
        });
    }

    _agregarPlataforma(x, y, z, w, h, d, colorHex, etiqueta) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({
                map: obtenerTexturaPlataforma(colorHex),
                roughness: 0.4,
                metalness: 0.15
            })
        );
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.grupoRaiz.add(mesh);

        this.registrarColisionadorCaja(
            x - w / 2,
            y - h / 2,
            z - d / 2,
            x + w / 2,
            y + h / 2,
            z + d / 2,
            etiqueta
        );
    }

    actualizar(dt, _contextoSandbox) {
        this.tiempoTotal += dt;
        if (this.carreraActiva) {
            this.tiempoCarrera += dt;
        }

        if (this.plataformaMovil && this.colisionadorMovil) {
            const zOsc = -5.2 + Math.sin(this.tiempoTotal * 1.4) * 2.2;
            this.plataformaMovil.position.z = zOsc;
            this.colisionadorMovil.minZ = zOsc - 1.7;
            this.colisionadorMovil.maxZ = zOsc + 1.7;
        }

        if (this.trofeoCima) {
            this.trofeoCima.rotation.y += dt * 1.8;
            this.trofeoCima.position.y = 12.1 + Math.sin(this.tiempoTotal * 2.6) * 0.22;
        }

        if (this.cupulaCielo) {
            this.cupulaCielo.rotation.y += dt * 0.006;
        }
    }

    alInteractuar(_jugador, entidad) {
        if (!entidad || entidad.id !== 'trofeo_cima_parkour') return;
        reproducirSonido('nivel');

        const tiempoFinal = Number(this.tiempoCarrera.toFixed(2));
        const previo = estadoJugador.progresoExperiencias?.parkour?.mejorTiempo ?? null;
        const esRecord = previo === null || tiempoFinal < previo;

        estadoJugador.progresoExperiencias = {
            ...(estadoJugador.progresoExperiencias || {}),
            parkour: {
                mejorTiempo: esRecord ? tiempoFinal : previo,
                victorias: (estadoJugador.progresoExperiencias?.parkour?.victorias || 0) + 1
            }
        };
        guardarEstadoLocal();

        if (!this.recompensaEntregada) {
            this.recompensaEntregada = true;
            this.carreraActiva = false;
            this.otorgarRecompensa(45, 80);
            enviarEventoExperiencia('parkour_victoria', {
                apodo: estadoJugador.apodo,
                tiempo: tiempoFinal
            });
        }

        notificarEstado('aviso', {
            mensaje: esRecord
                ? `🏆 ¡Nuevo récord Torre Celeste: ${tiempoFinal}s! (+45 monedas, +80 XP)`
                : `🏆 ¡Cima alcanzada en ${tiempoFinal}s! Mejor: ${previo}s`
        });
    }

    alEventoRed(evento) {
        if (evento?.subtipo === 'parkour_victoria' && evento.datos?.apodo) {
            notificarEstado('aviso', {
                mensaje: `☁️ ${evento.datos.apodo} coronó la Torre Celeste en ${evento.datos.tiempo}s.`
            });
        }
    }

    desmontar(escena) {
        liberarObjeto3D(this.grupoRaiz);
        this.cupulaCielo = null;
        this.trofeoCima = null;
        this.plataformaMovil = null;
        this.colisionadorMovil = null;
        super.desmontar(escena);
    }
}
