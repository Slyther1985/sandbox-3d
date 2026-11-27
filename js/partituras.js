/**
 * Catálogo de partituras 16-bit multipista (módulo hoja Nivel 0 del DAG, sin dependencias).
 * Cada tema posee 8 compases completos (128 pasos a resolución de semicorchea `subdivision: 4`)
 * divididos en Sección A (compases 1–4) y Sección B (compases 5–8), con melodía, armonía, bajo y percusión.
 */

const SEMITONOS_BASE = Object.freeze({
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
});

/**
 * Convierte notación científica (`'C2'`..`'C7'`, `'F#4'`, `'Bb4'`, silencio `'_'`, ligado `'~'`) a frecuencia exacta en Hz.
 * @param {string} nota
 * @returns {number|null}
 */
export function notaAFrecuencia(nota) {
    if (typeof nota !== 'string') return null;
    const limpia = nota.trim();
    if (!limpia || limpia === '_' || limpia === '~') return null;

    const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(limpia);
    if (!match) return null;

    const letra = match[1].toUpperCase();
    const alteracion = match[2];
    const octava = Number(match[3]);
    let semitono = SEMITONOS_BASE[letra];
    if (typeof semitono !== 'number') return null;

    if (alteracion === '#') semitono += 1;
    else if (alteracion === 'b') semitono -= 1;

    const midi = (octava + 1) * 12 + semitono;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Empaqueta 8 compases de 16 pasos cada uno asegurando longitud uniforme.
 * @param {string[][]} compases
 * @returns {string[]}
 */
function unirCompases(compases) {
    return compases.flat();
}

export const MAPA_MUSICA_EXPERIENCIA = Object.freeze({
    lobby: 'lobby_parque',
    karts: 'karts_topgear',
    tetris: 'tetris_ruso',
    construccion: 'taller_clasico',
    parkour: 'lobby_parque'
});

export const CATALOGO_PARTITURAS = Object.freeze({
    /**
     * Tema 1: Parque de Diversiones Estelar — Alegre, sincopado, saltos de octava estilo Super Mario World (136 BPM).
     */
    lobby_parque: {
        id: 'lobby_parque',
        titulo: 'Parque Estelar 16-Bit',
        estilo: 'Super Mario World / Feria Alegre',
        bpm: 136,
        subdivision: 4,
        pasos: 128,
        volumenPercusion: 0.72,
        melodia: {
            onda: 'square',
            volumen: 0.34,
            ataque: 0.008,
            liberacion: 0.08,
            freqCorte: 3200,
            unison: true,
            vibrato: true,
            slideEntrada: true,
            notas: unirCompases([
                // Sección A (compases 1–4: C -> G -> F -> G7)
                ['E5', '_', 'G5', '_', 'C6', '~', 'G5', '_', 'E5', 'G5', 'A5', '_', 'G5', '~', 'E5', '_'],
                ['D5', '_', 'G5', '_', 'B5', '~', 'A5', 'G5', 'F5', '~', 'D5', '_', 'B4', 'D5', 'G5', '_'],
                ['A5', '~', 'F5', '_', 'C6', '_', 'A5', '_', 'G5', 'E5', 'C5', '_', 'E5', '_', 'G5', '_'],
                ['F5', '~', 'D5', '_', 'G5', '_', 'B5', '_', 'C6', '~', 'B5', 'A5', 'G5', '~', 'E5', '_'],
                // Sección B (compases 5–8: Am -> F -> Dm7 -> G7 -> C)
                ['A5', '~', 'E5', '_', 'C5', 'E5', 'A5', '_', 'B5', '_', 'C6', '~', 'A5', '_', 'E5', '_'],
                ['F5', '_', 'A5', '_', 'C6', '~', 'B5', 'A5', 'G5', '_', 'E5', '_', 'C5', '~', 'D5', 'E5'],
                ['F5', '~', 'A5', '_', 'D6', '_', 'C6', '_', 'B5', 'A5', 'G5', '~', 'F5', 'E5', 'D5', '_'],
                ['G5', '_', 'A5', '_', 'B5', '~', 'D6', '_', 'C6', '~', '_', 'G5', 'C6', '~', 'G5', '_']
            ])
        },
        armonia: {
            onda: 'triangle',
            volumen: 0.24,
            ataque: 0.01,
            liberacion: 0.09,
            freqCorte: 2800,
            arpegio: true,
            notas: unirCompases([
                ['_', '_', 'C4/E4/G4', '_', '_', '_', 'C4/E4/G4', '_', '_', '_', 'C4/E4/G4', '_', '_', '_', 'C4/E4/G4', '_'],
                ['_', '_', 'G3/B3/D4', '_', '_', '_', 'G3/B3/D4', '_', '_', '_', 'G3/B3/D4/F4', '_', '_', '_', 'G3/B3/D4', '_'],
                ['_', '_', 'F3/A3/C4', '_', '_', '_', 'F3/A3/C4', '_', '_', '_', 'C4/E4/G4', '_', '_', '_', 'C4/E4/G4', '_'],
                ['_', '_', 'D4/F4/A4', '_', '_', '_', 'G3/B3/D4', '_', '_', '_', 'C4/E4/G4', '_', 'G3/B3/D4', '_', '_', '_'],
                ['_', '_', 'A3/C4/E4', '_', '_', '_', 'A3/C4/E4', '_', '_', '_', 'A3/C4/E4', '_', '_', '_', 'A3/C4/E4', '_'],
                ['_', '_', 'F3/A3/C4', '_', '_', '_', 'F3/A3/C4', '_', '_', '_', 'C4/E4/G4', '_', '_', '_', 'C4/E4/G4', '_'],
                ['_', '_', 'D4/F4/A4/C5', '_', '_', '_', 'D4/F4/A4', '_', '_', '_', 'G3/B3/D4', '_', '_', '_', 'G3/B3/D4/F4', '_'],
                ['_', '_', 'G3/B3/D4', '_', '_', '_', 'G3/B3/D4/F4', '_', 'C4/E4/G4', '~', '_', '_', 'C4/E4/G4', '_', '_', '_']
            ])
        },
        bajo: {
            onda: 'triangle',
            volumen: 0.42,
            ataque: 0.006,
            liberacion: 0.06,
            freqCorte: 1200,
            notas: unirCompases([
                ['C2', '_', 'C3', '_', 'G2', '_', 'C3', '_', 'E2', '_', 'G2', '_', 'C3', '_', 'G2', '_'],
                ['G2', '_', 'G3', '_', 'D2', '_', 'G2', '_', 'B2', '_', 'D3', '_', 'G2', '_', 'B2', '_'],
                ['F2', '_', 'F3', '_', 'C2', '_', 'F2', '_', 'C2', '_', 'E2', '_', 'G2', '_', 'C3', '_'],
                ['D2', '_', 'A2', '_', 'G2', '_', 'B2', '_', 'C2', '_', 'G2', '_', 'C3', '_', 'G2', '_'],
                ['A2', '_', 'E3', '_', 'A2', '_', 'C3', '_', 'A2', '_', 'E2', '_', 'A2', '_', 'G2', '_'],
                ['F2', '_', 'C3', '_', 'F2', '_', 'A2', '_', 'C2', '_', 'G2', '_', 'C3', '_', 'E2', '_'],
                ['D2', '_', 'A2', '_', 'D3', '_', 'A2', '_', 'G2', '_', 'D3', '_', 'G2', '_', 'B2', '_'],
                ['G2', '_', 'B2', '_', 'D3', '_', 'G2', '_', 'C2', '_', 'G2', '_', 'C3', '_', 'G2', '_']
            ])
        },
        percusion: [
            'K.H.S.H.K.H.S.HH',
            'K.H.S.H.KHK.S.HO',
            'K.H.S.H.K.H.S.HH',
            'K.H.S.H.K.H.SSTT',
            'K.H.S.H.K.H.S.HH',
            'K.H.S.H.KHK.S.HO',
            'K.H.S.H.K.H.S.HH',
            'K.H.S.T.K.T.SKSO'
        ].join('')
    },

    /**
     * Tema 2: Arena Turbo Karts GP — Bajo galopante incansable estilo Top Gear SNES (150 BPM).
     */
    karts_topgear: {
        id: 'karts_topgear',
        titulo: 'Nitro Autopista GP',
        estilo: 'Top Gear SNES / Velocidad Rock',
        bpm: 150,
        subdivision: 4,
        pasos: 128,
        volumenPercusion: 0.85,
        melodia: {
            onda: 'sawtooth',
            volumen: 0.34,
            ataque: 0.008,
            liberacion: 0.1,
            freqCorte: 2900,
            unison: true,
            vibrato: true,
            slideEntrada: true,
            notas: unirCompases([
                // Sección A (compases 1–4: Am -> F -> G -> E7)
                ['A4', '~', '~', 'B4', 'C5', '~', 'E5', '~', 'A5', '~', '~', 'G5', 'E5', '~', 'C5', '_'],
                ['F5', '~', '~', 'E5', 'D5', '~', 'C5', '~', 'A4', '~', 'C5', '_', 'F5', '~', 'E5', '_'],
                ['G5', '~', '~', 'F5', 'D5', '~', 'B4', '~', 'G4', '~', 'B4', '_', 'D5', '~', 'G5', '_'],
                ['E5', '~', '~', '~', 'F5', 'E5', 'D5', 'C5', 'B4', '~', 'G#4', '~', 'E4', 'G#4', 'B4', 'D5'],
                // Sección B (compases 5–8: Dm -> C -> F -> E7)
                ['D5', '~', 'F5', '_', 'A5', '~', '~', 'G5', 'F5', '~', 'D5', '_', 'A4', 'D5', 'F5', '_'],
                ['E5', '~', 'G5', '_', 'C6', '~', '~', 'B5', 'G5', '~', 'E5', '_', 'C5', 'E5', 'G5', '_'],
                ['A5', '~', '~', 'G5', 'F5', '~', 'E5', 'D5', 'C5', '~', 'D5', 'E5', 'F5', '~', 'A5', '_'],
                ['G#5', '~', 'B5', '~', 'E5', '~', '~', '_', 'E5', 'F#5', 'G#5', 'A5', 'B5', '~', 'G#5', '_']
            ])
        },
        armonia: {
            onda: 'sawtooth',
            volumen: 0.2,
            ataque: 0.01,
            liberacion: 0.08,
            freqCorte: 1950,
            arpegio: false,
            notas: unirCompases([
                ['A3/C4/E4', '~', '_', 'A3/C4/E4', '_', '_', 'A3/C4/E4', '_', 'A3/C4/E4', '~', '_', 'A3/C4/E4', '_', '_', 'A3/C4/E4', '_'],
                ['F3/A3/C4', '~', '_', 'F3/A3/C4', '_', '_', 'F3/A3/C4', '_', 'F3/A3/C4', '~', '_', 'F3/A3/C4', '_', '_', 'F3/A3/C4', '_'],
                ['G3/B3/D4', '~', '_', 'G3/B3/D4', '_', '_', 'G3/B3/D4', '_', 'G3/B3/D4', '~', '_', 'G3/B3/D4', '_', '_', 'G3/B3/D4', '_'],
                ['E3/G#3/B3/D4', '~', '~', '_', '_', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3/D4', '~', '_', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3/D4', '_'],
                ['D4/F4/A4', '~', '_', 'D4/F4/A4', '_', '_', 'D4/F4/A4', '_', 'D4/F4/A4', '~', '_', 'D4/F4/A4', '_', '_', 'D4/F4/A4', '_'],
                ['C4/E4/G4', '~', '_', 'C4/E4/G4', '_', '_', 'C4/E4/G4', '_', 'C4/E4/G4', '~', '_', 'C4/E4/G4', '_', '_', 'C4/E4/G4', '_'],
                ['F3/A3/C4', '~', '_', 'F3/A3/C4', '_', '_', 'F3/A3/C4', '_', 'F3/A3/C4', '_', 'F3/A3/C4', '_', 'F3/A3/C4', '~', '_', '_'],
                ['E3/G#3/B3', '~', 'E3/G#3/B3/D4', '~', '_', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3/D4', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3/D4', '~', '_', '_']
            ])
        },
        bajo: {
            onda: 'sawtooth',
            volumen: 0.36,
            ataque: 0.004,
            liberacion: 0.045,
            freqCorte: 1350,
            notas: unirCompases([
                ['A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'A2', 'A3', 'G2', 'A2'],
                ['F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'E2', 'F2'],
                ['G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'G2', 'G3', 'F2', 'G2'],
                ['E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'G#2', 'B2', 'E3', 'D3', 'B2', 'G#2'],
                ['D2', 'D3', 'D2', 'D3', 'D2', 'D3', 'D2', 'D3', 'D2', 'D3', 'D2', 'D3', 'D2', 'D3', 'C2', 'D2'],
                ['C2', 'C3', 'C2', 'C3', 'C2', 'C3', 'C2', 'C3', 'C2', 'C3', 'C2', 'C3', 'C2', 'C3', 'B2', 'C3'],
                ['F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'F2', 'F3', 'D2', 'F2'],
                ['E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'G#2', 'B2', 'E3', 'B2', 'G#2', 'E2']
            ])
        },
        percusion: [
            'KHHKS.HK.HHKS.HO',
            'KHHKS.HK.HHKS.TT',
            'KHHKS.HK.HHKS.HO',
            'KHKSKSHKTTTTSSOO',
            'KHHKS.HK.HHKS.HO',
            'KHHKS.HK.HHKS.TT',
            'KHHKS.HK.HHKS.HO',
            'KSHKTSHKTTSSKSHO'
        ].join('')
    },

    /**
     * Tema 3: Sala Tetris Arcade — Danza rusa estilo Korobeiniki clásico (144 BPM).
     */
    tetris_ruso: {
        id: 'tetris_ruso',
        titulo: 'Danza de Bloques',
        estilo: 'Korobeiniki Ruso / Tetris Arcade',
        bpm: 144,
        subdivision: 4,
        pasos: 128,
        volumenPercusion: 0.78,
        melodia: {
            onda: 'square',
            volumen: 0.34,
            ataque: 0.006,
            liberacion: 0.07,
            freqCorte: 3300,
            unison: true,
            vibrato: false,
            slideEntrada: false,
            notas: unirCompases([
                // Sección A (compases 1–4: frase clásica Korobeiniki)
                ['E5', '~', 'B4', 'C5', 'D5', '~', 'C5', 'B4', 'A4', '~', 'A4', 'C5', 'E5', '~', 'D5', 'C5'],
                ['B4', '~', '~', 'C5', 'D5', '~', 'E5', '~', 'C5', '~', 'A4', '~', 'A4', '~', '_', '_'],
                ['_', 'D5', '~', 'F5', 'A5', '~', 'G5', 'F5', 'E5', '~', '~', 'C5', 'E5', '~', 'D5', 'C5'],
                ['B4', '~', 'B4', 'C5', 'D5', '~', 'E5', '~', 'C5', '~', 'A4', '~', 'A4', '~', '_', '_'],
                // Sección B (compases 5–8: variación balalaika en crescendo)
                ['E5', '~', 'E5', 'C5', 'D5', '~', 'B4', '~', 'C5', '~', 'A4', '~', 'G#4', '~', 'B4', '~'],
                ['E5', '~', 'C5', '~', 'D5', '~', 'B4', '~', 'C5', 'E5', 'A5', '~', 'G#5', '~', 'E5', '_'],
                ['A5', '~', 'F5', 'D5', 'E5', '~', 'C5', 'A4', 'F5', '~', 'D5', 'B4', 'C5', '~', 'A4', '_'],
                ['B4', '~', 'G#4', 'E4', 'B4', 'D5', 'G#5', 'F5', 'E5', 'C5', 'B4', 'G#4', 'A4', '~', 'E4', '_']
            ])
        },
        armonia: {
            onda: 'triangle',
            volumen: 0.25,
            ataque: 0.006,
            liberacion: 0.075,
            freqCorte: 2900,
            arpegio: true,
            notas: unirCompases([
                ['_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'A3/C4/E4', '_', 'A3/C4/E4', '_', 'A3/C4/E4', '_', 'A3/C4/E4'],
                ['_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'A3/C4/E4', '_', 'A3/C4/E4', 'A3/C4/E4', '~', '_', '_'],
                ['_', 'D4/F4/A4', '_', 'D4/F4/A4', '_', 'D4/F4/A4', '_', 'D4/F4/A4', '_', 'C4/E4/G4', '_', 'C4/E4/G4', '_', 'A3/C4/E4', '_', 'A3/C4/E4'],
                ['_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'A3/C4/E4', '_', 'A3/C4/E4', 'A3/C4/E4', '~', '_', '_'],
                ['A3/C4/E4', '_', 'E4', '_', 'E3/G#3/B3', '_', 'B4', '_', 'A3/C4/E4', '_', 'E4', '_', 'E3/G#3/B3', '_', 'B4', '_'],
                ['A3/C4/E4', '_', 'A4', '_', 'E3/G#3/B3', '_', 'G#4', '_', 'A3/C4/E4', '_', 'E4', '_', 'E3/G#3/B3/D4', '_', 'B3', '_'],
                ['D4/F4/A4', '_', 'D4/F4/A4', '_', 'A3/C4/E4', '_', 'A3/C4/E4', '_', 'D4/F4/A4', '_', 'G3/B3/D4', '_', 'A3/C4/E4', '_', 'A3/C4/E4', '_'],
                ['E3/G#3/B3', '_', 'E3/G#3/B3/D4', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3/D4', '_', 'E3/G#3/B3', '_', 'E3/G#3/B3', '_', 'A3/C4/E4', '~', '_', '_']
            ])
        },
        bajo: {
            onda: 'triangle',
            volumen: 0.44,
            ataque: 0.005,
            liberacion: 0.055,
            freqCorte: 1200,
            notas: unirCompases([
                ['E2', '_', 'E3', '_', 'B2', '_', 'E3', '_', 'A2', '_', 'A3', '_', 'E2', '_', 'A2', '_'],
                ['E2', '_', 'B2', '_', 'G#2', '_', 'E2', '_', 'A2', '_', 'E2', '_', 'A2', '_', 'G2', '_'],
                ['D2', '_', 'D3', '_', 'A2', '_', 'D3', '_', 'C2', '_', 'C3', '_', 'A2', '_', 'C3', '_'],
                ['E2', '_', 'E3', '_', 'G#2', '_', 'E3', '_', 'A2', '_', 'E2', '_', 'A2', '_', 'E2', '_'],
                ['A2', '_', 'E3', '_', 'E2', '_', 'B2', '_', 'A2', '_', 'E3', '_', 'E2', '_', 'B2', '_'],
                ['A2', '_', 'E3', '_', 'E2', '_', 'G#2', '_', 'A2', '_', 'E3', '_', 'E2', '_', 'E3', '_'],
                ['D2', '_', 'A2', '_', 'A2', '_', 'E3', '_', 'D2', '_', 'G2', '_', 'A2', '_', 'E2', '_'],
                ['E2', '_', 'B2', '_', 'E3', '_', 'G#2', '_', 'E2', '_', 'E3', '_', 'A2', '_', 'E2', '_']
            ])
        },
        percusion: [
            'K.H.S.H.K.H.S.HO',
            'K.H.S.H.K.H.SKTT',
            'K.H.S.H.K.H.S.HO',
            'K.H.S.H.K.T.SKSO',
            'KHK.S.H.KHK.S.HO',
            'KHK.S.H.KHK.SKTT',
            'KHK.S.H.KHK.S.HO',
            'K.S.K.T.K.T.SKSO'
        ].join('')
    },

    /**
     * Tema 4: Taller de Bloques — Estilo clásico Barroco/Mozart cámara en Sol Mayor (114 BPM).
     */
    taller_clasico: {
        id: 'taller_clasico',
        titulo: 'Estudio Clásico Voxel',
        estilo: 'Cámara Clásico / Barroco 16-Bit',
        bpm: 114,
        subdivision: 4,
        pasos: 128,
        volumenPercusion: 0.28,
        melodia: {
            onda: 'triangle',
            volumen: 0.34,
            ataque: 0.014,
            liberacion: 0.14,
            freqCorte: 2400,
            unison: false,
            vibrato: true,
            slideEntrada: false,
            notas: unirCompases([
                // Sección A (compases 1–4: G -> D7 -> Em -> Bm/D)
                ['G5', '~', 'D5', '_', 'B4', '~', 'D5', '_', 'G5', 'F#5', 'G5', 'A5', 'B5', '~', 'G5', '_'],
                ['A5', '~', 'F#5', '_', 'D5', '~', 'F#5', '_', 'A5', 'G5', 'F#5', 'E5', 'D5', '~', '_', '_'],
                ['E5', '~', 'G5', '_', 'B5', '~', 'G5', '_', 'F#5', 'E5', 'D#5', 'E5', 'G5', '~', 'E5', '_'],
                ['D5', '~', 'F#5', '_', 'A5', '~', 'F#5', '_', 'G5', 'F#5', 'E5', 'D5', 'B4', '~', '_', '_'],
                // Sección B (compases 5–8: C -> G/B -> Am7/D7 -> G)
                ['C5', '~', 'E5', '_', 'G5', '~', 'C6', '~', 'B5', 'A5', 'G5', 'F#5', 'E5', '~', 'C5', '_'],
                ['D5', '~', 'G5', '_', 'B5', '~', 'D6', '~', 'B5', 'A5', 'G5', 'F#5', 'G5', '~', 'D5', '_'],
                ['E5', 'G5', 'C6', '~', 'A5', '~', 'E5', '_', 'F#5', 'A5', 'D6', '~', 'C6', 'B5', 'A5', '_'],
                ['B5', '~', 'A5', 'G5', 'F#5', '~', 'A5', '_', 'G5', '~', '~', '_', 'D5', '_', 'G4', '_']
            ])
        },
        armonia: {
            onda: 'square',
            volumen: 0.16,
            ataque: 0.012,
            liberacion: 0.12,
            freqCorte: 1150,
            arpegio: true,
            notas: unirCompases([
                ['G3/B3/D4', '_', 'D4', '_', 'B3', '_', 'D4', '_', 'G3/B3/D4', '_', 'D4', '_', 'B3', '_', 'D4', '_'],
                ['D3/F#3/A3/C4', '_', 'A3', '_', 'F#3', '_', 'A3', '_', 'D3/F#3/A3', '_', 'A3', '_', 'F#3', '_', 'A3', '_'],
                ['E3/G3/B3', '_', 'B3', '_', 'G3', '_', 'B3', '_', 'E3/G3/B3', '_', 'B3', '_', 'G3', '_', 'B3', '_'],
                ['B3/D4/F#4', '_', 'F#4', '_', 'D4', '_', 'F#4', '_', 'D3/F#3/A3', '_', 'A3', '_', 'F#3', '_', 'A3', '_'],
                ['C4/E4/G4', '_', 'G4', '_', 'E4', '_', 'G4', '_', 'C4/E4/G4', '_', 'G4', '_', 'E4', '_', 'G4', '_'],
                ['G3/B3/D4', '_', 'D4', '_', 'B3', '_', 'D4', '_', 'G3/B3/D4', '_', 'D4', '_', 'B3', '_', 'D4', '_'],
                ['A3/C4/E4/G4', '_', 'E4', '_', 'C4', '_', 'E4', '_', 'D3/F#3/A3/C4', '_', 'A3', '_', 'F#3', '_', 'A3', '_'],
                ['G3/B3/D4', '_', 'D3/F#3/A3/C4', '_', 'D3/F#3/A3', '_', 'C4', '_', 'G3/B3/D4', '~', '_', '_', 'G3/B3/D4', '_', '_', '_']
            ])
        },
        bajo: {
            onda: 'triangle',
            volumen: 0.34,
            ataque: 0.01,
            liberacion: 0.1,
            freqCorte: 950,
            notas: unirCompases([
                ['G2', '_', 'B2', '_', 'D3', '_', 'B2', '_', 'G2', '_', 'D3', '_', 'B2', '_', 'D3', '_'],
                ['D2', '_', 'A2', '_', 'F#2', '_', 'A2', '_', 'D2', '_', 'F#2', '_', 'A2', '_', 'D3', '_'],
                ['E2', '_', 'B2', '_', 'G2', '_', 'B2', '_', 'E2', '_', 'G2', '_', 'B2', '_', 'E3', '_'],
                ['B2', '_', 'F#3', '_', 'D3', '_', 'B2', '_', 'D2', '_', 'A2', '_', 'D3', '_', 'A2', '_'],
                ['C3', '_', 'G3', '_', 'E3', '_', 'G3', '_', 'C3', '_', 'E3', '_', 'G2', '_', 'C3', '_'],
                ['B2', '_', 'D3', '_', 'G3', '_', 'D3', '_', 'G2', '_', 'B2', '_', 'D3', '_', 'B2', '_'],
                ['A2', '_', 'E3', '_', 'C3', '_', 'A2', '_', 'D2', '_', 'A2', '_', 'F#2', '_', 'D2', '_'],
                ['G2', '_', 'C3', '_', 'D3', '_', 'D2', '_', 'G2', '_', 'D3', '_', 'G2', '_', '_', '_']
            ])
        },
        percusion: [
            'K...H...S...H...',
            'K...H...H...H...',
            'K...H...S...H...',
            'K...H...H...H.H.',
            'K...H...S...H...',
            'K...H...H...H...',
            'K...H...S...H...',
            'K...H...H...H...'
        ].join('')
    }
});
