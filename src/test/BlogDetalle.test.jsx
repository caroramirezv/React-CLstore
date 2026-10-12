import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BlogDetalle from '../pages/BlogDetalle';
import { cadena } from '../test/cadenaSupabase';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

const blog = {
  id: 'guia-pc',
  titulo: 'Cómo armar un PC',
  imagen: 'pc.jpg',
  contenido: ['Elige la placa primero.', 'Después el procesador.'],
  fuente_nombre: 'Equipo CLstore',
  fuente_url: 'https://clstore.example/guia',
};

function renderDetalle(data = blog) {
  mocks.from.mockImplementation(() => cadena(() => ({ data })));
  render(
    <MemoryRouter initialEntries={['/blogs/guia-pc']}>
      <Routes>
        <Route path="/blogs/:id" element={<BlogDetalle />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BlogDetalle', () => {
  afterEach(() => {
    document.title = '';
  });

  it('muestra "Cargando artículo..." mientras espera', async () => {
    let resolver;
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: () => new Promise((resolve) => { resolver = resolve; }) }) }),
    }));
    render(
      <MemoryRouter initialEntries={['/blogs/guia-pc']}>
        <Routes>
          <Route path="/blogs/:id" element={<BlogDetalle />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Cargando artículo...')).toBeInTheDocument();
    resolver({ data: blog });
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando artículo...')).not.toBeInTheDocument();
  });

  it('renderiza título, párrafos, imagen y la fuente', async () => {
    renderDetalle();
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.getByText('Elige la placa primero.')).toBeInTheDocument();
    expect(screen.getByText('Después el procesador.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cómo armar un PC' })).toHaveAttribute('src', 'pc.jpg');
    expect(screen.getByRole('link', { name: 'Volver a Blogs' })).toHaveAttribute('href', '/blogs');
    expect(screen.getByRole('link', { name: 'Escrito por: Equipo CLstore' })).toHaveAttribute(
      'href',
      'https://clstore.example/guia'
    );
    expect(document.title).toBe('Cómo armar un PC - CLstore Blogs');
  });

  it('sin URL de fuente no muestra el crédito', async () => {
    renderDetalle({ ...blog, fuente_url: '' });
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.queryByText(/Escrito por/)).not.toBeInTheDocument();
  });

  it('avisa cuando el artículo no existe', async () => {
    renderDetalle(null);
    expect(await screen.findByText('Artículo no encontrado.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
