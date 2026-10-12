import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const mocks = vi.hoisted(() => ({ respuesta: { data: [] } }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => ({ limit: () => Promise.resolve(mocks.respuesta) }) }),
    }),
  },
}));

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const destacados = [
  { id: 1, nombre: 'Mouse Logitech', precio: 10000, imagen: 'mouse.jpg' },
  { id: 2, nombre: 'RTX 4070', precio: 500000, imagen: 'rtx.jpg' },
  { id: 3, nombre: 'Nintendo Switch', precio: 300000, imagen: 'switch.jpg' },
];

async function renderHome({ perfil = null, data = destacados } = {}) {
  useCart.mockReturnValue({ agregarProducto: vi.fn() });
  useAuth.mockReturnValue({ perfil });
  mocks.respuesta = { data };
  // act asíncrono: deja terminar la consulta de destacados antes de seguir
  await act(async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
  });
}

describe('Home', () => {
  it('muestra los productos destacados sin botón de agregar al carrito', async () => {
    await renderHome();
    expect(screen.getByRole('heading', { name: 'Productos Destacados' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Mouse Logitech' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RTX 4070' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nintendo Switch' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar al Carrito/ })).not.toBeInTheDocument();
  });

  it('sin destacados no muestra tarjetas', async () => {
    await renderHome({ data: null });
    expect(screen.getByRole('heading', { name: 'Productos Destacados' })).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 5 })).toHaveLength(0);
  });

  it('el carrusel enlaza a ofertas y productos', async () => {
    await renderHome();
    expect(screen.getByRole('link', { name: 'Ir a todos los productos' })).toHaveAttribute('href', '/ofertas');
    expect(screen.getByRole('link', { name: 'Ir a las ofertas' })).toHaveAttribute('href', '/productos');
    expect(screen.getByRole('link', { name: /Ir a productos de la categoría Componentes/ })).toHaveAttribute(
      'href',
      '/productos?categoria=Componentes'
    );
  });

  it('muestra los enlaces al catálogo completo y a las ofertas', async () => {
    await renderHome();
    expect(screen.getByRole('link', { name: /Ver catálogo completo/ })).toHaveAttribute('href', '/productos');
    expect(screen.getByRole('link', { name: /Ver Ofertas/ })).toHaveAttribute('href', '/ofertas');
  });

  it('saluda por nombre cuando hay perfil', async () => {
    await renderHome({ perfil: { nombre: 'Ana' } });
    expect(screen.getByText('¡Bienvenido/a de nuevo, Ana!')).toBeInTheDocument();
  });

  it('no muestra saludo cuando no hay perfil', async () => {
    await renderHome({ perfil: null });
    expect(screen.queryByText(/Bienvenido\/a de nuevo/)).not.toBeInTheDocument();
  });
});
