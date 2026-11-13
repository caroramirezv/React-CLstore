import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { login, registro, obtenerPerfil } from '../api/usuariosApi';
import { obtenerToken, guardarToken, borrarToken } from '../api/token';
import { registrarManejadorSesionExpirada } from '../api/http';

const AuthContext = createContext(null);

/**
 * Sesión basada en ms-usuarios: el JWT se guarda en localStorage (src/api/token.js) y el perfil se lee de
 * GET /api/usuarios/me. Expone la misma interfaz que cuando se usaba Supabase Auth.
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => obtenerToken());
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(obtenerToken()));

  const cerrarSesionLocal = useCallback(() => {
    borrarToken();
    setToken(null);
    setPerfil(null);
  }, []);

  // Si cualquier servicio responde 401 a una llamada con token, la sesión venció: se cierra en pantalla.
  useEffect(() => registrarManejadorSesionExpirada(cerrarSesionLocal), [cerrarSesionLocal]);

  // Al abrir la app con un token guardado, se carga el perfil.
  useEffect(() => {
    let activo = true;
    if (!obtenerToken()) {
      setLoading(false);
      return undefined;
    }
    obtenerPerfil()
      .then((datos) => {
        if (activo) setPerfil(datos);
      })
      .catch(() => {}) // 401: el cliente HTTP ya cerró la sesión. Sin conexión: se conserva el token y se reintenta al recargar.
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  function iniciarSesion(respuesta) {
    guardarToken(respuesta.token);
    setToken(respuesta.token);
    setPerfil(respuesta.usuario);
  }

  async function signIn(correo, password) {
    try {
      iniciarSesion(await login(correo, password));
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async function signUp({ correo, password, run, nombre, apellidos, fechaNacimiento, region, comuna, direccion }) {
    try {
      iniciarSesion(
        await registro({
          correo,
          password,
          run,
          nombre,
          apellidos,
          fecha_nacimiento: fechaNacimiento || null,
          region,
          comuna,
          direccion,
        })
      );
      return { error: null, necesitaConfirmacion: false }; // el registro deja la sesión iniciada
    } catch (error) {
      return { error };
    }
  }

  async function signOut() {
    cerrarSesionLocal();
  }

  async function refrescarPerfil() {
    try {
      setPerfil(await obtenerPerfil());
    } catch {
      // se conserva el perfil actual
    }
  }

  const usuario = useMemo(() => (perfil ? { id: perfil.id, email: perfil.correo } : null), [perfil]);

  const value = {
    session: token ? { access_token: token } : null,
    usuario,
    perfil,
    loading,
    signIn,
    signUp,
    signOut,
    refrescarPerfil,
    esAdminOVendedor: perfil?.tipo === 'Administrador' || perfil?.tipo === 'Vendedor',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
