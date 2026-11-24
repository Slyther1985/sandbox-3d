/**
 * Punto de entrada principal del cliente Sandbox 3D (ES6 Module).
 * Orquesta Three.js, la experiencia inicial, la física, el avatar local,
 * la red multijugador y el bucle principal a 60 FPS.
 */
import { CONFIG_CAMARA } from './config.js';
import {
    estadoControles,
    estadoJugador,
    estadoRed,
    estadoSandbox,
    cargarEstadoLocal
} from './estado.js';
import { crearAvatar3D, actualizarAnimacionAvatar } from './avatar.js';
import { actualizarFisicaSandbox } from './fisicaSandbox.js';
import {
    RegistroExperiencias,
    actualizarPortalesFisicos
} from './nucleoSandbox.js';
import { actualizarRed } from './red.js';
import { actualizarMusicaAmbiental, seleccionarMusicaExperiencia } from './audio.js';
import { inicializarInterfaz, actualizarHUD } from './interfaz.js';
import { LobbyCentral } from './experiencias/lobbyCentral.js';
import { ZonaConstruccion } from './experiencias/zonaConstruccion.js';
import { ArenaTurboKarts } from './experiencias/arenaTurboKarts.js';
import { SalaTetris } from './experiencias/salaTetris.js';

const _raycasterCamara = new THREE.Raycaster();
const _dirCamara = new THREE.Vector3();
const _posResueltaCamara = new THREE.Vector3();
const _candidatosColisionCamara = [];
const _objetosIgnoradosCamara = new Set();

/**
 * Recolecta mallas sólidas bloqueantes de la escena omitiendo avatares, sprites,
 * partículas, cúpulas de cielo y elementos translúcidos no bloqueantes.
 * @param {THREE.Object3D} nodo
 * @param {Set<THREE.Object3D>} objetosIgnorados
 * @param {THREE.Object3D[]} salida
 */
function recolectarMallasBloqueantes(nodo, objetosIgnorados, salida) {
    if (!nodo || !nodo.visible) return;
    if (objetosIgnorados && objetosIgnorados.has(nodo)) return;
    if (nodo.userData?.ignorarColisionCamara === true) return;
    if (typeof nodo.name === 'string' && nodo.name.startsWith('cupula_cielo')) return;
    if (nodo.isSprite || nodo.isPoints || nodo.isLine || nodo.isLight) return;

    if (nodo.isMesh) {
        const mats = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
        const esBloqueante = mats.some(
            (m) => m && !(m.transparent && (m.opacity < 0.55 || m.depthWrite === false))
        );
        if (esBloqueante) {
            salida.push(nodo);
        }
    }

    if (nodo.children && nodo.children.length > 0) {
        for (let i = 0; i < nodo.children.length; i++) {
            recolectarMallasBloqueantes(nodo.children[i], objetosIgnorados, salida);
        }
    }
}

/**
 * Brazo resorte (spring-arm) universal: lanza un rayo desde `puntoMira` hacia `posicionDeseada`
 * y acerca la cámara `0.45 m` por delante de cualquier geometría que obstruya la vista (mínimo `1.4 m`).
 * @param {THREE.Vector3} puntoMira
 * @param {THREE.Vector3} posicionDeseada
 * @param {THREE.Scene} escena
 * @param {Set<THREE.Object3D>} [objetosIgnorados]
 * @returns {THREE.Vector3}
 */
export function resolverColisionCamara(puntoMira, posicionDeseada, escena, objetosIgnorados = _objetosIgnoradosCamara) {
    _dirCamara.subVectors(posicionDeseada, puntoMira);
    const distDeseada = _dirCamara.length();
    if (distDeseada < 0.05 || !escena) {
        return _posResueltaCamara.copy(posicionDeseada);
    }

    _dirCamara.divideScalar(distDeseada);
    _candidatosColisionCamara.length = 0;
    recolectarMallasBloqueantes(escena, objetosIgnorados, _candidatosColisionCamara);
    if (_candidatosColisionCamara.length === 0) {
        return _posResueltaCamara.copy(posicionDeseada);
    }

    _raycasterCamara.set(puntoMira, _dirCamara);
    _raycasterCamara.near = 0.2;
    _raycasterCamara.far = distDeseada;
    const impactos = _raycasterCamara.intersectObjects(_candidatosColisionCamara, false);

    if (impactos.length > 0 && impactos[0].distance < distDeseada) {
        const distSegura = Math.max(1.4, impactos[0].distance - 0.45);
        return _posResueltaCamara.copy(puntoMira).addScaledVector(_dirCamara, distSegura);
    }

    return _posResueltaCamara.copy(posicionDeseada);
}

function iniciarSandbox() {
    cargarEstadoLocal();

    const lienzo = document.getElementById('lienzo-3d');
    const renderer = new THREE.WebGLRenderer({
        canvas: lienzo,
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    if (THREE.sRGBEncoding) {
        renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const escena = new THREE.Scene();
    escena.background = new THREE.Color(0x68b5e8);
    escena.fog = new THREE.FogExp2(0x7ec8f2, 0.0052);

    const camara = new THREE.PerspectiveCamera(
        CONFIG_CAMARA.fov,
        window.innerWidth / window.innerHeight,
        CONFIG_CAMARA.cerca,
        CONFIG_CAMARA.lejos
    );

    // Iluminación PBR estilizada en 3 puntos (cielo + sol cálido + luz de contorno)
    const luzHemisferica = new THREE.HemisphereLight(0xe0f2fe, 0x4d7c0f, 0.78);
    escena.add(luzHemisferica);

    const luzDireccional = new THREE.DirectionalLight(0xfff3c4, 1.35);
    luzDireccional.position.set(28, 46, 22);
    luzDireccional.castShadow = true;
    luzDireccional.shadow.mapSize.set(2048, 2048);
    luzDireccional.shadow.bias = -0.0004;
    luzDireccional.shadow.camera.near = 2;
    luzDireccional.shadow.camera.far = 190;
    const rango = 74;
    luzDireccional.shadow.camera.left = -rango;
    luzDireccional.shadow.camera.right = rango;
    luzDireccional.shadow.camera.top = rango;
    luzDireccional.shadow.camera.bottom = -rango;
    escena.add(luzDireccional);

    const luzContorno = new THREE.DirectionalLight(0x38bdf8, 0.42);
    luzContorno.position.set(-24, 18, -20);
    escena.add(luzContorno);

    // Avatar del jugador local
    const avatarLocal = crearAvatar3D({
        id: estadoJugador.id,
        apodo: estadoJugador.apodo,
        nivel: estadoJugador.nivel,
        apariencia: estadoJugador.apariencia,
        equipado: estadoJugador.equipado
    });
    escena.add(avatarLocal);

    const contextoSandbox = {
        escena,
        camara,
        renderer,
        avatarLocal
    };
    RegistroExperiencias.contextoGlobal = contextoSandbox;

    // Registrar experiencias heredadas
    const lobby = new LobbyCentral();
    const zonaConstruccion = new ZonaConstruccion();
    const arenaTurboKarts = new ArenaTurboKarts();
    const salaTetris = new SalaTetris();
    RegistroExperiencias.registrarExperiencia(lobby);
    RegistroExperiencias.registrarExperiencia(zonaConstruccion);
    RegistroExperiencias.registrarExperiencia(arenaTurboKarts);
    RegistroExperiencias.registrarExperiencia(salaTetris);
    lobby.montar(escena, contextoSandbox);
    seleccionarMusicaExperiencia('lobby');

    estadoJugador.posicion = { ...lobby.spawnJugador };
    avatarLocal.position.set(
        estadoJugador.posicion.x,
        estadoJugador.posicion.y,
        estadoJugador.posicion.z
    );

    inicializarInterfaz(contextoSandbox);

    window.addEventListener('resize', () => {
        camara.aspect = window.innerWidth / window.innerHeight;
        camara.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    let ultimoTiempo = performance.now();
    const camObjetivo = new THREE.Vector3();
    const lookObjetivo = new THREE.Vector3();
    const cfgInicial = lobby.obtenerConfigCamara({
        dt: 0,
        anchoPantalla: window.innerWidth,
        altoPantalla: window.innerHeight
    });
    const lookActual = new THREE.Vector3(
        cfgInicial.puntoMira.x,
        cfgInicial.puntoMira.y,
        cfgInicial.puntoMira.z
    );
    camObjetivo.set(
        cfgInicial.posicionObjetivo.x,
        cfgInicial.posicionObjetivo.y,
        cfgInicial.posicionObjetivo.z
    );
    _objetosIgnoradosCamara.clear();
    _objetosIgnoradosCamara.add(avatarLocal);
    camara.position.copy(
        resolverColisionCamara(lookActual, camObjetivo, escena, _objetosIgnoradosCamara)
    );
    camara.lookAt(lookActual);

    function buclePrincipal(ahora) {
        requestAnimationFrame(buclePrincipal);

        const dt = Math.min((ahora - ultimoTiempo) / 1000, 0.05);
        ultimoTiempo = ahora;

        const experienciaActiva = estadoSandbox.experienciaActual;

        if (
            !estadoControles.pantallaBienvenidaActiva &&
            !estadoControles.modoPreviewAvatar &&
            !estadoControles.modoCeremoniaPodio &&
            !estadoControles.modoTetrisActivo
        ) {
            actualizarFisicaSandbox(dt, avatarLocal, experienciaActiva?.configFisica);
        }
        experienciaActiva?.actualizar(dt, contextoSandbox);
        actualizarPortalesFisicos(dt, estadoJugador.posicion, contextoSandbox);
        actualizarAnimacionAvatar(
            avatarLocal,
            dt,
            estadoControles.modoTetrisActivo
                ? 'sentarse'
                : estadoControles.modoCeremoniaPodio
                  ? 'celebrar'
                  : estadoJugador.enVehiculo
                    ? 'en_kart'
                    : estadoControles.modoPreviewAvatar || estadoControles.pantallaBienvenidaActiva
                      ? 'idle'
                      : estadoControles.animacionActual
        );

        // Regla polimórfica de cámara por sala (preservando Estudio de Avatar con máxima prioridad)
        let tasaSuavizado = 18;
        let fovObjetivo = CONFIG_CAMARA.fov;

        if (estadoControles.modoPreviewAvatar) {
            const yawPrev = estadoControles.anguloPreviewAvatar;
            const distPrev = 4.1;
            const px = estadoJugador.posicion.x;
            const py = estadoJugador.posicion.y;
            const pz = estadoJugador.posicion.z;
            const rightX = Math.cos(yawPrev);
            const rightZ = -Math.sin(yawPrev);
            const esHorizontal = window.innerWidth >= window.innerHeight || window.innerWidth > 640;
            const desplazamientoDer = esHorizontal ? (window.innerWidth > 760 ? 1.05 : 0.95) : 0;
            const offsetYCam = esHorizontal ? 1.85 : 1.75;
            const offsetYLook = esHorizontal ? 1.48 : 1.1;

            camObjetivo.set(
                px + Math.sin(yawPrev) * distPrev + rightX * desplazamientoDer,
                py + offsetYCam,
                pz + Math.cos(yawPrev) * distPrev + rightZ * desplazamientoDer
            );
            lookObjetivo.set(
                px + rightX * desplazamientoDer,
                py + offsetYLook,
                pz + rightZ * desplazamientoDer
            );
            tasaSuavizado = 9;
        } else {
            const cfgCamara = experienciaActiva?.obtenerConfigCamara?.({
                dt,
                anchoPantalla: window.innerWidth,
                altoPantalla: window.innerHeight
            });
            if (cfgCamara) {
                camObjetivo.set(
                    cfgCamara.posicionObjetivo.x,
                    cfgCamara.posicionObjetivo.y,
                    cfgCamara.posicionObjetivo.z
                );
                lookObjetivo.set(
                    cfgCamara.puntoMira.x,
                    cfgCamara.puntoMira.y,
                    cfgCamara.puntoMira.z
                );
                tasaSuavizado = cfgCamara.suavizado || 18;
                fovObjetivo = cfgCamara.fov || CONFIG_CAMARA.fov;
            }
        }

        if (!estadoControles.modoTetrisActivo && !estadoControles.modoCeremoniaPodio) {
            _objetosIgnoradosCamara.clear();
            _objetosIgnoradosCamara.add(avatarLocal);
            for (const remoto of estadoRed.jugadoresRemotos.values()) {
                if (remoto?.avatar) _objetosIgnoradosCamara.add(remoto.avatar);
            }
            const posSinObstaculo = resolverColisionCamara(
                lookObjetivo,
                camObjetivo,
                escena,
                _objetosIgnoradosCamara
            );
            if (posSinObstaculo.distanceToSquared(camObjetivo) > 0.002) {
                camObjetivo.copy(posSinObstaculo);
                tasaSuavizado = Math.max(tasaSuavizado, 24);
            }
        }

        const suavizado = Math.min(1, dt * tasaSuavizado);
        camara.position.lerp(camObjetivo, suavizado);
        lookActual.lerp(lookObjetivo, suavizado);
        camara.lookAt(lookActual);

        if (Math.abs(fovObjetivo - camara.fov) > 0.05) {
            camara.fov += (fovObjetivo - camara.fov) * Math.min(1, dt * 8);
            camara.updateProjectionMatrix();
        }

        actualizarRed(dt, escena);
        actualizarMusicaAmbiental(dt);
        actualizarHUD();
        renderer.render(escena, camara);
    }

    requestAnimationFrame(buclePrincipal);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarSandbox);
} else {
    iniciarSandbox();
}
