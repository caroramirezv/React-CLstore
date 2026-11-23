import { API_URLS, peticion } from './http';

const BASE = API_URLS.categorias;
const RUTA = '/api/categorias';

export const listarCategorias = () => peticion(BASE, RUTA);

export const crearCategoria = (categoria) => peticion(BASE, RUTA, { method: 'POST', body: categoria, auth: true });

export const actualizarCategoria = (valor, categoria) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(valor)}`, { method: 'PUT', body: categoria, auth: true });

export const eliminarCategoria = (valor) =>
  peticion(BASE, `${RUTA}/${encodeURIComponent(valor)}`, { method: 'DELETE', auth: true });
