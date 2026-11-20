/**
 * Experiencia heredada `ArenaTurboKarts`: circuito Grand Prix en 8 (160x160 m, calzada 8.4 m)
 * con puente elevado, curvas peraltadas, modificadores de pendiente (±20%) y fuera de pista (-30%),
 * karts personalizables de 120 pts con piloto LEGO visible, 6 turbo pads direccionales,
 * 6 barreras móviles, 14 obstáculos derribables (botes, troncos, osos gigantes),
 * 5 checkpoints estrictos, formato a 2 vueltas y parrilla de salida iluminada de 10 segundos.
 */
import {
    CATALOGO_KARTS,
    CATALOGO_PIEZAS_KART,
    DIMENSION_PISTA_KARTS,
    MITAD_PISTA_KARTS,
    VUELTAS_CARRERA_KARTS
} from '../constantes.js';
import {
    estadoControles,
    estadoJugador,
    estadoRed,
    guardarEstadoLocal,
    notificarEstado
} from '../estado.js';
import {
    crearCupulaCielo,
    liberarObjeto3D,
    obtenerTexturaCespedPlaza,
    obtenerTexturaMetaDamero,
    obtenerTexturaPistaKart,
    obtenerTexturaTurboPad,
    reproducirSonido
} from '../recursos.js';
import {
    actualizarAnimacionAvatar,
    crearAvatar3D,
    ensamblarKart3D,
    montarAvatarEnKart
} from '../avatar.js';
import { ExperienciaBase } from '../nucleoSandbox.js';
import { enviarEstadoJugadorInmediato, enviarEventoExperiencia } from '../red.js';

const ANCHO_PISTA = 8.4;
const SEGMENTOS_PISTA = 200;
const CENTRO_SALIDA_Z = 54;
const DURACION_CONTEO_SALIDA = 10.0;
const DURACION_CEREMONIA_PODIO = 12.0;
const POSICION_PODIO = Object.freeze({ x: 0, y: 0, z: 35 });

export class ArenaTurboKarts extends ExperienciaBase {
    constructor() {
        super({
            id: 'karts',
            nombre: 'Arena Turbo Karts',
            descripcion: 'Circuito GP 160x160 m a 2 vueltas con puente elevado, paddock y podio de campeones.',
            colorPortal: 0xf97316,
            posicionPortal: { x: 0, y: 0, z: -26 },
            minJugadores: 1,
            spawnJugador: { x: 14.4, y: 0.04, z: CENTRO_SALIDA_Z - 1.85 }
        });

        this.contextoActual = null;
        this.cupulaCielo = null;
        this.puntosPista = [];
        this.curvaPista = null;
        this.boostPads = [];
        this.barrerasMoviles = [];
        this.obstaculosDerribables = [];
        this.checkpoints = [];
        this.lucesSemaforo = [];
        this.mallaZonaSalida = null;
        this.bordesZonaSalida = [];
        this.tablaTiempos = new Map();
        this.clasificacionCarrera = [];

        this.estadoCarrera = {
            velocidad: 0,
            velocidadKmH: 0,
            anguloVolante: 0,
            derrapando: false,
            cargaDrift: 0,
            tiempoTurbo: 0,
            enPista: true,
            enAire: false,
            velY: 0,
            checkpointActual: 0,
            vueltaActual: 1,
            totalVueltas: VUELTAS_CARRERA_KARTS,
            carreraActiva: false,
            tiempoVuelta: 0,
            ultimaVuelta: null,
            cuentaRegresiva: 0,
            enZonaSalida: false,
            cooldownSalida: 0,
            slotParrilla: 0,
            bannerMensaje: ''
        };
        this.tiempoTotal = 0;
        this.tiempoLuzVerde = 0;
        this.bannerTemporal = '';
        this.tiempoBannerTemporal = 0;
        this.cooldownAudioChoque = 0;
        this.impulsoLateral = { x: 0, z: 0 };
        this.chispasActivas = [];

        // Estado de Ceremonia de Podio de 12 segundos
        this.ceremoniaPodioActiva = false;
        this.tiempoCeremoniaPodio = 0;
        this.grupoCeremoniaPodio = null;
        this.avataresPodioTemp = [];
        this.particulasCeremonia = [];
        this.timerFuegos = 0;
        this.timerChampan = 0;
    }

    /**
     * Obtiene el factor de masa/impacto del chasis equipado.
     * @param {object} [configKart]
     * @returns {number}
     */
    obtenerPesoImpactoKart(configKart = estadoJugador.configKart) {
        const chasis = CATALOGO_KARTS.find((k) => k.id === configKart?.chasis) || CATALOGO_KARTS[0];
        return typeof chasis?.pesoImpacto === 'number' ? chasis.pesoImpacto : 1.0;
    }

    /**
     * Calcula el cajón asignado (0..7) priorizando el asignado por el servidor multijugador.
     * @returns {number}
     */
    _obtenerSlotParrillaActual() {
        if (estadoRed.conectado && typeof estadoRed.slotParrilla === 'number') {
            return ((Math.floor(estadoRed.slotParrilla) % 8) + 8) % 8;
        }
        return 0;
    }

    /**
     * Devuelve la coordenada exacta escalonada en 2 columnas (`P1`–`P8`) dentro de `zonaSalida`.
     * @param {number} [slotIndex]
     * @returns {{ x: number, y: number, z: number }}
     */
    obtenerPosicionSlotParrilla(slotIndex = 0) {
        const slot = ((Math.floor(slotIndex) % 8) + 8) % 8;
        const fila = Math.floor(slot / 2);
        const columna = slot % 2;
        return {
            x: 2.4 + fila * 2.5 + columna * 1.15,
            y: 0.04,
            z: CENTRO_SALIDA_Z + (columna === 0 ? -1.85 : 1.85)
        };
    }

    /**
     * Devuelve la posición escalonada en el Paddock de calentamiento, `12 m` detrás de `zonaSalida`.
     * @param {number} [slotIndex]
     * @returns {{ x: number, y: number, z: number }}
     */
    obtenerPosicionPaddock(slotIndex = 0) {
        const base = this.obtenerPosicionSlotParrilla(slotIndex);
        return {
            x: base.x + 12.0,
            y: 0.04,
            z: base.z
        };
    }

    /**
     * Cuenta los corredores activos actualmente dentro de `ArenaTurboKarts`.
     * @returns {number}
     */
    obtenerTotalCorredoresActivos() {
        let total = 1;
        for (const remoto of estadoRed.jugadoresRemotos.values()) {
            if (remoto && remoto.experienciaActiva === 'karts') {
                total += 1;
            }
        }
        return total;
    }

    /**
     * Regla dinámica de finalización: 1 para 1 corredor, 2 para 2, y Top 3 para >= 3.
     * @param {number} [totalCorredores]
     * @returns {number}
     */
    obtenerMetaFinalistas(totalCorredores = this.obtenerTotalCorredoresActivos()) {
        if (totalCorredores <= 1) return 1;
        if (totalCorredores === 2) return 2;
        return 3;
    }

    /**
     * Calcula estadísticas totales del kart (120 pts base + modificadores de piezas).
     * @param {object} configKart
     * @returns {{ velocidad: number, aceleracion: number, control: number }}
     */
    obtenerStatsKart(configKart = estadoJugador.configKart) {
        const chasis = CATALOGO_KARTS.find((k) => k.id === configKart?.chasis) || CATALOGO_KARTS[0];
        const rueda =
            CATALOGO_PIEZAS_KART.ruedas.find((r) => r.id === configKart?.ruedas) ||
            CATALOGO_PIEZAS_KART.ruedas[0];
        const aleron =
            CATALOGO_PIEZAS_KART.alerones.find((a) => a.id === configKart?.aleron) ||
            CATALOGO_PIEZAS_KART.alerones[1];

        return {
            velocidad: Math.max(15, chasis.velocidad + rueda.modStats.velocidad + aleron.modStats.velocidad),
            aceleracion: Math.max(15, chasis.aceleracion + rueda.modStats.aceleracion + aleron.modStats.aceleracion),
            control: Math.max(15, chasis.control + rueda.modStats.control + aleron.modStats.control)
        };
    }

    /**
     * Monta el estadio 160x160 m, circuito en 8, puente, parrilla 10s, obstáculos y kart del jugador.
     */
    montar(escena, contextoSandbox) {
        super.montar(escena, contextoSandbox);
        this.contextoActual = contextoSandbox;
        this.tiempoTotal = 0;
        this.tiempoLuzVerde = 0;
        this.bannerTemporal = '';
        this.tiempoBannerTemporal = 0;
        this.cooldownAudioChoque = 0;
        this.impulsoLateral = { x: 0, z: 0 };
        this.chispasActivas = [];
        this.ceremoniaPodioActiva = false;
        this.tiempoCeremoniaPodio = 0;
        this.grupoCeremoniaPodio = null;
        this.avataresPodioTemp = [];
        this.particulasCeremonia = [];
        this.clasificacionCarrera = [];
        estadoControles.modoCeremoniaPodio = false;
        estadoControles.camaraPodio = null;
        this.boostPads = [];
        this.barrerasMoviles = [];
        this.obstaculosDerribables = [];
        this.checkpoints = [];
        this.lucesSemaforo = [];
        this.bordesZonaSalida = [];
        this.mallaZonaSalida = null;
        this.tablaTiempos.clear();

        this._reiniciarEstadoCarrera();

        this.cupulaCielo = crearCupulaCielo('karts_gp');
        this.grupoRaiz.add(this.cupulaCielo);
        if (escena) {
            escena.background = new THREE.Color(0x0ea5e9);
            escena.fog = new THREE.FogExp2(0x7dd3fc, 0.0028);
        }

        this._construirEstadio();
        this._construirPistaFigura8();
        this._construirZonaSalidaYMeta();
        this._construirPodioCampeones();
        this._construirCheckpoints();
        this._construirBoostPads();
        this._construirObstaculos();
        this._construirPortalRetorno();

        // Spawnear en el Paddock de calentamiento detrás de la parrilla (no dispara el conteo de salida)
        const posPaddock = this.obtenerPosicionPaddock(this.estadoCarrera.slotParrilla);
        this.spawnJugador = { ...posPaddock };
        estadoJugador.enVehiculo = true;
        estadoJugador.rotacion = -Math.PI / 2;
        estadoJugador.posicion.x = posPaddock.x;
        estadoJugador.posicion.y = posPaddock.y;
        estadoJugador.posicion.z = posPaddock.z;
        if (contextoSandbox?.avatarLocal) {
            montarAvatarEnKart(contextoSandbox.avatarLocal, estadoJugador.configKart, true);
            contextoSandbox.avatarLocal.position.set(posPaddock.x, posPaddock.y, posPaddock.z);
            contextoSandbox.avatarLocal.rotation.y = estadoJugador.rotacion;
        }
        enviarEstadoJugadorInmediato();
    }

    _reiniciarEstadoCarrera() {
        Object.assign(this.estadoCarrera, {
            velocidad: 0,
            velocidadKmH: 0,
            anguloVolante: 0,
            derrapando: false,
            cargaDrift: 0,
            tiempoTurbo: 0,
            enPista: true,
            enAire: false,
            velY: 0,
            checkpointActual: 0,
            vueltaActual: 1,
            totalVueltas: VUELTAS_CARRERA_KARTS,
            carreraActiva: false,
            tiempoVuelta: 0,
            ultimaVuelta: null,
            cuentaRegresiva: 0,
            enZonaSalida: false,
            cooldownSalida: 0,
            slotParrilla: this._obtenerSlotParrillaActual(),
            bannerMensaje: ''
        });
    }

    /**
     * Construye el suelo del estadio (160x160 m), muros perimetrales y 4 tribunas ampliadas.
     */
    _construirEstadio() {
        const cesped = obtenerTexturaCespedPlaza();
        const suelo = new THREE.Mesh(
            new THREE.PlaneGeometry(DIMENSION_PISTA_KARTS, DIMENSION_PISTA_KARTS),
            new THREE.MeshStandardMaterial({
                map: cesped.map,
                bumpMap: cesped.bumpMap,
                bumpScale: 0.04,
                roughnessMap: cesped.roughnessMap,
                roughness: 0.9
            })
        );
        suelo.rotation.x = -Math.PI / 2;
        suelo.receiveShadow = true;
        this.grupoRaiz.add(suelo);

        // Muros de contención exteriores
        const matMuro = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 });
        const matFranja = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
        const bordes = [
            { x: 0, z: -MITAD_PISTA_KARTS + 0.6, w: DIMENSION_PISTA_KARTS, d: 1.2 },
            { x: 0, z: MITAD_PISTA_KARTS - 0.6, w: DIMENSION_PISTA_KARTS, d: 1.2 },
            { x: -MITAD_PISTA_KARTS + 0.6, z: 0, w: 1.2, d: DIMENSION_PISTA_KARTS },
            { x: MITAD_PISTA_KARTS - 0.6, z: 0, w: 1.2, d: DIMENSION_PISTA_KARTS }
        ];
        for (const b of bordes) {
            const muro = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1.7, b.d), matMuro.clone());
            muro.position.set(b.x, 0.85, b.z);
            muro.receiveShadow = true;
            this.grupoRaiz.add(muro);

            const franja = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.28, b.d + 0.08), matFranja.clone());
            franja.position.set(b.x, 1.35, b.z);
            this.grupoRaiz.add(franja);
        }
        matMuro.dispose();
        matFranja.dispose();

        // Tribunas laterales
        const tribunas = [
            { x: -71, z: 0, rotY: Math.PI / 2, color: 0x2563eb },
            { x: 71, z: 0, rotY: -Math.PI / 2, color: 0xef4444 },
            { x: 0, z: -71, rotY: 0, color: 0x10b981 },
            { x: -46, z: 70, rotY: Math.PI, color: 0xf59e0b }
        ];
        for (const t of tribunas) {
            const grupoT = new THREE.Group();
            grupoT.position.set(t.x, 0, t.z);
            grupoT.rotation.y = t.rotY;

            for (let g = 0; g < 3; g++) {
                const grada = new THREE.Mesh(
                    new THREE.BoxGeometry(30, 1.15, 2.5),
                    new THREE.MeshStandardMaterial({ color: g % 2 === 0 ? t.color : 0xf8fafc, roughness: 0.6 })
                );
                grada.position.set(0, 0.58 + g * 1.15, -g * 2.0);
                grada.castShadow = true;
                grada.receiveShadow = true;
                grupoT.add(grada);
            }
            this.grupoRaiz.add(grupoT);
        }
    }

    /**
     * Genera el circuito en Figura 8 asimétrica (160x160 m, calzada 8.4 m) con puente elevado (`y = 3.8 m`).
     */
    _construirPistaFigura8() {
        const nodosControl = [
            new THREE.Vector3(30, 0, CENTRO_SALIDA_Z),
            new THREE.Vector3(14, 0, CENTRO_SALIDA_Z),
            new THREE.Vector3(0, 0, CENTRO_SALIDA_Z),
            new THREE.Vector3(-24, 0, CENTRO_SALIDA_Z),
            new THREE.Vector3(-48, 0.35, 38),
            new THREE.Vector3(-22, 0, 18),
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(22, 0, -18),
            new THREE.Vector3(48, 0.45, -38),
            new THREE.Vector3(20, 0.55, -58),
            new THREE.Vector3(-20, 0.55, -58),
            new THREE.Vector3(-48, 0.45, -38),
            new THREE.Vector3(-20, 0.7, -18),
            new THREE.Vector3(0, 3.8, 0),
            new THREE.Vector3(20, 0.7, 18),
            new THREE.Vector3(48, 0.35, 38)
        ];

        this.curvaPista = new THREE.CatmullRomCurve3(nodosControl, true, 'catmullrom', 0.45);
        this.puntosPista = [];

        const pts = this.curvaPista.getSpacedPoints(SEGMENTOS_PISTA);
        const posiciones = [];
        const uvs = [];
        const indices = [];
        const mitadAncho = ANCHO_PISTA / 2;
        const arriba = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < SEGMENTOS_PISTA; i++) {
            const p = pts[i];
            const pSig = pts[(i + 1) % SEGMENTOS_PISTA];
            const pPrev = pts[(i - 1 + SEGMENTOS_PISTA) % SEGMENTOS_PISTA];

            const tangente = new THREE.Vector3().subVectors(pSig, pPrev).normalize();
            const derecha = new THREE.Vector3().crossVectors(tangente, arriba).normalize();

            // Peralte suave en curvas exteriores
            const esCurvaExt = Math.abs(p.x) > 24 || Math.abs(p.z) > 40;
            const peralte = esCurvaExt ? Math.sign(p.x) * 0.12 : 0;

            const izq = new THREE.Vector3().copy(p).addScaledVector(derecha, -mitadAncho);
            const der = new THREE.Vector3().copy(p).addScaledVector(derecha, mitadAncho);
            izq.y += 0.04 - peralte;
            der.y += 0.04 + peralte;

            posiciones.push(izq.x, izq.y, izq.z, der.x, der.y, der.z);
            uvs.push(0, i * 0.45, 1, i * 0.45);

            const pendiente = (pSig.y - pPrev.y) / Math.max(0.5, pSig.distanceTo(pPrev));
            this.puntosPista.push({
                idx: i,
                x: p.x,
                y: p.y,
                z: p.z,
                tx: tangente.x,
                ty: tangente.y,
                tz: tangente.z,
                rx: derecha.x,
                rz: derecha.z,
                pendiente,
                rotY: Math.atan2(tangente.x, tangente.z)
            });

            const iBase = i * 2;
            const iSigBase = ((i + 1) % SEGMENTOS_PISTA) * 2;
            indices.push(iBase, iBase + 1, iSigBase);
            indices.push(iBase + 1, iSigBase + 1, iSigBase);
        }

        const geoPista = new THREE.BufferGeometry();
        geoPista.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
        geoPista.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geoPista.setIndex(indices);
        geoPista.computeVertexNormals();

        const texAsfalto = obtenerTexturaPistaKart();
        texAsfalto.wrapS = THREE.RepeatWrapping;
        texAsfalto.wrapT = THREE.RepeatWrapping;
        const matPista = new THREE.MeshStandardMaterial({
            map: texAsfalto,
            roughness: 0.72,
            metalness: 0.08,
            side: THREE.DoubleSide
        });
        const mallaPista = new THREE.Mesh(geoPista, matPista);
        mallaPista.receiveShadow = true;
        mallaPista.castShadow = true;
        this.grupoRaiz.add(mallaPista);

        // Pilares y barandillas del puente elevado
        const matPilar = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55 });
        const matBarandal = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
        for (const seg of this.puntosPista) {
            if (seg.y > 0.9 && seg.idx % 4 === 0) {
                for (const lado of [-1, 1]) {
                    const bx = seg.x + seg.rx * (mitadAncho + 0.18) * lado;
                    const bz = seg.z + seg.rz * (mitadAncho + 0.18) * lado;
                    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.28), matBarandal.clone());
                    poste.position.set(bx, seg.y + 0.45, bz);
                    this.grupoRaiz.add(poste);
                }
                if (seg.idx % 8 === 0 && (Math.abs(seg.x) > 5.5 || Math.abs(seg.z) > 5.5)) {
                    const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, seg.y, 10), matPilar.clone());
                    pilar.position.set(seg.x, seg.y / 2, seg.z);
                    pilar.castShadow = true;
                    this.grupoRaiz.add(pilar);
                }
            }
        }
        matPilar.dispose();
        matBarandal.dispose();
    }

    /**
     * Crea textura temporal `<canvas>` marcada `esClonTemporal = true` para carteles y placas del circuito.
     * @param {number} ancho
     * @param {number} alto
     * @param {(ctx: CanvasRenderingContext2D, ancho: number, alto: number) => void} dibujar
     * @returns {THREE.CanvasTexture}
     */
    _crearTexturaTemporalCanvas(ancho, alto, dibujar) {
        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        dibujar(ctx, ancho, alto);
        const tex = new THREE.CanvasTexture(canvas);
        tex.userData = { esClonTemporal: true };
        return tex;
    }

    /**
     * Crea textura temporal para el cartel flotante de la Zona de Salida (`esClonTemporal = true`).
     * @returns {THREE.CanvasTexture}
     */
    _crearTexturaCartelSalida() {
        return this._crearTexturaTemporalCanvas(512, 128, (ctx) => {
            ctx.fillStyle = 'rgba(14, 18, 28, 0.86)';
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 6;
            ctx.fillRect(10, 10, 492, 108);
            ctx.strokeRect(10, 10, 492, 108);

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 34px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏁 ZONA DE SALIDA · 2 VUELTAS', 256, 48);

            ctx.fillStyle = '#fef08a';
            ctx.font = 'bold 23px system-ui, sans-serif';
            ctx.fillText('Entra al recuadro luminoso (Conteo 10s)', 256, 88);
        });
    }

    /**
     * Crea textura temporal para el cartel flotante del Paddock de calentamiento.
     * @returns {THREE.CanvasTexture}
     */
    _crearTexturaCartelPaddock() {
        return this._crearTexturaTemporalCanvas(512, 128, (ctx) => {
            ctx.fillStyle = 'rgba(14, 18, 28, 0.86)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 6;
            ctx.fillRect(10, 10, 492, 108);
            ctx.strokeRect(10, 10, 492, 108);

            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 32px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏎️ ZONA DE PADDOCK', 256, 48);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 22px system-ui, sans-serif';
            ctx.fillText('Conduce adelante hacia la Parrilla para correr', 256, 88);
        });
    }

    /**
     * Construye el arco de meta, semáforo de 5 luces, cajones P1–P8, zona de salida (10s) y Paddock trasero.
     */
    _construirZonaSalidaYMeta() {
        const grupoMeta = new THREE.Group();
        grupoMeta.position.set(0, 0, CENTRO_SALIDA_Z);

        const mitadAnchoArco = ANCHO_PISTA / 2 + 0.65;
        const matPilar = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
        const pilarIzq = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.1, 0.65), matPilar);
        pilarIzq.position.set(0, 2.55, -mitadAnchoArco);
        const pilarDer = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.1, 0.65), matPilar.clone());
        pilarDer.position.set(0, 2.55, mitadAnchoArco);
        pilarIzq.castShadow = true;
        pilarDer.castShadow = true;
        grupoMeta.add(pilarIzq, pilarDer);

        const banner = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 1.15, ANCHO_PISTA + 2.0),
            new THREE.MeshStandardMaterial({ map: obtenerTexturaMetaDamero(), roughness: 0.4 })
        );
        banner.position.set(0, 5.05, 0);
        grupoMeta.add(banner);

        // Semáforo colgante de 5 luces orientadas hacia la parrilla (+X)
        const cajaSemaforo = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.72, 5.8),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.5 })
        );
        cajaSemaforo.position.set(0.28, 4.15, 0);
        grupoMeta.add(cajaSemaforo);

        for (let i = 0; i < 5; i++) {
            const matLuz = new THREE.MeshStandardMaterial({
                color: 0x3f1d1d,
                emissive: 0x000000,
                emissiveIntensity: 1.2,
                roughness: 0.25
            });
            const luz = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), matLuz);
            luz.position.set(0.5, 4.15, -2.1 + i * 1.05);
            grupoMeta.add(luz);
            this.lucesSemaforo.push(matLuz);
        }

        const lineaMeta = new THREE.Mesh(
            new THREE.PlaneGeometry(1.75, ANCHO_PISTA - 0.35),
            new THREE.MeshStandardMaterial({ map: obtenerTexturaMetaDamero(), roughness: 0.5 })
        );
        lineaMeta.rotation.x = -Math.PI / 2;
        lineaMeta.position.set(0, 0.06, 0);
        grupoMeta.add(lineaMeta);

        // Pad luminoso identificable de Zona de Salida (x: 1.5 .. 13.5 -> centro x=7.5)
        const matZona = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.24,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.mallaZonaSalida = new THREE.Mesh(new THREE.PlaneGeometry(12.0, ANCHO_PISTA - 0.6), matZona);
        this.mallaZonaSalida.rotation.x = -Math.PI / 2;
        this.mallaZonaSalida.position.set(7.5, 0.055, 0);
        grupoMeta.add(this.mallaZonaSalida);

        // Bordes perimetrales luminosos de la zona de parrilla
        const mitadProfZona = (ANCHO_PISTA - 0.6) / 2;
        const configsBorde = [
            { x: 7.5, z: -mitadProfZona, w: 12.1, d: 0.22 },
            { x: 7.5, z: mitadProfZona, w: 12.1, d: 0.22 },
            { x: 1.5, z: 0, w: 0.22, d: ANCHO_PISTA - 0.4 },
            { x: 13.5, z: 0, w: 0.22, d: ANCHO_PISTA - 0.4 }
        ];
        for (const cb of configsBorde) {
            const matBorde = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: 0x22d3ee,
                emissiveIntensity: 0.9,
                roughness: 0.25
            });
            const borde = new THREE.Mesh(new THREE.BoxGeometry(cb.w, 0.14, cb.d), matBorde);
            borde.position.set(cb.x, 0.1, cb.z);
            grupoMeta.add(borde);
            this.bordesZonaSalida.push(matBorde);
        }

        // 8 Cajones escalonados en U pintados en la parrilla (P1–P8)
        const matCajon = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        for (let slot = 0; slot < 8; slot++) {
            const posSlot = this.obtenerPosicionSlotParrilla(slot);
            const sx = posSlot.x;
            const sz = posSlot.z - CENTRO_SALIDA_Z;
            const marcaFrontal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 1.55), matCajon);
            marcaFrontal.position.set(sx - 0.85, 0.065, sz);
            const marcaIzq = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.14), matCajon);
            marcaIzq.position.set(sx - 0.2, 0.065, sz - 0.72);
            const marcaDer = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.14), matCajon);
            marcaDer.position.set(sx - 0.2, 0.065, sz + 0.72);
            grupoMeta.add(marcaFrontal, marcaIzq, marcaDer);
        }

        // Cartel flotante de Zona de Salida
        const texCartel = this._crearTexturaCartelSalida();
        const matCartel = new THREE.SpriteMaterial({ map: texCartel, transparent: true });
        const cartel = new THREE.Sprite(matCartel);
        cartel.position.set(7.5, 3.55, 0);
        cartel.scale.set(7.2, 1.8, 1);
        grupoMeta.add(cartel);

        // Zona de Paddock / Calentamiento (12 m detrás de la parrilla: x 14.0 .. 25.0)
        const zonaPaddock = new THREE.Mesh(
            new THREE.PlaneGeometry(11.0, ANCHO_PISTA - 0.6),
            new THREE.MeshBasicMaterial({
                color: 0xf59e0b,
                transparent: true,
                opacity: 0.16,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        zonaPaddock.rotation.x = -Math.PI / 2;
        zonaPaddock.position.set(19.5, 0.052, 0);
        grupoMeta.add(zonaPaddock);

        const matCajonPaddock = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        for (let slot = 0; slot < 8; slot++) {
            const posPad = this.obtenerPosicionPaddock(slot);
            const padFrontal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 1.5), matCajonPaddock);
            padFrontal.position.set(posPad.x - 0.85, 0.062, posPad.z - CENTRO_SALIDA_Z);
            const padBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.12), matCajonPaddock);
            padBase.position.set(posPad.x - 0.25, 0.062, posPad.z - CENTRO_SALIDA_Z - 0.7);
            const padBase2 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.12), matCajonPaddock);
            padBase2.position.set(posPad.x - 0.25, 0.062, posPad.z - CENTRO_SALIDA_Z + 0.7);
            grupoMeta.add(padFrontal, padBase, padBase2);
        }

        const texPaddock = this._crearTexturaCartelPaddock();
        const cartelPaddock = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPaddock, transparent: true }));
        cartelPaddock.position.set(19.5, 3.25, 0);
        cartelPaddock.scale.set(6.8, 1.7, 1);
        grupoMeta.add(cartelPaddock);

        this.grupoRaiz.add(grupoMeta);
    }

    /**
     * Construye el monumento del Podio de Campeones de 3 niveles y su explanada frontal para karts.
     */
    _construirPodioCampeones() {
        const grupoPodio = new THREE.Group();
        grupoPodio.position.set(POSICION_PODIO.x, POSICION_PODIO.y, POSICION_PODIO.z);

        // Base del podio + ribete luminoso
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(8.2, 0.22, 4.6),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.35 })
        );
        base.position.set(0, 0.11, 0);
        base.receiveShadow = true;
        grupoPodio.add(base);

        // 3 Escalones: 1.º Oro (centro), 2.º Plata (izquierda), 3.º Bronce (derecha)
        const escalones = [
            { puesto: '1.º', x: 0, alto: 1.45, color: 0xfacc15, ancho: 2.0 },
            { puesto: '2.º', x: -2.15, alto: 1.05, color: 0xcbd5e1, ancho: 1.85 },
            { puesto: '3.º', x: 2.15, alto: 0.78, color: 0xd97706, ancho: 1.85 }
        ];
        for (const esc of escalones) {
            const bloque = new THREE.Mesh(
                new THREE.BoxGeometry(esc.ancho, esc.alto, 1.95),
                new THREE.MeshStandardMaterial({
                    color: esc.color,
                    metalness: 0.55,
                    roughness: 0.25
                })
            );
            bloque.position.set(esc.x, esc.alto / 2, 0);
            bloque.castShadow = true;
            bloque.receiveShadow = true;
            grupoPodio.add(bloque);

            const texPlaca = this._crearTexturaTemporalCanvas(128, 128, (ctx) => {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(8, 8, 112, 112);
                ctx.strokeStyle = '#f8fafc';
                ctx.lineWidth = 6;
                ctx.strokeRect(10, 10, 108, 108);
                ctx.fillStyle = '#fef08a';
                ctx.font = 'bold 62px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(esc.puesto, 64, 68);
            });
            const placa = new THREE.Mesh(
                new THREE.PlaneGeometry(0.95, 0.65),
                new THREE.MeshBasicMaterial({ map: texPlaca })
            );
            placa.position.set(esc.x, Math.max(0.42, esc.alto * 0.55), 0.99);
            grupoPodio.add(placa);
        }

        // Pórtico trasero festivo del podio con cartel y reflectores
        const matPostePodio = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.3 });
        for (const px of [-3.6, 3.6]) {
            const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.1, 10), matPostePodio);
            poste.position.set(px, 2.05, -1.75);
            poste.castShadow = true;
            const foco = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 10, 8),
                new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.2 })
            );
            foco.position.set(px, 4.1, -1.55);
            grupoPodio.add(poste, foco);
        }

        const texBannerPodio = this._crearTexturaTemporalCanvas(512, 128, (ctx) => {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 512, 128);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 8;
            ctx.strokeRect(8, 8, 496, 112);
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 34px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏆 PODIO DE CAMPEONES 🏆', 256, 66);
        });
        const cartelPodio = new THREE.Mesh(
            new THREE.BoxGeometry(7.2, 1.1, 0.24),
            new THREE.MeshBasicMaterial({ map: texBannerPodio })
        );
        cartelPodio.position.set(0, 3.85, -1.75);
        grupoPodio.add(cartelPodio);

        // Explanada delantera para exhibir los karts estacionados frente al podio (z = +5.2 local -> mundo z=40.2)
        const explanada = new THREE.Mesh(
            new THREE.PlaneGeometry(9.6, 4.4),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.15 })
        );
        explanada.rotation.x = -Math.PI / 2;
        explanada.position.set(0, 0.03, 5.2);
        explanada.receiveShadow = true;
        grupoPodio.add(explanada);

        const bordeExplanada = new THREE.Mesh(
            new THREE.PlaneGeometry(9.9, 4.7),
            new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.35 })
        );
        bordeExplanada.rotation.x = -Math.PI / 2;
        bordeExplanada.position.set(0, 0.025, 5.2);
        grupoPodio.add(bordeExplanada);

        this.grupoRaiz.add(grupoPodio);
    }

    /**
     * Coloca 5 Checkpoints en orden estricto alrededor del circuito en 8.
     */
    _construirCheckpoints() {
        const fracciones = [0.16, 0.35, 0.52, 0.72, 0.88];
        const offsetPoste = ANCHO_PISTA / 2 + 0.5;
        fracciones.forEach((f, idx) => {
            const segIdx = Math.floor(f * SEGMENTOS_PISTA) % SEGMENTOS_PISTA;
            const seg = this.puntosPista[segIdx];

            const grupoCP = new THREE.Group();
            grupoCP.position.set(seg.x, seg.y, seg.z);
            grupoCP.rotation.y = seg.rotY;

            const matPoste = new THREE.MeshStandardMaterial({
                color: 0xf97316,
                emissive: 0xf97316,
                emissiveIntensity: 0.45,
                roughness: 0.35
            });
            const pIzq = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.8, 0.4), matPoste);
            pIzq.position.set(-offsetPoste, 1.9, 0);
            const pDer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.8, 0.4), matPoste.clone());
            pDer.position.set(offsetPoste, 1.9, 0);

            const barra = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_PISTA + 1.4, 0.36, 0.36), matPoste.clone());
            barra.position.set(0, 3.9, 0);

            grupoCP.add(pIzq, pDer, barra);
            this.grupoRaiz.add(grupoCP);

            this.checkpoints.push({
                indice: idx,
                posicion: { x: seg.x, y: seg.y, z: seg.z },
                materiales: [pIzq.material, pDer.material, barra.material],
                superado: false
            });
        });
    }

    /**
     * Coloca exactamente 6 Turbo Pads luminosos cuyos chevrones (>>>) apuntan hacia adelante sobre el trazado.
     */
    _construirBoostPads() {
        const TOTAL_BOOST_PADS = 6;
        const texPad = obtenerTexturaTurboPad();
        const geoPad = new THREE.PlaneGeometry(3.2, 4.4);
        const matPad = new THREE.MeshBasicMaterial({ map: texPad, side: THREE.DoubleSide });

        for (let i = 0; i < TOTAL_BOOST_PADS; i++) {
            const segIdx = Math.floor(((i + 0.5) / TOTAL_BOOST_PADS) * SEGMENTOS_PISTA) % SEGMENTOS_PISTA;
            const seg = this.puntosPista[segIdx];
            const mesh = new THREE.Mesh(geoPad.clone(), matPad.clone());
            mesh.position.set(seg.x, seg.y + 0.08, seg.z);

            // PlaneGeometry (+Y = punta de chevrones) rotada -PI/2 en X apunta hacia -Z;
            // sumar PI en Y invierte -Z hacia +Z para alinear exactamente con (+tx, +ty, +tz).
            const angPendiente = Math.asin(Math.max(-0.5, Math.min(0.5, seg.ty)));
            mesh.rotation.order = 'YXZ';
            mesh.rotation.y = seg.rotY + Math.PI;
            mesh.rotation.x = -Math.PI / 2 + angPendiente;
            this.grupoRaiz.add(mesh);

            this.boostPads.push({
                posicion: { x: seg.x, y: seg.y, z: seg.z },
                cooldown: 0
            });
        }
        geoPad.dispose();
        matPad.dispose();
    }

    /**
     * Construye un obstáculo procedural 3D personalizado (`bote_basura`, `tronco` u `oso` gigante).
     * @param {'bote_basura'|'tronco'|'oso'} tipo
     * @returns {{ grupo: THREE.Group, alturaCentro: number }}
     */
    _crearMallaObstaculoKart(tipo) {
        const grupo = new THREE.Group();

        if (tipo === 'bote_basura') {
            const matMetal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.72, roughness: 0.32 });
            const matAro = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.38 });
            const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.95, 12), matMetal);
            cuerpo.castShadow = true;
            grupo.add(cuerpo);

            for (const ry of [-0.22, 0.14]) {
                const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 12), matAro);
                aro.position.y = ry;
                grupo.add(aro);
            }
            const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 12), matAro);
            tapa.position.y = 0.52;
            tapa.castShadow = true;
            const asa = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.09), matAro);
            asa.position.y = 0.63;
            const asaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.16), matAro);
            asaIzq.position.set(-0.44, 0.15, 0);
            const asaDer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.16), matAro);
            asaDer.position.set(0.44, 0.15, 0);
            grupo.add(tapa, asa, asaIzq, asaDer);
            return { grupo, alturaCentro: 0.48 };
        }

        if (tipo === 'tronco') {
            const matCorteza = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
            const matMadera = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.72 });
            const matNucleo = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.78 });

            const cilindro = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 1.55, 12), matCorteza);
            cilindro.rotation.z = Math.PI / 2;
            cilindro.castShadow = true;
            grupo.add(cilindro);

            for (const signo of [-1, 1]) {
                const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12), matMadera);
                disco.rotation.z = Math.PI / 2;
                disco.position.x = signo * 0.77;
                const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), matNucleo);
                centro.rotation.z = Math.PI / 2;
                centro.position.x = signo * 0.78;
                grupo.add(disco, centro);
            }
            const rama = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.34, 8), matCorteza);
            rama.position.set(0.18, 0.34, 0.12);
            rama.rotation.z = -0.5;
            rama.castShadow = true;
            grupo.add(rama);
            return { grupo, alturaCentro: 0.37 };
        }

        // Oso de peluche gigante ('oso')
        const matPeluche = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.92 });
        const matCrema = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.88 });
        const matNegro = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35 });

        const torso = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 10), matPeluche);
        torso.scale.set(1, 1.12, 0.92);
        torso.position.y = 0.28;
        torso.castShadow = true;

        const panza = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), matCrema);
        panza.position.set(0, 0.28, 0.24);

        const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), matPeluche);
        cabeza.position.set(0, 0.88, 0.02);
        cabeza.castShadow = true;

        const hocico = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), matCrema);
        hocico.position.set(0, 0.82, 0.34);

        const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), matNegro);
        nariz.position.set(0, 0.86, 0.48);

        grupo.add(torso, panza, cabeza, hocico, nariz);

        for (const lado of [-1, 1]) {
            const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matNegro);
            ojo.position.set(lado * 0.14, 0.96, 0.34);
            const oreja = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), matPeluche);
            oreja.position.set(lado * 0.28, 1.18, 0);
            oreja.castShadow = true;
            const brazo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), matPeluche);
            brazo.scale.set(0.85, 1.3, 0.85);
            brazo.position.set(lado * 0.46, 0.44, 0.12);
            brazo.rotation.z = lado * 0.55;
            brazo.castShadow = true;
            const pata = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), matPeluche);
            pata.scale.set(0.9, 0.8, 1.25);
            pata.position.set(lado * 0.28, -0.02, 0.32);
            pata.castShadow = true;
            grupo.add(ojo, oreja, brazo, pata);
        }
        return { grupo, alturaCentro: 0.22 };
    }

    /**
     * Coloca 6 barreras móviles oscilantes y 14 obstáculos personalizados derribables (botes, troncos, osos).
     */
    _construirObstaculos() {
        // 6 Barreras oscilantes laterales
        const matBarrera = new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0x991b1b,
            emissiveIntensity: 0.45,
            roughness: 0.35
        });
        const indicesBarreras = [22, 52, 86, 118, 150, 178];
        indicesBarreras.forEach((segIdx, idx) => {
            const seg = this.puntosPista[segIdx % SEGMENTOS_PISTA];
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.85), matBarrera.clone());
            mesh.castShadow = true;
            this.grupoRaiz.add(mesh);

            this.barrerasMoviles.push({
                seg,
                mesh,
                fase: idx * 1.1
            });
        });
        matBarrera.dispose();

        // 14 Obstáculos derribables personalizados: bote_basura, tronco, oso gigante
        const tiposObstaculos = ['bote_basura', 'tronco', 'oso'];
        for (let i = 0; i < 14; i++) {
            const segIdx = Math.floor(((i + 0.95) / 15.2) * SEGMENTOS_PISTA) % SEGMENTOS_PISTA;
            const seg = this.puntosPista[segIdx];
            const offsetLat = (i % 2 === 0 ? 1 : -1) * (ANCHO_PISTA * 0.26);
            const bx = seg.x + seg.rx * offsetLat;
            const bz = seg.z + seg.rz * offsetLat;
            const tipo = tiposObstaculos[i % tiposObstaculos.length];

            const { grupo, alturaCentro } = this._crearMallaObstaculoKart(tipo);
            grupo.position.set(bx, seg.y + alturaCentro, bz);
            grupo.rotation.y = seg.rotY;
            this.grupoRaiz.add(grupo);

            this.obstaculosDerribables.push({
                tipo,
                mesh: grupo,
                posBase: { x: bx, y: seg.y + alturaCentro, z: bz },
                rotBaseY: seg.rotY,
                derribado: false,
                vel: { x: 0, y: 0, z: 0 },
                respawn: 0
            });
        }
    }

    /**
     * Portal físico 3D de regreso al Lobby Central en el sector sur del estadio 160x160.
     */
    _construirPortalRetorno() {
        this.crearPortalFisico3D({
            idDestino: 'lobby',
            nombre: 'Lobby Central',
            subtitulo: 'Salir de la carrera',
            color: 0x38bdf8,
            posicion: { x: 0, y: 0, z: 70 },
            rotacionY: Math.PI
        });
    }

    /**
     * Consulta el segmento de pista más cercano considerando la altura actual (puente vs paso inferior).
     */
    _consultarPista(x, yActual, z) {
        let mejor = null;
        let mejorScore = Infinity;
        let distXZMin = Infinity;

        for (const seg of this.puntosPista) {
            const distXZ = Math.hypot(x - seg.x, z - seg.z);
            const diffY = Math.abs(yActual - seg.y);
            const score = distXZ + diffY * 3.2;
            if (score < mejorScore) {
                mejorScore = score;
                mejor = seg;
                distXZMin = distXZ;
            }
        }
        return { seg: mejor, distCentro: distXZMin };
    }

    /**
     * Actualiza las 5 luces del semáforo de salida según el progreso del conteo de 10 segundos.
     */
    _actualizarVisualSemaforo(restante, luzVerdeRestante) {
        if (this.lucesSemaforo.length === 0) return;

        for (let i = 0; i < this.lucesSemaforo.length; i++) {
            const mat = this.lucesSemaforo[i];
            if (luzVerdeRestante > 0) {
                mat.color.setHex(0x22c55e);
                mat.emissive.setHex(0x4ade80);
            } else if (restante > 0) {
                const segs = Math.ceil(restante);
                const umbral = 5 - i;
                if (segs <= umbral) {
                    mat.color.setHex(0xef4444);
                    mat.emissive.setHex(0xff2222);
                } else {
                    mat.color.setHex(0x78350f);
                    mat.emissive.setHex(0xf59e0b);
                }
            } else {
                mat.color.setHex(0x3f1d1d);
                mat.emissive.setHex(0x000000);
            }
        }
    }

    /**
     * Reinicia el color de todos los checkpoints al empezar una nueva vuelta.
     */
    _reiniciarVisualCheckpoints() {
        for (const cp of this.checkpoints) {
            cp.superado = false;
            for (const mat of cp.materiales) {
                mat.color.setHex(0xf97316);
                mat.emissive.setHex(0xf97316);
            }
        }
    }

    /**
     * Actualiza la tabla local/sala de mejores tiempos finales de carrera.
     */
    _registrarTiempoRanking(apodo, tiempo) {
        const previo = this.tablaTiempos.get(apodo);
        if (previo === undefined || tiempo < previo) {
            this.tablaTiempos.set(apodo, tiempo);
        }
    }

    /**
     * Reconstruye en vivo el kart del jugador tras personalizar piezas en el garaje.
     */
    actualizarKartJugador() {
        if (this.contextoActual?.avatarLocal) {
            montarAvatarEnKart(this.contextoActual.avatarLocal, estadoJugador.configKart, true);
        }
        guardarEstadoLocal();
        enviarEstadoJugadorInmediato();
    }

    /**
     * Inicia el conteo sincronizado de 10 segundos de la parrilla de salida para una carrera a 2 vueltas.
     */
    _iniciarConteoSalida(emitirRed = true) {
        if (this.estadoCarrera.cuentaRegresiva > 0 || this.ceremoniaPodioActiva) return;
        this.clasificacionCarrera = [];
        this.estadoCarrera.slotParrilla = this._obtenerSlotParrillaActual();
        this.estadoCarrera.cuentaRegresiva = DURACION_CONTEO_SALIDA;
        this.estadoCarrera.carreraActiva = false;
        this.estadoCarrera.vueltaActual = 1;
        this.estadoCarrera.totalVueltas = VUELTAS_CARRERA_KARTS;
        this.estadoCarrera.tiempoVuelta = 0;
        this.estadoCarrera.checkpointActual = 0;
        this.estadoCarrera.velocidad = 0;
        this.tiempoLuzVerde = 0;
        this.bannerTemporal = '';
        this.tiempoBannerTemporal = 0;
        this._reiniciarVisualCheckpoints();

        // Alinear inmediatamente en el cajón asignado si se inicia por red cerca de la salida
        if (this.estadoCarrera.enZonaSalida) {
            const slotPos = this.obtenerPosicionSlotParrilla(this.estadoCarrera.slotParrilla);
            estadoJugador.posicion.x = slotPos.x;
            estadoJugador.posicion.y = slotPos.y;
            estadoJugador.posicion.z = slotPos.z;
            estadoJugador.rotacion = -Math.PI / 2;
        }
        reproducirSonido('interaccion');

        if (emitirRed) {
            enviarEventoExperiencia('iniciar_conteo_carrera', {
                accion: 'iniciar_conteo_carrera',
                duracion: DURACION_CONTEO_SALIDA,
                vueltas: VUELTAS_CARRERA_KARTS
            });
        }
    }

    /**
     * Registra un corredor en la clasificación de la carrera actual y dispara el podio si alcanza el cupo dinámico.
     * @param {object} finalista
     */
    _registrarFinalistaCarrera(finalista) {
        if (!finalista || !finalista.id || typeof finalista.tiempo !== 'number') return;
        const existente = this.clasificacionCarrera.find((f) => f.id === finalista.id);
        if (existente) {
            if (finalista.tiempo < existente.tiempo) {
                Object.assign(existente, finalista);
            }
        } else {
            this.clasificacionCarrera.push({ ...finalista });
        }
        this.clasificacionCarrera.sort((a, b) => a.tiempo - b.tiempo);

        const meta = this.obtenerMetaFinalistas();
        if (!this.ceremoniaPodioActiva && this.clasificacionCarrera.length >= meta) {
            this.iniciarCeremoniaPodio(this.clasificacionCarrera.slice(0, 3), true);
        }
    }

    /**
     * Crea un estallido temporal de partículas (`THREE.Points`) dentro del grupo objetivo.
     * @param {THREE.Object3D} padre
     * @param {{x:number,y:number,z:number}} origen
     * @param {object} cfg
     */
    _crearExplosionParticulas(padre, origen, cfg) {
        const {
            cantidad = 18,
            color = 0xfacc15,
            size = 0.24,
            gravedad = 9,
            minVy = 2.5,
            maxVy = 6.5,
            minRadio = 1.5,
            maxRadio = 5.0,
            vidaMax = 0.9
        } = cfg;
        const posiciones = new Float32Array(cantidad * 3);
        const velocidades = [];

        for (let i = 0; i < cantidad; i++) {
            posiciones[i * 3] = origen.x;
            posiciones[i * 3 + 1] = origen.y;
            posiciones[i * 3 + 2] = origen.z;
            const ang = (i / cantidad) * Math.PI * 2 + Math.random() * 0.5;
            const rap = minRadio + Math.random() * (maxRadio - minRadio);
            velocidades.push({
                x: Math.cos(ang) * rap,
                y: minVy + Math.random() * (maxVy - minVy),
                z: Math.sin(ang) * rap
            });
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const mat = new THREE.PointsMaterial({
            color,
            size,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const puntos = new THREE.Points(geo, mat);
        puntos.userData = { esClonTemporal: true };
        padre.add(puntos);

        return { puntos, velocidades, gravedad, vida: vidaMax, duracionMax: vidaMax };
    }

    /**
     * Emite una descarga aérea multicolor de fuegos artificiales detrás del podio.
     */
    _emitirFuegoArtificialPodio() {
        if (!this.grupoCeremoniaPodio) return;
        const paleta = [0xfacc15, 0x22d3ee, 0xf43f5e, 0xa855f7, 0x4ade80];
        const color = paleta[Math.floor(Math.random() * paleta.length)];
        const origen = {
            x: (Math.random() - 0.5) * 8.0,
            y: 5.4 + Math.random() * 3.2,
            z: POSICION_PODIO.z - 2.2 - Math.random() * 2.6
        };
        const burst = this._crearExplosionParticulas(this.grupoCeremoniaPodio, origen, {
            cantidad: 24,
            color,
            size: 0.34,
            gravedad: 4.5,
            minVy: -2.0,
            maxVy: 5.5,
            minRadio: 3.5,
            maxRadio: 7.5,
            vidaMax: 1.15
        });
        this.particulasCeremonia.push(burst);
        reproducirSonido('fuegos_artificiales');
    }

    /**
     * Emite chorros dorados de champán desde los tres escalones del podio.
     */
    _emitirChampagnePodio() {
        if (!this.grupoCeremoniaPodio) return;
        const fuentes = [
            { x: POSICION_PODIO.x, y: 1.65, z: POSICION_PODIO.z + 0.35 },
            { x: POSICION_PODIO.x - 2.15, y: 1.25, z: POSICION_PODIO.z + 0.35 },
            { x: POSICION_PODIO.x + 2.15, y: 0.95, z: POSICION_PODIO.z + 0.35 }
        ];
        for (const origen of fuentes) {
            const spray = this._crearExplosionParticulas(this.grupoCeremoniaPodio, origen, {
                cantidad: 10,
                color: 0xfef08a,
                size: 0.22,
                gravedad: 9.5,
                minVy: 3.4,
                maxVy: 6.2,
                minRadio: 0.7,
                maxRadio: 2.1,
                vidaMax: 0.75
            });
            this.particulasCeremonia.push(spray);
        }
    }

    /**
     * Inicia la Ceremonia de Podio de 12 segundos con pilotos LEGO celebrando, karts estacionados adelante y cámara heroica.
     * @param {Array<object>} clasificacion
     * @param {boolean} [emitirRed]
     */
    iniciarCeremoniaPodio(clasificacion = [], emitirRed = true) {
        if (this.ceremoniaPodioActiva) return;
        const top3 = Array.isArray(clasificacion) ? clasificacion.slice(0, 3) : [];
        if (top3.length === 0) return;

        if (this.grupoCeremoniaPodio) {
            liberarObjeto3D(this.grupoCeremoniaPodio);
            this.grupoCeremoniaPodio = null;
        }
        this.particulasCeremonia = [];
        this.avataresPodioTemp = [];

        this.ceremoniaPodioActiva = true;
        this.tiempoCeremoniaPodio = DURACION_CEREMONIA_PODIO;
        this.clasificacionPodioActiva = top3;
        this.timerFuegos = 0.05;
        this.timerChampan = 0.05;
        this.estadoCarrera.carreraActiva = false;
        this.estadoCarrera.cuentaRegresiva = 0;
        this.estadoCarrera.velocidad = 0;
        this.estadoCarrera.velocidadKmH = 0;

        estadoControles.garajeKartAbierto = false;
        estadoControles.modoCeremoniaPodio = true;

        this.grupoCeremoniaPodio = new THREE.Group();
        this.grupoCeremoniaPodio.userData = { esClonTemporal: true };
        this.grupoRaiz.add(this.grupoCeremoniaPodio);

        const posEscalones = [
            { x: POSICION_PODIO.x, y: 1.45, z: POSICION_PODIO.z },
            { x: POSICION_PODIO.x - 2.15, y: 1.05, z: POSICION_PODIO.z },
            { x: POSICION_PODIO.x + 2.15, y: 0.78, z: POSICION_PODIO.z }
        ];
        const posKarts = [
            { x: POSICION_PODIO.x, y: 0.04, z: POSICION_PODIO.z + 5.5, rotY: 0.35 },
            { x: POSICION_PODIO.x - 2.6, y: 0.04, z: POSICION_PODIO.z + 4.9, rotY: 0.52 },
            { x: POSICION_PODIO.x + 2.6, y: 0.04, z: POSICION_PODIO.z + 4.9, rotY: -0.52 }
        ];

        let localEnTop3 = false;
        const avatarLocal = this.contextoActual?.avatarLocal;

        top3.forEach((finisher, idx) => {
            const pEsc = posEscalones[idx] || posEscalones[2];
            const pKart = posKarts[idx] || posKarts[2];

            // 1. Kart estacionado vacío frente al podio (primer/segundo plano)
            const kartSolo = ensamblarKart3D(finisher.configKart || {});
            kartSolo.position.set(pKart.x, pKart.y, pKart.z);
            kartSolo.rotation.y = pKart.rotY;
            this.grupoCeremoniaPodio.add(kartSolo);

            // 2. Piloto LEGO desmontado celebrando sobre su escalón del podio
            if (finisher.id === estadoJugador.id) {
                localEnTop3 = true;
                estadoJugador.enVehiculo = false;
                if (avatarLocal) {
                    montarAvatarEnKart(avatarLocal, null, false);
                    avatarLocal.position.set(pEsc.x, pEsc.y, pEsc.z);
                    avatarLocal.rotation.y = 0;
                }
                estadoJugador.posicion.x = pEsc.x;
                estadoJugador.posicion.y = pEsc.y;
                estadoJugador.posicion.z = pEsc.z;
                estadoJugador.rotacion = 0;
            } else {
                const pilotoTemp = crearAvatar3D({
                    id: finisher.id || `podio_${idx}`,
                    apodo: finisher.apodo || 'Campeón',
                    nivel: finisher.nivel || 1,
                    apariencia: finisher.apariencia || {},
                    equipado: finisher.equipado || {}
                });
                pilotoTemp.position.set(pEsc.x, pEsc.y, pEsc.z);
                pilotoTemp.rotation.y = 0;
                this.grupoCeremoniaPodio.add(pilotoTemp);
                this.avataresPodioTemp.push(pilotoTemp);
            }
        });

        if (!localEnTop3) {
            estadoJugador.enVehiculo = false;
            if (avatarLocal) {
                montarAvatarEnKart(avatarLocal, null, false);
                avatarLocal.position.set(4.4, 0.04, POSICION_PODIO.z + 1.8);
                avatarLocal.rotation.y = -0.35;
            }
            estadoJugador.posicion.x = 4.4;
            estadoJugador.posicion.y = 0.04;
            estadoJugador.posicion.z = POSICION_PODIO.z + 1.8;
            estadoJugador.rotacion = -0.35;
        }

        estadoControles.camaraPodio = {
            posX: 0,
            posY: 2.55,
            posZ: POSICION_PODIO.z + 11.2,
            lookX: 0,
            lookY: 1.35,
            lookZ: POSICION_PODIO.z + 2.2
        };

        const primero = top3[0];
        this.estadoCarrera.bannerMensaje = `🏆 ¡CEREMONIA DE PODIO! 1.º ${primero.apodo} (${DURACION_CEREMONIA_PODIO}s)`;
        reproducirSonido('nivel');

        if (emitirRed) {
            enviarEventoExperiencia('iniciar_ceremonia_podio', {
                accion: 'iniciar_ceremonia_podio',
                clasificacion: top3
            });
        }
    }

    /**
     * Actualiza efectos visuales, animaciones, fuegos artificiales y cámara de la ceremonia de podio.
     * @param {number} dtSeg
     */
    _actualizarCeremoniaPodio(dtSeg) {
        this.tiempoCeremoniaPodio = Math.max(0, this.tiempoCeremoniaPodio - dtSeg);
        const progreso = DURACION_CEREMONIA_PODIO - this.tiempoCeremoniaPodio;

        for (const piloto of this.avataresPodioTemp) {
            actualizarAnimacionAvatar(piloto, dtSeg, 'celebrar');
        }

        this.timerFuegos -= dtSeg;
        if (this.timerFuegos <= 0) {
            this.timerFuegos = 1.25;
            this._emitirFuegoArtificialPodio();
        }

        this.timerChampan -= dtSeg;
        if (this.timerChampan <= 0) {
            this.timerChampan = 0.42;
            this._emitirChampagnePodio();
        }

        for (let i = this.particulasCeremonia.length - 1; i >= 0; i--) {
            const p = this.particulasCeremonia[i];
            p.vida -= dtSeg;
            if (p.vida <= 0) {
                liberarObjeto3D(p.puntos);
                this.particulasCeremonia.splice(i, 1);
                continue;
            }
            const attr = p.puntos.geometry.getAttribute('position');
            for (let k = 0; k < p.velocidades.length; k++) {
                const v = p.velocidades[k];
                v.y -= p.gravedad * dtSeg;
                attr.setXYZ(k, attr.getX(k) + v.x * dtSeg, attr.getY(k) + v.y * dtSeg, attr.getZ(k) + v.z * dtSeg);
            }
            attr.needsUpdate = true;
            p.puntos.material.opacity = Math.max(0, (p.vida / p.duracionMax) * 0.95);
        }

        estadoControles.camaraPodio = {
            posX: Math.sin(progreso * 0.45) * 2.4,
            posY: 2.55 + Math.cos(progreso * 0.35) * 0.22,
            posZ: POSICION_PODIO.z + 11.2,
            lookX: 0,
            lookY: 1.35,
            lookZ: POSICION_PODIO.z + 2.2
        };

        const segRestantes = Math.max(1, Math.ceil(this.tiempoCeremoniaPodio));
        const listaPodio = this.clasificacionPodioActiva?.length
            ? this.clasificacionPodioActiva
            : this.clasificacionCarrera;
        const resumenTop = listaPodio
            .slice(0, 3)
            .map((f, idx) => `${idx + 1}.º ${f.apodo}`)
            .join(' · ');
        this.estadoCarrera.bannerMensaje = `🏆 ¡CEREMONIA DE PODIO! ${resumenTop} (${segRestantes}s)`;

        if (this.tiempoCeremoniaPodio === 0) {
            this._finalizarCeremoniaPodio();
        }
    }

    /**
     * Limpia la ceremonia de podio, re-monta el kart y regresa al jugador al Paddock tras 12 segundos.
     */
    _finalizarCeremoniaPodio() {
        for (const p of this.particulasCeremonia) {
            liberarObjeto3D(p.puntos);
        }
        this.particulasCeremonia = [];
        this.avataresPodioTemp = [];

        if (this.grupoCeremoniaPodio) {
            liberarObjeto3D(this.grupoCeremoniaPodio);
            this.grupoCeremoniaPodio = null;
        }

        this.ceremoniaPodioActiva = false;
        this.tiempoCeremoniaPodio = 0;
        this.clasificacionPodioActiva = [];
        estadoControles.modoCeremoniaPodio = false;
        estadoControles.camaraPodio = null;

        this.clasificacionCarrera = [];
        this._reiniciarEstadoCarrera();
        this._reiniciarVisualCheckpoints();
        this.estadoCarrera.cooldownSalida = 2.0;

        const posPaddock = this.obtenerPosicionPaddock(this.estadoCarrera.slotParrilla);
        this.spawnJugador = { ...posPaddock };
        estadoJugador.enVehiculo = true;
        estadoJugador.rotacion = -Math.PI / 2;
        estadoJugador.posicion.x = posPaddock.x;
        estadoJugador.posicion.y = posPaddock.y;
        estadoJugador.posicion.z = posPaddock.z;

        const avatarLocal = this.contextoActual?.avatarLocal;
        if (avatarLocal) {
            montarAvatarEnKart(avatarLocal, estadoJugador.configKart, true);
            avatarLocal.position.set(posPaddock.x, posPaddock.y, posPaddock.z);
            avatarLocal.rotation.y = estadoJugador.rotacion;
        }
        enviarEstadoJugadorInmediato();
        notificarEstado('aviso', {
            mensaje: '🏎️ De vuelta en el Paddock. ¡Avanza a la parrilla para una nueva carrera!'
        });
    }

    /**
     * Emite un estallido temporal de chispas metálicas en el punto de choque entre karts.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    _emitirChispasChoque(x, y, z) {
        const cantidad = 18;
        const posiciones = new Float32Array(cantidad * 3);
        const velocidades = [];

        for (let i = 0; i < cantidad; i++) {
            posiciones[i * 3] = x;
            posiciones[i * 3 + 1] = y + 0.45;
            posiciones[i * 3 + 2] = z;

            const ang = (i / cantidad) * Math.PI * 2 + Math.random() * 0.4;
            const rap = 3.5 + Math.random() * 5.0;
            velocidades.push({
                x: Math.cos(ang) * rap,
                y: 2.5 + Math.random() * 4.5,
                z: Math.sin(ang) * rap
            });
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xfacc15,
            size: 0.24,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const puntos = new THREE.Points(geo, mat);
        puntos.userData = { esClonTemporal: true };
        this.grupoRaiz.add(puntos);

        this.chispasActivas.push({
            puntos,
            velocidades,
            vida: 0.38,
            duracionMax: 0.38
        });
    }

    /**
     * Integra y limpia de GPU las partículas temporales de chispas activas.
     * @param {number} dtSeg
     */
    _actualizarChispas(dtSeg) {
        for (let i = this.chispasActivas.length - 1; i >= 0; i--) {
            const c = this.chispasActivas[i];
            c.vida -= dtSeg;
            if (c.vida <= 0) {
                liberarObjeto3D(c.puntos);
                this.chispasActivas.splice(i, 1);
                continue;
            }

            const attr = c.puntos.geometry.getAttribute('position');
            for (let p = 0; p < c.velocidades.length; p++) {
                const v = c.velocidades[p];
                v.y -= 14 * dtSeg;
                attr.setXYZ(
                    p,
                    attr.getX(p) + v.x * dtSeg,
                    attr.getY(p) + v.y * dtSeg,
                    attr.getZ(p) + v.z * dtSeg
                );
            }
            attr.needsUpdate = true;
            c.puntos.material.opacity = Math.max(0, (c.vida / c.duracionMax) * 0.95);
        }
    }

    /**
     * Resuelve colisiones esféricas kart-a-kart contra jugadores remotos ponderadas por `pesoImpacto`.
     */
    _resolverColisionesKarts() {
        const ec = this.estadoCarrera;
        const pos = estadoJugador.posicion;
        const radioColision = 1.65;
        const pesoLocal = this.obtenerPesoImpactoKart(estadoJugador.configKart);

        for (const remoto of estadoRed.jugadoresRemotos.values()) {
            if (!remoto || !remoto.enVehiculo || remoto.experienciaActiva !== 'karts' || !remoto.avatar) {
                continue;
            }

            const rx = remoto.avatar.position.x;
            const ry = remoto.avatar.position.y;
            const rz = remoto.avatar.position.z;
            if (Math.abs(pos.y - ry) >= 1.5) continue;

            const dx = pos.x - rx;
            const dz = pos.z - rz;
            const dist = Math.hypot(dx, dz);
            if (dist >= radioColision) continue;

            let nx = 1;
            let nz = 0;
            if (dist > 0.001) {
                nx = dx / dist;
                nz = dz / dist;
            } else {
                const angDesempate = estadoJugador.rotacion + Math.PI / 2;
                nx = Math.sin(angDesempate);
                nz = Math.cos(angDesempate);
            }

            const pesoRemoto = this.obtenerPesoImpactoKart(remoto.configKart);
            const factorMasa = pesoRemoto / Math.max(0.1, pesoLocal + pesoRemoto);
            const penetracion = radioColision - dist;
            const desplazamiento = penetracion * Math.max(0.35, factorMasa);

            pos.x = Math.max(-MITAD_PISTA_KARTS + 2, Math.min(MITAD_PISTA_KARTS - 2, pos.x + nx * desplazamiento));
            pos.z = Math.max(-MITAD_PISTA_KARTS + 2, Math.min(MITAD_PISTA_KARTS - 2, pos.z + nz * desplazamiento));

            const fx = Math.sin(estadoJugador.rotacion);
            const fz = Math.cos(estadoJugador.rotacion);
            const proyFrontal = nx * fx + nz * fz;
            const fuerzaChoque = Math.max(4.5, Math.abs(ec.velocidad) * 0.6) * (pesoRemoto / Math.max(0.1, pesoLocal));

            ec.velocidad += proyFrontal * fuerzaChoque * 0.65;
            this.impulsoLateral.x += nx * fuerzaChoque * 0.55;
            this.impulsoLateral.z += nz * fuerzaChoque * 0.55;

            if (this.cooldownAudioChoque <= 0) {
                this.cooldownAudioChoque = 0.25;
                const intensidad = Math.min(1.35, 0.5 + Math.abs(ec.velocidad) / 26);
                reproducirSonido('choque_kart', intensidad);
                this._emitirChispasChoque((pos.x + rx) * 0.5, (pos.y + ry) * 0.5, (pos.z + rz) * 0.5);
            }
        }
    }

    /**
     * Procesa eventos multijugador recibidos vía `evento_experiencia`.
     */
    alEventoRed(evento) {
        const datos = evento?.datos || {};
        const accion = evento?.accion || datos.accion || evento?.subtipo;

        if (accion === 'iniciar_conteo_carrera') {
            this._iniciarConteoSalida(false);
        } else if (accion === 'iniciar_ceremonia_podio' && Array.isArray(datos.clasificacion)) {
            this.iniciarCeremoniaPodio(datos.clasificacion, false);
        } else if (
            (accion === 'carrera_finalizada' || accion === 'vuelta_completada') &&
            datos.apodo &&
            typeof datos.tiempo === 'number'
        ) {
            this._registrarTiempoRanking(datos.apodo, datos.tiempo);
            const remoto = evento?.origenId ? estadoRed.jugadoresRemotos.get(evento.origenId) : null;
            this._registrarFinalistaCarrera({
                id: datos.id || evento?.origenId || datos.apodo,
                apodo: datos.apodo,
                nivel: datos.nivel || remoto?.nivel || 1,
                tiempo: datos.tiempo,
                configKart: datos.configKart || remoto?.configKart || {},
                apariencia: datos.apariencia || remoto?.apariencia || {},
                equipado: datos.equipado || remoto?.equipado || {}
            });
            notificarEstado('aviso', {
                mensaje: `🏆 ${datos.apodo} finalizó (2 vueltas) en ${datos.tiempo.toFixed(2)}s`
            });
        }
    }

    /**
     * Bucle principal de física arcade de karts, parrilla iluminada de 10s, obstáculos y podio de campeones.
     */
    actualizar(dt, contextoSandbox) {
        const dtSeg = Math.min(dt, 0.05);
        this.tiempoTotal += dtSeg;

        if (this.cupulaCielo) {
            this.cupulaCielo.rotation.y += dtSeg * 0.004;
        }

        if (this.ceremoniaPodioActiva) {
            this._actualizarCeremoniaPodio(dtSeg);
            return;
        }

        if (
            this.clasificacionCarrera.length > 0 &&
            this.clasificacionCarrera.length >= this.obtenerMetaFinalistas()
        ) {
            this.iniciarCeremoniaPodio(this.clasificacionCarrera.slice(0, 3), true);
            return;
        }

        const ec = this.estadoCarrera;
        const pos = estadoJugador.posicion;
        if (ec.cooldownSalida > 0) ec.cooldownSalida = Math.max(0, ec.cooldownSalida - dtSeg);
        if (ec.tiempoTurbo > 0) ec.tiempoTurbo = Math.max(0, ec.tiempoTurbo - dtSeg);
        if (this.tiempoLuzVerde > 0) this.tiempoLuzVerde = Math.max(0, this.tiempoLuzVerde - dtSeg);
        if (this.cooldownAudioChoque > 0) this.cooldownAudioChoque = Math.max(0, this.cooldownAudioChoque - dtSeg);
        if (this.tiempoBannerTemporal > 0) {
            this.tiempoBannerTemporal = Math.max(0, this.tiempoBannerTemporal - dtSeg);
            if (this.tiempoBannerTemporal === 0) this.bannerTemporal = '';
        }
        this._actualizarChispas(dtSeg);

        // Pulso visual del pad y bordes de Zona de Salida
        const pulso = 0.5 + 0.5 * Math.sin(this.tiempoTotal * 3.8);
        if (this.mallaZonaSalida?.material) {
            this.mallaZonaSalida.material.opacity = ec.cuentaRegresiva > 0 ? 0.34 + pulso * 0.14 : 0.18 + pulso * 0.14;
        }
        for (const matBorde of this.bordesZonaSalida) {
            matBorde.emissiveIntensity = 0.55 + pulso * 0.7;
        }

        // 1. Verificar Zona de Salida (x: 1.5..13.5, z cerca de 54)
        const dentroZonaSalida =
            pos.x >= 1.4 &&
            pos.x <= 13.6 &&
            Math.abs(pos.z - CENTRO_SALIDA_Z) <= ANCHO_PISTA * 0.52 &&
            pos.y < 1.5;
        ec.enZonaSalida = dentroZonaSalida;
        if (dentroZonaSalida && ec.cuentaRegresiva <= 0 && ec.cooldownSalida <= 0 && !ec.carreraActiva) {
            this._iniciarConteoSalida(true);
        }

        // 2. Conteo regresivo de 10 segundos en parrilla con beeps en los últimos 5 segundos
        if (ec.cuentaRegresiva > 0) {
            const anteriorSeg = Math.ceil(ec.cuentaRegresiva);
            ec.cuentaRegresiva = Math.max(0, ec.cuentaRegresiva - dtSeg);
            const nuevoSeg = Math.ceil(ec.cuentaRegresiva);
            if (nuevoSeg !== anteriorSeg && nuevoSeg > 0 && nuevoSeg <= 5) {
                reproducirSonido('beep_salida');
            }

            if (dentroZonaSalida) {
                ec.slotParrilla = this._obtenerSlotParrillaActual();
                const posSlot = this.obtenerPosicionSlotParrilla(ec.slotParrilla);
                pos.x += (posSlot.x - pos.x) * Math.min(1, dtSeg * 6);
                pos.z += (posSlot.z - pos.z) * Math.min(1, dtSeg * 6);
                pos.y = posSlot.y;
                estadoJugador.rotacion = -Math.PI / 2;
                ec.velocidad = 0;
            }

            ec.bannerMensaje = `🏁 SALIDA EN ${Math.max(1, nuevoSeg)}s · ${VUELTAS_CARRERA_KARTS} VUELTAS`;
            this._actualizarVisualSemaforo(ec.cuentaRegresiva, 0);

            if (ec.cuentaRegresiva === 0) {
                ec.carreraActiva = true;
                ec.vueltaActual = 1;
                ec.tiempoVuelta = 0;
                ec.cooldownSalida = 6.0;
                ec.tiempoTurbo = 1.15;
                ec.velocidad = 14;
                this.tiempoLuzVerde = 2.2;
                this.bannerTemporal = `¡YA! VUELTA 1/${VUELTAS_CARRERA_KARTS}`;
                this.tiempoBannerTemporal = 2.0;
                reproducirSonido('salida_go');
                this._actualizarVisualSemaforo(0, this.tiempoLuzVerde);
            }
        } else {
            this._actualizarVisualSemaforo(0, this.tiempoLuzVerde);
            ec.bannerMensaje = this.bannerTemporal;
        }

        // 3. Lectura de controles de conducción (teclado + móvil)
        const teclas = estadoControles.teclas;
        const bloquearPorConteo = ec.cuentaRegresiva > 0 && dentroZonaSalida;

        let acelerar = 0;
        if (!bloquearPorConteo && !estadoControles.modoPreviewAvatar) {
            if (teclas.has('KeyW') || teclas.has('ArrowUp') || estadoControles.acelerarKart) acelerar += 1;
            if (teclas.has('KeyS') || teclas.has('ArrowDown') || estadoControles.frenarKart) acelerar -= 1;
            if (estadoControles.joystick.activo && Math.abs(estadoControles.joystick.y) > 0.2) {
                acelerar += estadoControles.joystick.y;
            }
        }
        acelerar = Math.max(-1, Math.min(1, acelerar));

        let giro = 0;
        if (!estadoControles.modoPreviewAvatar) {
            if (teclas.has('KeyA') || teclas.has('ArrowLeft')) giro += 1;
            if (teclas.has('KeyD') || teclas.has('ArrowRight')) giro -= 1;
            if (estadoControles.joystick.activo) {
                giro -= estadoControles.joystick.x;
            }
        }
        giro = Math.max(-1, Math.min(1, giro));
        ec.anguloVolante = giro;

        const quiereDerrapar =
            teclas.has('ShiftLeft') ||
            teclas.has('ShiftRight') ||
            teclas.has('Space') ||
            estadoControles.derraparKart;

        // 4. Estadísticas reales del kart y cálculo de superficie de pista
        const stats = this.obtenerStatsKart();
        const { seg, distCentro } = this._consultarPista(pos.x, pos.y, pos.z);
        ec.enPista = distCentro <= ANCHO_PISTA * 0.56;

        let velMax = 18 + stats.velocidad * 0.25;
        const acelBase = 12 + stats.aceleracion * 0.22;
        const tasaGiro = 1.65 + stats.control * 0.025;

        // Modificadores de pendiente (+20% bajando, -20% subiendo) y fuera de pista (-30%)
        if (ec.enPista && seg) {
            const dotHeading = Math.sin(estadoJugador.rotacion) * seg.tx + Math.cos(estadoJugador.rotacion) * seg.tz;
            const pendienteReal = seg.pendiente * Math.sign(dotHeading || 1);
            if (pendienteReal > 0.03) {
                velMax *= 0.8;
            } else if (pendienteReal < -0.03) {
                velMax *= 1.2;
            }
        } else {
            velMax *= 0.7;
        }

        if (ec.tiempoTurbo > 0) {
            velMax *= 1.35;
        }

        // Aceleración / frenado / fricción
        if (acelerar > 0) {
            ec.velocidad += acelBase * acelerar * dtSeg;
        } else if (acelerar < 0) {
            ec.velocidad += acelBase * 1.25 * acelerar * dtSeg;
        } else {
            ec.velocidad *= Math.max(0, 1 - dtSeg * 2.2);
        }

        ec.velocidad = Math.max(-velMax * 0.45, Math.min(velMax, ec.velocidad));

        // Derrape y carga Mini-Turbo
        if (quiereDerrapar && Math.abs(ec.velocidad) > 6 && Math.abs(giro) > 0.15) {
            ec.derrapando = true;
            ec.cargaDrift += dtSeg;
        } else {
            if (ec.derrapando && ec.cargaDrift >= 0.85) {
                ec.tiempoTurbo = Math.max(ec.tiempoTurbo, 1.05);
                reproducirSonido('salto');
            }
            ec.derrapando = false;
            ec.cargaDrift = 0;
        }

        const factorDireccion = ec.velocidad >= -0.2 ? 1 : -1;
        const multDrift = ec.derrapando ? 1.38 : 1.0;
        if (Math.abs(ec.velocidad) > 0.35) {
            estadoJugador.rotacion += giro * tasaGiro * multDrift * factorDireccion * dtSeg;
        }

        // Integración de posición en estadio 160x160 m + impulso lateral y colisiones kart-a-kart
        const vx = Math.sin(estadoJugador.rotacion) * ec.velocidad + this.impulsoLateral.x;
        const vz = Math.cos(estadoJugador.rotacion) * ec.velocidad + this.impulsoLateral.z;
        pos.x = Math.max(-MITAD_PISTA_KARTS + 2, Math.min(MITAD_PISTA_KARTS - 2, pos.x + vx * dtSeg));
        pos.z = Math.max(-MITAD_PISTA_KARTS + 2, Math.min(MITAD_PISTA_KARTS - 2, pos.z + vz * dtSeg));
        const amortImpulso = Math.max(0, 1 - dtSeg * 7);
        this.impulsoLateral.x *= amortImpulso;
        this.impulsoLateral.z *= amortImpulso;

        this._resolverColisionesKarts();

        const sueloObjetivo = ec.enPista && seg ? seg.y + 0.04 : 0;
        if (pos.y > sueloObjetivo + 0.08 || ec.velY > 0) {
            ec.velY -= 22 * dtSeg;
            pos.y += ec.velY * dtSeg;
            if (pos.y <= sueloObjetivo) {
                pos.y = sueloObjetivo;
                ec.velY = 0;
                ec.enAire = false;
            }
        } else {
            pos.y += (sueloObjetivo - pos.y) * Math.min(1, dtSeg * 16);
        }

        ec.velocidadKmH = Math.round(Math.abs(ec.velocidad) * 4.2);

        // Actualizar avatar + kart 3D
        const avatar = contextoSandbox?.avatarLocal;
        if (avatar) {
            avatar.position.set(pos.x, pos.y, pos.z);
            avatar.rotation.y = estadoJugador.rotacion;
            avatar.userData.anguloVolante = giro;
            avatar.userData.velocidadKart = ec.velocidad;
            avatar.userData.turboActivoKart = ec.tiempoTurbo > 0 || ec.derrapando;
        }

        // FOV dinámico durante Boost Pads / Mini-Turbo
        if (contextoSandbox?.camara && !estadoControles.modoPreviewAvatar) {
            const fovObjetivo = ec.tiempoTurbo > 0 ? 74 : 60 + (ec.velocidadKmH / 125) * 6;
            contextoSandbox.camara.fov += (fovObjetivo - contextoSandbox.camara.fov) * Math.min(1, dtSeg * 8);
            contextoSandbox.camara.updateProjectionMatrix();
        }

        // 5. Turbo Pads direccionales (6)
        for (const pad of this.boostPads) {
            if (pad.cooldown > 0) pad.cooldown = Math.max(0, pad.cooldown - dtSeg);
            if (
                pad.cooldown === 0 &&
                Math.hypot(pos.x - pad.posicion.x, pos.z - pad.posicion.z) < 2.9 &&
                Math.abs(pos.y - pad.posicion.y) < 1.8
            ) {
                pad.cooldown = 1.5;
                ec.tiempoTurbo = 1.5;
                ec.velocidad = Math.max(ec.velocidad, velMax * 1.15);
                reproducirSonido('portal');
            }
        }

        // 6. Barreras móviles (6)
        for (const bar of this.barrerasMoviles) {
            const desplazamiento = Math.sin(this.tiempoTotal * 2.1 + bar.fase) * (ANCHO_PISTA * 0.34);
            bar.mesh.position.set(
                bar.seg.x + bar.seg.rx * desplazamiento,
                bar.seg.y + 0.52,
                bar.seg.z + bar.seg.rz * desplazamiento
            );
            bar.mesh.rotation.y = bar.seg.rotY;

            if (
                Math.hypot(pos.x - bar.mesh.position.x, pos.z - bar.mesh.position.z) < 1.5 &&
                Math.abs(pos.y - bar.seg.y) < 1.5
            ) {
                ec.velocidad *= -0.45;
                pos.x += (pos.x - bar.mesh.position.x) * 0.45;
                pos.z += (pos.z - bar.mesh.position.z) * 0.45;
                reproducirSonido('interaccion');
            }
        }

        // 7. Obstáculos derribables personalizados (14)
        for (const obs of this.obstaculosDerribables) {
            if (obs.derribado) {
                obs.respawn -= dtSeg;
                obs.vel.y -= 18 * dtSeg;
                obs.mesh.position.x += obs.vel.x * dtSeg;
                obs.mesh.position.y += obs.vel.y * dtSeg;
                obs.mesh.position.z += obs.vel.z * dtSeg;
                obs.mesh.rotation.x += dtSeg * 6;
                obs.mesh.rotation.z += dtSeg * 4;
                if (obs.respawn <= 0) {
                    obs.derribado = false;
                    obs.mesh.position.set(obs.posBase.x, obs.posBase.y, obs.posBase.z);
                    obs.mesh.rotation.set(0, obs.rotBaseY, 0);
                }
                continue;
            }

            if (
                Math.hypot(pos.x - obs.posBase.x, pos.z - obs.posBase.z) < 1.35 &&
                Math.abs(pos.y - obs.posBase.y) < 1.5
            ) {
                obs.derribado = true;
                obs.respawn = 8.0;
                obs.vel = {
                    x: Math.sin(estadoJugador.rotacion) * 10 + (Math.random() - 0.5) * 4,
                    y: 8.0,
                    z: Math.cos(estadoJugador.rotacion) * 10 + (Math.random() - 0.5) * 4
                };
                ec.velocidad *= 0.88;
                reproducirSonido('paso');
            }
        }

        // 8. Checkpoints estrictos (1..5) + Formato de Carrera a 2 Vueltas
        if (!ec.carreraActiva && ec.cuentaRegresiva <= 0 && ec.cooldownSalida <= 0 && ec.checkpointActual === 0) {
            if (Math.abs(pos.x) < 1.4 && Math.abs(pos.z - CENTRO_SALIDA_Z) < 4.5 && Math.abs(ec.velocidad) > 1) {
                ec.carreraActiva = true;
                ec.vueltaActual = 1;
                ec.tiempoVuelta = 0;
                this.clasificacionCarrera = [];
            }
        }

        if (ec.carreraActiva) {
            ec.tiempoVuelta += dtSeg;

            if (ec.checkpointActual < this.checkpoints.length) {
                const cp = this.checkpoints[ec.checkpointActual];
                if (
                    Math.hypot(pos.x - cp.posicion.x, pos.z - cp.posicion.z) <= ANCHO_PISTA * 0.65 &&
                    Math.abs(pos.y - cp.posicion.y) <= 2.4
                ) {
                    cp.superado = true;
                    for (const mat of cp.materiales) {
                        mat.color.setHex(0x22c55e);
                        mat.emissive.setHex(0x22c55e);
                    }
                    ec.checkpointActual += 1;
                    reproducirSonido('interaccion');
                }
            } else if (
                Math.abs(pos.x) <= 2.8 &&
                Math.abs(pos.z - CENTRO_SALIDA_Z) <= ANCHO_PISTA * 0.56 &&
                pos.y < 1.5
            ) {
                if (ec.vueltaActual < ec.totalVueltas) {
                    // Avanzar a Vuelta 2/2 tras completar los 5 checkpoints de la Vuelta 1
                    ec.vueltaActual += 1;
                    ec.checkpointActual = 0;
                    this._reiniciarVisualCheckpoints();
                    this.bannerTemporal = `¡VUELTA FINAL ${ec.vueltaActual}/${ec.totalVueltas}!`;
                    this.tiempoBannerTemporal = 2.6;
                    reproducirSonido('moneda');
                    notificarEstado('aviso', {
                        mensaje: `🔥 ¡Vuelta 1 completada! Inicia la Vuelta Final (${ec.vueltaActual}/${ec.totalVueltas})`
                    });
                } else {
                    // Fin de Carrera tras completar las 2 vueltas
                    const tiempoFinal = Number(ec.tiempoVuelta.toFixed(2));
                    ec.ultimaVuelta = tiempoFinal;
                    ec.carreraActiva = false;
                    ec.vueltaActual = 1;
                    ec.checkpointActual = 0;
                    ec.cooldownSalida = 6.0;
                    this._reiniciarVisualCheckpoints();

                    const esRecord =
                        estadoJugador.mejorVueltaKart === null || tiempoFinal < estadoJugador.mejorVueltaKart;
                    if (esRecord) {
                        estadoJugador.mejorVueltaKart = tiempoFinal;
                        guardarEstadoLocal();
                    }

                    const metaFinalistas = this.obtenerMetaFinalistas();
                    const finalistaLocal = {
                        id: estadoJugador.id,
                        apodo: estadoJugador.apodo,
                        nivel: estadoJugador.nivel,
                        tiempo: tiempoFinal,
                        configKart: { ...estadoJugador.configKart },
                        apariencia: { ...estadoJugador.apariencia },
                        equipado: { ...estadoJugador.equipado }
                    };

                    this._registrarTiempoRanking(estadoJugador.apodo, tiempoFinal);
                    this.otorgarRecompensa(esRecord ? 50 : 30, esRecord ? 80 : 45);

                    enviarEventoExperiencia('carrera_finalizada', {
                        accion: 'carrera_finalizada',
                        ...finalistaLocal,
                        vueltas: ec.totalVueltas
                    });

                    this._registrarFinalistaCarrera(finalistaLocal);

                    if (!this.ceremoniaPodioActiva) {
                        this.bannerTemporal = `🏁 ¡META (${tiempoFinal.toFixed(2)}s)! Esperando finalistas (${this.clasificacionCarrera.length}/${metaFinalistas})...`;
                        this.tiempoBannerTemporal = 4.0;
                    }

                    notificarEstado('aviso', {
                        mensaje: esRecord
                            ? `🏆 ¡Nuevo récord (2 vueltas): ${tiempoFinal.toFixed(2)}s! (+50 🪙, +80 XP)`
                            : `🏁 Carrera finalizada en ${tiempoFinal.toFixed(2)}s (+30 🪙, +45 XP)`
                    });
                }
            }
        }
    }

    /**
     * Desmonta la experiencia, restaura al avatar LEGO a pie y libera memoria GPU.
     */
    desmontar(escena) {
        estadoJugador.enVehiculo = false;
        estadoControles.garajeKartAbierto = false;
        estadoControles.modoCeremoniaPodio = false;
        estadoControles.camaraPodio = null;
        this.ceremoniaPodioActiva = false;
        if (this.contextoActual?.avatarLocal) {
            montarAvatarEnKart(this.contextoActual.avatarLocal, null, false);
        }
        if (this.contextoActual?.camara) {
            this.contextoActual.camara.fov = 60;
            this.contextoActual.camara.updateProjectionMatrix();
        }
        enviarEstadoJugadorInmediato();

        liberarObjeto3D(this.grupoRaiz);
        this.grupoCeremoniaPodio = null;
        this.avataresPodioTemp = [];
        this.particulasCeremonia = [];
        this.clasificacionCarrera = [];
        this.chispasActivas = [];
        this.puntosPista = [];
        this.boostPads = [];
        this.barrerasMoviles = [];
        this.obstaculosDerribables = [];
        this.checkpoints = [];
        this.lucesSemaforo = [];
        this.bordesZonaSalida = [];
        this.mallaZonaSalida = null;
        this.cupulaCielo = null;
        this.curvaPista = null;
        super.desmontar(escena);
    }
}
