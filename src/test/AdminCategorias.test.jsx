import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCategorias from '../pages/Admin/AdminCategorias';

// ms-productos y ms-categoria: cada función devuelve lo que se configure (o rechaza si es un Error).
const mocks = vi.hoisted(() => ({
  listarProductos: vi.fn(),
  listarCategorias: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  eliminar: vi.fn(),
}));
vi.mock('../api/productosApi', () => ({ listarProductos: (...args) => mocks.listarProductos(...args) }));
vi.mock('../api/categoriasApi', () => ({
  listarCategorias: (...args) => mocks.listarCategorias(...args),
  crearCategoria: (...args) => mocks.crear(...args),
  actualizarCategoria: (...args) => mocks.actualizar(...args),
  eliminarCategoria: (...args) => mocks.eliminar(...args),
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

// respuestas: { productos, categorias } -> lista, null (sin datos) o un Error (el microservicio falla)
function renderCategorias(respuestas = {}) {
  const r = { productos, categorias, ...respuestas };
  const responder = (valor) => (valor instanceof Error ? Promise.reject(valor) : Promise.resolve(valor));
  mocks.listarProductos.mockImplementation(() => responder(r.productos));
  mocks.listarCategorias.mockImplementation(() => responder(r.categorias));
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
    mocks.crear.mockResolvedValue({});
    mocks.actualizar.mockResolvedValue({});
    mocks.eliminar.mockResolvedValue(null);
  });

  describe('listado', () => {
    it('muestra "Cargando categorías..." y luego las categorías', async () => {
      renderCategorias();
      expect(screen.getByText('Cargando categorías...')).toBeInTheDocument();
      expect(await screen.findByText('Componentes')).toBeInTheDocument();
      expect(screen.queryByText('Cargando categorías...')).not.toBeInTheDocument();
    });

    it('consulta los dos microservicios: ms-productos y ms-categoria', async () => {
      renderCategorias();
      await screen.findByText('Componentes');
      expect(mocks.listarProductos).toHaveBeenCalledWith({ orden: 'nombre' });
      expect(mocks.listarCategorias).toHaveBeenCalledTimes(1);
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
      renderCategorias({ categorias: [] });
      expect(
        await screen.findByText('Aún no hay categorías. Crea la primera con el formulario de arriba.')
      ).toBeInTheDocument();
    });

    it('si la respuesta de categorías no trae datos muestra el mensaje de vacío', async () => {
      renderCategorias({ categorias: null });
      expect(
        await screen.findByText('Aún no hay categorías. Crea la primera con el formulario de arriba.')
      ).toBeInTheDocument();
    });

    it('si la consulta de productos falla muestra el error', async () => {
      renderCategorias({ productos: new Error('falló') });
      expect(await screen.findByText('Error al cargar productos: falló')).toBeInTheDocument();
    });

    it('si la consulta de categorías falla muestra el error', async () => {
      renderCategorias({ categorias: new Error('falló') });
      expect(await screen.findByText('Error al cargar categorías: falló')).toBeInTheDocument();
    });

    it('"Actualizar" vuelve a consultar los dos microservicios', async () => {
      const user = renderCategorias();
      await user.click(await screen.findByRole('button', { name: /Actualizar/ }));
      await waitFor(() => expect(mocks.listarProductos).toHaveBeenCalledTimes(2));
      expect(mocks.listarCategorias).toHaveBeenCalledTimes(2);
    });

  });

  describe('crear', () => {
    it('crea la categoría enviando solo la etiqueta (ms-categoria genera el valor)', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Tarjetas de video');
      await user.click(botonCrear());
      await waitFor(() => expect(mocks.crear).toHaveBeenCalledWith({ etiqueta: 'Tarjetas de video' }));
      expect(await screen.findByText('Categoría "Tarjetas de video" creada correctamente.')).toBeInTheDocument();
    });

    it('conserva las tildes de la etiqueta tal cual la escribe el usuario', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Cámaras Web');
      await user.click(botonCrear());
      await waitFor(() => expect(mocks.crear).toHaveBeenCalledWith({ etiqueta: 'Cámaras Web' }));
    });

    it('al crear vacía el campo y vuelve a cargar las tablas', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Redes');
      await user.click(botonCrear());
      await screen.findByText('Categoría "Redes" creada correctamente.');
      expect(campoNueva()).toHaveValue('');
      expect(mocks.listarProductos).toHaveBeenCalledTimes(2);
      expect(mocks.listarCategorias).toHaveBeenCalledTimes(2);
    });

    it('rechaza una categoría que ya existe', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Gaming Gear');
      await user.click(botonCrear());
      expect(await screen.findByText('Esa categoría ya existe.')).toBeInTheDocument();
      expect(mocks.crear).not.toHaveBeenCalled();
    });

    it('un nombre sin letras ni números no es válido', async () => {
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), '!!!');
      await user.click(botonCrear());
      expect(await screen.findByText('Ingresa un nombre válido para la categoría.')).toBeInTheDocument();
      expect(mocks.crear).not.toHaveBeenCalled();
    });

    it('si ms-categoria falla al crear muestra el error y conserva lo escrito', async () => {
      mocks.crear.mockRejectedValue(new Error('violación de RLS'));
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Cámaras');
      await user.click(botonCrear());
      expect(await screen.findByText(/No se pudo crear la categoría/)).toHaveTextContent('violación de RLS');
      expect(campoNueva()).toHaveValue('Cámaras');
    });

    it('deshabilita el botón mientras se guarda', async () => {
      let terminar;
      mocks.crear.mockReturnValue(
        new Promise((resolver) => {
          terminar = resolver;
        })
      );
      const user = renderCategorias();
      await user.type(await screen.findByPlaceholderText('Nombre de la nueva categoría'), 'Streaming');
      await user.click(botonCrear());
      expect(botonCrear()).toBeDisabled();
      await act(async () => terminar({}));
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

    it('guardar cambios actualiza solo la etiqueta: el valor de la categoría no cambia', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      const input = screen.getByLabelText('Nombre de la categoría');
      await user.clear(input);
      await user.type(input, 'Computación');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledWith('perifericos', { etiqueta: 'Computación' }));
      expect(await screen.findByText('Categoría actualizada correctamente.')).toBeInTheDocument();
      expect(screen.getByText('Selecciona una categoría para editar')).toBeInTheDocument();
    });

    it('permite cambiar la etiqueta aunque solo cambien tildes o mayúsculas', async () => {
      const user = renderCategorias();
      await screen.findByText('Periféricos & Monitores');
      await editarCategoria(user, 'Periféricos & Monitores');
      const input = screen.getByLabelText('Nombre de la categoría');
      await user.clear(input);
      await user.type(input, 'Perifericos');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledWith('perifericos', { etiqueta: 'Perifericos' }));
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
      expect(mocks.actualizar).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Nombre de la categoría')).toBeInTheDocument();
    });

    it('si ms-categoria falla al actualizar muestra el error y deja abierto el formulario', async () => {
      mocks.actualizar.mockRejectedValue(new Error('violación de clave foránea'));
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
      expect(mocks.actualizar).not.toHaveBeenCalled();
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

    it('elimina en ms-categoria una categoría sin productos y vuelve a cargar', async () => {
      const user = renderCategorias();
      await screen.findByText('Audio');
      await eliminarCategoria(user, 'Audio');
      await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith('audio'));
      expect(await screen.findByText('Categoría "Audio" eliminada.')).toBeInTheDocument();
      expect(mocks.listarProductos).toHaveBeenCalledTimes(2);
      expect(mocks.listarCategorias).toHaveBeenCalledTimes(2);
    });

    it('si ms-categoria rechaza el borrado (409) muestra su mensaje', async () => {
      mocks.eliminar.mockRejectedValue(new Error('sin permisos'));
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
