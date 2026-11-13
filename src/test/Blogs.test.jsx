import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Blogs from '../pages/Blogs';

const mocks = vi.hoisted(() => ({ listarBlogs: vi.fn() }));
vi.mock('../api/blogsApi', () => ({ listarBlogs: (...args) => mocks.listarBlogs(...args) }));

const articulos = [
  { id: 'guia-pc', titulo: 'Cómo armar un PC', resumen: 'Una guía corta para partir.', imagen: 'pc.jpg' },
  { id: 'ofertas', titulo: 'Ofertas de octubre', resumen: 'Lo que conviene mirar esta semana.', imagen: 'ofertas.jpg' },
];

// resultado: lista de artículos, null (sin datos) o un Error (el microservicio falla)
function renderBlogs(resultado = articulos) {
  if (resultado instanceof Error) mocks.listarBlogs.mockRejectedValue(resultado);
  else mocks.listarBlogs.mockResolvedValue(resultado);
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
    renderBlogs([]);
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
  });

  it('si ms-blogs falla no muestra artículos', async () => {
    renderBlogs(new Error('falló'));
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('si la respuesta no trae datos muestra el mensaje de \"pronto subiremos\"', async () => {
    renderBlogs(null);
    expect(await screen.findByText('Pronto subiremos nuevos artículos.')).toBeInTheDocument();
  });
});
