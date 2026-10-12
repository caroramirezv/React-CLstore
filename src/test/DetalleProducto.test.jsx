import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DetalleProducto from '../pages/DetalleProducto';
import { cadena } from '../test/cadenaSupabase';

vi.mock('../context/CartContext', () => ({ useCart: vi.fn() }));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

import { useCart } from '../context/CartContext';

const producto = {
  id: 'mouse-1',
  nombre: 'Mouse Logitech',
  precio: 10000,
  imagen: 'mouse.jpg',
  categoria: 'perifericos',
  descripcion: 'Sensor preciso para el día a día.',
  especificaciones: { DPI: '1600', Conexión: 'USB' },
  descuento_porcentaje: null,
  destacado: { titulo: 'Elegido por gamers', texto: 'Agarre cómodo durante horas.' },
};

const estado = {
  producto,
  resenas: [],
  relacionados: [],
};

function renderDetalle() {
  let lecturasProducto = 0;
  const agregarProducto = vi.fn();
  useCart.mockReturnValue({ agregarProducto });
  mocks.from.mockImplementation((tabla) => {
    if (tabla === 'resenas') return cadena(() => ({ data: estado.resenas }));
    if (tabla === 'productos') {
      lecturasProducto += 1;
      const lectura = lecturasProducto;
      return cadena(() => ({ data: lectura === 1 ? estado.producto : estado.relacionados }));
    }
    return cadena(() => ({ data: null }));
  });
  render(
    <MemoryRouter initialEntries={['/producto/mouse-1']}>
      <Routes>
        <Route path="/producto/:id" element={<DetalleProducto />} />
      </Routes>
    </MemoryRouter>
  );
  return { agregarProducto, user: userEvent.setup() };
}

describe('DetalleProducto', () => {
  beforeEach(() => {
    estado.producto = producto;
    estado.resenas = [];
    estado.relacionados = [];
  });

  it('muestra "Cargando producto..." mientras espera', async () => {
    useCart.mockReturnValue({ agregarProducto: vi.fn() });
    let resolver;
    let primera = true;
    mocks.from.mockImplementation(() => {
      if (!primera) return cadena(() => ({ data: [] }));
      primera = false;
      return {
        select: () => ({ eq: () => ({ single: () => new Promise((resolve) => { resolver = resolve; }) }) }),
      };
    });
    render(
      <MemoryRouter initialEntries={['/producto/mouse-1']}>
        <Routes>
          <Route path="/producto/:id" element={<DetalleProducto />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Cargando producto...')).toBeInTheDocument();
    resolver({ data: producto });
    expect(await screen.findByRole('button', { name: 'Agregar al carrito' })).toBeInTheDocument();
  });

  it('avisa cuando el producto no existe', async () => {
    estado.producto = null;
    renderDetalle();
    expect(await screen.findByText('Producto no encontrado.')).toBeInTheDocument();
  });

  it('muestra precio, ficha, reseña vacía y el destacado', async () => {
    renderDetalle();
    expect(await screen.findByRole('heading', { name: /Mouse Logitech/ })).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toBeInTheDocument();
    expect(screen.getByText('Sensor preciso para el día a día.')).toBeInTheDocument();
    expect(screen.getByText('DPI')).toBeInTheDocument();
    expect(screen.getByText('1600')).toBeInTheDocument();
    expect(screen.getByText('Este producto aún no tiene reseñas. ¡Sé el primero en opinar!')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Elegido por gamers' })).toBeInTheDocument();
    expect(screen.getByText('No hay otros productos en esta categoría.')).toBeInTheDocument();
  });

  it('con oferta muestra el precio original tachado y el descuento', async () => {
    estado.producto = { ...producto, descuento_porcentaje: 10 };
    renderDetalle();
    expect(await screen.findByText('-10%')).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toBeInTheDocument();
    expect(screen.getByText('$9.000')).toBeInTheDocument();
  });

  it('"Agregar al carrito" llama agregarProducto con el producto', async () => {
    const { agregarProducto, user } = renderDetalle();
    await user.click(await screen.findByRole('button', { name: 'Agregar al carrito' }));
    expect(agregarProducto).toHaveBeenCalledWith(producto);
  });

  it('lista reseñas y productos relacionados', async () => {
    estado.resenas = [{ id: 1, usuario: 'Camila', fecha: '2026-10-01', calificacion: 5, comentario: 'Llegó rápido.' }];
    estado.relacionados = [{ id: 2, nombre: 'Mousepad XL', precio: 8000, imagen: 'pad.jpg' }];
    renderDetalle();
    expect(await screen.findByText('Camila')).toBeInTheDocument();
    expect(screen.getByText('Llegó rápido.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mousepad XL' })).toBeInTheDocument();
    expect(screen.queryByText(/Sé el primero en opinar/)).not.toBeInTheDocument();
  });

  it('sin descripción ni ficha usa los textos de respaldo', async () => {
    estado.producto = { ...producto, descripcion: '', especificaciones: {}, destacado: null };
    renderDetalle();
    expect(await screen.findByText(/Disfruta del máximo rendimiento/)).toBeInTheDocument();
    expect(screen.getByText('Especificaciones no disponibles')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calidad Garantizada' })).toBeInTheDocument();
  });
});
