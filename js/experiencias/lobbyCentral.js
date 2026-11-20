/**
 * Experiencia inicial heredada de `ExperienciaBase`: Lobby Central del Sandbox.
 * Isla soleada estilizada (inspiración Fortnite) con pradera PBR, anfiteatro de piedra,
 * árboles low-poly, rocas suaves, partículas flotantes, parkour, monedas y portales 3D.
 */
import { DIMENSION_LOBBY, GRAVEDAD_BASE, MITAD_LOBBY } from '../constantes.js';
import { notificarEstado } from '../estado.js';
import {
    crearCupulaCielo,
    liberarObjeto3D,
    obtenerMapasPBRPlaza,
    obtenerTexturaCespedPlaza,
    obtenerTexturaPlataforma,
    reproducirSonido
} from '../recursos.js';
import { ExperienciaBase, RegistroExperiencias } from '../nucleoSandbox.js';
import { enviarEventoExperiencia } from '../red.js';

export class LobbyCentral extends ExperienciaBase {
    constructor() {
        super({
            id: 'lobby',
            nombre: 'Lobby Central',
            descripcion: 'Isla soleada con anfiteatro de piedra, parkour, monedas y portales.',
            colorPortal: 0x38bdf8,
            posicionPortal: { x: 0, y: 0, z: 0 },
            minJugadores: 1,
            spawnJugador: { x: 0, y: 0.5, z: 16 }
        });

        this.monedas = [];
        this.cristalCentral = null;
        this.orbeTotem = null;
        this.particulasAmbiente = null;
        this.cupulaCielo = null;
        this.tiempoTotal = 0;
        this.totemReclamado = false;
        this.cofreReclamado = false;
        this.portalesVisitados = new Set();
    }

    /**
     * Construye el entorno estilizado del Lobby Central y registra colisionadores.
     * @param {THREE.Scene} escena
     * @param {object} contextoSandbox
     */
    montar(escena, contextoSandbox) {
        super.montar(escena, contextoSandbox);
        this.monedas = [];
        this.tiempoTotal = 0;
        this.configFisica = {
            gravedad: GRAVEDAD_BASE,
            multiplicadorVelocidad: 1,
            multiplicadorSalto: 1
        };

        this._construirPlaza(DIMENSION_LOBBY, MITAD_LOBBY);
        this._construirMonumentoCentral();
        this._construirVegetacionYRocas();
        this._construirFarolas();
        this._construirCircuitoParkour();
        this._construirMonedas();
        this._construirEntidadesInteractivas();
        this._construirPortalesExperiencias(contextoSandbox);
        this._construirParticulasAmbiente();

        this.cupulaCielo = crearCupulaCielo('lobby_dia');
        this.grupoRaiz.add(this.cupulaCielo);
        if (escena) {
            escena.background = new THREE.Color(0x68b5e8);
            escena.fog = new THREE.FogExp2(0x7ec8f2, 0.0045);
        }
    }

    /**
     * Construye la pradera de césped estilizado 80x80 m, el anfiteatro de piedra y senderos.
     */
    _construirPlaza(dimension, mitad) {
        const cespedPBR = obtenerTexturaCespedPlaza();
        const sueloMat = new THREE.MeshStandardMaterial({
            map: cespedPBR.map,
            bumpMap: cespedPBR.bumpMap,
            bumpScale: 0.04,
            roughnessMap: cespedPBR.roughnessMap,
            roughness: 0.88,
            metalness: 0.02
        });
        const suelo = new THREE.Mesh(new THREE.PlaneGeometry(dimension, dimension), sueloMat);
        suelo.rotation.x = -Math.PI / 2;
        suelo.receiveShadow = true;
        this.grupoRaiz.add(suelo);

        // Colisionador sólido de piso
        this.registrarColisionadorCaja(-mitad, -2, -mitad, mitad, 0, mitad, 'suelo_plaza');

        // Anfiteatro central circular de piedra cálida
        const piedraPBR = obtenerMapasPBRPlaza(6);
        const matAnfiteatro = new THREE.MeshStandardMaterial({
            map: piedraPBR.map,
            bumpMap: piedraPBR.bumpMap,
            bumpScale: 0.035,
            roughnessMap: piedraPBR.roughnessMap,
            roughness: 0.72,
            metalness: 0.06
        });
        const anfiteatro = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 17.2, 0.16, 40), matAnfiteatro);
        anfiteatro.position.y = 0.02;
        anfiteatro.receiveShadow = true;
        this.grupoRaiz.add(anfiteatro);

        // Anillo biselado dorado alrededor del anfiteatro
        const aroAnfiteatro = new THREE.Mesh(
            new THREE.TorusGeometry(16.8, 0.22, 8, 48),
            new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.25 })
        );
        aroAnfiteatro.rotation.x = Math.PI / 2;
        aroAnfiteatro.position.y = 0.06;
        aroAnfiteatro.receiveShadow = true;
        this.grupoRaiz.add(aroAnfiteatro);

        // Senderos radiales de piedra hacia los 3 portales
        const piedraCamino = obtenerMapasPBRPlaza(2);
        const matCamino = new THREE.MeshStandardMaterial({
            map: piedraCamino.map,
            bumpMap: piedraCamino.bumpMap,
            bumpScale: 0.03,
            roughness: 0.75
        });
        const caminos = [
            { x: -9.5, z: -14, rotY: 0.56, len: 18 },
            { x: 0, z: -16, rotY: 0, len: 18 },
            { x: 9.5, z: -14, rotY: -0.56, len: 18 }
        ];
        for (const c of caminos) {
            const losa = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, c.len), matCamino.clone());
            losa.position.set(c.x, 0.04, c.z);
            losa.rotation.y = c.rotY;
            losa.receiveShadow = true;
            this.grupoRaiz.add(losa);
        }

        // Borde arquitectónico perimetral de piedra clara
        const matBorde = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.6,
            metalness: 0.1
        });
        const bordes = [
            { x: 0, z: -mitad + 0.5, w: dimension, d: 1 },
            { x: 0, z: mitad - 0.5, w: dimension, d: 1 },
            { x: -mitad + 0.5, z: 0, w: 1, d: dimension },
            { x: mitad - 0.5, z: 0, w: 1, d: dimension }
        ];
        for (const b of bordes) {
            const muro = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.85, b.d), matBorde.clone());
            muro.position.set(b.x, 0.425, b.z);
            muro.receiveShadow = true;
            muro.castShadow = true;
            this.grupoRaiz.add(muro);
        }
    }

    /**
     * Construye la fuente monumental central con agua cristalina y cristal flotante.
     */
    _construirMonumentoCentral() {
        const piedraPBR = obtenerMapasPBRPlaza(2);
        const matPiedra = new THREE.MeshStandardMaterial({
            map: piedraPBR.map,
            bumpMap: piedraPBR.bumpMap,
            bumpScale: 0.04,
            roughness: 0.6
        });

        const base1 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.7, 7.2), matPiedra);
        base1.position.set(0, 0.35, 0);
        base1.receiveShadow = true;
        base1.castShadow = true;
        this.grupoRaiz.add(base1);
        this.registrarColisionadorCaja(-3.6, 0, -3.6, 3.6, 0.7, 3.6, 'monumento_base');

        // Espejo de agua brillante alrededor del pedestal
        const agua = new THREE.Mesh(
            new THREE.CylinderGeometry(2.9, 2.9, 0.14, 24),
            new THREE.MeshStandardMaterial({
                color: 0x0ea5e9,
                roughness: 0.08,
                metalness: 0.45,
                transparent: true,
                opacity: 0.84
            })
        );
        agua.position.set(0, 0.72, 0);
        this.grupoRaiz.add(agua);

        const base2 = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.9, 3.8), matPiedra.clone());
        base2.position.set(0, 1.15, 0);
        base2.receiveShadow = true;
        base2.castShadow = true;
        this.grupoRaiz.add(base2);
        this.registrarColisionadorCaja(-1.9, 0.7, -1.9, 1.9, 1.6, 1.9, 'monumento_pedestal');

        const cristalGeo = new THREE.OctahedronGeometry(1.05, 0);
        const cristalMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.95,
            metalness: 0.35,
            roughness: 0.12
        });
        this.cristalCentral = new THREE.Mesh(cristalGeo, cristalMat);
        this.cristalCentral.position.set(0, 3.5, 0);
        this.cristalCentral.castShadow = true;
        this.grupoRaiz.add(this.cristalCentral);

        const luzMonumento = new THREE.PointLight(0x38bdf8, 1.35, 22);
        luzMonumento.position.set(0, 4.5, 0);
        this.grupoRaiz.add(luzMonumento);
    }

    /**
     * Construye árboles estilizados low-poly y rocas suaves alrededor de la isla.
     */
    _construirVegetacionYRocas() {
        const arboles = [
            { x: -28, z: -14, s: 1.1 },
            { x: -28, z: 5, s: 0.95 },
            { x: -25, z: 24, s: 1.15 },
            { x: -12, z: 28, s: 1.0 },
            { x: 12, z: 28, s: 1.05 },
            { x: 26, z: 24, s: 1.15 },
            { x: 31, z: -22, s: 1.1 },
            { x: -28, z: -28, s: 1.2 }
        ];

        const matTronco = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
        const tonosFollaje = [0x22c55e, 0x16a34a, 0x4ade80];

        arboles.forEach((a, idx) => {
            const grupoArbol = new THREE.Group();
            grupoArbol.position.set(a.x, 0, a.z);
            grupoArbol.scale.setScalar(a.s);

            const tronco = new THREE.Mesh(
                new THREE.CylinderGeometry(0.28, 0.46, 2.7, 8),
                matTronco.clone()
            );
            tronco.position.y = 1.35;
            tronco.castShadow = true;
            tronco.receiveShadow = true;
            grupoArbol.add(tronco);

            const copa1 = new THREE.Mesh(
                new THREE.IcosahedronGeometry(1.55, 1),
                new THREE.MeshStandardMaterial({ color: tonosFollaje[idx % 3], roughness: 0.72 })
            );
            copa1.position.set(0, 3.3, 0);
            copa1.castShadow = true;
            grupoArbol.add(copa1);

            const copa2 = new THREE.Mesh(
                new THREE.IcosahedronGeometry(1.15, 1),
                new THREE.MeshStandardMaterial({ color: tonosFollaje[(idx + 1) % 3], roughness: 0.7 })
            );
            copa2.position.set(0.65, 4.1, 0.35);
            copa2.castShadow = true;
            grupoArbol.add(copa2);

            const copa3 = new THREE.Mesh(
                new THREE.IcosahedronGeometry(1.05, 1),
                new THREE.MeshStandardMaterial({ color: tonosFollaje[(idx + 2) % 3], roughness: 0.7 })
            );
            copa3.position.set(-0.6, 3.9, -0.3);
            copa3.castShadow = true;
            grupoArbol.add(copa3);

            this.grupoRaiz.add(grupoArbol);
            const r = 0.48 * a.s;
            this.registrarColisionadorCaja(a.x - r, 0, a.z - r, a.x + r, 2.7 * a.s, a.z + r, `arbol_${idx}`);
        });

        // Rocas decorativas suaves
        const rocas = [
            { x: -24, z: -11, r: 0.9 },
            { x: -22, z: 18, r: 1.1 },
            { x: 22, z: 20, r: 0.95 },
            { x: 30, z: 4, r: 1.05 },
            { x: -33, z: 14, r: 1.2 },
            { x: 27, z: -26, r: 1.0 },
            { x: -18, z: 31, r: 0.85 },
            { x: 6, z: 32, r: 0.9 }
        ];
        const matRoca = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.82, metalness: 0.05 });

        rocas.forEach((roca, idx) => {
            const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(roca.r, 0), matRoca.clone());
            mesh.position.set(roca.x, roca.r * 0.55, roca.z);
            mesh.scale.set(1.2, 0.75, 1.0);
            mesh.rotation.y = idx * 0.9;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.grupoRaiz.add(mesh);
        });
    }

    /**
     * Añade cuatro farolas cálidas alrededor del anfiteatro central.
     */
    _construirFarolas() {
        const posiciones = [
            { x: -13, z: -13 },
            { x: 13, z: -13 },
            { x: -13, z: 13 },
            { x: 13, z: 13 }
        ];
        const matPoste = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.35 });
        const matFoco = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfbbf24,
            emissiveIntensity: 1.1
        });

        for (const p of posiciones) {
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.5, 8), matPoste.clone());
            base.position.set(p.x, 0.25, p.z);
            base.castShadow = true;
            this.grupoRaiz.add(base);

            const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.9, 8), matPoste.clone());
            poste.position.set(p.x, 2.7, p.z);
            poste.castShadow = true;
            this.grupoRaiz.add(poste);
            this.registrarColisionadorCaja(p.x - 0.35, 0, p.z - 0.35, p.x + 0.35, 5.2, p.z + 0.35, 'farola');

            const foco = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), matFoco.clone());
            foco.position.set(p.x, 5.4, p.z);
            this.grupoRaiz.add(foco);
        }
    }

    /**
     * Construye un circuito parkour de 7 plataformas elevadas con biselado luminoso.
     */
    _construirCircuitoParkour() {
        const plataformas = [
            { x: 9, y: 1.1, z: 6, w: 3.4, h: 0.6, d: 3.4, color: 0x22d3ee },
            { x: 13.5, y: 2.2, z: 4, w: 3.2, h: 0.6, d: 3.2, color: 0x38bdf8 },
            { x: 17.5, y: 3.3, z: 1, w: 3.0, h: 0.6, d: 3.0, color: 0x818cf8 },
            { x: 20, y: 4.4, z: -3.5, w: 3.0, h: 0.6, d: 3.0, color: 0xa855f7 },
            { x: 18, y: 5.5, z: -8.5, w: 3.2, h: 0.6, d: 3.2, color: 0xec4899 },
            { x: 22, y: 6.6, z: -13, w: 3.2, h: 0.6, d: 3.2, color: 0xf97316 },
            { x: 26, y: 7.6, z: -8, w: 5.5, h: 0.8, d: 5.5, color: 0xfacc15 }
        ];

        for (let i = 0; i < plataformas.length; i++) {
            const p = plataformas[i];
            const mat = new THREE.MeshStandardMaterial({
                map: obtenerTexturaPlataforma(p.color),
                roughness: 0.42,
                metalness: 0.12
            });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
            mesh.position.set(p.x, p.y - p.h / 2, p.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.grupoRaiz.add(mesh);

            const nucleo = new THREE.Mesh(
                new THREE.BoxGeometry(p.w * 0.72, 0.14, p.d * 0.72),
                new THREE.MeshStandardMaterial({
                    color: p.color,
                    emissive: p.color,
                    emissiveIntensity: 0.7
                })
            );
            nucleo.position.set(p.x, p.y - p.h - 0.06, p.z);
            this.grupoRaiz.add(nucleo);

            this.registrarColisionadorCaja(
                p.x - p.w / 2,
                p.y - p.h,
                p.z - p.d / 2,
                p.x + p.w / 2,
                p.y,
                p.z + p.d / 2,
                `parkour_${i + 1}`
            );
        }
    }

    /**
     * Crea partículas flotantes de ambiente iluminado (`THREE.Points`).
     */
    _construirParticulasAmbiente() {
        const cantidad = 80;
        const posiciones = new Float32Array(cantidad * 3);
        for (let i = 0; i < cantidad; i++) {
            posiciones[i * 3] = (Math.random() - 0.5) * 64;
            posiciones[i * 3 + 1] = 1.0 + Math.random() * 8.5;
            posiciones[i * 3 + 2] = (Math.random() - 0.5) * 64;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xfef08a,
            size: 0.24,
            transparent: true,
            opacity: 0.72
        });
        this.particulasAmbiente = new THREE.Points(geo, mat);
        this.grupoRaiz.add(this.particulasAmbiente);
    }

    /**
     * Genera monedas flotantes coleccionables en la plaza y sobre el parkour.
     */
    _construirMonedas() {
        const puntosMonedas = [
            { x: -6, y: 1.0, z: 10 },
            { x: 6, y: 1.0, z: 10 },
            { x: 0, y: 2.6, z: 0 },
            { x: -10, y: 1.0, z: -6 },
            { x: 10, y: 1.0, z: -6 },
            { x: 9, y: 2.1, z: 6 },
            { x: 17.5, y: 4.3, z: 1 },
            { x: 18, y: 6.5, z: -8.5 },
            { x: 22, y: 7.6, z: -13 },
            { x: 25.2, y: 8.6, z: -7.5 }
        ];

        const geoMoneda = new THREE.CylinderGeometry(0.45, 0.45, 0.14, 18);
        const matMoneda = new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xd97706,
            emissiveIntensity: 0.55,
            metalness: 0.75,
            roughness: 0.25
        });

        puntosMonedas.forEach((pt, idx) => {
            const mesh = new THREE.Mesh(geoMoneda.clone(), matMoneda.clone());
            mesh.rotation.z = Math.PI / 2;
            mesh.position.set(pt.x, pt.y, pt.z);
            mesh.castShadow = true;
            this.grupoRaiz.add(mesh);

            const monedaObj = {
                id: `moneda_${idx}`,
                mesh,
                posicionBase: { ...pt },
                tiempoRespawn: 0,
                entidad: null
            };

            monedaObj.entidad = this.registrarEntidadInteractiva({
                id: monedaObj.id,
                etiqueta: 'Moneda',
                posicion: { ...pt },
                radio: 1.35,
                autoRecoger: true,
                activa: true,
                alRecoger: () => {
                    if (!monedaObj.entidad.activa) return;
                    monedaObj.entidad.activa = false;
                    monedaObj.mesh.visible = false;
                    monedaObj.tiempoRespawn = 8.0;

                    this.otorgarRecompensa(10, 25);
                    enviarEventoExperiencia('moneda_recogida', { monedaId: monedaObj.id });
                    notificarEstado('aviso', { mensaje: '+10 Monedas y +25 XP por moneda recogida.' });
                }
            });

            this.monedas.push(monedaObj);
        });

        geoMoneda.dispose();
        matMoneda.dispose();
    }

    /**
     * Construye el Tótem de Fundadores en la plaza y el Cofre dorado del Parkour.
     */
    _construirEntidadesInteractivas() {
        const matTotem = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
        const pilar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.2), matTotem);
        pilar.position.set(-8, 1.0, 8);
        pilar.castShadow = true;
        this.grupoRaiz.add(pilar);
        this.registrarColisionadorCaja(-8.6, 0, 7.4, -7.4, 2.0, 8.6, 'totem_fundadores');

        const orbeMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.9
        });
        this.orbeTotem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), orbeMat);
        this.orbeTotem.position.set(-8, 2.65, 8);
        this.grupoRaiz.add(this.orbeTotem);

        this.registrarEntidadInteractiva({
            id: 'totem_fundadores',
            etiqueta: 'Tótem de Fundadores (Reclamar Visor)',
            posicion: { x: -8, y: 1.2, z: 8 },
            radio: 3.2,
            autoRecoger: false,
            activa: true
        });

        const matCofre = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0x92400e,
            emissiveIntensity: 0.4,
            metalness: 0.6,
            roughness: 0.3
        });
        const cofre = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), matCofre);
        cofre.position.set(26.5, 8.1, -8.5);
        cofre.castShadow = true;
        this.grupoRaiz.add(cofre);

        this.registrarEntidadInteractiva({
            id: 'cofre_parkour',
            etiqueta: 'Cofre del Cielo (Recompensa Épica)',
            posicion: { x: 26.5, y: 8.1, z: -8.5 },
            radio: 3.2,
            autoRecoger: false,
            activa: true
        });
    }

    /**
     * Construye 3 portales físicos 3D listos para enlazar experiencias.
     */
    _construirPortalesExperiencias(contextoSandbox) {
        const portales = [
            {
                idDestino: 'construccion',
                nombre: 'Taller de Bloques',
                subtitulo: 'Construcción Voxel Creativa',
                color: 0x22c55e,
                posicion: { x: -16, y: 0, z: -22 },
                rotacionY: 0.32,
                fisicaPreview: { gravedad: GRAVEDAD_BASE, multiplicadorVelocidad: 1.0, multiplicadorSalto: 1.0 },
                mensajePreview: 'Entrando al Taller de Bloques...'
            },
            {
                idDestino: 'karts',
                nombre: 'Arena Turbo Karts',
                subtitulo: 'Circuito GP en 8 · Karts 120 pts',
                color: 0xf97316,
                posicion: { x: 0, y: 0, z: -26 },
                rotacionY: 0,
                fisicaPreview: { gravedad: GRAVEDAD_BASE, multiplicadorVelocidad: 1.6, multiplicadorSalto: 1.0 },
                mensajePreview: 'Entrando a Arena Turbo Karts...'
            },
            {
                idDestino: 'tetris',
                nombre: 'Sala Tetris Arcade',
                subtitulo: 'Cine 8 Butacas · Tetris 10x20',
                color: 0xa855f7,
                posicion: { x: 16, y: 0, z: -22 },
                rotacionY: -0.32,
                fisicaPreview: { gravedad: GRAVEDAD_BASE, multiplicadorVelocidad: 1.0, multiplicadorSalto: 1.0 },
                mensajePreview: 'Entrando a Sala de Tetris Arcade...'
            }
        ];

        for (const p of portales) {
            this.crearPortalFisico3D({
                idDestino: p.idDestino,
                nombre: p.nombre,
                subtitulo: p.subtitulo,
                color: p.color,
                posicion: p.posicion,
                rotacionY: p.rotacionY,
                alEntrar: (ctx) => {
                    const expRegistrada = RegistroExperiencias.obtenerExperiencia(p.idDestino);
                    if (expRegistrada) {
                        RegistroExperiencias.cambiarExperiencia(p.idDestino, ctx || contextoSandbox);
                        return;
                    }
                    this.configFisica = { ...p.fisicaPreview };
                    if (!this.portalesVisitados.has(p.idDestino)) {
                        this.portalesVisitados.add(p.idDestino);
                        this.otorgarRecompensa(15, 30);
                    }
                    notificarEstado('aviso', { mensaje: p.mensajePreview });
                }
            });
        }
    }

    /**
     * Maneja interacción al pulsar `KeyE` o botón móvil de acción.
     * @param {object} _jugador
     * @param {object} entidad
     */
    alInteractuar(_jugador, entidad) {
        if (!entidad) return;
        reproducirSonido('interaccion');

        if (entidad.id === 'totem_fundadores') {
            if (!this.totemReclamado) {
                this.totemReclamado = true;
                this.otorgarRecompensa(25, 50, 'visor_cibernetico');
                notificarEstado('aviso', {
                    mensaje: '¡Tótem reclamado! +25 Monedas, +50 XP y Visor Cibernético.'
                });
            } else {
                this.otorgarRecompensa(5, 10);
                notificarEstado('aviso', {
                    mensaje: 'Tótem energizado: +5 Monedas y +10 XP.'
                });
            }
            return;
        }

        if (entidad.id === 'cofre_parkour') {
            if (!this.cofreReclamado) {
                this.cofreReclamado = true;
                this.otorgarRecompensa(60, 100, 'mochila_jet');
                notificarEstado('aviso', {
                    mensaje: '¡Cofre del Cielo abierto! +60 Monedas, +100 XP y Mochila Jet.'
                });
            } else {
                notificarEstado('aviso', {
                    mensaje: 'Ya reclamaste el Cofre del Cielo en esta sesión.'
                });
            }
        }
    }

    /**
     * Sincroniza eventos recibidos de otros jugadores en la misma sala.
     * @param {object} evento
     */
    alEventoRed(evento) {
        if (evento?.subtipo === 'moneda_recogida' && evento.datos?.monedaId) {
            const moneda = this.monedas.find((m) => m.id === evento.datos.monedaId);
            if (moneda && moneda.entidad.activa) {
                moneda.entidad.activa = false;
                moneda.mesh.visible = false;
                moneda.tiempoRespawn = 8.0;
            }
        }
    }

    /**
     * Actualiza animaciones de cristal, monedas, partículas flotantes y respawns.
     * @param {number} dt
     * @param {object} _contextoSandbox
     */
    actualizar(dt, _contextoSandbox) {
        this.tiempoTotal += dt;

        if (this.cristalCentral) {
            this.cristalCentral.rotation.y += dt * 1.2;
            this.cristalCentral.position.y = 3.5 + Math.sin(this.tiempoTotal * 2.2) * 0.25;
        }

        if (this.orbeTotem) {
            this.orbeTotem.rotation.y -= dt * 1.8;
            this.orbeTotem.position.y = 2.65 + Math.cos(this.tiempoTotal * 2.6) * 0.14;
        }

        if (this.particulasAmbiente) {
            this.particulasAmbiente.rotation.y += dt * 0.04;
            this.particulasAmbiente.position.y = Math.sin(this.tiempoTotal * 0.8) * 0.3;
        }

        if (this.cupulaCielo) {
            this.cupulaCielo.rotation.y += dt * 0.007;
        }

        for (const m of this.monedas) {
            if (!m.entidad.activa) {
                m.tiempoRespawn -= dt;
                if (m.tiempoRespawn <= 0) {
                    m.entidad.activa = true;
                    m.mesh.visible = true;
                }
                continue;
            }
            m.mesh.rotation.x += dt * 2.4;
            m.mesh.position.y = m.posicionBase.y + Math.sin(this.tiempoTotal * 3 + m.posicionBase.x) * 0.16;
        }
    }

    /**
     * Limpia toda la geometría y texturas temporales del Lobby Central.
     * @param {THREE.Scene} escena
     */
    desmontar(escena) {
        liberarObjeto3D(this.grupoRaiz);
        this.monedas = [];
        this.cristalCentral = null;
        this.orbeTotem = null;
        this.particulasAmbiente = null;
        this.cupulaCielo = null;
        super.desmontar(escena);
    }
}
