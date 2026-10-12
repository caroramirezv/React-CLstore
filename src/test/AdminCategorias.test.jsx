import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCategorias from '../pages/Admin/AdminCategorias';

// Las categorías salen de los productos: se lee la lista y, al editar, se hace update + eq.
const mocks = vi.hoisted(() => ({
  respuesta: { data: [], error: null },
  order: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: mocks.order }),
      update: (payload) => ({ eq: (col, valor) => mocks.eq(payload, col, valor) }),
    }),
  },
}));

const productos = [
  { id: 'p1', nombre: 'Mouse', precio: 10000, stock: 2, categoria: 'perifericos', imagen: 'mouse.jpg' },
  { id: 'p2', nombre: 'Teclado', precio: 20000, stock: 5, categoria: 'perifericos', imagen: '' },
  { id: 'p3', nombre: 'RTX 4070', precio: 500000, stock: 8, categoria: 'componentes', imagen: 'rtx.jpg' },
  { id: 'p4', nombre: 'Headset', precio: 30000, stock: 1, categoria: 'gaming_gear', imagen: 'h.jpg' },
];

function renderCategorias(respuesta = { data: productos, error: null }) {
  mocks.respuesta = respuesta;
  render(<AdminCategorias />);
  return userEvent.setup();
}

describe('AdminCategorias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order.mockImplementation(() => Promise.resolve(mocks.respuesta));
    mocks.eq.mockResolvedValue({ error: null });
  });

  it('muestra "Cargando categorías..." y luego las categorías', async () => {
    renderCategorias();
    expect(screen.getByText('Cargando categorías...')).toBeInTheDocument();
    expect(await screen.findByText('Componentes')).toBeInTheDocument();
    expect(screen.queryByText('Cargando categorías...')).not.toBeInTheDocument();
  });

  it('agrupa los productos por categoría con su nombre legible y su cantidad', async () => {
    renderCategorias();
    expect(await screen.findByText('Periféricos & Monitores')).toBeInTheDocument();
    expect(screen.getByText('Componentes')).toBeInTheDocument();
    expect(screen.getByText('Gaming Gear')).toBeInTheDocument(); // "gaming_gear" se formatea
    expect(screen.getByText('2 producto(s)')).toBeInTheDocument();
    expect(screen.getAllByText('1 producto(s)')).toHaveLength(2);
  });

  it('lista los productos de cada categoría con precio y stock', async () => {
    renderCategorias();
    expect(await screen.findByText('Mouse')).toBeInTheDocument();
    expect(screen.getByText('Teclado')).toBeInTheDocument();
    expect(screen.getByText('$500.000')).toBeInTheDocument();
  });

  it('sin productos muestra el mensaje de que no hay categorías', async () => {
    renderCategorias({ data: [], error: null });
    expect(await screen.findByText('No se encontraron categorías en los productos.')).toBeInTheDocument();
  });

  it('si la consulta falla muestra el error', async () => {
    renderCategorias({ data: null, error: { message: 'falló' } });
    expect(await screen.findByText('Error al cargar productos: falló')).toBeInTheDocument();
  });

  it('"Actualizar" vuelve a consultar los productos', async () => {
    const user = renderCategorias();
    await user.click(await screen.findByRole('button', { name: /Actualizar/ }));
    await waitFor(() => expect(mocks.order).toHaveBeenCalledTimes(2));
  });

  it('"Editar" abre el formulario con el nombre actual', async () => {
    const user = renderCategorias();
    await user.click((await screen.findAllByRole('button', { name: /Editar/ }))[0]);
    expect(screen.getByLabelText('Nombre de la categoría')).toHaveValue('Periféricos & Monitores');
  });

  it('"Cancelar" cierra el formulario de edición', async () => {
    const user = renderCategorias();
    await user.click((await screen.findAllByRole('button', { name: /Editar/ }))[0]);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Nombre de la categoría')).not.toBeInTheDocument();
  });

  it('guardar cambios renombra la categoría en todos sus productos', async () => {
    const user = renderCategorias();
    await user.click((await screen.findAllByRole('button', { name: /Editar/ }))[0]);
    const input = screen.getByLabelText('Nombre de la categoría');
    await user.clear(input);
    await user.type(input, 'Computación');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(mocks.eq).toHaveBeenCalledWith({ categoria: 'computacion' }, 'categoria', 'perifericos')
    );
    expect(await screen.findByText('Selecciona una categoría para editar')).toBeInTheDocument();
  });

  it('si el update falla muestra el error y deja abierto el formulario', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'check violado' } });
    const user = renderCategorias();
    await user.click((await screen.findAllByRole('button', { name: /Editar/ }))[0]);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText(/No se pudo actualizar la categoría/)).toHaveTextContent('check violado');
    expect(screen.getByLabelText('Nombre de la categoría')).toBeInTheDocument();
  });

  it('un nombre sin letras ni números no es válido', async () => {
    const user = renderCategorias();
    await user.click((await screen.findAllByRole('button', { name: /Editar/ }))[0]);
    const input = screen.getByLabelText('Nombre de la categoría');
    await user.clear(input);
    await user.type(input, '!!!');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Ingresa un nombre válido para la categoría.')).toBeInTheDocument();
    expect(mocks.eq).not.toHaveBeenCalled();
  });

  it('no deja eliminar una categoría que tiene productos', async () => {
    const user = renderCategorias();
    await user.click((await screen.findAllByRole('button', { name: /Eliminar/ }))[0]);
    expect(await screen.findByText(/No se puede eliminar "Periféricos & Monitores" porque tiene 2 producto\(s\)/)).toBeInTheDocument();
  });

  it('si la respuesta no trae datos ni error muestra que no hay categorías', async () => {
    renderCategorias({ data: null, error: null });
    expect(await screen.findByText('No se encontraron categorías en los productos.')).toBeInTheDocument();
  });
});
