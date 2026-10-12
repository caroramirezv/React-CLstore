import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminUsuarios from '../pages/Admin/AdminUsuarios';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

// Listar, actualizar y borrar perfiles; crear usuario va por la función "create-user".
const mocks = vi.hoisted(() => ({
  lista: { data: [] },
  update: vi.fn(),
  eliminar: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve(mocks.lista) }),
      update: (payload) => ({ eq: (col, valor) => mocks.update(payload, col, valor) }),
      delete: () => ({ eq: (col, valor) => mocks.eliminar(col, valor) }),
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
    functions: { invoke: (...args) => mocks.invoke(...args) },
  },
}));

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
  mocks.lista = { data: lista };
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
    mocks.update.mockResolvedValue({ error: null });
    mocks.eliminar.mockResolvedValue({ error: null });
    mocks.invoke.mockResolvedValue({ error: null });
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
    it('invoca "create-user" con los datos y el token de la sesión', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      enviar();
      await waitFor(() =>
        expect(mocks.invoke).toHaveBeenCalledWith('create-user', {
          body: {
            run: RUN_VALIDO, tipo: 'Cliente', nombre: 'Eva', apellidos: 'Rojas', correo: 'eva@gmail.com',
            fechaNacimiento: '', password: 'abc123', region: 'Arica y Parinacota', comuna: 'Arica', direccion: 'Calle 1',
          },
          headers: { Authorization: 'Bearer tok' },
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
      expect(mocks.invoke).not.toHaveBeenCalled();
    });

    it('rechaza si faltan campos obligatorios', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      escribir('Nombre *', '');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Datos incompletos', expect.any(String), 'error');
      expect(mocks.invoke).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña de menos de 6 caracteres', async () => {
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      escribir('Contraseña *', 'abc');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Contraseña inválida', expect.any(String), 'error');
      expect(mocks.invoke).not.toHaveBeenCalled();
    });

    it('si la función devuelve error lo muestra', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.invoke.mockResolvedValue({ error: { message: 'el correo ya existe' } });
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudo crear el usuario', 'el correo ya existe', 'error')
      );
    });

    it('registra en consola el detalle JSON que devuelve la función', async () => {
      const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
      const context = { clone: () => ({ json: () => Promise.resolve({ detalle: 'correo duplicado' }) }) };
      mocks.invoke.mockResolvedValue({ error: { message: 'falló', context } });
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudo crear el usuario', 'falló', 'error')
      );
      expect(consola).toHaveBeenCalledWith('Respuesta de Supabase:', { detalle: 'correo duplicado' });
    });

    it('si la respuesta de error no es JSON registra el texto plano', async () => {
      const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
      const context = {
        clone: () => ({
          json: () => Promise.reject(new Error('no es json')),
          text: () => Promise.resolve('texto plano'),
        }),
      };
      mocks.invoke.mockResolvedValue({ error: { message: 'falló', context } });
      const user = await renderUsuarios();
      await user.click(screen.getByRole('button', { name: /Nuevo Usuario/ }));
      llenarUsuarioNuevo();
      enviar();
      await waitFor(() => expect(consola).toHaveBeenCalledWith('Respuesta de texto:', 'texto plano'));
      expect(Swal.fire).toHaveBeenCalledWith('No se pudo crear el usuario', 'falló', 'error');
    });

    it('si el error no trae mensaje muestra \"Error desconocido\"', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.invoke.mockResolvedValue({ error: {} });
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
        expect(mocks.invoke).toHaveBeenCalledWith(
          'create-user',
          expect.objectContaining({
            body: expect.objectContaining({ tipo: 'Vendedor', fechaNacimiento: '1990-05-20' }),
          })
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

    it('actualiza el perfil por su id sin pedir contraseña', async () => {
      const user = await renderUsuarios();
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[0]);
      escribir('Nombre *', 'Anita');
      enviar();
      await waitFor(() =>
        expect(mocks.update).toHaveBeenCalledWith(
          expect.objectContaining({ nombre: 'Anita', apellidos: 'Pérez', tipo: 'Cliente', fecha_nacimiento: null }),
          'id',
          'u1'
        )
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Usuario actualizado'));
      expect(mocks.invoke).not.toHaveBeenCalled();
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
      await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith('id', 'u1'));
      expect(Swal.fire).toHaveBeenCalledWith(toast('Usuario eliminado'));
    });

    it('si se cancela no borra nada', async () => {
      Swal.fire.mockResolvedValue({ isConfirmed: false });
      const user = await renderUsuarios({ usuarioActivo: { id: 'u2' } });
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[1]);
      await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
      expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it('si Supabase falla al borrar muestra el error', async () => {
      mocks.eliminar.mockResolvedValue({ error: { message: 'sin permisos' } });
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

    it('si Supabase falla al actualizar muestra el error', async () => {
      mocks.update.mockResolvedValue({ error: { message: 'sin permiso' } });
      const user = await renderUsuarios();
      await user.click(within(fila('Ana Pérez')).getAllByRole('button')[0]);
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'sin permiso', 'error'));
    });
  });
});
