import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DetalleProducto from '../pages/DetalleProducto';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));

// La ficha usa ms-productos (producto y relacionados) y ms-resenas (reseñas).
const mocks = vi.hoisted(() => ({
  producto: null, // lo que devuelve obtenerProducto: el producto, null, o un Error (404 / sin conexión)
  resenas: [], // lo que devuelve listarResenas: la lista, null, o un thenable/promesa para simular demoras y fallos
  listarResenas: vi.fn(),
  relacionados: [], // lo que devuelve listarProductos
  listarProductos: vi.fn(),
}));
vi.mock('../api/productosApi', () => ({
  obtenerProducto: () => (mocks.producto instanceof Error ? Promise.reject(mocks.producto) : Promise.resolve(mocks.producto)),
  listarProductos: (...args) => {
    mocks.listarProductos(...args);
    return Promise.resolve(mocks.relacionados);
  },
}));
vi.mock('../api/resenasApi', () => ({
  listarResenas: (...args) => {
    mocks.listarResenas(...args);
    return Promise.resolve(mocks.resenas);
  },
}));

import { useCart } from '../context/CartContext';

const mouse = {
  id: 1,
  nombre: 'Mouse Logitech',
  precio: 10000,
  imagen: 'mouse.jpg',
  categoria: 'perifericos',
  descuento_porcentaje: null,
  descripcion: 'Un mouse óptico.',
  especificaciones: { Marca: 'Logitech', DPI: '16000' },
  destacado: { titulo: 'Ideal para gamers', texto: 'Sensor de alta precisión.' },
};

function renderDetalle({ producto = mouse, resenas = [], relacionados = [] } = {}) {
  const agregarProducto = vi.fn();
  useCart.mockReturnValue({ agregarProducto });
  mocks.producto = producto;
  mocks.resenas = resenas;
  mocks.listarResenas.mockClear();
  mocks.relacionados = relacionados;
  mocks.listarProductos.mockClear();
  const { unmount } = render(
    <MemoryRouter initialEntries={['/productos/1']}>
      <Routes>
        <Route path="/productos/:id" element={<DetalleProducto />} />
      </Routes>
    </MemoryRouter>
  );
  return { agregarProducto, unmount };
}

const titulo = () => screen.findByRole('heading', { level: 2, name: /Mouse Logitech/ });

describe('DetalleProducto', () => {
  it('muestra "Cargando producto..." y luego el detalle', async () => {
    renderDetalle();
    expect(screen.getByText('Cargando producto...')).toBeInTheDocument();
    await titulo();
    expect(screen.queryByText('Cargando producto...')).not.toBeInTheDocument();
  });

  it('muestra nombre, precio, descripción y especificaciones', async () => {
    renderDetalle();
    expect(await titulo()).toHaveTextContent('$10.000');
    expect(screen.getByText('Un mouse óptico.')).toBeInTheDocument();
    expect(screen.getByText('Marca')).toBeInTheDocument();
    expect(screen.getByText('Logitech')).toBeInTheDocument();
    expect(screen.getByText('DPI')).toBeInTheDocument();
    expect(screen.getByText('16000')).toBeInTheDocument();
  });

  it('en oferta muestra el descuento, el precio original y el precio final', async () => {
    renderDetalle({ producto: { ...mouse, descuento_porcentaje: 15 } });
    await titulo();
    expect(screen.getByText('-15%')).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toBeInTheDocument();
    expect(screen.getByText('$8.500')).toBeInTheDocument();
  });

  it('sin descripción ni especificaciones usa los textos por defecto', async () => {
    renderDetalle({ producto: { ...mouse, descripcion: null, especificaciones: null, destacado: null } });
    await titulo();
    expect(screen.getByText(/Disfruta del máximo rendimiento con tu Mouse Logitech/)).toBeInTheDocument();
    expect(screen.getByText('Especificaciones no disponibles')).toBeInTheDocument();
    expect(screen.getByText('Calidad Garantizada')).toBeInTheDocument();
  });

  it('muestra el bloque destacado del producto', async () => {
    renderDetalle();
    await titulo();
    expect(screen.getByText('Ideal para gamers')).toBeInTheDocument();
    expect(screen.getByText('Sensor de alta precisión.')).toBeInTheDocument();
  });

  it('"Agregar al carrito" llama agregarProducto con el producto', async () => {
    const user = userEvent.setup();
    const { agregarProducto } = renderDetalle();
    await titulo();
    await user.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    expect(agregarProducto).toHaveBeenCalledWith(mouse);
  });

  it('lista las reseñas del producto', async () => {
    renderDetalle({
      resenas: [{ id: 1, usuario: 'Ana', fecha: '2026-10-01', calificacion: 5, comentario: 'Excelente mouse' }],
    });
    await titulo();
    expect(await screen.findByText('Excelente mouse')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('sin reseñas invita a ser el primero en opinar', async () => {
    renderDetalle();
    await titulo();
    expect(await screen.findByText(/aún no tiene reseñas/)).toBeInTheDocument();
  });

  it('muestra los productos relacionados sin botón de agregar', async () => {
    renderDetalle({
      relacionados: [{ id: 2, nombre: 'Teclado Logitech', precio: 20000, imagen: 'teclado.jpg', categoria: 'perifericos' }],
    });
    await titulo();
    expect(await screen.findByRole('heading', { level: 5, name: 'Teclado Logitech' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar al Carrito/ })).not.toBeInTheDocument();
  });

  it('sin relacionados avisa que no hay otros productos en la categoría', async () => {
    renderDetalle();
    await titulo();
    expect(await screen.findByText('No hay otros productos en esta categoría.')).toBeInTheDocument();
  });

  it('pide a ms-resenas las reseñas del producto por su id', async () => {
    renderDetalle();
    await titulo();
    expect(mocks.listarResenas).toHaveBeenCalledWith(1);
  });

  it('pide a ms-productos 3 relacionados de la misma categoría, sin el propio producto', async () => {
    renderDetalle();
    await titulo();
    await screen.findByText('No hay otros productos en esta categoría.');
    expect(mocks.listarProductos).toHaveBeenCalledWith({ categoria: 'perifericos', excluir: 1, limit: 3 });
  });

  it('si ms-productos responde 404 o no responde muestra "Producto no encontrado."', async () => {
    renderDetalle({ producto: new Error('No existe el producto') });
    expect(await screen.findByText('Producto no encontrado.')).toBeInTheDocument();
  });

  it('si ms-resenas falla la ficha se muestra igual, sin reseñas', async () => {
    renderDetalle();
    mocks.resenas = { then: (_resolver, rechazar) => rechazar(new Error('ms-resenas caído')) }; // rechaza solo al consumirse
    await titulo();
    expect(await screen.findByText(/aún no tiene reseñas/)).toBeInTheDocument();
  });

  it('si el producto no existe muestra "Producto no encontrado."', async () => {
    renderDetalle({ producto: null });
    expect(await screen.findByText('Producto no encontrado.')).toBeInTheDocument();
  });

  it('las reseñas y relacionados sin datos se tratan como listas vacías', async () => {
    renderDetalle();
    mocks.resenas = null;
    mocks.relacionados = null;
    await titulo();
    expect(await screen.findByText(/aún no tiene reseñas/)).toBeInTheDocument();
    expect(await screen.findByText('No hay otros productos en esta categoría.')).toBeInTheDocument();
  });

  it('una reseña de 3 estrellas dibuja 3 llenas y 2 vacías', async () => {
    renderDetalle({
      resenas: [{ id: 1, usuario: 'Luis', fecha: '2026-10-02', calificacion: 3, comentario: 'Cumple sin más' }],
    });
    await titulo();
    const cuerpo = (await screen.findByText('Cumple sin más')).closest('.card-body');
    expect(cuerpo.querySelectorAll('.fa-solid.fa-star')).toHaveLength(3);
    expect(cuerpo.querySelectorAll('.fa-regular.fa-star')).toHaveLength(2);
  });

  describe('si se sale de la página antes de terminar de cargar', () => {
    const tick = () => act(() => new Promise((resolver) => setTimeout(resolver, 0)));

    it('no actualiza nada si se desmonta antes de recibir el producto', async () => {
      const { unmount } = renderDetalle();
      unmount();
      await tick();
      expect(screen.queryByText('Cargando producto...')).not.toBeInTheDocument();
    });

    it('deja de cargar si se desmonta mientras llegan las reseñas', async () => {
      const { unmount } = renderDetalle();
      let liberarResenas;
      mocks.resenas = new Promise((resolver) => { liberarResenas = resolver; });
      await tick(); // el producto ya llegó; las reseñas siguen pendientes
      unmount();
      liberarResenas([]);
      await tick();
      expect(screen.queryByText('Cargando producto...')).not.toBeInTheDocument();
    });

    it('deja de cargar si se desmonta mientras llegan los relacionados', async () => {
      const { unmount } = renderDetalle();
      let liberarRelacionados;
      mocks.relacionados = new Promise((resolver) => { liberarRelacionados = resolver; });
      await tick(); // producto y reseñas ya llegaron; los relacionados siguen pendientes
      unmount();
      liberarRelacionados([]);
      await tick();
      expect(screen.queryByText('Cargando producto...')).not.toBeInTheDocument();
    });
  });
});
