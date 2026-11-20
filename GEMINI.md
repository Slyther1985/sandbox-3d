# GEMINI.md — Constitución del Proyecto Sandbox 3D

Plataforma Sandbox 3D multijugador en navegador (estilo Roblox) construida con Three.js r128, módulos ES6 nativos, Web Audio API, Node.js + WebSockets (`ws`) y lista para Azure Static Web Apps + Azure Container Apps.

## 1. Reglas Arquitectónicas No Negociables

1. **Grafo Acíclico Dirigido (DAG ES6)**: Prohibidas las dependencias circulares entre módulos `js/**/*.js`. Jerarquía estricta:
   - Nivel 0 (hojas): `constantes.js`, `config.js`
   - Nivel 1: `estado.js`, `recursos.js`
   - Nivel 2: `avatar.js`, `nucleoSandbox.js`, `fisicaSandbox.js`, `red.js`
   - Nivel 3 (experiencias): `js/experiencias/*.js` (`lobbyCentral.js`, `zonaConstruccion.js`, `arenaTurboKarts.js`, `salaTetris.js`)
   - Nivel 4: `interfaz.js`, `main.js`
2. **Limpieza Obligatoria de GPU (`liberarObjeto3D`)**: Todo módulo que desmonte una escena, avatar, cúpula de cielo (`crearCupulaCielo(tema)`) o entidad dinámica debe llamar a `liberarObjeto3D(objeto)` desde `js/recursos.js`. Toda textura dinámica por instancia debe marcarse con `userData.esClonTemporal = true`.
3. **Resiliencia Offline/Online y Persistencia de Sala**: El cliente es jugable sin servidor (`modo: 'offline'`) con respaldo local (`construccionGuardada`). Al conectarse a `SALA-XXXX`, `server/index.js` persiste parcelas en `server/data/parcelas.json`, envía `estado_parcela_completo` y asigna `slotParrilla` (`0..7`) único vía `sala_actualizada`.
4. **Rendimiento, Iluminación PBR y Red**: Renderizado PBR a 60 FPS (`ACESFilmicToneMapping`, `dt` acotado a `0.05s`), avatares LEGO Minifigure (`MeshPhysicalMaterial`), karts superhéroe/competición (`kart_batmovil`, `kart_formula`, `kart_lemans`, `kart_tumbler` a 120 pts + `pesoImpacto`) con texturas PBR de chasis/neumáticos, colisiones kart-a-kart y sincronización a 20 Hz (`TASA_ENVIO_HZ = 20`) más `accion_social`.
5. **UI Responsiva y Vistas en Vivo 3D**: HUD minimalista superior, Menú Radial Dona (`#btn-menu-dona` / `Tab`), popover colapsable de bloques (`#btn-toggle-bloques` / `KeyB`), garaje lateral translúcido Kart (`#popover-kart` / `KeyG`, GP 160x160 m, Paddock, parrilla `P1–P8` 10s, podio 12s), salón Tetris 3D (`salaTetris.js`, 8 estaciones individuales con TV Gigante 3D 10x20 y HUD transparente), controles táctiles (`#controles-moviles`) y vistas de cámara (`modoPreviewAvatar`, `garajeKartAbierto`, `modoCeremoniaPodio`, `modoTetrisActivo`).

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
  `{ id, apodo, monedas, nivel, xp, inventario: [], equipado: { cabeza, espalda, aura }, apariencia: { piel, torso, piernas, rostro }, construccionGuardada: [], configKart: { chasis, ruedas, aleron, color }, mejorVueltaKart: null, mejorPuntajeTetris: 0, posicion: { x, y, z }, rotacion, enVehiculo: false, experienciaActiva: 'lobby' }`
- **`estadoRed`**:
  `{ conectado: false, modo: 'offline', codigoSala: null, esAnfitrion: false, slotParrilla: 0, bloquesSala: null, jugadoresRemotos: Map }`
- **`estadoSandbox`**:
  `{ experienciaActual: null, portalesActivos: [], entidadesInteractivas: [], colisionadoresEstaticos: [] }`

## 4. Contrato de IDs del DOM (`index.html` ↔ `js/interfaz.js`)

| Categoría | IDs Canónicos |
|---|---|
| Renderizado | `lienzo-3d` |
| HUD Compacto | `hud-superior`, `hud-apodo`, `hud-nivel`, `hud-xp-barra`, `hud-monedas`, `hud-experiencia`, `indicador-estado-red`, `btn-audio` |
| Menú Dona y Social | `btn-menu-dona`, `menu-dona-overlay`, `btn-cerrar-dona`, `dona-btn-avatar`, `dona-btn-inventario`, `dona-btn-gestos`, `dona-btn-chat`, `dona-btn-sala`, `panel-gestos-dona`, `btn-cerrar-gestos`, `btn-gesto-saludar`, `btn-gesto-bailar`, `btn-gesto-celebrar`, `btn-gesto-sentarse`, `panel-chat-rapido`, `btn-cerrar-chat`, `input-chat-rapido`, `btn-enviar-chat` |
| Panel Red / Warp | `panel-red`, `btn-cerrar-red`, `input-apodo`, `input-codigo-sala`, `btn-conectar-sala`, `btn-desconectar-sala`, `contador-jugadores`, `btn-warp-lobby`, `btn-warp-construccion`, `btn-warp-karts`, `btn-warp-tetris` |
| Inventario / Avisos | `modal-inventario`, `btn-cerrar-inventario`, `lista-inventario`, `aviso-interaccion`, `contenedor-notificaciones` |
| Estudio Avatar | `modal-avatar`, `btn-cerrar-avatar`, `selector-piel`, `selector-torso`, `selector-piernas`, `selector-rostro`, `selector-accesorios-avatar`, `input-codigo-perfil`, `btn-exportar-perfil`, `btn-importar-perfil` |
| Construcción Voxel | `btn-toggle-bloques`, `muestra-bloque-activo`, `texto-btn-bloques`, `popover-bloques`, `hotbar-bloques`, `lista-bloques-hotbar`, `btn-modo-construccion`, `btn-guardar-parcela`, `btn-limpiar-parcela` |
| Arena Turbo Karts | `hud-karts`, `kart-velocidad`, `kart-checkpoints`, `kart-tiempo-actual`, `kart-mejor-vuelta`, `banner-conteo-karts`, `lista-ranking-karts`, `btn-toggle-kart`, `popover-kart`, `selector-kart-chasis`, `selector-kart-ruedas`, `selector-kart-aleron`, `selector-kart-color`, `barra-stat-vel`, `barra-stat-acel`, `barra-stat-ctrl` |
| Sala Tetris Arcade | `pantalla-tetris-fullscreen`, `canvas-tetris-hold`, `canvas-tetris-siguientes`, `tetris-puntaje`, `tetris-nivel`, `tetris-lineas`, `tetris-mejor-puntaje`, `tetris-butaca-actual`, `lista-ranking-tetris`, `overlay-tetris-gameover`, `btn-tetris-reiniciar`, `btn-tetris-levantarse`, `btn-tetris-izq`, `btn-tetris-der`, `btn-tetris-rotar`, `btn-tetris-bajar`, `btn-tetris-caida`, `btn-tetris-hold` |
| Móvil | `controles-moviles`, `zona-joystick`, `palanca-joystick`, `btn-movil-saltar`, `btn-movil-accion`, `btn-movil-sprint` |
