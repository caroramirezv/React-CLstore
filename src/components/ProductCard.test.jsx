import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
import { useCart } from '../context/CartContext';

const productoNormal = { id: 7, nombre: 'Mouse Logitech', precio: 10000, imagen: 'mouse.jpg', descuento_porcentaje: null };
const productoOferta = { id: 8, nombre: 'Teclado Gamer', precio: 10000, imagen: 'teclado.jpg', descuento_porcentaje: 20 };

function renderCard(props) {
  return render(
    <MemoryRouter>
      <ProductCard {...props} />
    </MemoryRouter>
  );
}

describe('ProductCard', () => {
  const agregarProducto = vi.fn();

  beforeEach(() => {
    useCart.mockReturnValue({ agregarProducto });
  });

  describe('renderizado', () => {
    it('muestra nombre, imagen y precio formateado', () => {
      renderCard({ producto: productoNormal });
      expect(screen.getByRole('heading', { name: 'Mouse Logitech' })).toBeInTheDocument();
      expect(screen.getByAltText('Mouse Logitech')).toHaveAttribute('src', 'mouse.jpg');
      expect(screen.getByText('$10.000')).toBeInTheDocument();
    });

    it('el enlace "Más Información" apunta al detalle del producto', () => {
      renderCard({ producto: productoNormal });
      expect(screen.getByRole('link', { name: 'Más Información' })).toHaveAttribute('href', '/productos/7');
    });
  });

  describe('renderizado condicional (oferta)', () => {
    it('sin descuento NO muestra la insignia de oferta', () => {
      renderCard({ producto: productoNormal });
      expect(screen.queryByText('-20%')).not.toBeInTheDocument();
      expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
    });

    it('con descuento muestra la insignia, el precio original y el precio final', () => {
      renderCard({ producto: productoOferta });
      expect(screen.getByText('-20%')).toBeInTheDocument();
      expect(screen.getByText('$10.000')).toBeInTheDocument(); // original (tachado)
      expect(screen.getByText('$8.000')).toBeInTheDocument(); // final
    });
  });

  describe('props y eventos', () => {
    it('al hacer clic en "Agregar al Carrito" llama agregarProducto con el producto', async () => {
      const user = userEvent.setup();
      renderCard({ producto: productoNormal });
      await user.click(screen.getByRole('button', { name: /agregar al carrito/i }));
      expect(agregarProducto).toHaveBeenCalledTimes(1);
      expect(agregarProducto).toHaveBeenCalledWith(productoNormal);
    });

    it('con mostrarBotonAgregar=false oculta el botón', () => {
      renderCard({ producto: productoNormal, mostrarBotonAgregar: false });
      expect(screen.queryByRole('button', { name: /agregar al carrito/i })).not.toBeInTheDocument();
    });
  });
});
