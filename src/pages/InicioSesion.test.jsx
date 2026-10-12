import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Swal from 'sweetalert2';
import InicioSesion from './InicioSesion';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(() => Promise.resolve({})) } }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

import { useAuth } from '../context/AuthContext';

function renderLogin(signIn = vi.fn().mockResolvedValue({ error: null })) {
  useAuth.mockReturnValue({ signIn });
  render(
    <MemoryRouter>
      <InicioSesion />
    </MemoryRouter>
  );
  return { signIn, user: userEvent.setup() };
}

async function completar(user, correo, password) {
  await user.type(screen.getByLabelText('Correo'), correo);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
}

describe('InicioSesion', () => {
  it('renderiza título, campos y botón', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Inicio de sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeEnabled();
  });

  it('actualiza el valor de los campos cuando el usuario escribe (estado)', async () => {
    const { user } = renderLogin();
    await user.type(screen.getByLabelText('Correo'), 'ana@gmail.com');
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@gmail.com');
  });

  it('rechaza una contraseña compuesta solo por espacios', async () => {
    const { signIn, user } = renderLogin();
    await completar(user, 'ana@gmail.com', '      ');
    expect(Swal.fire).toHaveBeenCalledWith('Datos incompletos', expect.any(String), 'error');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rechaza un dominio de correo no permitido sin llamar a signIn', async () => {
    const { signIn, user } = renderLogin();
    await completar(user, 'ana@hotmail.com', '123456');
    expect(Swal.fire).toHaveBeenCalledWith('Correo no permitido', expect.any(String), 'error');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('con datos válidos llama signIn y navega al home', async () => {
    const { signIn, user } = renderLogin();
    await completar(user, 'ana@gmail.com', '123456');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(signIn).toHaveBeenCalledWith('ana@gmail.com', '123456');
  });

  it('si signIn devuelve error muestra la alerta y NO navega', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: { message: 'Credenciales inválidas' } });
    const { user } = renderLogin(signIn);
    await completar(user, 'ana@gmail.com', '123456');
    await waitFor(() =>
      expect(Swal.fire).toHaveBeenCalledWith('Correo o contraseña incorrectos', 'Credenciales inválidas', 'error')
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
