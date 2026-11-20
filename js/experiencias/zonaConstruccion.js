/**
 * Experiencia creativa estilo Minecraft (`ZonaConstruccion`):
 * parcela voxel 32x32 m con raycasting, vista previa fantasma, colisionadores
 * AABB en vivo, persistencia en el perfil y sincronización multijugador.
 */
import {
    ALTURA_AVATAR,
    CATALOGO_BLOQUES,
    DIMENSION_PARCELA,
    MITAD_PARCELA,
    RADIO_COLISION_AVATAR
} from '../constantes.js';
import {
    estadoControles,
    estadoJugador,
    estadoRed,
    estadoSandbox,
    guardarEstadoLocal,
    notificarEstado
} from '../estado.js';
import {
    crearCupulaCielo,
    liberarObjeto3D,
    obtenerMapasPBRBloqueVoxel,
    obtenerMapasPBRPlaza,
    obtenerTexturaCespedPlaza,
    reproducirSonido
} from '../recursos.js';
import { ExperienciaBase } from '../nucleoSandbox.js';
import { enviarEventoExperiencia } from '../red.js';

const ALTURA_MAX_BLOQUE = 23;

export class ZonaConstruccion extends ExperienciaBase {
    constructor() {
        super({
            id: 'construccion',
            nombre: 'Taller de Bloques (Creative)',
            descripcion: 'Construye en una parcela voxel 32x32 m con física real y multijugador.',
            colorPortal: 0x22c55e,
            posicionPortal: { x: -16, y: 0, z: -22 },
            minJugadores: 1,
            spawnJugador: { x: 0, y: 0.5, z: 18 }
        });

        this.mapaBloques = new Map();
        this.grupoBloques = null;
        this.planoBaseMesh = null;
        this.fantasmaMesh = null;
        this.orbeTerminal = null;
        this.cupulaCielo = null;
        this.raycaster = new THREE.Raycaster();
        this.punteroNDC = new THREE.Vector2();
        this.objetivoRaycast = null;
        this.contextoActual = null;
        this.tiempoTotal = 0;
        this.contadorBloquesRecompensa = 0;
        this.ultimaRecompensaMs = 0;
        this.manejadoresEventos = null;
    }

    /**
     * Monta la parcela de construcción, restaura bloques guardados y activa raycasting.
     * @param {THREE.Scene} escena
     * @param {object} contextoSandbox
     */
    montar(escena, contextoSandbox) {
        super.montar(escena, contextoSandbox);
        this.contextoActual = contextoSandbox;
        this.mapaBloques.clear();
        this.objetivoRaycast = null;
        this.tiempoTotal = 0;

        this.grupoBloques = new THREE.Group();
        this.grupoBloques.name = 'bloques_voxel';
        this.grupoRaiz.add(this.grupoBloques);

        this._construirEntornoParcela();
        this._construirVistaPreviaFantasma();
        this._construirPortalRetorno();
        this._construirTerminalBlueprint();

        this.cupulaCielo = crearCupulaCielo('taller_atardecer');
        this.grupoRaiz.add(this.cupulaCielo);
        if (escena) {
            escena.background = new THREE.Color(0xf97316);
            escena.fog = new THREE.FogExp2(0xf59e0b, 0.0042);
        }

        this._restaurarConstruccionGuardada();
        this._vincularEventosLienzo();

        if (estadoRed.conectado) {
            enviarEventoExperiencia('pedir_estado_parcela', {
                accion: 'pedir_estado_parcela',
                experienciaId: 'construccion'
            });
        }
    }

    /**
     * Construye el suelo exterior, la parcela 32x32 m con cuadrícula y límites neón.
     */
    _construirEntornoParcela() {
        // Explanada circundante de césped estilizado 64x64 m
        const cespedPBR = obtenerTexturaCespedPlaza();
        const sueloExterior = new THREE.Mesh(
            new THREE.PlaneGeometry(64, 64),
            new THREE.MeshStandardMaterial({
                map: cespedPBR.map,
                bumpMap: cespedPBR.bumpMap,
                bumpScale: 0.04,
                roughnessMap: cespedPBR.roughnessMap,
                roughness: 0.9,
                metalness: 0.02
            })
        );
        sueloExterior.rotation.x = -Math.PI / 2;
        sueloExterior.position.y = -0.01;
        sueloExterior.receiveShadow = true;
        this.grupoRaiz.add(sueloExterior);

        this.registrarColisionadorCaja(-32, -2, -32, 32, 0, 32, 'suelo_construccion');

        // Parcela activa de construcción 32x32 m con piedra PBR cálida
        const piedraPBR = obtenerMapasPBRPlaza(8);
        const matParcela = new THREE.MeshStandardMaterial({
            map: piedraPBR.map,
            bumpMap: piedraPBR.bumpMap,
            bumpScale: 0.03,
            roughnessMap: piedraPBR.roughnessMap,
            roughness: 0.78,
            metalness: 0.05
        });
        this.planoBaseMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(DIMENSION_PARCELA, DIMENSION_PARCELA),
            matParcela
        );
        this.planoBaseMesh.rotation.x = -Math.PI / 2;
        this.planoBaseMesh.position.y = 0.002;
        this.planoBaseMesh.receiveShadow = true;
        this.grupoRaiz.add(this.planoBaseMesh);

        const grid = new THREE.GridHelper(DIMENSION_PARCELA, DIMENSION_PARCELA, 0x22c55e, 0x334155);
        grid.position.y = 0.01;
        this.grupoRaiz.add(grid);

        // Marcadores luminosos en las 4 esquinas de la parcela
        const matEsquina = new THREE.MeshStandardMaterial({
            color: 0x22c55e,
            emissive: 0x16a34a,
            emissiveIntensity: 0.85
        });
        const esquinas = [
            [-MITAD_PARCELA - 0.3, -MITAD_PARCELA - 0.3],
            [MITAD_PARCELA + 0.3, -MITAD_PARCELA - 0.3],
            [-MITAD_PARCELA - 0.3, MITAD_PARCELA + 0.3],
            [MITAD_PARCELA + 0.3, MITAD_PARCELA + 0.3]
        ];
        for (const [ex, ez] of esquinas) {
            const poste = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.2, 0.45), matEsquina.clone());
            poste.position.set(ex, 1.1, ez);
            this.grupoRaiz.add(poste);
        }
    }

    /**
     * Crea el cubo translúcido de vista previa para colocación/eliminación.
     */
    _construirVistaPreviaFantasma() {
        const geo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.38,
            wireframe: false,
            depthWrite: false
        });
        this.fantasmaMesh = new THREE.Mesh(geo, mat);
        this.fantasmaMesh.visible = false;

        const edges = new THREE.EdgesGeometry(geo);
        const linea = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0xe0f2fe })
        );
        this.fantasmaMesh.add(linea);
        this.grupoRaiz.add(this.fantasmaMesh);
    }

    /**
     * Crea el portal físico 3D de regreso al Lobby Central.
     */
    _construirPortalRetorno() {
        this.crearPortalFisico3D({
            idDestino: 'lobby',
            nombre: 'Lobby Central',
            subtitulo: 'Volver a la plaza',
            color: 0x38bdf8,
            posicion: { x: 0, y: 0, z: 24 },
            rotacionY: Math.PI
        });
    }

    /**
     * Crea una terminal interactiva para guardar/sincronizar el plano de construcción.
     */
    _construirTerminalBlueprint() {
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.4, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
        );
        base.position.set(-5, 0.7, 20);
        base.castShadow = true;
        this.grupoRaiz.add(base);
        this.registrarColisionadorCaja(-5.6, 0, 19.4, -4.4, 1.4, 20.6, 'terminal_blueprint');

        this.orbeTerminal = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.4, 0),
            new THREE.MeshStandardMaterial({
                color: 0x22c55e,
                emissive: 0x22c55e,
                emissiveIntensity: 0.9
            })
        );
        this.orbeTerminal.position.set(-5, 2.1, 20);
        this.grupoRaiz.add(this.orbeTerminal);

        this.registrarEntidadInteractiva({
            id: 'terminal_blueprint',
            etiqueta: 'Guardar y Sincronizar Parcela',
            posicion: { x: -5, y: 1.0, z: 20 },
            radio: 3.2,
            autoRecoger: false,
            activa: true
        });
    }

    /**
     * Restaura bloques desde la parcela autoritativa de la sala (si está conectado)
     * o desde `estadoJugador.construccionGuardada` en modo offline.
     */
    _restaurarConstruccionGuardada() {
        const fuente =
            estadoRed.conectado && Array.isArray(estadoRed.bloquesSala)
                ? estadoRed.bloquesSala
                : Array.isArray(estadoJugador.construccionGuardada)
                  ? estadoJugador.construccionGuardada
                  : [];

        if (fuente.length === 0 && !estadoRed.conectado) {
            const iniciales = [
                { x: -1, y: 0, z: 0, tipo: 'madera' },
                { x: 0, y: 0, z: 0, tipo: 'neon_cian' },
                { x: 1, y: 0, z: 0, tipo: 'madera' },
                { x: 0, y: 1, z: 0, tipo: 'oro' }
            ];
            for (const b of iniciales) {
                this.colocarBloque(b.x, b.y, b.z, b.tipo, {
                    emitirRed: false,
                    persistir: false,
                    recompensar: false
                });
            }
            this._sincronizarConstruccionEnEstado();
            return;
        }

        for (const b of fuente) {
            this.colocarBloque(b.x, b.y, b.z, b.tipo, {
                emitirRed: false,
                persistir: false,
                recompensar: false
            });
        }
    }

    /**
     * Evalúa el raycast desde coordenadas de pantalla hacia bloques o parcela.
     * @param {number} clientX
     * @param {number} clientY
     */
    _actualizarObjetivoDesdePuntero(clientX, clientY) {
        const camara = this.contextoActual?.camara;
        const lienzo = document.getElementById('lienzo-3d');
        if (!camara || !lienzo || !this.planoBaseMesh || !this.grupoBloques) {
            this.objetivoRaycast = null;
            return null;
        }

        const rect = lienzo.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        this.punteroNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.punteroNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.punteroNDC, camara);
        const objetivos = [...this.grupoBloques.children, this.planoBaseMesh];
        const impactos = this.raycaster.intersectObjects(objetivos, false);

        if (impactos.length === 0) {
            this.objetivoRaycast = null;
            if (this.fantasmaMesh) this.fantasmaMesh.visible = false;
            return null;
        }

        const hit = impactos[0];
        let gx, gy, gz;
        let rx = null;
        let ry = null;
        let rz = null;
        let puedeRomper = false;

        if (hit.object.userData?.esBloqueVoxel) {
            rx = hit.object.userData.gx;
            ry = hit.object.userData.gy;
            rz = hit.object.userData.gz;
            puedeRomper = true;

            const n = hit.face?.normal || { x: 0, y: 1, z: 0 };
            gx = rx + Math.round(n.x);
            gy = ry + Math.round(n.y);
            gz = rz + Math.round(n.z);
        } else {
            gx = Math.floor(hit.point.x);
            gy = 0;
            gz = Math.floor(hit.point.z);
        }

        const dentroLimites =
            gx >= -MITAD_PARCELA &&
            gx < MITAD_PARCELA &&
            gz >= -MITAD_PARCELA &&
            gz < MITAD_PARCELA &&
            gy >= 0 &&
            gy <= ALTURA_MAX_BLOQUE;

        const resultado = { gx, gy, gz, rx, ry, rz, puedeColocar: dentroLimites, puedeRomper };
        this.objetivoRaycast = resultado;

        if (this.fantasmaMesh) {
            if (estadoControles.modoConstruccion === 'romper' && puedeRomper) {
                this.fantasmaMesh.visible = true;
                this.fantasmaMesh.position.set(rx + 0.5, ry + 0.5, rz + 0.5);
                this.fantasmaMesh.material.color.setHex(0xef4444);
            } else if (dentroLimites) {
                this.fantasmaMesh.visible = true;
                this.fantasmaMesh.position.set(gx + 0.5, gy + 0.5, gz + 0.5);
                this.fantasmaMesh.material.color.setHex(
                    this._solapaConJugador(gx, gy, gz) ? 0xef4444 : 0x38bdf8
                );
            } else {
                this.fantasmaMesh.visible = false;
            }
        }

        return resultado;
    }

    /**
     * Comprueba si una celda voxel solapa el cuerpo AABB del jugador local.
     */
    _solapaConJugador(gx, gy, gz) {
        const pos = estadoJugador.posicion;
        const r = RADIO_COLISION_AVATAR * 0.9;
        return (
            pos.x + r > gx &&
            pos.x - r < gx + 1 &&
            pos.z + r > gz &&
            pos.z - r < gz + 1 &&
            pos.y + ALTURA_AVATAR > gy + 0.05 &&
            pos.y + 0.05 < gy + 1
        );
    }

    /**
     * Vincula eventos de puntero al lienzo para vista previa, colocación y rotura.
     */
    _vincularEventosLienzo() {
        const lienzo = document.getElementById('lienzo-3d');
        if (!lienzo) return;

        let pointerId = null;
        let downX = 0;
        let downY = 0;

        const onPointerMove = (e) => {
            this._actualizarObjetivoDesdePuntero(e.clientX, e.clientY);
        };

        const onPointerDown = (e) => {
            pointerId = e.pointerId;
            downX = e.clientX;
            downY = e.clientY;
        };

        const onPointerUp = (e) => {
            if (e.pointerId !== pointerId) return;
            pointerId = null;

            const distArrastre = Math.hypot(e.clientX - downX, e.clientY - downY);
            if (distArrastre > 7) return;

            const obj = this._actualizarObjetivoDesdePuntero(e.clientX, e.clientY);
            if (!obj) return;

            if (e.button === 2 || (e.button === 0 && estadoControles.modoConstruccion === 'romper')) {
                if (obj.puedeRomper) {
                    this.romperBloque(obj.rx, obj.ry, obj.rz, { emitirRed: true, persistir: true });
                }
            } else if (e.button === 0 && obj.puedeColocar) {
                this.colocarBloque(obj.gx, obj.gy, obj.gz, estadoControles.bloqueSeleccionado, {
                    emitirRed: true,
                    persistir: true,
                    recompensar: true
                });
            }
        };

        const onContextMenu = (e) => {
            e.preventDefault();
        };

        lienzo.addEventListener('pointermove', onPointerMove);
        lienzo.addEventListener('pointerdown', onPointerDown);
        lienzo.addEventListener('pointerup', onPointerUp);
        lienzo.addEventListener('contextmenu', onContextMenu);

        this.manejadoresEventos = { lienzo, onPointerMove, onPointerDown, onPointerUp, onContextMenu };
    }

    /**
     * Sincroniza la lista de bloques actual en `estadoJugador.construccionGuardada`.
     */
    _sincronizarConstruccionEnEstado() {
        estadoJugador.construccionGuardada = Array.from(this.mapaBloques.values()).map((r) => ({
            x: r.x,
            y: r.y,
            z: r.z,
            tipo: r.tipo
        }));
        guardarEstadoLocal();
    }

    /**
     * Coloca un bloque voxel 1x1x1 m y registra su colisionador AABB en vivo.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {string} tipo
     * @param {object} [opciones]
     * @returns {boolean}
     */
    colocarBloque(x, y, z, tipo = 'cesped', opciones = {}) {
        const { emitirRed = false, persistir = false, recompensar = false } = opciones;
        const gx = Math.round(x);
        const gy = Math.round(y);
        const gz = Math.round(z);

        if (
            gx < -MITAD_PARCELA ||
            gx >= MITAD_PARCELA ||
            gz < -MITAD_PARCELA ||
            gz >= MITAD_PARCELA ||
            gy < 0 ||
            gy > ALTURA_MAX_BLOQUE
        ) {
            return false;
        }

        if (recompensar && this._solapaConJugador(gx, gy, gz)) {
            notificarEstado('aviso', { mensaje: 'No puedes colocar un bloque sobre tu avatar.' });
            return false;
        }

        const def = CATALOGO_BLOQUES.find((b) => b.id === tipo) || CATALOGO_BLOQUES[0];
        const clave = `${gx},${gy},${gz}`;
        if (this.mapaBloques.has(clave)) {
            this.romperBloque(gx, gy, gz, { emitirRed: false, persistir: false });
        }

        const mapasPBR = obtenerMapasPBRBloqueVoxel(def.id);
        const mat = new THREE.MeshStandardMaterial({
            map: mapasPBR.map,
            bumpMap: mapasPBR.bumpMap,
            bumpScale: 0.045,
            roughnessMap: mapasPBR.roughnessMap,
            transparent: Boolean(def.transparente),
            opacity: def.transparente ? 0.68 : 1,
            emissive: def.emisivo ? new THREE.Color(def.color) : new THREE.Color(0x000000),
            emissiveIntensity: def.emisivo ? 0.72 : 0,
            roughness: def.id === 'oro' ? 0.28 : 0.72,
            metalness: def.id === 'oro' ? 0.7 : 0.08
        });

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
        mesh.position.set(gx + 0.5, gy + 0.5, gz + 0.5);
        mesh.castShadow = !def.transparente;
        mesh.receiveShadow = true;
        mesh.userData = { esBloqueVoxel: true, gx, gy, gz, tipo: def.id };
        this.grupoBloques.add(mesh);

        const colisionador = this.registrarColisionadorCaja(
            gx,
            gy,
            gz,
            gx + 1,
            gy + 1,
            gz + 1,
            `voxel_${clave}`
        );

        this.mapaBloques.set(clave, { x: gx, y: gy, z: gz, tipo: def.id, mesh, colisionador });

        if (persistir) {
            this._sincronizarConstruccionEnEstado();
        }

        if (recompensar) {
            reproducirSonido('interaccion');
            this.contadorBloquesRecompensa += 1;
            const ahora = Date.now();
            if (this.contadorBloquesRecompensa >= 10 && ahora - this.ultimaRecompensaMs >= 3000) {
                this.contadorBloquesRecompensa = 0;
                this.ultimaRecompensaMs = ahora;
                this.otorgarRecompensa(2, 5);
                notificarEstado('aviso', { mensaje: '¡Constructor activo! +2 Monedas y +5 XP.' });
            }
        }

        if (emitirRed) {
            enviarEventoExperiencia('colocar_bloque', {
                accion: 'colocar_bloque',
                x: gx,
                y: gy,
                z: gz,
                tipo: def.id
            });
        }

        return true;
    }

    /**
     * Elimina un bloque voxel existente, libera su GPU y retira su colisionador AABB.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {object} [opciones]
     * @returns {boolean}
     */
    romperBloque(x, y, z, opciones = {}) {
        const { emitirRed = false, persistir = false } = opciones;
        const gx = Math.round(x);
        const gy = Math.round(y);
        const gz = Math.round(z);
        const clave = `${gx},${gy},${gz}`;
        const registro = this.mapaBloques.get(clave);
        if (!registro) return false;

        liberarObjeto3D(registro.mesh);
        const idx = estadoSandbox.colisionadoresEstaticos.indexOf(registro.colisionador);
        if (idx !== -1) {
            estadoSandbox.colisionadoresEstaticos.splice(idx, 1);
        }
        this.mapaBloques.delete(clave);

        if (persistir) {
            this._sincronizarConstruccionEnEstado();
            reproducirSonido('paso');
        }

        if (emitirRed) {
            enviarEventoExperiencia('romper_bloque', {
                accion: 'romper_bloque',
                x: gx,
                y: gy,
                z: gz
            });
        }

        return true;
    }

    /**
     * Limpia toda la parcela de bloques liberando geometría y colisionadores.
     * @param {object} [opciones]
     */
    limpiarParcela(opciones = {}) {
        const { emitirRed = true, persistir = true } = opciones;

        for (const registro of this.mapaBloques.values()) {
            liberarObjeto3D(registro.mesh);
            const idx = estadoSandbox.colisionadoresEstaticos.indexOf(registro.colisionador);
            if (idx !== -1) {
                estadoSandbox.colisionadoresEstaticos.splice(idx, 1);
            }
        }
        this.mapaBloques.clear();

        if (persistir) {
            this._sincronizarConstruccionEnEstado();
            reproducirSonido('interaccion');
            notificarEstado('aviso', { mensaje: 'Parcela limpiada correctamente.' });
        }

        if (emitirRed) {
            enviarEventoExperiencia('limpiar_parcela', {
                accion: 'limpiar_parcela',
                bloques: []
            });
        }
    }

    /**
     * Guarda la parcela actual y la retransmite a los jugadores de la sala.
     */
    sincronizarParcelaRed() {
        this._sincronizarConstruccionEnEstado();
        enviarEventoExperiencia('sincronizar_parcela', {
            accion: 'sincronizar_parcela',
            bloques: estadoJugador.construccionGuardada
        });
        reproducirSonido('moneda');
        notificarEstado('aviso', {
            mensaje: `Parcela guardada (${estadoJugador.construccionGuardada.length} bloques).`
        });
    }

    /**
     * Responde a la terminal interactiva de guardado/sincronización (`KeyE`).
     */
    alInteractuar(_jugador, entidad) {
        if (entidad?.id === 'terminal_blueprint') {
            this.sincronizarParcelaRed();
        }
    }

    /**
     * Procesa eventos multijugador recibidos vía `evento_experiencia`.
     * @param {object} evento
     */
    alEventoRed(evento) {
        const datos = evento?.datos || {};
        const accion = evento?.accion || datos.accion || evento?.subtipo;

        if (accion === 'colocar_bloque') {
            this.colocarBloque(datos.x, datos.y, datos.z, datos.tipo, {
                emitirRed: false,
                persistir: false,
                recompensar: false
            });
        } else if (accion === 'romper_bloque') {
            this.romperBloque(datos.x, datos.y, datos.z, {
                emitirRed: false,
                persistir: false
            });
        } else if (accion === 'limpiar_parcela') {
            this.limpiarParcela({ emitirRed: false, persistir: false });
        } else if (accion === 'estado_parcela_completo' || accion === 'sincronizar_parcela') {
            const lista = Array.isArray(evento?.bloques)
                ? evento.bloques
                : Array.isArray(datos.bloques)
                  ? datos.bloques
                  : null;
            if (!lista) return;

            this.limpiarParcela({ emitirRed: false, persistir: false });
            for (const b of lista) {
                this.colocarBloque(b.x, b.y, b.z, b.tipo, {
                    emitirRed: false,
                    persistir: false,
                    recompensar: false
                });
            }
        }
    }

    /**
     * Actualiza efectos visuales de la terminal, cúpula celeste y bloque fantasma.
     * @param {number} dt
     */
    actualizar(dt) {
        this.tiempoTotal += dt;
        if (this.orbeTerminal) {
            this.orbeTerminal.rotation.y += dt * 1.6;
            this.orbeTerminal.position.y = 2.1 + Math.sin(this.tiempoTotal * 2.4) * 0.14;
        }
        if (this.fantasmaMesh && this.fantasmaMesh.visible) {
            this.fantasmaMesh.material.opacity = 0.3 + Math.sin(this.tiempoTotal * 6) * 0.1;
        }
        if (this.cupulaCielo) {
            this.cupulaCielo.rotation.y += dt * 0.006;
        }
    }

    /**
     * Desvincula listeners y libera toda la memoria GPU de la experiencia.
     * @param {THREE.Scene} escena
     */
    desmontar(escena) {
        if (this.manejadoresEventos) {
            const { lienzo, onPointerMove, onPointerDown, onPointerUp, onContextMenu } = this.manejadoresEventos;
            lienzo.removeEventListener('pointermove', onPointerMove);
            lienzo.removeEventListener('pointerdown', onPointerDown);
            lienzo.removeEventListener('pointerup', onPointerUp);
            lienzo.removeEventListener('contextmenu', onContextMenu);
            this.manejadoresEventos = null;
        }

        liberarObjeto3D(this.grupoRaiz);
        this.mapaBloques.clear();
        this.grupoBloques = null;
        this.planoBaseMesh = null;
        this.fantasmaMesh = null;
        this.orbeTerminal = null;
        this.cupulaCielo = null;
        this.objetivoRaycast = null;
        super.desmontar(escena);
    }
}
