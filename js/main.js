/**
 * Punto de entrada principal del cliente Sandbox 3D (ES6 Module).
 * Orquesta Three.js, la experiencia inicial, la física, el avatar local,
 * la red multijugador y el bucle principal a 60 FPS.
 */
import { CONFIG_CAMARA } from './config.js';
import {
    estadoControles,
    estadoJugador,
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
import { inicializarInterfaz, actualizarHUD } from './interfaz.js';
import { LobbyCentral } from './experiencias/lobbyCentral.js';
import { ZonaConstruccion } from './experiencias/zonaConstruccion.js';
import { ArenaTurboKarts } from './experiencias/arenaTurboKarts.js';
import { SalaTetris } from './experiencias/salaTetris.js';

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
    luzDireccional.shadow.camera.far = 140;
    const rango = 48;
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
    const lookActual = new THREE.Vector3(
        estadoJugador.posicion.x,
        estadoJugador.posicion.y + 1.65,
        estadoJugador.posicion.z
    );
    camara.position.set(
        estadoJugador.posicion.x,
        estadoJugador.posicion.y + 4.5,
        estadoJugador.posicion.z + CONFIG_CAMARA.distancia
    );

    function buclePrincipal(ahora) {
        requestAnimationFrame(buclePrincipal);

        const dt = Math.min((ahora - ultimoTiempo) / 1000, 0.05);
        ultimoTiempo = ahora;

        const experienciaActiva = estadoSandbox.experienciaActual;

        if (!estadoControles.modoPreviewAvatar && !estadoControles.modoCeremoniaPodio && !estadoControles.modoTetrisActivo) {
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
                    : estadoControles.modoPreviewAvatar
                      ? 'idle'
                      : estadoControles.animacionActual
        );

        // Cámara orbital normal, TV Gigante 3D en primera persona, estudio de avatar o ceremonia podio
        if (estadoControles.modoTetrisActivo) {
            const encuadre = experienciaActiva?.obtenerEncuadreCamaraTetris3D?.();
            if (encuadre) {
                camObjetivo.set(encuadre.posicion.x, encuadre.posicion.y, encuadre.posicion.z);
                lookObjetivo.set(encuadre.objetivo.x, encuadre.objetivo.y, encuadre.objetivo.z);
            }
        } else if (estadoControles.modoCeremoniaPodio && estadoControles.camaraPodio) {
            const cp = estadoControles.camaraPodio;
            camObjetivo.set(cp.posX, cp.posY, cp.posZ);
            lookObjetivo.set(cp.lookX, cp.lookY, cp.lookZ);
        } else if (estadoControles.modoPreviewAvatar) {
            const yawPrev = estadoControles.anguloPreviewAvatar;
            const distPrev = 4.1;
            const px = estadoJugador.posicion.x;
            const py = estadoJugador.posicion.y;
            const pz = estadoJugador.posicion.z;
            const rightX = Math.cos(yawPrev);
            const rightZ = -Math.sin(yawPrev);
            const desplazamientoIzq = window.innerWidth > 760 ? -0.65 : 0;

            camObjetivo.set(
                px + Math.sin(yawPrev) * distPrev + rightX * desplazamientoIzq,
                py + 1.9,
                pz + Math.cos(yawPrev) * distPrev + rightZ * desplazamientoIzq
            );
            lookObjetivo.set(
                px + rightX * desplazamientoIzq,
                py + 1.55,
                pz + rightZ * desplazamientoIzq
            );
        } else if (estadoJugador.enVehiculo && estadoControles.garajeKartAbierto) {
            const rot = estadoJugador.rotacion;
            const angShowcase = rot + 0.62;
            const distShowcase = 4.6;
            const px = estadoJugador.posicion.x;
            const py = estadoJugador.posicion.y;
            const pz = estadoJugador.posicion.z;
            const rightX = Math.cos(angShowcase);
            const rightZ = -Math.sin(angShowcase);
            const desplazamientoIzq = window.innerWidth > 760 ? -0.75 : 0;

            camObjetivo.set(
                px + Math.sin(angShowcase) * distShowcase + rightX * desplazamientoIzq,
                py + 2.0,
                pz + Math.cos(angShowcase) * distShowcase + rightZ * desplazamientoIzq
            );
            lookObjetivo.set(
                px + rightX * desplazamientoIzq,
                py + 0.85,
                pz + rightZ * desplazamientoIzq
            );
        } else if (estadoJugador.enVehiculo) {
            const distKart = 6.6;
            const rot = estadoJugador.rotacion;
            const targetX = estadoJugador.posicion.x;
            const targetY = estadoJugador.posicion.y + 1.5;
            const targetZ = estadoJugador.posicion.z;

            camObjetivo.set(
                targetX - Math.sin(rot) * distKart,
                targetY + 2.2,
                targetZ - Math.cos(rot) * distKart
            );
            lookObjetivo.set(
                targetX + Math.sin(rot) * 3.5,
                targetY,
                targetZ + Math.cos(rot) * 3.5
            );
        } else {
            const dist = CONFIG_CAMARA.distancia;
            const pitch = estadoControles.anguloCamaraPitch;
            const yaw = estadoControles.anguloCamaraY;
            const distHoriz = Math.cos(pitch) * dist;
            const offsetY = Math.sin(pitch) * dist;

            const targetX = estadoJugador.posicion.x;
            const targetY = estadoJugador.posicion.y + 1.65;
            const targetZ = estadoJugador.posicion.z;

            camObjetivo.set(
                targetX + Math.sin(yaw) * distHoriz,
                targetY + offsetY,
                targetZ + Math.cos(yaw) * distHoriz
            );
            lookObjetivo.set(targetX, targetY, targetZ);
        }

        const suavizado = Math.min(
            1,
            dt * (estadoControles.modoTetrisActivo ? 12 : estadoControles.modoCeremoniaPodio ? 6 : estadoControles.modoPreviewAvatar || estadoControles.garajeKartAbierto ? 9 : 18)
        );
        camara.position.lerp(camObjetivo, suavizado);
        lookActual.lerp(lookObjetivo, suavizado);
        camara.lookAt(lookActual);

        actualizarRed(dt, escena);
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
