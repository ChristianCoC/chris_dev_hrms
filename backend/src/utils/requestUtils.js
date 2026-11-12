/**
 * Utilidades para manejo y extracción segura de datos de peticiones HTTP.
 */

/**
 * Obtiene la dirección IP real del cliente considerando proxies inversos.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export const getClientIp = (req) => {
  if (!req) return null;
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    return typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : Array.isArray(forwarded)
      ? forwarded[0].trim()
      : null;
  }
  return req.socket?.remoteAddress || req.ip || null;
};

/**
 * Sanitiza una cadena eliminando espacios exteriores o devolviendo null si está vacía.
 * @param {any} val
 * @returns {string|null}
 */
export const sanitizeString = (val) => {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Valida si un texto cumple con límites de longitud.
 * @param {string} str
 * @param {number} max
 * @param {number} [min=0]
 * @returns {boolean}
 */
export const isValidLength = (str, max, min = 0) => {
  if (typeof str !== 'string') return false;
  const len = str.trim().length;
  return len >= min && len <= max;
};
