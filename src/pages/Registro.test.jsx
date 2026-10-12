import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Swal from 'sweetalert2';
import Registro from './Registro';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(() => Promise.resolve({})) } }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

import { useAuth } from '../context/AuthContext';

const REGION = 'Arica y Parinacota';
const COMUNA = 'Arica';

function renderRegistro(signUp = vi.fn().mockResolvedValue({ error: null })) {
  useAuth.mockReturnValue({ signUp });
  render(
    <MemoryRouter>
      <Registro />
    </MemoryRouter>
  );
  return { signUp, user: userEvent.setup() };
}

// Completa el formulario con datos válidos; cada test puede sobrescribir un campo.
async function completar(user, cambios = {}) {
  const d = {
    run: '10000013k',
    nombre: 'Ana',
    apellidos: 'Pérez Soto',
    correo: 'ana@gmail.com',
    confirmarCorreo: 'ana@gmail.com',
    password: 'secret1',
    confirmarPassword: 'secret1',
    direccion: 'Calle 123',
    ...cambios,
  };
  await user.type(screen.getByLabelText('RUN'), d.run);
  await user.type(screen.getByLabelText('Nombre'), d.nombre);
  await user.type(screen.getByLabelText('Apellidos'), d.apellidos);
  await user.type(screen.getByLabelText('Correo'), d.correo);
  await user.type(screen.getByLabelText('Confirmar Correo'), d.confirmarCorreo);
  await user.type(screen.getByLabelText('Contraseña'), d.password);
  await user.type(screen.getByLabelText('Confirmar Contraseña'), d.confirmarPassword);
  await user.selectOptions(screen.getByLabelText('Región'), REGION);
  await user.selectOptions(screen.getByLabelText('Comuna'), COMUNA);
  await user.type(screen.getByLabelText('Dirección'), d.direccion);
  await user.click(screen.getByRole('button', { name: 'Registrarse' }));
}

describe('Registro', () => {
  describe('renderizado y estado', () => {
    it('muestra los campos principales y el botón', () => {
      renderRegistro();
      expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument();
      ['RUN', 'Nombre', 'Apellidos', 'Correo', 'Confirmar Correo', 'Contraseña', 'Confirmar Contraseña', 'Dirección'].forEach(
        (etiqueta) => expect(screen.getByLabelText(etiqueta)).toBeInTheDocument()
      );
      expect(screen.getByRole('button', { name: 'Registrarse' })).toBeEnabled();
    });

    it('la comuna está deshabilitada hasta elegir una región', () => {
      renderRegistro();
      expect(screen.getByLabelText('Comuna')).toBeDisabled();
    });

    it('al elegir una región se habilitan solo las comunas de esa región', async () => {
      const { user } = renderRegistro();
      await user.selectOptions(screen.getByLabelText('Región'), REGION);
      expect(screen.getByLabelText('Comuna')).toBeEnabled();
      expect(screen.getByRole('option', { name: 'Camarones' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Iquique' })).not.toBeInTheDocument(); // es de Tarapacá
    });
  });

  describe('validaciones', () => {
    it('rechaza un RUN inválido y no llama a signUp', async () => {
      const { signUp, user } = renderRegistro();
      await completar(user, { run: '123456789' }); // dígito verificador correcto sería 5
      expect(Swal.fire).toHaveBeenCalledWith('RUN Inválido', expect.any(String), 'error');
      expect(signUp).not.toHaveBeenCalled();
    });

    it('rechaza un dominio de correo no permitido', async () => {
      const { signUp, user } = renderRegistro();
      await completar(user, { correo: 'ana@hotmail.com', confirmarCorreo: 'ana@hotmail.com' });
      expect(Swal.fire).toHaveBeenCalledWith('Correo no permitido', expect.any(String), 'error');
      expect(signUp).not.toHaveBeenCalled();
    });

    it('rechaza cuando los correos no coinciden', async () => {
      const { signUp, user } = renderRegistro();
      await completar(user, { confirmarCorreo: 'otra@gmail.com' });
      expect(Swal.fire).toHaveBeenCalledWith('Error de Correo', expect.any(String), 'error');
      expect(signUp).not.toHaveBeenCalled();
    });

    it('rechaza cuando las contraseñas no coinciden', async () => {
      const { signUp, user } = renderRegistro();
      await completar(user, { confirmarPassword: 'secret2' });
      expect(Swal.fire).toHaveBeenCalledWith('Error de Contraseña', expect.any(String), 'error');
      expect(signUp).not.toHaveBeenCalled();
    });
  });

  describe('envío', () => {
    it('con datos válidos llama signUp con el RUN normalizado y navega al home', async () => {
      const { signUp, user } = renderRegistro();
      await completar(user);
      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          correo: 'ana@gmail.com',
          password: 'secret1',
          run: '10000013K', // sin puntos ni guion y en mayúscula
          nombre: 'Ana',
          apellidos: 'Pérez Soto',
          region: REGION,
          comuna: COMUNA,
          direccion: 'Calle 123',
        })
      );
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
    });

    it('si signUp devuelve error muestra la alerta y NO navega', async () => {
      const signUp = vi.fn().mockResolvedValue({ error: { message: 'Correo ya registrado' } });
      const { user } = renderRegistro(signUp);
      await completar(user);
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudo registrar', 'Correo ya registrado', 'error')
      );
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
