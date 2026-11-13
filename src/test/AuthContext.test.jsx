import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { guardarToken, obtenerToken } from '../api/token';
import { peticion } from '../api/http';

// ms-usuarios se reemplaza; el token (localStorage) y el cliente HTTP son los reales.
const mocks = vi.hoisted(() => ({ login: vi.fn(), registro: vi.fn(), obtenerPerfil: vi.fn() }));
vi.mock('../api/usuariosApi', () => ({
  login: (...args) => mocks.login(...args),
  registro: (...args) => mocks.registro(...args),
  obtenerPerfil: (...args) => mocks.obtenerPerfil(...args),
}));

const clienta = { id: 'u1', nombre: 'Carla', correo: 'carla@gmail.com', tipo: 'Cliente' };
const vendedora = { id: 'u2', nombre: 'Vera', correo: 'vera@duoc.cl', tipo: 'Vendedor' };

let sesion; // el valor del contexto que ve el componente
function Sonda() {
  sesion = useAuth();
  if (sesion.loading) return <p>cargando</p>;
  return <p>{sesion.perfil ? `hola ${sesion.perfil.nombre}` : 'anónimo'}</p>;
}
const montar = () => render(<AuthProvider><Sonda /></AuthProvider>);

describe('AuthContext (sesión con ms-usuarios)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('al abrir la app', () => {
    it('sin token queda como anónimo y no consulta el perfil', async () => {
      montar();
      expect(await screen.findByText('anónimo')).toBeInTheDocument();
      expect(mocks.obtenerPerfil).not.toHaveBeenCalled();
      expect(sesion.usuario).toBeNull();
      expect(sesion.session).toBeNull();
    });

    it('con token guardado muestra "cargando" y luego el perfil', async () => {
      guardarToken('jwt-guardado');
      mocks.obtenerPerfil.mockResolvedValue(clienta);
      montar();
      expect(screen.getByText('cargando')).toBeInTheDocument();
      expect(await screen.findByText('hola Carla')).toBeInTheDocument();
      expect(sesion.usuario).toEqual({ id: 'u1', email: 'carla@gmail.com' });
      expect(sesion.session).toEqual({ access_token: 'jwt-guardado' });
    });

    it('si ms-usuarios no responde conserva el token guardado (se reintenta al recargar)', async () => {
      guardarToken('jwt-guardado');
      mocks.obtenerPerfil.mockRejectedValue(Object.assign(new Error('sin conexión'), { status: 0 }));
      montar();
      expect(await screen.findByText('anónimo')).toBeInTheDocument();
      expect(obtenerToken()).toBe('jwt-guardado');
    });
  });

  describe('iniciar y cerrar sesión', () => {
    it('signIn guarda el JWT y deja el perfil cargado', async () => {
      mocks.login.mockResolvedValue({ token: 'jwt-nuevo', usuario: clienta });
      montar();
      await screen.findByText('anónimo');
      let resultado;
      await act(async () => {
        resultado = await sesion.signIn('carla@gmail.com', 'Cliente1');
      });
      expect(resultado).toEqual({ error: null });
      expect(mocks.login).toHaveBeenCalledWith('carla@gmail.com', 'Cliente1');
      expect(obtenerToken()).toBe('jwt-nuevo');
      expect(await screen.findByText('hola Carla')).toBeInTheDocument();
    });

    it('signIn con credenciales incorrectas devuelve el error y no guarda token', async () => {
      const error = Object.assign(new Error('Correo o contraseña incorrectos.'), { status: 401 });
      mocks.login.mockRejectedValue(error);
      montar();
      await screen.findByText('anónimo');
      let resultado;
      await act(async () => {
        resultado = await sesion.signIn('carla@gmail.com', 'mala');
      });
      expect(resultado.error.message).toBe('Correo o contraseña incorrectos.');
      expect(obtenerToken()).toBeNull();
      expect(screen.getByText('anónimo')).toBeInTheDocument();
    });

    it('signOut borra el token y el perfil', async () => {
      guardarToken('jwt-guardado');
      mocks.obtenerPerfil.mockResolvedValue(clienta);
      montar();
      await screen.findByText('hola Carla');
      await act(async () => {
        await sesion.signOut();
      });
      expect(obtenerToken()).toBeNull();
      expect(screen.getByText('anónimo')).toBeInTheDocument();
    });
  });

  describe('registro', () => {
    it('signUp envía los datos en el formato del servicio y deja la sesión iniciada', async () => {
      mocks.registro.mockResolvedValue({ token: 'jwt-registro', usuario: clienta });
      montar();
      await screen.findByText('anónimo');
      let resultado;
      await act(async () => {
        resultado = await sesion.signUp({
          correo: 'carla@gmail.com', password: 'Abc123', run: '123456785', nombre: 'Carla', apellidos: 'Cliente',
          fechaNacimiento: '', region: 'R', comuna: 'C', direccion: 'Calle 1',
        });
      });
      expect(resultado).toEqual({ error: null, necesitaConfirmacion: false });
      expect(mocks.registro).toHaveBeenCalledWith({
        correo: 'carla@gmail.com', password: 'Abc123', run: '123456785', nombre: 'Carla', apellidos: 'Cliente',
        fecha_nacimiento: null, region: 'R', comuna: 'C', direccion: 'Calle 1',
      });
      expect(obtenerToken()).toBe('jwt-registro');
      expect(await screen.findByText('hola Carla')).toBeInTheDocument();
    });

    it('signUp devuelve el error del servicio (por ejemplo correo repetido)', async () => {
      mocks.registro.mockRejectedValue(Object.assign(new Error('Ya existe un usuario con ese correo.'), { status: 409 }));
      montar();
      await screen.findByText('anónimo');
      let resultado;
      await act(async () => {
        resultado = await sesion.signUp({ correo: 'a@gmail.com', password: 'Abc123' });
      });
      expect(resultado.error.message).toBe('Ya existe un usuario con ese correo.');
      expect(obtenerToken()).toBeNull();
    });
  });

  describe('roles y sesión vencida', () => {
    it('esAdminOVendedor es verdadero para Vendedor y falso para Cliente', async () => {
      guardarToken('t');
      mocks.obtenerPerfil.mockResolvedValue(vendedora);
      const { unmount } = montar();
      await screen.findByText('hola Vera');
      expect(sesion.esAdminOVendedor).toBe(true);
      unmount();

      mocks.obtenerPerfil.mockResolvedValue(clienta);
      montar();
      await screen.findByText('hola Carla');
      expect(sesion.esAdminOVendedor).toBe(false);
    });

    it('si un servicio responde 401 a una llamada con token, la sesión se cierra', async () => {
      guardarToken('jwt-vencido');
      mocks.obtenerPerfil.mockResolvedValue(clienta);
      montar();
      await screen.findByText('hola Carla');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '' }));
      await act(async () => {
        await peticion('http://localhost:9999', '/api/x', { auth: true }).catch(() => {});
      });

      expect(screen.getByText('anónimo')).toBeInTheDocument();
      expect(obtenerToken()).toBeNull();
    });

    it('un 401 sin token (por ejemplo un login fallido) no toca la sesión', async () => {
      montar();
      await screen.findByText('anónimo');
      const cerrarSesion = vi.fn();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '' }));
      await act(async () => {
        await peticion('http://localhost:9999', '/api/auth/login', { method: 'POST', body: {} }).catch(cerrarSesion);
      });
      expect(cerrarSesion).toHaveBeenCalled(); // la llamada falla, pero no se borra ninguna sesión
      expect(screen.getByText('anónimo')).toBeInTheDocument();
    });
  });
});
