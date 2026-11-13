import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminUsuarios from '../pages/Admin/AdminUsuarios';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

// ms-usuarios: listar, crear, actualizar y eliminar (el token lo agrega la capa api, no la pantalla).
const mocks = vi.hoisted(() => ({
  lista: [],
  crear: vi.fn(),
  actualizar: vi.fn(),
  eliminar: vi.fn(),
}));
vi.mock('../api/usuariosApi', () => ({
  listarUsuarios: () => (mocks.lista instanceof Error ? Promise.reject(mocks.lista) : Promise.resolve(mocks.lista)),
  crearUsuario: (usuario) => mocks.crear(usuario),
  actualizarUsuario: (id, usuario) => mocks.actualizar(id, usuario),
  eliminarUsuario: (id) => mocks.eliminar(id),
}));

// Error de microservicio (ApiError) con el código HTTP, como lo lanza src/api/http.js
const errorApi = (mensaje, status) => Object.assign(new Error(mensaje), { status });

import { useAuth } from '../context/AuthContext';

const RUN_VALIDO = '123456785'; // dígito verificador correcto

const usuarios = [
  { id: 'u1', run: RUN_VALIDO, nombre: 'Ana', apellidos: 'Pérez', correo: 'ana@gmail.com', tipo: 'Cliente',
    region: 'Arica y Parinacota', comuna: 'Arica', direccion: 'Calle 123', fecha_nacimiento: null },
  { id: 'u2', run: '100000138', nombre: 'Luis', apellidos: 'Díaz', correo: 'luis@duoc.cl', tipo: 'Administrador',
    region: 'Tarapacá', comuna: 'Iquique', direccion: 'Prat 10', fecha_nacimiento: null },
];

const campo = (etiqueta) =>
  screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, select');
const escribir = (etiqueta, valor) => fireEvent.change(campo(etiqueta), { target: { value: valor } });
const enviar = () => fireEvent.submit(campo('Nombre *').closest('form'));
const fila = (nombre) => screen.getByText(nombre).closest('tr');
const toast = (titulo) => expect.objectContaining({ title: titulo });

async function renderUsuarios({ lista = usuarios, usuarioActivo = { id: 'u2' } } = {}) {
  mocks.lista = lista;
  useAuth.mockReturnValue({ usuario: usuarioActivo });
  await act(async () => {
    render(<AdminUsuarios />);
  });
  return userEvent.setup();
}

function llenarUsuarioNuevo() {
  escribir('RUN *', RUN_VALIDO);
  escribir('Nombre *', 'Eva');
  escribir('Apellidos *', 'Rojas');
  escribir('Correo Electrónico *', 'eva@gmail.com');
  escribir('Contraseña *', 'abc123');
  escribir('Región *', 'Arica y Parinacota');
  escribir('Comuna *', 'Arica'); // las comunas aparecen al elegir la región
  escribir('Dirección *', 'Calle 1');
}

describe('AdminUsuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Swal.fire.mockResolvedValue({ isConfirmed: true });
    mocks.crear.mockResolvedValue({});
    mocks.actualizar.mockResolvedValue({});
    mocks.eliminar.mockResolvedValue(null);
  });

  describe('listado', () => {
    it('muestra una fila por usuario con correo, tipo y ubicación', async () => {
      await renderUsuarios();
      const ana = within(fila('Ana Pérez'));
      expect(ana.getByText(RUN_VALIDO)).toBeInTheDocument();
      expect(ana.getByText('ana@gmail.com')).toBeInTheDocument();
      expect(ana.getByText('Cliente')).toBeInTheDocument();
      expect(ana.getByText('Arica, Arica y Parinacota')).toBeInTheDocument();
      expect(within(fila('Luis Díaz')).getByText('Administrador')).toBeInTheDocument();
    });

    it('sin usuarios muestra el mensaje de vacío', async () => {
      await renderUsuarios({ lista: [] });
      expect(await screen.findByText('No hay usuarios guardados todavía.')).toBeInTheDocument();
    });
  });

  describe('crear', () => {
    it('crea el usuario en ms-usuarios con los datos del formulario', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      enviar();
      await waitFor(() =>
        expect(mocks.crear).toHaveBeenCalledWith({
          run: RUN_VALIDO, tipo: 'Cliente', nombre: 'Eva', apellidos: 'Rojas', correo: 'eva@gmail.com',
          fecha_nacimiento: null, password: 'abc123', region: 'Arica y Parinacota', comuna: 'Arica', direccion: 'Calle 1',
        })
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Usuario creado'));
    });

    it('rechaza un RUN inválido', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      escribir('RUN *', '123456789');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('RUN inválido', expect.any(String), 'error');
      expect(mocks.crear).not.toHaveBeenCalled();
    });

    it('rechaza si faltan campos obligatorios', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      escribir('Nombre *', '');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Datos incompletos', expect.any(String), 'error');
      expect(mocks.crear).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña de menos de 6 caracteres', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      escribir('Contraseña *', 'abc');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Contraseña inválida', expect.any(String), 'error');
      expect(mocks.crear).not.toHaveBeenCalled();
    });

    it('si ms-usuarios devuelve error (409) lo muestra', async () => {
      mocks.crear.mockRejectedValue(errorApi('el correo ya existe', 409));
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudo crear el usuario', 'el correo ya existe', 'error')
      );
    });

    it('un Vendedor que intenta crear un Administrador ve el 403 del servicio', async () => {
      mocks.crear.mockRejectedValue(errorApi('Solo un Administrador puede crear, modificar o eliminar cuentas de Administrador.', 403));
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      escribir('Tipo de Usuario *', 'Administrador');
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith(
          'No se pudo crear el usuario',
          expect.stringContaining('Solo un Administrador'),
          'error'
        )
      );
    });

    it('si el error no trae mensaje muestra \"Error desconocido\"', async () => {
      mocks.crear.mockRejectedValue({});
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudo crear el usuario', 'Error desconocido', 'error')
      );
    });

    it('envía el tipo de usuario y la fecha de nacimiento elegidos', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      escribir('Tipo de Usuario *', 'Vendedor');
      escribir('Fecha Nacimiento (Opcional)', '1990-05-20');
      enviar();
      await waitFor(() =>
        expect(mocks.crear).toHaveBeenCalledWith(
          expect.objectContaining({ tipo: 'Vendedor', fecha_nacimiento: '1990-05-20' })
        )
      );
    });
  });

  describe('editar', () => {
    it('abre el formulario con los datos y bloquea RUN y correo', async () => {
      const user = await renderUsuarios();
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[0]);
      expect(screen.getByText('Editar Usuario')).toBeInTheDocument();
      expect(campo('RUN *')).toHaveValue(RUN_VALIDO);
      expect(campo('RUN *')).toBeDisabled();
      expect(campo('Correo Electrónico *')).toBeDisabled();
      expect(campo('Nombre *')).toHaveValue('Ana');
    });

    it('actualiza el usuario por su id sin pedir contraseña', async () => {
      const user = await renderUsuarios();
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[0]);
      escribir('Nombre *', 'Anita');
      enviar();
      await waitFor(() =>
        expect(mocks.actualizar).toHaveBeenCalledWith(
          'u1',
          expect.objectContaining({ nombre: 'Anita', apellidos: 'Pérez', tipo: 'Cliente', fecha_nacimiento: null })
        )
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Usuario actualizado'));
      expect(mocks.crear).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('no deja eliminar al usuario con sesión iniciada', async () => {
      const user = await renderUsuarios({ usuarioActivo: { id: 'u1' } });
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[1]);
      expect(Swal.fire).toHaveBeenCalledWith('No permitido', expect.any(String), 'error');
      expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it('al confirmar borra a otro usuario', async () => {
      const user = await renderUsuarios({ usuarioActivo: { id: 'u2' } });
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[1]);
      await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith('u1'));
      expect(Swal.fire).toHaveBeenCalledWith(toast('Usuario eliminado'));
    });

    it('si se cancela no borra nada', async () => {
      Swal.fire.mockResolvedValue({ isConfirmed: false });
      const user = await renderUsuarios({ usuarioActivo: { id: 'u2' } });
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[1]);
      await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
      expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it('si ms-usuarios falla al borrar muestra el error', async () => {
      mocks.eliminar.mockRejectedValue(errorApi('sin permisos', 403));
      const user = await renderUsuarios({ usuarioActivo: { id: 'u2' } });
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[1]);
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'sin permisos', 'error'));
    });
  });

  describe('casos límite', () => {
    const incompletos = [
      { id: 'u7', run: RUN_VALIDO, nombre: 'Vera', apellidos: null, correo: 'v@gmail.com', tipo: 'Vendedor',
        region: 'Maule', comuna: null, direccion: null, fecha_nacimiento: null },
      { id: 'u8', run: '100000138', nombre: 'Sol', apellidos: 'Mora', correo: 's@gmail.com', tipo: null,
        region: null, comuna: 'Talca', direccion: null, fecha_nacimiento: null },
    ];

    it('si la lista llega sin datos muestra el mensaje de vacío', async () => {
      await renderUsuarios({ lista: null });
      expect(await screen.findByText('No hay usuarios guardados todavía.')).toBeInTheDocument();
    });

    it('lista usuarios con datos incompletos (sin apellidos, comuna, región o tipo)', async () => {
      await renderUsuarios({ lista: incompletos });
      const vera = within(fila('Vera'));
      expect(vera.getByText('Vendedor')).toBeInTheDocument();
      expect(vera.getByText('Maule')).toBeInTheDocument();
      expect(within(fila('Sol Mora')).getByText('Talca')).toBeInTheDocument();
    });

    it('al editar un usuario con datos nulos deja los campos vacíos', async () => {
      const user = await renderUsuarios({ lista: incompletos });
      await user.click(within(fila('Vera')).getAllByRole('button')[0]);
      expect(campo('Apellidos *')).toHaveValue('');
      expect(campo('Dirección *')).toHaveValue('');
      expect(campo('Tipo de Usuario *')).toHaveValue('Vendedor');
    });

    it('si ms-usuarios falla al actualizar muestra el error', async () => {
      mocks.actualizar.mockRejectedValue(errorApi('sin permiso', 403));
      const user = await renderUsuarios();
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[0]);
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'sin permiso', 'error'));
    });
  });
});
