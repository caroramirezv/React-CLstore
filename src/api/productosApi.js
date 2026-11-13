import { API_URLS, peticion } from './http';

const BASE = API_URLS.productos;
const RUTA = '/api/productos';

/**
 * Lista productos. Todos los filtros son opcionales y combinables:
 *   { categoria, q, oferta: true, excluir: id, orden, limit }
 *   orden: 'nombre' | 'creado_asc' | 'creado_desc' | 'descuento_desc'
 */
export const listarProductos = (filtros = {}) => peticion(BASE, RUTA, { params: filtros });

export const obtenerProducto = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`);

export const crearProducto = (producto) => peticion(BASE, RUTA, { method: 'POST', body: producto, auth: true });

export const actualizarProducto = (id, producto) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'PUT', body: producto, auth: true });

export const eliminarProducto = (id) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });

/** Sube la foto de un producto y devuelve su URL pública. */
export async function subirImagenProducto(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const respuesta = await peticion(BASE, `${RUTA}/imagenes`, { method: 'POST', formData, auth: true });
  return respuesta.url;
}
