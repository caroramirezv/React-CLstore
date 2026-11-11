import { API_URLS, peticion } from './http';

const BASE = API_URLS.productos;
const RUTA = '/api/productos';


export const listarProductos = (filtros = {}) => peticion(BASE, RUTA, { params: filtros });

export const obtenerProducto = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`);

export const crearProducto = (producto) => peticion(BASE, RUTA, { method: 'POST', body: producto, auth: true });

export const actualizarProducto = (id, producto) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'PUT', body: producto, auth: true });

export const eliminarProducto = (id) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });


export async function subirImagenProducto(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const respuesta = await peticion(BASE, `${RUTA}/imagenes`, { method: 'POST', formData, auth: true });
  return respuesta.url;
}
