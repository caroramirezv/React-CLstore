import { API_URLS, peticion } from './http';

const BASE = API_URLS.usuarios;

/** Inicia sesión. Devuelve { token, usuario }. Lanza ApiError(401) si las credenciales no son correctas. */
export const login = (correo, password) => peticion(BASE, '/api/auth/login', { method: 'POST', body: { correo, password } });

/** Registro público (siempre crea un Cliente). Devuelve { token, usuario } con la sesión ya iniciada. */
export const registro = (datos) => peticion(BASE, '/api/auth/registro', { method: 'POST', body: datos });

/** Perfil del usuario del token. */
export const obtenerPerfil = () => peticion(BASE, '/api/usuarios/me', { auth: true });

// --- Administración (rol Administrador o Vendedor) ---
export const listarUsuarios = () => peticion(BASE, '/api/usuarios', { auth: true });

export const crearUsuario = (usuario) => peticion(BASE, '/api/usuarios', { method: 'POST', body: usuario, auth: true });

export const actualizarUsuario = (id, usuario) =>
  peticion(BASE, `/api/usuarios/${encodeURIComponent(id)}`, { method: 'PUT', body: usuario, auth: true });

export const eliminarUsuario = (id) =>
  peticion(BASE, `/api/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
