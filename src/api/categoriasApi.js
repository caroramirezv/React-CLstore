import { API_URLS, peticion } from './http';

const BASE = API_URLS.categorias;
const RUTA = '/api/categorias';

/** Devuelve [{ valor, etiqueta, icono }] ordenadas por etiqueta. */
export const listarCategorias = () => peticion(BASE, RUTA);

/** Al crear solo se envía { etiqueta, icono? }: el "valor" (slug) lo genera el servicio. */
export const crearCategoria = (categoria) => peticion(BASE, RUTA, { method: 'POST', body: categoria, auth: true });

/** Solo se pueden editar etiqueta e icono; el "valor" nunca cambia. */
export const actualizarCategoria = (valor, categoria) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(valor)}`, { method: 'PUT', body: categoria, auth: true });

/** Responde 409 si la categoría todavía tiene productos. */
export const eliminarCategoria = (valor) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(valor)}`, { method: 'DELETE', auth: true });
