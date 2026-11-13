import { API_URLS, peticion } from './http';

const BASE = API_URLS.contacto;
const RUTA = '/api/contactos';

/** Público. mensaje: { nombre, email, mensaje } */
export const enviarContacto = (mensaje) => peticion(BASE, RUTA, { method: 'POST', body: mensaje });

// --- Bandeja (Administrador o Vendedor) ---
export const listarContactos = () => peticion(BASE, RUTA, { auth: true });

export const eliminarContacto = (id) => peticion(BASE, `${RUTA}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
