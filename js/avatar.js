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
 * Construye un kart 3D multipieza de cabina abierta (superhéroe / competición) con texturas PBR.
 * El frente del kart apunta hacia `+Z`.
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

    const kart = new THREE.Group();
    kart.name = `kart_${chasisDef.id}`;

    const texChasis = obtenerTexturaChasisKart(chasisDef.id, colorPrincipal);
    const texNeumatico = obtenerTexturaNeumatico(ruedaDef.id);

    const matCarroceria = new THREE.MeshPhysicalMaterial({
        map: texChasis.map,
        bumpMap: texChasis.bumpMap,
        bumpScale: 0.03,
        roughnessMap: texChasis.roughnessMap,
        roughness: 0.35,
        metalness: 0.22,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18
    });
    const matCarbono = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.48,
        metalness: 0.25
    });
    const matAsiento = crearMaterialPlasticoABS({ color: 0x0f172a, roughness: 0.55 });
    const matCromo = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.84, roughness: 0.2 });
    const matFaro = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xe0f2fe,
        emissiveIntensity: 1.25
    });
    const matPilotoTrasero = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 1.15
    });
    const matNeumatico = new THREE.MeshStandardMaterial({
        map: texNeumatico.map,
        bumpMap: texNeumatico.bumpMap,
        bumpScale: 0.035,
        roughnessMap: texNeumatico.roughnessMap,
        roughness: 0.84,
        emissive: ruedaDef.emisivo ? 0x0e7490 : 0x000000,
        emissiveMap: ruedaDef.emisivo ? texNeumatico.map : null,
        emissiveIntensity: ruedaDef.emisivo ? 0.65 : 0
    });
    const matLlanta = new THREE.MeshStandardMaterial({
        color: ruedaDef.colorLlanta,
        emissive: ruedaDef.emisivo ? ruedaDef.colorLlanta : 0x000000,
        emissiveIntensity: ruedaDef.emisivo ? 0.85 : 0,
        metalness: 0.55,
        roughness: 0.28
    });
    const matRotor = new THREE.MeshStandardMaterial({
        map: texNeumatico.rotorMap,
        metalness: 0.72,
        roughness: 0.32,
        side: THREE.DoubleSide
    });

    const alturaBase = chasisDef.id === 'kart_tumbler' ? 0.36 : 0.24;

    // 1. Chasis base, splitter delantero de carbono y difusor trasero con aletas
    const piso = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 2.38), matCarbono);
    piso.position.set(0, alturaBase, 0.02);
    piso.castShadow = true;
    piso.receiveShadow = true;
    kart.add(piso);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 0.38), matCarbono.clone());
    splitter.position.set(0, alturaBase - 0.02, 1.24);
    kart.add(splitter);

    const difusor = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.3), matCarbono.clone());
    difusor.position.set(0, alturaBase - 0.01, -1.22);
    kart.add(difusor);
    for (const dx of [-0.34, 0, 0.34]) {
        const aleta = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.28), matCarbono.clone());
        aleta.position.set(dx, alturaBase + 0.02, -1.24);
        kart.add(aleta);
    }

    // 2. Pontones laterales PBR y tomas de aire
    const pontonIzq = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 1.44), matCarroceria);
    pontonIzq.position.set(-0.62, alturaBase + 0.14, -0.02);
    pontonIzq.castShadow = true;
    const pontonDer = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 1.44), matCarroceria.clone());
    pontonDer.position.set(0.62, alturaBase + 0.14, -0.02);
    pontonDer.castShadow = true;
    const tomaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), matCarbono.clone());
    tomaIzq.position.set(-0.62, alturaBase + 0.15, 0.71);
    const tomaDer = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), matCarbono.clone());
    tomaDer.position.set(0.62, alturaBase + 0.15, 0.71);
    kart.add(pontonIzq, pontonDer, tomaIzq, tomaDer);

    // 3. Asiento cubo ergonómico y tablero de telemetría
    const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 0.14), matAsiento);
    respaldo.position.set(0, alturaBase + 0.4, -0.46);
    respaldo.rotation.x = -0.18;
    const bolsterIzq = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.32), matAsiento.clone());
    bolsterIzq.position.set(-0.36, alturaBase + 0.3, -0.34);
    const bolsterDer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.32), matAsiento.clone());
    bolsterDer.position.set(0.36, alturaBase + 0.3, -0.34);
    const tablero = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.24), matCarbono.clone());
    tablero.position.set(0, alturaBase + 0.34, 0.56);
    const pantalla = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.1, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.9 })
    );
    pantalla.position.set(0, alturaBase + 0.42, 0.46);
    pantalla.rotation.x = -0.35;
    kart.add(respaldo, bolsterIzq, bolsterDer, tablero, pantalla);

    // 4. Columna de dirección y volante deportivo
    const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.55, 10), matCromo);
    columna.position.set(0, alturaBase + 0.48, 0.58);
    columna.rotation.x = -0.58;
    kart.add(columna);

    const volanteMesh = new THREE.Group();
    volanteMesh.position.set(0, alturaBase + 0.68, 0.42);
    volanteMesh.rotation.x = -0.35;
    const aroVolante = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.032, 8, 18), matAsiento.clone());
    const barraVolante = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.03), matCromo.clone());
    const centroVolante = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), matCarroceria.clone());
    centroVolante.rotation.x = Math.PI / 2;
    volanteMesh.add(aroVolante, barraVolante, centroVolante);
    kart.add(volanteMesh);

    // 5. Cubierta trasera de motor + pilotos traseros LED
    const bloqueMotor = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.32, 0.56), matCarroceria.clone());
    bloqueMotor.position.set(0, alturaBase + 0.22, -0.82);
    bloqueMotor.castShadow = true;
    const tapaValv = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.36), matCromo.clone());
    tapaValv.position.set(0, alturaBase + 0.4, -0.84);
    const luzTrasIzq = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.06), matPilotoTrasero);
    luzTrasIzq.position.set(-0.42, alturaBase + 0.24, -1.14);
    const luzTrasDer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.06), matPilotoTrasero.clone());
    luzTrasDer.position.set(0.42, alturaBase + 0.24, -1.14);
    kart.add(bloqueMotor, tapaValv, luzTrasIzq, luzTrasDer);

    // 6. Escapes dobles traseros + flamas turbo animadas
    const flamasEscape = [];
    const matFlama = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
    for (const ex of [-0.26, 0.26]) {
        const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.34, 10), matCromo.clone());
        tubo.rotation.x = Math.PI / 2;
        tubo.position.set(ex, alturaBase + 0.2, -1.18);
        kart.add(tubo);

        const flama = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 8), matFlama.clone());
        flama.rotation.x = -Math.PI / 2;
        flama.position.set(ex, alturaBase + 0.2, -1.44);
        flama.visible = false;
        kart.add(flama);
        flamasEscape.push(flama);
    }

    // 7. Geometría esculpida específica por arquetipo
    if (chasisDef.id === 'kart_batmovil') {
        const morro = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.88), matCarroceria.clone());
        morro.position.set(0, alturaBase + 0.14, 0.88);
        morro.castShadow = true;

        const turbinaFront = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.36, 14), matCarbono.clone());
        turbinaFront.rotation.x = Math.PI / 2;
        turbinaFront.position.set(0, alturaBase + 0.2, 1.3);
        const nucleoTurbina = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x22d3ee, emissiveIntensity: 1.4 })
        );
        nucleoTurbina.rotation.x = Math.PI / 2;
        nucleoTurbina.position.set(0, alturaBase + 0.2, 1.47);

        const fenderIzq = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.62), matCarroceria.clone());
        fenderIzq.position.set(-0.62, alturaBase + 0.26, 0.84);
        fenderIzq.rotation.x = 0.12;
        const fenderDer = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.62), matCarroceria.clone());
        fenderDer.position.set(0.62, alturaBase + 0.26, 0.84);
        fenderDer.rotation.x = 0.12;

        const ledIzq = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), matFaro);
        ledIzq.position.set(-0.36, alturaBase + 0.22, 1.3);
        const ledDer = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), matFaro.clone());
        ledDer.position.set(0.36, alturaBase + 0.22, 1.3);

        const aletaMurcIzq = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.56, 0.58), matCarroceria.clone());
        aletaMurcIzq.position.set(-0.48, alturaBase + 0.54, -0.92);
        aletaMurcIzq.rotation.set(-0.34, 0, -0.18);
        aletaMurcIzq.castShadow = true;
        const aletaMurcDer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.56, 0.58), matCarroceria.clone());
        aletaMurcDer.position.set(0.48, alturaBase + 0.54, -0.92);
        aletaMurcDer.rotation.set(-0.34, 0, 0.18);
        aletaMurcDer.castShadow = true;

        const propulsor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.42, 14), matCromo.clone());
        propulsor.rotation.x = Math.PI / 2;
        propulsor.position.set(0, alturaBase + 0.28, -1.24);
        const aroJet = new THREE.Mesh(
            new THREE.TorusGeometry(0.17, 0.035, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 1.1 })
        );
        aroJet.position.set(0, alturaBase + 0.28, -1.44);
        const flamaJet = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.52, 10),
            new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 })
        );
        flamaJet.rotation.x = -Math.PI / 2;
        flamaJet.position.set(0, alturaBase + 0.28, -1.68);
        flamaJet.visible = false;
        flamasEscape.push(flamaJet);

        kart.add(
            morro,
            turbinaFront,
            nucleoTurbina,
            fenderIzq,
            fenderDer,
            ledIzq,
            ledDer,
            aletaMurcIzq,
            aletaMurcDer,
            propulsor,
            aroJet,
            flamaJet
        );
    } else if (chasisDef.id === 'kart_formula') {
        const morroF1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 1.14), matCarroceria.clone());
        morroF1.position.set(0, alturaBase + 0.15, 0.88);
        morroF1.castShadow = true;

        const alaFront1 = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.05, 0.3), matCarroceria.clone());
        alaFront1.position.set(0, alturaBase + 0.02, 1.38);
        const alaFront2 = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.04, 0.16), matCarbono.clone());
        alaFront2.position.set(0, alturaBase + 0.1, 1.3);
        alaFront2.rotation.x = 0.16;
        const endIzq = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.42), matCarroceria.clone());
        endIzq.position.set(-0.82, alturaBase + 0.09, 1.32);
        const endDer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.42), matCarroceria.clone());
        endDer.position.set(0.82, alturaBase + 0.09, 1.32);

        const deflectorIzq = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.38), matCarbono.clone());
        deflectorIzq.position.set(-0.48, alturaBase + 0.14, 0.56);
        const deflectorDer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.38), matCarbono.clone());
        deflectorDer.position.set(0.48, alturaBase + 0.14, 0.56);

        const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.46), matCarroceria.clone());
        airbox.position.set(0, alturaBase + 0.66, -0.62);
        airbox.castShadow = true;

        // Halo protector abierto sobre la cabina
        const haloPilon = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.44, 8), matCarbono.clone());
        haloPilon.position.set(0, alturaBase + 0.54, 0.52);
        haloPilon.rotation.x = -0.34;
        const haloIzq = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.96), matCarbono.clone());
        haloIzq.position.set(-0.24, alturaBase + 0.72, 0.02);
        haloIzq.rotation.y = -0.24;
        const haloDer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.96), matCarbono.clone());
        haloDer.position.set(0.24, alturaBase + 0.72, 0.02);
        haloDer.rotation.y = 0.24;

        kart.add(morroF1, alaFront1, alaFront2, endIzq, endDer, deflectorIzq, deflectorDer, airbox, haloPilon, haloIzq, haloDer);
    } else if (chasisDef.id === 'kart_lemans') {
        const capot = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.22, 0.94), matCarroceria.clone());
        capot.position.set(0, alturaBase + 0.15, 0.86);
        capot.castShadow = true;

        // 4 pasos de rueda esculpidos tipo prototipo LMP
        for (const [fx, fz] of [
            [-0.72, 0.82],
            [0.72, 0.82],
            [-0.72, -0.78],
            [0.72, -0.78]
        ]) {
            const paso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.62), matCarroceria.clone());
            paso.position.set(fx, alturaBase + 0.26, fz);
            paso.castShadow = true;
            kart.add(paso);
        }

        // Aleta dorsal de tiburón (Shark Fin)
        const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.84), matCarroceria.clone());
        sharkFin.position.set(0, alturaBase + 0.54, -0.76);
        sharkFin.castShadow = true;

        // 4 faros de resistencia LED
        for (const fx of [-0.66, -0.36, 0.36, 0.66]) {
            const faroLmp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.05), matFaro.clone());
            faroLmp.position.set(fx, alturaBase + 0.22, 1.3);
            kart.add(faroLmp);
        }
        kart.add(capot, sharkFin);
    } else {
        // 'kart_tumbler': placas blindadas angulares, brazos de suspensión y barra de luces
        const proa = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.28, 0.78), matCarroceria.clone());
        proa.position.set(0, alturaBase + 0.18, 0.84);
        proa.castShadow = true;
        const placaIzq = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.74), matCarroceria.clone());
        placaIzq.position.set(-0.54, alturaBase + 0.22, 0.76);
        placaIzq.rotation.y = 0.24;
        const placaDer = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.74), matCarroceria.clone());
        placaDer.position.set(0.54, alturaBase + 0.22, 0.76);
        placaDer.rotation.y = -0.24;

        // Brazos expuestos de suspensión delantera + amortiguadores
        for (const lado of [-1, 1]) {
            const brazoInf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), matCromo.clone());
            brazoInf.position.set(lado * 0.6, alturaBase - 0.04, 0.84);
            const amort = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), matFaro.clone());
            amort.position.set(lado * 0.56, alturaBase + 0.12, 0.84);
            amort.rotation.z = lado * 0.42;
            kart.add(brazoInf, amort);
        }

        // Arco superior táctico con reflectores LED
        const arcoPod = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.12), matCarbono.clone());
        arcoPod.position.set(0, alturaBase + 0.9, -0.5);
        for (const rx of [-0.28, 0, 0.28]) {
            const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.08), matFaro.clone());
            reflector.position.set(rx, alturaBase + 0.96, -0.45);
            kart.add(reflector);
        }
        kart.add(proa, placaIzq, placaDer, arcoPod);
    }

    matFlama.dispose();

    // 8. Ruedas con banda de rodadura PBR, llanta de rayos, disco ventilado y pinza de freno
    const r = ruedaDef.radio;
    const w = ruedaDef.ancho;
    const offsetX = chasisDef.id === 'kart_tumbler' ? 0.84 : 0.76;
    const geoNeumatico = new THREE.CylinderGeometry(r, r, w, 24);
    geoNeumatico.rotateZ(Math.PI / 2);
    const geoLlanta = new THREE.CylinderGeometry(r * 0.58, r * 0.58, w + 0.015, 16);
    geoLlanta.rotateZ(Math.PI / 2);
    const geoRotor = new THREE.CircleGeometry(r * 0.52, 18);

    const ruedasMeshes = [];
    const pivotesDelanteros = [];

    const crearRueda = (px, pz, esDelantera) => {
        const pivote = new THREE.Group();
        pivote.position.set(px, r, pz);

        const ruedaGrupo = new THREE.Group();
        const goma = new THREE.Mesh(geoNeumatico.clone(), matNeumatico.clone());
        goma.castShadow = true;
        const llanta = new THREE.Mesh(geoLlanta.clone(), matLlanta.clone());
        const rayo1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, r * 1.05, r * 0.16), matCromo.clone());
        const rayo2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, r * 0.16, r * 1.05), matCromo.clone());
        const tuerca = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, w + 0.05, 8), matAsiento.clone());
        tuerca.rotation.z = Math.PI / 2;
        ruedaGrupo.add(goma, llanta, rayo1, rayo2, tuerca);

        // Disco de freno ventilado fijo en el pivote (visible tras los rayos)
        const rotor = new THREE.Mesh(geoRotor.clone(), matRotor.clone());
        rotor.rotation.y = px < 0 ? -Math.PI / 2 : Math.PI / 2;
        rotor.position.x = px < 0 ? -(w * 0.36) : w * 0.36;

        pivote.add(ruedaGrupo, rotor);
        kart.add(pivote);

        ruedasMeshes.push(ruedaGrupo);
        if (esDelantera) pivotesDelanteros.push(pivote);
    };

    crearRueda(-offsetX, 0.84, true);
    crearRueda(offsetX, 0.84, true);
    crearRueda(-offsetX, -0.78, false);
    crearRueda(offsetX, -0.78, false);

    // Doble eje trasero dually para el Tanque Urbano ('kart_tumbler')
    if (chasisDef.id === 'kart_tumbler') {
        crearRueda(-(offsetX + w + 0.03), -0.78, false);
        crearRueda(offsetX + w + 0.03, -0.78, false);
    }

    geoNeumatico.dispose();
    geoLlanta.dispose();
    geoRotor.dispose();
    matNeumatico.dispose();
    matLlanta.dispose();
    matRotor.dispose();

    // 9. Alerón trasero adicional según selección de pieza
    if (aleronDef.id === 'aleron_gt') {
        const soporte = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.1), matCarbono.clone());
        soporte.position.set(0, alturaBase + 0.48, -0.96);
        const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.08, 0.34), matCarroceria.clone());
        tabla.position.set(0, alturaBase + 0.64, -1.0);
        tabla.rotation.x = 0.12;
        kart.add(soporte, tabla);
    } else if (aleronDef.id === 'aleron_cohete') {
        const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 12), matCromo.clone());
        prop.rotation.x = Math.PI / 2;
        prop.position.set(0, alturaBase + 0.48, -0.98);
        const aro = new THREE.Mesh(
            new THREE.TorusGeometry(0.19, 0.04, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.9 })
        );
        aro.position.set(0, alturaBase + 0.48, -1.28);
        kart.add(prop, aro);
    } else if (aleronDef.id === 'aleron_ala') {
        const pilar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.36, 0.12), matCarbono.clone());
        pilar.position.set(0, alturaBase + 0.52, -0.96);
        const ala1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.3), matCarroceria.clone());
        ala1.position.set(0, alturaBase + 0.7, -1.0);
        const ala2 = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 0.22), matCarbono.clone());
        ala2.position.set(0, alturaBase + 0.84, -1.06);
        kart.add(pilar, ala1, ala2);
    }

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
