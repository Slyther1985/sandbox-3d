/**
 * Configuración de entorno y parámetros generales del cliente.
 * Módulo hoja del DAG (sin dependencias).
 */

export const URL_WS_LOCAL = 'ws://localhost:8080';
export const URL_WS_PRODUCCION = 'wss://ca-sandbox-ws.gentlebush.azurecontainerapps.io';

export const CONFIG_CAMARA = Object.freeze({
    fov: 60,
    cerca: 0.1,
    lejos: 250,
    distancia: 8.5,
    altura: 4.2,
    sensibilidad: 0.004
});

/**
 * Determina si el cliente se ejecuta en entorno local de desarrollo.
 * @returns {boolean}
 */
export function esEntornoLocal() {
    if (typeof window === 'undefined' || !window.location) {
        return true;
    }
    const { hostname, protocol } = window.location;
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '' ||
        protocol === 'file:'
    );
}

/**
 * Resuelve la URL del servidor WebSocket según entorno o parámetro de URL.
 * @returns {string}
 */
export function obtenerUrlWebSocket() {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search || '');
        const wsOverride = params.get('ws');
        if (wsOverride) {
            return wsOverride;
        }
        if (esEntornoLocal()) {
            return URL_WS_LOCAL;
        }
        if (window.SANDBOX_WS_URL) {
            return window.SANDBOX_WS_URL;
        }
    }
    return URL_WS_PRODUCCION;
}
