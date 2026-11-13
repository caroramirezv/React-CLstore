// Token JWT que se envía a los microservicios en las operaciones de escritura
// (crear / editar / eliminar). Los GET públicos nunca lo llevan.
//
// ms-usuarios entrega el JWT al iniciar sesión o registrarse; AuthContext lo guarda con guardarToken()
// y lo borra al cerrar sesión (o cuando un servicio responde 401). Vive en localStorage ("clstore_token").

const CLAVE = 'clstore_token';

export function obtenerToken() {
  try {
    return localStorage.getItem(CLAVE) || null;
  } catch {
    return null; // localStorage no disponible (modo privado, tests)
  }
}

export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
    // sin almacenamiento: el token no persiste
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
}
