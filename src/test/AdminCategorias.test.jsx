import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCategorias from '../pages/Admin/AdminCategorias';
import { cadena } from '../../test/cadenaSupabase';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

const productos = [
  { id: 'm1', nombre: 'Mouse', precio: 10000, stock: 4, imagen: 'mouse.jpg', categoria: 'perifericos' },
  { id: 'r1', nombre: 'RTX 4070', precio: 500000, stock: 1, imagen: 'rtx.jpg', categoria: 'componentes' },
];

const estado = {
  productos,
  errorLista: null,
  uno: { data: null, error: null },
  alActualizar: vi.fn(),
  alEq: vi.fn(),
};

function renderCategorias() {
  mocks.from.mockImplementation(() => cadena(() => ({
    data: estado.errorLista ? null : estado.productos,
    error: estado.errorLista,
    uno: estado.uno,
    alActualizar: estado.alActualizar,
    alEq: estado.alEq,
  })));
  render(<AdminCategorias />);
  return userEvent.setup();
}

describe('AdminCategorias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.productos = productos;
    estado.errorLista = null;
    estado.uno = { data: null, error: null };
  });

  it('muestra "Cargando categorías..." mientras espera', async () => {
    let resolver;
    mocks.from.mockImplementation(() => ({
      select: () => ({ order: () => new Promise((resolve) => { resolver = resolve; }) }),
    }));
    render(<AdminCategorias />);
    expect(screen.getByText('Cargando categorías...')).toBeInTheDocument();
    resolver({ data: [], error: null });
    expect(await screen.findByText('No se encontraron categorías en los productos.')).toBeInTheDocument();
  });

  it('agrupa los productos por categoría con precio y stock', async () => {
    renderCategorias();
    expect(await screen.findByText('Periféricos & Monitores')).toBeInTheDocument();
    expect(screen.getByText('Componentes')).toBeInTheDocument();
    expect(screen.getByText('Mouse')).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toBeInTheDocument();
    expect(screen.getByText('$500.000')).toBeInTheDocument();
    expect(screen.getAllByText('1 producto(s)')).toHaveLength(2);
  });

  it('si la carga falla muestra el mensaje de error', async () => {
    estado.errorLista = { message: 'timeout' };
    estado.productos = [];
    renderCategorias();
    expect(await screen.findByText('Error al cargar productos: timeout')).toBeInTheDocument();
  });

  it('editar abre el formulario, cancelar lo cierra', async () => {
    const user = renderCategorias();
    await screen.findByText('Componentes');
    await user.click(within(screen.getByText('Componentes').closest('.card')).getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Nombre de la categoría')).toHaveValue('Componentes');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Nombre de la categoría')).not.toBeInTheDocument();
    expect(screen.getByText('Selecciona una categoría para editar')).toBeInTheDocument();
  });

  it('un nombre vacío no actualiza productos', async () => {
    const user = renderCategorias();
    await screen.findByText('Componentes');
    await user.click(within(screen.getByText('Componentes').closest('.card')).getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar cambios' }).form);
    expect(await screen.findByText('Ingresa un nombre válido para la categoría.')).toBeInTheDocument();
    expect(estado.alActualizar).not.toHaveBeenCalled();
  });

  it('guardar renombra la categoría de los productos de ese grupo', async () => {
    const user = renderCategorias();
    await screen.findByText('Componentes');
    await user.click(within(screen.getByText('Componentes').closest('.card')).getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Componentes Gamer' } });
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(estado.alActualizar).toHaveBeenCalledWith({ categoria: 'componentes_gamer' }));
    expect(estado.alEq).toHaveBeenCalledWith('categoria', 'componentes');
  });

  it('si Supabase rechaza el cambio muestra el error', async () => {
    estado.uno = { data: null, error: { message: 'check violation' } };
    const user = renderCategorias();
    await screen.findByText('Componentes');
    await user.click(within(screen.getByText('Componentes').closest('.card')).getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText(/check violation/)).toBeInTheDocument();
  });

  it('no deja eliminar una categoría que todavía tiene productos', async () => {
    const user = renderCategorias();
    await screen.findByText('Periféricos & Monitores');
    const tarjeta = screen.getByText('Periféricos & Monitores').closest('.card');
    await user.click(within(tarjeta).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText(/No se puede eliminar "Periféricos & Monitores"/)).toBeInTheDocument();
  });
});
