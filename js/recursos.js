/**
 * Generadores procedurales de texturas, sintetizador Web Audio API
 * y gestor obligatorio de limpieza de memoria GPU (`liberarObjeto3D`).
 */
import { CATALOGO_BLOQUES, DIMENSION_LOBBY } from './constantes.js';

export const bancoTexturas = new Map();

export const estadoAudio = {
    silenciado: false,
    contexto: null
};

const SLOTS_TEXTURA = [
    'map',
    'emissiveMap',
    'alphaMap',
    'bumpMap',
    'roughnessMap',
    'metalnessMap',
    'normalMap'
];

/**
 * Crea un canvas 2D auxiliar para dibujo procedural.
 * @param {number} ancho
 * @param {number} alto
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
 */
function crearLienzo(ancho, alto) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
}

/**
 * Convierte un color numérico o string CSS a formato hexadecimal `#rrggbb`.
 * @param {number|string} colorHex
 * @returns {string}
 */
function formatearColorCss(colorHex) {
    if (typeof colorHex === 'string') return colorHex;
    return '#' + (colorHex >>> 0).toString(16).padStart(6, '0');
}

/**
 * Helper interno para crear y cachear texturas CanvasTexture en `bancoTexturas`.
 * @param {string} clave
 * @param {number} ancho
 * @param {number} alto
 * @param {(ctx: CanvasRenderingContext2D, ancho: number, alto: number) => void} dibujar
 * @param {object} [opciones]
 * @returns {THREE.CanvasTexture}
 */
function obtenerOCrearTextura(clave, ancho, alto, dibujar, opciones = {}) {
    if (bancoTexturas.has(clave)) {
        return bancoTexturas.get(clave);
    }
    const { canvas, ctx } = crearLienzo(ancho, alto);
    dibujar(ctx, ancho, alto);
    const textura = new THREE.CanvasTexture(canvas);
    if (opciones.repetir) {
        textura.wrapS = THREE.RepeatWrapping;
        textura.wrapT = THREE.RepeatWrapping;
        textura.repeat.set(opciones.repetir, opciones.repetir);
    }
    if (opciones.pixelado) {
        textura.magFilter = THREE.NearestFilter;
        textura.minFilter = THREE.LinearMipmapLinearFilter;
    }
    if (opciones.anisotropia) {
        textura.anisotropy = opciones.anisotropia;
    }
    bancoTexturas.set(clave, textura);
    return textura;
}

/**
 * Genera y cachea los mapas PBR (albedo, bumpMap, roughnessMap) del césped estilizado.
 * @returns {{ map: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
 */
export function obtenerTexturaCespedPlaza() {
    const rep = Math.max(8, Math.floor(DIMENSION_LOBBY / 4));
    const map = obtenerOCrearTextura('cesped_plaza_albedo', 256, 256, (ctx) => {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(0, 0, 256, 256);

        const grad = ctx.createLinearGradient(0, 0, 256, 256);
        grad.addColorStop(0, '#5cd65c');
        grad.addColorStop(0.5, '#3fc35c');
        grad.addColorStop(1, '#4ade80');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        // Briznas estilizadas y tréboles sutiles
        for (let i = 0; i < 65; i++) {
            const x = (i * 47) % 244;
            const y = (i * 83) % 240;
            ctx.fillStyle = i % 3 === 0 ? '#86efac' : '#22c55e';
            ctx.fillRect(x, y, 5, 14);
            ctx.fillRect(x + 6, y + 3, 4, 11);
        }
        for (let i = 0; i < 18; i++) {
            const cx = ((i * 71) % 230) + 12;
            const cy = ((i * 97) % 230) + 12;
            ctx.fillStyle = '#bbf7d0';
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }, { repetir: rep, anisotropia: 4 });

    const bumpMap = obtenerOCrearTextura('cesped_plaza_bump', 256, 256, (ctx) => {
        ctx.fillStyle = '#707070';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 65; i++) {
            const x = (i * 47) % 244;
            const y = (i * 83) % 240;
            ctx.fillStyle = i % 2 === 0 ? '#b8b8b8' : '#4a4a4a';
            ctx.fillRect(x, y, 5, 14);
        }
    }, { repetir: rep });

    const roughnessMap = obtenerOCrearTextura('cesped_plaza_rough', 256, 256, (ctx) => {
        ctx.fillStyle = '#d4d4d4';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#b5b5b5' : '#ededed';
            ctx.fillRect((i * 53) % 240, (i * 79) % 240, 18, 18);
        }
    }, { repetir: rep });

    return { map, bumpMap, roughnessMap };
}

/**
 * Genera mapas PBR de piedra cálida con juntas biseladas para el anfiteatro de la plaza.
 * @param {number} [repeticiones]
 * @returns {{ map: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
 */
export function obtenerMapasPBRPlaza(repeticiones = 8) {
    const map = obtenerOCrearTextura(`piedra_plaza_albedo_${repeticiones}`, 256, 256, (ctx) => {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, 256, 256);

        const losas = [
            { x: 4, y: 4, w: 120, h: 120, c: '#f1f5f9' },
            { x: 132, y: 4, w: 120, h: 120, c: '#e2e8f0' },
            { x: 4, y: 132, w: 120, h: 120, c: '#e2e8f0' },
            { x: 132, y: 132, w: 120, h: 120, c: '#f8fafc' }
        ];
        for (const l of losas) {
            ctx.fillStyle = l.c;
            ctx.fillRect(l.x, l.y, l.w, l.h);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 3;
            ctx.strokeRect(l.x + 2, l.y + 2, l.w - 4, l.h - 4);
        }
    }, { repetir: repeticiones, anisotropia: 4 });

    const bumpMap = obtenerOCrearTextura(`piedra_plaza_bump_${repeticiones}`, 256, 256, (ctx) => {
        ctx.fillStyle = '#303030';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#d8d8d8';
        ctx.fillRect(6, 6, 116, 116);
        ctx.fillRect(134, 6, 116, 116);
        ctx.fillRect(6, 134, 116, 116);
        ctx.fillRect(134, 134, 116, 116);
    }, { repetir: repeticiones });

    const roughnessMap = obtenerOCrearTextura(`piedra_plaza_rough_${repeticiones}`, 256, 256, (ctx) => {
        ctx.fillStyle = '#b0b0b0';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#858585';
        ctx.fillRect(8, 8, 112, 112);
        ctx.fillRect(136, 136, 112, 112);
    }, { repetir: repeticiones });

    return { map, bumpMap, roughnessMap };
}

/**
 * Compatibilidad: textura principal de suelo de plaza iluminada.
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaSueloPlaza() {
    return obtenerMapasPBRPlaza().map;
}

/**
 * Genera y cachea una textura estilizada con borde biselado y brillo para plataformas.
 * @param {number|string} colorHex
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaPlataforma(colorHex = 0x38bdf8) {
    const colorCss = formatearColorCss(colorHex);
    return obtenerOCrearTextura(`plataforma_${colorCss}`, 128, 128, (ctx) => {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(8, 8, 112, 112);
        ctx.strokeStyle = colorCss;
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, 116, 116);
        ctx.fillStyle = colorCss;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(22, 22, 84, 84);
        ctx.globalAlpha = 1;
    }, { repetir: 1 });
}

/**
 * Genera y cachea una textura de vórtice radial para portales 3D.
 * @param {number|string} colorHex
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaPortal(colorHex = 0x8b5cf6) {
    const colorCss = formatearColorCss(colorHex);
    const clave = `portal_${colorCss}`;
    if (bancoTexturas.has(clave)) {
        return bancoTexturas.get(clave);
    }

    const { canvas, ctx } = crearLienzo(256, 256);
    ctx.clearRect(0, 0, 256, 256);

    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, colorCss);
    grad.addColorStop(0.85, colorCss + '66');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 4;
    for (let r = 34; r <= 106; r += 24) {
        ctx.beginPath();
        ctx.arc(128, 128, r, 0, Math.PI * 1.5);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const textura = new THREE.CanvasTexture(canvas);
    bancoTexturas.set(clave, textura);
    return textura;
}

/**
 * Genera y cachea la textura estilizada del rostro LEGO (512x256) centrada en el arco frontal (+Z).
 * @param {'feliz'|'epico'|'lentes'|'robot'} [estilo]
 * @param {string} [colorPiel]
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaRostro(estilo = 'feliz', colorPiel = '#f1c27d') {
    const clave = `avatar_rostro_lego_${estilo}_${colorPiel}`;
    return obtenerOCrearTextura(clave, 512, 256, (ctx) => {
        ctx.fillStyle = colorPiel;
        ctx.fillRect(0, 0, 512, 256);

        // Sombreado sutil de mejillas alrededor del centro frontal (x=256)
        ctx.fillStyle = 'rgba(244, 114, 182, 0.2)';
        ctx.beginPath();
        ctx.arc(204, 152, 14, 0, Math.PI * 2);
        ctx.arc(308, 152, 14, 0, Math.PI * 2);
        ctx.fill();

        if (estilo === 'robot') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(190, 74, 132, 64);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 4;
            ctx.strokeRect(190, 74, 132, 64);

            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(208, 92, 34, 24);
            ctx.fillRect(270, 92, 34, 24);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(214, 96, 10, 8);
            ctx.fillRect(276, 96, 10, 8);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(218, 162, 76, 22);
            ctx.fillStyle = '#38bdf8';
            for (let x = 224; x < 288; x += 14) {
                ctx.fillRect(x, 167, 9, 12);
            }
        } else if (estilo === 'lentes') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(194, 84, 54, 38);
            ctx.fillRect(264, 84, 54, 38);
            ctx.fillRect(244, 94, 24, 10);

            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(202, 91, 16, 9);
            ctx.fillRect(272, 91, 16, 9);
            ctx.fillStyle = '#bae6fd';
            ctx.fillRect(205, 93, 7, 4);
            ctx.fillRect(275, 93, 7, 4);

            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(228, 166);
            ctx.quadraticCurveTo(256, 180, 286, 158);
            ctx.stroke();
        } else if (estilo === 'epico') {
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(204, 76);
            ctx.lineTo(240, 88);
            ctx.moveTo(308, 76);
            ctx.lineTo(272, 88);
            ctx.stroke();

            for (const cx of [226, 286]) {
                ctx.fillStyle = '#111827';
                ctx.beginPath();
                ctx.ellipse(cx, 112, 12, 16, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(cx, 114, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(cx - 3, 106, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(256, 156, 28, 0.08 * Math.PI, 0.92 * Math.PI);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(234, 159, 44, 8);
        } else {
            // Rostro clásico LEGO sonriente
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(226, 84, 14, 1.15 * Math.PI, 1.85 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(286, 84, 14, 1.15 * Math.PI, 1.85 * Math.PI);
            ctx.stroke();

            for (const cx of [226, 286]) {
                ctx.fillStyle = '#111827';
                ctx.beginPath();
                ctx.ellipse(cx, 112, 11, 15, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(cx - 3, 106, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(256, 148, 28, 0.16 * Math.PI, 0.84 * Math.PI);
            ctx.stroke();
        }
    });
}

/**
 * Genera y cachea una textura pixelada procedural para bloques voxel 1x1x1 m.
 * @param {string} tipo
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaBloqueVoxel(tipo = 'cesped') {
    const clave = `voxel_${tipo}`;
    if (bancoTexturas.has(clave)) {
        return bancoTexturas.get(clave);
    }

    const def = CATALOGO_BLOQUES.find((b) => b.id === tipo) || CATALOGO_BLOQUES[0];
    const { canvas, ctx } = crearLienzo(128, 128);
    ctx.clearRect(0, 0, 128, 128);

    if (tipo === 'cristal') {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.28)';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 118, 118);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(22, 44);
        ctx.lineTo(48, 18);
        ctx.moveTo(74, 108);
        ctx.lineTo(106, 76);
        ctx.stroke();
    } else if (tipo === 'neon_cian') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 118, 118);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = 4;
        ctx.strokeRect(26, 26, 76, 76);
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(52, 52, 24, 24);
    } else if (tipo === 'ladrillo') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = def.color;
        for (let fila = 0; fila < 4; fila++) {
            const y = fila * 32 + 2;
            const offset = (fila % 2) * 32;
            ctx.fillRect((0 + offset) % 128, y, 58, 26);
            ctx.fillRect((64 + offset) % 128, y, 58, 26);
        }
    } else if (tipo === 'madera') {
        ctx.fillStyle = def.color;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#92400e';
        for (let y = 0; y < 128; y += 32) {
            ctx.fillRect(0, y, 128, 4);
            ctx.fillRect(16, y + 12, 42, 4);
            ctx.fillRect(72, y + 20, 38, 4);
        }
    } else if (tipo === 'piedra') {
        ctx.fillStyle = def.color;
        ctx.fillRect(0, 0, 128, 128);
        const tonos = ['#475569', '#94a3b8', '#334155'];
        for (let y = 0; y < 128; y += 32) {
            for (let x = 0; x < 128; x += 32) {
                ctx.fillStyle = tonos[(x + y) % tonos.length];
                ctx.fillRect(x + 3, y + 3, 26, 26);
            }
        }
    } else if (tipo === 'oro') {
        ctx.fillStyle = '#eab308';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(10, 10, 108, 16);
        ctx.fillRect(10, 10, 16, 108);
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(18, 106, 100, 12);
        ctx.fillRect(106, 18, 12, 100);
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 122, 122);
    } else if (tipo === 'tierra') {
        ctx.fillStyle = def.color;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#713f12';
        for (let i = 0; i < 24; i++) {
            const x = ((i * 37) % 7) * 16 + 8;
            const y = ((i * 53) % 7) * 16 + 8;
            ctx.fillRect(x, y, 12, 12);
        }
    } else {
        // Césped
        ctx.fillStyle = def.color;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#16a34a';
        for (let i = 0; i < 20; i++) {
            const x = ((i * 41) % 8) * 16;
            const y = ((i * 29) % 8) * 16;
            ctx.fillRect(x, y, 14, 14);
        }
        ctx.fillStyle = '#4ade80';
        for (let i = 0; i < 12; i++) {
            const x = ((i * 59) % 8) * 16 + 4;
            const y = ((i * 19) % 8) * 16 + 4;
            ctx.fillRect(x, y, 8, 8);
        }
    }

    const textura = new THREE.CanvasTexture(canvas);
    textura.magFilter = THREE.NearestFilter;
    textura.minFilter = THREE.LinearMipmapLinearFilter;
    bancoTexturas.set(clave, textura);
    return textura;
}

/**
 * Genera y cachea los mapas PBR (map, bumpMap, roughnessMap) de un bloque voxel.
 * @param {string} tipo
 * @returns {{ map: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
 */
export function obtenerMapasPBRBloqueVoxel(tipo = 'cesped') {
    const map = obtenerTexturaBloqueVoxel(tipo);

    const bumpMap = obtenerOCrearTextura(`voxel_bump_${tipo}`, 128, 128, (ctx) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 128, 128);
        if (tipo === 'ladrillo') {
            ctx.fillStyle = '#303030';
            ctx.fillRect(0, 0, 128, 128);
            ctx.fillStyle = '#d8d8d8';
            for (let fila = 0; fila < 4; fila++) {
                const y = fila * 32 + 2;
                const offset = (fila % 2) * 32;
                ctx.fillRect((0 + offset) % 128, y, 58, 26);
                ctx.fillRect((64 + offset) % 128, y, 58, 26);
            }
        } else if (tipo === 'madera') {
            for (let y = 0; y < 128; y += 32) {
                ctx.fillStyle = '#383838';
                ctx.fillRect(0, y, 128, 4);
                ctx.fillStyle = '#b4b4b4';
                ctx.fillRect(0, y + 6, 128, 22);
            }
        } else if (tipo === 'piedra' || tipo === 'cesped' || tipo === 'tierra') {
            for (let y = 0; y < 128; y += 16) {
                for (let x = 0; x < 128; x += 16) {
                    const v = 96 + (((x * 13 + y * 29) % 5) * 24);
                    ctx.fillStyle = `rgb(${v},${v},${v})`;
                    ctx.fillRect(x + 1, y + 1, 14, 14);
                }
            }
        } else {
            ctx.strokeStyle = '#e5e5e5';
            ctx.lineWidth = 10;
            ctx.strokeRect(5, 5, 118, 118);
        }
    }, { pixelado: true });

    const roughnessMap = obtenerOCrearTextura(`voxel_rough_${tipo}`, 128, 128, (ctx) => {
        const base = tipo === 'oro' || tipo === 'cristal' || tipo === 'neon_cian' ? '#454545' : '#bdbdbd';
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#707070';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, 120, 120);
    }, { pixelado: true });

    return { map, bumpMap, roughnessMap };
}

/**
 * Crea una textura temporal para burbujas flotantes de chat rápido 3D.
 * Marcada con `userData.esClonTemporal = true` para liberación segura en GPU.
 * @param {string} texto
 * @returns {THREE.CanvasTexture}
 */
export function crearTexturaBurbujaChat(texto) {
    const { canvas, ctx } = crearLienzo(512, 140);
    ctx.clearRect(0, 0, 512, 140);

    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 6;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(16, 12, 480, 92, 26);
    } else {
        ctx.rect(16, 12, 480, 92);
    }
    ctx.fill();
    ctx.stroke();

    // Puntero inferior de la burbuja
    ctx.beginPath();
    ctx.moveTo(234, 102);
    ctx.lineTo(256, 132);
    ctx.lineTo(278, 102);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const limpio = String(texto || '').trim().slice(0, 34);
    ctx.fillText(limpio, 256, 58);

    const textura = new THREE.CanvasTexture(canvas);
    textura.userData = { esClonTemporal: true };
    return textura;
}

/**
 * Construye una cúpula de cielo multicapa procedural (esfera equirectangular, sol,
 * anillo de nubes volumétricas y siluetas de horizonte) desechable con `liberarObjeto3D`.
 * @param {'lobby_dia'|'taller_atardecer'|'karts_gp'|'tetris_arcade'} [tema]
 * @returns {THREE.Group}
 */
export function crearCupulaCielo(tema = 'lobby_dia') {
    const esAtardecer = tema === 'taller_atardecer';
    const esGP = tema === 'karts_gp';
    const esTetris = tema === 'tetris_arcade';
    const texturaCielo = obtenerOCrearTextura(`cupula_cielo_${tema}`, 1024, 512, (ctx) => {
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        if (esTetris) {
            grad.addColorStop(0, '#090418');
            grad.addColorStop(0.34, '#1e1b4b');
            grad.addColorStop(0.58, '#4c1d95');
            grad.addColorStop(0.76, '#7e22ce');
            grad.addColorStop(1, '#c026d3');
        } else if (esAtardecer) {
            grad.addColorStop(0, '#1e1b4b');
            grad.addColorStop(0.32, '#4c1d95');
            grad.addColorStop(0.54, '#f97316');
            grad.addColorStop(0.7, '#fde047');
            grad.addColorStop(1, '#f59e0b');
        } else if (esGP) {
            grad.addColorStop(0, '#0369a1');
            grad.addColorStop(0.36, '#0ea5e9');
            grad.addColorStop(0.58, '#7dd3fc');
            grad.addColorStop(0.74, '#fef3c7');
            grad.addColorStop(1, '#bae6fd');
        } else {
            grad.addColorStop(0, '#0284c7');
            grad.addColorStop(0.38, '#38bdf8');
            grad.addColorStop(0.6, '#bae6fd');
            grad.addColorStop(0.75, '#e0f2fe');
            grad.addColorStop(1, '#7dd3fc');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        if (esTetris) {
            // Estrellas synthwave y retícula neón en el horizonte
            for (let i = 0; i < 120; i++) {
                ctx.fillStyle = i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#f0abfc' : '#ffffff';
                ctx.fillRect((i * 89) % 1020, (i * 53) % 290, 2, 2);
            }
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.32)';
            ctx.lineWidth = 2;
            for (let y = 320; y <= 512; y += 24) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(1024, y);
                ctx.stroke();
            }
            for (let x = 0; x <= 1024; x += 64) {
                ctx.beginPath();
                ctx.moveTo(x, 320);
                ctx.lineTo(x, 512);
                ctx.stroke();
            }
        }

        // Bandas suaves de nubes o bruma neón en el horizonte
        ctx.fillStyle = esTetris
            ? 'rgba(232, 121, 249, 0.22)'
            : esAtardecer
              ? 'rgba(254, 215, 170, 0.32)'
              : esGP
                ? 'rgba(255, 255, 255, 0.62)'
                : 'rgba(255, 255, 255, 0.48)';
        for (let i = 0; i < 22; i++) {
            const cx = (i * 97) % 1024;
            const cy = 195 + ((i * 37) % 90);
            const rx = 55 + ((i * 23) % 65);
            const ry = esAtardecer || esTetris ? 12 : 22;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Silueta de horizonte (archipiélagos, skyline neon, o tribunas GP)
        ctx.fillStyle = esTetris
            ? 'rgba(15, 23, 42, 0.72)'
            : esAtardecer
              ? 'rgba(49, 46, 129, 0.55)'
              : esGP
                ? 'rgba(15, 23, 42, 0.22)'
                : 'rgba(14, 116, 144, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 325);
        for (let x = 0; x <= 1024; x += 64) {
            const pico = 285 + Math.sin(x * 0.03) * 24 + Math.cos(x * 0.09) * 14;
            ctx.lineTo(x, pico);
        }
        ctx.lineTo(1024, 512);
        ctx.lineTo(0, 512);
        ctx.closePath();
        ctx.fill();
    });

    const grupo = new THREE.Group();
    grupo.name = `cupula_cielo_${tema}`;

    const esfera = new THREE.Mesh(
        new THREE.SphereGeometry(220, 32, 20),
        new THREE.MeshBasicMaterial({
            map: texturaCielo,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false
        })
    );
    grupo.add(esfera);

    const solPos = esTetris
        ? new THREE.Vector3(0, 52, -165)
        : esAtardecer
          ? new THREE.Vector3(-95, 42, -145)
          : esGP
            ? new THREE.Vector3(45, 130, -120)
            : new THREE.Vector3(65, 115, -130);
    const discoSol = new THREE.Mesh(
        new THREE.CircleGeometry(esTetris ? 18 : 13, 28),
        new THREE.MeshBasicMaterial({
            color: esTetris ? 0xe879f9 : esAtardecer ? 0xfef08a : 0xffffff,
            fog: false
        })
    );
    discoSol.position.copy(solPos);
    discoSol.lookAt(0, 0, 0);
    grupo.add(discoSol);

    const haloSol = new THREE.Mesh(
        new THREE.CircleGeometry(esTetris ? 30 : 24, 28),
        new THREE.MeshBasicMaterial({
            color: esTetris ? 0x22d3ee : esAtardecer ? 0xfb923c : 0xfef08a,
            transparent: true,
            opacity: 0.32,
            fog: false,
            depthWrite: false
        })
    );
    haloSol.position.copy(solPos).multiplyScalar(1.01);
    haloSol.lookAt(0, 0, 0);
    grupo.add(haloSol);

    if (esTetris) {
        // Poliedros brillantes flotantes estilo Synthwave Arcade
        const coloresNeon = [0x22d3ee, 0xe879f9, 0xfacc15, 0xa855f7];
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const radio = 132 + (i % 3) * 14;
            const color = coloresNeon[i % coloresNeon.length];
            const poliedro = new THREE.Mesh(
                i % 2 === 0 ? new THREE.OctahedronGeometry(4.2, 0) : new THREE.BoxGeometry(5.5, 5.5, 5.5),
                new THREE.MeshStandardMaterial({
                    color,
                    emissive: color,
                    emissiveIntensity: 0.9,
                    roughness: 0.25,
                    fog: false
                })
            );
            poliedro.position.set(Math.cos(ang) * radio, 34 + (i % 4) * 9, Math.sin(ang) * radio);
            poliedro.rotation.set(i * 0.4, i * 0.6, 0);
            grupo.add(poliedro);
        }
    } else {
        const matNube = new THREE.MeshStandardMaterial({
            color: esAtardecer ? 0xfed7aa : 0xffffff,
            emissive: esAtardecer ? 0xf97316 : 0xe0f2fe,
            emissiveIntensity: esAtardecer ? 0.35 : 0.22,
            roughness: 0.9,
            fog: false
        });
        for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2;
            const radio = 138 + (i % 3) * 10;
            const nubeGrupo = new THREE.Group();
            nubeGrupo.position.set(
                Math.cos(ang) * radio,
                38 + (i % 4) * 6,
                Math.sin(ang) * radio
            );
            for (let p = -1; p <= 1; p++) {
                const puff = new THREE.Mesh(
                    new THREE.IcosahedronGeometry(p === 0 ? 7.5 : 5.5, 1),
                    matNube.clone()
                );
                puff.position.set(p * 6.5, p === 0 ? 1.5 : 0, (p % 2) * 2);
                puff.scale.set(1.3, 0.72, 1.0);
                nubeGrupo.add(puff);
            }
            grupo.add(nubeGrupo);
        }
        matNube.dispose();
    }

    // Siluetas lejanas en el horizonte (islas, agujas o skyline neón)
    const matSilueta = new THREE.MeshStandardMaterial({
        color: esTetris ? 0x1e1b4b : esAtardecer ? 0x312e81 : esGP ? 0x1e3a8a : 0x0e7490,
        emissive: esTetris ? 0x4c1d95 : 0x000000,
        emissiveIntensity: esTetris ? 0.45 : 0,
        roughness: 0.85,
        fog: false
    });
    for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.2;
        const dist = 175;
        const pico = new THREE.Mesh(
            esAtardecer || esTetris
                ? new THREE.BoxGeometry(10, 26 + (i % 3) * 12, 10)
                : esGP
                  ? new THREE.BoxGeometry(18, 16 + (i % 2) * 8, 8)
                  : new THREE.ConeGeometry(16, 22 + (i % 3) * 8, 6),
            matSilueta.clone()
        );
        pico.position.set(Math.cos(ang) * dist, 2, Math.sin(ang) * dist);
        pico.lookAt(0, 2, 0);
        grupo.add(pico);
    }
    if (esGP) {
        const dirigible = new THREE.Mesh(
            new THREE.SphereGeometry(9, 16, 12),
            new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, fog: false })
        );
        dirigible.scale.set(2.2, 0.85, 0.85);
        dirigible.position.set(-70, 56, -125);
        grupo.add(dirigible);
    }
    matSilueta.dispose();

    return grupo;
}

/**
 * Genera y cachea la textura procedural de asfalto GP con línea central y pianos rojo/blanco.
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaPistaKart() {
    return obtenerOCrearTextura('pista_kart_asfalto', 256, 256, (ctx) => {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, 256, 256);

        // Pianos (curbs) rojo/blanco en bordes izquierdo y derecho
        for (let y = 0; y < 256; y += 64) {
            ctx.fillStyle = (y / 64) % 2 === 0 ? '#ef4444' : '#f8fafc';
            ctx.fillRect(0, y, 22, 64);
            ctx.fillRect(234, y, 22, 64);
        }

        // Líneas blancas laterales y central discontinua
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(24, 0, 5, 256);
        ctx.fillRect(227, 0, 5, 256);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(124, 16, 8, 96);
        ctx.fillRect(124, 144, 8, 96);
    }, { repetir: 1, anisotropia: 4 });
}

/**
 * Genera y cachea la textura luminosa de Turbo Pad con chevrones brillantes.
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaTurboPad() {
    return obtenerOCrearTextura('textura_turbo_pad', 256, 256, (ctx) => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, 240, 240);

        const colores = ['#22d3ee', '#fde047', '#38bdf8'];
        for (let i = 0; i < 3; i++) {
            const yBase = 64 + i * 64;
            ctx.strokeStyle = colores[i];
            ctx.lineWidth = 18;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(46, yBase + 34);
            ctx.lineTo(128, yBase - 22);
            ctx.lineTo(210, yBase + 34);
            ctx.stroke();
        }
    });
}

/**
 * Genera y cachea la textura damero blanco y negro para arco y línea de meta.
 * @returns {THREE.CanvasTexture}
 */
export function obtenerTexturaMetaDamero() {
    return obtenerOCrearTextura('meta_damero_gp', 256, 64, (ctx) => {
        for (let fila = 0; fila < 2; fila++) {
            for (let col = 0; col < 8; col++) {
                ctx.fillStyle = (fila + col) % 2 === 0 ? '#0f172a' : '#f8fafc';
                ctx.fillRect(col * 32, fila * 32, 32, 32);
            }
        }
    });
}

/**
 * Genera y cachea mapas PBR procedurales para neumáticos y disco de freno ventilado.
 * @param {'clasica'|'slick_gp'|'todoterreno'|'neon_drift'|'rueda_clasica'|'rueda_slick'|'rueda_offroad'|'rueda_neon'} [estilo]
 * @returns {{ map: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, rotorMap: THREE.CanvasTexture }}
 */
export function obtenerTexturaNeumatico(estilo = 'clasica') {
    const mapaEstilo = {
        rueda_clasica: 'clasica',
        clasica: 'clasica',
        rueda_slick: 'slick_gp',
        slick_gp: 'slick_gp',
        rueda_offroad: 'todoterreno',
        todoterreno: 'todoterreno',
        rueda_neon: 'neon_drift',
        neon_drift: 'neon_drift'
    };
    const tipo = mapaEstilo[estilo] || 'clasica';

    const map = obtenerOCrearTextura(`neumatico_albedo_${tipo}`, 256, 256, (ctx) => {
        ctx.fillStyle = tipo === 'slick_gp' ? '#171c26' : '#111827';
        ctx.fillRect(0, 0, 256, 256);

        // Micrograno de caucho vulcanizado
        for (let i = 0; i < 160; i++) {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.22)';
            ctx.fillRect((i * 43) % 250, (i * 71) % 250, 5, 5);
        }

        if (tipo === 'todoterreno') {
            for (let y = 0; y < 256; y += 32) {
                const par = (y / 32) % 2 === 0;
                ctx.fillStyle = '#030712';
                ctx.fillRect(0, y, 256, 8);
                ctx.fillStyle = '#1f2937';
                for (let x = par ? 6 : 26; x < 246; x += 48) {
                    ctx.fillRect(x, y + 8, 34, 20);
                }
            }
        } else if (tipo === 'neon_drift') {
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            for (let y = 18; y < 256; y += 42) {
                ctx.beginPath();
                ctx.moveTo(20, y);
                ctx.lineTo(128, y + 22);
                ctx.lineTo(236, y);
                ctx.stroke();
            }
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(122, 0, 12, 256);
        } else if (tipo === 'slick_gp') {
            ctx.fillStyle = '#05080f';
            ctx.fillRect(72, 0, 12, 256);
            ctx.fillRect(172, 0, 12, 256);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(10, 0, 10, 256);
            ctx.fillRect(236, 0, 10, 256);
        } else {
            // Dibujo en V clásico con canal central de evacuación
            ctx.fillStyle = '#030712';
            ctx.fillRect(122, 0, 12, 256);
            ctx.strokeStyle = '#030712';
            ctx.lineWidth = 10;
            for (let y = 16; y < 270; y += 34) {
                ctx.beginPath();
                ctx.moveTo(12, y - 18);
                ctx.lineTo(128, y + 8);
                ctx.lineTo(244, y - 18);
                ctx.stroke();
            }
        }
    }, { repetir: 2, anisotropia: 4 });

    const bumpMap = obtenerOCrearTextura(`neumatico_bump_${tipo}`, 256, 256, (ctx) => {
        ctx.fillStyle = '#d4d4d4';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#262626';
        ctx.strokeStyle = '#262626';

        if (tipo === 'todoterreno') {
            for (let y = 0; y < 256; y += 32) {
                ctx.fillRect(0, y, 256, 10);
                const par = (y / 32) % 2 === 0;
                ctx.fillRect(par ? 44 : 0, y + 10, 24, 22);
            }
        } else if (tipo === 'slick_gp') {
            ctx.fillRect(72, 0, 12, 256);
            ctx.fillRect(172, 0, 12, 256);
        } else {
            ctx.fillRect(122, 0, 12, 256);
            ctx.lineWidth = tipo === 'neon_drift' ? 8 : 11;
            for (let y = 16; y < 270; y += tipo === 'neon_drift' ? 42 : 34) {
                ctx.beginPath();
                ctx.moveTo(16, y - 16);
                ctx.lineTo(128, y + 10);
                ctx.lineTo(240, y - 16);
                ctx.stroke();
            }
        }
    }, { repetir: 2 });

    const roughnessMap = obtenerOCrearTextura(`neumatico_rough_${tipo}`, 256, 256, (ctx) => {
        ctx.fillStyle = tipo === 'slick_gp' ? '#a8a8a8' : '#d2d2d2';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#757575';
        ctx.fillRect(118, 0, 20, 256);
    }, { repetir: 2 });

    const rotorMap = obtenerOCrearTextura(`disco_freno_${tipo}`, 128, 128, (ctx) => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 128, 128);

        // Disco metálico ventilado
        const grad = ctx.createRadialGradient(64, 64, 18, 64, 64, 60);
        grad.addColorStop(0, '#475569');
        grad.addColorStop(0.38, '#cbd5e1');
        grad.addColorStop(0.9, '#94a3b8');
        grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(64, 64, 59, 0, Math.PI * 2);
        ctx.fill();

        // Perforaciones radiales de refrigeración
        ctx.fillStyle = '#1e293b';
        for (let a = 0; a < 12; a++) {
            const ang = (a / 12) * Math.PI * 2;
            for (const rad of [36, 48]) {
                ctx.beginPath();
                ctx.arc(64 + Math.cos(ang + rad * 0.02) * rad, 64 + Math.sin(ang + rad * 0.02) * rad, 2.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Pinza deportiva de freno
        ctx.fillStyle = tipo === 'neon_drift' ? '#22d3ee' : '#ef4444';
        ctx.beginPath();
        ctx.arc(64, 64, 58, -0.55, 0.55);
        ctx.arc(64, 64, 38, 0.55, -0.55, true);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(64, 64, 21, 0, Math.PI * 2);
        ctx.fill();
    });

    return { map, bumpMap, roughnessMap, rotorMap };
}

/**
 * Genera y cachea texturas PBR de carrocería (fibra de carbono, juntas, rejillas y franjas) según arquetipo.
 * @param {'kart_batmovil'|'kart_formula'|'kart_lemans'|'kart_tumbler'} [arquetipo]
 * @param {number|string} [colorHex]
 * @returns {{ map: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
 */
export function obtenerTexturaChasisKart(arquetipo = 'kart_batmovil', colorHex = '#ff2e4c') {
    const colorCss = formatearColorCss(colorHex);
    const tipo = arquetipo || 'kart_batmovil';
    const claveBase = `chasis_${tipo}_${colorCss.replace('#', '')}`;

    const map = obtenerOCrearTextura(`${claveBase}_albedo`, 256, 256, (ctx) => {
        ctx.fillStyle = colorCss;
        ctx.fillRect(0, 0, 256, 256);

        // Franjas laterales de fibra de carbono tejida
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 186, 256, 70);
        for (let y = 188; y < 254; y += 8) {
            for (let x = ((y / 8) % 2) * 8; x < 256; x += 16) {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(x, y, 7, 7);
            }
        }

        // Livery y emblema según arquetipo
        if (tipo === 'kart_batmovil') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
            ctx.fillRect(0, 0, 256, 256);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(48, 70);
            ctx.lineTo(128, 36);
            ctx.lineTo(208, 70);
            ctx.lineTo(128, 108);
            ctx.closePath();
            ctx.stroke();
        } else if (tipo === 'kart_formula') {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(104, 0, 14, 186);
            ctx.fillRect(138, 0, 14, 186);
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(128, 92, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 26px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('01', 128, 93);
        } else if (tipo === 'kart_lemans') {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(92, 0, 24, 186);
            ctx.fillRect(140, 0, 24, 186);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(120, 0, 16, 186);
        } else if (tipo === 'kart_tumbler') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
            ctx.fillRect(0, 0, 256, 186);
            // Franja táctica de advertencia diagonal
            ctx.fillStyle = '#facc15';
            for (let x = -20; x < 260; x += 28) {
                ctx.beginPath();
                ctx.moveTo(x, 166);
                ctx.lineTo(x + 14, 166);
                ctx.lineTo(x + 26, 186);
                ctx.lineTo(x + 12, 186);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Juntas de panel metálicas y tomas de refrigeración
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.65)';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, 236, 168);
        ctx.beginPath();
        ctx.moveTo(10, 96);
        ctx.lineTo(246, 96);
        ctx.stroke();

        ctx.fillStyle = '#090d16';
        for (let r = 0; r < 5; r++) {
            ctx.fillRect(24, 122 + r * 9, 44, 5);
            ctx.fillRect(188, 122 + r * 9, 44, 5);
        }
    }, { anisotropia: 4 });

    const bumpMap = obtenerOCrearTextura(`chasis_bump_${tipo}`, 256, 256, (ctx) => {
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 0, 256, 256);
        for (let y = 188; y < 254; y += 8) {
            for (let x = ((y / 8) % 2) * 8; x < 256; x += 16) {
                ctx.fillStyle = '#b0b0b0';
                ctx.fillRect(x, y, 7, 7);
            }
        }
        ctx.strokeStyle = '#303030';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, 236, 168);
        ctx.fillStyle = '#252525';
        for (let r = 0; r < 5; r++) {
            ctx.fillRect(24, 122 + r * 9, 44, 5);
            ctx.fillRect(188, 122 + r * 9, 44, 5);
        }
    });

    const roughnessMap = obtenerOCrearTextura(`chasis_rough_${tipo}`, 256, 256, (ctx) => {
        ctx.fillStyle = '#484848';
        ctx.fillRect(0, 0, 256, 186);
        ctx.fillStyle = '#a4a4a4';
        ctx.fillRect(0, 186, 256, 70);
        ctx.fillStyle = '#dcdcdc';
        for (let r = 0; r < 5; r++) {
            ctx.fillRect(24, 122 + r * 9, 44, 5);
            ctx.fillRect(188, 122 + r * 9, 44, 5);
        }
    });

    return { map, bumpMap, roughnessMap };
}

/**
 * Crea una textura temporal para el cartel flotante del jugador.
 * Marcada con `userData.esClonTemporal = true` para liberación segura en GPU.
 * @param {string} apodo
 * @param {number} nivel
 * @returns {THREE.CanvasTexture}
 */
export function crearTexturaEtiqueta(apodo, nivel) {
    const { canvas, ctx } = crearLienzo(256, 64);
    ctx.clearRect(0, 0, 256, 64);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(8, 8, 240, 48, 14);
    } else {
        ctx.rect(8, 8, 240, 48);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const texto = `[Nv.${nivel}] ${String(apodo || 'Jugador').slice(0, 14)}`;
    ctx.fillText(texto, 128, 33);

    const textura = new THREE.CanvasTexture(canvas);
    textura.userData = { esClonTemporal: true };
    return textura;
}

/**
 * Garantiza un AudioContext activo tras la primera interacción del usuario.
 * @returns {AudioContext|null}
 */
function obtenerContextoAudio() {
    if (estadoAudio.silenciado || typeof window === 'undefined') {
        return null;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!estadoAudio.contexto) {
        estadoAudio.contexto = new AudioCtx();
    }
    if (estadoAudio.contexto.state === 'suspended') {
        estadoAudio.contexto.resume().catch(() => {});
    }
    return estadoAudio.contexto;
}

/**
 * Activa o silencia el sintetizador procedural de audio.
 * @returns {boolean} Nuevo estado de silencio
 */
export function alternarSilencioAudio() {
    estadoAudio.silenciado = !estadoAudio.silenciado;
    return estadoAudio.silenciado;
}

/**
 * Dispara un efecto de sonido procedural mediante Web Audio API.
 * @param {'paso'|'salto'|'moneda'|'portal'|'nivel'|'interaccion'|'beep_salida'|'salida_go'|'choque_kart'|'fuegos_artificiales'|'tetris_mover'|'tetris_rotar'|'tetris_fijar'|'tetris_linea'|'tetris_cuadruple'|'tetris_gameover'} tipo
 * @param {number} [intensidad]
 */
export function reproducirSonido(tipo, intensidad = 1) {
    const ctx = obtenerContextoAudio();
    if (!ctx) return;

    const ahora = ctx.currentTime;

    const tocarTono = (freqInicio, freqFin, duracion, forma = 'sine', ganancia = 0.12, retardo = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = forma;
        osc.frequency.setValueAtTime(freqInicio, ahora + retardo);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqFin), ahora + retardo + duracion);

        gain.gain.setValueAtTime(0.0001, ahora + retardo);
        gain.gain.linearRampToValueAtTime(ganancia, ahora + retardo + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ahora + retardo + duracion);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ahora + retardo);
        osc.stop(ahora + retardo + duracion + 0.02);
    };

    switch (tipo) {
        case 'paso':
            tocarTono(120, 65, 0.06, 'triangle', 0.05);
            break;
        case 'salto':
            tocarTono(240, 540, 0.16, 'sine', 0.12);
            break;
        case 'moneda':
            tocarTono(880, 1175, 0.09, 'sine', 0.14, 0);
            tocarTono(1175, 1568, 0.14, 'sine', 0.14, 0.07);
            break;
        case 'portal':
            tocarTono(220, 660, 0.35, 'sawtooth', 0.08, 0);
            tocarTono(330, 880, 0.38, 'triangle', 0.09, 0.05);
            break;
        case 'nivel':
            tocarTono(523.25, 523.25, 0.11, 'triangle', 0.14, 0);
            tocarTono(659.25, 659.25, 0.11, 'triangle', 0.14, 0.1);
            tocarTono(783.99, 1046.5, 0.25, 'triangle', 0.16, 0.2);
            break;
        case 'beep_salida':
            tocarTono(520, 500, 0.12, 'triangle', 0.15, 0);
            break;
        case 'salida_go':
            tocarTono(880, 1174.66, 0.28, 'triangle', 0.2, 0);
            tocarTono(1318.5, 1567.98, 0.26, 'sine', 0.14, 0.08);
            break;
        case 'choque_kart': {
            const esc = Math.max(0.45, Math.min(1.4, intensidad));
            tocarTono(145, 48, 0.16, 'sawtooth', 0.2 * esc, 0);
            tocarTono(420, 180, 0.12, 'triangle', 0.14 * esc, 0.015);
            tocarTono(860, 310, 0.09, 'square', 0.07 * esc, 0.03);
            break;
        }
        case 'fuegos_artificiales': {
            tocarTono(380, 1120, 0.18, 'sine', 0.09, 0);
            tocarTono(180, 55, 0.22, 'sawtooth', 0.18, 0.16);
            tocarTono(920, 340, 0.16, 'triangle', 0.12, 0.17);
            break;
        }
        case 'tetris_mover':
            tocarTono(340, 390, 0.045, 'triangle', 0.08, 0);
            break;
        case 'tetris_rotar':
            tocarTono(460, 680, 0.07, 'sine', 0.11, 0);
            tocarTono(680, 880, 0.06, 'triangle', 0.09, 0.03);
            break;
        case 'tetris_fijar':
            tocarTono(190, 95, 0.08, 'triangle', 0.14, 0);
            break;
        case 'tetris_linea':
            tocarTono(587.33, 783.99, 0.12, 'triangle', 0.14, 0);
            tocarTono(783.99, 1046.5, 0.18, 'sine', 0.15, 0.08);
            break;
        case 'tetris_cuadruple':
            tocarTono(523.25, 523.25, 0.09, 'triangle', 0.15, 0);
            tocarTono(659.25, 659.25, 0.09, 'triangle', 0.15, 0.07);
            tocarTono(783.99, 783.99, 0.09, 'triangle', 0.16, 0.14);
            tocarTono(1046.5, 1318.5, 0.26, 'sine', 0.18, 0.21);
            break;
        case 'tetris_gameover':
            tocarTono(440, 392, 0.14, 'sawtooth', 0.12, 0);
            tocarTono(370, 330, 0.14, 'sawtooth', 0.12, 0.14);
            tocarTono(311, 220, 0.28, 'triangle', 0.14, 0.28);
            break;
        case 'interaccion':
        default:
            tocarTono(440, 660, 0.09, 'sine', 0.1);
            break;
    }
}

/**
 * Libera recursivamente geometrías, materiales y texturas temporales de un Object3D.
 * Uso obligatorio al desmontar experiencias o eliminar entidades dinámicas.
 * @param {THREE.Object3D} objeto
 */
export function liberarObjeto3D(objeto) {
    if (!objeto) return;

    objeto.traverse((nodo) => {
        if (nodo.geometry && typeof nodo.geometry.dispose === 'function') {
            nodo.geometry.dispose();
        }
        if (nodo.material) {
            const materiales = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
            for (const mat of materiales) {
                if (!mat) continue;
                for (const slot of SLOTS_TEXTURA) {
                    const textura = mat[slot];
                    if (textura && textura.userData?.esClonTemporal === true && typeof textura.dispose === 'function') {
                        textura.dispose();
                    }
                }
                if (typeof mat.dispose === 'function') {
                    mat.dispose();
                }
            }
        }
    });

    if (objeto.parent) {
        objeto.parent.remove(objeto);
    }
}
