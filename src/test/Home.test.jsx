import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';
import { cadena } from '../test/cadenaSupabase';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

import { useAuth } from '../context/AuthContext';

const destacados = [
  { id: 1, nombre: 'Mouse Logitech', precio: 10000, imagen: 'mouse.jpg' },
  { id: 2, nombre: 'RTX 4070', precio: 500000, imagen: 'rtx.jpg' },
  { id: 3, nombre: 'Nintendo Switch', precio: 300000, imagen: 'switch.jpg' },
];

function renderHome(perfil = null, data = destacados) {
  useAuth.mockReturnValue({ perfil });
  mocks.from.mockImplementation(() => cadena(() => ({ data })));
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

describe('Home', () => {
  describe('carrusel', () => {
    it('muestra los tres banners con su destino', () => {
      renderHome();
      expect(screen.getByRole('link', { name: 'Ir a todos los productos' })).toHaveAttribute('href', '/ofertas');
      expect(screen.getByRole('link', { name: 'Ir a productos de la categoría Componentes' })).toHaveAttribute(
        'href',
        '/productos?categoria=Componentes'
      );
      expect(screen.getByRole('link', { name: 'Ir a las ofertas' })).toHaveAttribute('href', '/productos');
      expect(screen.getByRole('button', { name: 'Banner anterior' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Banner siguiente' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mostrar productos' })).toHaveAttribute('aria-current', 'true');
    });
  });

  describe('saludo de sesión', () => {
    it('saluda con el nombre del perfil', () => {
      renderHome({ nombre: 'Ana' });
      expect(screen.getByRole('heading', { name: '¡Bienvenido/a de nuevo, Ana!' })).toBeInTheDocument();
    });

    it('no saluda cuando no hay perfil', () => {
      renderHome(null);
      expect(screen.queryByText(/Bienvenido/)).not.toBeInTheDocument();
    });
  });

  describe('productos destacados', () => {
    it('renderiza los tres productos que devuelve Supabase', async () => {
      renderHome();
      expect(await screen.findByRole('heading', { name: 'Mouse Logitech' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'RTX 4070' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Nintendo Switch' })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 5 })).toHaveLength(3);
    });

    it('si no hay datos deja la grilla vacía y mantiene los accesos', async () => {
      renderHome(null, null);
      expect(await screen.findByRole('heading', { name: 'Productos Destacados' })).toBeInTheDocument();
      expect(screen.queryAllByRole('heading', { level: 5 })).toHaveLength(0);
      expect(screen.getByRole('link', { name: /Ver catálogo completo/ })).toHaveAttribute('href', '/productos');
      expect(screen.getByRole('link', { name: /Ver Ofertas/ })).toHaveAttribute('href', '/ofertas');
    });
  });
});
