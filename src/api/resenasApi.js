import { API_URLS, peticion } from './http';

const BASE = API_URLS.resenas;
const RUTA = '/api/resenas';

export const listarResenas = (productoId) => peticion(BASE, RUTA, { params: { producto_id: productoId } });

export const crearResena = (resena) => peticion(BASE, RUTA, { method: 'POST', body: resena, auth: true });

export const eliminarResena = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
