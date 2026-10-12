import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Blogs from '../pages/Blogs';


// Mock directo y nativo de Supabase (sin usar cadenaSupabase)
const mockOrder = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: mockOrder,
      }),
    }),
  },
}));

const articulos = [
  { id: 'guia-pc', titulo: 'Cómo armar un PC', resumen: 'Una guía corta para partir.', imagen: 'pc.jpg' },
  { id: 'ofertas', titulo: 'Ofertas de octubre', resumen: 'Lo que conviene mirar esta semana.', imagen: 'ofertas.jpg' },
];

function renderBlogs(respuesta = { data: articulos, error: null }) {
  mockOrder.mockResolvedValue(respuesta);
  render(
    <MemoryRouter>
      <Blogs />
    </MemoryRouter>
  );
}

describe('Blogs', () => {
  it('muestra "Cargando artículos..." mientras espera', async () => {
    let resolver;
    mockOrder.mockImplementation(() => ({
      select: () => ({ order: () => new Promise((resolve) => { resolver = resolve; }) }),
    }));
    render(
      <MemoryRouter>
        <Blogs />
      </MemoryRouter>
    );
    expect(screen.getByText('Cargando artículos...')).toBeInTheDocument();
    resolver({ data: articulos, error: null });
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando artículos...')).not.toBeInTheDocument();
  });

  it('renderiza una tarjeta por artículo con su enlace', async () => {
    renderBlogs();
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.getByText('Una guía corta para partir.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ofertas de octubre' })).toBeInTheDocument();
    const enlaces = screen.getAllByRole('link', { name: 'LEER MÁS' });
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0]).toHaveAttribute('href', '/blogs/guia-pc');
    expect(screen.getByRole('img', { name: 'Cómo armar un PC' })).toHaveAttribute('src', 'pc.jpg');
  });

  it('sin artículos avisa que pronto habrá contenido', async () => {
    renderBlogs({ data: [], error: null });
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'LEER MÁS' })).not.toBeInTheDocument();
  });

  it('si Supabase devuelve error no muestra artículos', async () => {
    renderBlogs({ data: null, error: { message: 'falló' } });
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});
