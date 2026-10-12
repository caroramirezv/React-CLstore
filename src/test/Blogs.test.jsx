import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Blogs from '../pages/Blogs';

const mocks = vi.hoisted(() => ({ respuesta: { data: [], error: null } }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve(mocks.respuesta) }) }),
  },
}));

const articulos = [
  { id: 'guia-pc', titulo: 'Cómo armar un PC', resumen: 'Una guía corta para partir.', imagen: 'pc.jpg' },
  { id: 'ofertas', titulo: 'Ofertas de octubre', resumen: 'Lo que conviene mirar esta semana.', imagen: 'ofertas.jpg' },
];

function renderBlogs(respuesta = { data: articulos, error: null }) {
  mocks.respuesta = respuesta;
  render(
    <MemoryRouter>
      <Blogs />
    </MemoryRouter>
  );
}

describe('Blogs', () => {
  it('muestra "Cargando artículos..." y luego desaparece', async () => {
    renderBlogs();
    expect(screen.getByText('Cargando artículos...')).toBeInTheDocument();
    await screen.findByText('Cómo armar un PC');
    expect(screen.queryByText('Cargando artículos...')).not.toBeInTheDocument();
  });

  it('renderiza una tarjeta por artículo con título y resumen', async () => {
    renderBlogs();
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ofertas de octubre' })).toBeInTheDocument();
    expect(screen.getByText('Una guía corta para partir.')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('cada "LEER MÁS" apunta al detalle del artículo', async () => {
    renderBlogs();
    const enlaces = await screen.findAllByRole('link', { name: 'LEER MÁS' });
    expect(enlaces[0]).toHaveAttribute('href', '/blogs/guia-pc');
    expect(enlaces[1]).toHaveAttribute('href', '/blogs/ofertas');
  });

  it('sin artículos muestra el mensaje de "pronto subiremos"', async () => {
    renderBlogs({ data: [], error: null });
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
  });

  it('si Supabase devuelve error no muestra artículos', async () => {
    renderBlogs({ data: null, error: { message: 'falló' } });
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('si la respuesta no trae datos ni error muestra el mensaje de \"pronto subiremos\"', async () => {
    renderBlogs({ data: null, error: null });
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
  });
});
