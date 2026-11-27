# GEMINI.md — Constitución del Proyecto Sandbox 3D

Plataforma Sandbox 3D multijugador en navegador (estilo Roblox) construida con Three.js r128, módulos ES6 nativos, Web Audio API, Node.js + WebSockets (`ws`) y lista para Azure Static Web Apps + Azure Container Apps.

## 1. Reglas Arquitectónicas No Negociables

1. **Grafo Acíclico Dirigido (DAG ES6)**: Prohibidas las dependencias circulares entre módulos `js/**/*.js` (17 módulos). Jerarquía estricta:
   - Nivel 0 (hojas): `constantes.js`, `config.js`, `partituras.js`
   - Nivel 1: `estado.js`, `recursos.js`, `audio.js`
   - Nivel 2: `avatar.js`, `nucleoSandbox.js`, `fisicaSandbox.js`, `red.js`
   - Nivel 3 (experiencias): `js/experiencias/*.js` (`lobbyCentral.js`, `zonaConstruccion.js`, `arenaTurboKarts.js`, `salaTetris.js`, `arenaParkour.js`)
   - Nivel 4: `interfaz.js`, `main.js`
2. **Limpieza Obligatoria de GPU (`liberarObjeto3D`)**: Todo módulo que desmonte una escena, avatar, cúpula de cielo (`crearCupulaCielo(tema)`) o entidad dinámica debe llamar a `liberarObjeto3D(objeto)` desde `js/recursos.js`. Toda textura dinámica por instancia debe marcarse con `userData.esClonTemporal = true`.
3. **Resiliencia Offline/Online y Persistencia de Sala**: El cliente es jugable sin servidor (`modo: 'offline'`) con respaldo local (`construccionGuardada`). Al confirmar perfil único (sin PIN) en `#pantalla-bienvenida`, se conecta por defecto a `'SALA-PUBLICA'`. `server/index.js` persiste parcelas en `server/data/parcelas.json` y perfiles únicos (clave normalizada sin duplicados) en `server/data/perfiles.json`, envía `estado_parcela_completo` y asigna `slotParrilla` (`0..7`) único vía `sala_actualizada`.
4. **Rendimiento PBR, Red y Audio 16-Bit**: Renderizado PBR a 60 FPS (`ACESFilmicToneMapping`, `dt` acotado a `0.05s`), Parque Estelar de 130×130 m (`DIMENSION_LOBBY = 130`) con Rueda de la Fortuna animada y 3 pabellones temáticos, superdeportivos open-cockpit 120 pts esculpidos con `ExtrudeGeometry` y laca `clearcoat` (`kart_batmovil`/`formula`/`lemans`/`tumbler`), salida abortable a 10 s (`cancelar_salida_kart`), sincronización 20 Hz y motor musical 16-bit multi-pista (`js/partituras.js` + `js/audio.js` con eco SPC700).
5. **UI Roblox, Switch Tetris, F1 Broadcast, PWA Landscape y Cámaras Anti-Colisión**: Viewport `100dvw`/`100dvh`, `manifest.json` (`display: "fullscreen"`, `orientation: "landscape"`), HUD minimalista estilo Roblox en esquinas superiores (`#btn-hud-menu` / `Tab`, `#btn-hud-chat`, `#btn-hud-gestos`, `#btn-musica` / `KeyM`, `#btn-pantalla-completa`), Menú Principal Unificado de 4 pestañas (`#menu-principal-unificado` con dock lateral Avatar 3D encuadrado a la izquierda y `#filtros-mochila` en rejilla densa), toast único superior, `#banner-conteo-kart` con `#btn-cancelar-salida`, lower-third `#banner-podio-f1`, `#popover-kart` carrusel sin scroll, layout Switch 3 columnas en `#pantalla-tetris-fullscreen` con cruceta DAS/ARR sin scroll y `#aviso-interaccion` oculto al jugar, joystick flotante dinámico (`#zona-joystick-dinamico`, zona muerta 12%, auto-sprint >85%), cámara táctil derecha simultánea, `#aviso-girar-pantalla`, `obtenerConfigCamara()` y brazo resorte universal `resolverColisionCamara()`.

## 2. Protocolo de Creación de Nuevos Minijuegos (Experiencias)

Para agregar un minijuego nuevo **sin modificar el núcleo ni el servidor**:
1. Crear `js/experiencias/<nombre>.js`.
2. Exportar una clase que herede de `ExperienciaBase` (`import { ExperienciaBase } from '../nucleoSandbox.js';`).
3. Implementar los métodos del ciclo de vida:
   - `montar(escena, contextoSandbox)`: llamar `super.montar(...)`, construir mallas dentro de `this.grupoRaiz`, registrar colisionadores (`this.registrarColisionadorCaja(...)`) y entidades (`this.registrarEntidadInteractiva(...)`).
   - `actualizar(dt, contextoSandbox)`: lógica por frame (60 FPS).
   - `alInteractuar(jugador, entidad)`: respuesta a `KeyE` o botón móvil de acción.
   - `desmontar(escena)`: llamar explícitamente a `liberarObjeto3D(this.grupoRaiz)` y luego `super.desmontar(escena)`.
4. Economía y multijugador genérico:
   - Otorgar monedas/XP/ítems únicamente vía `this.otorgarRecompensa(monedas, xp, itemId)`.
   - Sincronizar eventos propios mediante `enviarEventoExperiencia(subtipo, datos)` y recibirlos en `alEventoRed(evento)`.
5. Registrar la instancia en `RegistroExperiencias.registrarExperiencia(new MiExperiencia())` y enlazar un portal 3D con `crearPortalFisico3D(...)`.
6. Regenerar mapa y verificar: `node generar_mapa.mjs && node verify_project.mjs`.

## 3. Esquemas Canónicos de Estado (`js/estado.js`)

- **`estadoJugador`**:
  `{ id, apodo, monedas, nivel, xp, inventario: [], equipado: { cabeza, espalda, aura }, apariencia: { piel, torso, piernas, rostro }, construccionGuardada: [], configKart: { chasis, ruedas, aleron, color }, mejorVueltaKart: null, mejorPuntajeTetris: 0, favoritosMundos: [], progresoExperiencias: {}, posicion: { x, y, z }, rotacion, enVehiculo: false, experienciaActiva: 'lobby' }`
- **`estadoRed`**:
  `{ conectado: false, modo: 'offline', codigoSala: null, esAnfitrion: false, slotParrilla: 0, bloquesSala: null, jugadoresRemotos: Map }`
- **`estadoSandbox`**:
  `{ experienciaActual: null, portalesActivos: [], entidadesInteractivas: [], colisionadoresEstaticos: [] }`

## 4. Contrato de IDs del DOM (`index.html` ↔ `js/interfaz.js`)

| Categoría | IDs Canónicos |
|---|---|
| Renderizado | `lienzo-3d` |
| Bienvenida y PWA | `pantalla-bienvenida`, `tab-perfil-existente`, `tab-perfil-nuevo`, `panel-perfil-existente`, `panel-perfil-nuevo`, `estado-carga-perfiles`, `btn-recargar-perfiles`, `lista-perfiles-existentes`, `btn-entrar-parque`, `input-nuevo-apodo`, `btn-crear-jugador`, `mensaje-error-bienvenida`, `btn-pantalla-completa` |
| HUD Barra Roblox | `hud-superior`, `btn-hud-menu`, `btn-hud-chat`, `btn-hud-gestos`, `hud-monedas`, `hud-nivel`, `btn-musica`, `btn-pantalla-completa`, `panel-gestos`, `btn-cerrar-gestos`, `btn-gesto-saludar`, `btn-gesto-bailar`, `btn-gesto-celebrar`, `btn-gesto-sentarse`, `panel-chat-rapido`, `btn-cerrar-chat`, `input-chat-rapido`, `btn-enviar-chat` |
| Menú Unificado (4 Tabs) | `menu-principal-unificado`, `btn-cerrar-menu-unificado`, `tab-menu-sala`, `tab-menu-avatar`, `tab-menu-mochila`, `tab-menu-jugador`, `panel-menu-sala`, `panel-menu-avatar`, `panel-menu-mochila`, `panel-menu-jugador`, `indicador-estado-red`, `contador-jugadores`, `hud-experiencia`, `input-apodo`, `input-codigo-sala`, `btn-conectar-sala`, `btn-desconectar-sala`, `lista-warp-mundos`, `input-buscar-mundo`, `filtros-mundos`, `contador-mundos` |
| Avatar / Mochila / Jugador | `selector-piel`, `selector-torso`, `selector-piernas`, `selector-rostro`, `selector-accesorios-avatar`, `filtros-mochila`, `contador-mochila`, `lista-inventario`, `hud-apodo`, `hud-xp-barra`, `btn-audio`, `btn-cambiar-jugador`, `jugador-record-kart`, `jugador-record-tetris`, `input-codigo-perfil`, `btn-exportar-perfil`, `btn-importar-perfil` |
| Avisos | `aviso-interaccion`, `contenedor-notificaciones`, `aviso-girar-pantalla`, `btn-cerrar-girar-pantalla` |
| Construcción Voxel | `btn-toggle-bloques`, `muestra-bloque-activo`, `texto-btn-bloques`, `popover-bloques`, `hotbar-bloques`, `lista-bloques-hotbar`, `btn-modo-construccion`, `btn-guardar-parcela`, `btn-limpiar-parcela` |
| Arena Turbo Karts | `hud-karts`, `kart-velocidad`, `kart-checkpoints`, `kart-tiempo-actual`, `kart-mejor-vuelta`, `banner-conteo-kart`, `texto-conteo-kart`, `btn-cancelar-salida`, `banner-podio-f1`, `podio-f1-temporizador`, `podio-f1-lista`, `podio-f1-vuelta-rapida`, `lista-ranking-karts`, `btn-toggle-kart`, `popover-kart`, `selector-kart-chasis`, `selector-kart-ruedas`, `selector-kart-aleron`, `selector-kart-color`, `barra-stat-vel`, `barra-stat-acel`, `barra-stat-ctrl`, `valor-stat-vel`, `valor-stat-acel`, `valor-stat-ctrl` |
| Sala Tetris Arcade | `pantalla-tetris-fullscreen`, `canvas-tetris-hold`, `canvas-tetris-siguientes`, `tetris-puntaje`, `tetris-nivel`, `tetris-lineas`, `tetris-mejor-puntaje`, `tetris-butaca-actual`, `lista-ranking-tetris`, `overlay-tetris-gameover`, `btn-tetris-reiniciar`, `btn-tetris-levantarse`, `btn-tetris-izq`, `btn-tetris-der`, `btn-tetris-rotar`, `btn-tetris-bajar`, `btn-tetris-caida`, `btn-tetris-hold` |
| Móvil | `controles-moviles`, `zona-joystick-dinamico`, `base-joystick-dinamico`, `palanca-joystick`, `btn-movil-saltar`, `btn-movil-accion`, `btn-movil-sprint` |
