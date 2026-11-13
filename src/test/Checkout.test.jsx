import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Checkout from '../pages/Checkout';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
const mocks = vi.hoisted(() => ({ crearOrden: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));
vi.mock('../api/ordenesApi', () => ({ crearOrden: (...args) => mocks.crearOrden(...args) }));

// Compra rechazada por ms-ordenes (409): el motivo viaja en message y el id de la orden fallida en datos.orden_id
const rechazo = (mensaje, ordenId = null) =>
  Object.assign(new Error(mensaje), { status: 409, datos: ordenId === null ? null : { orden_id: ordenId } });

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const item = {
  producto_id: 1,
  cantidad: 2,
  productos: { id: 1, nombre: 'Mouse', precio: 10000, imagen: 'mouse.jpg', descuento_porcentaje: null },
};

function renderCheckout({
  items = [item],
  total = 20000,
  usuario = null,
  perfil = null,
  vaciarCarrito = vi.fn().mockResolvedValue(undefined),
} = {}) {
  useAuth.mockReturnValue({ usuario, perfil });
  useCart.mockReturnValue({ items, total, vaciarCarrito });
  render(
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>
  );
  return { vaciarCarrito, user: userEvent.setup() };
}

function campo(etiqueta) {
  return screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, select');
}

async function completar(user) {
  fireEvent.change(campo('Nombre *'), { target: { value: 'Ana' } });
  fireEvent.change(campo('Apellidos *'), { target: { value: 'Pérez' } });
  fireEvent.change(campo('Correo *'), { target: { value: 'ana@gmail.com' } });
  fireEvent.change(campo('Teléfono (Opcional)'), { target: { value: '+56911111111' } });
  await user.selectOptions(campo('Región *'), 'Arica y Parinacota');
  await user.selectOptions(campo('Comuna *'), 'Arica');
  fireEvent.change(campo('Dirección *'), { target: { value: 'Calle 123' } });
}

describe('Checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.crearOrden.mockResolvedValue({ orden_id: 'ord-1', total: 20000, estado: 'exitosa' });
  });

  describe('carrito vacío', () => {
    it('explica que no hay nada que pagar y ofrece el catálogo', () => {
      renderCheckout({ items: [], total: 0 });
      expect(screen.getByText('Tu carrito está vacío, no hay nada que pagar.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ver Productos' })).toHaveAttribute('href', '/productos');
      expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument();
    });
  });

  describe('formulario', () => {
    it('muestra el resumen y deja la comuna deshabilitada', () => {
      renderCheckout();
      expect(screen.getByRole('heading', { name: /Finalizar Compra/ })).toBeInTheDocument();
      expect(screen.getByText('Mouse')).toBeInTheDocument();
      expect(screen.getByText('x2')).toBeInTheDocument();
      expect(screen.getAllByText('$20.000').length).toBeGreaterThan(0);
      expect(campo('Comuna *')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Pagar $20.000' })).toBeEnabled();
      expect(screen.queryByText(/Completamos estos datos con tu perfil/)).not.toBeInTheDocument();
    });

    it('rellena los datos del perfil y avisa que se pueden editar', () => {
      renderCheckout({
        usuario: { id: 'u1', email: 'ana@gmail.com' },
        perfil: {
          nombre: 'Ana',
          apellidos: 'Pérez',
          correo: 'ana@gmail.com',
          region: 'Arica y Parinacota',
          comuna: 'Arica',
          direccion: 'Calle 123',
        },
      });
      expect(screen.getByText(/Completamos estos datos con tu perfil/)).toBeInTheDocument();
      expect(campo('Nombre *')).toHaveValue('Ana');
      expect(campo('Correo *')).toHaveValue('ana@gmail.com');
      expect(campo('Comuna *')).toBeEnabled();
      expect(campo('Comuna *')).toHaveValue('Arica');
    });

    it('al elegir región habilita solo sus comunas y limpia la comuna anterior', async () => {
      const { user } = renderCheckout({
        perfil: { region: 'Arica y Parinacota', comuna: 'Arica' },
      });
      await user.selectOptions(campo('Región *'), 'Tarapacá');
      expect(campo('Comuna *')).toHaveValue('');
      expect(campo('Comuna *')).toBeEnabled();
      expect(screen.getByRole('option', { name: 'Iquique' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Camarones' })).not.toBeInTheDocument();
    });
  });

  describe('pago', () => {
    it('no llama a ms-ordenes si faltan datos obligatorios', () => {
      renderCheckout();
      fireEvent.submit(screen.getByRole('button', { name: 'Pagar $20.000' }).form);
      expect(mocks.crearOrden).not.toHaveBeenCalled();
    });

    it('con datos válidos crea la orden, vacía el carrito y abre el resumen', async () => {
      const { user, vaciarCarrito } = renderCheckout({ usuario: { id: 'u1' } });
      await completar(user);
      await user.click(screen.getByRole('button', { name: 'Pagar $20.000' }));
      await waitFor(() => expect(navigate).toHaveBeenCalledWith(
        '/resumen-compra/ord-1',
        expect.objectContaining({
          state: expect.objectContaining({
            exito: true,
            ordenId: 'ord-1',
            total: 20000,
            comprador: expect.objectContaining({ nombre: 'Ana', comuna: 'Arica' }),
          }),
        })
      ));
      // Solo viajan comprador y cantidades: el precio lo calcula ms-ordenes y el usuario lo identifica el token.
      expect(mocks.crearOrden).toHaveBeenCalledWith(expect.objectContaining({
        nombre: 'Ana',
        correo: 'ana@gmail.com',
        comuna: 'Arica',
        items: [{ producto_id: 1, cantidad: 2 }],
      }));
      expect(mocks.crearOrden.mock.calls[0][0]).not.toHaveProperty('total');
      expect(vaciarCarrito).toHaveBeenCalled();
    });

    it('si ms-ordenes rechaza la compra abre el resumen de fallo con la orden fallida y no vacía el carrito', async () => {
      mocks.crearOrden.mockRejectedValue(rechazo('Sin stock', 'fall-9'));
      const { user, vaciarCarrito } = renderCheckout();
      await completar(user);
      await user.click(screen.getByRole('button', { name: 'Pagar $20.000' }));
      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/resumen-compra', {
        state: { exito: false, motivo: 'Sin stock', ordenId: 'fall-9' },
      }));
      expect(vaciarCarrito).not.toHaveBeenCalled();
    });

    it('muestra "Procesando pago..." mientras la orden no responde', async () => {
      let resolver;
      mocks.crearOrden.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
      const { user } = renderCheckout();
      await completar(user);
      await user.click(screen.getByRole('button', { name: 'Pagar $20.000' }));
      expect(screen.getByRole('button', { name: 'Procesando pago...' })).toBeDisabled();
      resolver({ orden_id: 'ord-1', total: 20000, estado: 'exitosa' });
      await waitFor(() => expect(navigate).toHaveBeenCalled());
    });

    it('si ms-ordenes no responde abre el resumen de fallo sin id de orden', async () => {
      mocks.crearOrden.mockRejectedValue(Object.assign(new Error('No se pudo conectar con el servidor.'), { status: 0 }));
      const { user, vaciarCarrito } = renderCheckout();
      await completar(user);
      await user.click(screen.getByRole('button', { name: 'Pagar $20.000' }));
      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/resumen-compra', {
        state: { exito: false, motivo: 'No se pudo conectar con el servidor.', ordenId: null },
      }));
      expect(vaciarCarrito).not.toHaveBeenCalled();
    });

    it('sin teléfono envía null', async () => {
      const { user } = renderCheckout();
      await completar(user);
      fireEvent.change(campo('Teléfono (Opcional)'), { target: { value: '' } });
      await user.click(screen.getByRole('button', { name: 'Pagar $20.000' }));
      await waitFor(() => expect(navigate).toHaveBeenCalled());
      expect(mocks.crearOrden).toHaveBeenCalledWith(expect.objectContaining({ telefono: null }));
    });

    it('permite cambiar el método de pago', async () => {
      const { user } = renderCheckout();
      const metodo = screen.getByDisplayValue('Tarjeta de crédito/débito');
      await user.selectOptions(metodo, 'transferencia');
      expect(metodo).toHaveValue('transferencia');
    });
  });
});
