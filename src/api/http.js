import { obtenerToken, borrarToken } from './token';

const sinBarraFinal = (url) => url.replace(/\/+$/, '');

export const API_URLS = {
  productos: sinBarraFinal(import.meta.env.VITE_API_PRODUCTOS_URL || 'http://localhost:8081'),
  categorias: sinBarraFinal(import.meta.env.VITE_API_CATEGORIAS_URL || 'http://localhost:8082'),
  blogs: sinBarraFinal(import.meta.env.VITE_API_BLOGS_URL || 'http://localhost:8083'),
  usuarios: sinBarraFinal(import.meta.env.VITE_API_USUARIOS_URL || 'http://localhost:8084'),
  carrito: sinBarraFinal(import.meta.env.VITE_API_CARRITO_URL || 'http://localhost:8085'),
  ordenes: sinBarraFinal(import.meta.env.VITE_API_ORDENES_URL || 'http://localhost:8086'),
  resenas: sinBarraFinal(import.meta.env.VITE_API_RESENAS_URL || 'http://localhost:8087'),
  contacto: sinBarraFinal(import.meta.env.VITE_API_CONTACTO_URL || 'http://localhost:8088'),
};

export class ApiError extends Error {
  constructor(message, status = 0, errores = null, datos = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status; 
    this.errores = errores; 
    this.datos = datos; 
  }
}

let alExpirarSesion = null;
export function registrarManejadorSesionExpirada(manejador) {
  alExpirarSesion = manejador;
  return () => {
    if (alExpirarSesion === manejador) alExpirarSesion = null;
  };
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
    if (respuesta.status === 401 && headers.Authorization) {
      borrarToken();
      if (alExpirarSesion) alExpirarSesion();
    }
    throw new ApiError(mensajeDeError(respuesta.status, datos), respuesta.status, datos?.errores ?? null, datos);
  }
  return datos;
}

export function aResultado(promesa) {
  return Promise.resolve(promesa).then(
    (data) => ({ data, error: null }),
    (error) => ({ data: null, error })
  );
}
