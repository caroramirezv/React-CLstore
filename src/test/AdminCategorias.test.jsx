import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCategorias from '../pages/Admin/AdminCategorias';

const mocks = vi.hoisted(() => ({
  respuestas: {
    productos: { data: [], error: null },
    categorias: { data: [], error: null },
  },
  order: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eliminar: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (tabla) => ({
      select: () => ({ order: () => mocks.order(tabla) }),
      insert: (fila) => mocks.insert(tabla, fila),
      update: (payload) => ({ eq: (col, valor) => mocks.update(payload, col, valor) }),
      delete: () => ({ eq: (col, valor) => mocks.eliminar(col, valor) }),
    }),
  },
}));

const categorias = [
  { id: 5, valor: 'audio', etiqueta: 'Audio', icono: 'fa-folder' },
  { id: 1, valor: 'componentes', etiqueta: 'Componentes', icono: 'fa-microchip' },
  { id: 2, valor: 'consolas', etiqueta: 'Consolas & Laptops', icono: 'fa-gamepad' },
  { id: 4, valor: 'gaming_gear', etiqueta: 'Gaming Gear', icono: 'fa-folder' },
  { id: 3, valor: 'perifericos', etiqueta: 'Periféricos & Monitores', icono: 'fa-keyboard' },
];

const productos = [
  { id: 'p1', nombre: 'Mouse', precio: 10000, stock: 2, categoria: 'perifericos', imagen: 'mouse.jpg' },
  { id: 'p2', nombre: 'Teclado', precio: 20000, stock: 5, categoria: 'perifericos', imagen: '' },
  { id: 'p3', nombre: 'RTX 4070', precio: 500000, stock: 8, categoria: 'componentes', imagen: 'rtx.jpg' },
  { id: 'p4', nombre: 'Headset', precio: 30000, stock: 1, categoria: 'gaming_gear', imagen: 'h.jpg' },
];

function renderCategorias(respuestas = {}) {
  mocks.respuestas = {
    productos: { data: productos, error: null },
    categorias: { data: categorias, error: null },
    ...respuestas,
  };
  render(<AdminCategorias />);
  return userEvent.setup();
}

const tarjeta = (etiqueta) => screen.getByText(etiqueta).closest('.card');
const editarCategoria = (user, etiqueta) =>
  user.click(within(tarjeta(etiqueta)).getByRole('button', { name: /Editar/ }));
const eliminarCategoria = (user, etiqueta) =>
  user.click(within(tarjeta(etiqueta)).getByRole('button', { name: /Eliminar/ }));
const campoNueva = () => screen.getByPlaceholderText('Nombre de la nueva categoría');
const botonCrear = () => screen.getByRole('button', { name: 'Crear categoría' });

describe('AdminCategorias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order.mockImplementation((tabla) => Promise.resolve(mocks.respuestas[tabla]));
    mocks.insert.mockResolvedValue({ error: null });
    mocks.update.mockResolvedValue({ error: null });
    mocks.eliminar.mockResolvedValue({ error: null });
  });

  describe('listado', () => {
    it('muestra "Cargando categorías..." y luego las categorías', async () => {
      renderCategorias();
      expect(screen.getByText('Cargando categorías...')).toBeInTheDocument();
      expect(await screen.findByText('Componentes')).toBeInTheDocument();
      expect(screen.queryByText('Cargando categorías...')).not.toBeInTheDocument();
    });

    it('lee las dos tablas: productos y categorias', async () => {
      renderCategorias();
      await screen.findByText('Componentes');
      expect(mocks.order).toHaveBeenCalledWith('productos');
      expect(mocks.order).toHaveBeenCalledWith('categorias');
    });

    it('muestra las categorías de la tabla con su etiqueta', async () => {
      renderCategorias();
      expect(await screen.findByText('Periféricos & Monitores')).toBeInTheDocument();
      expect(screen.getByText('Componentes')).toBeInTheDocument();
      expect(screen.getByText('Gaming Gear')).toBeInTheDocument();
    });

    it('cuenta los productos de cada categoría', async () => {
      renderCategorias();
      await screen.findByText('Componentes');
      expect(within(tarjeta('Periféricos & Monitores')).getByText('2 producto(s)')).toBeInTheDocument();
      expect(within(tarjeta('Componentes')).getByText('1 producto(s)')).toBeInTheDocument();
      expect(within(tarjeta('Gaming Gear')).getByText('1 producto(s)')).toBeInTheDocument();
    });

    it('muestra también las categorías que no tienen productos', async () => {
      renderCategorias();
      await screen.findByText('Audio');
      const audio = within(tarjeta('Audio'));
      expect(audio.getByText('0 producto(s)')).toBeInTheDocument();
      expect(audio.getByText('Sin productos en esta categoría.')).toBeInTheDocument();
    });

    it('lista los productos de cada categoría con precio y stock', async () => {
      renderCategorias();
      expect(await screen.findByText('Mouse')).toBeInTheDocument();
      expect(screen.getByText('Teclado')).toBeInTheDocument();
      const rtx = within(screen.getByText('RTX 4070').closest('tr'));
      expect(rtx.getByText('$500.000')).toBeInTheDocument();
      expect(rtx.getByText('8')).toBeInTheDocument();
    });

    it('sin categorías muestra el mensaje para crear la primera', async () => {
      renderCategorias({ categorias: { data: [], error: null } });
      expect(
        await screen.findByText('Aún no hay categorías. Crea la primera con el formulario de arriba.')
      ).toBeInTheDocument();
    });

    it('si la respuesta de categorías no trae datos ni error muestra el mensaje de vacío', async () => {
      renderCategorias({ categorias: { data: null, error: null } });
      expect(
        await screen.findByText('Aún no hay categorías. Crea la primera con el formulario de arriba.')
      ).toBeInTheDocument();
    });

    it('si la consulta de productos falla muestra el error', async () => {
      renderCategorias({ productos: { data: null, error: { message: 'falló' } } });
      expect(await screen.findByText('Error al cargar productos: falló')).toBeInTheDocument();
    });

    it('si la consulta de categorías falla muestra el error', async () => {
      renderCategorias({ categorias: { data: null, error: { message: 'falló' } } });
      expect(await screen.findByText('Error al cargar categorías: falló')).toBeInTheDocument();
    });

    it('"Actualizar" vuelve a consultar las dos tablas', async () => {
      const user = renderCategorias();
      await user.click(await screen.findByRole('button', { name: /Actualizar/ }));
      await waitFor(() => expect(mocks.order).toHaveBeenCalledTimes(4));
    });

  });

  describe('crear', () => {
    it('crea la categoría con el valor generado a partir del nombre', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Tarjetas de video');
      await user.click(botonCrear());
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith('categorias', {
          valor: 'tarjetas_de_video',
          etiqueta: 'Tarjetas de video',
        })
      );
      expect(await screen.findByText('Categoría "Tarjetas de video" creada correctamente.')).toBeInTheDocument();
    });

    it('quita las tildes al generar el valor', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Cámaras Web');
      await user.click(botonCrear());
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith('categorias', { valor: 'camaras_web', etiqueta: 'Cámaras Web' })
      );
    });

    it('al crear vacía el campo y vuelve a cargar las tablas', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Redes');
      await user.click(botonCrear());
      await screen.findByText('Categoría "Redes" creada correctamente.');
      expect(campoNueva()).toHaveValue('');
      expect(mocks.order).toHaveBeenCalledTimes(4);
    });

    it('rechaza una categoría que ya existe', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Gaming Gear');
      await user.click(botonCrear());
      expect(await screen.findByText('Esa categoría ya existe.')).toBeInTheDocument();
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('un nombre sin letras ni números no es válido', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), '!!!');
      await user.click(botonCrear());
      expect(await screen.findByText('Ingresa un nombre válido para la categoría.')).toBeInTheDocument();
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('si el insert falla muestra el error y conserva lo escrito', async () => {
      mocks.insert.mockResolvedValue({ error: { message: 'violación de RLS' } });
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Cámaras');
      await user.click(botonCrear());
      expect(await screen.findByText(/No se pudo crear la categoría/)).toHaveTextContent('violación de RLS');
      expect(campoNueva()).toHaveValue('Cámaras');
    });

    it('deshabilita el botón mientras se guarda', async () => {
      let terminar;
      mocks.insert.mockReturnValue(
        new Promise((resolver) => {
          terminar = resolver;
        })
      );
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Streaming');
      await user.click(botonCrear());
      expect(botonCrear()).toBeDisabled();
      await act(async () => terminar({ error: null }));
      await waitFor(() => expect(botonCrear()).toBeEnabled());
    });
  });

  describe('editar', () => {
    it('"Editar" abre el formulario con el nombre actual', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      expect(screen.getByLabelText('Nombre de la categoría')).toHaveValue('Periféricos & Monitores');
    });

    it('"Cancelar" cierra el formulario de edición', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByLabelText('Nombre de la categoría')).not.toBeInTheDocument();
    });

    it('guardar cambios actualiza la tabla categorias por su valor', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      const input = screen.getByLabelText('Nombre de la categoría');
      await user.clear(input);
      await user.type(input, 'Computación');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() =>
        expect(mocks.update).toHaveBeenCalledWith(
          { valor: 'computacion', etiqueta: 'Computación' },
          'valor',
          'perifericos'
        )
      );
      expect(await screen.findByText('Categoría actualizada correctamente.')).toBeInTheDocument();
      expect(screen.getByText('Selecciona una categoría para editar')).toBeInTheDocument();
    });

    it('permite cambiar solo la etiqueta cuando el valor generado no cambia', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      const input = screen.getByLabelText('Nombre de la categoría');
      await user.clear(input);
      await user.type(input, 'Perifericos');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() =>
        expect(mocks.update).toHaveBeenCalledWith(
          { valor: 'perifericos', etiqueta: 'Perifericos' },
          'valor',
          'perifericos'
        )
      );
    });

    it('no deja renombrar a un nombre que ya usa otra categoría', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      const input = screen.getByLabelText('Nombre de la categoría');
      await user.clear(input);
      await user.type(input, 'Audio');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByText('Ya existe otra categoría con ese nombre.')).toBeInTheDocument();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Nombre de la categoría')).toBeInTheDocument();
    });

    it('si el update falla muestra el error y deja abierto el formulario', async () => {
      mocks.update.mockResolvedValue({ error: { message: 'violación de clave foránea' } });
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByText(/No se pudo actualizar la categoría/)).toHaveTextContent(
        'violación de clave foránea'
      );
      expect(screen.getByLabelText('Nombre de la categoría')).toBeInTheDocument();
    });

    it('un nombre sin letras ni números no es válido', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      const input = screen.getByLabelText('Nombre de la categoría');
      await user.clear(input);
      await user.type(input, '!!!');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByText('Ingresa un nombre válido para la categoría.')).toBeInTheDocument();
      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('no deja eliminar una categoría que tiene productos', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await eliminarCategoria(user, 'Periféricos & Monitores');
      expect(
        await screen.findByText(/No se puede eliminar "Periféricos & Monitores" porque tiene 2 producto\(s\)/)
      ).toBeInTheDocument();
      expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it('elimina de la tabla una categoría sin productos y vuelve a cargar', async () => {
      const user = renderCategorias();
      await screen.findByText('Audio');
      await eliminarCategoria(user, 'Audio');
      await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith('valor', 'audio'));
      expect(await screen.findByText('Categoría "Audio" eliminada.')).toBeInTheDocument();
      expect(mocks.order).toHaveBeenCalledTimes(4);
    });

    it('si el delete falla muestra el error', async () => {
      mocks.eliminar.mockResolvedValue({ error: { message: 'sin permisos' } });
      const user = renderCategorias();
      await screen.findByText('Audio');
      await eliminarCategoria(user, 'Audio');
      expect(await screen.findByText(/No se pudo eliminar la categoría/)).toHaveTextContent('sin permisos');
    });

    it('si se elimina la categoría que se está editando, cierra el formulario', async () => {
      const user = renderCategorias();
      await screen.findByText('Audio');
      await editarCategoria(user, 'Audio');
      expect(screen.getByLabelText('Nombre de la categoría')).toBeInTheDocument();
      await eliminarCategoria(user, 'Audio');
      await waitFor(() =>
        expect(screen.queryByLabelText('Nombre de la categoría')).not.toBeInTheDocument()
      );
    });
  });
});
