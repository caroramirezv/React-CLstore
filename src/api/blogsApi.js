import { API_URLS, peticion } from './http';

const BASE = API_URLS.blogs;
const RUTA = '/api/blogs';

/** Más recientes primero. */
export const listarBlogs = () => peticion(BASE, RUTA);

export const obtenerBlog = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`);

export const crearBlog = (blog) => peticion(BASE, RUTA, { method: 'POST', body: blog, auth: true });

export const actualizarBlog = (id, blog) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'PUT', body: blog, auth: true });

export const eliminarBlog = (id) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });

/** Sube la portada de un blog y devuelve su URL pública. */
export async function subirImagenBlog(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const respuesta = await peticion(BASE, `${RUTA}/imagenes`, { method: 'POST', formData, auth: true });
  return respuesta.url;
}
