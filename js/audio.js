/**
 * Motor sintetizador y secuenciador musical 16-bit en Web Audio API pura (Nivel 1 del DAG).
 * Incluye bus de eco espacial estilo SNES SPC700, voces con unison/vibrato/slide de entrada,
 * arpegiador de acordes y batería sintetizada de 5 piezas.
 */
import {
    CATALOGO_PARTITURAS,
    MAPA_MUSICA_EXPERIENCIA,
    notaAFrecuencia
} from './partituras.js';

let contextoAudio = null;
let gainMusicaMaestro = null;
let compresorMusica = null;
let nodoEnvioEco = null;
let nodoDelayEco = null;
let nodoFeedbackEco = null;
let filtroEco = null;
let bufferRuidoBlanco = null;

let partituraActiva = CATALOGO_PARTITURAS.lobby_parque;
let idPistaActiva = 'lobby_parque';
let pasoActual = 0;
let acumuladorTiempo = 0;
let musicaSilenciada = false;

/**
 * Genera una sola vez un buffer reutilizable de ruido blanco para percusión 16-bit.
 * @param {AudioContext} ctx
 * @returns {AudioBuffer}
 */
function obtenerBufferRuido(ctx) {
    if (bufferRuidoBlanco && bufferRuidoBlanco.sampleRate === ctx.sampleRate) {
        return bufferRuidoBlanco;
    }
    const duracionMuestras = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, duracionMuestras, ctx.sampleRate);
    const canal = buffer.getChannelData(0);
    for (let i = 0; i < duracionMuestras; i++) {
        canal[i] = Math.random() * 2 - 1;
    }
    bufferRuidoBlanco = buffer;
    return bufferRuidoBlanco;
}

/**
 * Inicializa o reanuda el AudioContext tras un gesto del usuario y monta el bus de eco SPC700.
 * @returns {boolean} True si el contexto de audio quedó disponible.
 */
export function desbloquearMusica() {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    try {
        if (!contextoAudio) {
            contextoAudio = new AudioCtx();

            compresorMusica = contextoAudio.createDynamicsCompressor();
            compresorMusica.threshold.value = -16;
            compresorMusica.knee.value = 14;
            compresorMusica.ratio.value = 4;
            compresorMusica.attack.value = 0.005;
            compresorMusica.release.value = 0.14;
            compresorMusica.connect(contextoAudio.destination);

            gainMusicaMaestro = contextoAudio.createGain();
            gainMusicaMaestro.gain.value = musicaSilenciada ? 0 : 0.28;
            gainMusicaMaestro.connect(compresorMusica);

            // Bus de eco espacial estilo SNES SPC700 (delay 135ms + feedback 0.24 + lowpass 2200Hz)
            nodoEnvioEco = contextoAudio.createGain();
            nodoEnvioEco.gain.value = 0.22;

            nodoDelayEco = contextoAudio.createDelay(0.5);
            nodoDelayEco.delayTime.value = 0.135;

            filtroEco = contextoAudio.createBiquadFilter();
            filtroEco.type = 'lowpass';
            filtroEco.frequency.value = 2200;

            nodoFeedbackEco = contextoAudio.createGain();
            nodoFeedbackEco.gain.value = 0.24;

            nodoEnvioEco.connect(nodoDelayEco);
            nodoDelayEco.connect(filtroEco);
            filtroEco.connect(gainMusicaMaestro);
            filtroEco.connect(nodoFeedbackEco);
            nodoFeedbackEco.connect(nodoDelayEco);

            obtenerBufferRuido(contextoAudio);
        }

        if (contextoAudio.state === 'suspended') {
            contextoAudio.resume().catch(() => {});
        }
        return true;
    } catch (_err) {
        return false;
    }
}

/**
 * Selecciona y reinicia suavemente la partitura 16-bit correspondiente a una experiencia.
 * @param {string} experienciaId
 * @returns {string} Título legible de la pista seleccionada
 */
export function seleccionarMusicaExperiencia(experienciaId) {
    const idObjetivo = MAPA_MUSICA_EXPERIENCIA[experienciaId] || 'lobby_parque';
    const nueva = CATALOGO_PARTITURAS[idObjetivo] || CATALOGO_PARTITURAS.lobby_parque;
    if (idPistaActiva !== nueva.id) {
        idPistaActiva = nueva.id;
        partituraActiva = nueva;
        pasoActual = 0;
        acumuladorTiempo = 0;
    }
    return nueva.titulo;
}

/**
 * Alterna el silencio de la música ambiental 16-bit sin silenciar los SFX.
 * @returns {boolean} Nuevo estado de silencio
 */
export function alternarSilencioMusica() {
    musicaSilenciada = !musicaSilenciada;
    desbloquearMusica();
    if (gainMusicaMaestro && contextoAudio) {
        gainMusicaMaestro.gain.setTargetAtTime(
            musicaSilenciada ? 0 : 0.28,
            contextoAudio.currentTime,
            0.03
        );
    }
    return musicaSilenciada;
}

/**
 * Indica si la música ambiental 16-bit se encuentra silenciada.
 * @returns {boolean}
 */
export function estaMusicaSilenciada() {
    return musicaSilenciada;
}

/**
 * Dispara una voz tonal 16-bit con filtro pasabajos dinámico, unison opcional, vibrato y slide de entrada.
 * @param {number} frecuencia
 * @param {number} tiempoInicio
 * @param {number} duracion
 * @param {object} configCanal
 * @param {boolean} [enviarEco]
 * @param {number} [factorEscala]
 */
function dispararTono(frecuencia, tiempoInicio, duracion, configCanal, enviarEco = false, factorEscala = 1) {
    if (!contextoAudio || !gainMusicaMaestro || !frecuencia || frecuencia <= 0) return;

    const tiempoFin = tiempoInicio + Math.max(0.04, duracion);
    const volPico = Math.max(0.01, (configCanal.volumen || 0.25) * factorEscala);
    const ataque = Math.min(configCanal.ataque ?? 0.008, duracion * 0.35);
    const liberacion = Math.min(configCanal.liberacion ?? 0.08, duracion * 0.55);
    const tiempoSustain = Math.max(tiempoInicio + ataque + 0.005, tiempoFin - liberacion);

    const filtro = contextoAudio.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 2.4;
    const freqCorte = configCanal.freqCorte || 2400;
    filtro.frequency.setValueAtTime(Math.min(18000, freqCorte * 2.2), tiempoInicio);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(120, freqCorte), Math.min(tiempoFin, tiempoInicio + 0.12));

    const envolvente = contextoAudio.createGain();
    envolvente.gain.setValueAtTime(0.0001, tiempoInicio);
    envolvente.gain.linearRampToValueAtTime(volPico, tiempoInicio + ataque);
    envolvente.gain.setValueAtTime(volPico * 0.82, tiempoSustain);
    envolvente.gain.exponentialRampToValueAtTime(0.0001, tiempoFin + 0.015);

    filtro.connect(envolvente);
    envolvente.connect(gainMusicaMaestro);
    if (enviarEco && nodoEnvioEco) {
        envolvente.connect(nodoEnvioEco);
    }

    const desviosCents = configCanal.unison ? [-9, 9] : [0];
    const gananciaPorOsc = 1 / desviosCents.length;
    const usaVibrato = Boolean(configCanal.vibrato && duracion > 0.22);

    let lfo = null;
    let lfoGain = null;
    if (usaVibrato) {
        lfo = contextoAudio.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(6.0, tiempoInicio);
        lfoGain = contextoAudio.createGain();
        lfoGain.gain.setValueAtTime(11, tiempoInicio);
        lfo.connect(lfoGain);
        lfo.start(tiempoInicio + 0.06);
        lfo.stop(tiempoFin + 0.02);
    }

    for (const detuneCents of desviosCents) {
        const osc = contextoAudio.createOscillator();
        osc.type = configCanal.onda || 'square';

        if (configCanal.slideEntrada) {
            const freqInicial = frecuencia * Math.pow(2, -1 / 12);
            osc.frequency.setValueAtTime(freqInicial, tiempoInicio);
            osc.frequency.exponentialRampToValueAtTime(frecuencia, tiempoInicio + 0.028);
        } else {
            osc.frequency.setValueAtTime(frecuencia, tiempoInicio);
        }

        if (detuneCents !== 0) {
            osc.detune.setValueAtTime(detuneCents, tiempoInicio);
        }
        if (lfoGain) {
            lfoGain.connect(osc.detune);
        }

        if (gananciaPorOsc < 0.99) {
            const gOsc = contextoAudio.createGain();
            gOsc.gain.value = gananciaPorOsc;
            osc.connect(gOsc);
            gOsc.connect(filtro);
        } else {
            osc.connect(filtro);
        }

        osc.start(tiempoInicio);
        osc.stop(tiempoFin + 0.02);
    }
}

/**
 * Sintetizador de batería retro 16-bit de 5 piezas (`K`, `S`, `H`, `O`, `T`).
 * @param {string} tipo
 * @param {number} tiempoInicio
 * @param {number} [escalaVol]
 */
function reproducirPercusion(tipo, tiempoInicio, escalaVol = 1) {
    if (!contextoAudio || !gainMusicaMaestro || !tipo || tipo === '.') return;

    if (tipo === 'K') {
        const osc = contextoAudio.createOscillator();
        const g = contextoAudio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(165, tiempoInicio);
        osc.frequency.exponentialRampToValueAtTime(34, tiempoInicio + 0.11);
        g.gain.setValueAtTime(0.55 * escalaVol, tiempoInicio);
        g.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + 0.13);
        osc.connect(g);
        g.connect(gainMusicaMaestro);
        osc.start(tiempoInicio);
        osc.stop(tiempoInicio + 0.14);
    } else if (tipo === 'S') {
        const cuerpo = contextoAudio.createOscillator();
        const gCuerpo = contextoAudio.createGain();
        cuerpo.type = 'triangle';
        cuerpo.frequency.setValueAtTime(195, tiempoInicio);
        cuerpo.frequency.exponentialRampToValueAtTime(115, tiempoInicio + 0.07);
        gCuerpo.gain.setValueAtTime(0.24 * escalaVol, tiempoInicio);
        gCuerpo.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + 0.09);
        cuerpo.connect(gCuerpo);
        gCuerpo.connect(gainMusicaMaestro);
        cuerpo.start(tiempoInicio);
        cuerpo.stop(tiempoInicio + 0.1);

        const ruido = contextoAudio.createBufferSource();
        ruido.buffer = obtenerBufferRuido(contextoAudio);
        const filtro = contextoAudio.createBiquadFilter();
        filtro.type = 'bandpass';
        filtro.frequency.value = 1800;
        filtro.Q.value = 1.1;
        const gRuido = contextoAudio.createGain();
        gRuido.gain.setValueAtTime(0.32 * escalaVol, tiempoInicio);
        gRuido.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + 0.12);
        ruido.connect(filtro);
        filtro.connect(gRuido);
        gRuido.connect(gainMusicaMaestro);
        ruido.start(tiempoInicio);
        ruido.stop(tiempoInicio + 0.13);
    } else if (tipo === 'H' || tipo === 'O') {
        const dur = tipo === 'O' ? 0.18 : 0.042;
        const ruido = contextoAudio.createBufferSource();
        ruido.buffer = obtenerBufferRuido(contextoAudio);
        const hp = contextoAudio.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 7500;
        const gHat = contextoAudio.createGain();
        gHat.gain.setValueAtTime((tipo === 'O' ? 0.19 : 0.15) * escalaVol, tiempoInicio);
        gHat.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + dur);
        ruido.connect(hp);
        hp.connect(gHat);
        gHat.connect(gainMusicaMaestro);
        ruido.start(tiempoInicio);
        ruido.stop(tiempoInicio + dur + 0.01);
    } else if (tipo === 'T') {
        const osc = contextoAudio.createOscillator();
        const g = contextoAudio.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, tiempoInicio);
        osc.frequency.exponentialRampToValueAtTime(90, tiempoInicio + 0.14);
        g.gain.setValueAtTime(0.32 * escalaVol, tiempoInicio);
        g.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + 0.15);
        osc.connect(g);
        g.connect(gainMusicaMaestro);
        osc.start(tiempoInicio);
        osc.stop(tiempoInicio + 0.16);
    }
}

/**
 * Calcula los pasos sostenidos (`~`) a partir del paso actual sin cruzar el fin del compás final.
 * @param {string[]} notas
 * @param {number} indiceInicio
 * @param {number} totalPasos
 * @returns {number}
 */
function contarPasosSostenidos(notas, indiceInicio, totalPasos) {
    let cuenta = 1;
    for (let i = indiceInicio + 1; i < totalPasos; i++) {
        if (notas[i] !== '~') break;
        cuenta += 1;
    }
    return cuenta;
}

/**
 * Avanza el secuenciador de semicorcheas sincronizado con el bucle principal a 60 FPS.
 * @param {number} dt
 */
export function actualizarMusicaAmbiental(dt) {
    if (!partituraActiva || musicaSilenciada) return;
    if (!contextoAudio || contextoAudio.state !== 'running') return;

    const dtSeguro = Math.min(Math.max(dt || 0, 0), 0.05);
    acumuladorTiempo += dtSeguro;

    const duracionPaso = 60 / partituraActiva.bpm / (partituraActiva.subdivision || 4);
    const totalPasos = partituraActiva.pasos || 128;

    let pasosEnFrame = 0;
    while (acumuladorTiempo >= duracionPaso && pasosEnFrame < 2) {
        acumuladorTiempo -= duracionPaso;
        pasosEnFrame += 1;

        const paso = pasoActual;
        const tiempoBase = contextoAudio.currentTime + 0.015;

        const canales = [
            [partituraActiva.melodia, true],
            [partituraActiva.armonia, true],
            [partituraActiva.bajo, false]
        ];

        for (const [canal, enviarEco] of canales) {
            if (!canal || !Array.isArray(canal.notas)) continue;
            const token = canal.notas[paso];
            if (!token || token === '_' || token === '~') continue;

            const pasosSostenidos = contarPasosSostenidos(canal.notas, paso, totalPasos);
            const duracionTotal = Math.max(0.045, pasosSostenidos * duracionPaso - 0.012);
            const voces = token.split('/');
            const escalaVoces = 1 / Math.sqrt(voces.length);

            voces.forEach((notaIndividual, idxVoz) => {
                const freq = notaAFrecuencia(notaIndividual);
                if (!freq) return;
                const desfaseArp = canal.arpegio && voces.length > 1 ? idxVoz * 0.014 : 0;
                const durNota = Math.max(0.04, duracionTotal - desfaseArp);
                dispararTono(freq, tiempoBase + desfaseArp, durNota, canal, enviarEco, escalaVoces);
            });
        }

        if (partituraActiva.percusion) {
            const golpe = partituraActiva.percusion[paso];
            if (golpe && golpe !== '.') {
                reproducirPercusion(golpe, tiempoBase, partituraActiva.volumenPercusion ?? 0.75);
            }
        }

        pasoActual = (paso + 1) % totalPasos;
    }
}
