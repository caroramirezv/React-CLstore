
const CLAVE = 'clstore_token';

export function obtenerToken() {
  try {
    return localStorage.getItem(CLAVE) || null;
  } catch {
    return null; 
  }
}

export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
  }
}
