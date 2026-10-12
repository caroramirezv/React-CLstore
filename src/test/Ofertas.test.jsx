import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Ofertas from '../pages/Ofertas';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
const mocks = vi.hoisted(() => ({ respuesta: { data: [], error: null } }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ not: () => ({ order: () => Promise.resolve(mocks.respuesta) }) }),
    }),
  },
}));

import { useCart } from '../context/CartContext';

const ofertas = [
  { id: 1, nombre: 'Mouse Logitech', precio: 10000, imagen: 'mouse.jpg', descuento_porcentaje: 15 },
  { id: 2, nombre: 'RTX 4070', precio: 500000, imagen: 'rtx.jpg', descuento_porcentaje: 10 },
];

function renderOfertas(respuesta = { data: ofertas, error: null }) {
  const agregarProducto = vi.fn();
  useCart.mockReturnValue({ agregarProducto });
  mocks.respuesta = respuesta;
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

  it('"Agregar al Carrito" llama agregarProducto con el producto', async () => {
    const user = userEvent.setup();
    const { agregarProducto } = renderOfertas();
    const botones = await screen.findAllByRole('button', { name: /Agregar al Carrito/ });
    await user.click(botones[0]);
    expect(agregarProducto).toHaveBeenCalledWith(ofertas[0]);
  });

  it('sin ofertas muestra el mensaje de que no hay ofertas activas', async () => {
    renderOfertas({ data: [], error: null });
    expect(await screen.findByText(/No hay ofertas activas/)).toBeInTheDocument();
  });

  it('si Supabase devuelve error muestra el mensaje de sin ofertas', async () => {
    renderOfertas({ data: null, error: { message: 'falló' } });
    expect(await screen.findByText(/No hay ofertas activas/)).toBeInTheDocument();
  });

  it('si la respuesta no trae datos ni error muestra el mensaje de sin ofertas', async () => {
    renderOfertas({ data: null, error: null });
    expect(await screen.findByText(/No hay ofertas activas/)).toBeInTheDocument();
  });
});
