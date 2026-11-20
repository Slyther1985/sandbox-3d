/**
 * Experiencia heredada `SalaTetris`: Salón Arcade 3D de 44x44 m con 8 estaciones individuales
 * equipadas con TV Gigante 3D de bloques voxel (pool sin asignaciones por frame), pieza fantasma 3D,
 * explosiones de partículas al completar líneas, monolito Top-5 y HUD flotante transparente.
 */
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
    reproducirSonido
} from '../recursos.js';
import { ExperienciaBase } from '../nucleoSandbox.js';
import { enviarEstadoJugadorInmediato, enviarEventoExperiencia } from '../red.js';

export const TOTAL_ASIENTOS_TETRIS = 8;
export const COLUMNAS_TETRIS = 10;
export const FILAS_VISIBLES_TETRIS = 20;
export const FILAS_OCULTAS_TETRIS = 2;
export const FILAS_TOTALES_TETRIS = FILAS_VISIBLES_TETRIS + FILAS_OCULTAS_TETRIS;

export const PUNTAJES_LINEAS_TETRIS = Object.freeze({
    1: 100,
    2: 300,
    3: 500,
    4: 1200
});

const PASO_CELDA_3D = 0.28;
const CENTRO_Y_TABLERO_3D = 3.55;

const PIEZAS_TETRIS = Object.freeze({
    I: {
        color: '#22d3ee',
        borde: '#a5f3fc',
        matriz: [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ]
    },
    O: {
        color: '#facc15',
        borde: '#fef08a',
        matriz: [
            [1, 1],
            [1, 1]
        ]
    },
    T: {
        color: '#c084fc',
        borde: '#e9d5ff',
        matriz: [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]
        ]
    },
    S: {
        color: '#4ade80',
        borde: '#bbf7d0',
        matriz: [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]
        ]
    },
    Z: {
        color: '#fb7185',
        borde: '#fecdd3',
        matriz: [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]
        ]
    },
    J: {
        color: '#3b82f6',
        borde: '#bfdbfe',
        matriz: [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0]
        ]
    },
    L: {
        color: '#fb923c',
        borde: '#fed7aa',
        matriz: [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0]
        ]
    }
});

const TIPOS_PIEZAS = Object.keys(PIEZAS_TETRIS);
const INDICES_COLOR = Object.fromEntries(TIPOS_PIEZAS.map((k, idx) => [k, idx + 1]));

export class SalaTetris extends ExperienciaBase {
    constructor() {
        super({
            id: 'tetris',
            nombre: 'Sala de Tetris Arcade',
            descripcion: '8 estaciones individuales con TV Gigante 3D, bloques voxel reales y puntaje no lineal.',
            colorPortal: 0xa855f7,
            posicionPortal: { x: 16, y: 0, z: -22 },
            minJugadores: 1,
            spawnJugador: { x: 0, y: 0.1, z: 13.5 }
        });

        this.contextoActual = null;
        this.cupulaCielo = null;
        this.asientosTetris = [];
        this.snapshotsRemotos = new Map();
        this.rankingSala = new Map();

        this.geoBloque3D = null;
        this.geoFantasma3D = null;
        this.materialesBloques3D = [];

        this.canvasRecords3D = null;
        this.ctxRecords3D = null;
        this.texRecords3D = null;

        this.tiempoTotal = 0;
        this.acumuladorSnapshotRed = 0;
        this.tetrominosDecorativos = [];
        this.particulasLineas = [];

        this.partida = this._crearEstadoPartidaVacio();
    }

    _crearEstadoPartidaVacio() {
        return {
            activa: false,
            gameOver: false,
            recompensaEntregada: false,
            tablero: Array.from({ length: FILAS_TOTALES_TETRIS }, () => Array(COLUMNAS_TETRIS).fill(0)),
            bolsa: [],
            colaSiguientes: [],
            holdTipo: null,
            puedeHold: true,
            piezaActual: null,
            puntaje: 0,
            lineas: 0,
            nivel: 1,
            combo: -1,
            acumuladorCaida: 0,
            flashTetris: 0,
            mensajeFlash: ''
        };
    }

    /**
     * Crea textura temporal `<canvas>` marcada con `esClonTemporal = true` para limpieza GPU.
     */
    _crearTexturaTemporalCanvas(ancho, alto, dibujar) {
        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        dibujar(ctx, ancho, alto);
        const tex = new THREE.CanvasTexture(canvas);
        tex.userData = { esClonTemporal: true };
        return { canvas, ctx, tex };
    }

    /**
     * Monta el Salón Arcade 3D de 44x44 m, las 8 estaciones individuales con TV 3D y el monolito Top-5.
     */
    montar(escena, contextoSandbox) {
        super.montar(escena, contextoSandbox);
        this.contextoActual = contextoSandbox;
        this.tiempoTotal = 0;
        this.acumuladorSnapshotRed = 0;
        this.asientosTetris = [];
        this.tetrominosDecorativos = [];
        this.particulasLineas = [];
        this.snapshotsRemotos.clear();
        this.rankingSala.clear();
        this.partida = this._crearEstadoPartidaVacio();

        estadoControles.modoTetrisActivo = false;
        estadoControles.asientoTetrisActual = -1;

        if (estadoJugador.mejorPuntajeTetris > 0) {
            this.rankingSala.set(estadoJugador.apodo, estadoJugador.mejorPuntajeTetris);
        }

        // Recursos 3D compartidos para el pool de 1600 bloques (cero asignaciones por frame)
        this.geoBloque3D = new THREE.BoxGeometry(0.255, 0.255, 0.24);
        this.geoFantasma3D = new THREE.BoxGeometry(0.26, 0.26, 0.25);
        this.materialesBloques3D = [
            null,
            ...TIPOS_PIEZAS.map(
                (k) =>
                    new THREE.MeshPhysicalMaterial({
                        color: PIEZAS_TETRIS[k].color,
                        emissive: PIEZAS_TETRIS[k].color,
                        emissiveIntensity: 0.3,
                        roughness: 0.22,
                        metalness: 0.15,
                        clearcoat: 0.65
                    })
            )
        ];

        this.cupulaCielo = crearCupulaCielo('tetris_arcade');
        this.grupoRaiz.add(this.cupulaCielo);
        if (escena) {
            escena.background = new THREE.Color(0x090418);
            escena.fog = new THREE.FogExp2(0x1e1b4b, 0.0068);
        }

        this._construirCineArcade();
        this._construirTableroRecords3D();
        this._construirEstacionesArcade3D();
        this._construirPortalRetorno();

        this._redibujarCartelRecords3D();
        enviarEstadoJugadorInmediato();
    }

    /**
     * Construye el piso neón de 44x44 m, colisionadores sólidos, luces y esculturas Tetrominó.
     */
    _construirCineArcade() {
        const { tex: texPiso } = this._crearTexturaTemporalCanvas(512, 512, (ctx) => {
            ctx.fillStyle = '#0b0818';
            ctx.fillRect(0, 0, 512, 512);
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.36)';
            ctx.lineWidth = 3;
            for (let i = 0; i <= 512; i += 64) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 512);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(512, i);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
            ctx.lineWidth = 2;
            ctx.strokeRect(16, 16, 480, 480);
        });
        texPiso.wrapS = THREE.RepeatWrapping;
        texPiso.wrapT = THREE.RepeatWrapping;
        texPiso.repeat.set(8, 8);

        const suelo = new THREE.Mesh(
            new THREE.PlaneGeometry(44, 44),
            new THREE.MeshStandardMaterial({
                map: texPiso,
                roughness: 0.42,
                metalness: 0.22
            })
        );
        suelo.rotation.x = -Math.PI / 2;
        suelo.receiveShadow = true;
        this.grupoRaiz.add(suelo);

        // Colisionador sólido AABB de piso (superficie superior en y = 0)
        this.registrarColisionadorCaja(-22, -2, -22, 22, 0, 22, 'suelo_cine_tetris');

        // Paseo central iluminado entre las alas Oeste y Este
        const alfombra = new THREE.Mesh(
            new THREE.PlaneGeometry(14.5, 34.0),
            new THREE.MeshStandardMaterial({
                color: 0x26103a,
                roughness: 0.85
            })
        );
        alfombra.rotation.x = -Math.PI / 2;
        alfombra.position.set(0, 0.015, 0);
        alfombra.receiveShadow = true;
        this.grupoRaiz.add(alfombra);

        // Muros perimetrales con franjas neón y colisionadores AABB
        const matMuro = new THREE.MeshStandardMaterial({ color: 0x15112b, roughness: 0.5 });
        const matNeonCian = new THREE.MeshStandardMaterial({
            color: 0x22d3ee,
            emissive: 0x22d3ee,
            emissiveIntensity: 0.9
        });
        const matNeonMagenta = new THREE.MeshStandardMaterial({
            color: 0xe879f9,
            emissive: 0xe879f9,
            emissiveIntensity: 0.85
        });

        const limites = [
            { x: 0, z: -22, w: 44, d: 0.9 },
            { x: 0, z: 22, w: 44, d: 0.9 },
            { x: -22, z: 0, w: 0.9, d: 44 },
            { x: 22, z: 0, w: 0.9, d: 44 }
        ];
        limites.forEach((b, idx) => {
            const muro = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1.5, b.d), matMuro.clone());
            muro.position.set(b.x, 0.75, b.z);
            this.grupoRaiz.add(muro);

            const franja = new THREE.Mesh(
                new THREE.BoxGeometry(b.w > 1 ? b.w : 1.0, 0.16, b.d > 1 ? b.d : 1.0),
                (idx % 2 === 0 ? matNeonCian : matNeonMagenta).clone()
            );
            franja.position.set(b.x, 1.55, b.z);
            this.grupoRaiz.add(franja);

            this.registrarColisionadorCaja(
                b.x - b.w / 2,
                0,
                b.z - b.d / 2,
                b.x + b.w / 2,
                2.5,
                b.z + b.d / 2,
                `muro_tetris_${idx}`
            );
        });
        matMuro.dispose();
        matNeonCian.dispose();
        matNeonMagenta.dispose();

        const luzCian = new THREE.PointLight(0x22d3ee, 1.15, 36);
        luzCian.position.set(-8, 9, 0);
        const luzMagenta = new THREE.PointLight(0xe879f9, 1.15, 36);
        luzMagenta.position.set(8, 9, 0);
        this.grupoRaiz.add(luzCian, luzMagenta);

        // Esculturas Tetrominó decorativas en esquinas del paseo central
        const coordsEsc = [
            { tipo: 'T', x: -5.2, z: -16.2 },
            { tipo: 'L', x: 5.2, z: -16.2 },
            { tipo: 'I', x: -6.8, z: 16.0 },
            { tipo: 'S', x: 6.8, z: 16.0 }
        ];
        coordsEsc.forEach((item, idx) => {
            const def = PIEZAS_TETRIS[item.tipo];
            const grupoEsc = new THREE.Group();
            grupoEsc.position.set(item.x, 2.4 + (idx % 2) * 0.4, item.z);
            const matCubo = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 0.45,
                roughness: 0.25
            });
            def.matriz.forEach((fila, fy) => {
                fila.forEach((celda, fx) => {
                    if (!celda) return;
                    const cubo = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), matCubo.clone());
                    cubo.position.set((fx - 1) * 0.66, (1 - fy) * 0.66, 0);
                    cubo.castShadow = true;
                    grupoEsc.add(cubo);
                });
            });
            matCubo.dispose();
            this.grupoRaiz.add(grupoEsc);
            this.tetrominosDecorativos.push(grupoEsc);
        });
    }

    /**
     * Construye el Monolito 3D central de Mejores Puntajes de la sala (Top 5).
     */
    _construirTableroRecords3D() {
        const { canvas, ctx, tex } = this._crearTexturaTemporalCanvas(512, 512, () => {});
        this.canvasRecords3D = canvas;
        this.ctxRecords3D = ctx;
        this.texRecords3D = tex;

        const soporte = new THREE.Mesh(
            new THREE.BoxGeometry(5.2, 5.2, 0.36),
            new THREE.MeshStandardMaterial({ color: 0x1e1b4b, metalness: 0.5, roughness: 0.38 })
        );
        soporte.position.set(0, 3.2, -16.5);
        soporte.castShadow = true;
        this.grupoRaiz.add(soporte);

        const cara = new THREE.Mesh(
            new THREE.PlaneGeometry(4.8, 4.8),
            new THREE.MeshBasicMaterial({ map: this.texRecords3D })
        );
        cara.position.set(0, 3.2, -16.3);
        this.grupoRaiz.add(cara);
    }

    /**
     * Construye las 8 estaciones individuales de TV Gigante 3D con bloques voxel reales y butacas.
     */
    _construirEstacionesArcade3D() {
        const { tex: texGrilla } = this._crearTexturaTemporalCanvas(512, 1024, (ctx) => {
            ctx.fillStyle = '#060312';
            ctx.fillRect(0, 0, 512, 1024);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
            ctx.lineWidth = 2;
            const cw = 512 / COLUMNAS_TETRIS;
            const ch = 1024 / FILAS_VISIBLES_TETRIS;
            for (let c = 0; c <= COLUMNAS_TETRIS; c++) {
                ctx.beginPath();
                ctx.moveTo(c * cw, 0);
                ctx.lineTo(c * cw, 1024);
                ctx.stroke();
            }
            for (let r = 0; r <= FILAS_VISIBLES_TETRIS; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * ch);
                ctx.lineTo(512, r * ch);
                ctx.stroke();
            }
        });

        const filasZ = [-12.6, -4.2, 4.2, 12.6];
        const matCuero = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.55 });
        const matCojin = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.65 });
        const matBaseMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.3 });
        const matGabinete = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.32 });
        const matFondoTV = new THREE.MeshBasicMaterial({ map: texGrilla });

        for (let idx = 0; idx < TOTAL_ASIENTOS_TETRIS; idx++) {
            const esEste = idx >= 4;
            const posZ = filasZ[idx % 4];
            const tvX = esEste ? 18.6 : -18.6;
            const sillaX = esEste ? 12.7 : -12.7;
            const rotMirarTV = esEste ? Math.PI / 2 : -Math.PI / 2;
            const rotTV = esEste ? -Math.PI / 2 : Math.PI / 2;
            const tvHaciaSillaX = esEste ? -1 : 1;

            // --- 1. Butaca Ergonómica orientada exactamente hacia su TV (+Z local = mirar TV) ---
            const grupoAsiento = new THREE.Group();
            grupoAsiento.position.set(sillaX, 0, posZ);
            grupoAsiento.rotation.y = rotMirarTV;

            const matAro = new THREE.MeshStandardMaterial({
                color: 0x22d3ee,
                emissive: 0x22d3ee,
                emissiveIntensity: 0.95
            });
            const aroLed = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.05, 24), matAro);
            aroLed.rotation.x = -Math.PI / 2;
            aroLed.position.y = 0.03;

            const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.34, 14), matBaseMetal.clone());
            pedestal.position.y = 0.17;
            pedestal.castShadow = true;

            const cojin = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 1.08), matCojin.clone());
            cojin.position.set(0, 0.44, 0);
            cojin.castShadow = true;

            const respaldo = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.18, 0.24), matCuero.clone());
            respaldo.position.set(0, 1.06, -0.44);
            respaldo.rotation.x = -0.1;
            respaldo.castShadow = true;

            const cabecero = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.32, 0.2), matCojin.clone());
            cabecero.position.set(0, 1.72, -0.5);

            const brazoIzq = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.96), matCuero.clone());
            brazoIzq.position.set(-0.62, 0.66, -0.02);
            const brazoDer = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.96), matCuero.clone());
            brazoDer.position.set(0.62, 0.66, -0.02);

            const { tex: texNum } = this._crearTexturaTemporalCanvas(96, 96, (ctx) => {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(4, 4, 88, 88);
                ctx.strokeStyle = '#22d3ee';
                ctx.lineWidth = 6;
                ctx.strokeRect(4, 4, 88, 88);
                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 54px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(idx + 1), 48, 50);
            });
            const placaNum = new THREE.Mesh(
                new THREE.PlaneGeometry(0.5, 0.5),
                new THREE.MeshBasicMaterial({ map: texNum })
            );
            placaNum.rotation.y = Math.PI;
            placaNum.position.set(0, 1.2, -0.58);

            grupoAsiento.add(aroLed, pedestal, cojin, respaldo, cabecero, brazoIzq, brazoDer, placaNum);
            this.grupoRaiz.add(grupoAsiento);

            // --- 2. TV Gigante 3D Individual con Pool de 200 Cubos Voxel y Fantasma 3D ---
            const grupoTV = new THREE.Group();
            grupoTV.position.set(tvX, 0, posZ);
            grupoTV.rotation.y = rotTV;

            const gabinete = new THREE.Mesh(new THREE.BoxGeometry(3.75, 7.1, 0.56), matGabinete.clone());
            gabinete.position.set(0, 3.65, -0.08);
            gabinete.castShadow = true;

            const matBisel = new THREE.MeshStandardMaterial({
                color: 0x22d3ee,
                emissive: 0x22d3ee,
                emissiveIntensity: 0.85
            });
            const bisel = new THREE.Mesh(new THREE.BoxGeometry(3.92, 7.26, 0.24), matBisel);
            bisel.position.set(0, 3.65, -0.18);

            const baseTV = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.4, 1.1), matGabinete.clone());
            baseTV.position.set(0, 0.2, 0.05);

            const fondoGrilla = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.6), matFondoTV.clone());
            fondoGrilla.position.set(0, CENTRO_Y_TABLERO_3D, 0.21);

            const { canvas: canvasHdr, ctx: ctxHdr, tex: texHdr } = this._crearTexturaTemporalCanvas(512, 64, () => {});
            const marquesina = new THREE.Mesh(
                new THREE.PlaneGeometry(3.2, 0.44),
                new THREE.MeshBasicMaterial({ map: texHdr })
            );
            marquesina.position.set(0, 6.72, 0.22);

            grupoTV.add(bisel, gabinete, baseTV, fondoGrilla, marquesina);

            // Pool preasignado de 10x20 cubos 3D (cero allocations por frame)
            const celdas3D = [];
            for (let r = 0; r < FILAS_VISIBLES_TETRIS; r++) {
                const filaMeshes = [];
                const ry = CENTRO_Y_TABLERO_3D + (9.5 - r) * PASO_CELDA_3D;
                for (let c = 0; c < COLUMNAS_TETRIS; c++) {
                    const cx = (c - 4.5) * PASO_CELDA_3D;
                    const bloque = new THREE.Mesh(this.geoBloque3D, this.materialesBloques3D[1]);
                    bloque.position.set(cx, ry, 0.34);
                    bloque.visible = false;
                    grupoTV.add(bloque);
                    filaMeshes.push(bloque);
                }
                celdas3D.push(filaMeshes);
            }

            // Pool de 4 cubos 3D translúcidos para la Pieza Fantasma
            const matFantasma = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.72
            });
            const fantasmas3D = [];
            for (let f = 0; f < 4; f++) {
                const cuboF = new THREE.Mesh(this.geoFantasma3D, matFantasma);
                cuboF.visible = false;
                grupoTV.add(cuboF);
                fantasmas3D.push(cuboF);
            }

            this.grupoRaiz.add(grupoTV);

            const entidad = this.registrarEntidadInteractiva({
                id: `asiento_tetris_${idx}`,
                etiqueta: `Butaca ${idx + 1} · Jugar Tetris 3D`,
                posicion: { x: sillaX, y: 0.5, z: posZ },
                radio: 2.35,
                autoRecoger: false,
                activa: true
            });

            const screenWorldX = tvX + tvHaciaSillaX * 0.34;
            const camX = sillaX - tvHaciaSillaX * 0.3;

            const estacion = {
                indice: idx,
                posicion: { x: sillaX, y: 0.52, z: posZ },
                rotMirarTV,
                tvHaciaSillaX,
                screenWorldX,
                camaraPos: { x: camX, y: CENTRO_Y_TABLERO_3D, z: posZ },
                camaraLook: { x: screenWorldX, y: CENTRO_Y_TABLERO_3D, z: posZ },
                ocupado: false,
                ocupanteId: null,
                ocupanteApodo: '',
                matAro,
                matBisel,
                celdas3D,
                fantasmas3D,
                matFantasma,
                canvasHdr,
                ctxHdr,
                texHdr,
                ultimaFirmaHeader: '',
                entidad
            };

            this.asientosTetris.push(estacion);
            this._actualizarHeaderEstacion(estacion, 0, 1);
        }

        matCuero.dispose();
        matCojin.dispose();
        matBaseMetal.dispose();
        matGabinete.dispose();
        matFondoTV.dispose();
    }

    /**
     * Devuelve el encuadre directo en primera persona frente a la TV Gigante 3D activa.
     * @returns {{ posicion: {x:number,y:number,z:number}, objetivo: {x:number,y:number,z:number} }|null}
     */
    obtenerEncuadreCamaraTetris3D() {
        const idx = estadoControles.asientoTetrisActual;
        const estacion = this.asientosTetris[idx];
        if (!estadoControles.modoTetrisActivo || !estacion) return null;
        return {
            posicion: estacion.camaraPos,
            objetivo: estacion.camaraLook
        };
    }

    /**
     * Portal físico 3D de regreso al Lobby Central.
     */
    _construirPortalRetorno() {
        this.crearPortalFisico3D({
            idDestino: 'lobby',
            nombre: 'Lobby Central',
            subtitulo: 'Salir de la Sala Tetris',
            color: 0x38bdf8,
            posicion: { x: 0, y: 0, z: 18.5 },
            rotacionY: Math.PI
        });
    }

    /**
     * Actualiza marquesina superior de una TV 3D solo cuando cambia su estado o puntuación.
     */
    _actualizarHeaderEstacion(estacion, puntaje = 0, nivel = 1) {
        if (!estacion?.ctxHdr || !estacion?.texHdr) return;
        const firma = `${estacion.ocupado}|${estacion.ocupanteApodo}|${puntaje}|${nivel}`;
        if (firma === estacion.ultimaFirmaHeader) return;
        estacion.ultimaFirmaHeader = firma;

        const ctx = estacion.ctxHdr;
        ctx.fillStyle = '#090418';
        ctx.fillRect(0, 0, 512, 64);
        ctx.strokeStyle = estacion.ocupado ? '#f59e0b' : '#22d3ee';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 504, 56);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillStyle = estacion.ocupado ? '#fde047' : '#22d3ee';
        const texto = estacion.ocupado
            ? `#${estacion.indice + 1} ${estacion.ocupanteApodo.slice(0, 12)} · ${puntaje} pts · Nv${nivel}`
            : `ESTACIÓN #${estacion.indice + 1} · LIBRE [Pulsa E]`;
        ctx.fillText(texto, 256, 33);
        estacion.texHdr.needsUpdate = true;
    }

    /**
     * Actualiza aro LED, bisel neón, marquesina y limpia bloques si la estación quedó libre.
     */
    _actualizarVisualAsiento(asiento) {
        if (!asiento) return;
        const colorHex = asiento.ocupado ? 0xf59e0b : 0x22d3ee;
        asiento.matAro.color.setHex(colorHex);
        asiento.matAro.emissive.setHex(colorHex);
        if (asiento.matBisel) {
            asiento.matBisel.color.setHex(colorHex);
            asiento.matBisel.emissive.setHex(colorHex);
        }
        if (asiento.entidad) {
            asiento.entidad.etiqueta = asiento.ocupado
                ? `Butaca ${asiento.indice + 1} (Ocupada: ${asiento.ocupanteApodo})`
                : `Butaca ${asiento.indice + 1} · Jugar Tetris 3D`;
        }
        if (!asiento.ocupado) {
            this._limpiarTablero3DEstacion(asiento);
            this._actualizarHeaderEstacion(asiento, 0, 1);
        }
    }

    _limpiarTablero3DEstacion(estacion) {
        if (!estacion) return;
        for (let r = 0; r < FILAS_VISIBLES_TETRIS; r++) {
            for (let c = 0; c < COLUMNAS_TETRIS; c++) {
                estacion.celdas3D[r][c].visible = false;
            }
        }
        for (const f of estacion.fantasmas3D) {
            f.visible = false;
        }
    }

    /**
     * Actualiza las 200 mallas 3D (y 4 cubos fantasma) de una TV Gigante 3D sin crear geometrías nuevas.
     */
    _actualizarTablero3DEstacion(idx) {
        const estacion = this.asientosTetris[idx];
        if (!estacion) return;

        const esLocal = estadoControles.modoTetrisActivo && estadoControles.asientoTetrisActual === idx;
        let grid = null;
        let puntaje = 0;
        let nivel = 1;

        if (esLocal) {
            grid = this._generarGrillaConPiezaActual();
            puntaje = this.partida.puntaje;
            nivel = this.partida.nivel;
        } else if (estacion.ocupado && this.snapshotsRemotos.has(idx)) {
            const snap = this.snapshotsRemotos.get(idx);
            grid = snap.grid;
            puntaje = snap.puntaje || 0;
            nivel = snap.nivel || 1;
        }

        if (!Array.isArray(grid)) {
            this._limpiarTablero3DEstacion(estacion);
            this._actualizarHeaderEstacion(estacion, puntaje, nivel);
            return;
        }

        for (let r = 0; r < FILAS_VISIBLES_TETRIS; r++) {
            const filaDatos = grid[r + FILAS_OCULTAS_TETRIS] || grid[r];
            for (let c = 0; c < COLUMNAS_TETRIS; c++) {
                const val = filaDatos ? filaDatos[c] : 0;
                const mesh = estacion.celdas3D[r][c];
                if (val > 0 && this.materialesBloques3D[val]) {
                    mesh.material = this.materialesBloques3D[val];
                    mesh.visible = true;
                } else {
                    mesh.visible = false;
                }
            }
        }

        // Actualizar 4 cubos wireframe de la pieza fantasma 3D para la estación activa
        let ghostIdx = 0;
        if (esLocal && this.partida.piezaActual && !this.partida.gameOver) {
            const p = this.partida.piezaActual;
            const ghostY = this._obtenerFilaFantasma();
            estacion.matFantasma.color.set(PIEZAS_TETRIS[p.tipo].color);
            for (let r = 0; r < p.matriz.length; r++) {
                for (let c = 0; c < p.matriz[r].length; c++) {
                    if (!p.matriz[r][c] || ghostIdx >= 4) continue;
                    const rVis = ghostY + r - FILAS_OCULTAS_TETRIS;
                    const col = p.x + c;
                    if (rVis >= 0 && rVis < FILAS_VISIBLES_TETRIS && col >= 0 && col < COLUMNAS_TETRIS) {
                        const cuboF = estacion.fantasmas3D[ghostIdx++];
                        cuboF.position.set(
                            (col - 4.5) * PASO_CELDA_3D,
                            CENTRO_Y_TABLERO_3D + (9.5 - rVis) * PASO_CELDA_3D,
                            0.34
                        );
                        cuboF.visible = true;
                    }
                }
            }
        }
        while (ghostIdx < 4) {
            estacion.fantasmas3D[ghostIdx++].visible = false;
        }

        this._actualizarHeaderEstacion(estacion, puntaje, nivel);
    }

    /**
     * Emite una explosión de partículas neón 3D frente a la TV Gigante al limpiar líneas.
     * @param {number[]} filasLimpiadas Filas visibles (0..19) despejadas
     */
    _emitirParticulasLinea3D(filasLimpiadas = []) {
        const idx = estadoControles.asientoTetrisActual;
        const estacion = this.asientosTetris[idx];
        if (!estacion || filasLimpiadas.length === 0) return;

        const esCuadruple = filasLimpiadas.length >= 4;
        const cantidad = Math.min(48, filasLimpiadas.length * 12);
        const posiciones = new Float32Array(cantidad * 3);
        const velocidades = [];

        for (let i = 0; i < cantidad; i++) {
            const rVis = filasLimpiadas[i % filasLimpiadas.length];
            const py = CENTRO_Y_TABLERO_3D + (9.5 - rVis) * PASO_CELDA_3D;
            const pz = estacion.posicion.z + (Math.random() - 0.5) * 2.6;
            const px = estacion.screenWorldX + estacion.tvHaciaSillaX * 0.22;

            posiciones[i * 3] = px;
            posiciones[i * 3 + 1] = py;
            posiciones[i * 3 + 2] = pz;

            velocidades.push({
                x: estacion.tvHaciaSillaX * (2.4 + Math.random() * 3.8),
                y: 1.5 + Math.random() * 3.5,
                z: (Math.random() - 0.5) * 3.6
            });
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const mat = new THREE.PointsMaterial({
            color: esCuadruple ? 0xfacc15 : 0x22d3ee,
            size: esCuadruple ? 0.34 : 0.24,
            transparent: true,
            opacity: 0.96,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const puntos = new THREE.Points(geo, mat);
        puntos.userData = { esClonTemporal: true };
        this.grupoRaiz.add(puntos);

        this.particulasLineas.push({
            puntos,
            velocidades,
            vida: 0.72,
            duracionMax: 0.72
        });
    }

    /**
     * Redibuja el Top 5 de récords de sala en el Monolito 3D central.
     */
    _redibujarCartelRecords3D() {
        const ctx = this.ctxRecords3D;
        const tex = this.texRecords3D;
        if (!ctx || !tex) return;

        ctx.fillStyle = '#090418';
        ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, 492, 492);

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 34px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏆 RÉCORDS DE SALA', 256, 62);

        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText('TETRIS 4 LÍNEAS = 1200 × NIVEL', 256, 108);

        const top5 = this.obtenerRankingSala(5);
        if (top5.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '24px system-ui, sans-serif';
            ctx.fillText('Sin puntajes registrados aún', 256, 260);
        } else {
            top5.forEach(([apodo, pts], idx) => {
                const y = 175 + idx * 62;
                ctx.fillStyle = idx === 0 ? 'rgba(250, 204, 21, 0.16)' : 'rgba(56, 189, 248, 0.12)';
                ctx.fillRect(36, y - 24, 440, 48);
                ctx.fillStyle = idx === 0 ? '#fde047' : '#f8fafc';
                ctx.font = 'bold 24px system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`${idx + 1}. ${apodo.slice(0, 14)}`, 54, y);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#22d3ee';
                ctx.fillText(`${pts} pts`, 458, y);
            });
        }

        tex.needsUpdate = true;
    }

    /**
     * Devuelve el Top N de récords de Tetris de la sala.
     * @param {number} [limite]
     * @returns {Array<[string, number]>}
     */
    obtenerRankingSala(limite = 5) {
        return Array.from(this.rankingSala.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limite);
    }

    /**
     * Maneja interacción al pulsar `KeyE` o botón móvil de acción sobre una butaca.
     */
    alInteractuar(_jugador, entidad) {
        if (!entidad || !entidad.id?.startsWith('asiento_tetris_')) return;
        const idx = Number(entidad.id.replace('asiento_tetris_', ''));
        const asiento = this.asientosTetris[idx];
        if (!asiento) return;

        if (asiento.ocupado && asiento.ocupanteId !== estadoJugador.id) {
            reproducirSonido('interaccion');
            notificarEstado('aviso', {
                mensaje: `Butaca ${idx + 1} ocupada por ${asiento.ocupanteApodo}. Elige otra estación cian libre.`
            });
            return;
        }

        this.sentarseEnAsiento(idx);
    }

    /**
     * Sienta al jugador local frente a la TV Gigante 3D de la estación e inicia partida 3D.
     * @param {number} idx
     */
    sentarseEnAsiento(idx) {
        const asiento = this.asientosTetris[idx];
        if (!asiento) return;

        if (estadoControles.asientoTetrisActual >= 0 && estadoControles.asientoTetrisActual !== idx) {
            this._liberarAsientoLocalRed(estadoControles.asientoTetrisActual);
        }

        asiento.ocupado = true;
        asiento.ocupanteId = estadoJugador.id;
        asiento.ocupanteApodo = estadoJugador.apodo;
        this._actualizarVisualAsiento(asiento);

        estadoControles.modoTetrisActivo = true;
        estadoControles.asientoTetrisActual = idx;
        estadoControles.animacionActual = 'sentarse';
        estadoJugador.posicion.x = asiento.posicion.x;
        estadoJugador.posicion.y = 0;
        estadoJugador.posicion.z = asiento.posicion.z;
        estadoJugador.rotacion = asiento.rotMirarTV;

        if (this.contextoActual?.avatarLocal) {
            this.contextoActual.avatarLocal.position.set(asiento.posicion.x, 0, asiento.posicion.z);
            this.contextoActual.avatarLocal.rotation.y = asiento.rotMirarTV;
        }

        enviarEstadoJugadorInmediato();
        enviarEventoExperiencia('asiento_tetris', {
            accion: 'asiento_tetris',
            asiento: idx,
            ocupado: true,
            jugadorId: estadoJugador.id,
            apodo: estadoJugador.apodo
        });

        this._iniciarNuevaPartidaTetris();
        reproducirSonido('interaccion');
        notificarEstado('tetris_cambio', { activo: true, asiento: idx });
    }

    _liberarAsientoLocalRed(idx) {
        const asiento = this.asientosTetris[idx];
        if (asiento && asiento.ocupanteId === estadoJugador.id) {
            asiento.ocupado = false;
            asiento.ocupanteId = null;
            asiento.ocupanteApodo = '';
            this._actualizarVisualAsiento(asiento);
        }
        this.snapshotsRemotos.delete(idx);
        enviarEventoExperiencia('asiento_tetris', {
            accion: 'asiento_tetris',
            asiento: idx,
            ocupado: false,
            jugadorId: estadoJugador.id
        });
    }

    /**
     * Levanta al jugador de su estación, guarda/recompensa su puntaje y vuelve a tercera persona.
     */
    levantarseAsientoTetris() {
        if (!estadoControles.modoTetrisActivo) return;

        this._finalizarYRecompensarPartida();

        const idx = estadoControles.asientoTetrisActual;
        const asiento = this.asientosTetris[idx];
        if (idx >= 0) {
            this._liberarAsientoLocalRed(idx);
        }

        estadoControles.modoTetrisActivo = false;
        estadoControles.asientoTetrisActual = -1;
        estadoControles.animacionActual = 'idle';

        if (asiento) {
            estadoJugador.posicion.x = asiento.posicion.x + asiento.tvHaciaSillaX * 1.65;
            if (this.contextoActual?.avatarLocal) {
                this.contextoActual.avatarLocal.position.x = estadoJugador.posicion.x;
            }
        }

        enviarEstadoJugadorInmediato();
        reproducirSonido('interaccion');
        notificarEstado('tetris_cambio', { activo: false, asiento: -1 });
    }

    /**
     * Reinicia el tablero 10x20 y arranca una nueva partida independiente en 3D.
     */
    _iniciarNuevaPartidaTetris() {
        this.partida = this._crearEstadoPartidaVacio();
        this.partida.activa = true;
        this._llenarColaSiguientes();
        this._sacarSiguientePieza();
        if (estadoControles.asientoTetrisActual >= 0) {
            this._actualizarTablero3DEstacion(estadoControles.asientoTetrisActual);
        }
        this._emitirSnapshotTablero(true);
        notificarEstado('tetris_cambio', { actualizado: true });
    }

    /**
     * Generador oficial 7-Bag: baraja los 7 tetrominós antes de repetir cualquiera.
     */
    _siguienteTipoDeBolsa() {
        if (this.partida.bolsa.length === 0) {
            const bolsa = [...TIPOS_PIEZAS];
            for (let i = bolsa.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
            }
            this.partida.bolsa = bolsa;
        }
        return this.partida.bolsa.pop();
    }

    _llenarColaSiguientes() {
        while (this.partida.colaSiguientes.length < 4) {
            this.partida.colaSiguientes.push(this._siguienteTipoDeBolsa());
        }
    }

    _sacarSiguientePieza() {
        this._llenarColaSiguientes();
        const tipo = this.partida.colaSiguientes.shift();
        this._llenarColaSiguientes();
        this.partida.puedeHold = true;
        return this._colocarPiezaArriba(tipo);
    }

    _colocarPiezaArriba(tipo) {
        const matriz = PIEZAS_TETRIS[tipo].matriz.map((fila) => [...fila]);
        const x = Math.floor((COLUMNAS_TETRIS - matriz[0].length) / 2);
        const y = tipo === 'I' ? 0 : 1;
        this.partida.piezaActual = { tipo, matriz, x, y };

        if (!this._esPosicionValida(matriz, x, y)) {
            this._dispararGameOver();
            return false;
        }
        return true;
    }

    _esPosicionValida(matriz, offsetX, offsetY) {
        for (let r = 0; r < matriz.length; r++) {
            for (let c = 0; c < matriz[r].length; c++) {
                if (!matriz[r][c]) continue;
                const nx = offsetX + c;
                const ny = offsetY + r;
                if (nx < 0 || nx >= COLUMNAS_TETRIS || ny >= FILAS_TOTALES_TETRIS) {
                    return false;
                }
                if (ny >= 0 && this.partida.tablero[ny][nx] !== 0) {
                    return false;
                }
            }
        }
        return true;
    }

    _rotarMatrizHoraria(matriz) {
        const n = matriz.length;
        const rotada = Array.from({ length: n }, () => Array(n).fill(0));
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                rotada[c][n - 1 - r] = matriz[r][c];
            }
        }
        return rotada;
    }

    _moverPieza(dx) {
        const p = this.partida.piezaActual;
        if (!p || this.partida.gameOver) return false;
        if (this._esPosicionValida(p.matriz, p.x + dx, p.y)) {
            p.x += dx;
            reproducirSonido('tetris_mover');
            return true;
        }
        return false;
    }

    _rotarPiezaConKicks() {
        const p = this.partida.piezaActual;
        if (!p || this.partida.gameOver || p.tipo === 'O') return false;
        const rotada = this._rotarMatrizHoraria(p.matriz);
        const kicks =
            p.tipo === 'I'
                ? [
                      [0, 0],
                      [-1, 0],
                      [1, 0],
                      [-2, 0],
                      [2, 0],
                      [0, -1],
                      [0, 1]
                  ]
                : [
                      [0, 0],
                      [-1, 0],
                      [1, 0],
                      [0, -1],
                      [-2, 0],
                      [2, 0],
                      [-1, -1],
                      [1, -1]
                  ];

        for (const [kx, ky] of kicks) {
            if (this._esPosicionValida(rotada, p.x + kx, p.y + ky)) {
                p.matriz = rotada;
                p.x += kx;
                p.y += ky;
                reproducirSonido('tetris_rotar');
                return true;
            }
        }
        return false;
    }

    _guardarHold() {
        if (!this.partida.piezaActual || this.partida.gameOver || !this.partida.puedeHold) return;
        const tipoActual = this.partida.piezaActual.tipo;
        const previoHold = this.partida.holdTipo;
        this.partida.holdTipo = tipoActual;
        this.partida.puedeHold = false;
        reproducirSonido('tetris_rotar');

        if (previoHold) {
            this._colocarPiezaArriba(previoHold);
        } else {
            this._sacarSiguientePieza();
        }
        notificarEstado('tetris_cambio', { actualizado: true });
    }

    _obtenerFilaFantasma() {
        const p = this.partida.piezaActual;
        if (!p) return 0;
        let gy = p.y;
        while (this._esPosicionValida(p.matriz, p.x, gy + 1)) {
            gy += 1;
        }
        return gy;
    }

    _bajarPieza(esManual = false) {
        const p = this.partida.piezaActual;
        if (!p || this.partida.gameOver) return false;
        if (this._esPosicionValida(p.matriz, p.x, p.y + 1)) {
            p.y += 1;
            if (esManual) {
                this.partida.puntaje += 1;
                this.partida.acumuladorCaida = 0;
            }
            return true;
        }
        this._fijarPiezaActual();
        return false;
    }

    _caidaRapida() {
        const p = this.partida.piezaActual;
        if (!p || this.partida.gameOver) return;
        const filaDestino = this._obtenerFilaFantasma();
        const distancia = Math.max(0, filaDestino - p.y);
        p.y = filaDestino;
        this.partida.puntaje += distancia * 2;
        this._fijarPiezaActual();
    }

    _fijarPiezaActual() {
        const p = this.partida.piezaActual;
        if (!p) return;
        const indiceColor = INDICES_COLOR[p.tipo] || 1;
        for (let r = 0; r < p.matriz.length; r++) {
            for (let c = 0; c < p.matriz[r].length; c++) {
                if (!p.matriz[r][c]) continue;
                const ny = p.y + r;
                const nx = p.x + c;
                if (ny >= 0 && ny < FILAS_TOTALES_TETRIS && nx >= 0 && nx < COLUMNAS_TETRIS) {
                    this.partida.tablero[ny][nx] = indiceColor;
                }
            }
        }

        const filasLimpiadas = this._limpiarLineasCompletas();
        const limpiadas = filasLimpiadas.length;
        if (limpiadas === 0) {
            this.partida.combo = -1;
            reproducirSonido('tetris_fijar');
        } else {
            const base = PUNTAJES_LINEAS_TETRIS[limpiadas] || 100 * limpiadas;
            const puntosBase = base * this.partida.nivel;
            this.partida.combo += 1;
            const bonusCombo = this.partida.combo > 0 ? 50 * this.partida.combo * this.partida.nivel : 0;
            this.partida.puntaje += puntosBase + bonusCombo;
            this.partida.lineas += limpiadas;
            this.partida.nivel = 1 + Math.floor(this.partida.lineas / 10);

            this._emitirParticulasLinea3D(filasLimpiadas);
            if (limpiadas === 4) {
                reproducirSonido('tetris_cuadruple');
                this.partida.flashTetris = 1.0;
                this.partida.mensajeFlash = `¡TETRIS 4L! +${puntosBase}`;
                notificarEstado('aviso', { mensaje: `⚡ ¡TETRIS CUÁDRUPLE! +${puntosBase} pts` });
            } else {
                reproducirSonido('tetris_linea');
            }

            this._registrarPuntajeRanking(estadoJugador.apodo, this.partida.puntaje);
            this._difundirPuntajeActual();
        }

        this._sacarSiguientePieza();
        this.partida.acumuladorCaida = 0;
        notificarEstado('tetris_cambio', { actualizado: true });
    }

    _limpiarLineasCompletas() {
        const filasVisibles = [];
        for (let r = FILAS_TOTALES_TETRIS - 1; r >= 0; r--) {
            if (this.partida.tablero[r].every((val) => val !== 0)) {
                filasVisibles.push(Math.max(0, r - FILAS_OCULTAS_TETRIS));
                this.partida.tablero.splice(r, 1);
                this.partida.tablero.unshift(Array(COLUMNAS_TETRIS).fill(0));
                r += 1;
            }
        }
        return filasVisibles;
    }

    _dispararGameOver() {
        this.partida.gameOver = true;
        this.partida.activa = false;
        this.partida.piezaActual = null;
        reproducirSonido('tetris_gameover');
        this._finalizarYRecompensarPartida();
        this._emitirSnapshotTablero(true);
        notificarEstado('tetris_cambio', { gameOver: true });
    }

    _finalizarYRecompensarPartida() {
        if (this.partida.recompensaEntregada) return;
        this.partida.recompensaEntregada = true;

        const pts = this.partida.puntaje;
        if (pts <= 0) return;

        if (pts > estadoJugador.mejorPuntajeTetris) {
            estadoJugador.mejorPuntajeTetris = pts;
            guardarEstadoLocal();
        }

        this._registrarPuntajeRanking(estadoJugador.apodo, pts);
        this._difundirPuntajeActual();

        const monedas = Math.floor(pts / 250);
        const xp = Math.floor(pts / 100);
        if (monedas > 0 || xp > 0) {
            this.otorgarRecompensa(monedas, xp);
            notificarEstado('aviso', {
                mensaje: `🕹️ Tetris finalizado con ${pts} pts (+${monedas} 🪙, +${xp} XP)`
            });
        }
    }

    _registrarPuntajeRanking(apodo, puntaje) {
        const prev = this.rankingSala.get(apodo) || 0;
        if (puntaje > prev) {
            this.rankingSala.set(apodo, puntaje);
            this._redibujarCartelRecords3D();
        }
    }

    _difundirPuntajeActual() {
        enviarEventoExperiencia('puntaje_tetris', {
            accion: 'puntaje_tetris',
            apodo: estadoJugador.apodo,
            puntaje: this.partida.puntaje,
            lineas: this.partida.lineas,
            nivel: this.partida.nivel
        });
    }

    /**
     * Genera matriz 22x10 combinando bloques fijados con la pieza actual para TV 3D y red.
     */
    _generarGrillaConPiezaActual() {
        const copia = this.partida.tablero.map((fila) => [...fila]);
        const p = this.partida.piezaActual;
        if (p) {
            const idx = INDICES_COLOR[p.tipo] || 1;
            for (let r = 0; r < p.matriz.length; r++) {
                for (let c = 0; c < p.matriz[r].length; c++) {
                    if (!p.matriz[r][c]) continue;
                    const ny = p.y + r;
                    const nx = p.x + c;
                    if (ny >= 0 && ny < FILAS_TOTALES_TETRIS && nx >= 0 && nx < COLUMNAS_TETRIS) {
                        copia[ny][nx] = idx;
                    }
                }
            }
        }
        return copia;
    }

    _emitirSnapshotTablero(forzar = false) {
        const idx = estadoControles.asientoTetrisActual;
        if (!estadoControles.modoTetrisActivo || idx < 0) return;
        if (!forzar && this.acumuladorSnapshotRed < 0.2) return;
        this.acumuladorSnapshotRed = 0;

        enviarEventoExperiencia('tablero_tetris_snapshot', {
            accion: 'tablero_tetris_snapshot',
            asiento: idx,
            apodo: estadoJugador.apodo,
            puntaje: this.partida.puntaje,
            nivel: this.partida.nivel,
            grid: this._generarGrillaConPiezaActual()
        });
    }

    /**
     * Ejecuta comandos de juego enviados desde teclado o botones táctiles del HUD flotante.
     * @param {'izquierda'|'derecha'|'rotar'|'bajar'|'caida_rapida'|'hold'|'reiniciar'} accion
     */
    manejarAccionTetris(accion) {
        if (!estadoControles.modoTetrisActivo) return;
        if (accion === 'reiniciar') {
            this._finalizarYRecompensarPartida();
            this._iniciarNuevaPartidaTetris();
            return;
        }
        if (this.partida.gameOver) return;

        switch (accion) {
            case 'izquierda':
                this._moverPieza(-1);
                break;
            case 'derecha':
                this._moverPieza(1);
                break;
            case 'rotar':
                this._rotarPiezaConKicks();
                break;
            case 'bajar':
                this._bajarPieza(true);
                break;
            case 'caida_rapida':
                this._caidaRapida();
                break;
            case 'hold':
                this._guardarHold();
                break;
            default:
                break;
        }
        notificarEstado('tetris_cambio', { actualizado: true });
    }

    /**
     * Devuelve el resumen de estado actual para el HUD flotante en `interfaz.js`.
     */
    obtenerEstadoHUDTetris() {
        return {
            puntaje: this.partida.puntaje,
            nivel: this.partida.nivel,
            lineas: this.partida.lineas,
            gameOver: this.partida.gameOver,
            holdTipo: this.partida.holdTipo,
            siguientes: this.partida.colaSiguientes.slice(0, 3),
            ranking: this.obtenerRankingSala(5),
            asiento: estadoControles.asientoTetrisActual + 1,
            mensajeFlash: this.partida.flashTetris > 0 ? this.partida.mensajeFlash : ''
        };
    }

    _dibujarBloque2D(ctx, x, y, tam, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, tam - 2, tam - 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(x + 2, y + 2, tam - 4, 4);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, tam - 2, tam - 2);
    }

    _dibujarMiniPieza2D(ctx, tipo, cx, cy, tam) {
        const def = PIEZAS_TETRIS[tipo];
        if (!def) return;
        const cols = def.matriz[0].length;
        const rows = def.matriz.length;
        const ox = cx - (cols * tam) / 2;
        const oy = cy - (rows * tam) / 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (def.matriz[r][c]) {
                    this._dibujarBloque2D(ctx, ox + c * tam, oy + r * tam, tam, def.color);
                }
            }
        }
    }

    /**
     * Renderiza únicamente los mini-lienzos auxiliares laterales (Hold y Next 3).
     * El tablero principal 10x20 se renderiza directamente en la TV Gigante 3D WebGL.
     */
    _renderizarCanvasesAuxiliares() {
        const cHold = typeof document !== 'undefined' ? document.getElementById('canvas-tetris-hold') : null;
        if (cHold) {
            const ctxH = cHold.getContext('2d');
            ctxH.clearRect(0, 0, cHold.width, cHold.height);
            if (this.partida.holdTipo) {
                this._dibujarMiniPieza2D(ctxH, this.partida.holdTipo, cHold.width / 2, cHold.height / 2, 18);
            }
        }

        const cNext = typeof document !== 'undefined' ? document.getElementById('canvas-tetris-siguientes') : null;
        if (cNext) {
            const ctxN = cNext.getContext('2d');
            ctxN.clearRect(0, 0, cNext.width, cNext.height);
            this.partida.colaSiguientes.slice(0, 3).forEach((tipo, idx) => {
                this._dibujarMiniPieza2D(ctxN, tipo, cNext.width / 2, 36 + idx * 66, 16);
            });
        }
    }

    /**
     * Procesa eventos multijugador recibidos vía `evento_experiencia`.
     */
    alEventoRed(evento) {
        const datos = evento?.datos || {};
        const accion = evento?.accion || datos.accion || evento?.subtipo;

        if (accion === 'asiento_tetris' && typeof datos.asiento === 'number') {
            const asiento = this.asientosTetris[datos.asiento];
            if (!asiento) return;
            asiento.ocupado = Boolean(datos.ocupado);
            asiento.ocupanteId = asiento.ocupado ? datos.jugadorId || evento.origenId : null;
            asiento.ocupanteApodo = asiento.ocupado ? datos.apodo || 'Jugador' : '';
            if (!asiento.ocupado) {
                this.snapshotsRemotos.delete(datos.asiento);
            }
            this._actualizarVisualAsiento(asiento);
        } else if (accion === 'tablero_tetris_snapshot' && typeof datos.asiento === 'number') {
            const asiento = this.asientosTetris[datos.asiento];
            if (asiento) {
                asiento.ocupado = true;
                asiento.ocupanteId = evento.origenId || asiento.ocupanteId;
                asiento.ocupanteApodo = datos.apodo || asiento.ocupanteApodo || 'Jugador';
                this._actualizarVisualAsiento(asiento);
            }
            this.snapshotsRemotos.set(datos.asiento, {
                grid: datos.grid,
                puntaje: datos.puntaje || 0,
                nivel: datos.nivel || 1
            });
            this._actualizarTablero3DEstacion(datos.asiento);
        } else if (accion === 'puntaje_tetris' && datos.apodo && typeof datos.puntaje === 'number') {
            this._registrarPuntajeRanking(datos.apodo, datos.puntaje);
            notificarEstado('tetris_cambio', { ranking: true });
        }
    }

    /**
     * Bucle 60 FPS: gravedad, actualización 3D de las 8 TVs gigantes y partículas de líneas.
     */
    actualizar(dt, _contextoSandbox) {
        const dtSeg = Math.min(dt, 0.05);
        this.tiempoTotal += dtSeg;
        this.acumuladorSnapshotRed += dtSeg;

        if (this.cupulaCielo) {
            this.cupulaCielo.rotation.y += dtSeg * 0.004;
        }
        this.tetrominosDecorativos.forEach((t, idx) => {
            t.rotation.y += dtSeg * (0.4 + idx * 0.08);
            t.position.y += Math.sin(this.tiempoTotal * 1.8 + idx) * dtSeg * 0.25;
        });

        for (let i = this.particulasLineas.length - 1; i >= 0; i--) {
            const p = this.particulasLineas[i];
            p.vida -= dtSeg;
            if (p.vida <= 0) {
                liberarObjeto3D(p.puntos);
                this.particulasLineas.splice(i, 1);
                continue;
            }
            const attr = p.puntos.geometry.getAttribute('position');
            for (let k = 0; k < p.velocidades.length; k++) {
                const v = p.velocidades[k];
                v.y -= 9.5 * dtSeg;
                attr.setXYZ(k, attr.getX(k) + v.x * dtSeg, attr.getY(k) + v.y * dtSeg, attr.getZ(k) + v.z * dtSeg);
            }
            attr.needsUpdate = true;
            p.puntos.material.opacity = Math.max(0, (p.vida / p.duracionMax) * 0.96);
        }

        // Liberar estaciones si algún jugador remoto desconectó o salió de la sala
        for (const asiento of this.asientosTetris) {
            if (asiento.ocupado && asiento.ocupanteId && asiento.ocupanteId !== estadoJugador.id) {
                const rem = estadoRed.jugadoresRemotos.get(asiento.ocupanteId);
                if (!rem || rem.experienciaActiva !== 'tetris') {
                    asiento.ocupado = false;
                    asiento.ocupanteId = null;
                    asiento.ocupanteApodo = '';
                    this.snapshotsRemotos.delete(asiento.indice);
                    this._actualizarVisualAsiento(asiento);
                }
            }
        }

        if (estadoControles.modoTetrisActivo && estadoControles.asientoTetrisActual >= 0) {
            const estActiva = this.asientosTetris[estadoControles.asientoTetrisActual];
            if (this.partida.flashTetris > 0) {
                this.partida.flashTetris = Math.max(0, this.partida.flashTetris - dtSeg);
            }
            if (estActiva?.matBisel) {
                const biselHex = this.partida.flashTetris > 0 ? 0xfacc15 : 0xf59e0b;
                estActiva.matBisel.color.setHex(biselHex);
                estActiva.matBisel.emissive.setHex(biselHex);
            }
            if (!this.partida.gameOver && this.partida.activa) {
                this.partida.acumuladorCaida += dtSeg;
                const intervalo = Math.max(0.08, 0.82 * Math.pow(0.86, this.partida.nivel - 1));
                if (this.partida.acumuladorCaida >= intervalo) {
                    this.partida.acumuladorCaida = 0;
                    this._bajarPieza(false);
                }
            }
            this._actualizarTablero3DEstacion(estadoControles.asientoTetrisActual);
            this._emitirSnapshotTablero(false);
            this._renderizarCanvasesAuxiliares();
        }
    }

    /**
     * Desmonta las 8 estaciones 3D, libera asiento si estaba ocupado y limpia toda la memoria GPU.
     */
    desmontar(escena) {
        if (estadoControles.modoTetrisActivo) {
            this.levantarseAsientoTetris();
        }
        estadoControles.modoTetrisActivo = false;
        estadoControles.asientoTetrisActual = -1;

        liberarObjeto3D(this.grupoRaiz);

        if (this.geoBloque3D) this.geoBloque3D.dispose();
        if (this.geoFantasma3D) this.geoFantasma3D.dispose();
        for (const mat of this.materialesBloques3D) {
            if (mat && typeof mat.dispose === 'function') mat.dispose();
        }

        this.geoBloque3D = null;
        this.geoFantasma3D = null;
        this.materialesBloques3D = [];
        this.particulasLineas = [];
        this.asientosTetris = [];
        this.tetrominosDecorativos = [];
        this.snapshotsRemotos.clear();
        this.cupulaCielo = null;
        this.canvasRecords3D = null;
        this.ctxRecords3D = null;
        this.texRecords3D = null;
        super.desmontar(escena);
    }
}
