/**
 * Experiencia inicial heredada de `ExperienciaBase`: Parque de Diversiones Moderno (130x130 m).
 * Integra la Plaza Estrella con fuente iluminada, 4 bulevares con arcos festivos,
 * 3 pabellones temáticos (LEGO Voxel, Turbo Karts GP y Tetris Arcade), Rueda de la Fortuna
 * animada con 12 góndolas, kioscos con toldos rayados, torre parkour y seguimiento en 3ra persona.
 */
import { DIMENSION_LOBBY, GRAVEDAD_BASE, LIMITE_MUNDO, MITAD_LOBBY } from '../constantes.js';
import { CONFIG_CAMARA } from '../config.js';
import { estadoControles, estadoJugador, notificarEstado } from '../estado.js';
import {
    crearCupulaCielo,
    liberarObjeto3D,
    obtenerMapasPBRPlaza,
    obtenerTexturaBulevarParque,
    obtenerTexturaCarpaParque,
    obtenerTexturaCespedPlaza,
    obtenerTexturaLetreroNeon,
    obtenerTexturaMetaDamero,
    obtenerTexturaPlataforma,
    reproducirSonido
} from '../recursos.js';
import { ExperienciaBase, RegistroExperiencias } from '../nucleoSandbox.js';
import { enviarEventoExperiencia } from '../red.js';

export class LobbyCentral extends ExperienciaBase {
    constructor() {
        super({
            id: 'lobby',
            nombre: 'Parque Estelar (Lobby)',
            descripcion: 'Parque de diversiones 130x130 m con Rueda de la Fortuna, pabellones 3D y parkour.',
            colorPortal: 0x38bdf8,
            posicionPortal: { x: 0, y: 0, z: 0 },
            minJugadores: 1,
            spawnJugador: { x: 0, y: 0.5, z: 26 }
        });

        this.monedas = [];
        this.cristalCentral = null;
        this.orbeTotem = null;
        this.particulasAmbiente = null;
        this.cupulaCielo = null;
        this.ruedaFortuna = null;
        this.gondolasRueda = [];
        this.lucesArcoGP = [];
        this.chorrosAgua = [];
        this.tiempoTotal = 0;
        this.totemReclamado = false;
        this.cofreReclamado = false;
        this.portalesVisitados = new Set();
    }

    /**
     * Construye el Parque de Diversiones Moderno y registra colisionadores y atracciones.
     * @param {THREE.Scene} escena
     * @param {object} contextoSandbox
     */
    montar(escena, contextoSandbox) {
        super.montar(escena, contextoSandbox);
        this.monedas = [];
        this.gondolasRueda = [];
        this.lucesArcoGP = [];
        this.chorrosAgua = [];
        this.ruedaFortuna = null;
        this.tiempoTotal = 0;
        this.configFisica = {
            gravedad: GRAVEDAD_BASE,
            multiplicadorVelocidad: 1,
            multiplicadorSalto: 1,
            limiteMundo: LIMITE_MUNDO
        };

        estadoJugador.rotacion = Math.PI;
        estadoControles.anguloCamaraY = 0;
        estadoControles.anguloCamaraPitch = 0.34;
        estadoControles.tiempoOrbitaManual = 0;

        this._construirPlazaYBulevares(DIMENSION_LOBBY, MITAD_LOBBY);
        this._construirFuenteCentral();
        this._construirPabellonesAtracciones(contextoSandbox);
        this._construirRuedaFortuna();
        this._construirKioscosYDetalles();
        this._construirTorreParkour();
        this._construirMonedas();
        this._construirEntidadesInteractivas();
        this._construirParticulasAmbiente();

        this.cupulaCielo = crearCupulaCielo('lobby_dia');
        this.grupoRaiz.add(this.cupulaCielo);
        if (escena) {
            escena.background = new THREE.Color(0x68b5e8);
            escena.fog = new THREE.FogExp2(0x7ec8f2, 0.0028);
        }
    }

    /**
     * Crea la pradera 130x130 m, Plaza Estrella central, 4 bulevares iluminados y cercas perimetrales.
     */
    _construirPlazaYBulevares(dimension, mitad) {
        const cespedPBR = obtenerTexturaCespedPlaza();
        const suelo = new THREE.Mesh(
            new THREE.PlaneGeometry(dimension, dimension),
            new THREE.MeshStandardMaterial({
                map: cespedPBR.map,
                bumpMap: cespedPBR.bumpMap,
                bumpScale: 0.04,
                roughnessMap: cespedPBR.roughnessMap,
                roughness: 0.88,
                metalness: 0.02
            })
        );
        suelo.rotation.x = -Math.PI / 2;
        suelo.receiveShadow = true;
        this.grupoRaiz.add(suelo);

        // Colisionador sólido de piso 130x130 m
        this.registrarColisionadorCaja(-mitad, -2, -mitad, mitad, 0, mitad, 'suelo_parque');

        // Plaza Estrella central
        const bulevarPlaza = obtenerTexturaBulevarParque(5);
        const plaza = new THREE.Mesh(
            new THREE.CylinderGeometry(18.5, 19.2, 0.14, 48),
            new THREE.MeshStandardMaterial({
                map: bulevarPlaza.map,
                bumpMap: bulevarPlaza.bumpMap,
                bumpScale: 0.03,
                roughness: 0.68,
                metalness: 0.06
            })
        );
        plaza.position.y = 0.02;
        plaza.receiveShadow = true;
        this.grupoRaiz.add(plaza);

        const aroPlaza = new THREE.Mesh(
            new THREE.TorusGeometry(18.8, 0.24, 8, 56),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42, metalness: 0.25 })
        );
        aroPlaza.rotation.x = Math.PI / 2;
        aroPlaza.position.y = 0.08;
        aroPlaza.receiveShadow = true;
        this.grupoRaiz.add(aroPlaza);

        // Estrella central incrustada en el pavimento alrededor de la fuente
        const matEstrella = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xd97706,
            emissiveIntensity: 0.22,
            roughness: 0.38,
            metalness: 0.25
        });
        for (let i = 0; i < 4; i++) {
            const brazo = new THREE.Mesh(new THREE.BoxGeometry(22, 0.06, 1.3), matEstrella);
            brazo.rotation.y = (i * Math.PI) / 4;
            brazo.position.y = 0.08;
            brazo.receiveShadow = true;
            this.grupoRaiz.add(brazo);
        }

        // Bulevares radiantes hacia entrada Sur y los 3 pabellones
        const bulevarTex = obtenerTexturaBulevarParque(4);
        const matBulevar = new THREE.MeshStandardMaterial({
            map: bulevarTex.map,
            bumpMap: bulevarTex.bumpMap,
            bumpScale: 0.025,
            roughness: 0.72
        });

        const angDiag = Math.atan2(30, 26);
        const tramos = [
            { x: 0, z: 36, rotY: 0, ancho: 5.4, largo: 36, arcos: [44, 52] },
            { x: 0, z: -25.5, rotY: 0, ancho: 5.6, largo: 17, arcos: [-21, -28] },
            { x: -21.2, z: -18.4, rotY: angDiag, ancho: 5.0, largo: 24, arcos: [] },
            { x: 21.2, z: -18.4, rotY: -angDiag, ancho: 5.0, largo: 24, arcos: [] }
        ];

        const matPosteArco = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.55 });
        const coloresBanderin = [0xef4444, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7];

        for (const t of tramos) {
            const losa = new THREE.Mesh(new THREE.BoxGeometry(t.ancho, 0.09, t.largo), matBulevar);
            losa.position.set(t.x, 0.045, t.z);
            losa.rotation.y = t.rotY;
            losa.receiveShadow = true;
            this.grupoRaiz.add(losa);

            for (const az of t.arcos) {
                this._crearArcoGuirnalda(0, az, 0, t.ancho + 1.2, matPosteArco, coloresBanderin);
            }
        }

        // Arcos festivos en diagonales hacia Taller Voxel y Tetris Arcade
        this._crearArcoGuirnalda(-21.2, -18.4, angDiag, 6.2, matPosteArco, coloresBanderin);
        this._crearArcoGuirnalda(21.2, -18.4, -angDiag, 6.2, matPosteArco, coloresBanderin);

        // 6 bancas modernas y jardineras florales alrededor de la Plaza Estrella (fuera de bulevares)
        const angulosBancas = [0.46, 1.57, 2.68, -2.68, -1.57, -0.46];
        const matMadera = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.72 });
        const matMetalBanca = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.5 });
        const matPiedraJardinera = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 });
        const coloresFlores = [0xf43f5e, 0xfacc15, 0xec4899, 0x38bdf8];

        angulosBancas.forEach((ang, idx) => {
            const rx = Math.sin(ang) * 15.2;
            const rz = Math.cos(ang) * 15.2;
            const banca = new THREE.Group();
            banca.position.set(rx, 0.09, rz);
            banca.rotation.y = ang + Math.PI;

            const asiento = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.72), matMadera);
            asiento.position.y = 0.52;
            asiento.castShadow = true;
            banca.add(asiento);

            const respaldo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.52, 0.12), matMadera);
            respaldo.position.set(0, 0.84, -0.3);
            respaldo.castShadow = true;
            banca.add(respaldo);

            for (const sx of [-1.05, 1.05]) {
                const pata = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.68), matMetalBanca);
                pata.position.set(sx, 0.26, 0);
                banca.add(pata);
            }
            this.grupoRaiz.add(banca);
            this.registrarColisionadorCaja(rx - 1.1, 0, rz - 1.1, rx + 1.1, 1.2, rz + 1.1, `banca_plaza_${idx}`);

            // Jardinera floral contigua sobre el anillo exterior (r = 17.8 m)
            const jx = Math.sin(ang + 0.16) * 17.5;
            const jz = Math.cos(ang + 0.16) * 17.5;
            const maceta = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.0, 0.52, 12), matPiedraJardinera);
            maceta.position.set(jx, 0.26, jz);
            maceta.castShadow = true;
            this.grupoRaiz.add(maceta);

            const arbusto = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.95, 0),
                new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.78 })
            );
            arbusto.position.set(jx, 0.82, jz);
            arbusto.scale.set(1.1, 0.65, 1.1);
            this.grupoRaiz.add(arbusto);

            const flor = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 8, 6),
                new THREE.MeshStandardMaterial({
                    color: coloresFlores[idx % coloresFlores.length],
                    emissive: coloresFlores[idx % coloresFlores.length],
                    emissiveIntensity: 0.25
                })
            );
            flor.position.set(jx, 1.25, jz);
            this.grupoRaiz.add(flor);
            this.registrarColisionadorCaja(jx - 1.1, 0, jz - 1.1, jx + 1.1, 1.3, jz + 1.1, `jardinera_${idx}`);
        });

        // Cercas y setos perimetrales 130x130 m con colisionadores sólidos
        const matValla = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
        const matSeto = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.82 });
        const bordes = [
            { x: 0, z: -mitad + 0.8, w: dimension - 1.6, d: 1.0, minX: -mitad, minZ: -mitad, maxX: mitad, maxZ: -mitad + 1.4 },
            { x: 0, z: mitad - 0.8, w: dimension - 1.6, d: 1.0, minX: -mitad, minZ: mitad - 1.4, maxX: mitad, maxZ: mitad },
            { x: -mitad + 0.8, z: 0, w: 1.0, d: dimension - 1.6, minX: -mitad, minZ: -mitad, maxX: -mitad + 1.4, maxZ: mitad },
            { x: mitad - 0.8, z: 0, w: 1.0, d: dimension - 1.6, minX: mitad - 1.4, minZ: -mitad, maxX: mitad, maxZ: mitad }
        ];
        bordes.forEach((b, idx) => {
            const seto = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1.25, b.d), matSeto);
            seto.position.set(b.x, 0.625, b.z);
            seto.castShadow = true;
            seto.receiveShadow = true;
            this.grupoRaiz.add(seto);

            const remate = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.99, 0.22, b.d * 1.15), matValla);
            remate.position.set(b.x, 1.32, b.z);
            this.grupoRaiz.add(remate);

            this.registrarColisionadorCaja(b.minX, 0, b.minZ, b.maxX, 2.5, b.maxZ, `cerca_parque_${idx}`);
        });
    }

    /**
     * Construye un arco aéreo de bulevar con guirnalda de luces y banderines de feria.
     */
    _crearArcoGuirnalda(x, z, rotY, luzAncho, matPoste, coloresBanderin) {
        const arco = new THREE.Group();
        arco.position.set(x, 0, z);
        arco.rotation.y = rotY;
        const mitadSpan = luzAncho / 2;

        for (const sx of [-mitadSpan, mitadSpan]) {
            const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.4, 8), matPoste);
            poste.position.set(sx, 2.2, 0);
            poste.castShadow = true;
            arco.add(poste);
        }

        const travesano = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, luzAncho, 8), matPoste);
        travesano.rotation.z = Math.PI / 2;
        travesano.position.y = 4.35;
        arco.add(travesano);

        const paso = luzAncho / 6;
        for (let i = 1; i <= 5; i++) {
            const bx = -mitadSpan + i * paso;
            const color = coloresBanderin[i % coloresBanderin.length];
            const bombilla = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfbbf24, emissiveIntensity: 1.0 })
            );
            bombilla.position.set(bx, 4.18, 0);
            arco.add(bombilla);

            const banderin = new THREE.Mesh(
                new THREE.ConeGeometry(0.2, 0.42, 3),
                new THREE.MeshStandardMaterial({ color, roughness: 0.45 })
            );
            banderin.rotation.x = Math.PI;
            banderin.position.set(bx, 3.88, 0);
            arco.add(banderin);
        }

        this.grupoRaiz.add(arco);
    }

    /**
     * Construye la fuente moderna iluminada en el centro `(0, 0, 0)` con espejo de agua,
     * chorros animados y cristal central flotante.
     */
    _construirFuenteCentral() {
        const piedraPBR = obtenerMapasPBRPlaza(2);
        const matPiedra = new THREE.MeshStandardMaterial({
            map: piedraPBR.map,
            bumpMap: piedraPBR.bumpMap,
            bumpScale: 0.04,
            roughness: 0.55
        });

        const estanqueBase = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.1, 0.65, 32), matPiedra);
        estanqueBase.position.set(0, 0.325, 0);
        estanqueBase.receiveShadow = true;
        estanqueBase.castShadow = true;
        this.grupoRaiz.add(estanqueBase);
        this.registrarColisionadorCaja(-4.7, 0, -4.7, 4.7, 0.8, 4.7, 'fuente_base');

        const agua = new THREE.Mesh(
            new THREE.CylinderGeometry(4.35, 4.35, 0.18, 32),
            new THREE.MeshStandardMaterial({
                color: 0x0ea5e9,
                emissive: 0x0369a1,
                emissiveIntensity: 0.25,
                roughness: 0.08,
                metalness: 0.45,
                transparent: true,
                opacity: 0.85
            })
        );
        agua.position.set(0, 0.66, 0);
        this.grupoRaiz.add(agua);

        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 1.15, 24), matPiedra);
        pedestal.position.set(0, 1.25, 0);
        pedestal.castShadow = true;
        this.grupoRaiz.add(pedestal);
        this.registrarColisionadorCaja(-2.2, 0.6, -2.2, 2.2, 1.9, 2.2, 'fuente_pedestal');

        // Anillo de 8 chorros de agua iluminados
        const matChorro = new THREE.MeshStandardMaterial({
            color: 0x7dd3fc,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.55,
            transparent: true,
            opacity: 0.78,
            roughness: 0.15
        });
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const chorro = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 1.4, 8), matChorro);
            chorro.position.set(Math.sin(ang) * 3.1, 1.35, Math.cos(ang) * 3.1);
            this.grupoRaiz.add(chorro);
            this.chorrosAgua.push({ mesh: chorro, fase: i * 0.75 });
        }

        const cristalMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.95,
            metalness: 0.35,
            roughness: 0.12
        });
        this.cristalCentral = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), cristalMat);
        this.cristalCentral.position.set(0, 3.65, 0);
        this.cristalCentral.castShadow = true;
        this.grupoRaiz.add(this.cristalCentral);

        const luzFuente = new THREE.PointLight(0x38bdf8, 1.45, 26);
        luzFuente.position.set(0, 4.6, 0);
        this.grupoRaiz.add(luzFuente);
    }

    /**
     * Construye los 3 pabellones temáticos de atracción y enlaza sus portales físicos 3D.
     */
    _construirPabellonesAtracciones(contextoSandbox) {
        const portales = [
            {
                idDestino: 'construccion',
                nombre: 'Taller de Bloques',
                subtitulo: 'Construcción Voxel Creativa',
                color: 0x22c55e,
                posicion: { x: -30, y: 0, z: -26 },
                rotacionY: 0.42
            },
            {
                idDestino: 'karts',
                nombre: 'Arena Turbo Karts',
                subtitulo: 'Circuito GP en 8 · Karts 120 pts',
                color: 0xf97316,
                posicion: { x: 0, y: 0, z: -34 },
                rotacionY: 0
            },
            {
                idDestino: 'tetris',
                nombre: 'Sala Tetris Arcade',
                subtitulo: 'Cine 8 Butacas · Tetris 10x20',
                color: 0xa855f7,
                posicion: { x: 30, y: 0, z: -26 },
                rotacionY: -0.42
            }
        ];

        this._construirPabellonLego(portales[0].posicion, portales[0].rotacionY);
        this._construirArcoGrandPrix(portales[1].posicion, portales[1].rotacionY);
        this._construirPabellonTetrisNeon(portales[2].posicion, portales[2].rotacionY);

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
                    if (!this.portalesVisitados.has(p.idDestino)) {
                        this.portalesVisitados.add(p.idDestino);
                        this.otorgarRecompensa(15, 30);
                    }
                    notificarEstado('aviso', { mensaje: `Entrando a ${p.nombre}...` });
                }
            });
        }
    }

    /**
     * Crea un letrero marquesina neón temporal desechable por `liberarObjeto3D`.
     */
    _agregarMarquesinaNeon(padre, titulo, subtitulo, colorHex, y, z = 0.25) {
        const textura = obtenerTexturaLetreroNeon(titulo, colorHex, subtitulo);
        const marco = new THREE.Mesh(
            new THREE.BoxGeometry(6.6, 1.75, 0.34),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.65 })
        );
        marco.position.set(0, y, z);
        padre.add(marco);

        const pantalla = new THREE.Mesh(
            new THREE.PlaneGeometry(6.3, 1.5),
            new THREE.MeshBasicMaterial({ map: textura })
        );
        pantalla.position.set(0, y, z + 0.19);
        padre.add(pantalla);
    }

    /**
     * Atracción 1 — Pabellón Creativo LEGO (`TALLER VOXEL`).
     */
    _construirPabellonLego(pos, rotY) {
        const pabellon = new THREE.Group();
        pabellon.position.set(pos.x, pos.y, pos.z);
        pabellon.rotation.y = rotY;

        const coloresLego = [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6];
        const matLadrillos = coloresLego.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.08 }));

        // Columnas laterales de ladrillos apilados (sin obstruir portal central)
        for (const sx of [-4.1, 4.1]) {
            for (let nivel = 0; nivel < 4; nivel++) {
                const mat = matLadrillos[(nivel + (sx > 0 ? 2 : 0)) % matLadrillos.length];
                const bloque = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.4, 1.7), mat);
                bloque.position.set(sx, 0.7 + nivel * 1.4, 0);
                bloque.castShadow = true;
                bloque.receiveShadow = true;
                pabellon.add(bloque);
            }
            const remate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12), matLadrillos[1]);
            remate.position.set(sx - 0.35, 5.74, 0);
            pabellon.add(remate);
            const remate2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12), matLadrillos[1]);
            remate2.position.set(sx + 0.35, 5.74, 0);
            pabellon.add(remate2);
        }

        // Viga superior de ladrillo gigante con studs 3D
        const viga = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.2, 1.9), matLadrillos[2]);
        viga.position.set(0, 6.2, 0);
        viga.castShadow = true;
        pabellon.add(viga);

        for (let i = -4; i <= 4; i++) {
            const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12), matLadrillos[Math.abs(i) % matLadrillos.length]);
            stud.position.set(i * 1.05, 6.94, 0);
            pabellon.add(stud);
        }

        // Esculturas voxel gigantes flanqueando la entrada
        for (const lado of [-1, 1]) {
            const cuboBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), matLadrillos[lado < 0 ? 3 : 0]);
            cuboBase.position.set(lado * 6.0, 0.8, 1.4);
            cuboBase.rotation.y = lado * 0.25;
            cuboBase.castShadow = true;
            pabellon.add(cuboBase);

            const cuboTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), matLadrillos[1]);
            cuboTop.position.set(lado * 6.0, 2.15, 1.4);
            cuboTop.rotation.y = -lado * 0.3;
            cuboTop.castShadow = true;
            pabellon.add(cuboTop);
        }

        this._agregarMarquesinaNeon(pabellon, 'TALLER VOXEL', 'PABELLÓN CREATIVO LEGO', '#22c55e', 7.9, 0.6);
        this.grupoRaiz.add(pabellon);

        // Colisionadores en columnas laterales en coordenadas mundo
        for (const sx of [-4.1, 4.1]) {
            const wx = pos.x + Math.cos(rotY) * sx;
            const wz = pos.z - Math.sin(rotY) * sx;
            this.registrarColisionadorCaja(wx - 0.9, 0, wz - 0.9, wx + 0.9, 5.8, wz + 0.9, 'pabellon_lego_col');
        }
    }

    /**
     * Atracción 2 — Gran Arco Grand Prix (`TURBO KARTS GP`).
     */
    _construirArcoGrandPrix(pos, rotY) {
        const gp = new THREE.Group();
        gp.position.set(pos.x, pos.y, pos.z);
        gp.rotation.y = rotY;

        const matMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.7 });
        const matRojo = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
        const matBlanco = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
        const matDamero = new THREE.MeshStandardMaterial({ map: obtenerTexturaMetaDamero(), roughness: 0.45 });

        for (const sx of [-4.5, 4.5]) {
            const torre = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.4, 1.6), matMetal);
            torre.position.set(sx, 3.2, 0);
            torre.castShadow = true;
            gp.add(torre);

            // Pilas de neumáticos de competición junto a los pilares
            const matNeumatico = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
            for (let h = 0; h < 3; h++) {
                const llanta = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 14), matNeumatico);
                llanta.position.set(sx + (sx > 0 ? 1.2 : -1.2), 0.18 + h * 0.36, 1.0);
                llanta.castShadow = true;
                gp.add(llanta);
            }
        }
        this.registrarColisionadorCaja(pos.x - 5.2, 0, pos.z - 0.9, pos.x - 3.8, 6.4, pos.z + 0.9, 'arco_gp_izq');
        this.registrarColisionadorCaja(pos.x + 3.8, 0, pos.z - 0.9, pos.x + 5.2, 6.4, pos.z + 0.9, 'arco_gp_der');

        // Travesaño damero y semáforo animado de salida
        const puente = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.4, 1.8), matDamero);
        puente.position.set(0, 6.4, 0);
        puente.castShadow = true;
        gp.add(puente);

        for (let i = 0; i < 4; i++) {
            const lx = -2.1 + i * 1.4;
            const matFoco = new THREE.MeshStandardMaterial({
                color: i < 2 ? 0xef4444 : 0x22c55e,
                emissive: i < 2 ? 0xef4444 : 0x22c55e,
                emissiveIntensity: 1.0
            });
            const foco = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), matFoco);
            foco.position.set(lx, 5.5, 0.85);
            gp.add(foco);
            this.lucesArcoGP.push({ mat: matFoco, esVerde: i >= 2 });
        }

        // Banderas a cuadros y pianos rojo/blanco flanqueando la recta de acceso
        for (let k = 0; k < 5; k++) {
            const matPiano = k % 2 === 0 ? matRojo : matBlanco;
            for (const bx of [-3.1, 3.1]) {
                const piano = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 2.2), matPiano);
                piano.position.set(bx, 0.08, 2.5 + k * 2.6);
                gp.add(piano);
            }
        }

        // Mini tribunas estilizadas flanqueando la atracción
        for (const lado of [-1, 1]) {
            const baseTribuna = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 5.2), matMetal);
            baseTribuna.position.set(lado * 8.4, 0.4, 2.2);
            baseTribuna.castShadow = true;
            gp.add(baseTribuna);

            for (let g = 0; g < 3; g++) {
                const grada = new THREE.Mesh(
                    new THREE.BoxGeometry(1.1, 0.45, 4.8),
                    g % 2 === 0 ? matRojo : new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
                );
                grada.position.set(lado * (7.2 + g * 1.15), 1.0 + g * 0.55, 2.2);
                grada.castShadow = true;
                gp.add(grada);
            }
            const gxMin = pos.x + lado * 8.4 - 2.2;
            const gxMax = pos.x + lado * 8.4 + 2.2;
            this.registrarColisionadorCaja(gxMin, 0, pos.z - 0.5, gxMax, 2.6, pos.z + 4.9, `tribuna_gp_${lado}`);
        }

        this._agregarMarquesinaNeon(gp, 'TURBO KARTS GP', 'CIRCUITO GRAND PRIX', '#f97316', 8.0, 0.72);
        this.grupoRaiz.add(gp);
    }

    /**
     * Atracción 3 — Pabellón Arcade Neón (`TETRIS ARCADE`).
     */
    _construirPabellonTetrisNeon(pos, rotY) {
        const arcade = new THREE.Group();
        arcade.position.set(pos.x, pos.y, pos.z);
        arcade.rotation.y = rotY;

        const matOscuro = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 });
        const matNeonMagenta = new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xc026d3, emissiveIntensity: 0.9 });
        const matNeonCian = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.9 });

        for (const sx of [-4.1, 4.1]) {
            const pilar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6.2, 1.5), matOscuro);
            pilar.position.set(sx, 3.1, 0);
            pilar.castShadow = true;
            arcade.add(pilar);

            const tira = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.8, 0.2), sx < 0 ? matNeonCian : matNeonMagenta);
            tira.position.set(sx, 3.1, 0.78);
            arcade.add(tira);
        }

        const dintel = new THREE.Mesh(new THREE.BoxGeometry(10.0, 1.2, 1.6), matOscuro);
        dintel.position.set(0, 6.2, 0);
        dintel.castShadow = true;
        arcade.add(dintel);

        // Esculturas 3D de Tetrominos (I, T, L, Z) sobre y junto al pórtico
        const piezas = [
            { x: -3.2, y: 7.4, color: 0x22d3ee, celdas: [[0, 0], [1, 0], [2, 0], [3, 0]] }, // I
            { x: 1.5, y: 7.4, color: 0xa855f7, celdas: [[0, 0], [1, 0], [2, 0], [1, 1]] },  // T
            { x: -5.8, y: 1.0, color: 0xf97316, celdas: [[0, 0], [0, 1], [0, 2], [1, 0]] }, // L
            { x: 4.8, y: 1.0, color: 0xef4444, celdas: [[0, 1], [1, 1], [1, 0], [2, 0]] }   // Z
        ];
        const geoCubo = new THREE.BoxGeometry(0.54, 0.54, 0.54);
        for (const p of piezas) {
            const matP = new THREE.MeshStandardMaterial({
                color: p.color,
                emissive: p.color,
                emissiveIntensity: 0.45,
                roughness: 0.28
            });
            for (const [cx, cy] of p.celdas) {
                const cubo = new THREE.Mesh(geoCubo, matP);
                cubo.position.set(p.x + cx * 0.58, p.y + cy * 0.58, 0.35);
                cubo.castShadow = true;
                arcade.add(cubo);
            }
        }

        this._agregarMarquesinaNeon(arcade, 'TETRIS ARCADE', 'SALÓN 3D · 8 BUTACAS', '#a855f7', 9.0, 0.65);
        this.grupoRaiz.add(arcade);

        for (const sx of [-4.1, 4.1]) {
            const wx = pos.x + Math.cos(rotY) * sx;
            const wz = pos.z - Math.sin(rotY) * sx;
            this.registrarColisionadorCaja(wx - 0.8, 0, wz - 0.8, wx + 0.8, 6.2, wz + 0.8, 'pabellon_tetris_col');
        }
    }

    /**
     * Construye la Rueda de la Fortuna animada (~25 m) al norte del parque con 12 góndolas verticales.
     */
    _construirRuedaFortuna() {
        const cx = 0;
        const cz = -54;
        const ejeY = 14.2;
        const radioRueda = 10.2;

        const matTorre = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.55 });
        const matBase = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 });
        const matAro = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.35,
            roughness: 0.3,
            metalness: 0.5
        });

        const plataforma = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.5, 11.5), matBase);
        plataforma.position.set(cx, 0.25, cz);
        plataforma.receiveShadow = true;
        this.grupoRaiz.add(plataforma);

        // Torres soporte en A a ambos lados del eje
        for (const sx of [-1.9, 1.9]) {
            for (const sz of [-4.2, 4.2]) {
                const dx = 0;
                const dy = ejeY - 0.3;
                const dz = -sz;
                const long = Math.hypot(dx, dy, dz);
                const viga = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, long, 8), matTorre);
                viga.position.set(cx + sx, 0.3 + dy / 2, cz + sz / 2);
                viga.rotation.x = Math.atan2(-sz, dy);
                viga.castShadow = true;
                this.grupoRaiz.add(viga);

                this.registrarColisionadorCaja(cx + sx - 0.5, 0, cz + sz - 0.5, cx + sx + 0.5, 4.0, cz + sz + 0.5, 'torre_rueda');
            }
        }

        const eje = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.45, 4.4, 14),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.7 })
        );
        eje.rotation.x = Math.PI / 2;
        eje.position.set(cx, ejeY, cz);
        this.grupoRaiz.add(eje);

        this.ruedaFortuna = new THREE.Group();
        this.ruedaFortuna.position.set(cx, ejeY, cz);

        for (const zOff of [-1.25, 1.25]) {
            const aro = new THREE.Mesh(new THREE.TorusGeometry(radioRueda, 0.2, 10, 40), matAro);
            aro.position.z = zOff;
            this.ruedaFortuna.add(aro);
        }

        const coloresGondola = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7];
        const geoRadio = new THREE.CylinderGeometry(0.08, 0.08, radioRueda, 6);
        const geoBombilla = new THREE.SphereGeometry(0.2, 8, 6);

        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const px = Math.cos(ang) * radioRueda;
            const py = Math.sin(ang) * radioRueda;

            for (const zOff of [-1.25, 1.25]) {
                const radioMalla = new THREE.Mesh(geoRadio, matTorre);
                radioMalla.position.set(px * 0.5, py * 0.5, zOff);
                radioMalla.rotation.z = ang - Math.PI / 2;
                this.ruedaFortuna.add(radioMalla);
            }

            const bombilla = new THREE.Mesh(
                geoBombilla,
                new THREE.MeshStandardMaterial({
                    color: coloresGondola[i % coloresGondola.length],
                    emissive: coloresGondola[i % coloresGondola.length],
                    emissiveIntensity: 0.95
                })
            );
            bombilla.position.set(px * 1.03, py * 1.03, 1.38);
            this.ruedaFortuna.add(bombilla);

            // Góndola suspendida con pivote independiente que se mantiene vertical al rotar
            const gondola = new THREE.Group();
            gondola.position.set(px, py, 0);

            const brazoSusp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 2.2), matTorre);
            brazoSusp.position.y = -0.35;
            gondola.add(brazoSusp);

            const colorCabina = coloresGondola[i % coloresGondola.length];
            const cabina = new THREE.Mesh(
                new THREE.BoxGeometry(1.55, 1.15, 1.75),
                new THREE.MeshStandardMaterial({ color: colorCabina, roughness: 0.4, metalness: 0.12 })
            );
            cabina.position.y = -1.25;
            cabina.castShadow = true;
            gondola.add(cabina);

            const techoGondola = new THREE.Mesh(
                new THREE.CylinderGeometry(0.95, 1.1, 0.35, 4),
                new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 })
            );
            techoGondola.rotation.y = Math.PI / 4;
            techoGondola.position.y = -0.55;
            gondola.add(techoGondola);

            this.ruedaFortuna.add(gondola);
            this.gondolasRueda.push(gondola);
        }

        this.grupoRaiz.add(this.ruedaFortuna);
    }

    /**
     * Añade 4 kioscos temáticos con toldos rayados, árboles estilizados y farolas modernas.
     */
    _construirKioscosYDetalles() {
        const kioscos = [
            { x: -23, z: 10, rotY: 0.4, c1: '#ef4444', c2: '#fff7ed', titulo: 'SNACKS' },
            { x: 23, z: 10, rotY: -0.4, c1: '#0284c7', c2: '#f0f9ff', titulo: 'BOLETOS' },
            { x: -45, z: -2, rotY: 1.35, c1: '#9333ea', c2: '#fef3c7', titulo: 'ALGODÓN' },
            { x: 45, z: -2, rotY: -1.35, c1: '#16a34a', c2: '#ecfccb', titulo: 'BEBIDAS' }
        ];

        const matMostrador = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55 });
        const matMadera = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });

        kioscos.forEach((k, idx) => {
            const g = new THREE.Group();
            g.position.set(k.x, 0, k.z);
            g.rotation.y = k.rotY;

            const mostrador = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.25, 2.4), matMostrador);
            mostrador.position.y = 0.625;
            mostrador.castShadow = true;
            mostrador.receiveShadow = true;
            g.add(mostrador);

            for (const sx of [-1.65, 1.65]) {
                for (const sz of [-0.95, 0.95]) {
                    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.1, 8), matMadera);
                    poste.position.set(sx, 2.25, sz);
                    g.add(poste);
                }
            }

            const toldo = new THREE.Mesh(
                new THREE.ConeGeometry(2.85, 1.35, 4),
                new THREE.MeshStandardMaterial({
                    map: obtenerTexturaCarpaParque(k.c1, k.c2),
                    roughness: 0.6
                })
            );
            toldo.rotation.y = Math.PI / 4;
            toldo.position.y = 3.75;
            toldo.castShadow = true;
            g.add(toldo);

            const texKiosco = obtenerTexturaLetreroNeon(k.titulo, k.c1, 'PARQUE ESTELAR');
            const letrero = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshBasicMaterial({ map: texKiosco }));
            letrero.position.set(0, 2.85, 1.25);
            g.add(letrero);

            this.grupoRaiz.add(g);
            this.registrarColisionadorCaja(k.x - 1.9, 0, k.z - 1.6, k.x + 1.9, 3.6, k.z + 1.6, `kiosco_${idx}`);
        });

        // Arboleda periférica estilizada alrededor de los bulevares y el cinturón verde
        const arboles = [
            { x: -38, z: 24, s: 1.2 },
            { x: -50, z: 16, s: 1.3 },
            { x: -52, z: -26, s: 1.25 },
            { x: -46, z: -46, s: 1.35 },
            { x: -24, z: -48, s: 1.15 },
            { x: 24, z: -48, s: 1.15 },
            { x: 46, z: -46, s: 1.35 },
            { x: 52, z: -24, s: 1.25 },
            { x: 50, z: 10, s: 1.2 },
            { x: -28, z: 44, s: 1.25 },
            { x: 18, z: 46, s: 1.15 },
            { x: -48, z: 42, s: 1.3 }
        ];
        const matTronco = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
        const tonosFollaje = [0x22c55e, 0x16a34a, 0x4ade80];

        arboles.forEach((a, idx) => {
            const grupoArbol = new THREE.Group();
            grupoArbol.position.set(a.x, 0, a.z);
            grupoArbol.scale.setScalar(a.s);

            const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 2.7, 8), matTronco);
            tronco.position.y = 1.35;
            tronco.castShadow = true;
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

            this.grupoRaiz.add(grupoArbol);
            const r = 0.5 * a.s;
            this.registrarColisionadorCaja(a.x - r, 0, a.z - r, a.x + r, 2.7 * a.s, a.z + r, `arbol_${idx}`);
        });

        // Farolas modernas en plaza y bulevar sur
        const farolas = [
            { x: -12, z: 22 },
            { x: 12, z: 22 },
            { x: -16, z: -4 },
            { x: 16, z: -4 },
            { x: -6, z: 38 },
            { x: 6, z: 38 }
        ];
        const matPoste = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.4 });
        const matFoco = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfbbf24,
            emissiveIntensity: 1.15
        });

        farolas.forEach((p, idx) => {
            const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 5.2, 8), matPoste);
            poste.position.set(p.x, 2.6, p.z);
            poste.castShadow = true;
            this.grupoRaiz.add(poste);

            const foco = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), matFoco);
            foco.position.set(p.x, 5.45, p.z);
            this.grupoRaiz.add(foco);
            this.registrarColisionadorCaja(p.x - 0.32, 0, p.z - 0.32, p.x + 0.32, 5.4, p.z + 0.32, `farola_${idx}`);
        });
    }

    /**
     * Construye la atracción Torre de Parkour en el cuadrante sureste con 8 plataformas ascendentes.
     */
    _construirTorreParkour() {
        const plataformas = [
            { x: 14, y: 1.1, z: 20, w: 3.4, h: 0.6, d: 3.4, color: 0x22d3ee },
            { x: 18.5, y: 2.2, z: 22.5, w: 3.2, h: 0.6, d: 3.2, color: 0x38bdf8 },
            { x: 23, y: 3.3, z: 25, w: 3.2, h: 0.6, d: 3.2, color: 0x818cf8 },
            { x: 27, y: 4.4, z: 22, w: 3.0, h: 0.6, d: 3.0, color: 0xa855f7 },
            { x: 29, y: 5.5, z: 17.5, w: 3.2, h: 0.6, d: 3.2, color: 0xec4899 },
            { x: 33.5, y: 6.6, z: 19, w: 3.2, h: 0.6, d: 3.2, color: 0xf97316 },
            { x: 32, y: 7.8, z: 24, w: 5.8, h: 0.8, d: 5.8, color: 0xfacc15 }
        ];

        for (let i = 0; i < plataformas.length; i++) {
            const p = plataformas[i];
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(p.w, p.h, p.d),
                new THREE.MeshStandardMaterial({
                    map: obtenerTexturaPlataforma(p.color),
                    roughness: 0.42,
                    metalness: 0.12
                })
            );
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
     * Crea partículas flotantes cálidas distribuidas sobre todo el parque.
     */
    _construirParticulasAmbiente() {
        const cantidad = 110;
        const posiciones = new Float32Array(cantidad * 3);
        for (let i = 0; i < cantidad; i++) {
            posiciones[i * 3] = (Math.random() - 0.5) * 108;
            posiciones[i * 3 + 1] = 1.2 + Math.random() * 11.5;
            posiciones[i * 3 + 2] = (Math.random() - 0.5) * 108;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xfef08a,
            size: 0.26,
            transparent: true,
            opacity: 0.72
        });
        this.particulasAmbiente = new THREE.Points(geo, mat);
        this.grupoRaiz.add(this.particulasAmbiente);
    }

    /**
     * Genera 14 monedas flotantes coleccionables en bulevares, plaza y torre parkour.
     */
    _construirMonedas() {
        const puntosMonedas = [
            { x: 0, y: 1.0, z: 34 },
            { x: -8, y: 1.0, z: 12 },
            { x: 8, y: 1.0, z: 12 },
            { x: -16, y: 1.0, z: -14 },
            { x: 0, y: 1.0, z: -22 },
            { x: 16, y: 1.0, z: -14 },
            { x: -24, y: 1.0, z: 4 },
            { x: 24, y: 1.0, z: 4 },
            { x: 0, y: 1.0, z: -43 },
            { x: 14, y: 2.1, z: 20 },
            { x: 23, y: 4.3, z: 25 },
            { x: 29, y: 6.5, z: 17.5 },
            { x: 33.5, y: 7.6, z: 19 },
            { x: 31.2, y: 8.8, z: 23.5 }
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
            const mesh = new THREE.Mesh(geoMoneda, matMoneda);
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
    }

    /**
     * Construye el Tótem de Fundadores en la plaza y el Cofre dorado de la Torre Parkour.
     */
    _construirEntidadesInteractivas() {
        const matTotem = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
        const pilar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.2), matTotem);
        pilar.position.set(-14, 1.0, 13);
        pilar.castShadow = true;
        this.grupoRaiz.add(pilar);
        this.registrarColisionadorCaja(-14.6, 0, 12.4, -13.4, 2.0, 13.6, 'totem_fundadores');

        const orbeMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.9
        });
        this.orbeTotem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), orbeMat);
        this.orbeTotem.position.set(-14, 2.65, 13);
        this.grupoRaiz.add(this.orbeTotem);

        this.registrarEntidadInteractiva({
            id: 'totem_fundadores',
            etiqueta: 'Tótem de Fundadores (Reclamar Visor)',
            posicion: { x: -14, y: 1.2, z: 13 },
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
        cofre.position.set(32.5, 8.3, 24.0);
        cofre.castShadow = true;
        this.grupoRaiz.add(cofre);

        this.registrarEntidadInteractiva({
            id: 'cofre_parkour',
            etiqueta: 'Cofre del Cielo (Recompensa Épica)',
            posicion: { x: 32.5, y: 8.3, z: 24.0 },
            radio: 3.2,
            autoRecoger: false,
            activa: true
        });
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
     * Actualiza la Rueda de la Fortuna (manteniendo góndolas verticales), fuente,
     * luces GP, cristal central, monedas y cúpula del cielo.
     * @param {number} dt
     * @param {object} _contextoSandbox
     */
    actualizar(dt, _contextoSandbox) {
        this.tiempoTotal += dt;

        if (this.ruedaFortuna) {
            this.ruedaFortuna.rotation.z += dt * 0.24;
            for (const gondola of this.gondolasRueda) {
                gondola.rotation.z = -this.ruedaFortuna.rotation.z;
            }
        }

        if (this.cristalCentral) {
            this.cristalCentral.rotation.y += dt * 1.2;
            this.cristalCentral.position.y = 3.65 + Math.sin(this.tiempoTotal * 2.2) * 0.24;
        }

        if (this.orbeTotem) {
            this.orbeTotem.rotation.y -= dt * 1.8;
            this.orbeTotem.position.y = 2.65 + Math.cos(this.tiempoTotal * 2.6) * 0.14;
        }

        for (const ch of this.chorrosAgua) {
            const escala = 0.72 + Math.sin(this.tiempoTotal * 4.5 + ch.fase) * 0.28;
            ch.mesh.scale.y = escala;
            ch.mesh.position.y = 0.65 + escala * 0.7;
        }

        for (const luz of this.lucesArcoGP) {
            const pulso = Math.sin(this.tiempoTotal * 4.2 + (luz.esVerde ? Math.PI : 0));
            luz.mat.emissiveIntensity = pulso > 0 ? 1.35 : 0.25;
        }

        if (this.particulasAmbiente) {
            this.particulasAmbiente.rotation.y += dt * 0.03;
            this.particulasAmbiente.position.y = Math.sin(this.tiempoTotal * 0.8) * 0.3;
        }

        if (this.cupulaCielo) {
            this.cupulaCielo.rotation.y += dt * 0.005;
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
     * Regla de cámara del Lobby Central: siempre se alinea suavemente detrás de la espalda
     * del jugador al desplazarse en cualquier dirección o soltar el arrastre manual.
     * @param {object} [contextoCamara]
     * @returns {object}
     */
    obtenerConfigCamara(contextoCamara = {}) {
        const dt = Math.min(contextoCamara.dt || 0.016, 0.05);
        const teclas = estadoControles.teclas;
        const joy = estadoControles.joystick;

        const retrocediendo =
            teclas.has('KeyS') ||
            teclas.has('ArrowDown') ||
            (joy.activo && joy.y < -0.25);

        if (!estadoControles.orbitaManualActiva && !estadoControles.pantallaBienvenidaActiva) {
            estadoControles.tiempoOrbitaManual = 0;
            const rotJugador = typeof estadoJugador.rotacionY === 'number'
                ? estadoJugador.rotacionY
                : estadoJugador.rotacion || 0;
            const yawObjetivo = rotJugador + Math.PI;
            let diff = yawObjetivo - estadoControles.anguloCamaraY;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const tasaAlineacion = retrocediendo ? 2.2 : 3.8;
            estadoControles.anguloCamaraY += diff * Math.min(1, dt * tasaAlineacion);
            estadoControles.anguloCamaraPitch += (0.34 - estadoControles.anguloCamaraPitch) * Math.min(1, dt * 2.2);
        }

        const dist = CONFIG_CAMARA.distancia * 0.94;
        const pitch = estadoControles.anguloCamaraPitch;
        const yaw = estadoControles.anguloCamaraY;
        const distHoriz = Math.cos(pitch) * dist;
        const offsetY = Math.sin(pitch) * dist;

        const targetX = estadoJugador.posicion.x;
        const targetY = estadoJugador.posicion.y + 1.72;
        const targetZ = estadoJugador.posicion.z;

        return {
            modo: 'tercera_persona_seguimiento',
            posicionObjetivo: {
                x: targetX + Math.sin(yaw) * distHoriz,
                y: targetY + offsetY,
                z: targetZ + Math.cos(yaw) * distHoriz
            },
            puntoMira: { x: targetX, y: targetY, z: targetZ },
            suavizado: 14,
            fov: CONFIG_CAMARA.fov
        };
    }

    /**
     * Limpia toda la geometría, materiales y letreros temporales del Parque Estelar.
     * @param {THREE.Scene} escena
     */
    desmontar(escena) {
        liberarObjeto3D(this.grupoRaiz);
        this.monedas = [];
        this.cristalCentral = null;
        this.orbeTotem = null;
        this.particulasAmbiente = null;
        this.cupulaCielo = null;
        this.ruedaFortuna = null;
        this.gondolasRueda = [];
        this.lucesArcoGP = [];
        this.chorrosAgua = [];
        super.desmontar(escena);
    }
}
