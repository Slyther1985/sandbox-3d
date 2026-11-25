/**
 * Constructor modular de avatares estilo LEGO Minifigure clásico con acabado ABS brillante,
 * cabeza cilíndrica con perno superior, torso trapezoidal, manos en pinza C,
 * piernas articuladas desde la pelvis, accesorios, gestos sociales y burbujas 3D.
 */
import { CATALOGO_ITEMS, CATALOGO_KARTS, CATALOGO_PIEZAS_KART } from './constantes.js';
import {
    crearTexturaBurbujaChat,
    crearTexturaEtiqueta,
    liberarObjeto3D,
    obtenerTexturaChasisKart,
    obtenerTexturaNeumatico,
    obtenerTexturaRostro
} from './recursos.js';

const PALETA_TORSOS = ['#00a8ff', '#2563eb', '#10b981', '#f43f5e', '#8b5cf6', '#f97316'];

/**
 * Obtiene un color determinista para el torso según el identificador del jugador.
 * @param {string} id
 * @returns {string}
 */
function elegirColorTorso(id = '') {
    let suma = 0;
    for (let i = 0; i < id.length; i++) {
        suma += id.charCodeAt(i);
    }
    return PALETA_TORSOS[suma % PALETA_TORSOS.length];
}

/**
 * Crea un material plástico ABS brillante estilo LEGO (PBR clearcoat).
 * @param {object} props
 * @returns {THREE.MeshPhysicalMaterial}
 */
function crearMaterialPlasticoABS(props) {
    return new THREE.MeshPhysicalMaterial({
        roughness: 0.28,
        metalness: 0.05,
        clearcoat: 0.45,
        clearcoatRoughness: 0.22,
        ...props
    });
}

/**
 * Construye la geometría trapezoidal clásica del torso de una minifigura LEGO.
 * @returns {THREE.ExtrudeGeometry}
 */
function crearGeometriaTorsoLEGO() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.46, -0.44);
    shape.lineTo(0.46, -0.44);
    shape.lineTo(0.36, 0.44);
    shape.lineTo(-0.36, 0.44);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.38,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.025,
        bevelSegments: 2
    });
    geo.translate(0, 0, -0.19);
    return geo;
}

/**
 * Crea un avatar 3D LEGO Minifigure reutilizable para jugador local y remotos.
 * El frente del avatar apunta hacia `+Z` y sus pies descansan en `y = 0`.
 * @param {object} config
 * @returns {THREE.Group}
 */
export function crearAvatar3D(config = {}) {
    const {
        id = 'local',
        apodo = 'Explorador',
        nivel = 1,
        apariencia = {},
        equipado = {}
    } = config;

    const look = {
        piel: apariencia.piel || '#f1c27d',
        torso: apariencia.torso || elegirColorTorso(id),
        piernas: apariencia.piernas || '#2f3640',
        rostro: apariencia.rostro || 'feliz'
    };

    const grupo = new THREE.Group();
    grupo.name = `avatar_${id}`;

    const cuerpo = new THREE.Group();
    cuerpo.name = 'cuerpo_avatar';
    grupo.add(cuerpo);

    const matPiel = crearMaterialPlasticoABS({ color: look.piel });
    const matTorso = crearMaterialPlasticoABS({ color: look.torso });
    const matPierna = crearMaterialPlasticoABS({ color: look.piernas });

    // 1. Cabeza cilíndrica LEGO + perno superior (stud)
    const matRostro = crearMaterialPlasticoABS({
        map: obtenerTexturaRostro(look.rostro, look.piel)
    });
    const materialesCabeza = [matRostro, matPiel.clone(), matPiel.clone()];
    const cabeza = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.62, 28, 1, false, Math.PI, Math.PI * 2),
        materialesCabeza
    );
    cabeza.position.set(0, 2.29, 0);
    cabeza.castShadow = true;
    cabeza.userData.parte = 'cabeza';
    cuerpo.add(cabeza);

    const aroSuperiorCabeza = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.045, 8, 24),
        matPiel.clone()
    );
    aroSuperiorCabeza.rotation.x = Math.PI / 2;
    aroSuperiorCabeza.position.set(0, 2.58, 0);
    aroSuperiorCabeza.userData.parte = 'cabeza';
    cuerpo.add(aroSuperiorCabeza);

    const pernoCabeza = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.12, 20),
        matPiel.clone()
    );
    pernoCabeza.position.set(0, 2.66, 0);
    pernoCabeza.castShadow = true;
    pernoCabeza.userData.parte = 'cabeza';
    cuerpo.add(pernoCabeza);

    const cuello = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.25, 0.14, 20),
        matPiel.clone()
    );
    cuello.position.set(0, 1.94, 0);
    cuerpo.add(cuello);

    // 2. Torso trapezoidal clásico LEGO
    const torso = new THREE.Mesh(crearGeometriaTorsoLEGO(), matTorso);
    torso.position.set(0, 1.46, 0);
    torso.castShadow = true;
    cuerpo.add(torso);

    // 3. Brazos cilíndricos inclinados con manos en pinza C
    const construirBrazoLEGO = (ladoSigno) => {
        const pivote = new THREE.Group();
        pivote.position.set(ladoSigno * 0.51, 1.78, 0);
        pivote.rotation.z = ladoSigno * 0.11;

        const hombro = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), matTorso.clone());
        hombro.castShadow = true;

        const manga = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.125, 0.56, 14),
            matTorso.clone()
        );
        manga.position.set(0, -0.28, 0);
        manga.castShadow = true;

        const muneca = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10),
            matPiel.clone()
        );
        muneca.position.set(0, -0.6, 0.02);

        const mano = new THREE.Mesh(
            new THREE.TorusGeometry(0.105, 0.042, 10, 18, Math.PI * 1.45),
            matPiel.clone()
        );
        mano.position.set(0, -0.71, 0.04);
        mano.rotation.y = Math.PI / 2;
        mano.rotation.z = -Math.PI * 0.22;
        mano.castShadow = true;

        pivote.add(hombro, manga, muneca, mano);
        cuerpo.add(pivote);
        return { pivote, hombro, manga, muneca, mano };
    };

    const armIzq = construirBrazoLEGO(-1);
    const armDer = construirBrazoLEGO(1);

    // 4. Pelvis y piernas rectangulares articuladas desde la cadera (pies en y = 0)
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.4), matPierna.clone());
    pelvis.position.set(0, 0.94, 0);
    pelvis.castShadow = true;
    const divisorCadera = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.4), matPierna.clone());
    divisorCadera.position.set(0, 0.81, 0);
    cuerpo.add(pelvis, divisorCadera);

    const construirPiernaLEGO = (ladoX) => {
        const pivote = new THREE.Group();
        pivote.position.set(ladoX, 0.86, 0);

        const tamborCadera = new THREE.Mesh(
            new THREE.CylinderGeometry(0.155, 0.155, 0.3, 14),
            matPierna.clone()
        );
        tamborCadera.rotation.z = Math.PI / 2;

        const bloquePierna = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.7, 0.38),
            matPierna.clone()
        );
        bloquePierna.position.set(0, -0.39, 0);
        bloquePierna.castShadow = true;

        const pie = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.16, 0.45),
            matPierna.clone()
        );
        pie.position.set(0, -0.78, 0.035);
        pie.castShadow = true;

        pivote.add(tamborCadera, bloquePierna, pie);
        cuerpo.add(pivote);
        return { pivote, tamborCadera, bloquePierna, pie };
    };

    const legIzq = construirPiernaLEGO(-0.2);
    const legDer = construirPiernaLEGO(0.2);

    matPiel.dispose();
    matTorso.dispose();
    matPierna.dispose();

    // Contenedor de accesorios equipables
    const grupoAccesorios = new THREE.Group();
    grupoAccesorios.name = 'accesorios';
    cuerpo.add(grupoAccesorios);

    // Cartel flotante de nombre y nivel
    const texEtiqueta = crearTexturaEtiqueta(apodo, nivel);
    const matEtiqueta = new THREE.SpriteMaterial({
        map: texEtiqueta,
        transparent: true,
        depthTest: false
    });
    const etiqueta = new THREE.Sprite(matEtiqueta);
    etiqueta.position.set(0, 3.25, 0);
    etiqueta.scale.set(2.4, 0.6, 1);
    cuerpo.add(etiqueta);

    grupo.userData = {
        id,
        apodo,
        nivel,
        apariencia: { ...look },
        equipado: {},
        tiempoAnim: 0,
        cuerpo,
        grupoAccesorios,
        etiqueta,
        burbujaSprite: null,
        tiempoBurbuja: 0,
        auraMesh: null,
        kartGrupo: null,
        enKart: false,
        asientoOffset: null,
        anguloVolante: 0,
        velocidadKart: 0,
        turboActivoKart: false,
        partes: {
            cabeza,
            torso,
            brazoIzq: armIzq.mano,
            brazoDer: armDer.mano,
            piernaIzq: legIzq.bloquePierna,
            piernaDer: legDer.bloquePierna,
            pielExtras: [aroSuperiorCabeza, pernoCabeza, cuello, armIzq.muneca, armDer.muneca],
            torsoExtras: [armIzq.hombro, armIzq.manga, armDer.hombro, armDer.manga],
            piernasExtras: [
                pelvis,
                divisorCadera,
                legIzq.tamborCadera,
                legIzq.pie,
                legDer.tamborCadera,
                legDer.pie
            ]
        },
        pivotes: {
            brazoIzq: armIzq.pivote,
            brazoDer: armDer.pivote,
            piernaIzq: legIzq.pivote,
            piernaDer: legDer.pivote
        }
    };

    sincronizarAccesoriosAvatar(grupo, equipado);
    return grupo;
}

/**
 * Actualiza en tiempo real tonos de piel, torso, piernas, rostro y accesorios
 * sin fugas de memoria GPU.
 * @param {THREE.Group} grupoAvatar
 * @param {object} apariencia
 * @param {object|null} [equipado]
 */
export function actualizarAparienciaAvatar(grupoAvatar, apariencia = {}, equipado = null) {
    if (!grupoAvatar?.userData?.partes) return;
    const data = grupoAvatar.userData;
    const {
        cabeza,
        torso,
        brazoIzq,
        brazoDer,
        piernaIzq,
        piernaDer,
        pielExtras = [],
        torsoExtras = [],
        piernasExtras = []
    } = data.partes;

    const nueva = {
        piel: apariencia.piel || data.apariencia?.piel || '#f1c27d',
        torso: apariencia.torso || data.apariencia?.torso || '#00a8ff',
        piernas: apariencia.piernas || data.apariencia?.piernas || '#2f3640',
        rostro: apariencia.rostro || data.apariencia?.rostro || 'feliz'
    };

    if (Array.isArray(cabeza.material)) {
        for (let i = 0; i < cabeza.material.length; i++) {
            if (i === 0) {
                cabeza.material[i].map = obtenerTexturaRostro(nueva.rostro, nueva.piel);
                cabeza.material[i].needsUpdate = true;
            } else {
                cabeza.material[i].color.set(nueva.piel);
            }
        }
    }

    brazoIzq.material.color.set(nueva.piel);
    brazoDer.material.color.set(nueva.piel);
    for (const extra of pielExtras) {
        extra.material.color.set(nueva.piel);
    }

    torso.material.color.set(nueva.torso);
    for (const extra of torsoExtras) {
        extra.material.color.set(nueva.torso);
    }

    piernaIzq.material.color.set(nueva.piernas);
    piernaDer.material.color.set(nueva.piernas);
    for (const extra of piernasExtras) {
        extra.material.color.set(nueva.piernas);
    }

    data.apariencia = nueva;

    if (equipado) {
        sincronizarAccesoriosAvatar(grupoAvatar, equipado);
    }
}

/**
 * Muestra una burbuja de diálogo flotante 3D temporal sobre el avatar (4.5 s).
 * @param {THREE.Group} grupoAvatar
 * @param {string} texto
 */
export function mostrarBurbujaChatAvatar(grupoAvatar, texto) {
    if (!grupoAvatar?.userData?.cuerpo || !texto) return;
    const data = grupoAvatar.userData;

    if (data.burbujaSprite) {
        liberarObjeto3D(data.burbujaSprite);
        data.burbujaSprite = null;
    }

    const textura = crearTexturaBurbujaChat(texto);
    const mat = new THREE.SpriteMaterial({
        map: textura,
        transparent: true,
        depthTest: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, 3.95, 0);
    sprite.scale.set(3.4, 0.94, 1);

    data.cuerpo.add(sprite);
    data.burbujaSprite = sprite;
    data.tiempoBurbuja = 4.5;
}

/**
 * Construye el modelo 3D correspondiente a un accesorio ajustado al perno LEGO.
 * @param {string} itemId
 * @returns {THREE.Object3D|null}
 */
function construirMallaAccesorio(itemId) {
    const item = CATALOGO_ITEMS.find((entry) => entry.id === itemId);
    if (!item) return null;

    const grupo = new THREE.Group();
    grupo.name = `acc_${itemId}`;

    if (itemId === 'gorra_neon') {
        const mat = crearMaterialPlasticoABS({
            color: item.colorHex,
            emissive: 0x0891b2,
            emissiveIntensity: 0.35
        });
        const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.38, 0.24, 24), mat);
        copa.position.set(0, 2.66, 0);
        const visera = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.34), mat.clone());
        visera.position.set(0, 2.57, 0.35);
        grupo.add(copa, visera);
    } else if (itemId === 'visor_cibernetico') {
        const mat = crearMaterialPlasticoABS({
            color: item.colorHex,
            emissive: item.colorHex,
            emissiveIntensity: 0.9,
            roughness: 0.16
        });
        const lente = new THREE.Mesh(
            new THREE.CylinderGeometry(0.375, 0.375, 0.18, 20, 1, true, -0.7, 1.4),
            mat
        );
        lente.position.set(0, 2.34, 0);
        grupo.add(lente);
    } else if (itemId === 'corona_oro') {
        const mat = new THREE.MeshStandardMaterial({
            color: item.colorHex,
            emissive: 0x92400e,
            emissiveIntensity: 0.45,
            metalness: 0.8,
            roughness: 0.2
        });
        const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.24, 8), mat);
        aro.position.set(0, 2.74, 0);
        grupo.add(aro);
    } else if (itemId === 'mochila_jet') {
        const matBase = crearMaterialPlasticoABS({ color: item.colorHex });
        const matFuego = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.95
        });
        const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.68, 0.3), matBase);
        cuerpo.position.set(0, 1.46, -0.34);
        const turboIzq = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.26, 12), matFuego);
        turboIzq.position.set(-0.19, 1.04, -0.36);
        const turboDer = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.26, 12), matFuego.clone());
        turboDer.position.set(0.19, 1.04, -0.36);
        grupo.add(cuerpo, turboIzq, turboDer);
    } else if (itemId === 'alas_pixel') {
        const matAla = crearMaterialPlasticoABS({
            color: item.colorHex,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.55,
            transparent: true,
            opacity: 0.9
        });
        const alaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.54, 0.08), matAla);
        alaIzq.position.set(-0.62, 1.56, -0.28);
        alaIzq.rotation.y = 0.35;
        alaIzq.rotation.z = 0.22;

        const alaDer = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.54, 0.08), matAla.clone());
        alaDer.position.set(0.62, 1.56, -0.28);
        alaDer.rotation.y = -0.35;
        alaDer.rotation.z = -0.22;
        grupo.add(alaIzq, alaDer);
    } else if (itemId === 'aura_estelar') {
        const mat = new THREE.MeshStandardMaterial({
            color: item.colorHex,
            emissive: item.colorHex,
            emissiveIntensity: 0.9,
            transparent: true,
            opacity: 0.85
        });
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 8, 32), mat);
        anillo.rotation.x = Math.PI / 2;
        anillo.position.set(0, 1.25, 0);
        anillo.userData.esAura = true;
        grupo.add(anillo);
    }

    return grupo;
}

/**
 * Reemplaza los accesorios 3D equipados en el avatar liberando los anteriores.
 * @param {THREE.Group} grupoAvatar
 * @param {object} equipado
 */
export function sincronizarAccesoriosAvatar(grupoAvatar, equipado = {}) {
    if (!grupoAvatar?.userData?.grupoAccesorios) return;
    const { grupoAccesorios } = grupoAvatar.userData;

    for (const hijo of [...grupoAccesorios.children]) {
        liberarObjeto3D(hijo);
    }

    grupoAvatar.userData.auraMesh = null;
    grupoAvatar.userData.equipado = { ...equipado };

    for (const slot of ['cabeza', 'espalda', 'aura']) {
        const itemId = slot === 'aura' ? (equipado.aura ?? equipado.efecto) : equipado[slot];
        if (!itemId) continue;
        const malla = construirMallaAccesorio(itemId);
        if (malla) {
            grupoAccesorios.add(malla);
            if (slot === 'aura') {
                grupoAvatar.userData.auraMesh = malla;
            }
        }
    }
}

/**
 * Actualiza el texto flotante de apodo y nivel si cambió.
 * @param {THREE.Group} grupoAvatar
 * @param {string} apodo
 * @param {number} nivel
 */
export function actualizarEtiquetaAvatar(grupoAvatar, apodo, nivel) {
    if (!grupoAvatar?.userData?.etiqueta) return;
    const data = grupoAvatar.userData;
    if (data.apodo === apodo && data.nivel === nivel) return;

    data.apodo = apodo;
    data.nivel = nivel;

    const mat = data.etiqueta.material;
    if (mat.map && mat.map.userData?.esClonTemporal) {
        mat.map.dispose();
    }
    mat.map = crearTexturaEtiqueta(apodo, nivel);
    mat.needsUpdate = true;
}

/**
 * Aplica animación procedural LEGO al avatar según movimiento o gesto social.
 * @param {THREE.Group} grupoAvatar
 * @param {number} dt
 * @param {'idle'|'caminar'|'correr'|'saltar'|'saludar'|'bailar'|'celebrar'|'sentarse'} estadoAnim
 */
export function actualizarAnimacionAvatar(grupoAvatar, dt, estadoAnim = 'idle') {
    if (!grupoAvatar?.userData?.pivotes) return;
    const data = grupoAvatar.userData;
    const { brazoIzq, brazoDer, piernaIzq, piernaDer } = data.pivotes;
    const cuerpo = data.cuerpo;
    data.tiempoAnim += dt;
    const t = data.tiempoAnim;

    if (data.burbujaSprite) {
        data.tiempoBurbuja -= dt;
        if (data.tiempoBurbuja <= 0) {
            liberarObjeto3D(data.burbujaSprite);
            data.burbujaSprite = null;
            data.tiempoBurbuja = 0;
        }
    }

    const lerp = (actual, destino, factor) => actual + (destino - actual) * Math.min(1, factor);
    let alturaCuerpo = 0;
    let desplazamientoZCuerpo = 0;
    let giroCuerpo = 0;

    if (estadoAnim === 'en_kart') {
        const offset = data.asientoOffset || { x: 0, y: 0.34, z: -0.08 };
        const giroVol = data.anguloVolante || 0;
        alturaCuerpo = offset.y - 0.72;
        desplazamientoZCuerpo = offset.z;

        piernaIzq.rotation.x = lerp(piernaIzq.rotation.x, -1.48, dt * 16);
        piernaDer.rotation.x = lerp(piernaDer.rotation.x, -1.48, dt * 16);
        brazoIzq.rotation.x = lerp(brazoIzq.rotation.x, -1.12 - giroVol * 0.18, dt * 16);
        brazoDer.rotation.x = lerp(brazoDer.rotation.x, -1.12 + giroVol * 0.18, dt * 16);
        brazoIzq.rotation.z = lerp(brazoIzq.rotation.z, 0.16, dt * 16);
        brazoDer.rotation.z = lerp(brazoDer.rotation.z, -0.16, dt * 16);

        if (data.kartGrupo?.userData) {
            const kData = data.kartGrupo.userData;
            const vel = data.velocidadKart || 0;
            for (const rueda of kData.ruedasMeshes || []) {
                rueda.rotation.x += vel * dt * 2.1;
            }
            for (const piv of kData.pivotesDelanteros || []) {
                piv.rotation.y = lerp(piv.rotation.y, giroVol * 0.42, dt * 14);
            }
            if (kData.volanteMesh) {
                kData.volanteMesh.rotation.z = lerp(kData.volanteMesh.rotation.z, -giroVol * 0.85, dt * 14);
            }
            const turbo = Boolean(data.turboActivoKart);
            for (const flama of kData.flamasEscape || []) {
                const escala = turbo ? 1.45 + Math.sin(t * 28) * 0.35 : Math.abs(vel) > 1 ? 0.65 + Math.sin(t * 18) * 0.15 : 0.01;
                flama.visible = escala > 0.05;
                flama.scale.set(turbo ? 1.25 : 0.85, escala, turbo ? 1.25 : 0.85);
            }
        }
    } else if (estadoAnim === 'saltar') {
        brazoIzq.rotation.x = lerp(brazoIzq.rotation.x, -2.5, dt * 14);
        brazoDer.rotation.x = lerp(brazoDer.rotation.x, -2.5, dt * 14);
        brazoIzq.rotation.z = lerp(brazoIzq.rotation.z, -0.22, dt * 12);
        brazoDer.rotation.z = lerp(brazoDer.rotation.z, 0.22, dt * 12);
        piernaIzq.rotation.x = lerp(piernaIzq.rotation.x, 0.35, dt * 12);
        piernaDer.rotation.x = lerp(piernaDer.rotation.x, -0.35, dt * 12);
    } else if (estadoAnim === 'saludar') {
        brazoIzq.rotation.x = lerp(brazoIzq.rotation.x, 0, dt * 10);
        brazoIzq.rotation.z = lerp(brazoIzq.rotation.z, -0.11, dt * 10);
        piernaIzq.rotation.x = lerp(piernaIzq.rotation.x, 0, dt * 10);
        piernaDer.rotation.x = lerp(piernaDer.rotation.x, 0, dt * 10);
        brazoDer.rotation.x = lerp(brazoDer.rotation.x, -2.65, dt * 14);
        brazoDer.rotation.z = Math.sin(t * 14) * 0.32 + 0.22;
    } else if (estadoAnim === 'bailar') {
        const compas = Math.sin(t * 8.5);
        alturaCuerpo = Math.abs(compas) * 0.14;
        giroCuerpo = Math.sin(t * 4.25) * 0.25;
        brazoIzq.rotation.x = -1.15 + compas * 0.9;
        brazoDer.rotation.x = -1.15 - compas * 0.9;
        brazoIzq.rotation.z = -0.38 - compas * 0.22;
        brazoDer.rotation.z = 0.38 + compas * 0.22;
        piernaIzq.rotation.x = compas * 0.45;
        piernaDer.rotation.x = -compas * 0.45;
    } else if (estadoAnim === 'celebrar') {
        alturaCuerpo = Math.abs(Math.sin(t * 7)) * 0.26;
        brazoIzq.rotation.x = lerp(brazoIzq.rotation.x, -2.65, dt * 14);
        brazoDer.rotation.x = lerp(brazoDer.rotation.x, -2.65, dt * 14);
        brazoIzq.rotation.z = -0.35 - Math.sin(t * 10) * 0.12;
        brazoDer.rotation.z = 0.35 + Math.sin(t * 10) * 0.12;
        piernaIzq.rotation.x = Math.sin(t * 7) * 0.25;
        piernaDer.rotation.x = -Math.sin(t * 7) * 0.25;
    } else if (estadoAnim === 'sentarse') {
        alturaCuerpo = -0.5;
        brazoIzq.rotation.x = lerp(brazoIzq.rotation.x, -0.55, dt * 10);
        brazoDer.rotation.x = lerp(brazoDer.rotation.x, -0.55, dt * 10);
        brazoIzq.rotation.z = lerp(brazoIzq.rotation.z, -0.15, dt * 10);
        brazoDer.rotation.z = lerp(brazoDer.rotation.z, 0.15, dt * 10);
        piernaIzq.rotation.x = lerp(piernaIzq.rotation.x, -1.45, dt * 10);
        piernaDer.rotation.x = lerp(piernaDer.rotation.x, -1.45, dt * 10);
    } else if (estadoAnim === 'caminar' || estadoAnim === 'correr') {
        const freq = estadoAnim === 'correr' ? 14 : 9;
        const amp = estadoAnim === 'correr' ? 0.85 : 0.55;
        const osc = Math.sin(t * freq) * amp;
        brazoIzq.rotation.x = osc;
        brazoDer.rotation.x = -osc;
        brazoIzq.rotation.z = lerp(brazoIzq.rotation.z, -0.11, dt * 12);
        brazoDer.rotation.z = lerp(brazoDer.rotation.z, 0.11, dt * 12);
        piernaIzq.rotation.x = -osc;
        piernaDer.rotation.x = osc;
    } else {
        const resp = Math.sin(t * 2.2) * 0.04;
        brazoIzq.rotation.x = lerp(brazoIzq.rotation.x, resp, dt * 10);
        brazoDer.rotation.x = lerp(brazoDer.rotation.x, -resp, dt * 10);
        brazoIzq.rotation.z = lerp(brazoIzq.rotation.z, -0.11, dt * 10);
        brazoDer.rotation.z = lerp(brazoDer.rotation.z, 0.11, dt * 10);
        piernaIzq.rotation.x = lerp(piernaIzq.rotation.x, 0, dt * 10);
        piernaDer.rotation.x = lerp(piernaDer.rotation.x, 0, dt * 10);
    }

    if (cuerpo) {
        cuerpo.position.y = lerp(cuerpo.position.y, alturaCuerpo, dt * 12);
        cuerpo.position.z = lerp(cuerpo.position.z, desplazamientoZCuerpo, dt * 12);
        cuerpo.rotation.y = lerp(cuerpo.rotation.y, giroCuerpo, dt * 12);
    }

    if (data.auraMesh) {
        data.auraMesh.rotation.y += dt * 1.8;
    }
}

/**
 * Crea un volumen esculpido mediante `THREE.ExtrudeGeometry` desde un perfil lateral `(z, y)`
 * orientado con el frente del vehículo hacia `+Z`.
 * @param {(shape: THREE.Shape) => void} dibujarShape
 * @param {number} ancho
 * @param {object} [opts]
 * @returns {THREE.ExtrudeGeometry}
 */
function crearPerfilExtruido(dibujarShape, ancho, opts = {}) {
    const shape = new THREE.Shape();
    dibujarShape(shape);
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: ancho,
        bevelEnabled: true,
        bevelThickness: opts.bevelThickness ?? 0.04,
        bevelSize: opts.bevelSize ?? 0.035,
        bevelSegments: opts.bevelSegments ?? 3,
        curveSegments: opts.curveSegments ?? 12
    });
    geo.translate(0, 0, -ancho / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
}

/**
 * Construye un superdeportivo / kart conceptual 3D de cabina abierta esculpido con `ExtrudeGeometry`,
 * laca automotriz PBR (`clearcoat: 1.0`), parabrisas curvo translúcido, LEDs y rines multirrayo con pinzas.
 * El frente del vehículo apunta hacia `+Z`.
 * @param {object} [configKart]
 * @returns {THREE.Group}
 */
export function ensamblarKart3D(configKart = {}) {
    const chasisDef = CATALOGO_KARTS.find((c) => c.id === configKart.chasis) || CATALOGO_KARTS[0];
    const ruedaDef =
        CATALOGO_PIEZAS_KART.ruedas.find((r) => r.id === configKart.ruedas) ||
        CATALOGO_PIEZAS_KART.ruedas[0];
    const aleronDef =
        CATALOGO_PIEZAS_KART.alerones.find((a) => a.id === configKart.aleron) ||
        CATALOGO_PIEZAS_KART.alerones[1];
    const colorPrincipal = configKart.color || '#ff2e4c';

    const esStealth = chasisDef.id === 'kart_batmovil';
    const esConcept = chasisDef.id === 'kart_tumbler';
    const esApex = chasisDef.id === 'kart_formula';
    const esLeMans = chasisDef.id === 'kart_lemans';

    const kart = new THREE.Group();
    kart.name = `kart_${chasisDef.id}`;

    const texChasis = obtenerTexturaChasisKart(chasisDef.id, colorPrincipal);
    const texNeumatico = obtenerTexturaNeumatico(ruedaDef.id);

    const matCarroceria = new THREE.MeshPhysicalMaterial({
        map: texChasis.map,
        bumpMap: texChasis.bumpMap,
        bumpScale: 0.025,
        roughnessMap: texChasis.roughnessMap,
        roughness: esStealth ? 0.34 : 0.2,
        metalness: esConcept ? 0.58 : 0.45,
        clearcoat: 1.0,
        clearcoatRoughness: esStealth ? 0.28 : 0.12
    });
    const matAcentoColor = new THREE.MeshPhysicalMaterial({
        color: colorPrincipal,
        roughness: 0.18,
        metalness: 0.45,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12
    });
    const matCarbono = new THREE.MeshPhysicalMaterial({
        color: 0x0b1120,
        roughness: 0.36,
        metalness: 0.32,
        clearcoat: 0.45,
        clearcoatRoughness: 0.26
    });
    const matParabrisas = new THREE.MeshPhysicalMaterial({
        color: esConcept ? 0x082f49 : 0x0f172a,
        roughness: 0.08,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide
    });
    const matAsiento = crearMaterialPlasticoABS({ color: 0x0f172a, roughness: 0.52 });
    const matCromo = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.16 });
    const matLedDelantero = new THREE.MeshStandardMaterial({
        color: esConcept ? 0x67e8f9 : 0xfef9c3,
        emissive: esConcept ? 0x22d3ee : 0xe0f2fe,
        emissiveIntensity: 1.5
    });
    const matNeonCian = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.35
    });
    const matPilotoTrasero = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 1.35
    });
    const matNeumatico = new THREE.MeshStandardMaterial({
        map: texNeumatico.map,
        bumpMap: texNeumatico.bumpMap,
        bumpScale: 0.032,
        roughnessMap: texNeumatico.roughnessMap,
        roughness: 0.8,
        emissive: ruedaDef.emisivo ? 0x0e7490 : 0x000000,
        emissiveMap: ruedaDef.emisivo ? texNeumatico.map : null,
        emissiveIntensity: ruedaDef.emisivo ? 0.65 : 0
    });
    const matLlanta = new THREE.MeshStandardMaterial({
        color: esConcept ? 0x22d3ee : ruedaDef.colorLlanta,
        emissive: ruedaDef.emisivo || esConcept ? (esConcept ? 0x06b6d4 : ruedaDef.colorLlanta) : 0x000000,
        emissiveIntensity: ruedaDef.emisivo || esConcept ? 0.85 : 0,
        metalness: 0.88,
        roughness: 0.16
    });
    const colorPinza = esConcept || ruedaDef.emisivo ? 0x22d3ee : esStealth ? 0xf59e0b : 0xef4444;
    const matPinza = new THREE.MeshStandardMaterial({
        color: colorPinza,
        metalness: 0.55,
        roughness: 0.28
    });
    const matRotor = new THREE.MeshStandardMaterial({
        map: texNeumatico.rotorMap,
        metalness: 0.78,
        roughness: 0.28,
        side: THREE.DoubleSide
    });

    const plantillasMat = [
        matCarroceria,
        matAcentoColor,
        matCarbono,
        matParabrisas,
        matAsiento,
        matCromo,
        matLedDelantero,
        matNeonCian,
        matPilotoTrasero,
        matNeumatico,
        matLlanta,
        matPinza,
        matRotor
    ];
    const plantillasGeo = [];
    const agregar = (geo, mat, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sombra = true) => {
        const mesh = new THREE.Mesh(geo.clone(), mat.clone());
        mesh.position.set(px, py, pz);
        if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
        mesh.castShadow = sombra;
        mesh.receiveShadow = true;
        kart.add(mesh);
        return mesh;
    };

    const alturaBase = 0.22;

    // 1. Fondo plano aerodinámico de carbono, splitter frontal y difusor trasero con 4 aletas
    const geoPiso = crearPerfilExtruido((s) => {
        s.moveTo(-1.26, 0);
        s.lineTo(1.32, 0);
        s.lineTo(1.26, 0.08);
        s.lineTo(-1.24, 0.08);
        s.closePath();
    }, 1.18, { bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 });
    plantillasGeo.push(geoPiso);
    agregar(geoPiso, matCarbono, 0, alturaBase - 0.03, 0);

    const geoSplitter = crearPerfilExtruido((s) => {
        s.moveTo(0.86, -0.02);
        s.lineTo(1.46, -0.02);
        s.quadraticCurveTo(1.5, 0.02, 1.38, 0.05);
        s.lineTo(0.86, 0.05);
        s.closePath();
    }, 1.48, { bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    plantillasGeo.push(geoSplitter);
    agregar(geoSplitter, matCarbono, 0, alturaBase - 0.02, 0);

    const difusorBase = new THREE.BoxGeometry(1.24, 0.09, 0.34);
    const aletaDifusor = new THREE.BoxGeometry(0.04, 0.16, 0.3);
    plantillasGeo.push(difusorBase, aletaDifusor);
    agregar(difusorBase, matCarbono, 0, alturaBase - 0.01, -1.24);
    for (const dx of [-0.42, -0.14, 0.14, 0.42]) {
        agregar(aletaDifusor, matCarbono, dx, alturaBase + 0.02, -1.26, 0, 0, 0, false);
    }

    // 2. Pontones laterales aerodinámicos esculpidos + tomas de aire empotradas
    const geoPonton = crearPerfilExtruido((s) => {
        s.moveTo(-0.88, 0);
        s.lineTo(0.72, 0);
        s.quadraticCurveTo(0.78, 0.16, 0.56, 0.25);
        s.quadraticCurveTo(0.05, 0.31, -0.44, 0.32);
        s.quadraticCurveTo(-0.82, 0.3, -0.92, 0.12);
        s.closePath();
    }, 0.28);
    const geoMarcoToma = new THREE.BoxGeometry(0.2, 0.17, 0.12);
    plantillasGeo.push(geoPonton, geoMarcoToma);

    for (const sx of [-1, 1]) {
        agregar(geoPonton, matCarroceria, sx * 0.62, alturaBase + 0.03, 0);
        agregar(geoMarcoToma, matCarbono, sx * 0.63, alturaBase + 0.16, 0.64, 0, 0, 0, false);
        if (esConcept) {
            const tiraSide = new THREE.BoxGeometry(0.03, 0.03, 1.28);
            plantillasGeo.push(tiraSide);
            agregar(tiraSide, matNeonCian, sx * 0.77, alturaBase + 0.18, -0.04, 0, 0, 0, false);
        }
    }

    // 3. Cabina abierta ergonómica (asiento cubo, consola LED, volante deportivo D)
    const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.12), matAsiento.clone());
    respaldo.position.set(0, alturaBase + 0.38, -0.48);
    respaldo.rotation.x = -0.22;
    const bolsterGeo = new THREE.BoxGeometry(0.09, 0.36, 0.34);
    plantillasGeo.push(bolsterGeo);
    const tablero = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.26), matCarbono.clone());
    tablero.position.set(0, alturaBase + 0.34, 0.54);
    const pantalla = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.09, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.95 })
    );
    pantalla.position.set(0, alturaBase + 0.42, 0.44);
    pantalla.rotation.x = -0.35;
    kart.add(respaldo, tablero, pantalla);
    agregar(bolsterGeo, matAsiento, -0.34, alturaBase + 0.28, -0.34, 0, 0, 0, false);
    agregar(bolsterGeo, matAsiento, 0.34, alturaBase + 0.28, -0.34, 0, 0, 0, false);

    // Parabrisas curvo envolvente translúcido (mantiene cabina abierta y piloto 100% visible)
    const geoParabrisas = new THREE.CylinderGeometry(0.46, 0.52, 0.3, 20, 1, true, -0.92, 1.84);
    plantillasGeo.push(geoParabrisas);
    agregar(geoParabrisas, matParabrisas, 0, alturaBase + 0.48, 0.36, -0.58, 0, 0, false);

    // Columna de dirección y volante deportivo
    const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.52, 10), matCromo.clone());
    columna.position.set(0, alturaBase + 0.47, 0.56);
    columna.rotation.x = -0.58;
    kart.add(columna);

    const volanteMesh = new THREE.Group();
    volanteMesh.position.set(0, alturaBase + 0.67, 0.4);
    volanteMesh.rotation.x = -0.35;
    const aroVolante = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 18), matAsiento.clone());
    const barraVolante = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.036, 0.03), matCromo.clone());
    const centroVolante = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), matAcentoColor.clone());
    centroVolante.rotation.x = Math.PI / 2;
    volanteMesh.add(aroVolante, barraVolante, centroVolante);
    kart.add(volanteMesh);

    // 4. Capó trasero esculpido, faros traseros LED y escapes con flama turbo
    const geoMotor = crearPerfilExtruido((s) => {
        s.moveTo(-1.18, 0.06);
        s.lineTo(-0.48, 0.06);
        s.lineTo(-0.48, 0.42);
        s.quadraticCurveTo(-0.82, 0.4, -1.16, 0.25);
        s.closePath();
    }, 0.78);
    plantillasGeo.push(geoMotor);
    agregar(geoMotor, matCarroceria, 0, alturaBase + 0.02, 0);

    // Barra LED trasera continua de ancho completo
    const geoLuzTras = new THREE.BoxGeometry(1.14, 0.055, 0.06);
    plantillasGeo.push(geoLuzTras);
    agregar(geoLuzTras, matPilotoTrasero, 0, alturaBase + 0.23, -1.2, 0, 0, 0, false);

    const flamasEscape = [];
    const matFlama = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
    plantillasMat.push(matFlama);
    const geoTuboEsc = new THREE.CylinderGeometry(0.055, 0.07, 0.34, 10);
    const geoFlama = new THREE.ConeGeometry(0.068, 0.34, 8);
    plantillasGeo.push(geoTuboEsc, geoFlama);
    for (const ex of [-0.28, 0.28]) {
        agregar(geoTuboEsc, matCromo, ex, alturaBase + 0.14, -1.22, Math.PI / 2, 0, 0, false);
        const flama = agregar(geoFlama, matFlama, ex, alturaBase + 0.14, -1.48, -Math.PI / 2, 0, 0, false);
        flama.visible = false;
        flamasEscape.push(flama);
    }

    // Helper para arcos de pasos de rueda esculpidos con ExtrudeGeometry
    const geoPasoRueda = crearPerfilExtruido((s) => {
        s.moveTo(-0.32, 0.04);
        s.quadraticCurveTo(-0.24, 0.27, 0, 0.29);
        s.quadraticCurveTo(0.24, 0.27, 0.32, 0.04);
        s.lineTo(0.23, 0.04);
        s.quadraticCurveTo(0.16, 0.19, 0, 0.2);
        s.quadraticCurveTo(-0.16, 0.19, -0.23, 0.04);
        s.closePath();
    }, 0.32, { bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 });
    plantillasGeo.push(geoPasoRueda);

    // 5. Carrocería esculpida específica por arquetipo
    if (esStealth) {
        // Interceptor Nocturno: roadster stealth afilado con turbina frontal y doble aleta murciélago
        const geoMorroBat = crearPerfilExtruido((s) => {
            s.moveTo(0.46, 0.04);
            s.lineTo(1.38, 0.04);
            s.quadraticCurveTo(1.48, 0.14, 1.32, 0.23);
            s.quadraticCurveTo(0.92, 0.34, 0.46, 0.37);
            s.closePath();
        }, 0.78);
        const geoAletaBat = crearPerfilExtruido((s) => {
            s.moveTo(-1.26, 0.18);
            s.lineTo(-0.56, 0.24);
            s.quadraticCurveTo(-0.92, 0.62, -1.28, 0.74);
            s.quadraticCurveTo(-1.12, 0.46, -1.26, 0.18);
            s.closePath();
        }, 0.06, { bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
        plantillasGeo.push(geoMorroBat, geoAletaBat);

        agregar(geoMorroBat, matCarroceria, 0, alturaBase + 0.02, 0);
        for (const [fx, fz] of [
            [-0.72, 0.84],
            [0.72, 0.84],
            [-0.72, -0.78],
            [0.72, -0.78]
        ]) {
            agregar(geoPasoRueda, matCarroceria, fx, alturaBase + 0.14, fz);
        }

        // Turbina frontal incrustada con núcleo luminoso
        const turbina = new THREE.CylinderGeometry(0.16, 0.2, 0.34, 16);
        const nucleoGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14);
        const matNucleo = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xf59e0b,
            emissiveIntensity: 1.45
        });
        plantillasGeo.push(turbina, nucleoGeo);
        plantillasMat.push(matNucleo);
        agregar(turbina, matCarbono, 0, alturaBase + 0.15, 1.28, Math.PI / 2, 0, 0);
        agregar(nucleoGeo, matNucleo, 0, alturaBase + 0.15, 1.44, Math.PI / 2, 0, 0, false);

        // Faros LED afilados + tomas ámbar
        const faroGeo = new THREE.BoxGeometry(0.28, 0.045, 0.08);
        plantillasGeo.push(faroGeo);
        agregar(faroGeo, matLedDelantero, -0.46, alturaBase + 0.2, 1.28, 0, -0.18, 0, false);
        agregar(faroGeo, matLedDelantero, 0.46, alturaBase + 0.2, 1.28, 0, 0.18, 0, false);

        // Aletas murciélago gemelas inclinadas hacia afuera
        agregar(geoAletaBat, matCarroceria, -0.48, alturaBase + 0.08, 0, 0, 0, 0.24);
        agregar(geoAletaBat, matCarroceria, 0.48, alturaBase + 0.08, 0, 0, 0, -0.24);

        // Postquemador central
        const propGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.38, 14);
        const aroJetGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
        const flamaJetGeo = new THREE.ConeGeometry(0.11, 0.5, 10);
        const matFlamaJet = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 });
        plantillasGeo.push(propGeo, aroJetGeo, flamaJetGeo);
        plantillasMat.push(matFlamaJet);
        agregar(propGeo, matCromo, 0, alturaBase + 0.28, -1.22, Math.PI / 2, 0, 0);
        agregar(aroJetGeo, matNucleo, 0, alturaBase + 0.28, -1.4, 0, 0, 0, false);
        const flamaJet = agregar(flamaJetGeo, matFlamaJet, 0, alturaBase + 0.28, -1.64, -Math.PI / 2, 0, 0, false);
        flamaJet.visible = false;
        flamasEscape.push(flamaJet);
    } else if (esApex) {
        // Superdeportivo Apex: roadster estilo Ferrari/McLaren con morro bajo esculpido y arcos speedster
        const geoMorroApex = crearPerfilExtruido((s) => {
            s.moveTo(0.45, 0.04);
            s.lineTo(1.36, 0.04);
            s.quadraticCurveTo(1.48, 0.12, 1.3, 0.22);
            s.quadraticCurveTo(0.88, 0.35, 0.45, 0.37);
            s.closePath();
        }, 0.84);
        const geoCubiertaSpeedster = crearPerfilExtruido((s) => {
            s.moveTo(-1.14, 0.26);
            s.lineTo(-0.48, 0.26);
            s.quadraticCurveTo(-0.56, 0.5, -0.84, 0.44);
            s.quadraticCurveTo(-1.08, 0.38, -1.14, 0.26);
            s.closePath();
        }, 0.24, { bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 });
        plantillasGeo.push(geoMorroApex, geoCubiertaSpeedster);

        agregar(geoMorroApex, matCarroceria, 0, alturaBase + 0.02, 0);
        for (const [fx, fz] of [
            [-0.72, 0.84],
            [0.72, 0.84],
            [-0.72, -0.78],
            [0.72, -0.78]
        ]) {
            agregar(geoPasoRueda, matCarroceria, fx, alturaBase + 0.14, fz);
        }

        // Faros LED delgados tipo hoja superdeportiva
        const faroApexGeo = new THREE.BoxGeometry(0.3, 0.045, 0.12);
        plantillasGeo.push(faroApexGeo);
        agregar(faroApexGeo, matLedDelantero, -0.5, alturaBase + 0.21, 1.24, 0.08, -0.25, 0, false);
        agregar(faroApexGeo, matLedDelantero, 0.5, alturaBase + 0.21, 1.24, 0.08, 0.25, 0, false);

        // Jorobas dobles detrás del asiento (estilo Speedster abierto)
        agregar(geoCubiertaSpeedster, matCarroceria, -0.27, alturaBase + 0.04, 0);
        agregar(geoCubiertaSpeedster, matCarroceria, 0.27, alturaBase + 0.04, 0);
    } else if (esLeMans) {
        // Hypercar Le Mans GT: ancho prototipo abierto con aleta dorsal Shark Fin y 4 faros LED
        const geoCapotLM = crearPerfilExtruido((s) => {
            s.moveTo(0.46, 0.04);
            s.lineTo(1.38, 0.04);
            s.quadraticCurveTo(1.44, 0.16, 1.22, 0.27);
            s.quadraticCurveTo(0.84, 0.36, 0.46, 0.38);
            s.closePath();
        }, 0.94);
        const geoSharkFin = crearPerfilExtruido((s) => {
            s.moveTo(-1.18, 0.32);
            s.lineTo(-0.56, 0.34);
            s.quadraticCurveTo(-0.68, 0.66, -0.96, 0.62);
            s.lineTo(-1.18, 0.38);
            s.closePath();
        }, 0.055, { bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
        plantillasGeo.push(geoCapotLM, geoSharkFin);

        agregar(geoCapotLM, matCarroceria, 0, alturaBase + 0.02, 0);
        for (const [fx, fz] of [
            [-0.73, 0.84],
            [0.73, 0.84],
            [-0.73, -0.78],
            [0.73, -0.78]
        ]) {
            agregar(geoPasoRueda, matCarroceria, fx, alturaBase + 0.15, fz);
        }
        agregar(geoSharkFin, matCarroceria, 0, alturaBase + 0.04, 0);

        const faroLMGeo = new THREE.BoxGeometry(0.16, 0.05, 0.08);
        plantillasGeo.push(faroLMGeo);
        for (const fx of [-0.66, -0.42, 0.42, 0.66]) {
            agregar(faroLMGeo, matLedDelantero, fx, alturaBase + 0.22, 1.27, 0, 0, 0, false);
        }
    } else {
        // Concepto Futurista Neon: carrocería fluida negro metálico con acentos de color y barras LED cian
        const geoMorroConcept = crearPerfilExtruido((s) => {
            s.moveTo(0.45, 0.04);
            s.lineTo(1.4, 0.05);
            s.quadraticCurveTo(1.48, 0.16, 1.26, 0.26);
            s.quadraticCurveTo(0.84, 0.36, 0.45, 0.38);
            s.closePath();
        }, 0.9);
        const geoAeroBlade = crearPerfilExtruido((s) => {
            s.moveTo(-1.1, 0.22);
            s.lineTo(0.82, 0.14);
            s.quadraticCurveTo(0.92, 0.25, 0.64, 0.3);
            s.quadraticCurveTo(-0.35, 0.38, -1.1, 0.34);
            s.closePath();
        }, 0.08, { bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
        plantillasGeo.push(geoMorroConcept, geoAeroBlade);

        agregar(geoMorroConcept, matCarroceria, 0, alturaBase + 0.02, 0);
        for (const [fx, fz] of [
            [-0.72, 0.84],
            [0.72, 0.84],
            [-0.72, -0.78],
            [0.72, -0.78]
        ]) {
            agregar(geoPasoRueda, matCarroceria, fx, alturaBase + 0.15, fz);
            agregar(geoPasoRueda, matAcentoColor, fx, alturaBase + 0.17, fz, 0, 0, 0, false).scale.set(0.75, 0.85, 0.85);
        }
        agregar(geoAeroBlade, matAcentoColor, -0.78, alturaBase + 0.06, 0);
        agregar(geoAeroBlade, matAcentoColor, 0.78, alturaBase + 0.06, 0);

        // Barra LED frontal futurista de ancho completo + luz trasera cian de refuerzo
        const barraLedFront = new THREE.BoxGeometry(1.18, 0.04, 0.08);
        const barraLedTras = new THREE.BoxGeometry(0.92, 0.035, 0.05);
        plantillasGeo.push(barraLedFront, barraLedTras);
        agregar(barraLedFront, matNeonCian, 0, alturaBase + 0.19, 1.36, 0, 0, 0, false);
        agregar(barraLedTras, matNeonCian, 0, alturaBase + 0.32, -1.16, 0, 0, 0, false);
    }

    // 6. Ruedas perfil bajo, rines de aleación multirrayo (metalness: 0.88), disco ventilado y pinza de freno
    const r = ruedaDef.radio;
    const w = ruedaDef.ancho;
    const offsetX = 0.76;
    const geoNeumatico = new THREE.CylinderGeometry(r, r, w, 28);
    geoNeumatico.rotateZ(Math.PI / 2);
    const geoHombroTire = new THREE.TorusGeometry(r * 0.84, r * 0.14, 10, 24);
    geoHombroTire.rotateY(Math.PI / 2);
    const geoAroExterno = new THREE.TorusGeometry(r * 0.58, r * 0.055, 8, 22);
    geoAroExterno.rotateY(Math.PI / 2);
    const geoTamborLlanta = new THREE.CylinderGeometry(r * 0.56, r * 0.56, w * 0.72, 18);
    geoTamborLlanta.rotateZ(Math.PI / 2);
    const geoRayo = new THREE.BoxGeometry(w * 0.38, r * 0.54, r * 0.11);
    const geoTuerca = new THREE.CylinderGeometry(r * 0.17, r * 0.19, w * 0.55, 10);
    geoTuerca.rotateZ(Math.PI / 2);
    const geoRotor = new THREE.CircleGeometry(r * 0.5, 18);
    const geoPinza = new THREE.BoxGeometry(w * 0.36, r * 0.36, r * 0.22);
    plantillasGeo.push(geoNeumatico, geoHombroTire, geoAroExterno, geoTamborLlanta, geoRayo, geoTuerca, geoRotor, geoPinza);

    const ruedasMeshes = [];
    const pivotesDelanteros = [];

    const crearRueda = (px, pz, esDelantera) => {
        const pivote = new THREE.Group();
        pivote.position.set(px, r, pz);
        const signoCara = px < 0 ? -1 : 1;

        const ruedaGrupo = new THREE.Group();
        const goma = new THREE.Mesh(geoNeumatico.clone(), matNeumatico.clone());
        goma.castShadow = true;
        const hombroExt = new THREE.Mesh(geoHombroTire.clone(), matNeumatico.clone());
        hombroExt.position.x = signoCara * (w * 0.42);
        const tambor = new THREE.Mesh(geoTamborLlanta.clone(), matCarbono.clone());
        const aro = new THREE.Mesh(geoAroExterno.clone(), matLlanta.clone());
        aro.position.x = signoCara * (w * 0.42);
        const tuerca = new THREE.Mesh(geoTuerca.clone(), matAcentoColor.clone());
        tuerca.position.x = signoCara * (w * 0.25);
        ruedaGrupo.add(goma, hombroExt, tambor, aro, tuerca);

        // 5 radios metálicos escamoteados en ángulo 72°
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            const rayo = new THREE.Mesh(geoRayo.clone(), matLlanta.clone());
            rayo.position.set(signoCara * (w * 0.28), Math.cos(ang) * (r * 0.3), Math.sin(ang) * (r * 0.3));
            rayo.rotation.x = ang;
            ruedaGrupo.add(rayo);
        }

        // Disco ventilado y pinza de freno de color fija en el pivote
        const rotor = new THREE.Mesh(geoRotor.clone(), matRotor.clone());
        rotor.rotation.y = px < 0 ? -Math.PI / 2 : Math.PI / 2;
        rotor.position.x = signoCara * (w * 0.14);

        const pinza = new THREE.Mesh(geoPinza.clone(), matPinza.clone());
        pinza.position.set(signoCara * (w * 0.18), r * 0.22, -r * 0.3);

        pivote.add(ruedaGrupo, rotor, pinza);
        kart.add(pivote);

        ruedasMeshes.push(ruedaGrupo);
        if (esDelantera) pivotesDelanteros.push(pivote);
    };

    crearRueda(-offsetX, 0.84, true);
    crearRueda(offsetX, 0.84, true);
    crearRueda(-offsetX, -0.78, false);
    crearRueda(offsetX, -0.78, false);

    // 7. Alerón trasero aerodinámico según selección de pieza
    if (aleronDef.id === 'aleron_gt') {
        const pilarGeo = new THREE.BoxGeometry(0.06, 0.28, 0.16);
        const planoGeo = new THREE.BoxGeometry(1.42, 0.055, 0.3);
        const endplateGeo = new THREE.BoxGeometry(0.04, 0.2, 0.36);
        plantillasGeo.push(pilarGeo, planoGeo, endplateGeo);
        agregar(pilarGeo, matCarbono, -0.32, alturaBase + 0.5, -1.04);
        agregar(pilarGeo, matCarbono, 0.32, alturaBase + 0.5, -1.04);
        agregar(planoGeo, matCarroceria, 0, alturaBase + 0.64, -1.08, 0.1, 0, 0);
        agregar(endplateGeo, matCarbono, -0.72, alturaBase + 0.64, -1.08);
        agregar(endplateGeo, matCarbono, 0.72, alturaBase + 0.64, -1.08);
    } else if (aleronDef.id === 'aleron_cohete') {
        const propGeo = new THREE.CylinderGeometry(0.16, 0.21, 0.58, 14);
        const aroGeo = new THREE.TorusGeometry(0.17, 0.036, 8, 16);
        const matAro = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.95 });
        plantillasGeo.push(propGeo, aroGeo);
        plantillasMat.push(matAro);
        agregar(propGeo, matCromo, 0, alturaBase + 0.5, -1.0, Math.PI / 2, 0, 0);
        agregar(aroGeo, matAro, 0, alturaBase + 0.5, -1.29, 0, 0, 0, false);
    } else if (aleronDef.id === 'aleron_ala') {
        const pilarGeo = new THREE.BoxGeometry(0.06, 0.36, 0.18);
        const ala1Geo = new THREE.BoxGeometry(1.52, 0.055, 0.28);
        const ala2Geo = new THREE.BoxGeometry(1.36, 0.045, 0.2);
        plantillasGeo.push(pilarGeo, ala1Geo, ala2Geo);
        agregar(pilarGeo, matCarbono, -0.36, alturaBase + 0.54, -1.04);
        agregar(pilarGeo, matCarbono, 0.36, alturaBase + 0.54, -1.04);
        agregar(ala1Geo, matCarroceria, 0, alturaBase + 0.72, -1.08, 0.08, 0, 0);
        agregar(ala2Geo, matCarbono, 0, alturaBase + 0.85, -1.14, 0.14, 0, 0);
    }

    // Liberar geometrías y materiales plantilla (las mallas adjuntas poseen clones propios para liberarObjeto3D)
    for (const g of plantillasGeo) g.dispose();
    for (const m of plantillasMat) m.dispose();

    kart.userData = {
        asientoOffset: chasisDef.asientoOffset,
        ruedasMeshes,
        pivotesDelanteros,
        volanteMesh,
        flamasEscape
    };
    return kart;
}

/**
 * Monta o desmonta el kart 3D bajo el avatar LEGO Minifigure limpiando memoria GPU previa.
 * @param {THREE.Group} grupoAvatar
 * @param {object|null} [configKart]
 * @param {boolean} [activo]
 */
export function montarAvatarEnKart(grupoAvatar, configKart = null, activo = true) {
    if (!grupoAvatar?.userData) return;
    const data = grupoAvatar.userData;

    if (data.kartGrupo) {
        liberarObjeto3D(data.kartGrupo);
        data.kartGrupo = null;
    }

    if (!activo) {
        data.enKart = false;
        data.asientoOffset = null;
        data.anguloVolante = 0;
        data.velocidadKart = 0;
        data.turboActivoKart = false;
        if (data.cuerpo) {
            data.cuerpo.position.set(0, 0, 0);
            data.cuerpo.rotation.set(0, 0, 0);
        }
        return;
    }

    const kart = ensamblarKart3D(configKart || {});
    grupoAvatar.add(kart);
    data.kartGrupo = kart;
    data.enKart = true;
    data.asientoOffset = kart.userData.asientoOffset;
    actualizarAnimacionAvatar(grupoAvatar, 0.016, 'en_kart');
}
