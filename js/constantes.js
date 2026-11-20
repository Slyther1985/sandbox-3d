/**
 * Constantes globales de la plataforma Sandbox 3D.
 * Módulo hoja del DAG (sin dependencias).
 */

export const DIMENSION_LOBBY = 80;
export const MITAD_LOBBY = 40;
export const DIMENSION_PARCELA = 32;
export const MITAD_PARCELA = 16;
export const DIMENSION_PISTA_KARTS = 160;
export const MITAD_PISTA_KARTS = 80;
export const VUELTAS_CARRERA_KARTS = 2;
export const LIMITE_MUNDO = 38.5;
export const ALTURA_CAIDA_VACIO = -15;

export const GRAVEDAD_BASE = -22;
export const VELOCIDAD_CAMINAR = 7.5;
export const VELOCIDAD_SPRINT = 12.5;
export const FUERZA_SALTO = 10.5;
export const ALTURA_AVATAR = 2.2;
export const RADIO_COLISION_AVATAR = 0.55;
export const DISTANCIA_INTERACCION = 3.2;

export const TASA_ENVIO_HZ = 20;
export const INTERVALO_ENVIO_MS = 1000 / TASA_ENVIO_HZ;

export const XP_BASE_NIVEL = 100;
export const MONEDAS_INICIALES = 50;

export const COMUN = 'COMUN';
export const RARO = 'RARO';
export const EPICO = 'EPICO';
export const LEGENDARIO = 'LEGENDARIO';

export const RAREZAS = Object.freeze({
    [COMUN]: { id: COMUN, nombre: 'Común', color: '#9ca3af', precioBase: 25 },
    [RARO]: { id: RARO, nombre: 'Raro', color: '#3b82f6', precioBase: 75 },
    [EPICO]: { id: EPICO, nombre: 'Épico', color: '#a855f7', precioBase: 160 },
    [LEGENDARIO]: { id: LEGENDARIO, nombre: 'Legendario', color: '#f59e0b', precioBase: 350 }
});

export const PALETA_AVATAR = Object.freeze({
    piel: ['#f1c27d', '#ffdbac', '#e0ac69', '#c68642', '#8d5524', '#38bdf8'],
    torso: ['#00a8ff', '#2563eb', '#10b981', '#f43f5e', '#8b5cf6', '#f97316', '#eab308', '#1e293b'],
    piernas: ['#2f3640', '#1e293b', '#1e3a8a', '#064e3b', '#4c1d95', '#7c2d12', '#374151', '#0f172a'],
    rostros: ['feliz', 'epico', 'lentes', 'robot']
});

export const CATALOGO_BLOQUES = Object.freeze([
    { id: 'cesped', nombre: 'Césped', color: '#22c55e', transparente: false, emisivo: false },
    { id: 'tierra', nombre: 'Tierra', color: '#854d0e', transparente: false, emisivo: false },
    { id: 'piedra', nombre: 'Piedra', color: '#64748b', transparente: false, emisivo: false },
    { id: 'madera', nombre: 'Madera', color: '#b45309', transparente: false, emisivo: false },
    { id: 'ladrillo', nombre: 'Ladrillo', color: '#b91c1c', transparente: false, emisivo: false },
    { id: 'cristal', nombre: 'Cristal', color: '#7dd3fc', transparente: true, emisivo: false },
    { id: 'neon_cian', nombre: 'Neón Cian', color: '#06b6d4', transparente: false, emisivo: true },
    { id: 'oro', nombre: 'Oro', color: '#facc15', transparente: false, emisivo: false }
]);

export const CATALOGO_ITEMS = Object.freeze([
    {
        id: 'gorra_neon',
        nombre: 'Gorra Neón',
        descripcion: 'Gorra urbana luminosa del Lobby Central.',
        slot: 'cabeza',
        rareza: COMUN,
        precio: 0,
        colorHex: 0x06b6d4
    },
    {
        id: 'visor_cibernetico',
        nombre: 'Visor Cibernético',
        descripcion: 'Gafas luminosas de neón azul.',
        slot: 'cabeza',
        rareza: RARO,
        precio: 60,
        colorHex: 0x38bdf8
    },
    {
        id: 'mochila_jet',
        nombre: 'Mochila Jet',
        descripcion: 'Mochila futurista con propulsores dobles.',
        slot: 'espalda',
        rareza: EPICO,
        precio: 140,
        colorHex: 0x9333ea
    },
    {
        id: 'alas_pixel',
        nombre: 'Alas Píxel',
        descripcion: 'Alas holográficas estilo voxel cian.',
        slot: 'espalda',
        rareza: EPICO,
        precio: 180,
        colorHex: 0x22d3ee
    },
    {
        id: 'corona_oro',
        nombre: 'Corona de Oro',
        descripcion: 'Corona dorada para pioneros del Sandbox.',
        slot: 'cabeza',
        rareza: LEGENDARIO,
        precio: 300,
        colorHex: 0xf59e0b
    },
    {
        id: 'aura_estelar',
        nombre: 'Aura Estelar',
        descripcion: 'Anillo orbital dorado alrededor del avatar.',
        slot: 'aura',
        rareza: LEGENDARIO,
        precio: 350,
        colorHex: 0xfbbf24
    }
]);

export const CATALOGO_KARTS = Object.freeze([
    {
        id: 'kart_batmovil',
        nombre: 'Interceptor Nocturno',
        descripcion: 'Interceptor táctico blindado con turbina frontal y doble aleta trasera.',
        velocidad: 45,
        aceleracion: 39,
        control: 36,
        pesoImpacto: 1.25,
        asientoOffset: { x: 0, y: 0.31, z: -0.08 }
    },
    {
        id: 'kart_formula',
        nombre: 'Monoplaza GP Apex',
        descripcion: 'Fórmula aerodinámico ultraligero con halo protector y alerón multielemento.',
        velocidad: 52,
        aceleracion: 34,
        control: 34,
        pesoImpacto: 0.85,
        asientoOffset: { x: 0, y: 0.27, z: -0.1 }
    },
    {
        id: 'kart_lemans',
        nombre: 'Prototipo Le Mans GT',
        descripcion: 'Hiperauto de resistencia equilibrado con aleta dorsal y pasos de rueda LMP.',
        velocidad: 44,
        aceleracion: 34,
        control: 42,
        pesoImpacto: 1.0,
        asientoOffset: { x: 0, y: 0.30, z: -0.08 }
    },
    {
        id: 'kart_tumbler',
        nombre: 'Tanque Urbano 4x4',
        descripcion: 'Asalto pesado blindado con suspensión delantera expuesta y doble eje trasero.',
        velocidad: 34,
        aceleracion: 48,
        control: 38,
        pesoImpacto: 1.45,
        asientoOffset: { x: 0, y: 0.43, z: -0.06 }
    }
]);

export const CATALOGO_PIEZAS_KART = Object.freeze({
    ruedas: [
        {
            id: 'rueda_clasica',
            nombre: 'Clásica',
            radio: 0.28,
            ancho: 0.22,
            colorLlanta: 0xe2e8f0,
            emisivo: false,
            modStats: { velocidad: 0, aceleracion: 0, control: 0 }
        },
        {
            id: 'rueda_slick',
            nombre: 'Slick GP',
            radio: 0.27,
            ancho: 0.26,
            colorLlanta: 0xfacc15,
            emisivo: false,
            modStats: { velocidad: 6, aceleracion: -2, control: -2 }
        },
        {
            id: 'rueda_offroad',
            nombre: 'Todoterreno',
            radio: 0.34,
            ancho: 0.3,
            colorLlanta: 0x94a3b8,
            emisivo: false,
            modStats: { velocidad: -4, aceleracion: 6, control: 3 }
        },
        {
            id: 'rueda_neon',
            nombre: 'Neón Drift',
            radio: 0.29,
            ancho: 0.24,
            colorLlanta: 0x22d3ee,
            emisivo: true,
            modStats: { velocidad: 2, aceleracion: -3, control: 7 }
        }
    ],
    alerones: [
        {
            id: 'aleron_ninguno',
            nombre: 'Sin Alerón',
            modStats: { velocidad: 2, aceleracion: 3, control: -4 }
        },
        {
            id: 'aleron_gt',
            nombre: 'Alerón GT',
            modStats: { velocidad: 2, aceleracion: 0, control: 4 }
        },
        {
            id: 'aleron_cohete',
            nombre: 'Turbina Cohete',
            modStats: { velocidad: 7, aceleracion: 4, control: -5 }
        },
        {
            id: 'aleron_ala',
            nombre: 'Doble Ala Pro',
            modStats: { velocidad: -2, aceleracion: 2, control: 8 }
        }
    ],
    colores: [
        '#ff2e4c',
        '#00a8ff',
        '#22c55e',
        '#facc15',
        '#a855f7',
        '#f97316',
        '#06b6d4',
        '#f8fafc'
    ]
});
