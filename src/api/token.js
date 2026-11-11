// Token JWT que se envía a los microservicios en las operaciones de escritura
// (crear / editar / eliminar). Los GET públicos nunca lo llevan.
//
// ⚠️ TRANSITORIO: hoy el inicio de sesión sigue siendo Supabase, que no emite el JWT que
// esperan los microservicios. Mientras no exista un servicio de usuarios, el token se toma de:
//   1) localStorage ("clstore_token"), o
//   2) la variable VITE_API_TOKEN (solo desarrollo; queda visible en el bundle).
// Cuando exista el servicio de usuarios, el login solo tendrá que llamar a guardarToken(jwt)
// y a borrarToken() al cerrar sesión. Nada más en el front depende de cómo se obtiene.

const CLAVE = 'clstore_token';

export function obtenerToken() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return guardado;
  } catch {
    // localStorage no disponible (modo privado, SSR, tests): se usa la variable de entorno.
  }
  return import.meta.env.VITE_API_TOKEN || null;
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
