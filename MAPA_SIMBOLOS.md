# MAPA_SIMBOLOS.md

Índice automático de módulos ES6, importaciones, exportaciones, clases, funciones y constantes en `js/**/*.js`.
Total de módulos analizados: **17**

## `js/audio.js`

- **Imports**: `./partituras.js` (L6)
- **Exports**: `desbloquearMusica` [function] (L50), `seleccionarMusicaExperiencia` [function] (L108), `alternarSilencioMusica` [function] (L124), `estaMusicaSilenciada` [function] (L141), `actualizarMusicaAmbiental` [function] (L330)
- **Funciones**: `obtenerBufferRuido` (L32), `desbloquearMusica` (L50), `seleccionarMusicaExperiencia` (L108), `alternarSilencioMusica` (L124), `estaMusicaSilenciada` (L141), `dispararTono` (L154), `reproducirPercusion` (L238), `contarPasosSostenidos` (L317), `actualizarMusicaAmbiental` (L330)

## `js/avatar.js`

- **Imports**: `./constantes.js` (L6), `./recursos.js` (L7)
- **Exports**: `crearAvatar3D` [function] (L75), `actualizarAparienciaAvatar` [function] (L303), `mostrarBurbujaChatAvatar` [function] (L365), `sincronizarAccesoriosAvatar` [function] (L491), `actualizarEtiquetaAvatar` [function] (L521), `actualizarAnimacionAvatar` [function] (L543), `ensamblarKart3D` [function] (L700), `montarAvatarEnKart` [function] (L1253)
- **Funciones**: `elegirColorTorso` (L23), `crearMaterialPlasticoABS` (L36), `crearGeometriaTorsoLEGO` (L50), `crearAvatar3D` (L75), `actualizarAparienciaAvatar` (L303), `mostrarBurbujaChatAvatar` (L365), `construirMallaAccesorio` (L394), `sincronizarAccesoriosAvatar` (L491), `actualizarEtiquetaAvatar` (L521), `actualizarAnimacionAvatar` (L543), `crearPerfilExtruido` (L676), `ensamblarKart3D` (L700), `montarAvatarEnKart` (L1253)
- **Constantes**: `PALETA_TORSOS` (L16)

## `js/config.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `URL_WS_LOCAL` [const] (L6), `URL_WS_PRODUCCION` [const] (L7), `CONFIG_CAMARA` [const] (L9), `esEntornoLocal` [function] (L22), `obtenerUrlWebSocket` [function] (L39), `obtenerUrlHttpServidor` [function] (L60)
- **Funciones**: `esEntornoLocal` (L22), `obtenerUrlWebSocket` (L39), `obtenerUrlHttpServidor` (L60)
- **Constantes**: `URL_WS_LOCAL` (L6), `URL_WS_PRODUCCION` (L7), `CONFIG_CAMARA` (L9)

## `js/constantes.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `DIMENSION_LOBBY` [const] (L6), `MITAD_LOBBY` [const] (L7), `DIMENSION_PARCELA` [const] (L8), `MITAD_PARCELA` [const] (L9), `DIMENSION_PISTA_KARTS` [const] (L10), `MITAD_PISTA_KARTS` [const] (L11), `VUELTAS_CARRERA_KARTS` [const] (L12), `LIMITE_MUNDO` [const] (L13), `ALTURA_CAIDA_VACIO` [const] (L14), `GRAVEDAD_BASE` [const] (L16), `VELOCIDAD_CAMINAR` [const] (L17), `VELOCIDAD_SPRINT` [const] (L18), `FUERZA_SALTO` [const] (L19), `ALTURA_AVATAR` [const] (L20), `RADIO_COLISION_AVATAR` [const] (L21), `DISTANCIA_INTERACCION` [const] (L22), `TASA_ENVIO_HZ` [const] (L24), `INTERVALO_ENVIO_MS` [const] (L25), `XP_BASE_NIVEL` [const] (L27), `MONEDAS_INICIALES` [const] (L28), `COMUN` [const] (L30), `RARO` [const] (L31), `EPICO` [const] (L32), `LEGENDARIO` [const] (L33), `RAREZAS` [const] (L35), `PALETA_AVATAR` [const] (L42), `CATALOGO_BLOQUES` [const] (L49), `CATALOGO_ITEMS` [const] (L60), `CATALOGO_KARTS` [const] (L117), `CATALOGO_PIEZAS_KART` [const] (L160), `CATALOGO_MUNDOS` [const] (L233)
- **Constantes**: `DIMENSION_LOBBY` (L6), `MITAD_LOBBY` (L7), `DIMENSION_PARCELA` (L8), `MITAD_PARCELA` (L9), `DIMENSION_PISTA_KARTS` (L10), `MITAD_PISTA_KARTS` (L11), `VUELTAS_CARRERA_KARTS` (L12), `LIMITE_MUNDO` (L13), `ALTURA_CAIDA_VACIO` (L14), `GRAVEDAD_BASE` (L16), `VELOCIDAD_CAMINAR` (L17), `VELOCIDAD_SPRINT` (L18), `FUERZA_SALTO` (L19), `ALTURA_AVATAR` (L20), `RADIO_COLISION_AVATAR` (L21), `DISTANCIA_INTERACCION` (L22), `TASA_ENVIO_HZ` (L24), `INTERVALO_ENVIO_MS` (L25), `XP_BASE_NIVEL` (L27), `MONEDAS_INICIALES` (L28), `COMUN` (L30), `RARO` (L31), `EPICO` (L32), `LEGENDARIO` (L33), `RAREZAS` (L35), `PALETA_AVATAR` (L42), `CATALOGO_BLOQUES` (L49), `CATALOGO_ITEMS` (L60), `CATALOGO_KARTS` (L117), `CATALOGO_PIEZAS_KART` (L160), `CATALOGO_MUNDOS` (L233)

## `js/estado.js`

- **Imports**: `./constantes.js` (L5)
- **Exports**: `estadoJugador` [const] (L24), `estadoRed` [const] (L55), `estadoSandbox` [const] (L65), `estadoControles` [const] (L72), `suscribirEstado` [function] (L106), `notificarEstado` [function] (L116), `obtenerXpParaSiguienteNivel` [function] (L131), `construirResumenPerfil` [function] (L139), `aplicarDatosPerfil` [function] (L161), `cargarPerfilesLocales` [function] (L284), `restablecerPerfilNuevo` [function] (L320), `guardarEstadoLocal` [function] (L353), `cargarEstadoLocal` [function] (L374), `exportarCodigoPerfil` [function] (L389), `importarCodigoPerfil` [function] (L404)
- **Funciones**: `suscribirEstado` (L106), `notificarEstado` (L116), `obtenerXpParaSiguienteNivel` (L131), `construirResumenPerfil` (L139), `aplicarDatosPerfil` (L161), `cargarPerfilesLocales` (L284), `restablecerPerfilNuevo` (L320), `guardarEstadoLocal` (L353), `cargarEstadoLocal` (L374), `exportarCodigoPerfil` (L389), `importarCodigoPerfil` (L404)
- **Constantes**: `CLAVE_ALMACENAMIENTO` (L15), `CLAVE_PERFILES_LOCALES` (L16), `MAPA_MIGRACION_CHASIS` (L18), `estadoJugador` (L24), `estadoRed` (L55), `estadoSandbox` (L65), `estadoControles` (L72), `suscriptores` (L99)

## `js/experiencias/arenaParkour.js`

- **Imports**: `../constantes.js` (L7), `../estado.js` (L8), `../recursos.js` (L9), `../nucleoSandbox.js` (L15), `../red.js` (L16)
- **Exports**: `ArenaParkour` [class] (L18)
- **Clases**: `ArenaParkour extends ExperienciaBase` (L18)

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

- **Imports**: `./constantes.js` (L5), `./estado.js` (L14), `./recursos.js` (L28), `./audio.js` (L29), `./avatar.js` (L35), `./fisicaSandbox.js` (L41), `./nucleoSandbox.js` (L42), `./red.js` (L43)
- **Exports**: `mostrarNotificacion` [function] (L88), `actualizarHUD` [function] (L709), `inicializarInterfaz` [function] (L1826)
- **Funciones**: `detenerRepeticionTetris` (L65), `el` (L78), `mostrarNotificacion` (L88), `cerrarPanelesFlotantes` (L113), `sincronizarVisibilidadControlesMoviles` (L131), `renderizarResumenJugador` (L143), `cambiarTabMenuUnificado` (L154), `alternarMenuUnificado` (L190), `alternarGarajeKart` (L215), `aplicarCambioApariencia` (L234), `dispararGestoSocial` (L248), `enviarChatRapido` (L258), `ejecutarInteraccion` (L269), `renderizarInventario` (L281), `renderizarEstudioAvatar` (L392), `renderizarHotbarBloques` (L469), `formatearTiempoCarrera` (L529), `renderizarGarajeKart` (L541), `renderizarBannerPodioF1` (L660), `actualizarHUD` (L709), `renderizarOverlayTetris` (L878), `vincularControlesEntrada` (L926), `vincularMenuRobloxYSocial` (L1233), `renderizarWarpMundos` (L1379), `esDispositivoMovilTactil` (L1472), `solicitarPantallaCompletaSeguro` (L1482), `alternarPantallaCompleta` (L1507), `inicializarPantallaBienvenida` (L1530), `inicializarInterfaz` (L1826)

## `js/main.js`

- **Imports**: `./config.js` (L6), `./estado.js` (L7), `./avatar.js` (L14), `./fisicaSandbox.js` (L15), `./nucleoSandbox.js` (L16), `./red.js` (L20), `./audio.js` (L21), `./interfaz.js` (L22), `./experiencias/lobbyCentral.js` (L23)
- **Exports**: `resolverColisionCamara` [function] (L71)
- **Funciones**: `recolectarMallasBloqueantes` (L38), `resolverColisionCamara` (L71), `iniciarSandbox` (L98)
- **Constantes**: `_raycasterCamara` (L25), `_dirCamara` (L26), `_posResueltaCamara` (L27), `_candidatosColisionCamara` (L28), `_objetosIgnoradosCamara` (L29)

## `js/nucleoSandbox.js`

- **Imports**: `./constantes.js` (L5), `./config.js` (L6), `./estado.js` (L7), `./recursos.js` (L15)
- **Exports**: `ExperienciaBase` [class] (L69), `RegistroExperiencias` [const] (L396), `actualizarPortalesFisicos` [function] (L538)
- **Clases**: `ExperienciaBase` (L69)
- **Funciones**: `crearTexturaLetreroPortal` (L30), `actualizarPortalesFisicos` (L538)
- **Constantes**: `RegistroExperiencias` (L396)

## `js/partituras.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `notaAFrecuencia` [function] (L22), `MAPA_MUSICA_EXPERIENCIA` [const] (L52), `CATALOGO_PARTITURAS` [const] (L60)
- **Funciones**: `notaAFrecuencia` (L22), `unirCompases` (L48)
- **Constantes**: `SEMITONOS_BASE` (L7), `MAPA_MUSICA_EXPERIENCIA` (L52), `CATALOGO_PARTITURAS` (L60)

## `js/recursos.js`

- **Imports**: `./constantes.js` (L5)
- **Exports**: `bancoTexturas` [const] (L7), `estadoAudio` [const] (L9), `obtenerTexturaCespedPlaza` [function] (L84), `obtenerMapasPBRPlaza` [function] (L143), `obtenerTexturaSueloPlaza` [function] (L188), `obtenerTexturaBulevarParque` [function] (L197), `obtenerTexturaCarpaParque` [function] (L256), `obtenerTexturaLetreroNeon` [function] (L282), `obtenerTexturaPlataforma` [function] (L346), `obtenerTexturaPortal` [function] (L368), `obtenerTexturaRostro` [function] (L410), `obtenerTexturaBloqueVoxel` [function] (L533), `obtenerMapasPBRBloqueVoxel` [function] (L649), `crearTexturaBurbujaChat` [function] (L705), `crearCupulaCielo` [function] (L749), `obtenerTexturaPistaKart` [function] (L982), `obtenerTexturaTurboPad` [function] (L1008), `obtenerTexturaMetaDamero` [function] (L1036), `obtenerTexturaNeumatico` [function] (L1052), `obtenerTexturaChasisKart` [function] (L1205), `crearTexturaEtiqueta` [function] (L1314), `alternarSilencioAudio` [function] (L1367), `reproducirSonido` [function] (L1377), `liberarObjeto3D` [function] (L1477)
- **Funciones**: `crearLienzo` (L30), `formatearColorCss` (L43), `obtenerOCrearTextura` (L57), `obtenerTexturaCespedPlaza` (L84), `obtenerMapasPBRPlaza` (L143), `obtenerTexturaSueloPlaza` (L188), `obtenerTexturaBulevarParque` (L197), `obtenerTexturaCarpaParque` (L256), `obtenerTexturaLetreroNeon` (L282), `obtenerTexturaPlataforma` (L346), `obtenerTexturaPortal` (L368), `obtenerTexturaRostro` (L410), `obtenerTexturaBloqueVoxel` (L533), `obtenerMapasPBRBloqueVoxel` (L649), `crearTexturaBurbujaChat` (L705), `crearCupulaCielo` (L749), `obtenerTexturaPistaKart` (L982), `obtenerTexturaTurboPad` (L1008), `obtenerTexturaMetaDamero` (L1036), `obtenerTexturaNeumatico` (L1052), `obtenerTexturaChasisKart` (L1205), `crearTexturaEtiqueta` (L1314), `obtenerContextoAudio` (L1347), `alternarSilencioAudio` (L1367), `reproducirSonido` (L1377), `liberarObjeto3D` (L1477)
- **Constantes**: `bancoTexturas` (L7), `estadoAudio` (L9), `SLOTS_TEXTURA` (L14)

## `js/red.js`

- **Imports**: `./constantes.js` (L5), `./config.js` (L6), `./estado.js` (L7), `./avatar.js` (L16), `./recursos.js` (L24)
- **Exports**: `listarPerfilesServidor` [function] (L60), `crearPerfilServidor` [function] (L81), `guardarPerfilServidor` [function] (L113), `configurarReceptorEventosExperiencia` [function] (L154), `enviarEstadoJugadorInmediato` [function] (L421), `conectarSalaMultijugador` [function] (L435), `desconectarSalaMultijugador` [function] (L535), `enviarAccionSocial` [function] (L564), `enviarEventoExperiencia` [function] (L579), `enviarCancelacionSalidaKart` [function] (L593), `actualizarRed` [function] (L607)
- **Funciones**: `fetchJsonConTimeout` (L41), `listarPerfilesServidor` (L60), `crearPerfilServidor` (L81), `guardarPerfilServidor` (L113), `configurarReceptorEventosExperiencia` (L154), `upsertJugadorRemoto` (L163), `eliminarJugadorRemoto` (L263), `limpiarJugadoresRemotos` (L275), `procesarMensajeServidor` (L285), `serializarEstadoJugadorLocal` (L397), `enviarEstadoJugadorInmediato` (L421), `conectarSalaMultijugador` (L435), `desconectarSalaMultijugador` (L535), `enviarAccionSocial` (L564), `enviarEventoExperiencia` (L579), `enviarCancelacionSalidaKart` (L593), `actualizarRed` (L607)
