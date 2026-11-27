---
name: sandbox-scaling
description: Reglas y flujo eficiente para escalar el proyecto Sandbox 3D (DAG ES6, menús data-driven, lazy-loading de salas, limpieza GPU y verificación).
---

# Sandbox 3D — Guía de Escalamiento

## Reglas no negociables
1. **DAG ES6 estricto** (sin dependencias circulares):
   - Nivel 0: `constantes.js`, `config.js`, `partituras.js`
   - Nivel 1: `estado.js`, `recursos.js`, `audio.js`
   - Nivel 2: `avatar.js`, `nucleoSandbox.js`, `fisicaSandbox.js`, `red.js`
   - Nivel 3: `js/experiencias/*.js`
   - Nivel 4: `interfaz.js`, `main.js`
2. **Limpieza GPU obligatoria**: toda experiencia debe llamar `liberarObjeto3D(this.grupoRaiz)` en `desmontar()` y usar `crearCupulaCielo(...)` en `montar()`.
3. **No modificar núcleo ni servidor para salas nuevas**: usar `ExperienciaBase`, `otorgarRecompensa()`, `enviarEventoExperiencia()` y `alEventoRed()`.
4. **Estado por sala**: guardar récords/progreso en `estadoJugador.progresoExperiencias[idSala]`.

## Protocolo para añadir una nueva sala (3 pasos)
1. Crear `js/experiencias/<nombre>.js` extendiendo `ExperienciaBase` (`montar`, `actualizar`, `alInteractuar`, `alEventoRed`, `desmontar`).
2. Añadir su metadata a `CATALOGO_MUNDOS` en `js/constantes.js`.
3. Registrar su cargador lazy en `js/main.js` vía `RegistroExperiencias.registrarCargador(id, async () => ...)`.

## Verificación obligatoria tras cambios
```bash
node generar_mapa.mjs && node verify_project.mjs
```
