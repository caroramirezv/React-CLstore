import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import Contacto from '../pages/Contacto';
import { cadena } from '../test/cadenaSupabase';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(() => Promise.resolve({})) } }));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

const insertados = [];

function renderContacto(errorInsert = null) {
  insertados.length = 0;
  mocks.from.mockImplementation(() => cadena(() => ({
    uno: { data: null, error: errorInsert },
    alInsertar: (payload) => insertados.push(payload),
  })));
  render(<Contacto />);
  return userEvent.setup();
}

function campo(etiqueta) {
  return screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, textarea');
}

describe('Contacto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderizado', () => {
    it('muestra el formulario y las tres tiendas', () => {
      renderContacto();
      expect(screen.getByRole('heading', { name: 'Contacta con nosotros' })).toBeInTheDocument();
      expect(campo('Nombre')).toBeEnabled();
      expect(campo('Email')).toBeEnabled();
      expect(campo('Comentario')).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Enviar Mensaje' })).toBeEnabled();
      expect(screen.getByRole('heading', { name: 'Providencia' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Las Condes' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Santiago Centro' })).toBeInTheDocument();
      expect(screen.getByText(/\+56 9 8412 3765/)).toBeInTheDocument();
    });
  });

  describe('validación', () => {
    it('rechaza campos vacíos o con solo espacios y no inserta', () => {
      renderContacto();
      fireEvent.change(campo('Nombre'), { target: { value: '   ' } });
      fireEvent.change(campo('Email'), { target: { value: '   ' } });
      fireEvent.change(campo('Comentario'), { target: { value: '   ' } });
      fireEvent.submit(campo('Nombre').form);
      expect(Swal.fire).toHaveBeenCalledWith('Campos incompletos', expect.any(String), 'error');
      expect(insertados).toHaveLength(0);
    });
  });

  describe('envío', () => {
    function completar() {
      fireEvent.change(campo('Nombre'), { target: { value: '  Ana Pérez  ' } });
      fireEvent.change(campo('Email'), { target: { value: ' ana@gmail.com ' } });
      fireEvent.change(campo('Comentario'), { target: { value: '  Hola, quiero publicar  ' } });
      fireEvent.submit(campo('Nombre').form);
    }

    it('guarda el mensaje recortado, limpia el formulario y avisa', async () => {
      renderContacto();
      completar();
      await waitFor(() => expect(insertados).toHaveLength(1));
      expect(insertados[0]).toEqual({
        nombre: 'Ana Pérez',
        email: 'ana@gmail.com',
        mensaje: 'Hola, quiero publicar',
      });
      expect(campo('Nombre')).toHaveValue('');
      expect(campo('Email')).toHaveValue('');
      expect(campo('Comentario')).toHaveValue('');
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'success',
        title: 'Mensaje enviado. ¡Gracias por escribirnos!',
      }));
    });

    it('mientras envía deshabilita el botón', async () => {
      let resolver;
      mocks.from.mockImplementation(() => ({
        insert: (payload) => {
          insertados.push(payload);
          return new Promise((resolve) => { resolver = resolve; });
        },
      }));
      render(<Contacto />);
      const user = userEvent.setup();
      fireEvent.change(campo('Nombre'), { target: { value: 'Ana' } });
      fireEvent.change(campo('Email'), { target: { value: 'ana@gmail.com' } });
      fireEvent.change(campo('Comentario'), { target: { value: 'Hola' } });
      await user.click(screen.getByRole('button', { name: 'Enviar Mensaje' }));
      expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
      resolver({ error: null });
      expect(await screen.findByRole('button', { name: 'Enviar Mensaje' })).toBeEnabled();
    });

    it('si el insert falla muestra el error y conserva lo escrito', async () => {
      renderContacto({ message: 'sin conexión' });
      completar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('No se pudo enviar', 'sin conexión', 'error'));
      expect(campo('Nombre')).toHaveValue('  Ana Pérez  ');
    });
  });
});
