import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BlogDetalle from '../pages/BlogDetalle';

const mocks = vi.hoisted(() => ({ respuesta: { data: null } }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve(mocks.respuesta) }) }),
    }),
  },
}));

const blog = {
  id: 'guia-pc',
  titulo: 'Cómo armar un PC',
  imagen: 'pc.jpg',
  contenido: ['Primer párrafo.', 'Segundo párrafo.'],
  fuente_nombre: 'Ana Pérez',
  fuente_url: 'https://ejemplo.cl/nota',
};

function renderDetalle(data) {
  mocks.respuesta = { data };
  render(
    <MemoryRouter initialEntries={['/blogs/guia-pc']}>
      <Routes>
        <Route path="/blogs/:id" element={<BlogDetalle />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BlogDetalle', () => {
  it('muestra "Cargando artículo..." y luego el contenido', async () => {
    renderDetalle(blog);
    expect(screen.getByText('Cargando artículo...')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Cómo armar un PC' });
    expect(screen.queryByText('Cargando artículo...')).not.toBeInTheDocument();
  });

  it('muestra título, imagen y un párrafo por cada elemento del contenido', async () => {
    renderDetalle(blog);
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cómo armar un PC' })).toHaveAttribute('src', 'pc.jpg');
    expect(screen.getByText('Primer párrafo.')).toBeInTheDocument();
    expect(screen.getByText('Segundo párrafo.')).toBeInTheDocument();
  });

  it('actualiza el título de la pestaña', async () => {
    renderDetalle(blog);
    await screen.findByRole('heading', { name: 'Cómo armar un PC' });
    expect(document.title).toBe('Cómo armar un PC - CLstore Blogs');
  });

  it('muestra el enlace a la fuente con el nombre del autor', async () => {
    renderDetalle(blog);
    const enlace = await screen.findByRole('link', { name: 'Escrito por: Ana Pérez' });
    expect(enlace).toHaveAttribute('href', 'https://ejemplo.cl/nota');
  });

  it('sin fuente_nombre usa "Equipo CLstore" como autor', async () => {
    renderDetalle({ ...blog, fuente_nombre: null });
    expect(await screen.findByRole('link', { name: 'Escrito por: Equipo CLstore' })).toBeInTheDocument();
  });

  it('sin fuente_url no muestra el enlace de autor', async () => {
    renderDetalle({ ...blog, fuente_url: null });
    await screen.findByRole('heading', { name: 'Cómo armar un PC' });
    expect(screen.queryByText(/Escrito por/)).not.toBeInTheDocument();
  });

  it('el botón "Volver a Blogs" apunta a /blogs', async () => {
    renderDetalle(blog);
    expect(await screen.findByRole('link', { name: 'Volver a Blogs' })).toHaveAttribute('href', '/blogs');
  });

  it('si el artículo no existe muestra "Artículo no encontrado."', async () => {
    renderDetalle(null);
    expect(await screen.findByText('Artículo no encontrado.')).toBeInTheDocument();
  });

  it('sin contenido muestra el artículo sin párrafos', async () => {
    renderDetalle({ ...blog, contenido: null });
    expect(await screen.findByRole('heading', { name: 'Cómo armar un PC' })).toBeInTheDocument();
    expect(screen.queryByText('Primer párrafo.')).not.toBeInTheDocument();
  });
});
