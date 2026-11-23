import { API_URLS, peticion } from './http';

const BASE = API_URLS.usuarios;


export const login = (correo, password) => peticion(BASE, '/api/auth/login', { method: 'POST', body: { correo, password } });


export const loginGoogle = (credential) =>
  peticion(BASE, '/api/auth/google', { method: 'POST', body: { credential } }); 


export const registro = (datos) => peticion(BASE, '/api/auth/registro', { method: 'POST', body: datos });


export const obtenerPerfil = () => peticion(BASE, '/api/usuarios/me', { auth: true });

export const listarUsuarios = () => peticion(BASE, '/api/usuarios', { auth: true });

export const crearUsuario = (usuario) => peticion(BASE, '/api/usuarios', { method: 'POST', body: usuario, auth: true });

export const actualizarUsuario = (id, usuario) =>
  peticion(BASE, `/api/usuarios/${encodeURIComponent(id)}`, { method: 'PUT', body: usuario, auth: true });

export const eliminarUsuario = (id) =>
  peticion(BASE, `/api/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
