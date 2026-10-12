import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Productos from '../pages/Productos';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));

const mocks = vi.hoisted(() => ({ respuesta: { data: [], error: null } }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: () => ({ select: () => Promise.resolve(mocks.respuesta) }) },
}));

import { useCart } from '../context/CartContext';

const catalogo = [
  { id: 1, nombre: 'Mouse Logitech', precio: 10000, imagen: 'mouse.jpg', categoria: 'perifericos', busqueda: 'mouse raton' },
  { id: 2, nombre: 'RTX 4070', precio: 500000, imagen: 'rtx.jpg', categoria: 'componentes', busqueda: 'tarjeta grafica' },
  { id: 3, nombre: 'Nintendo Switch', precio: 300000, imagen: 'switch.jpg', categoria: 'consolas', busqueda: 'consola' },
];

// Renderiza la página y espera a que termine la carga inicial.
async function renderProductos() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Productos />
    </MemoryRouter>
  );
  await screen.findByRole('heading', { name: 'Mouse Logitech' });
  return user;
}

const tarjeta = (nombre) => screen.queryByRole('heading', { name: nombre });

describe('Productos', () => {
  beforeEach(() => {
    useCart.mockReturnValue({ agregarProducto: vi.fn() });
    mocks.respuesta = { data: catalogo, error: null };
  });

  describe('carga y renderizado', () => {
    it('muestra "Cargando productos..." mientras espera los datos', async () => {
      render(
        <MemoryRouter>
          <Productos />
        </MemoryRouter>
      );
      expect(screen.getByText('Cargando productos...')).toBeInTheDocument();
      await screen.findByRole('heading', { name: 'Mouse Logitech' });
      expect(screen.queryByText('Cargando productos...')).not.toBeInTheDocument();
    });

    it('renderiza una tarjeta por cada producto', async () => {
      await renderProductos();
      expect(screen.getAllByRole('heading', { level: 5 })).toHaveLength(3);
      expect(tarjeta('RTX 4070')).toBeInTheDocument();
      expect(tarjeta('Nintendo Switch')).toBeInTheDocument();
    });

    it('si Supabase devuelve error no muestra productos y avisa que no hay resultados', async () => {
      mocks.respuesta = { data: null, error: { message: 'falló' } };
      render(
        <MemoryRouter>
          <Productos />
        </MemoryRouter>
      );
      expect(await screen.findByText('No se encontraron productos.')).toBeInTheDocument();
      expect(screen.queryByText('Cargando productos...')).not.toBeInTheDocument();
    });
  });

  describe('filtro por categoría', () => {
    it('al elegir "Componentes" muestra solo los de esa categoría', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: 'Componentes' }));
      expect(tarjeta('RTX 4070')).toBeInTheDocument();
      expect(tarjeta('Mouse Logitech')).not.toBeInTheDocument();
      expect(tarjeta('Nintendo Switch')).not.toBeInTheDocument();
    });

    it('el botón seleccionado queda marcado como activo', async () => {
      const user = await renderProductos();
      expect(screen.getByRole('button', { name: 'Todos' })).toHaveClass('active');
      await user.click(screen.getByRole('button', { name: 'Consolas & Laptops' }));
      expect(screen.getByRole('button', { name: 'Consolas & Laptops' })).toHaveClass('active');
      expect(screen.getByRole('button', { name: 'Todos' })).not.toHaveClass('active');
    });

    it('"Todos" vuelve a mostrar el catálogo completo', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: 'Componentes' }));
      await user.click(screen.getByRole('button', { name: 'Todos' }));
      expect(screen.getAllByRole('heading', { level: 5 })).toHaveLength(3);
    });
  });

  describe('búsqueda por texto', () => {
    it('filtra por nombre sin distinguir mayúsculas', async () => {
      const user = await renderProductos();
      await user.type(screen.getByPlaceholderText('Buscar productos...'), 'rtx');
      expect(tarjeta('RTX 4070')).toBeInTheDocument();
      expect(tarjeta('Mouse Logitech')).not.toBeInTheDocument();
    });

    it('también busca en el campo "busqueda" del producto', async () => {
      const user = await renderProductos();
      await user.type(screen.getByPlaceholderText('Buscar productos...'), 'raton');
      expect(tarjeta('Mouse Logitech')).toBeInTheDocument();
      expect(tarjeta('RTX 4070')).not.toBeInTheDocument();
    });

    it('sin coincidencias muestra "No se encontraron productos."', async () => {
      const user = await renderProductos();
      await user.type(screen.getByPlaceholderText('Buscar productos...'), 'zzzz');
      expect(screen.getByText('No se encontraron productos.')).toBeInTheDocument();
      expect(screen.queryAllByRole('heading', { level: 5 })).toHaveLength(0);
    });

    it('combina categoría y texto (ambos deben coincidir)', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: 'Periféricos & Monitores' }));
      await user.type(screen.getByPlaceholderText('Buscar productos...'), 'rtx');
      expect(screen.getByText('No se encontraron productos.')).toBeInTheDocument();
    });
  });
});
