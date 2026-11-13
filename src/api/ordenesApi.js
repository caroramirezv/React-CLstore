import { API_URLS, peticion } from './http';

const BASE = API_URLS.ordenes;
const RUTA = '/api/ordenes';

/**
 * Crea la orden (acepta compras de invitado). Si hay sesión se envía el token y la orden queda a nombre del usuario.
 * datos: { nombre, apellidos, correo, telefono, region, comuna, direccion, items: [{ producto_id, cantidad }] }
 * Devuelve { orden_id, total, estado }. Si no se puede completar (sin stock, producto retirado) lanza ApiError(409)
 * con el motivo en message y el id de la orden fallida en error.datos.orden_id.
 */
export const crearOrden = (datos) => peticion(BASE, RUTA, { method: 'POST', body: datos, auth: true });

/** Orden con sus líneas en "items". La ve su dueño o el personal. */
export const obtenerOrden = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { auth: true });

export const misOrdenes = () => peticion(BASE, `${RUTA}/mias`, { auth: true });

// --- Administración (rol Administrador o Vendedor) ---
/** filtros: { estado: 'exitosa' | 'fallida' } */
export const listarOrdenes = (filtros = {}) => peticion(BASE, RUTA, { params: filtros, auth: true });

/** Todas las líneas de todas las órdenes (reportes). */
export const listarItemsOrdenes = () => peticion(BASE, `${RUTA}/items`, { auth: true });
