import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Ofertas from '../pages/Ofertas';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
const mocks = vi.hoisted(() => ({ listarProductos: vi.fn() }));
vi.mock('../api/productosApi', () => ({ listarProductos: (...args) => mocks.listarProductos(...args) }));

import { useCart } from '../context/CartContext';

const ofertas = [
  { id: 1, nombre: 'Mouse Logitech', precio: 10000, imagen: 'mouse.jpg', descuento_porcentaje: 15 },
  { id: 2, nombre: 'RTX 4070', precio: 500000, imagen: 'rtx.jpg', descuento_porcentaje: 10 },
];

// resultado: lista de productos, null (sin datos) o un Error (el microservicio falla)
function renderOfertas(resultado = ofertas) {
  const agregarProducto = vi.fn();
  useCart.mockReturnValue({ agregarProducto });
  if (resultado instanceof Error) mocks.listarProductos.mockRejectedValue(resultado);
  else mocks.listarProductos.mockResolvedValue(resultado);
  render(
    <MemoryRouter>
      <Ofertas />
    </MemoryRouter>
  );
  return { agregarProducto };
}

describe('Ofertas', () => {
  it('muestra "Cargando ofertas..." y luego los productos', async () => {
    renderOfertas();
    expect(screen.getByText('Cargando ofertas...')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Mouse Logitech' });
    expect(screen.queryByText('Cargando ofertas...')).not.toBeInTheDocument();
  });

  it('renderiza una tarjeta por oferta con su descuento y precio final', async () => {
    renderOfertas();
    expect(await screen.findByRole('heading', { name: 'Mouse Logitech' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RTX 4070' })).toBeInTheDocument();
    expect(screen.getByText('-15%')).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toBeInTheDocument(); // precio original tachado
    expect(screen.getByText('$8.500')).toBeInTheDocument(); // 10.000 con 15% dto
  });

  it('pide a ms-productos solo las ofertas, de mayor a menor descuento', async () => {
    renderOfertas();
    await screen.findByRole('heading', { name: 'Mouse Logitech' });
    expect(mocks.listarProductos).toHaveBeenCalledWith({ oferta: true, orden: 'descuento_desc' });
  });

  it('"Agregar al Carrito" llama agregarProducto con el producto', async () => {
    const user = userEvent.setup();
    const { agregarProducto } = renderOfertas();
    const botones = await screen.findAllByRole('button', { name: /Agregar al Carrito/ });
    await user.click(botones[0]);
    expect(agregarProducto).toHaveBeenCalledWith(ofertas[0]);
  });

  it('sin ofertas muestra el mensaje de que no hay ofertas activas', async () => {
    renderOfertas([]);
    expect(await screen.findByText(/No hay ofertas activas/)).toBeInTheDocument();
  });

  it('si ms-productos falla muestra el mensaje de sin ofertas', async () => {
    renderOfertas(new Error('falló'));
    expect(await screen.findByText(/No hay ofertas activas/)).toBeInTheDocument();
  });

  it('si la respuesta no trae datos muestra el mensaje de sin ofertas', async () => {
    renderOfertas(null);
    expect(await screen.findByText(/No hay ofertas activas/)).toBeInTheDocument();
  });
});
