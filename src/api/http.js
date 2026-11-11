import { obtenerToken } from './token';

const sinBarraFinal = (url) => url.replace(/\/+$/, '');

// URL base de cada microservicio (configurable en .env con las variables VITE_API_*).
export const API_URLS = {
  productos: sinBarraFinal(import.meta.env.VITE_API_PRODUCTOS_URL || 'http://localhost:8081'),
  categorias: sinBarraFinal(import.meta.env.VITE_API_CATEGORIAS_URL || 'http://localhost:8082'),
  blogs: sinBarraFinal(import.meta.env.VITE_API_BLOGS_URL || 'http://localhost:8083'),
};

export class ApiError extends Error {
  constructor(message, status = 0, errores = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status; 
    this.errores = errores; 
  }
}

const MENSAJES_POR_ESTADO = {
  401: 'Tu sesión no es válida o expiró. Vuelve a iniciar sesión.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  413: 'El archivo es demasiado grande.',
};

function mensajeDeError(estado, datos) {
  if (datos && typeof datos.detail === 'string' && datos.detail) return datos.detail;
  return MENSAJES_POR_ESTADO[estado] || `Error inesperado del servidor (${estado}).`;
}

/**
 * Llamada HTTP a un microservicio.
 * @param {string} baseUrl  una de API_URLS
 * @param {string} ruta     por ejemplo "/api/productos"
 * @param {object} opciones { method, params, body, formData, auth }
 *   - params:   query string; se omiten los valores vacíos (undefined, null, '')
 *   - body:     objeto que se envía como JSON
 *   - formData: FormData (subida de archivos)
 *   - auth:     true en escrituras: agrega "Authorization: Bearer <token>"
 * @returns el JSON de la respuesta, o null si no trae cuerpo (204).
 * @throws {ApiError}
 */

export async function peticion(baseUrl, ruta, { method = 'GET', params, body, formData, auth = false } = {}) {
  const origen = typeof window !== 'undefined' ? window.location.origin : undefined;
  const url = new URL(baseUrl + ruta, origen);
  if (params) {
    Object.entries(params).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
    });
  }

  const headers = { Accept: 'application/json' };
  if (auth) {
    const token = obtenerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let cuerpo;
  if (formData) {
    cuerpo = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    cuerpo = JSON.stringify(body);
  }

  let respuesta;
  try {
    respuesta = await fetch(url, { method, headers, body: cuerpo });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Comprueba que el microservicio esté en ejecución.', 0);
  }

  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    throw new ApiError(mensajeDeError(respuesta.status, datos), respuesta.status, datos?.errores ?? null);
  }
  return datos;
}

export function aResultado(promesa) {
  return Promise.resolve(promesa).then(
    (data) => ({ data, error: null }),
    (error) => ({ data: null, error })
  );
}
