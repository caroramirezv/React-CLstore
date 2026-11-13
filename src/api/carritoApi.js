import { API_URLS, peticion } from './http';

const BASE = API_URLS.carrito;
const RUTA = '/api/carrito';

// Todas requieren sesión. Las que modifican devuelven el carrito ya actualizado:
// [{ id, producto_id, cantidad, productos: { id, nombre, precio, imagen, descuento_porcentaje, stock } }]

export const listarCarrito = () => peticion(BASE, RUTA, { auth: true });

export const agregarAlCarrito = (productoId, cantidad = 1) =>
  peticion(BASE, `${RUTA}/items`, { method: 'POST', body: { producto_id: productoId, cantidad }, auth: true });

export const cambiarCantidadCarrito = (productoId, cantidad) =>
  peticion(BASE, `${RUTA}/items/${encodeURIComponent(productoId)}`, { method: 'PUT', body: { cantidad }, auth: true });

export const quitarDelCarrito = (productoId) =>
  peticion(BASE, `${RUTA}/items/${encodeURIComponent(productoId)}`, { method: 'DELETE', auth: true });

export const vaciarCarritoRemoto = () => peticion(BASE, RUTA, { method: 'DELETE', auth: true });
