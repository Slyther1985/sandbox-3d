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
    estadoControles,
    estadoJugador,
    estadoRed,
    estadoSandbox,
    exportarCodigoPerfil,
    guardarEstadoLocal,
    importarCodigoPerfil,
    obtenerXpParaSiguienteNivel,
    suscribirEstado
} from './estado.js';
import { alternarSilencioAudio, reproducirSonido } from './recursos.js';
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
    desconectarSalaMultijugador,
    enviarAccionSocial,
    enviarEstadoJugadorInmediato
} from './red.js';

let contextoGlobal = null;
let resumenHudPrevio = '';

/**
 * Obtiene un elemento del DOM por ID.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function el(id) {
    return document.getElementById(id);
}

/**
 * Muestra una notificación emergente temporal en el HUD.
 * @param {string} mensaje
 * @param {'info'|'exito'|'alerta'} [tipo]
 */
export function mostrarNotificacion(mensaje, tipo = 'info') {
    const contenedor = el('contenedor-notificaciones');
    if (!contenedor || !mensaje) return;

    const toast = document.createElement('div');
    toast.className = `notificacion notificacion-${tipo}`;
    toast.textContent = mensaje;
    contenedor.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('saliendo');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

/**
 * Cierra paneles secundarios y restaura la cámara si el Estudio de Avatar estaba abierto.
 */
function cerrarPanelesFlotantes() {
    el('menu-dona-overlay')?.classList.add('oculto');
    el('modal-inventario')?.classList.add('oculto');
    el('panel-gestos-dona')?.classList.add('oculto');
    el('panel-chat-rapido')?.classList.add('oculto');
    el('panel-red')?.classList.add('oculto');
    el('popover-bloques')?.classList.add('oculto');
    el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
    alternarGarajeKart(false);

    const modalAvatar = el('modal-avatar');
    if (modalAvatar && !modalAvatar.classList.contains('oculto')) {
        modalAvatar.classList.add('oculto');
        estadoControles.modoPreviewAvatar = false;
    }
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
 * Abre o cierra el Estudio de Avatar activando la cámara en vivo `modoPreviewAvatar`.
 * @param {boolean} abrir
 */
function alternarEstudioAvatar(abrir) {
    const modal = el('modal-avatar');
    if (!modal) return;
    if (abrir) {
        cerrarPanelesFlotantes();
        renderizarEstudioAvatar();
        modal.classList.remove('oculto');
        estadoControles.modoPreviewAvatar = true;
        estadoControles.anguloPreviewAvatar = estadoJugador.rotacion;
    } else {
        modal.classList.add('oculto');
        estadoControles.modoPreviewAvatar = false;
    }
    reproducirSonido('interaccion');
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
 * Renderiza el catálogo de inventario y tienda dentro del modal.
 */
function renderizarInventario() {
    const lista = el('lista-inventario');
    if (!lista) return;
    lista.innerHTML = '';

    for (const item of CATALOGO_ITEMS) {
        const rareza = RAREZAS[item.rareza] || RAREZAS.COMUN;
        const enInventario = estadoJugador.inventario.includes(item.id);
        const estaEquipado = estadoJugador.equipado[item.slot] === item.id;

        const tarjeta = document.createElement('div');
        tarjeta.className = `tarjeta-item ${estaEquipado ? 'item-equipado' : ''}`;
        tarjeta.style.borderColor = rareza.color;

        const cabecera = document.createElement('div');
        cabecera.className = 'tarjeta-item-cabecera';

        const badge = document.createElement('span');
        badge.className = 'badge-rareza';
        badge.style.backgroundColor = rareza.color;
        badge.textContent = rareza.nombre;

        const slotTag = document.createElement('span');
        slotTag.className = 'slot-item';
        slotTag.textContent = item.slot.toUpperCase();

        cabecera.append(badge, slotTag);

        const titulo = document.createElement('h4');
        titulo.textContent = item.nombre;

        const desc = document.createElement('p');
        desc.textContent = item.descripcion;

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
            btn.textContent = 'Desequipar';
            btn.classList.add('btn-secundario');
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
 * Renderiza el personalizador colapsable del Garaje Kart y las barras VEL/ACEL/CTRL.
 */
function renderizarGarajeKart() {
    const exp = estadoSandbox.experienciaActual;
    const stats = typeof exp?.obtenerStatsKart === 'function'
        ? exp.obtenerStatsKart(estadoJugador.configKart)
        : { velocidad: 45, aceleracion: 39, control: 36 };

    const setBarra = (id, valor) => {
        const barra = el(id);
        if (barra) barra.style.width = `${Math.min(100, Math.round((valor / 65) * 100))}%`;
    };
    setBarra('barra-stat-vel', stats.velocidad);
    setBarra('barra-stat-acel', stats.aceleracion);
    setBarra('barra-stat-ctrl', stats.control);

    const actualizarConfig = () => {
        exp?.actualizarKartJugador?.();
        renderizarGarajeKart();
        reproducirSonido('interaccion');
    };

    const poblarChips = (idCont, lista, clave) => {
        const cont = el(idCont);
        if (!cont) return;
        cont.innerHTML = '';
        for (const item of lista) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `chip-opcion ${estadoJugador.configKart[clave] === item.id ? 'activo' : ''}`;
            btn.textContent = item.nombre;
            btn.addEventListener('click', () => {
                estadoJugador.configKart[clave] = item.id;
                actualizarConfig();
            });
            cont.appendChild(btn);
        }
    };

    poblarChips('selector-kart-chasis', CATALOGO_KARTS, 'chasis');
    poblarChips('selector-kart-ruedas', CATALOGO_PIEZAS_KART.ruedas, 'ruedas');
    poblarChips('selector-kart-aleron', CATALOGO_PIEZAS_KART.alerones, 'aleron');

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
    const firmaKarts = ec
        ? `${ec.velocidadKmH}|${ec.vueltaActual || 1}/${ec.totalVueltas || 2}|${ec.checkpointActual}|${ec.tiempoVuelta.toFixed(1)}|${estadoJugador.mejorVueltaKart}|${ec.bannerMensaje}|${tablaKarts?.size || 0}|${estadoControles.modoCeremoniaPodio}`
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
    const popoverKart = el('popover-kart');
    const bannerKarts = el('banner-conteo-karts');
    void el('hotbar-bloques');

    if (hudApodo) hudApodo.textContent = estadoJugador.apodo;
    if (hudNivel) hudNivel.textContent = `Nv. ${estadoJugador.nivel}`;
    if (hudXpBarra) hudXpBarra.style.width = `${pctXp}%`;
    if (hudMonedas) hudMonedas.textContent = String(estadoJugador.monedas);
    if (hudExperiencia) hudExperiencia.textContent = nombreExp;

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

    if (avisoInteraccion) {
        if (textoEntidad) {
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
        hudKarts.classList.toggle('oculto', !esKarts);
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
                if (ec.bannerMensaje) {
                    bannerKarts.textContent = ec.bannerMensaje;
                    bannerKarts.classList.remove('oculto');
                } else {
                    bannerKarts.classList.add('oculto');
                }
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
        }
    }

    renderizarOverlayTetris();
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
    el('btn-menu-dona')?.classList.toggle('oculto', activo);
    if (!activo) return;

    const info = estadoSandbox.experienciaActual?.obtenerEstadoHUDTetris?.();
    if (!info) return;

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
            const overlay = el('menu-dona-overlay');
            if (overlay) {
                const estabaOculto = overlay.classList.contains('oculto');
                if (estabaOculto) {
                    cerrarPanelesFlotantes();
                    overlay.classList.remove('oculto');
                } else {
                    overlay.classList.add('oculto');
                }
                reproducirSonido('interaccion');
            }
            return;
        }

        estadoControles.teclas.add(e.code);

        if (e.code === 'KeyE') {
            ejecutarInteraccion();
        } else if (e.code === 'KeyF') {
            dispararGestoSocial('saludar');
        } else if (e.code === 'KeyB' && estadoJugador.experienciaActiva === 'construccion') {
            const pop = el('popover-bloques');
            const oculto = pop?.classList.toggle('oculto');
            el('btn-toggle-bloques')?.setAttribute('aria-expanded', String(!oculto));
            reproducirSonido('interaccion');
        } else if (e.code === 'KeyG' && estadoJugador.experienciaActiva === 'karts') {
            alternarGarajeKart();
            reproducirSonido('interaccion');
        } else if (e.code === 'Escape') {
            cerrarPanelesFlotantes();
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
    const lienzo = el('lienzo-3d');
    if (lienzo) {
        let pointerCamara = null;
        let prevX = 0;
        let prevY = 0;

        lienzo.addEventListener('pointerdown', (e) => {
            el('popover-bloques')?.classList.add('oculto');
            el('btn-toggle-bloques')?.setAttribute('aria-expanded', 'false');
            alternarGarajeKart(false);
            if (pointerCamara !== null) return;
            pointerCamara = e.pointerId;
            prevX = e.clientX;
            prevY = e.clientY;
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
            }
        };
        window.addEventListener('pointerup', soltarCamara);
        window.addEventListener('pointercancel', soltarCamara);
    }

    // Joystick virtual táctil
    const zonaJoystick = el('zona-joystick');
    const palanca = el('palanca-joystick');
    if (zonaJoystick && palanca) {
        let pointerJoystick = null;
        const radioMax = 42;

        const actualizarJoystick = (clientX, clientY) => {
            const rect = zonaJoystick.getBoundingClientRect();
            const centroX = rect.left + rect.width / 2;
            const centroY = rect.top + rect.height / 2;
            let dx = clientX - centroX;
            let dy = clientY - centroY;
            const dist = Math.hypot(dx, dy);
            if (dist > radioMax) {
                dx = (dx / dist) * radioMax;
                dy = (dy / dist) * radioMax;
            }

            palanca.style.transform = `translate(${dx}px, ${dy}px)`;
            estadoControles.joystick.x = dx / radioMax;
            estadoControles.joystick.y = -dy / radioMax;
            estadoControles.joystick.activo = true;
        };

        zonaJoystick.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pointerJoystick = e.pointerId;
            actualizarJoystick(e.clientX, e.clientY);
        });

        window.addEventListener('pointermove', (e) => {
            if (e.pointerId === pointerJoystick) {
                actualizarJoystick(e.clientX, e.clientY);
            }
        });

        const resetJoystick = (e) => {
            if (e.pointerId !== pointerJoystick) return;
            pointerJoystick = null;
            palanca.style.transform = 'translate(0px, 0px)';
            estadoControles.joystick.x = 0;
            estadoControles.joystick.y = 0;
            estadoControles.joystick.activo = false;
        };
        window.addEventListener('pointerup', resetJoystick);
        window.addEventListener('pointercancel', resetJoystick);
    }

    // Botones móviles
    const btnSaltar = el('btn-movil-saltar');
    if (btnSaltar) {
        btnSaltar.addEventListener('pointerdown', (e) => {
            e.preventDefault();
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
 * Vincula el Menú Radial Dona (5 sectores) y sus subpaneles sociales/red.
 */
function vincularMenuRadialYSocial() {
    const overlayDona = el('menu-dona-overlay');

    el('btn-menu-dona')?.addEventListener('click', () => {
        const oculto = overlayDona?.classList.contains('oculto');
        if (oculto) {
            cerrarPanelesFlotantes();
            overlayDona.classList.remove('oculto');
        } else {
            overlayDona?.classList.add('oculto');
        }
        reproducirSonido('interaccion');
    });

    el('btn-cerrar-dona')?.addEventListener('click', () => {
        overlayDona?.classList.add('oculto');
        reproducirSonido('interaccion');
    });

    overlayDona?.addEventListener('click', (e) => {
        if (e.target === overlayDona) {
            overlayDona.classList.add('oculto');
        }
    });

    el('dona-btn-avatar')?.addEventListener('click', () => {
        alternarEstudioAvatar(true);
    });

    el('dona-btn-inventario')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        renderizarInventario();
        el('modal-inventario')?.classList.remove('oculto');
        reproducirSonido('interaccion');
    });

    el('dona-btn-gestos')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        el('panel-gestos-dona')?.classList.remove('oculto');
        reproducirSonido('interaccion');
    });

    el('dona-btn-chat')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        el('panel-chat-rapido')?.classList.remove('oculto');
        reproducirSonido('interaccion');
    });

    el('dona-btn-sala')?.addEventListener('click', () => {
        cerrarPanelesFlotantes();
        el('panel-red')?.classList.remove('oculto');
        reproducirSonido('interaccion');
    });

    el('indicador-estado-red')?.addEventListener('click', () => {
        const panelRed = el('panel-red');
        const abierto = panelRed && !panelRed.classList.contains('oculto');
        cerrarPanelesFlotantes();
        if (!abierto) panelRed?.classList.remove('oculto');
    });

    el('btn-cerrar-gestos')?.addEventListener('click', () => {
        el('panel-gestos-dona')?.classList.add('oculto');
    });

    el('btn-cerrar-chat')?.addEventListener('click', () => {
        el('panel-chat-rapido')?.classList.add('oculto');
    });

    el('btn-cerrar-red')?.addEventListener('click', () => {
        el('panel-red')?.classList.add('oculto');
    });

    // Emotes
    el('btn-gesto-saludar')?.addEventListener('click', () => {
        dispararGestoSocial('saludar');
        el('panel-gestos-dona')?.classList.add('oculto');
    });
    el('btn-gesto-bailar')?.addEventListener('click', () => {
        dispararGestoSocial('bailar');
        el('panel-gestos-dona')?.classList.add('oculto');
    });
    el('btn-gesto-celebrar')?.addEventListener('click', () => {
        dispararGestoSocial('celebrar');
        el('panel-gestos-dona')?.classList.add('oculto');
    });
    el('btn-gesto-sentarse')?.addEventListener('click', () => {
        dispararGestoSocial('sentarse');
        el('panel-gestos-dona')?.classList.add('oculto');
    });

    // Chat rápido
    for (const btn of document.querySelectorAll('.btn-frase-chat')) {
        btn.addEventListener('click', () => {
            const frase = btn.getAttribute('data-frase') || btn.textContent;
            enviarChatRapido(frase);
            el('panel-chat-rapido')?.classList.add('oculto');
        });
    }

    const inputChat = el('input-chat-rapido');
    el('btn-enviar-chat')?.addEventListener('click', () => {
        if (!inputChat) return;
        enviarChatRapido(inputChat.value);
        inputChat.value = '';
        el('panel-chat-rapido')?.classList.add('oculto');
    });
    inputChat?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            enviarChatRapido(inputChat.value);
            inputChat.value = '';
            el('panel-chat-rapido')?.classList.add('oculto');
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

    el('btn-cerrar-avatar')?.addEventListener('click', () => {
        alternarEstudioAvatar(false);
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

    el('btn-cerrar-inventario')?.addEventListener('click', () => {
        el('modal-inventario')?.classList.add('oculto');
        reproducirSonido('interaccion');
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

    // Popover colapsable del Garaje Kart
    el('btn-toggle-kart')?.addEventListener('click', (e) => {
        e.stopPropagation();
        alternarGarajeKart();
        reproducirSonido('interaccion');
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
    const accionesBotonesTetris = [
        ['btn-tetris-izq', 'izquierda'],
        ['btn-tetris-der', 'derecha'],
        ['btn-tetris-rotar', 'rotar'],
        ['btn-tetris-bajar', 'bajar'],
        ['btn-tetris-caida', 'caida_rapida'],
        ['btn-tetris-hold', 'hold']
    ];
    for (const [idBtn, accion] of accionesBotonesTetris) {
        el(idBtn)?.addEventListener('click', () => {
            estadoSandbox.experienciaActual?.manejarAccionTetris?.(accion);
        });
    }

    el('btn-audio')?.addEventListener('click', (e) => {
        const silenciado = alternarSilencioAudio();
        e.currentTarget.textContent = silenciado ? '🔇' : '🔊';
    });

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
        } else if (evento === 'experiencia_cambiada' && detalle?.nombre) {
            mostrarNotificacion(`Entraste a: ${detalle.nombre}`, 'exito');
        } else if (evento === 'tetris_cambio') {
            renderizarOverlayTetris();
        }
        actualizarHUD();
    });

    vincularMenuRadialYSocial();
    renderizarHotbarBloques();
    vincularControlesEntrada();
    actualizarHUD();
}
