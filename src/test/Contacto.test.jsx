import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import Contacto from '../pages/Contacto';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: () => ({ insert: mocks.insert }) },
}));

async function llenarFormulario(user, { nombre = 'Juan Pérez', email = 'juan@duoc.cl', mensaje = 'Hola, tengo una duda' } = {}) {
  await user.type(screen.getByPlaceholderText('Ej: Juan Pérez'), nombre);
  await user.type(screen.getByPlaceholderText('juan@duoc.cl'), email);
  await user.type(screen.getByPlaceholderText('Tu comentario...'), mensaje);
}

describe('Contacto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('muestra el formulario y las tres tiendas', () => {
    render(<Contacto />);
    expect(screen.getByRole('heading', { name: 'Contacta con nosotros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar Mensaje' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Providencia' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Las Condes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Santiago Centro' })).toBeInTheDocument();
  });

  it('con campos solo de espacios avisa y no envía', async () => {
    const user = userEvent.setup();
    render(<Contacto />);
    await llenarFormulario(user, { nombre: '   ' });
    await user.click(screen.getByRole('button', { name: 'Enviar Mensaje' }));
    expect(Swal.fire).toHaveBeenCalledWith('Campos incompletos', expect.any(String), 'error');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('envía los datos sin espacios sobrantes y limpia el formulario', async () => {
    const user = userEvent.setup();
    render(<Contacto />);
    await llenarFormulario(user, { nombre: '  Juan Pérez  ', mensaje: '  Hola  ' });
    await user.click(screen.getByRole('button', { name: 'Enviar Mensaje' }));
    expect(mocks.insert).toHaveBeenCalledWith({ nombre: 'Juan Pérez', email: 'juan@duoc.cl', mensaje: 'Hola' });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('');
    expect(screen.getByPlaceholderText('juan@duoc.cl')).toHaveValue('');
    expect(screen.getByPlaceholderText('Tu comentario...')).toHaveValue('');
  });

  it('mientras envía el botón dice "Enviando..." y queda deshabilitado', async () => {
    let terminar;
    mocks.insert.mockReturnValue(new Promise((resolve) => { terminar = resolve; }));
    const user = userEvent.setup();
    render(<Contacto />);
    await llenarFormulario(user);
    await user.click(screen.getByRole('button', { name: 'Enviar Mensaje' }));
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
    terminar({ error: null });
    expect(await screen.findByRole('button', { name: 'Enviar Mensaje' })).toBeEnabled();
  });

  it('si Supabase devuelve error lo muestra y conserva lo escrito', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'falló la red' } });
    const user = userEvent.setup();
    render(<Contacto />);
    await llenarFormulario(user);
    await user.click(screen.getByRole('button', { name: 'Enviar Mensaje' }));
    expect(Swal.fire).toHaveBeenCalledWith('No se pudo enviar', 'falló la red', 'error');
    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Juan Pérez');
  });
});
