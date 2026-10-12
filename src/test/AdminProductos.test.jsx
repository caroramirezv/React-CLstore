import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminProductos from '../pages/Admin/AdminProductos';
import { cadena } from '../../test/cadenaSupabase';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(() => Promise.resolve({ isConfirmed: true })) } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

const productos = [
  {
    id: 'MOUSE1',
    nombre: 'Mouse Logitech',
    precio: 10000,
    stock: 2,
    stock_critico: 5,
    categoria: 'perifericos',
    imagen: 'mouse.jpg',
    descuento_porcentaje: 15,
    descripcion: 'Óptico',
  },
  {
    id: 'RTX1',
    nombre: 'RTX 4070',
    precio: 500000,
    stock: 8,
    stock_critico: 2,
    categoria: 'componentes',
    imagen: '',
    descuento_porcentaje: null,
  },
];

const estado = {
  productos,
  uno: { data: null, error: null },
  alInsertar: vi.fn(),
  alActualizar: vi.fn(),
  alEliminar: vi.fn(),
  alEq: vi.fn(),
};

function renderProductos(lista = productos) {
  estado.productos = lista;
  mocks.from.mockImplementation(() => cadena(() => ({
    data: estado.productos,
    uno: estado.uno,
    alInsertar: estado.alInsertar,
    alActualizar: estado.alActualizar,
    alEliminar: estado.alEliminar,
    alEq: estado.alEq,
  })));
  render(<AdminProductos />);
  return userEvent.setup();
}

function campo(etiqueta) {
  return screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, select, textarea');
}

function completarBasico() {
  fireEvent.change(campo('Código producto *'), { target: { value: 'pad1' } });
  fireEvent.change(campo('Nombre *'), { target: { value: 'Mousepad' } });
  fireEvent.change(campo('Precio ($) *'), { target: { value: '8000' } });
  fireEvent.change(campo('Stock *'), { target: { value: '6' } });
  fireEvent.change(campo('Categoría *'), { target: { value: 'perifericos' } });
}

describe('AdminProductos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.uno = { data: null, error: null };
    estado.productos = productos;
  });

  it('sin productos muestra la tabla vacía', async () => {
    renderProductos([]);
    expect(await screen.findByText('No hay productos guardados todavía.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mantenedor de Productos/ })).toBeInTheDocument();
  });

  it('muestra categoría, precio, stock bajo y descuento', async () => {
    renderProductos();
    expect(await screen.findByText('Mouse Logitech')).toBeInTheDocument();
    expect(screen.getByText('MOUSE1')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Periféricos & Monitores')).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toBeInTheDocument();
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    expect(screen.getByText('-15%')).toBeInTheDocument();
    expect(screen.getByText('RTX 4070')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Componentes')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('rechaza un código de menos de 3 caracteres', () => {
    renderProductos([]);
    fireEvent.change(campo('Código producto *'), { target: { value: 'ab' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Producto', hidden: true }).form);
    expect(Swal.fire).toHaveBeenCalledWith('Código inválido', expect.any(String), 'error');
    expect(estado.alInsertar).not.toHaveBeenCalled();
  });

  it('rechaza nombre, precio, stock o categoría incompletos', () => {
    renderProductos([]);
    fireEvent.change(campo('Código producto *'), { target: { value: 'abc' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Producto', hidden: true }).form);
    expect(Swal.fire).toHaveBeenCalledWith('Datos incompletos', expect.any(String), 'error');
    expect(estado.alInsertar).not.toHaveBeenCalled();
  });

  it('rechaza un descuento fuera de 1 a 95', () => {
    renderProductos([]);
    completarBasico();
    fireEvent.change(campo('Descuento % (Oferta)'), { target: { value: '99' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Producto', hidden: true }).form);
    expect(Swal.fire).toHaveBeenCalledWith('Descuento inválido', expect.any(String), 'error');
    expect(estado.alInsertar).not.toHaveBeenCalled();
  });

  it('rechaza un código que ya existe', async () => {
    estado.uno = { data: { id: 'pad1' }, error: null };
    renderProductos([]);
    completarBasico();
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Producto', hidden: true }).form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Código repetido', expect.any(String), 'error'));
    expect(estado.alInsertar).not.toHaveBeenCalled();
  });

  it('crea el producto con el precio numérico y sin oferta si el descuento va vacío', async () => {
    renderProductos([]);
    completarBasico();
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Producto', hidden: true }).form);
    await waitFor(() => expect(estado.alInsertar).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pad1',
      nombre: 'Mousepad',
      precio: 8000,
      stock: 6,
      categoria: 'perifericos',
      descuento_porcentaje: null,
      busqueda: 'mousepad',
      imagen: '/img/Logo.png',
    })));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Producto creado' }));
  });

  it('rechaza un archivo que no es imagen', () => {
    renderProductos([]);
    fireEvent.change(campo('Foto del producto (Opcional)'), {
      target: { files: [new File(['x'], 'nota.txt', { type: 'text/plain' })] },
    });
    expect(Swal.fire).toHaveBeenCalledWith('Archivo no válido', expect.any(String), 'error');
  });

  it('editar deshabilita el código y actualiza el producto', async () => {
    const user = renderProductos();
    await screen.findByText('Mouse Logitech');
    const fila = screen.getByText('Mouse Logitech').closest('tr');
    await user.click(within(fila).getAllByRole('button')[0]);
    expect(screen.getByRole('heading', { name: 'Editar Producto', hidden: true })).toBeInTheDocument();
    expect(campo('Código producto *')).toBeDisabled();
    expect(campo('Código producto *')).toHaveValue('MOUSE1');
    expect(campo('Descuento % (Oferta)')).toHaveValue(15);
    fireEvent.change(campo('Nombre *'), { target: { value: 'Mouse Pro' } });
    await user.click(screen.getByRole('button', { name: 'Guardar Producto', hidden: true }));
    await waitFor(() => expect(estado.alActualizar).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Mouse Pro',
      precio: 10000,
      descuento_porcentaje: 15,
    })));
    expect(estado.alEq).toHaveBeenCalledWith('id', 'MOUSE1');
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Producto actualizado' }));
  });

  it('eliminar cancelado no borra; confirmado sí', async () => {
    const user = renderProductos();
    await screen.findByText('RTX 4070');
    const fila = screen.getByText('RTX 4070').closest('tr');
    Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
    await user.click(within(fila).getAllByRole('button')[1]);
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar producto?' }));
    expect(estado.alEliminar).not.toHaveBeenCalled();

    Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
    await user.click(within(fila).getAllByRole('button')[1]);
    await waitFor(() => expect(estado.alEliminar).toHaveBeenCalled());
    expect(estado.alEq).toHaveBeenCalledWith('id', 'RTX1');
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Producto eliminado' }));
  });
});
