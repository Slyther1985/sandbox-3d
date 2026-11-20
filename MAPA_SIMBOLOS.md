# MAPA_SIMBOLOS.md

Índice automático de módulos ES6, importaciones, exportaciones, clases, funciones y constantes en `js/**/*.js`.
Total de módulos analizados: **14**

## `js/avatar.js`

- **Imports**: `./constantes.js` (L6), `./recursos.js` (L7)
- **Exports**: `crearAvatar3D` [function] (L75), `actualizarAparienciaAvatar` [function] (L303), `mostrarBurbujaChatAvatar` [function] (L365), `sincronizarAccesoriosAvatar` [function] (L491), `actualizarEtiquetaAvatar` [function] (L521), `actualizarAnimacionAvatar` [function] (L543), `ensamblarKart3D` [function] (L674), `montarAvatarEnKart` [function] (L1109)
- **Funciones**: `elegirColorTorso` (L23), `crearMaterialPlasticoABS` (L36), `crearGeometriaTorsoLEGO` (L50), `crearAvatar3D` (L75), `actualizarAparienciaAvatar` (L303), `mostrarBurbujaChatAvatar` (L365), `construirMallaAccesorio` (L394), `sincronizarAccesoriosAvatar` (L491), `actualizarEtiquetaAvatar` (L521), `actualizarAnimacionAvatar` (L543), `ensamblarKart3D` (L674), `montarAvatarEnKart` (L1109)
- **Constantes**: `PALETA_TORSOS` (L16)

## `js/config.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `URL_WS_LOCAL` [const] (L6), `URL_WS_PRODUCCION` [const] (L7), `CONFIG_CAMARA` [const] (L9), `esEntornoLocal` [function] (L22), `obtenerUrlWebSocket` [function] (L39)
- **Funciones**: `esEntornoLocal` (L22), `obtenerUrlWebSocket` (L39)
- **Constantes**: `URL_WS_LOCAL` (L6), `URL_WS_PRODUCCION` (L7), `CONFIG_CAMARA` (L9)

## `js/constantes.js`

- **Imports**: *(ninguno — hoja del DAG)*
- **Exports**: `DIMENSION_LOBBY` [const] (L6), `MITAD_LOBBY` [const] (L7), `DIMENSION_PARCELA` [const] (L8), `MITAD_PARCELA` [const] (L9), `DIMENSION_PISTA_KARTS` [const] (L10), `MITAD_PISTA_KARTS` [const] (L11), `VUELTAS_CARRERA_KARTS` [const] (L12), `LIMITE_MUNDO` [const] (L13), `ALTURA_CAIDA_VACIO` [const] (L14), `GRAVEDAD_BASE` [const] (L16), `VELOCIDAD_CAMINAR` [const] (L17), `VELOCIDAD_SPRINT` [const] (L18), `FUERZA_SALTO` [const] (L19), `ALTURA_AVATAR` [const] (L20), `RADIO_COLISION_AVATAR` [const] (L21), `DISTANCIA_INTERACCION` [const] (L22), `TASA_ENVIO_HZ` [const] (L24), `INTERVALO_ENVIO_MS` [const] (L25), `XP_BASE_NIVEL` [const] (L27), `MONEDAS_INICIALES` [const] (L28), `COMUN` [const] (L30), `RARO` [const] (L31), `EPICO` [const] (L32), `LEGENDARIO` [const] (L33), `RAREZAS` [const] (L35), `PALETA_AVATAR` [const] (L42), `CATALOGO_BLOQUES` [const] (L49), `CATALOGO_ITEMS` [const] (L60), `CATALOGO_KARTS` [const] (L117), `CATALOGO_PIEZAS_KART` [const] (L160)
- **Constantes**: `DIMENSION_LOBBY` (L6), `MITAD_LOBBY` (L7), `DIMENSION_PARCELA` (L8), `MITAD_PARCELA` (L9), `DIMENSION_PISTA_KARTS` (L10), `MITAD_PISTA_KARTS` (L11), `VUELTAS_CARRERA_KARTS` (L12), `LIMITE_MUNDO` (L13), `ALTURA_CAIDA_VACIO` (L14), `GRAVEDAD_BASE` (L16), `VELOCIDAD_CAMINAR` (L17), `VELOCIDAD_SPRINT` (L18), `FUERZA_SALTO` (L19), `ALTURA_AVATAR` (L20), `RADIO_COLISION_AVATAR` (L21), `DISTANCIA_INTERACCION` (L22), `TASA_ENVIO_HZ` (L24), `INTERVALO_ENVIO_MS` (L25), `XP_BASE_NIVEL` (L27), `MONEDAS_INICIALES` (L28), `COMUN` (L30), `RARO` (L31), `EPICO` (L32), `LEGENDARIO` (L33), `RAREZAS` (L35), `PALETA_AVATAR` (L42), `CATALOGO_BLOQUES` (L49), `CATALOGO_ITEMS` (L60), `CATALOGO_KARTS` (L117), `CATALOGO_PIEZAS_KART` (L160)

## `js/estado.js`

- **Imports**: `./constantes.js` (L5)
- **Exports**: `estadoJugador` [const] (L23), `estadoRed` [const] (L52), `estadoSandbox` [const] (L62), `estadoControles` [const] (L69), `suscribirEstado` [function] (L99), `notificarEstado` [function] (L109), `obtenerXpParaSiguienteNivel` [function] (L124), `guardarEstadoLocal` [function] (L254), `cargarEstadoLocal` [function] (L266), `exportarCodigoPerfil` [function] (L281), `importarCodigoPerfil` [function] (L296)
- **Funciones**: `suscribirEstado` (L99), `notificarEstado` (L109), `obtenerXpParaSiguienteNivel` (L124), `construirResumenPerfil` (L132), `aplicarDatosPerfil` (L152), `guardarEstadoLocal` (L254), `cargarEstadoLocal` (L266), `exportarCodigoPerfil` (L281), `importarCodigoPerfil` (L296)
- **Constantes**: `CLAVE_ALMACENAMIENTO` (L15), `MAPA_MIGRACION_CHASIS` (L17), `estadoJugador` (L23), `estadoRed` (L52), `estadoSandbox` (L62), `estadoControles` (L69), `suscriptores` (L92)

## `js/experiencias/arenaTurboKarts.js`

- **Imports**: `../constantes.js` (L8), `../estado.js` (L15), `../recursos.js` (L22), `../avatar.js` (L31), `../nucleoSandbox.js` (L37), `../red.js` (L38)
- **Exports**: `ArenaTurboKarts` [class] (L47)
- **Clases**: `ArenaTurboKarts extends ExperienciaBase` (L47)
- **Constantes**: `ANCHO_PISTA` (L40), `SEGMENTOS_PISTA` (L41), `CENTRO_SALIDA_Z` (L42), `DURACION_CONTEO_SALIDA` (L43), `DURACION_CEREMONIA_PODIO` (L44), `POSICION_PODIO` (L45)

## `js/experiencias/lobbyCentral.js`

- **Imports**: `../constantes.js` (L6), `../estado.js` (L7), `../recursos.js` (L8), `../nucleoSandbox.js` (L16), `../red.js` (L17)
- **Exports**: `LobbyCentral` [class] (L19)
- **Clases**: `LobbyCentral extends ExperienciaBase` (L19)

## `js/experiencias/salaTetris.js`

- **Imports**: `../estado.js` (L6), `../recursos.js` (L13), `../nucleoSandbox.js` (L18), `../red.js` (L19)
- **Exports**: `TOTAL_ASIENTOS_TETRIS` [const] (L21), `COLUMNAS_TETRIS` [const] (L22), `FILAS_VISIBLES_TETRIS` [const] (L23), `FILAS_OCULTAS_TETRIS` [const] (L24), `FILAS_TOTALES_TETRIS` [const] (L25), `PUNTAJES_LINEAS_TETRIS` [const] (L27), `SalaTetris` [class] (L106)
- **Clases**: `SalaTetris extends ExperienciaBase` (L106)
- **Constantes**: `TOTAL_ASIENTOS_TETRIS` (L21), `COLUMNAS_TETRIS` (L22), `FILAS_VISIBLES_TETRIS` (L23), `FILAS_OCULTAS_TETRIS` (L24), `FILAS_TOTALES_TETRIS` (L25), `PUNTAJES_LINEAS_TETRIS` (L27), `PASO_CELDA_3D` (L34), `CENTRO_Y_TABLERO_3D` (L35), `PIEZAS_TETRIS` (L37), `TIPOS_PIEZAS` (L103), `INDICES_COLOR` (L104)

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

- **Imports**: `./constantes.js` (L5), `./estado.js` (L13), `./recursos.js` (L24), `./avatar.js` (L25), `./fisicaSandbox.js` (L31), `./nucleoSandbox.js` (L32), `./red.js` (L33)
- **Exports**: `mostrarNotificacion` [function] (L57), `actualizarHUD` [function] (L481), `inicializarInterfaz` [function] (L1041)
- **Funciones**: `el` (L48), `mostrarNotificacion` (L57), `cerrarPanelesFlotantes` (L75), `alternarGarajeKart` (L96), `alternarEstudioAvatar` (L116), `aplicarCambioApariencia` (L135), `dispararGestoSocial` (L149), `enviarChatRapido` (L159), `ejecutarInteraccion` (L170), `renderizarInventario` (L182), `renderizarEstudioAvatar` (L270), `renderizarHotbarBloques` (L347), `formatearTiempoCarrera` (L407), `renderizarGarajeKart` (L419), `actualizarHUD` (L481), `renderizarOverlayTetris` (L623), `vincularControlesEntrada` (L662), `vincularMenuRadialYSocial` (L903), `inicializarInterfaz` (L1041)

## `js/main.js`

- **Imports**: `./config.js` (L6), `./estado.js` (L7), `./avatar.js` (L13), `./fisicaSandbox.js` (L14), `./nucleoSandbox.js` (L15), `./red.js` (L19), `./interfaz.js` (L20), `./experiencias/lobbyCentral.js` (L21), `./experiencias/zonaConstruccion.js` (L22), `./experiencias/arenaTurboKarts.js` (L23), `./experiencias/salaTetris.js` (L24)
- **Funciones**: `iniciarSandbox` (L26)

## `js/nucleoSandbox.js`

- **Imports**: `./constantes.js` (L5), `./estado.js` (L6), `./recursos.js` (L13)
- **Exports**: `ExperienciaBase` [class] (L67), `RegistroExperiencias` [const] (L364), `actualizarPortalesFisicos` [function] (L445)
- **Clases**: `ExperienciaBase` (L67)
- **Funciones**: `crearTexturaLetreroPortal` (L28), `actualizarPortalesFisicos` (L445)
- **Constantes**: `RegistroExperiencias` (L364)

## `js/recursos.js`

- **Imports**: `./constantes.js` (L5)
- **Exports**: `bancoTexturas` [const] (L7), `estadoAudio` [const] (L9), `obtenerTexturaCespedPlaza` [function] (L84), `obtenerMapasPBRPlaza` [function] (L143), `obtenerTexturaSueloPlaza` [function] (L188), `obtenerTexturaPlataforma` [function] (L197), `obtenerTexturaPortal` [function] (L219), `obtenerTexturaRostro` [function] (L261), `obtenerTexturaBloqueVoxel` [function] (L384), `obtenerMapasPBRBloqueVoxel` [function] (L500), `crearTexturaBurbujaChat` [function] (L556), `crearCupulaCielo` [function] (L600), `obtenerTexturaPistaKart` [function] (L833), `obtenerTexturaTurboPad` [function] (L859), `obtenerTexturaMetaDamero` [function] (L887), `obtenerTexturaNeumatico` [function] (L903), `obtenerTexturaChasisKart` [function] (L1056), `crearTexturaEtiqueta` [function] (L1180), `alternarSilencioAudio` [function] (L1233), `reproducirSonido` [function] (L1243), `liberarObjeto3D` [function] (L1343)
- **Funciones**: `crearLienzo` (L30), `formatearColorCss` (L43), `obtenerOCrearTextura` (L57), `obtenerTexturaCespedPlaza` (L84), `obtenerMapasPBRPlaza` (L143), `obtenerTexturaSueloPlaza` (L188), `obtenerTexturaPlataforma` (L197), `obtenerTexturaPortal` (L219), `obtenerTexturaRostro` (L261), `obtenerTexturaBloqueVoxel` (L384), `obtenerMapasPBRBloqueVoxel` (L500), `crearTexturaBurbujaChat` (L556), `crearCupulaCielo` (L600), `obtenerTexturaPistaKart` (L833), `obtenerTexturaTurboPad` (L859), `obtenerTexturaMetaDamero` (L887), `obtenerTexturaNeumatico` (L903), `obtenerTexturaChasisKart` (L1056), `crearTexturaEtiqueta` (L1180), `obtenerContextoAudio` (L1213), `alternarSilencioAudio` (L1233), `reproducirSonido` (L1243), `liberarObjeto3D` (L1343)
- **Constantes**: `bancoTexturas` (L7), `estadoAudio` (L9), `SLOTS_TEXTURA` (L14)

## `js/red.js`

- **Imports**: `./constantes.js` (L5), `./config.js` (L6), `./estado.js` (L7), `./avatar.js` (L14), `./recursos.js` (L22)
- **Exports**: `configurarReceptorEventosExperiencia` [function] (L33), `enviarEstadoJugadorInmediato` [function] (L292), `conectarSalaMultijugador` [function] (L306), `desconectarSalaMultijugador` [function] (L367), `enviarAccionSocial` [function] (L391), `enviarEventoExperiencia` [function] (L406), `actualizarRed` [function] (L421)
- **Funciones**: `configurarReceptorEventosExperiencia` (L33), `upsertJugadorRemoto` (L42), `eliminarJugadorRemoto` (L142), `limpiarJugadoresRemotos` (L154), `procesarMensajeServidor` (L164), `serializarEstadoJugadorLocal` (L268), `enviarEstadoJugadorInmediato` (L292), `conectarSalaMultijugador` (L306), `desconectarSalaMultijugador` (L367), `enviarAccionSocial` (L391), `enviarEventoExperiencia` (L406), `actualizarRed` (L421)
