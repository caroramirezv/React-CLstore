import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminUsuarios from '../pages/Admin/AdminUsuarios';
import { cadena } from '../../test/cadenaSupabase';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(() => Promise.resolve({ isConfirmed: true })) } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args) => mocks.from(...args),
    auth: { getSession: (...args) => mocks.getSession(...args) },
    functions: { invoke: (...args) => mocks.invoke(...args) },
  },
}));

import { useAuth } from '../context/AuthContext';

const usuarios = [
  {
    id: 'u1',
    run: '10000013K',
    nombre: 'Ana',
    apellidos: 'Pérez',
    correo: 'ana@gmail.com',
    tipo: 'Administrador',
    comuna: 'Arica',
    region: 'Arica y Parinacota',
    direccion: 'Calle 123',
    fecha_nacimiento: '2000-01-01',
  },
  {
    id: 'u2',
    run: '22222222',
    nombre: 'Leo',
    apellidos: 'Soto',
    correo: 'leo@duoc.cl',
    tipo: 'Vendedor',
    comuna: 'Iquique',
    region: 'Tarapacá',
    direccion: 'Prat 10',
  },
];

const estado = {
  usuarios,
  uno: { data: null, error: null },
  alActualizar: vi.fn(),
  alEliminar: vi.fn(),
  alEq: vi.fn(),
};

function renderUsuarios(usuarioActivo = { id: 'u1' }) {
  useAuth.mockReturnValue({ usuario: usuarioActivo });
  mocks.from.mockImplementation(() => cadena(() => ({
    data: estado.usuarios,
    uno: estado.uno,
    alActualizar: estado.alActualizar,
    alEliminar: estado.alEliminar,
    alEq: estado.alEq,
  })));
  render(<AdminUsuarios />);
  return userEvent.setup();
}

function campo(etiqueta) {
  return screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, select');
}

function completarNuevo(cambios = {}) {
  const datos = {
    run: '10000013k',
    nombre: 'Nico',
    apellidos: 'Rojas',
    correo: 'nico@gmail.com',
    password: 'secret1',
    direccion: 'Calle 9',
    ...cambios,
  };
  fireEvent.change(campo('RUN *'), { target: { value: datos.run } });
  fireEvent.change(campo('Nombre *'), { target: { value: datos.nombre } });
  fireEvent.change(campo('Apellidos *'), { target: { value: datos.apellidos } });
  fireEvent.change(campo('Correo Electrónico *'), { target: { value: datos.correo } });
  fireEvent.change(campo('Contraseña *'), { target: { value: datos.password } });
  fireEvent.change(campo('Región *'), { target: { value: 'Arica y Parinacota' } });
  fireEvent.change(campo('Comuna *'), { target: { value: 'Arica' } });
  fireEvent.change(campo('Dirección *'), { target: { value: datos.direccion } });
}

describe('AdminUsuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.usuarios = usuarios;
    estado.uno = { data: null, error: null };
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'tok-1' } } });
    mocks.invoke.mockResolvedValue({ error: null });
  });

  it('sin usuarios muestra la tabla vacía', async () => {
    estado.usuarios = [];
    renderUsuarios();
    expect(await screen.findByText('No hay usuarios guardados todavía.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mantenedor de Usuarios/ })).toBeInTheDocument();
  });

  it('lista RUN, correo, tipo y ubicación', async () => {
    renderUsuarios();
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('10000013K')).toBeInTheDocument();
    expect(screen.getByText('ana@gmail.com')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Arica, Arica y Parinacota')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Vendedor')).toBeInTheDocument();
    expect(screen.getByText('Leo Soto')).toBeInTheDocument();
  });

  it('la comuna sigue deshabilitada hasta elegir una región', async () => {
    const user = renderUsuarios();
    expect(campo('Comuna *')).toBeDisabled();
    await user.selectOptions(campo('Región *'), 'Arica y Parinacota');
    expect(campo('Comuna *')).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Camarones', hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Iquique', hidden: true })).not.toBeInTheDocument();
  });

  it('rechaza un RUN inválido antes de crear la cuenta', () => {
    renderUsuarios();
    fireEvent.change(campo('RUN *'), { target: { value: '123456789' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Usuario', hidden: true }).form);
    expect(Swal.fire).toHaveBeenCalledWith('RUN inválido', expect.any(String), 'error');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('rechaza el alta si faltan campos obligatorios', () => {
    renderUsuarios();
    fireEvent.change(campo('RUN *'), { target: { value: '10000013k' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Usuario', hidden: true }).form);
    expect(Swal.fire).toHaveBeenCalledWith('Datos incompletos', expect.any(String), 'error');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña fuera de 6 a 10 caracteres', () => {
    renderUsuarios();
    completarNuevo({ password: '123' });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Usuario', hidden: true }).form);
    expect(Swal.fire).toHaveBeenCalledWith('Contraseña inválida', expect.any(String), 'error');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('crea el usuario con el RUN normalizado y el token de la sesión', async () => {
    renderUsuarios();
    completarNuevo();
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Usuario', hidden: true }).form);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('create-user', expect.objectContaining({
      body: expect.objectContaining({
        run: '10000013K',
        nombre: 'Nico',
        correo: 'nico@gmail.com',
        password: 'secret1',
        region: 'Arica y Parinacota',
        comuna: 'Arica',
      }),
      headers: { Authorization: 'Bearer tok-1' },
    })));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Usuario creado' }));
  });

  it('si la función responde error muestra la alerta y no celebra el alta', async () => {
    mocks.invoke.mockResolvedValue({ error: { message: 'Correo ya registrado' } });
    renderUsuarios();
    completarNuevo();
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Usuario', hidden: true }).form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('No se pudo crear el usuario', 'Correo ya registrado', 'error'));
    expect(Swal.fire).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Usuario creado' }));
  });

  it('editar deshabilita correo y contraseña y actualiza el perfil', async () => {
    const user = renderUsuarios();
    await screen.findByText('Ana Pérez');
    const fila = screen.getByText('Ana Pérez').closest('tr');
    await user.click(within(fila).getAllByRole('button')[0]);
    expect(screen.getByRole('heading', { name: 'Editar Usuario', hidden: true })).toBeInTheDocument();
    expect(campo('RUN *')).toBeDisabled();
    expect(campo('Correo Electrónico *')).toBeDisabled();
    expect(campo('Contraseña')).toBeDisabled();
    fireEvent.change(campo('Nombre *'), { target: { value: 'Ana María' } });
    await user.click(screen.getByRole('button', { name: 'Guardar Usuario', hidden: true }));
    await waitFor(() => expect(estado.alActualizar).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Ana María',
      correo: 'ana@gmail.com',
      tipo: 'Administrador',
    })));
    expect(estado.alEq).toHaveBeenCalledWith('id', 'u1');
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Usuario actualizado' }));
  });

  it('no permite eliminar al usuario de la sesión', async () => {
    const user = renderUsuarios({ id: 'u1' });
    await screen.findByText('Ana Pérez');
    const fila = screen.getByText('Ana Pérez').closest('tr');
    await user.click(within(fila).getAllByRole('button')[1]);
    expect(Swal.fire).toHaveBeenCalledWith('No permitido', expect.any(String), 'error');
    expect(estado.alEliminar).not.toHaveBeenCalled();
  });

  it('eliminar a otra persona pide confirmación y la borra si se acepta', async () => {
    const user = renderUsuarios({ id: 'u1' });
    await screen.findByText('Leo Soto');
    const fila = screen.getByText('Leo Soto').closest('tr');
    Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
    await user.click(within(fila).getAllByRole('button')[1]);
    expect(estado.alEliminar).not.toHaveBeenCalled();

    Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
    await user.click(within(fila).getAllByRole('button')[1]);
    await waitFor(() => expect(estado.alEliminar).toHaveBeenCalled());
    expect(estado.alEq).toHaveBeenCalledWith('id', 'u2');
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Usuario eliminado' }));
  });
});
