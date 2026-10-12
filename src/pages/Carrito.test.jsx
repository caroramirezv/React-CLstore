import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Carrito from './Carrito';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const item = (id, nombre, precio, cantidad, descuento = null) => ({
  producto_id: id,
  cantidad,
  productos: { id, nombre, precio, imagen: `${nombre}.jpg`, descuento_porcentaje: descuento },
});

function renderCarrito({ items = [], total = 0, usuario = { id: 'u1' } } = {}) {
  const acciones = { cambiarCantidad: vi.fn(), eliminarProducto: vi.fn() };
  useCart.mockReturnValue({ items, total, ...acciones });
  useAuth.mockReturnValue({ usuario });
  render(
    <MemoryRouter>
      <Carrito />
    </MemoryRouter>
  );
  return acciones;
}

describe('Carrito', () => {
  describe('carrito vacío', () => {
    it('muestra el mensaje de vacío y deshabilita "Proceder al Pago"', () => {
      renderCarrito();
      expect(screen.getByText('Tu carrito está vacío.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Proceder al Pago' })).toBeDisabled();
    });
  });

  describe('carrito con productos', () => {
    const items = [item(1, 'Mouse', 10000, 2), item(2, 'Teclado', 20000, 1, 10)];

    it('renderiza una fila por producto con su subtotal', () => {
      renderCarrito({ items, total: 38000 });
      expect(screen.getByText('Mouse')).toBeInTheDocument();
      expect(screen.getByText('Teclado')).toBeInTheDocument();
      expect(screen.getByText('$20.000', { selector: 'td' })).toBeInTheDocument(); // subtotal Mouse 2 x 10.000
      expect(screen.getByText('$18.000', { selector: 'td' })).toBeInTheDocument(); // subtotal Teclado con 10% dto
    });

    it('muestra el total del resumen y habilita el pago', () => {
      renderCarrito({ items, total: 38000 });
      expect(screen.getAllByText('$38.000')).toHaveLength(2); // Subtotal y Total del resumen
      expect(screen.getByRole('button', { name: 'Proceder al Pago' })).toBeEnabled();
    });

    it('los botones + y − llaman cambiarCantidad con +1 / −1', async () => {
      const user = userEvent.setup();
      const { cambiarCantidad } = renderCarrito({ items, total: 38000 });
      await user.click(screen.getByRole('button', { name: 'Aumentar cantidad de Mouse' }));
      await user.click(screen.getByRole('button', { name: 'Disminuir cantidad de Mouse' }));
      expect(cambiarCantidad).toHaveBeenNthCalledWith(1, 1, 1);
      expect(cambiarCantidad).toHaveBeenNthCalledWith(2, 1, -1);
    });

    it('el botón de eliminar llama eliminarProducto con el id', async () => {
      const user = userEvent.setup();
      const { eliminarProducto } = renderCarrito({ items, total: 38000 });
      await user.click(screen.getByRole('button', { name: 'Eliminar Teclado' }));
      expect(eliminarProducto).toHaveBeenCalledWith(2);
    });

    it('"Proceder al Pago" navega a /pagar', async () => {
      const user = userEvent.setup();
      renderCarrito({ items, total: 38000 });
      await user.click(screen.getByRole('button', { name: 'Proceder al Pago' }));
      expect(navigate).toHaveBeenCalledWith('/pagar');
    });
  });

  describe('aviso de invitado', () => {
    it('se muestra cuando no hay sesión', () => {
      renderCarrito({ usuario: null });
      expect(screen.getByText(/comprando como invitado/i)).toBeInTheDocument();
    });

    it('no se muestra con sesión iniciada', () => {
      renderCarrito({ usuario: { id: 'u1' } });
      expect(screen.queryByText(/comprando como invitado/i)).not.toBeInTheDocument();
    });
  });
});
