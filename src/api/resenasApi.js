import { API_URLS, peticion } from './http';

const BASE = API_URLS.resenas;
const RUTA = '/api/resenas';

/** Reseñas de un producto, más recientes primero. Público. */
export const listarResenas = (productoId) => peticion(BASE, RUTA, { params: { producto_id: productoId } });

/** Requiere sesión; el autor es el del token. resena: { producto_id, calificacion (1-5), comentario } */
export const crearResena = (resena) => peticion(BASE, RUTA, { method: 'POST', body: resena, auth: true });

/** Moderación (Administrador o Vendedor). */
export const eliminarResena = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
