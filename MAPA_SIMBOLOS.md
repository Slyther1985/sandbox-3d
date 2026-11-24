# MAPA_SIMBOLOS.md

Índice automático de módulos ES6, importaciones, exportaciones, clases, funciones y constantes en `js/**/*.js`.
Total de módulos analizados: **16**

## `js/audio.js`

- **Imports**: `./partituras.js` (L6)
- **Exports**: `desbloquearMusica` [function] (L50), `seleccionarMusicaExperiencia` [function] (L108), `alternarSilencioMusica` [function] (L124), `estaMusicaSilenciada` [function] (L141), `actualizarMusicaAmbiental` [function] (L330)
- **Funciones**: `obtenerBufferRuido` (L32), `desbloquearMusica` (L50), `seleccionarMusicaExperiencia` (L108), `alternarSilencioMusica` (L124), `estaMusicaSilenciada` (L141), `dispararTono` (L154), `reproducirPercusion` (L238), `contarPasosSostenidos` (L317), `actualizarMusicaAmbiental` (L330)

## `js/avatar.js`

- **Imports**: `./constantes.js` (L6), `./recursos.js` (L7)
- **Exports**: `crearAvatar3D` [function] (L75), `actualizarAparienciaAvatar` [function] (L303), `mostrarBurbujaChatAvatar` [function] (L365), `sincronizarAccesoriosAvatar` [function] (L491), `actualizarEtiquetaAvatar` [function] (L521), `actualizarAnimacionAvatar` [function] (L543), `ensamblarKart3D` [function] (L674), `montarAvatarEnKart` [function] (L1109)
- **Funciones**: `elegirColorTorso` (L23), `crearMaterialPlasticoABS` (L36), `crearGeometriaTorsoLEGO` (L50), `crearAvatar3D` (L75), `actualizarAparienciaAvatar` (L303), `mostrarBurbujaChatAvatar` (L365), `construirMallaAccesorio` (L394), `sincronizarAccesoriosAvatar` (L491), `actualizarEtiquetaAvatar` (L521), `actualizarAnimacionAvatar` (L543), `ensamblarKart3D` (L674), `montarAvatarEnKart` (L1109)
- **Constantes**: `PALETA_TORSOS` (L16)

## `js/config.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `URL_WS_LOCAL` [const] (L6), `URL_WS_PRODUCCION` [const] (L7), `CONFIG_CAMARA` [const] (L9), `esEntornoLocal` [function] (L22), `obtenerUrlWebSocket` [function] (L39), `obtenerUrlHttpServidor` [function] (L60)
- **Funciones**: `esEntornoLocal` (L22), `obtenerUrlWebSocket` (L39), `obtenerUrlHttpServidor` (L60)
- **Constantes**: `URL_WS_LOCAL` (L6), `URL_WS_PRODUCCION` (L7), `CONFIG_CAMARA` (L9)

## `js/constantes.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `DIMENSION_LOBBY` [const] (L6), `MITAD_LOBBY` [const] (L7), `DIMENSION_PARCELA` [const] (L8), `MITAD_PARCELA` [const] (L9), `DIMENSION_PISTA_KARTS` [const] (L10), `MITAD_PISTA_KARTS` [const] (L11), `VUELTAS_CARRERA_KARTS` [const] (L12), `LIMITE_MUNDO` [const] (L13), `ALTURA_CAIDA_VACIO` [const] (L14), `GRAVEDAD_BASE` [const] (L16), `VELOCIDAD_CAMINAR` [const] (L17), `VELOCIDAD_SPRINT` [const] (L18), `FUERZA_SALTO` [const] (L19), `ALTURA_AVATAR` [const] (L20), `RADIO_COLISION_AVATAR` [const] (L21), `DISTANCIA_INTERACCION` [const] (L22), `TASA_ENVIO_HZ` [const] (L24), `INTERVALO_ENVIO_MS` [const] (L25), `XP_BASE_NIVEL` [const] (L27), `MONEDAS_INICIALES` [const] (L28), `COMUN` [const] (L30), `RARO` [const] (L31), `EPICO` [const] (L32), `LEGENDARIO` [const] (L33), `RAREZAS` [const] (L35), `PALETA_AVATAR` [const] (L42), `CATALOGO_BLOQUES` [const] (L49), `CATALOGO_ITEMS` [const] (L60), `CATALOGO_KARTS` [const] (L117), `CATALOGO_PIEZAS_KART` [const] (L160)
- **Constantes**: `DIMENSION_LOBBY` (L6), `MITAD_LOBBY` (L7), `DIMENSION_PARCELA` (L8), `MITAD_PARCELA` (L9), `DIMENSION_PISTA_KARTS` (L10), `MITAD_PISTA_KARTS` (L11), `VUELTAS_CARRERA_KARTS` (L12), `LIMITE_MUNDO` (L13), `ALTURA_CAIDA_VACIO` (L14), `GRAVEDAD_BASE` (L16), `VELOCIDAD_CAMINAR` (L17), `VELOCIDAD_SPRINT` (L18), `FUERZA_SALTO` (L19), `ALTURA_AVATAR` (L20), `RADIO_COLISION_AVATAR` (L21), `DISTANCIA_INTERACCION` (L22), `TASA_ENVIO_HZ` (L24), `INTERVALO_ENVIO_MS` (L25), `XP_BASE_NIVEL` (L27), `MONEDAS_INICIALES` (L28), `COMUN` (L30), `RARO` (L31), `EPICO` (L32), `LEGENDARIO` (L33), `RAREZAS` (L35), `PALETA_AVATAR` (L42), `CATALOGO_BLOQUES` (L49), `CATALOGO_ITEMS` (L60), `CATALOGO_KARTS` (L117), `CATALOGO_PIEZAS_KART` (L160)

## `js/estado.js`

- **Imports**: `./constantes.js` (L5)
- **Exports**: `estadoJugador` [const] (L24), `estadoRed` [const] (L53), `estadoSandbox` [const] (L63), `estadoControles` [const] (L70), `suscribirEstado` [function] (L104), `notificarEstado` [function] (L114), `obtenerXpParaSiguienteNivel` [function] (L129), `construirResumenPerfil` [function] (L137), `aplicarDatosPerfil` [function] (L157), `cargarPerfilesLocales` [function] (L260), `restablecerPerfilNuevo` [function] (L296), `guardarEstadoLocal` [function] (L327), `cargarEstadoLocal` [function] (L348), `exportarCodigoPerfil` [function] (L363), `importarCodigoPerfil` [function] (L378)
- **Funciones**: `suscribirEstado` (L104), `notificarEstado` (L114), `obtenerXpParaSiguienteNivel` (L129), `construirResumenPerfil` (L137), `aplicarDatosPerfil` (L157), `cargarPerfilesLocales` (L260), `restablecerPerfilNuevo` (L296), `guardarEstadoLocal` (L327), `cargarEstadoLocal` (L348), `exportarCodigoPerfil` (L363), `importarCodigoPerfil` (L378)
- **Constantes**: `CLAVE_ALMACENAMIENTO` (L15), `CLAVE_PERFILES_LOCALES` (L16), `MAPA_MIGRACION_CHASIS` (L18), `estadoJugador` (L24), `estadoRed` (L53), `estadoSandbox` (L63), `estadoControles` (L70), `suscriptores` (L97)

## `js/experiencias/arenaTurboKarts.js`

- **Imports**: `../constantes.js` (L8), `../config.js` (L15), `../estado.js` (L16), `../recursos.js` (L23), `../avatar.js` (L32), `../nucleoSandbox.js` (L38), `../red.js` (L39)
- **Exports**: `ArenaTurboKarts` [class] (L48)
- **Clases**: `ArenaTurboKarts extends ExperienciaBase` (L48)
- **Constantes**: `ANCHO_PISTA` (L41), `SEGMENTOS_PISTA` (L42), `CENTRO_SALIDA_Z` (L43), `DURACION_CONTEO_SALIDA` (L44), `DURACION_CEREMONIA_PODIO` (L45), `POSICION_PODIO` (L46)

## `js/experiencias/lobbyCentral.js`

- **Imports**: `../constantes.js` (L7), `../config.js` (L8), `../estado.js` (L9), `../recursos.js` (L10), `../nucleoSandbox.js` (L22), `../red.js` (L23)
- **Exports**: `LobbyCentral` [class] (L25)
- **Clases**: `LobbyCentral extends ExperienciaBase` (L25)

## `js/experiencias/salaTetris.js`

- **Imports**: `../estado.js` (L6), `../recursos.js` (L13), `../nucleoSandbox.js` (L18), `../config.js` (L19), `../red.js` (L20)
- **Exports**: `TOTAL_ASIENTOS_TETRIS` [const] (L22), `COLUMNAS_TETRIS` [const] (L23), `FILAS_VISIBLES_TETRIS` [const] (L24), `FILAS_OCULTAS_TETRIS` [const] (L25), `FILAS_TOTALES_TETRIS` [const] (L26), `PUNTAJES_LINEAS_TETRIS` [const] (L28), `SalaTetris` [class] (L107)
- **Clases**: `SalaTetris extends ExperienciaBase` (L107)
- **Constantes**: `TOTAL_ASIENTOS_TETRIS` (L22), `COLUMNAS_TETRIS` (L23), `FILAS_VISIBLES_TETRIS` (L24), `FILAS_OCULTAS_TETRIS` (L25), `FILAS_TOTALES_TETRIS` (L26), `PUNTAJES_LINEAS_TETRIS` (L28), `PASO_CELDA_3D` (L35), `CENTRO_Y_TABLERO_3D` (L36), `PIEZAS_TETRIS` (L38), `TIPOS_PIEZAS` (L104), `INDICES_COLOR` (L105)

## `js/experiencias/zonaConstruccion.js`

- **Imports**: `../constantes.js` (L6), `../estado.js` (L13), `../recursos.js` (L21), `../nucleoSandbox.js` (L29), `../red.js` (L30)
- **Exports**: `ZonaConstruccion` [class] (L34)
- **Clases**: `ZonaConstruccion extends ExperienciaBase` (L34)
- **Constantes**: `ALTURA_MAX_BLOQUE` (L32)

## `js/fisicaSandbox.js`

- **Imports**: `./constantes.js` (L6), `./estado.js` (L17), `./recursos.js` (L22)
- **Exports**: `estadoFisica` [const] (L24), `activarGestoLocal` [function] (L38), `activarSaludoLocal` [function] (L46), `actualizarFisicaSandbox` [function] (L69)
- **Funciones**: `activarGestoLocal` (L38), `activarSaludoLocal` (L46), `solapaXZ` (L53), `actualizarFisicaSandbox` (L69)
- **Constantes**: `estadoFisica` (L24)

## `js/interfaz.js`

- **Imports**: `./constantes.js` (L5), `./estado.js` (L13), `./recursos.js` (L27), `./audio.js` (L28), `./avatar.js` (L34), `./fisicaSandbox.js` (L40), `./nucleoSandbox.js` (L41), `./red.js` (L42)
- **Exports**: `mostrarNotificacion` [function] (L73), `actualizarHUD` [function] (L692), `inicializarInterfaz` [function] (L1697)
- **Funciones**: `el` (L63), `mostrarNotificacion` (L73), `cerrarPanelesFlotantes` (L98), `sincronizarVisibilidadControlesMoviles` (L116), `renderizarResumenJugador` (L128), `cambiarTabMenuUnificado` (L139), `alternarMenuUnificado` (L173), `alternarGarajeKart` (L198), `aplicarCambioApariencia` (L217), `dispararGestoSocial` (L231), `enviarChatRapido` (L241), `ejecutarInteraccion` (L252), `renderizarInventario` (L264), `renderizarEstudioAvatar` (L375), `renderizarHotbarBloques` (L452), `formatearTiempoCarrera` (L512), `renderizarGarajeKart` (L524), `renderizarBannerPodioF1` (L643), `actualizarHUD` (L692), `renderizarOverlayTetris` (L855), `vincularControlesEntrada` (L895), `vincularMenuRobloxYSocial` (L1202), `esDispositivoMovilTactil` (L1343), `solicitarPantallaCompletaSeguro` (L1353), `alternarPantallaCompleta` (L1378), `inicializarPantallaBienvenida` (L1401), `inicializarInterfaz` (L1697)

## `js/main.js`

- **Imports**: `./config.js` (L6), `./estado.js` (L7), `./avatar.js` (L14), `./fisicaSandbox.js` (L15), `./nucleoSandbox.js` (L16), `./red.js` (L20), `./audio.js` (L21), `./interfaz.js` (L22), `./experiencias/lobbyCentral.js` (L23), `./experiencias/zonaConstruccion.js` (L24), `./experiencias/arenaTurboKarts.js` (L25), `./experiencias/salaTetris.js` (L26)
- **Exports**: `resolverColisionCamara` [function] (L74)
- **Funciones**: `recolectarMallasBloqueantes` (L41), `resolverColisionCamara` (L74), `iniciarSandbox` (L101)
- **Constantes**: `_raycasterCamara` (L28), `_dirCamara` (L29), `_posResueltaCamara` (L30), `_candidatosColisionCamara` (L31), `_objetosIgnoradosCamara` (L32)

## `js/nucleoSandbox.js`

- **Imports**: `./constantes.js` (L5), `./config.js` (L6), `./estado.js` (L7), `./recursos.js` (L15)
- **Exports**: `ExperienciaBase` [class] (L69), `RegistroExperiencias` [const] (L396), `actualizarPortalesFisicos` [function] (L477)
- **Clases**: `ExperienciaBase` (L69)
- **Funciones**: `crearTexturaLetreroPortal` (L30), `actualizarPortalesFisicos` (L477)
- **Constantes**: `RegistroExperiencias` (L396)

## `js/partituras.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `notaAFrecuencia` [function] (L22), `MAPA_MUSICA_EXPERIENCIA` [const] (L52), `CATALOGO_PARTITURAS` [const] (L59)
- **Funciones**: `notaAFrecuencia` (L22), `unirCompases` (L48)
- **Constantes**: `SEMITONOS_BASE` (L7), `MAPA_MUSICA_EXPERIENCIA` (L52), `CATALOGO_PARTITURAS` (L59)

## `js/recursos.js`

- **Imports**: `./constantes.js` (L5)
- **Exports**: `bancoTexturas` [const] (L7), `estadoAudio` [const] (L9), `obtenerTexturaCespedPlaza` [function] (L84), `obtenerMapasPBRPlaza` [function] (L143), `obtenerTexturaSueloPlaza` [function] (L188), `obtenerTexturaBulevarParque` [function] (L197), `obtenerTexturaCarpaParque` [function] (L256), `obtenerTexturaLetreroNeon` [function] (L282), `obtenerTexturaPlataforma` [function] (L346), `obtenerTexturaPortal` [function] (L368), `obtenerTexturaRostro` [function] (L410), `obtenerTexturaBloqueVoxel` [function] (L533), `obtenerMapasPBRBloqueVoxel` [function] (L649), `crearTexturaBurbujaChat` [function] (L705), `crearCupulaCielo` [function] (L749), `obtenerTexturaPistaKart` [function] (L982), `obtenerTexturaTurboPad` [function] (L1008), `obtenerTexturaMetaDamero` [function] (L1036), `obtenerTexturaNeumatico` [function] (L1052), `obtenerTexturaChasisKart` [function] (L1205), `crearTexturaEtiqueta` [function] (L1329), `alternarSilencioAudio` [function] (L1382), `reproducirSonido` [function] (L1392), `liberarObjeto3D` [function] (L1492)
- **Funciones**: `crearLienzo` (L30), `formatearColorCss` (L43), `obtenerOCrearTextura` (L57), `obtenerTexturaCespedPlaza` (L84), `obtenerMapasPBRPlaza` (L143), `obtenerTexturaSueloPlaza` (L188), `obtenerTexturaBulevarParque` (L197), `obtenerTexturaCarpaParque` (L256), `obtenerTexturaLetreroNeon` (L282), `obtenerTexturaPlataforma` (L346), `obtenerTexturaPortal` (L368), `obtenerTexturaRostro` (L410), `obtenerTexturaBloqueVoxel` (L533), `obtenerMapasPBRBloqueVoxel` (L649), `crearTexturaBurbujaChat` (L705), `crearCupulaCielo` (L749), `obtenerTexturaPistaKart` (L982), `obtenerTexturaTurboPad` (L1008), `obtenerTexturaMetaDamero` (L1036), `obtenerTexturaNeumatico` (L1052), `obtenerTexturaChasisKart` (L1205), `crearTexturaEtiqueta` (L1329), `obtenerContextoAudio` (L1362), `alternarSilencioAudio` (L1382), `reproducirSonido` (L1392), `liberarObjeto3D` (L1492)
- **Constantes**: `bancoTexturas` (L7), `estadoAudio` (L9), `SLOTS_TEXTURA` (L14)

## `js/red.js`

- **Imports**: `./constantes.js` (L5), `./config.js` (L6), `./estado.js` (L7), `./avatar.js` (L16), `./recursos.js` (L24)
- **Exports**: `listarPerfilesServidor` [function] (L60), `crearPerfilServidor` [function] (L81), `guardarPerfilServidor` [function] (L113), `configurarReceptorEventosExperiencia` [function] (L154), `enviarEstadoJugadorInmediato` [function] (L421), `conectarSalaMultijugador` [function] (L435), `desconectarSalaMultijugador` [function] (L535), `enviarAccionSocial` [function] (L564), `enviarEventoExperiencia` [function] (L579), `enviarCancelacionSalidaKart` [function] (L593), `actualizarRed` [function] (L607)
- **Funciones**: `fetchJsonConTimeout` (L41), `listarPerfilesServidor` (L60), `crearPerfilServidor` (L81), `guardarPerfilServidor` (L113), `configurarReceptorEventosExperiencia` (L154), `upsertJugadorRemoto` (L163), `eliminarJugadorRemoto` (L263), `limpiarJugadoresRemotos` (L275), `procesarMensajeServidor` (L285), `serializarEstadoJugadorLocal` (L397), `enviarEstadoJugadorInmediato` (L421), `conectarSalaMultijugador` (L435), `desconectarSalaMultijugador` (L535), `enviarAccionSocial` (L564), `enviarEventoExperiencia` (L579), `enviarCancelacionSalidaKart` (L593), `actualizarRed` (L607)
