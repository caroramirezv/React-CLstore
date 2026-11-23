import { API_URLS, peticion } from './http';

const BASE = API_URLS.ordenes;
const RUTA = '/api/ordenes';

export const crearOrden = (datos) => peticion(BASE, RUTA, { method: 'POST', body: datos, auth: true });

export const obtenerOrden = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { auth: true });

export const misOrdenes = () => peticion(BASE, `${RUTA}/mias`, { auth: true });

export const listarOrdenes = (filtros = {}) => peticion(BASE, RUTA, { params: filtros, auth: true });

export const listarItemsOrdenes = () => peticion(BASE, `${RUTA}/items`, { auth: true });
