/**
 * Gestión del HUD compacto, Menú Radial Dona, Estudio de Avatar 3D en vivo,
 * Gestos Sociales, Chat Rápido, Inventario, Hotbar Voxel, Red y Móvil.
 */
import {
    CATALOGO_BLOQUES,
    CATALOGO_ITEMS,
    CATALOGO_KARTS,
    CATALOGO_PIEZAS_KART,
    PALETA_AVATAR,
    RAREZAS
} from './constantes.js';
import {
    aplicarDatosPerfil,
    cargarPerfilesLocales,
    estadoControles,
    estadoJugador,
    estadoRed,
    estadoSandbox,
    exportarCodigoPerfil,
    guardarEstadoLocal,
    importarCodigoPerfil,
    obtenerXpParaSiguienteNivel,
    restablecerPerfilNuevo,
    suscribirEstado
} from './estado.js';
import { alternarSilencioAudio, reproducirSonido } from './recursos.js';
import {
    alternarSilencioMusica,
    desbloquearMusica,
    estaMusicaSilenciada,
    seleccionarMusicaExperiencia
} from './audio.js';
import {
    actualizarAparienciaAvatar,
    actualizarEtiquetaAvatar,
    mostrarBurbujaChatAvatar,
    sincronizarAccesoriosAvatar
} from './avatar.js';
import { activarGestoLocal } from './fisicaSandbox.js';
import { RegistroExperiencias } from './nucleoSandbox.js';
import {
    conectarSalaMultijugador,
    crearPerfilServidor,
    desconectarSalaMultijugador,
    enviarAccionSocial,
    enviarEstadoJugadorInmediato,
    listarPerfilesServidor
} from './red.js';

let contextoGlobal = null;
let resumenHudPrevio = '';
let timerNotificacion = null;
let tabMenuUnificadoActiva = 'sala';
let pointerJoystickActivo = null;
let filtroMochilaActivo = 'todos';
let limpiarDasTetrisActivo = null;

/**
 * Cancela cualquier repetición automática (DAS/ARR) activa del D-Pad de Tetris.
 */
function detenerRepeticionTetris() {
    if (typeof limpiarDasTetrisActivo === 'function') {
        const fn = limpiarDasTetrisActivo;
        limpiarDasTetrisActivo = null;
        fn();
    }
}

/**
 * Obtiene un elemento del DOM por ID.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function el(id) {
    return document.getElementById(id);
}

/**
 * Muestra a lo sumo 1 notificación emergente breve en el centro superior,
 * reemplazando cualquier aviso anterior para no apilar tarjetas ni tapar el HUD.
 * @param {string} mensaje
 * @param {'info'|'exito'|'alerta'} [tipo]
 */
export function mostrarNotificacion(mensaje, tipo = 'info') {
    const contenedor = el('contenedor-notificaciones');
    if (!contenedor || !mensaje) return;

    if (timerNotificacion) {
        clearTimeout(timerNotificacion);
        timerNotificacion = null;
    }
    contenedor.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `notificacion notificacion-${tipo}`;
    toast.textContent = mensaje;
    contenedor.appendChild(toast);

    timerNotificacion = setTimeout(() => {
        timerNotificacion = null;
        toast.classList.add('saliendo');
        setTimeout(() => toast.remove(), 220);
    }, 2400);
}

/**
 * Cierra paneles secundarios y restaura la cámara si la pestaña Avatar 3D estaba activa.
 */
function cerrarPanelesFlotantes() {
    el('menu-principal-unificado')?.classList.add('oculto');
    el('menu-principal-unificado')?.classList.remove('modo-dock-avatar');
    el('panel-gestos')?.classList.add('oculto');
    el('panel-chat-rapido')?.classList.add('oculto');
    el('popover-bloques')?.classList.add('oculto');
    el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
    el('btn-hud-menu')?.classList.remove('activo');
    el('btn-hud-chat')?.classList.remove('activo');
    el('btn-hud-gestos')?.classList.remove('activo');
    alternarGarajeKart(false);
    estadoControles.modoPreviewAvatar = false;
    sincronizarVisibilidadControlesMoviles();
}

/**
 * Oculta `#controles-moviles` en Tetris fullscreen, Podio F1, Menú Unificado o Bienvenida.
 */
function sincronizarVisibilidadControlesMoviles() {
    const tetrisActivo = Boolean(estadoControles.modoTetrisActivo && estadoJugador.experienciaActiva === 'tetris');
    const podioActivo = Boolean(estadoControles.modoCeremoniaPodio && estadoJugador.experienciaActiva === 'karts');
    const menuEl = el('menu-principal-unificado');
    const menuAbierto = Boolean(menuEl && !menuEl.classList.contains('oculto'));
    const bienvenidaActiva = Boolean(estadoControles.pantallaBienvenidaActiva);
    el('controles-moviles')?.classList.toggle('oculto', tetrisActivo || podioActivo || menuAbierto || bienvenidaActiva);
}

/**
 * Actualiza récords personales visibles dentro de la pestaña Jugador.
 */
function renderizarResumenJugador() {
    const recKart = el('jugador-record-kart');
    const recTetris = el('jugador-record-tetris');
    if (recKart) recKart.textContent = formatearTiempoCarrera(estadoJugador.mejorVueltaKart);
    if (recTetris) recTetris.textContent = String(estadoJugador.mejorPuntajeTetris || 0);
}

/**
 * Cambia la pestaña activa dentro de `#menu-principal-unificado` y ajusta el dock lateral de Avatar 3D.
 * @param {'sala'|'avatar'|'mochila'|'jugador'} tabId
 */
function cambiarTabMenuUnificado(tabId = 'sala') {
    const validas = ['sala', 'avatar', 'mochila', 'jugador'];
    const destino = validas.includes(tabId) ? tabId : 'sala';
    tabMenuUnificadoActiva = destino;

    const menu = el('menu-principal-unificado');
    const esAvatar = destino === 'avatar';
    menu?.classList.toggle('modo-dock-avatar', esAvatar);
    estadoControles.modoPreviewAvatar = Boolean(menu && !menu.classList.contains('oculto') && esAvatar);

    for (const id of validas) {
        const activo = id === destino;
        const btnTab = el(`tab-menu-${id}`);
        const panelTab = el(`panel-menu-${id}`);
        btnTab?.classList.toggle('activo', activo);
        btnTab?.setAttribute('aria-selected', String(activo));
        panelTab?.classList.toggle('oculto', !activo);
    }

    if (esAvatar) {
        estadoControles.anguloPreviewAvatar = estadoJugador.rotacion;
        renderizarEstudioAvatar();
    } else if (destino === 'mochila') {
        renderizarInventario();
    } else if (destino === 'jugador') {
        renderizarResumenJugador();
    }
    sincronizarVisibilidadControlesMoviles();
}

/**
 * Abre `#menu-principal-unificado` en la pestaña solicitada o lo alterna si ya está visible.
 * @param {'sala'|'avatar'|'mochila'|'jugador'} [tabId]
 */
function alternarMenuUnificado(tabId = tabMenuUnificadoActiva) {
    const menu = el('menu-principal-unificado');
    if (!menu) return;
    const estabaOculto = menu.classList.contains('oculto');
    if (estabaOculto) {
        cerrarPanelesFlotantes();
        estadoControles.joystick.x = 0;
        estadoControles.joystick.y = 0;
        estadoControles.joystick.magnitud = 0;
        estadoControles.joystick.activo = false;
        estadoControles.autoSprintJoystick = false;
        menu.classList.remove('oculto');
        el('btn-hud-menu')?.classList.add('activo');
        cambiarTabMenuUnificado(tabId);
    } else {
        cerrarPanelesFlotantes();
    }
    sincronizarVisibilidadControlesMoviles();
    reproducirSonido('interaccion');
}

/**
 * Abre o cierra el panel lateral del Garaje Kart y sincroniza la cámara de vista previa.
 * @param {boolean} [abrir] Si se omite, alterna el estado actual.
 */
function alternarGarajeKart(abrir) {
    const pop = el('popover-kart');
    const btn = el('btn-toggle-kart');
    if (!pop) {
        estadoControles.garajeKartAbierto = false;
        return;
    }
    const debeAbrir = typeof abrir === 'boolean' ? abrir : pop.classList.contains('oculto');
    pop.classList.toggle('oculto', !debeAbrir);
    estadoControles.garajeKartAbierto = debeAbrir;
    btn?.setAttribute('aria-expanded', String(debeAbrir));
    if (debeAbrir) {
        renderizarGarajeKart();
    }
}

/**
 * Aplica cambios de apariencia/accesorios al avatar local, persiste y sincroniza en red.
 */
function aplicarCambioApariencia() {
    actualizarAparienciaAvatar(
        contextoGlobal?.avatarLocal,
        estadoJugador.apariencia,
        estadoJugador.equipado
    );
    guardarEstadoLocal();
    enviarEstadoJugadorInmediato();
}

/**
 * Dispara un gesto social local y lo retransmite a la sala multijugador.
 * @param {'saludar'|'bailar'|'celebrar'|'sentarse'} gesto
 */
function dispararGestoSocial(gesto) {
    activarGestoLocal(gesto);
    enviarAccionSocial('gesto', gesto);
    reproducirSonido('interaccion');
}

/**
 * Muestra burbuja de chat 3D local y retransmite el mensaje rápido a la sala.
 * @param {string} texto
 */
function enviarChatRapido(texto) {
    const limpio = String(texto || '').trim().slice(0, 34);
    if (!limpio) return;
    mostrarBurbujaChatAvatar(contextoGlobal?.avatarLocal, limpio);
    enviarAccionSocial('chat', limpio);
    reproducirSonido('interaccion');
}

/**
 * Ejecuta la interacción contextual sobre la entidad cercana (`KeyE` / botón móvil).
 */
function ejecutarInteraccion() {
    const entidad = estadoControles.entidadCercana;
    const exp = estadoSandbox.experienciaActual;
    if (entidad && exp && typeof exp.alInteractuar === 'function') {
        exp.alInteractuar(estadoJugador, entidad);
        actualizarHUD();
    }
}

/**
 * Renderiza el catálogo escalable de inventario y tienda con filtros por categoría y losetas compactas.
 */
function renderizarInventario() {
    const lista = el('lista-inventario');
    const contador = el('contador-mochila');
    if (contador) {
        contador.textContent = `${estadoJugador.inventario.length} / ${CATALOGO_ITEMS.length}`;
    }
    if (!lista) return;
    lista.innerHTML = '';

    const iconosSlot = { cabeza: '🎩', espalda: '🎒', aura: '✨' };
    const filtrados = CATALOGO_ITEMS.filter((item) => {
        if (filtroMochilaActivo === 'todos') return true;
        if (filtroMochilaActivo === 'equipados') return estadoJugador.equipado[item.slot] === item.id;
        return item.slot === filtroMochilaActivo;
    });

    if (filtrados.length === 0) {
        const vacio = document.createElement('div');
        vacio.className = 'mochila-vacia';
        vacio.textContent = 'No hay artículos en esta categoría.';
        lista.appendChild(vacio);
        return;
    }

    for (const item of filtrados) {
        const rareza = RAREZAS[item.rareza] || RAREZAS.COMUN;
        const enInventario = estadoJugador.inventario.includes(item.id);
        const estaEquipado = estadoJugador.equipado[item.slot] === item.id;

        const tarjeta = document.createElement('div');
        tarjeta.className = `tarjeta-item ${estaEquipado ? 'item-equipado' : ''}`;
        tarjeta.style.borderTopColor = rareza.color;

        const cabecera = document.createElement('div');
        cabecera.className = 'tarjeta-item-cabecera';

        const badge = document.createElement('span');
        badge.className = 'badge-rareza';
        badge.style.backgroundColor = rareza.color;
        badge.textContent = rareza.nombre;

        const slotTag = document.createElement('span');
        slotTag.className = 'slot-item';
        slotTag.textContent = iconosSlot[item.slot] || '🧩';
        slotTag.title = item.slot.toUpperCase();

        cabecera.append(badge, slotTag);

        const titulo = document.createElement('h4');
        titulo.textContent = item.nombre;
        titulo.title = item.nombre;

        const desc = document.createElement('div');
        desc.className = 'item-subtitulo';
        desc.textContent = item.descripcion;
        desc.title = item.descripcion;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-item-accion';

        if (!enInventario) {
            btn.textContent = `Comprar (${item.precio} 🪙)`;
            btn.disabled = estadoJugador.monedas < item.precio;
            btn.addEventListener('click', () => {
                if (estadoJugador.monedas < item.precio) {
                    mostrarNotificacion('Monedas insuficientes.', 'alerta');
                    return;
                }
                estadoJugador.monedas -= item.precio;
                estadoJugador.inventario.push(item.id);
                estadoJugador.equipado[item.slot] = item.id;
                sincronizarAccesoriosAvatar(contextoGlobal?.avatarLocal, estadoJugador.equipado);
                guardarEstadoLocal();
                enviarEstadoJugadorInmediato();
                reproducirSonido('moneda');
                mostrarNotificacion(`Comprado y equipado: ${item.nombre}`, 'exito');
                renderizarInventario();
                actualizarHUD();
            });
        } else if (estaEquipado) {
            btn.textContent = '✓ Equipado';
            btn.classList.add('btn-item-equipado');
            btn.addEventListener('click', () => {
                estadoJugador.equipado[item.slot] = null;
                sincronizarAccesoriosAvatar(contextoGlobal?.avatarLocal, estadoJugador.equipado);
                guardarEstadoLocal();
                enviarEstadoJugadorInmediato();
                reproducirSonido('interaccion');
                renderizarInventario();
            });
        } else {
            btn.textContent = 'Equipar';
            btn.addEventListener('click', () => {
                estadoJugador.equipado[item.slot] = item.id;
                sincronizarAccesoriosAvatar(contextoGlobal?.avatarLocal, estadoJugador.equipado);
                guardarEstadoLocal();
                enviarEstadoJugadorInmediato();
                reproducirSonido('interaccion');
                renderizarInventario();
            });
        }

        tarjeta.append(cabecera, titulo, desc, btn);
        lista.appendChild(tarjeta);
    }
}

/**
 * Renderiza el Estudio de Avatar (paletas de color, rostros y accesorios propios).
 */
function renderizarEstudioAvatar() {
    const gruposColor = [
        { id: 'selector-piel', clave: 'piel', colores: PALETA_AVATAR.piel },
        { id: 'selector-torso', clave: 'torso', colores: PALETA_AVATAR.torso },
        { id: 'selector-piernas', clave: 'piernas', colores: PALETA_AVATAR.piernas }
    ];

    for (const grupo of gruposColor) {
        const cont = el(grupo.id);
        if (!cont) continue;
        cont.innerHTML = '';

        for (const hex of grupo.colores) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `muestra-color ${estadoJugador.apariencia[grupo.clave] === hex ? 'activo' : ''}`;
            btn.style.backgroundColor = hex;
            btn.title = hex;
            btn.addEventListener('click', () => {
                estadoJugador.apariencia[grupo.clave] = hex;
                aplicarCambioApariencia();
                reproducirSonido('interaccion');
                renderizarEstudioAvatar();
            });
            cont.appendChild(btn);
        }
    }

    const contRostro = el('selector-rostro');
    if (contRostro) {
        contRostro.innerHTML = '';
        const etiquetasRostro = {
            feliz: '😊 Feliz',
            epico: '⚡ Épico',
            lentes: '🕶️ Lentes',
            robot: '🤖 Robot'
        };
        for (const estilo of PALETA_AVATAR.rostros) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `chip-opcion ${estadoJugador.apariencia.rostro === estilo ? 'activo' : ''}`;
            btn.textContent = etiquetasRostro[estilo] || estilo;
            btn.addEventListener('click', () => {
                estadoJugador.apariencia.rostro = estilo;
                aplicarCambioApariencia();
                reproducirSonido('interaccion');
                renderizarEstudioAvatar();
            });
            contRostro.appendChild(btn);
        }
    }

    const contAcc = el('selector-accesorios-avatar');
    if (contAcc) {
        contAcc.innerHTML = '';
        for (const itemId of estadoJugador.inventario) {
            const item = CATALOGO_ITEMS.find((entry) => entry.id === itemId);
            if (!item) continue;
            const equipado = estadoJugador.equipado[item.slot] === item.id;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `chip-opcion ${equipado ? 'activo' : ''}`;
            btn.textContent = `${equipado ? '✓ ' : ''}${item.nombre}`;
            btn.addEventListener('click', () => {
                estadoJugador.equipado[item.slot] = equipado ? null : item.id;
                aplicarCambioApariencia();
                reproducirSonido('interaccion');
                renderizarEstudioAvatar();
            });
            contAcc.appendChild(btn);
        }
    }
}

/**
 * Renderiza la barra inferior de bloques voxel (1-8) y su botón de modo.
 */
function renderizarHotbarBloques() {
    const lista = el('lista-bloques-hotbar');
    if (!lista) return;
    lista.innerHTML = '';

    CATALOGO_BLOQUES.forEach((bloque, idx) => {
        const activo = estadoControles.bloqueSeleccionado === bloque.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `slot-bloque ${activo ? 'activo' : ''}`;
        btn.title = `Tecla ${idx + 1}: ${bloque.nombre}`;

        const muestra = document.createElement('span');
        muestra.className = 'color-bloque-muestra';
        muestra.style.backgroundColor = bloque.color;
        if (bloque.transparente) muestra.style.opacity = '0.65';
        if (bloque.emisivo) muestra.style.boxShadow = `0 0 8px ${bloque.color}`;

        const texto = document.createElement('span');
        texto.textContent = `${idx + 1}. ${bloque.nombre}`;

        btn.append(muestra, texto);
        btn.addEventListener('click', () => {
            estadoControles.bloqueSeleccionado = bloque.id;
            reproducirSonido('interaccion');
            renderizarHotbarBloques();
            el('popover-bloques')?.classList.add('oculto');
            el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
        });
        lista.appendChild(btn);
    });

    const bloqueActivo = CATALOGO_BLOQUES.find((b) => b.id === estadoControles.bloqueSeleccionado) || CATALOGO_BLOQUES[0];
    const romper = estadoControles.modoConstruccion === 'romper';

    const muestraActiva = el('muestra-bloque-activo');
    if (muestraActiva && bloqueActivo) {
        muestraActiva.style.backgroundColor = bloqueActivo.color;
        muestraActiva.style.opacity = bloqueActivo.transparente ? '0.65' : '1';
    }

    const textoToggle = el('texto-btn-bloques');
    if (textoToggle && bloqueActivo) {
        textoToggle.textContent = romper
            ? '⛏️ Romper'
            : `🧱 ${bloqueActivo.nombre}`;
    }

    const btnModo = el('btn-modo-construccion');
    if (btnModo) {
        btnModo.textContent = romper ? '⛏️ Romper' : '🧱 Colocar';
        btnModo.classList.toggle('modo-romper', romper);
    }
}

/**
 * Formatea segundos como `MM:SS.d`.
 * @param {number|null} seg
 * @returns {string}
 */
function formatearTiempoCarrera(seg) {
    if (typeof seg !== 'number' || !Number.isFinite(seg) || seg < 0) {
        return '--:--.-';
    }
    const min = Math.floor(seg / 60);
    const resto = (seg % 60).toFixed(1).padStart(4, '0');
    return `${String(min).padStart(2, '0')}:${resto}`;
}

/**
 * Renderiza el personalizador colapsable del Garaje Kart con barras VEL/ACEL/CTRL y 3 carruseles con flechas.
 */
function renderizarGarajeKart() {
    const exp = estadoSandbox.experienciaActual;
    const chasis = CATALOGO_KARTS.find((k) => k.id === estadoJugador.configKart.chasis) || CATALOGO_KARTS[0];
    const rueda =
        CATALOGO_PIEZAS_KART.ruedas.find((r) => r.id === estadoJugador.configKart.ruedas) ||
        CATALOGO_PIEZAS_KART.ruedas[0];
    const aleron =
        CATALOGO_PIEZAS_KART.alerones.find((a) => a.id === estadoJugador.configKart.aleron) ||
        CATALOGO_PIEZAS_KART.alerones[1];

    const deltaFallback = {
        velocidad: rueda.modStats.velocidad + aleron.modStats.velocidad,
        aceleracion: rueda.modStats.aceleracion + aleron.modStats.aceleracion,
        control: rueda.modStats.control + aleron.modStats.control
    };

    const stats = typeof exp?.obtenerStatsKart === 'function'
        ? exp.obtenerStatsKart(estadoJugador.configKart)
        : {
              velocidad: Math.max(15, chasis.velocidad + deltaFallback.velocidad),
              aceleracion: Math.max(15, chasis.aceleracion + deltaFallback.aceleracion),
              control: Math.max(15, chasis.control + deltaFallback.control),
              delta: deltaFallback
          };
    const delta = stats.delta || deltaFallback;

    const aplicarStat = (idBarra, idValor, valor, deltaVal) => {
        const barra = el(idBarra);
        if (barra) barra.style.width = `${Math.min(100, Math.round((valor / 65) * 100))}%`;
        const valEl = el(idValor);
        if (valEl) {
            valEl.textContent = String(valor);
            if (typeof deltaVal === 'number' && deltaVal !== 0) {
                const badgeDelta = document.createElement('span');
                badgeDelta.className = `stat-delta ${deltaVal > 0 ? 'positivo' : 'negativo'}`;
                badgeDelta.textContent = ` (${deltaVal > 0 ? '+' : ''}${deltaVal})`;
                valEl.appendChild(badgeDelta);
            }
        }
    };
    aplicarStat('barra-stat-vel', 'valor-stat-vel', stats.velocidad, delta.velocidad);
    aplicarStat('barra-stat-acel', 'valor-stat-acel', stats.aceleracion, delta.aceleracion);
    aplicarStat('barra-stat-ctrl', 'valor-stat-ctrl', stats.control, delta.control);

    const actualizarConfig = () => {
        exp?.actualizarKartJugador?.();
        renderizarGarajeKart();
        reproducirSonido('interaccion');
    };

    const poblarCarrusel = (idCont, lista, clave) => {
        const cont = el(idCont);
        if (!cont || !Array.isArray(lista) || lista.length === 0) return;
        cont.innerHTML = '';

        const idxActual = Math.max(
            0,
            lista.findIndex((item) => item.id === estadoJugador.configKart[clave])
        );
        const itemActual = lista[idxActual];

        const btnPrev = document.createElement('button');
        btnPrev.type = 'button';
        btnPrev.className = 'btn-carrusel-flecha';
        btnPrev.textContent = '◀';
        btnPrev.setAttribute('aria-label', `Anterior ${clave}`);
        btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            const nuevoIdx = (idxActual - 1 + lista.length) % lista.length;
            estadoJugador.configKart[clave] = lista[nuevoIdx].id;
            actualizarConfig();
        });

        const etiquetaValor = document.createElement('span');
        etiquetaValor.className = 'carrusel-valor';
        etiquetaValor.textContent = itemActual.nombre;
        etiquetaValor.title = itemActual.nombre;

        const btnNext = document.createElement('button');
        btnNext.type = 'button';
        btnNext.className = 'btn-carrusel-flecha';
        btnNext.textContent = '▶';
        btnNext.setAttribute('aria-label', `Siguiente ${clave}`);
        btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            const nuevoIdx = (idxActual + 1) % lista.length;
            estadoJugador.configKart[clave] = lista[nuevoIdx].id;
            actualizarConfig();
        });

        cont.append(btnPrev, etiquetaValor, btnNext);
    };

    poblarCarrusel('selector-kart-chasis', CATALOGO_KARTS, 'chasis');
    poblarCarrusel('selector-kart-ruedas', CATALOGO_PIEZAS_KART.ruedas, 'ruedas');
    poblarCarrusel('selector-kart-aleron', CATALOGO_PIEZAS_KART.alerones, 'aleron');

    const contColor = el('selector-kart-color');
    if (contColor) {
        contColor.innerHTML = '';
        for (const hex of CATALOGO_PIEZAS_KART.colores) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `muestra-color ${estadoJugador.configKart.color === hex ? 'activo' : ''}`;
            btn.style.backgroundColor = hex;
            btn.title = hex;
            btn.addEventListener('click', () => {
                estadoJugador.configKart.color = hex;
                actualizarConfig();
            });
            contColor.appendChild(btn);
        }
    }
}

/**
 * Actualiza el banner broadcast TV F1 en la parte inferior durante la Ceremonia de Podio.
 * @param {boolean} esKarts
 */
function renderizarBannerPodioF1(esKarts) {
    const banner = el('banner-podio-f1');
    if (!banner) return;

    const info = esKarts ? estadoSandbox.experienciaActual?.obtenerEstadoPodioF1?.() : null;
    if (!info?.activo) {
        banner.classList.add('oculto');
        return;
    }

    banner.classList.remove('oculto');
    const timerEl = el('podio-f1-temporizador');
    if (timerEl) timerEl.textContent = `${info.segundosRestantes}s`;

    const listaEl = el('podio-f1-lista');
    if (listaEl) {
        listaEl.innerHTML = '';
        const medallas = ['1.º', '2.º', '3.º'];
        (info.top3 || []).slice(0, 3).forEach((finisher, idx) => {
            const chip = document.createElement('div');
            chip.className = `podio-f1-puesto p${idx + 1}`;

            const posSpan = document.createElement('strong');
            posSpan.textContent = medallas[idx] || `${idx + 1}.º`;

            const nomSpan = document.createElement('span');
            nomSpan.textContent = finisher.apodo || 'Piloto';

            const tSpan = document.createElement('span');
            tSpan.className = 'podio-f1-tiempo';
            tSpan.textContent = formatearTiempoCarrera(finisher.tiempo);

            chip.append(posSpan, nomSpan, tSpan);
            listaEl.appendChild(chip);
        });
    }

    const vueltaEl = el('podio-f1-vuelta-rapida');
    if (vueltaEl) {
        const vr = info.vueltaRapida;
        vueltaEl.textContent = vr?.apodo && typeof vr?.tiempo === 'number'
            ? `⚡ Vuelta Rápida: ${formatearTiempoCarrera(vr.tiempo)} — ${vr.apodo}`
            : '⚡ Vuelta Rápida: --:--.-';
    }
}

/**
 * Sincroniza los textos e indicadores del HUD con el estado reactivo actual.
 */
export function actualizarHUD() {
    const metaXp = obtenerXpParaSiguienteNivel(estadoJugador.nivel);
    const pctXp = Math.min(100, Math.round((estadoJugador.xp / metaXp) * 100));
    const nombreExp = estadoSandbox.experienciaActual?.nombre || estadoJugador.experienciaActiva;
    const totalJugadores = estadoRed.conectado ? estadoRed.jugadoresRemotos.size + 1 : 1;
    const textoEntidad = estadoControles.entidadCercana
        ? `[E] ${estadoControles.entidadCercana.etiqueta || 'Interactuar'}`
        : '';
    const esConstruccion = estadoJugador.experienciaActiva === 'construccion';
    const esKarts = estadoJugador.experienciaActiva === 'karts';
    const ec = esKarts ? estadoSandbox.experienciaActual?.estadoCarrera : null;
    const tablaKarts = esKarts ? estadoSandbox.experienciaActual?.tablaTiempos : null;
    const segsPodio = esKarts ? Math.ceil(estadoSandbox.experienciaActual?.tiempoCeremoniaPodio || 0) : 0;
    const enParrilla = Boolean(esKarts && estadoSandbox.experienciaActual?.enParrillaActiva);
    const firmaKarts = ec
        ? `${ec.velocidadKmH}|${ec.vueltaActual || 1}/${ec.totalVueltas || 2}|${ec.checkpointActual}|${ec.tiempoVuelta.toFixed(1)}|${estadoJugador.mejorVueltaKart}|${ec.bannerMensaje}|${Math.ceil(ec.cuentaRegresiva || 0)}|${ec.enZonaSalida}|${enParrilla}|${tablaKarts?.size || 0}|${estadoControles.modoCeremoniaPodio}|${segsPodio}`
        : '';

    const firmaActual = [
        estadoJugador.apodo,
        estadoJugador.nivel,
        pctXp,
        estadoJugador.monedas,
        nombreExp,
        estadoJugador.experienciaActiva,
        estadoRed.modo,
        estadoRed.codigoSala,
        totalJugadores,
        textoEntidad,
        firmaKarts,
        estadoControles.modoTetrisActivo,
        estadoControles.asientoTetrisActual,
        estadoControles.pantallaBienvenidaActiva,
        estadoJugador.mejorPuntajeTetris
    ].join('|');

    if (firmaActual === resumenHudPrevio) return;
    resumenHudPrevio = firmaActual;

    const hudApodo = el('hud-apodo');
    const hudNivel = el('hud-nivel');
    const hudXpBarra = el('hud-xp-barra');
    const hudMonedas = el('hud-monedas');
    const hudExperiencia = el('hud-experiencia');
    const indicadorRed = el('indicador-estado-red');
    const contadorJugadores = el('contador-jugadores');
    const avisoInteraccion = el('aviso-interaccion');
    const btnToggleBloques = el('btn-toggle-bloques');
    const popoverBloques = el('popover-bloques');
    const hudKarts = el('hud-karts');
    const btnToggleKart = el('btn-toggle-kart');
    const bannerKarts = el('banner-conteo-kart');
    const textoConteoKart = el('texto-conteo-kart');
    const btnCancelarSalida = el('btn-cancelar-salida');
    void el('hotbar-bloques');

    if (hudApodo) hudApodo.textContent = estadoJugador.apodo;
    if (hudNivel) hudNivel.textContent = `Nv. ${estadoJugador.nivel}`;
    if (hudXpBarra) hudXpBarra.style.width = `${pctXp}%`;
    if (hudMonedas) hudMonedas.textContent = String(estadoJugador.monedas);
    if (hudExperiencia) hudExperiencia.textContent = nombreExp;
    renderizarResumenJugador();

    if (indicadorRed) {
        if (estadoRed.conectado) {
            indicadorRed.textContent = `En línea (${estadoRed.codigoSala})`;
            indicadorRed.className = 'estado-red online';
        } else if (estadoRed.modo === 'conectando') {
            indicadorRed.textContent = 'Conectando...';
            indicadorRed.className = 'estado-red conectando';
        } else {
            indicadorRed.textContent = 'Offline (Local)';
            indicadorRed.className = 'estado-red offline';
        }
    }

    if (contadorJugadores) {
        contadorJugadores.textContent = `${totalJugadores} ${totalJugadores === 1 ? 'jugador' : 'jugadores'}`;
    }

    const ocultarAviso = Boolean(
        estadoControles.modoTetrisActivo ||
        estadoControles.modoCeremoniaPodio ||
        estadoControles.modoPreviewAvatar ||
        estadoControles.pantallaBienvenidaActiva
    );
    if (avisoInteraccion) {
        if (textoEntidad && !ocultarAviso) {
            avisoInteraccion.textContent = textoEntidad;
            avisoInteraccion.classList.remove('oculto');
        } else {
            avisoInteraccion.classList.add('oculto');
        }
    }

    if (btnToggleBloques) {
        btnToggleBloques.classList.toggle('oculto', !esConstruccion);
        if (esConstruccion) {
            renderizarHotbarBloques();
        } else {
            popoverBloques?.classList.add('oculto');
            btnToggleBloques.setAttribute('aria-expanded', 'false');
        }
    }

    if (hudKarts && btnToggleKart) {
        hudKarts.classList.toggle('oculto', !esKarts || estadoControles.modoCeremoniaPodio);
        btnToggleKart.classList.toggle('oculto', !esKarts || estadoControles.modoCeremoniaPodio);
        if (estadoControles.modoCeremoniaPodio) {
            alternarGarajeKart(false);
        }
        if (esKarts && ec) {
            const velEl = el('kart-velocidad');
            const cpEl = el('kart-checkpoints');
            const tEl = el('kart-tiempo-actual');
            const mEl = el('kart-mejor-vuelta');
            const rankEl = el('lista-ranking-karts');

            if (velEl) velEl.textContent = `${ec.velocidadKmH} KM/H`;
            if (cpEl) cpEl.textContent = `Vuelta ${ec.vueltaActual || 1}/${ec.totalVueltas || 2} · CP: ${ec.checkpointActual}/5`;
            if (tEl) tEl.textContent = formatearTiempoCarrera(ec.tiempoVuelta);
            if (mEl) mEl.textContent = `Mejor: ${formatearTiempoCarrera(estadoJugador.mejorVueltaKart)}`;

            if (bannerKarts) {
                const mostrarConteo = Boolean(!estadoControles.modoCeremoniaPodio && ec.bannerMensaje);
                if (mostrarConteo) {
                    if (textoConteoKart) {
                        textoConteoKart.textContent = ec.bannerMensaje;
                    } else {
                        bannerKarts.textContent = ec.bannerMensaje;
                    }
                    bannerKarts.classList.remove('oculto');
                } else {
                    bannerKarts.classList.add('oculto');
                }
            }
            if (btnCancelarSalida) {
                const puedeAbortar = Boolean(
                    !estadoControles.modoCeremoniaPodio &&
                    ec.cuentaRegresiva > 0 &&
                    (ec.enZonaSalida || enParrilla)
                );
                btnCancelarSalida.classList.toggle('oculto', !puedeAbortar);
            }

            if (rankEl && tablaKarts) {
                const top = Array.from(tablaKarts.entries())
                    .sort((a, b) => a[1] - b[1])
                    .slice(0, 4);
                rankEl.innerHTML = top.length > 0
                    ? `<strong>🏆 Mejores Vueltas</strong>` +
                      top.map(([nom, t], idx) => `<div>${idx + 1}. ${nom}: ${t.toFixed(2)}s</div>`).join('')
                    : `<strong>🏁 Parrilla de Salida</strong><div>Entra a la zona azul (10s · 2 vueltas)</div>`;
            }
        } else {
            alternarGarajeKart(false);
            bannerKarts?.classList.add('oculto');
            btnCancelarSalida?.classList.add('oculto');
        }
    }

    renderizarBannerPodioF1(esKarts);
    renderizarOverlayTetris();
    sincronizarVisibilidadControlesMoviles();
}

/**
 * Sincroniza el overlay 100% pantalla completa de `SalaTetris` y oculta menús laterales durante la partida.
 */
function renderizarOverlayTetris() {
    const pantallaTetris = el('pantalla-tetris-fullscreen');
    const activo = Boolean(estadoControles.modoTetrisActivo && estadoJugador.experienciaActiva === 'tetris');
    if (pantallaTetris) {
        pantallaTetris.classList.toggle('oculto', !activo);
    }
    el('hud-superior')?.classList.toggle('oculto', activo);
    if (activo) {
        el('aviso-interaccion')?.classList.add('oculto');
    } else {
        detenerRepeticionTetris();
    }
    sincronizarVisibilidadControlesMoviles();
    if (!activo) return;

    const info = estadoSandbox.experienciaActual?.obtenerEstadoHUDTetris?.();
    if (!info) return;
    if (info.gameOver) {
        detenerRepeticionTetris();
    }

    const elPts = el('tetris-puntaje');
    const elNiv = el('tetris-nivel');
    const elLin = el('tetris-lineas');
    const elRec = el('tetris-mejor-puntaje');
    const elButaca = el('tetris-butaca-actual');
    const elOver = el('overlay-tetris-gameover');
    const elRank = el('lista-ranking-tetris');

    if (elPts) elPts.textContent = String(info.puntaje);
    if (elNiv) elNiv.textContent = String(info.nivel);
    if (elLin) elLin.textContent = String(info.lineas);
    if (elRec) elRec.textContent = String(Math.max(estadoJugador.mejorPuntajeTetris || 0, info.puntaje));
    if (elButaca) elButaca.textContent = `Butaca ${info.asiento || 1}`;
    if (elOver) elOver.classList.toggle('oculto', !info.gameOver);

    if (elRank) {
        elRank.innerHTML = info.ranking.length
            ? info.ranking
                  .map(([apodo, pts], idx) => `<div class="tetris-ranking-fila"><span>${idx + 1}. ${apodo}</span><strong>${pts}</strong></div>`)
                  .join('')
            : '<div class="tetris-ranking-fila"><span>Sin puntajes aún</span><strong>0</strong></div>';
    }
}

/**
 * Configura controles de teclado, ratón (órbita / preview) y botones táctiles.
 */
function vincularControlesEntrada() {
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            if (e.code === 'Escape') e.target.blur();
            return;
        }
        if (estadoControles.pantallaBienvenidaActiva) return;

        if (estadoControles.modoTetrisActivo && estadoJugador.experienciaActiva === 'tetris') {
            const expTetris = estadoSandbox.experienciaActual;
            const mapaTeclasTetris = {
                ArrowLeft: 'izquierda',
                KeyA: 'izquierda',
                ArrowRight: 'derecha',
                KeyD: 'derecha',
                ArrowUp: 'rotar',
                KeyW: 'rotar',
                KeyX: 'rotar',
                ArrowDown: 'bajar',
                KeyS: 'bajar',
                Space: 'caida_rapida',
                KeyC: 'hold',
                ShiftLeft: 'hold',
                ShiftRight: 'hold',
                KeyR: 'reiniciar'
            };
            if (e.code === 'Escape') {
                e.preventDefault();
                expTetris?.levantarseAsientoTetris?.();
                return;
            }
            const accionTetris = mapaTeclasTetris[e.code];
            if (accionTetris) {
                e.preventDefault();
                expTetris?.manejarAccionTetris?.(accionTetris);
                return;
            }
        }

        if (e.code === 'Tab') {
            e.preventDefault();
            alternarMenuUnificado();
            return;
        }

        estadoControles.teclas.add(e.code);

        if (e.code === 'KeyE') {
            ejecutarInteraccion();
        } else if (e.code === 'KeyF') {
            dispararGestoSocial('saludar');
        } else if (e.code === 'KeyM') {
            const silenciada = alternarSilencioMusica();
            const btnMusica = el('btn-musica');
            if (btnMusica) {
                btnMusica.textContent = silenciada ? '🔇' : '🎵';
                btnMusica.classList.toggle('btn-musica-silenciada', silenciada);
            }
            mostrarNotificacion(silenciada ? 'Música 16-bit silenciada' : '🎵 Música 16-bit activa', 'info');
        } else if (e.code === 'KeyB' && estadoJugador.experienciaActiva === 'construccion') {
            const pop = el('popover-bloques');
            const oculto = pop?.classList.toggle('oculto');
            el('btn-toggle-bloques')?.setAttribute('aria-expanded', String(!oculto));
            reproducirSonido('interaccion');
        } else if (e.code === 'KeyG' && estadoJugador.experienciaActiva === 'karts') {
            alternarGarajeKart();
            reproducirSonido('interaccion');
        } else if (e.code === 'Escape') {
            const hayAbierto =
                !el('menu-principal-unificado')?.classList.contains('oculto') ||
                !el('panel-gestos')?.classList.contains('oculto') ||
                !el('panel-chat-rapido')?.classList.contains('oculto') ||
                !el('popover-bloques')?.classList.contains('oculto') ||
                estadoControles.garajeKartAbierto;
            if (hayAbierto) {
                cerrarPanelesFlotantes();
            } else {
                alternarMenuUnificado();
            }
        } else if (
            estadoJugador.experienciaActiva === 'construccion' &&
            /^Digit[1-8]$/.test(e.code)
        ) {
            const idx = Number(e.code.replace('Digit', '')) - 1;
            if (CATALOGO_BLOQUES[idx]) {
                estadoControles.bloqueSeleccionado = CATALOGO_BLOQUES[idx].id;
                reproducirSonido('interaccion');
                renderizarHotbarBloques();
                el('popover-bloques')?.classList.add('oculto');
                el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        estadoControles.teclas.delete(e.code);
    });

    window.addEventListener('blur', () => {
        estadoControles.teclas.clear();
        estadoControles.saltarPresionado = false;
    });

    // Órbita de cámara o rotación en vivo del avatar al arrastrar sobre el lienzo 3D
    // Soporta touch simultáneo en la mitad derecha (55%) mientras el pulgar izquierdo usa el joystick dinámico
    const lienzo = el('lienzo-3d');
    if (lienzo) {
        let pointerCamara = null;
        let prevX = 0;
        let prevY = 0;

        lienzo.addEventListener('pointerdown', (e) => {
            if (e.pointerId === pointerJoystickActivo) return;
            if (
                e.pointerType === 'touch' &&
                !estadoControles.modoPreviewAvatar &&
                e.clientX < window.innerWidth * 0.45
            ) {
                return;
            }
            el('popover-bloques')?.classList.add('oculto');
            el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
            alternarGarajeKart(false);
            if (pointerCamara !== null) return;
            pointerCamara = e.pointerId;
            prevX = e.clientX;
            prevY = e.clientY;
            if (!estadoControles.modoPreviewAvatar) {
                estadoControles.orbitaManualActiva = true;
                estadoControles.tiempoOrbitaManual = 2.0;
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (e.pointerId !== pointerCamara) return;
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;
            prevX = e.clientX;
            prevY = e.clientY;

            if (estadoControles.modoPreviewAvatar) {
                estadoControles.anguloPreviewAvatar -= dx * 0.01;
            } else {
                estadoControles.orbitaManualActiva = true;
                estadoControles.tiempoOrbitaManual = 2.0;
                estadoControles.anguloCamaraY -= dx * 0.006;
                estadoControles.anguloCamaraPitch = Math.max(
                    0.08,
                    Math.min(1.15, estadoControles.anguloCamaraPitch + dy * 0.004)
                );
            }
        });

        const soltarCamara = (e) => {
            if (e.pointerId === pointerCamara) {
                pointerCamara = null;
                estadoControles.orbitaManualActiva = false;
            }
        };
        window.addEventListener('pointerup', soltarCamara);
        window.addEventListener('pointercancel', soltarCamara);
    }

    // Joystick flotante dinámico estilo Genshin / Fortnite en el 45% izquierdo (zona muerta 12%, auto-sprint > 85%)
    const zonaJoystick = el('zona-joystick-dinamico');
    const baseJoystick = el('base-joystick-dinamico');
    const palanca = el('palanca-joystick');
    if (zonaJoystick && baseJoystick && palanca) {
        const radioMax = 48;
        const zonaMuerta = 0.12;
        const umbralAutoSprint = 0.85;
        let anclaX = 0;
        let anclaY = 0;

        const actualizarJoystick = (clientX, clientY) => {
            let dx = clientX - anclaX;
            let dy = clientY - anclaY;
            const dist = Math.hypot(dx, dy);
            if (dist > radioMax) {
                dx = (dx / dist) * radioMax;
                dy = (dy / dist) * radioMax;
            }

            palanca.style.transform = `translate(${dx}px, ${dy}px)`;
            const norm = Math.min(1, dist / radioMax);
            if (norm <= zonaMuerta || dist === 0) {
                estadoControles.joystick.x = 0;
                estadoControles.joystick.y = 0;
                estadoControles.joystick.magnitud = 0;
                estadoControles.joystick.activo = false;
                estadoControles.autoSprintJoystick = false;
                baseJoystick.classList.remove('auto-sprint');
                return;
            }

            const mag = (norm - zonaMuerta) / (1 - zonaMuerta);
            estadoControles.joystick.x = (dx / dist) * mag;
            estadoControles.joystick.y = (-dy / dist) * mag;
            estadoControles.joystick.magnitud = mag;
            estadoControles.joystick.activo = true;
            estadoControles.autoSprintJoystick = norm > umbralAutoSprint;
            baseJoystick.classList.toggle('auto-sprint', estadoControles.autoSprintJoystick);
        };

        zonaJoystick.addEventListener('pointerdown', (e) => {
            if (pointerJoystickActivo !== null) return;
            e.preventDefault();
            e.stopPropagation();
            pointerJoystickActivo = e.pointerId;

            const rectZona = zonaJoystick.getBoundingClientRect();
            const radioBase = 54;
            const localX = Math.max(radioBase + 4, Math.min(rectZona.width - radioBase - 4, e.clientX - rectZona.left));
            const localY = Math.max(radioBase + 4, Math.min(rectZona.height - radioBase - 4, e.clientY - rectZona.top));

            anclaX = rectZona.left + localX;
            anclaY = rectZona.top + localY;
            baseJoystick.style.left = `${localX - radioBase}px`;
            baseJoystick.style.top = `${localY - radioBase}px`;
            baseJoystick.style.bottom = 'auto';
            baseJoystick.classList.add('activo');
            actualizarJoystick(e.clientX, e.clientY);
        });

        window.addEventListener('pointermove', (e) => {
            if (e.pointerId === pointerJoystickActivo) {
                actualizarJoystick(e.clientX, e.clientY);
            }
        });

        const resetJoystick = (e) => {
            if (e.pointerId !== pointerJoystickActivo) return;
            pointerJoystickActivo = null;
            palanca.style.transform = 'translate(0px, 0px)';
            baseJoystick.classList.remove('activo', 'auto-sprint');
            baseJoystick.style.left = '';
            baseJoystick.style.top = '';
            baseJoystick.style.bottom = '';
            estadoControles.joystick.x = 0;
            estadoControles.joystick.y = 0;
            estadoControles.joystick.magnitud = 0;
            estadoControles.joystick.activo = false;
            estadoControles.autoSprintJoystick = false;
        };
        window.addEventListener('pointerup', resetJoystick);
        window.addEventListener('pointercancel', resetJoystick);
    }

    // Botones móviles en arco ergonómico del pulgar derecho
    const btnSaltar = el('btn-movil-saltar');
    if (btnSaltar) {
        btnSaltar.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (estadoJugador.enVehiculo) {
                estadoControles.acelerarKart = true;
            } else {
                estadoControles.saltarPresionado = true;
            }
        });
        const finSalto = () => {
            estadoControles.saltarPresionado = false;
            estadoControles.acelerarKart = false;
        };
        btnSaltar.addEventListener('pointerup', finSalto);
        btnSaltar.addEventListener('pointercancel', finSalto);
    }

    const btnAccion = el('btn-movil-accion');
    if (btnAccion) {
        btnAccion.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (estadoJugador.enVehiculo) {
                estadoControles.frenarKart = true;
            } else {
                ejecutarInteraccion();
            }
        });
        const finAccion = () => {
            estadoControles.frenarKart = false;
        };
        btnAccion.addEventListener('pointerup', finAccion);
        btnAccion.addEventListener('pointercancel', finAccion);
    }

    const btnSprint = el('btn-movil-sprint');
    if (btnSprint) {
        btnSprint.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });
        btnSprint.addEventListener('click', () => {
            if (estadoJugador.enVehiculo) {
                estadoControles.derraparKart = !estadoControles.derraparKart;
                btnSprint.classList.toggle('activo', estadoControles.derraparKart);
            } else {
                estadoControles.sprintActivo = !estadoControles.sprintActivo;
                btnSprint.classList.toggle('activo', estadoControles.sprintActivo);
            }
        });
    }
}

/**
 * Vincula la barra HUD estilo Roblox, el Menú Principal Unificado (4 pestañas) y subpaneles sociales.
 * @param {Function} reabrirBienvenida
 */
function vincularMenuRobloxYSocial(reabrirBienvenida) {
    const menuUnificado = el('menu-principal-unificado');

    el('btn-hud-menu')?.addEventListener('click', () => {
        alternarMenuUnificado();
    });

    el('btn-cerrar-menu-unificado')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        reproducirSonido('interaccion');
    });

    menuUnificado?.addEventListener('click', (e) => {
        if (e.target === menuUnificado && !menuUnificado.classList.contains('modo-dock-avatar')) {
            cerrarPanelesFlotantes();
        }
    });

    el('tab-menu-sala')?.addEventListener('click', () => cambiarTabMenuUnificado('sala'));
    el('tab-menu-avatar')?.addEventListener('click', () => cambiarTabMenuUnificado('avatar'));
    el('tab-menu-mochila')?.addEventListener('click', () => cambiarTabMenuUnificado('mochila'));
    el('tab-menu-jugador')?.addEventListener('click', () => cambiarTabMenuUnificado('jugador'));

    const contFiltrosMochila = el('filtros-mochila');
    if (contFiltrosMochila) {
        for (const btnFiltro of contFiltrosMochila.querySelectorAll('[data-filtro-mochila]')) {
            btnFiltro.addEventListener('click', () => {
                filtroMochilaActivo = btnFiltro.getAttribute('data-filtro-mochila') || 'todos';
                for (const b of contFiltrosMochila.querySelectorAll('[data-filtro-mochila]')) {
                    b.classList.toggle('activo', b === btnFiltro);
                }
                reproducirSonido('interaccion');
                renderizarInventario();
            });
        }
    }

    el('btn-hud-gestos')?.addEventListener('click', () => {
        const panelGestos = el('panel-gestos');
        const estabaOculto = panelGestos?.classList.contains('oculto');
        cerrarPanelesFlotantes();
        if (estabaOculto) {
            panelGestos.classList.remove('oculto');
            el('btn-hud-gestos')?.classList.add('activo');
        }
        reproducirSonido('interaccion');
    });

    el('btn-hud-chat')?.addEventListener('click', () => {
        const panelChat = el('panel-chat-rapido');
        const estabaOculto = panelChat?.classList.contains('oculto');
        cerrarPanelesFlotantes();
        if (estabaOculto) {
            panelChat.classList.remove('oculto');
            el('btn-hud-chat')?.classList.add('activo');
            setTimeout(() => el('input-chat-rapido')?.focus(), 40);
        }
        reproducirSonido('interaccion');
    });

    el('btn-cerrar-gestos')?.addEventListener('click', () => {
        el('panel-gestos')?.classList.add('oculto');
        el('btn-hud-gestos')?.classList.remove('activo');
    });

    el('btn-cerrar-chat')?.addEventListener('click', () => {
        el('panel-chat-rapido')?.classList.add('oculto');
        el('btn-hud-chat')?.classList.remove('activo');
    });

    el('btn-cambiar-jugador')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        desconectarSalaMultijugador(contextoGlobal?.escena);
        reabrirBienvenida();
    });

    // Emotes
    el('btn-gesto-saludar')?.addEventListener('click', () => {
        dispararGestoSocial('saludar');
        cerrarPanelesFlotantes();
    });
    el('btn-gesto-bailar')?.addEventListener('click', () => {
        dispararGestoSocial('bailar');
        cerrarPanelesFlotantes();
    });
    el('btn-gesto-celebrar')?.addEventListener('click', () => {
        dispararGestoSocial('celebrar');
        cerrarPanelesFlotantes();
    });
    el('btn-gesto-sentarse')?.addEventListener('click', () => {
        dispararGestoSocial('sentarse');
        cerrarPanelesFlotantes();
    });

    // Chat rápido
    for (const btn of document.querySelectorAll('.btn-frase-chat')) {
        btn.addEventListener('click', () => {
            const frase = btn.getAttribute('data-frase') || btn.textContent;
            enviarChatRapido(frase);
            cerrarPanelesFlotantes();
        });
    }

    const inputChat = el('input-chat-rapido');
    el('btn-enviar-chat')?.addEventListener('click', () => {
        if (!inputChat) return;
        enviarChatRapido(inputChat.value);
        inputChat.value = '';
        cerrarPanelesFlotantes();
    });
    inputChat?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            enviarChatRapido(inputChat.value);
            inputChat.value = '';
            cerrarPanelesFlotantes();
        }
    });

    // Teletransporte rápido entre experiencias
    el('btn-warp-lobby')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        RegistroExperiencias.cambiarExperiencia('lobby', contextoGlobal);
    });
    el('btn-warp-construccion')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        RegistroExperiencias.cambiarExperiencia('construccion', contextoGlobal);
    });
    el('btn-warp-karts')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        RegistroExperiencias.cambiarExperiencia('karts', contextoGlobal);
    });
    el('btn-warp-tetris')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        RegistroExperiencias.cambiarExperiencia('tetris', contextoGlobal);
    });
}

/**
 * Detecta si el navegador se ejecuta en un dispositivo móvil o táctil.
 * @returns {boolean}
 */
function esDispositivoMovilTactil() {
    if (typeof window === 'undefined') return false;
    const punteroGrueso = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const puntosTactiles = (navigator.maxTouchPoints || 0) > 0;
    return punteroGrueso || puntosTactiles;
}

/**
 * Solicita modo pantalla completa con respaldo WebKit y manejo seguro de errores (iOS Safari).
 */
function solicitarPantallaCompletaSeguro() {
    try {
        const raiz = document.documentElement;
        if (raiz) {
            const metodo = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
            if (typeof metodo === 'function') {
                const promesa = metodo.call(raiz);
                if (promesa && typeof promesa.catch === 'function') {
                    promesa.catch(() => {});
                }
            }
        }
    } catch (_err) {
        // Ignorar en navegadores sin soporte Fullscreen API (e.g., iOS Safari estándar)
    }
    try {
        window.screen?.orientation?.lock?.('landscape')?.catch?.(() => {});
    } catch (_err) {
        // Ignorar en navegadores sin bloqueo programático de orientación
    }
}

/**
 * Alterna entre pantalla completa y vista normal desde `#btn-pantalla-completa`.
 */
function alternarPantallaCompleta() {
    try {
        const activo = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        if (activo) {
            const salir = document.exitFullscreen || document.webkitExitFullscreen;
            if (typeof salir === 'function') {
                const promesa = salir.call(document);
                if (promesa && typeof promesa.catch === 'function') {
                    promesa.catch(() => {});
                }
            }
        } else {
            solicitarPantallaCompletaSeguro();
        }
    } catch (_err) {
        // Ignorar errores de API de pantalla completa
    }
}

/**
 * Inicializa la puerta de entrada `#pantalla-bienvenida` (perfiles únicos + Sala Pública).
 * @returns {Function} Función para reabrir y recargar la pantalla de bienvenida si ocurre rechazo de sala
 */
function inicializarPantallaBienvenida() {
    const pantalla = el('pantalla-bienvenida');
    const tabExistente = el('tab-perfil-existente');
    const tabNuevo = el('tab-perfil-nuevo');
    const panelExistente = el('panel-perfil-existente');
    const panelNuevo = el('panel-perfil-nuevo');
    const estadoCarga = el('estado-carga-perfiles');
    const btnRecargar = el('btn-recargar-perfiles');
    const listaPerfiles = el('lista-perfiles-existentes');
    const btnEntrar = el('btn-entrar-parque');
    const inputNuevo = el('input-nuevo-apodo');
    const btnCrear = el('btn-crear-jugador');
    const cajaError = el('mensaje-error-bienvenida');

    if (!pantalla) {
        estadoControles.pantallaBienvenidaActiva = false;
        return () => {};
    }

    let perfilSeleccionado = null;
    let cargandoPerfiles = false;

    const mostrarError = (texto) => {
        if (!cajaError) return;
        if (!texto) {
            cajaError.textContent = '';
            cajaError.classList.add('oculto');
        } else {
            cajaError.textContent = texto;
            cajaError.classList.remove('oculto');
        }
    };

    const cambiarTab = (modo) => {
        const esExistente = modo === 'existente';
        tabExistente?.classList.toggle('activo', esExistente);
        tabExistente?.setAttribute('aria-selected', String(esExistente));
        tabNuevo?.classList.toggle('activo', !esExistente);
        tabNuevo?.setAttribute('aria-selected', String(!esExistente));
        panelExistente?.classList.toggle('oculto', !esExistente);
        panelNuevo?.classList.toggle('oculto', esExistente);
        mostrarError('');
        if (!esExistente) {
            setTimeout(() => inputNuevo?.focus(), 40);
        }
    };

    const entrarAlParque = () => {
        if (contextoGlobal?.avatarLocal) {
            actualizarAparienciaAvatar(
                contextoGlobal.avatarLocal,
                estadoJugador.apariencia,
                estadoJugador.equipado
            );
            sincronizarAccesoriosAvatar(contextoGlobal.avatarLocal, estadoJugador.equipado);
            actualizarEtiquetaAvatar(
                contextoGlobal.avatarLocal,
                estadoJugador.apodo,
                estadoJugador.nivel
            );
        }

        const inputApodo = el('input-apodo');
        const inputSala = el('input-codigo-sala');
        if (inputApodo) inputApodo.value = estadoJugador.apodo;
        if (inputSala) inputSala.value = 'SALA-PUBLICA';

        guardarEstadoLocal();
        estadoControles.pantallaBienvenidaActiva = false;
        pantalla.classList.add('oculto');
        sincronizarVisibilidadControlesMoviles();
        mostrarError('');
        const tituloMusica = seleccionarMusicaExperiencia(estadoJugador.experienciaActiva || 'lobby');
        const textoEntrada = !estaMusicaSilenciada()
            ? `Sala Pública · 🎵 ${tituloMusica}`
            : 'Conectando a Sala Pública...';
        mostrarNotificacion(textoEntrada, 'info');
        conectarSalaMultijugador('SALA-PUBLICA');
        actualizarHUD();
    };

    const renderizarListaPerfiles = (perfiles, desdeServidor) => {
        if (!listaPerfiles) return;
        listaPerfiles.innerHTML = '';
        perfilSeleccionado = null;
        if (btnEntrar) btnEntrar.disabled = true;

        if (!perfiles || perfiles.length === 0) {
            const vacio = document.createElement('div');
            vacio.className = 'sin-perfiles-aviso';
            vacio.textContent = desdeServidor
                ? 'Aún no hay jugadores registrados en el servidor. ¡Crea tu jugador único en la pestaña siguiente!'
                : 'No se encontraron perfiles guardados localmente. Crea un nuevo jugador.';
            listaPerfiles.appendChild(vacio);
            return;
        }

        const apodoPrevio = (estadoJugador.apodo || '').trim().toLowerCase();
        let botonPreseleccionado = null;

        for (const perfil of perfiles) {
            const tarjeta = document.createElement('button');
            tarjeta.type = 'button';
            tarjeta.className = 'tarjeta-perfil';
            tarjeta.disabled = Boolean(perfil.enLinea);

            const infoIzq = document.createElement('div');
            infoIzq.className = 'perfil-info-izq';

            const swatch = document.createElement('span');
            swatch.className = 'perfil-avatar-swatch';
            swatch.style.background = `linear-gradient(135deg, ${perfil.apariencia?.torso || '#2563eb'}, ${perfil.apariencia?.piernas || '#1e293b'})`;

            const meta = document.createElement('div');
            meta.className = 'perfil-meta';
            const nom = document.createElement('strong');
            nom.textContent = perfil.apodo;
            const det = document.createElement('span');
            det.textContent = `Nv. ${perfil.nivel || 1} · 🪙 ${perfil.monedas ?? 50}`;
            meta.append(nom, det);

            infoIzq.append(swatch, meta);

            const badge = document.createElement('span');
            badge.className = `badge-perfil-estado ${perfil.enLinea ? 'badge-en-linea' : 'badge-disponible'}`;
            badge.textContent = perfil.enLinea ? 'En línea' : 'Disponible';

            tarjeta.append(infoIzq, badge);

            tarjeta.addEventListener('click', () => {
                if (perfil.enLinea) {
                    mostrarError('Este jugador ya se encuentra conectado en la sala.');
                    return;
                }
                mostrarError('');
                for (const hija of listaPerfiles.querySelectorAll('.tarjeta-perfil')) {
                    hija.classList.remove('seleccionado');
                }
                tarjeta.classList.add('seleccionado');
                perfilSeleccionado = perfil;
                if (btnEntrar) btnEntrar.disabled = false;
            });

            listaPerfiles.appendChild(tarjeta);

            if (!perfil.enLinea && !botonPreseleccionado && perfil.apodo?.trim().toLowerCase() === apodoPrevio) {
                botonPreseleccionado = { tarjeta, perfil };
            }
        }

        if (botonPreseleccionado) {
            botonPreseleccionado.tarjeta.classList.add('seleccionado');
            perfilSeleccionado = botonPreseleccionado.perfil;
            if (btnEntrar) btnEntrar.disabled = false;
        }
    };

    const cargarPerfiles = async () => {
        if (cargandoPerfiles) return;
        cargandoPerfiles = true;
        if (btnRecargar) btnRecargar.disabled = true;
        if (estadoCarga) {
            estadoCarga.innerHTML = '<span class="spinner-carga" aria-hidden="true"></span><span>Consultando jugadores (puede tardar unos segundos si el servidor despierta)...</span>';
        }

        const resp = await listarPerfilesServidor();
        cargandoPerfiles = false;
        if (btnRecargar) btnRecargar.disabled = false;

        if (resp.ok) {
            if (estadoCarga) {
                estadoCarga.textContent = `${resp.perfiles.length} jugador(es) registrado(s) en el servidor`;
            }
            renderizarListaPerfiles(resp.perfiles, true);
            if (resp.perfiles.length === 0) {
                cambiarTab('nuevo');
            }
        } else {
            const locales = cargarPerfilesLocales();
            if (estadoCarga) {
                estadoCarga.textContent = 'Servidor sin respuesta; usando perfiles guardados en este dispositivo.';
            }
            renderizarListaPerfiles(locales, false);
            if (locales.length === 0) {
                cambiarTab('nuevo');
            }
        }
    };

    tabExistente?.addEventListener('click', () => cambiarTab('existente'));
    tabNuevo?.addEventListener('click', () => cambiarTab('nuevo'));
    btnRecargar?.addEventListener('click', () => {
        mostrarError('');
        cargarPerfiles();
    });

    btnEntrar?.addEventListener('click', () => {
        if (!perfilSeleccionado) {
            mostrarError('Selecciona un jugador disponible para entrar.');
            return;
        }
        desbloquearMusica();
        if (esDispositivoMovilTactil()) {
            solicitarPantallaCompletaSeguro();
        }
        try {
            restablecerPerfilNuevo(perfilSeleccionado.apodo);
            aplicarDatosPerfil(perfilSeleccionado);
        } catch (_err) {
            mostrarError('No se pudo cargar el perfil seleccionado.');
            return;
        }
        entrarAlParque();
    });

    const confirmarNuevoJugador = async () => {
        const apodo = (inputNuevo?.value || '').trim().replace(/\s+/g, ' ').slice(0, 18);
        if (apodo.length < 2) {
            mostrarError('Escribe un nombre de entre 2 y 18 caracteres.');
            return;
        }
        mostrarError('');

        desbloquearMusica();
        if (esDispositivoMovilTactil()) {
            solicitarPantallaCompletaSeguro();
        }

        if (btnCrear) {
            btnCrear.disabled = true;
            btnCrear.textContent = 'Registrando jugador...';
        }

        const resp = await crearPerfilServidor(apodo);

        if (btnCrear) {
            btnCrear.disabled = false;
            btnCrear.textContent = 'Crear y Entrar al Parque';
        }

        if (resp.duplicado) {
            mostrarError(resp.error || 'Ese nombre ya existe. Elige otro o selecciona tu jugador.');
            return;
        }

        if (!resp.ok && !resp.offline) {
            mostrarError(resp.error || 'No se pudo crear el jugador.');
            return;
        }

        if (resp.offline) {
            const locales = cargarPerfilesLocales();
            const existeLocal = locales.some(
                (p) => (p.apodo || '').trim().toLowerCase() === apodo.toLowerCase()
            );
            if (existeLocal) {
                mostrarError('Ese nombre ya existe en este dispositivo. Selecciónalo en la pestaña anterior.');
                return;
            }
            restablecerPerfilNuevo(apodo);
            entrarAlParque();
            return;
        }

        restablecerPerfilNuevo(resp.perfil.apodo);
        aplicarDatosPerfil(resp.perfil);
        entrarAlParque();
    };

    btnCrear?.addEventListener('click', confirmarNuevoJugador);
    inputNuevo?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmarNuevoJugador();
        }
    });
    inputNuevo?.addEventListener('input', () => mostrarError(''));

    estadoControles.pantallaBienvenidaActiva = true;
    pantalla.classList.remove('oculto');
    cargarPerfiles();

    return (mensajeError = '') => {
        estadoControles.pantallaBienvenidaActiva = true;
        pantalla.classList.remove('oculto');
        sincronizarVisibilidadControlesMoviles();
        cambiarTab('existente');
        if (mensajeError) mostrarError(mensajeError);
        cargarPerfiles();
    };
}

/**
 * Inicializa toda la interfaz de usuario y la enlaza con el núcleo del Sandbox.
 * @param {object} contextoSandbox
 */
export function inicializarInterfaz(contextoSandbox) {
    contextoGlobal = contextoSandbox;

    const inputApodo = el('input-apodo');
    const inputSala = el('input-codigo-sala');
    if (inputApodo) inputApodo.value = estadoJugador.apodo;
    if (inputSala && !inputSala.value) inputSala.value = 'SALA-PUBLICA';

    void el('hud-superior');
    void el('controles-moviles');

    const btnPantallaCompleta = el('btn-pantalla-completa');
    if (btnPantallaCompleta) {
        btnPantallaCompleta.addEventListener('click', alternarPantallaCompleta);
        const actualizarIconoFullscreen = () => {
            const enFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
            btnPantallaCompleta.textContent = enFull ? '🗗' : '⛶';
            btnPantallaCompleta.title = enFull ? 'Salir de Pantalla Completa' : 'Pantalla Completa';
        };
        document.addEventListener('fullscreenchange', actualizarIconoFullscreen);
        document.addEventListener('webkitfullscreenchange', actualizarIconoFullscreen);
    }

    const reabrirBienvenida = inicializarPantallaBienvenida();

    el('btn-cerrar-girar-pantalla')?.addEventListener('click', () => {
        el('aviso-girar-pantalla')?.classList.add('descartado');
    });

    el('btn-exportar-perfil')?.addEventListener('click', () => {
        const codigo = exportarCodigoPerfil();
        const inputCodigo = el('input-codigo-perfil');
        if (inputCodigo) {
            inputCodigo.value = codigo;
            inputCodigo.select();
        }
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(codigo).catch(() => {});
        }
        mostrarNotificacion('Código de perfil exportado.', 'exito');
    });

    el('btn-importar-perfil')?.addEventListener('click', () => {
        const inputCodigo = el('input-codigo-perfil');
        const codigo = inputCodigo?.value || '';
        if (!importarCodigoPerfil(codigo)) {
            mostrarNotificacion('Código Base64 inválido.', 'alerta');
            return;
        }
        if (inputApodo) inputApodo.value = estadoJugador.apodo;
        renderizarEstudioAvatar();
        renderizarInventario();
        mostrarNotificacion('Perfil e inventario restaurados.', 'exito');
    });

    // Popover colapsable de construcción voxel
    el('btn-toggle-bloques')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const pop = el('popover-bloques');
        if (!pop) return;
        const oculto = pop.classList.toggle('oculto');
        el('btn-toggle-bloques')?.setAttribute('aria-expanded', String(!oculto));
        reproducirSonido('interaccion');
    });

    document.addEventListener('pointerdown', (e) => {
        const pop = el('popover-bloques');
        const toggleBtn = el('btn-toggle-bloques');
        if (!pop || pop.classList.contains('oculto')) return;
        if (!pop.contains(e.target) && !toggleBtn?.contains(e.target)) {
            pop.classList.add('oculto');
            toggleBtn?.setAttribute('aria-expanded', 'false');
        }
    });

    el('btn-modo-construccion')?.addEventListener('click', () => {
        estadoControles.modoConstruccion =
            estadoControles.modoConstruccion === 'colocar' ? 'romper' : 'colocar';
        reproducirSonido('interaccion');
        renderizarHotbarBloques();
    });

    el('btn-guardar-parcela')?.addEventListener('click', () => {
        estadoSandbox.experienciaActual?.sincronizarParcelaRed?.();
        el('popover-bloques')?.classList.add('oculto');
        el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
    });

    el('btn-limpiar-parcela')?.addEventListener('click', () => {
        estadoSandbox.experienciaActual?.limpiarParcela?.();
        el('popover-bloques')?.classList.add('oculto');
        el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
    });

    // Popover colapsable del Garaje Kart y botón Abortar Salida
    el('btn-toggle-kart')?.addEventListener('click', (e) => {
        e.stopPropagation();
        alternarGarajeKart();
        reproducirSonido('interaccion');
    });

    el('btn-cancelar-salida')?.addEventListener('click', (e) => {
        e.stopPropagation();
        estadoSandbox.experienciaActual?.cancelarSalidaCarrera?.('boton');
        actualizarHUD();
    });

    document.addEventListener('pointerdown', (e) => {
        const popKart = el('popover-kart');
        const btnKart = el('btn-toggle-kart');
        if (popKart && !popKart.classList.contains('oculto')) {
            if (!popKart.contains(e.target) && !btnKart?.contains(e.target)) {
                alternarGarajeKart(false);
            }
        }
    });

    // Botones del overlay 100% pantalla completa de SalaTetris
    el('btn-tetris-levantarse')?.addEventListener('click', () => {
        estadoSandbox.experienciaActual?.levantarseAsientoTetris?.();
    });
    el('btn-tetris-reiniciar')?.addEventListener('click', () => {
        estadoSandbox.experienciaActual?.manejarAccionTetris?.('reiniciar');
    });
    document.querySelector('[data-accion-tetris="levantarse"]')?.addEventListener('click', () => {
        estadoSandbox.experienciaActual?.levantarseAsientoTetris?.();
    });
    const botonesDpadTetris = [
        { id: 'btn-tetris-izq', accion: 'izquierda', dasMs: 150, arrMs: 55 },
        { id: 'btn-tetris-der', accion: 'derecha', dasMs: 150, arrMs: 55 },
        { id: 'btn-tetris-bajar', accion: 'bajar', dasMs: 90, arrMs: 48 }
    ];
    for (const cfg of botonesDpadTetris) {
        const btn = el(cfg.id);
        if (!btn) continue;

        let pointerActivo = null;
        let timerDas = null;
        let intervaloArr = null;

        const detener = () => {
            if (timerDas) {
                clearTimeout(timerDas);
                timerDas = null;
            }
            if (intervaloArr) {
                clearInterval(intervaloArr);
                intervaloArr = null;
            }
            pointerActivo = null;
            btn.classList.remove('presionado');
        };

        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            detenerRepeticionTetris();
            pointerActivo = e.pointerId;
            limpiarDasTetrisActivo = detener;
            btn.classList.add('presionado');
            try {
                btn.setPointerCapture(e.pointerId);
            } catch (_err) {
                // Ignorar si el navegador no soporta captura
            }
            estadoSandbox.experienciaActual?.manejarAccionTetris?.(cfg.accion);
            timerDas = setTimeout(() => {
                timerDas = null;
                intervaloArr = setInterval(() => {
                    if (!estadoControles.modoTetrisActivo) {
                        detener();
                        return;
                    }
                    estadoSandbox.experienciaActual?.manejarAccionTetris?.(cfg.accion);
                }, cfg.arrMs);
            }, cfg.dasMs);
        });

        const soltarDpad = (e) => {
            if (pointerActivo !== null && e?.pointerId !== undefined && e.pointerId !== pointerActivo) return;
            detener();
            if (limpiarDasTetrisActivo === detener) {
                limpiarDasTetrisActivo = null;
            }
        };
        btn.addEventListener('pointerup', soltarDpad);
        btn.addEventListener('pointercancel', soltarDpad);
        btn.addEventListener('lostpointercapture', soltarDpad);
    }

    window.addEventListener('blur', detenerRepeticionTetris);

    const accionesSimplesTetris = [
        ['btn-tetris-rotar', 'rotar'],
        ['btn-tetris-caida', 'caida_rapida'],
        ['btn-tetris-hold', 'hold']
    ];
    for (const [idBtn, accion] of accionesSimplesTetris) {
        const btn = el(idBtn);
        if (!btn) continue;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.add('presionado');
            estadoSandbox.experienciaActual?.manejarAccionTetris?.(accion);
        });
        const soltarAccion = () => btn.classList.remove('presionado');
        btn.addEventListener('pointerup', soltarAccion);
        btn.addEventListener('pointercancel', soltarAccion);
        btn.addEventListener('pointerleave', soltarAccion);
    }

    el('btn-audio')?.addEventListener('click', (e) => {
        const silenciado = alternarSilencioAudio();
        e.currentTarget.textContent = silenciado ? '🔇' : '🔊';
    });

    const btnMusica = el('btn-musica');
    if (btnMusica) {
        const sincronizarBtnMusica = (silenciada) => {
            btnMusica.textContent = silenciada ? '🔇' : '🎵';
            btnMusica.classList.toggle('btn-musica-silenciada', silenciada);
        };
        sincronizarBtnMusica(estaMusicaSilenciada());
        btnMusica.addEventListener('click', () => {
            const silenciada = alternarSilencioMusica();
            sincronizarBtnMusica(silenciada);
        });
    }

    const desbloquearUnaVez = () => {
        desbloquearMusica();
        window.removeEventListener('pointerdown', desbloquearUnaVez);
        window.removeEventListener('keydown', desbloquearUnaVez);
    };
    window.addEventListener('pointerdown', desbloquearUnaVez, { passive: true });
    window.addEventListener('keydown', desbloquearUnaVez, { passive: true });

    el('btn-conectar-sala')?.addEventListener('click', () => {
        const nuevoApodo = inputApodo?.value?.trim() || estadoJugador.apodo;
        const codigoSala = inputSala?.value?.trim() || 'SALA-PUBLICA';
        estadoJugador.apodo = nuevoApodo.slice(0, 18);
        guardarEstadoLocal();

        if (contextoGlobal?.avatarLocal) {
            actualizarEtiquetaAvatar(
                contextoGlobal.avatarLocal,
                estadoJugador.apodo,
                estadoJugador.nivel
            );
        }

        conectarSalaMultijugador(codigoSala, estadoJugador.apodo, contextoGlobal?.escena);
        actualizarHUD();
    });

    el('btn-desconectar-sala')?.addEventListener('click', () => {
        desconectarSalaMultijugador(contextoGlobal?.escena);
        actualizarHUD();
    });

    suscribirEstado((evento, detalle) => {
        if (evento === 'recompensa' && detalle?.subioNivel) {
            mostrarNotificacion(`¡Subiste al Nivel ${detalle.nuevoNivel}!`, 'exito');
            if (contextoGlobal?.avatarLocal) {
                actualizarEtiquetaAvatar(
                    contextoGlobal.avatarLocal,
                    estadoJugador.apodo,
                    estadoJugador.nivel
                );
            }
        } else if (evento === 'perfil_actualizado') {
            aplicarCambioApariencia();
            if (contextoGlobal?.avatarLocal) {
                actualizarEtiquetaAvatar(
                    contextoGlobal.avatarLocal,
                    estadoJugador.apodo,
                    estadoJugador.nivel
                );
            }
            if (estadoJugador.experienciaActiva === 'construccion') {
                estadoSandbox.experienciaActual?.alEventoRed?.({
                    subtipo: 'sincronizar_parcela',
                    datos: { accion: 'sincronizar_parcela', bloques: estadoJugador.construccionGuardada }
                });
            }
        } else if (evento === 'aviso' && detalle?.mensaje) {
            mostrarNotificacion(detalle.mensaje, 'info');
        } else if (evento === 'error_sala' && detalle?.codigo === 'APODO_EN_USO') {
            reabrirBienvenida(detalle.error || 'Ese jugador ya está conectado en la sala.');
        } else if (evento === 'experiencia_cambiada' && detalle?.nombre) {
            const tituloMusica = seleccionarMusicaExperiencia(detalle.id || estadoJugador.experienciaActiva);
            const textoToast = !estaMusicaSilenciada() && !estadoControles.pantallaBienvenidaActiva
                ? `${detalle.nombre} · 🎵 ${tituloMusica}`
                : `Entraste a: ${detalle.nombre}`;
            mostrarNotificacion(textoToast, 'exito');
        } else if (evento === 'tetris_cambio') {
            renderizarOverlayTetris();
        }
        actualizarHUD();
    });

    vincularMenuRobloxYSocial(reabrirBienvenida);
    renderizarHotbarBloques();
    vincularControlesEntrada();
    actualizarHUD();
}
