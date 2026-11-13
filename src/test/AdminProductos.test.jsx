import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminProductos from '../pages/Admin/AdminProductos';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));

const mocks = vi.hoisted(() => ({
  lista: [],
  categorias: [],
  cargarCategorias: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eliminar: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('../api/productosApi', () => ({
  listarProductos: () => Promise.resolve(mocks.lista),
  crearProducto: (producto) => mocks.insert(producto),
  actualizarProducto: (id, producto) => mocks.update(id, producto),
  eliminarProducto: (id) => mocks.eliminar(id),
  subirImagenProducto: (archivo) => mocks.upload(archivo),
}));
vi.mock('../api/categoriasApi', () => ({ listarCategorias: () => mocks.cargarCategorias() }));

// Error de microservicio (ApiError) con el código HTTP, como lo lanza src/api/http.js
const errorApi = (mensaje, status) => Object.assign(new Error(mensaje), { status });

const productos = [
  { id: 'MOUSE1', nombre: 'Mouse Logitech', precio: 10000, stock: 2, stock_critico: 5, categoria: 'perifericos',
    imagen: 'mouse.jpg', descuento_porcentaje: 15, descripcion: 'Óptico' },
  { id: 'RTX1', nombre: 'RTX 4070', precio: 500000, stock: 8, stock_critico: 2, categoria: 'componentes',
    imagen: '', descuento_porcentaje: null },
];

const categoriasTabla = [
  { valor: 'componentes', etiqueta: 'Componentes' },
  { valor: 'consolas', etiqueta: 'Consolas & Laptops' },
  { valor: 'gaming_gear', etiqueta: 'Gaming Gear' },
  { valor: 'perifericos', etiqueta: 'Periféricos & Monitores' },
];

const campo = (etiqueta) =>
  screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, select, textarea');
const escribir = (etiqueta, valor) => fireEvent.change(campo(etiqueta), { target: { value: valor } });
const enviar = () => fireEvent.submit(campo('Nombre *').closest('form'));
const fila = (nombre) => screen.getByText(nombre).closest('tr');
const toast = (titulo) => expect.objectContaining({ title: titulo });
const opcionesCategoria = () =>
  Array.from(campo('Categoría *').querySelectorAll('option')).map((o) => o.textContent);

async function renderProductos(lista = productos) {
  mocks.lista = lista;
  await act(async () => {
    render(<AdminProductos />);
  });
  return userEvent.setup();
}

function llenarProductoNuevo() {
  escribir('Código producto *', 'TEC1');
  escribir('Nombre *', 'Teclado');
  escribir('Precio ($) *', '20000');
  escribir('Stock *', '5');
  escribir('Categoría *', 'perifericos');
}

describe('AdminProductos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Swal.fire.mockResolvedValue({ isConfirmed: true });
    mocks.categorias = categoriasTabla;
    mocks.cargarCategorias.mockImplementation(() => Promise.resolve(mocks.categorias));
    mocks.insert.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.eliminar.mockResolvedValue(null);
    mocks.upload.mockResolvedValue('https://cdn.test/productos/foto-subida.png');
    URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
  });

  describe('listado', () => {
    it('muestra una fila por producto con la etiqueta de su categoría, precio y oferta', async () => {
      await renderProductos();
      const mouse = within(fila('Mouse Logitech'));
      expect(mouse.getByText('MOUSE1')).toBeInTheDocument();
      expect(mouse.getByText('Periféricos & Monitores')).toBeInTheDocument();
      expect(mouse.getByText('$10.000')).toBeInTheDocument();
      expect(mouse.getByText('-15%')).toBeInTheDocument();
      expect(within(fila('RTX 4070')).getByText('Componentes')).toBeInTheDocument();
    });

    it('marca "Stock bajo" solo si el stock llega al nivel crítico', async () => {
      await renderProductos();
      expect(within(fila('Mouse Logitech')).getByText('Stock bajo')).toBeInTheDocument();
      expect(within(fila('RTX 4070')).queryByText('Stock bajo')).not.toBeInTheDocument();
    });

    it('sin productos muestra el mensaje de vacío', async () => {
      await renderProductos([]);
      expect(await screen.findByText('No hay productos guardados todavía.')).toBeInTheDocument();
    });
  });

  describe('categorías del formulario', () => {
    it('el selector lista las categorías que devuelve ms-categoria', async () => {
      await renderProductos();
      expect(opcionesCategoria()).toEqual([
        'Seleccione Categoría',
        'Componentes',
        'Consolas & Laptops',
        'Gaming Gear',
        'Periféricos & Monitores',
      ]);
    });

    it('sin categorías solo queda la opción inicial', async () => {
      mocks.categorias = null;
      await renderProductos();
      expect(opcionesCategoria()).toEqual(['Seleccione Categoría']);
    });

    it('lee las categorías al cargar la página', async () => {
      await renderProductos();
      expect(mocks.cargarCategorias).toHaveBeenCalledTimes(1);
    });

    it('vuelve a leer las categorías al abrir el formulario de creación', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      expect(mocks.cargarCategorias).toHaveBeenCalledTimes(2);
    });

    it('vuelve a leer las categorías al abrir el formulario de edición', async () => {
      const user = await renderProductos();
      await user.click(within(fila('Mouse Logitech')).getAllByRole('button')[0]);
      expect(mocks.cargarCategorias).toHaveBeenCalledTimes(2);
    });

    it('muestra una categoría creada después de cargar la página', async () => {
      const user = await renderProductos();
      mocks.categorias = [...categoriasTabla, { valor: 'audio', etiqueta: 'Audio' }];
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      await waitFor(() => expect(opcionesCategoria()).toContain('Audio'));
    });

    it('guarda un producto nuevo con una categoría que no estaba entre las tres originales', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      escribir('Categoría *', 'gaming_gear');
      enviar();
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'TEC1', categoria: 'gaming_gear' }))
      );
    });

    it('al editar deja seleccionada la categoría del producto', async () => {
      const user = await renderProductos();
      await user.click(within(fila('Mouse Logitech')).getAllByRole('button')[0]);
      expect(campo('Categoría *')).toHaveValue('perifericos');
    });
  });

  describe('crear', () => {
    it('guarda un producto nuevo con los datos del formulario', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      enviar();
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith({
          id: 'TEC1', nombre: 'Teclado', descripcion: '', precio: 20000, stock: 5, stock_critico: null,
          categoria: 'perifericos', imagen: '/img/Logo.png', descuento_porcentaje: null, // "busqueda" la calcula ms-productos
        })
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Producto creado'));
    });

    it('rechaza un código que ya existe (ms-productos responde 409)', async () => {
      mocks.insert.mockRejectedValue(errorApi('Ya existe un producto con ese código.', 409));
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Código repetido', expect.any(String), 'error'));
    });

    it('rechaza un código de menos de 3 caracteres', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      escribir('Código producto *', 'AB');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Código inválido', expect.any(String), 'error');
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('rechaza si falta la categoría', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      escribir('Categoría *', '');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Datos incompletos', expect.any(String), 'error');
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('rechaza un descuento fuera de 1 a 95', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      escribir('Descuento % (Oferta)', '99');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Descuento inválido', expect.any(String), 'error');
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('si ms-productos falla al crear muestra el error', async () => {
      mocks.insert.mockRejectedValue(errorApi('falló', 500));
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'falló', 'error'));
    });

    it('rechaza un archivo que no es imagen', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      const archivo = new File(['hola'], 'nota.txt', { type: 'text/plain' });
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [archivo] } });
      expect(Swal.fire).toHaveBeenCalledWith('Archivo no válido', expect.any(String), 'error');
    });

    it('rechaza una imagen de más de 5 MB', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      const grande = new File([new ArrayBuffer(5 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [grande] } });
      expect(Swal.fire).toHaveBeenCalledWith('Imagen demasiado grande', expect.any(String), 'error');
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('ignora el cambio si no se elige ningún archivo', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [] } });
      expect(Swal.fire).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('sube la imagen elegida a ms-productos y guarda la URL que devuelve', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      const foto = new File(['img'], 'Teclado.PNG', { type: 'image/png' });
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [foto] } });
      expect(URL.createObjectURL).toHaveBeenCalledWith(foto);
      expect(screen.getByText('Teclado.PNG')).toBeInTheDocument();
      enviar();
      await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
      expect(mocks.upload).toHaveBeenCalledWith(foto);
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'TEC1', imagen: 'https://cdn.test/productos/foto-subida.png' })
      );
    });

    it('si falla la subida de la imagen avisa y no guarda el producto', async () => {
      mocks.upload.mockRejectedValue(errorApi('bucket no existe', 500));
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      const foto = new File(['img'], 'foto.png', { type: 'image/png' });
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [foto] } });
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudo subir la imagen', expect.stringContaining('bucket no existe'), 'error')
      );
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('guarda la descripción y el stock crítico escritos en el formulario', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      escribir('Descripción (Opcional)', 'Mecánico');
      escribir('Stock Crítico', '3');
      enviar();
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith(
          expect.objectContaining({ descripcion: 'Mecánico', stock_critico: 3 })
        )
      );
    });
  });

  describe('editar', () => {
    it('abre el formulario con los datos y el código bloqueado', async () => {
      const user = await renderProductos();
      await user.click(within(fila('Mouse Logitech')).getAllByRole('button')[0]);
      expect(screen.getByText('Editar Producto')).toBeInTheDocument();
      expect(campo('Código producto *')).toHaveValue('MOUSE1');
      expect(campo('Código producto *')).toBeDisabled();
      expect(campo('Nombre *')).toHaveValue('Mouse Logitech');
    });

    it('actualiza el producto por su código', async () => {
      const user = await renderProductos();
      await user.click(within(fila('Mouse Logitech')).getAllByRole('button')[0]);
      escribir('Nombre *', 'Mouse Pro');
      enviar();
      await waitFor(() =>
        expect(mocks.update).toHaveBeenCalledWith(
          'MOUSE1',
          expect.objectContaining({ nombre: 'Mouse Pro', precio: 10000, stock: 2, descuento_porcentaje: 15 })
        )
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Producto actualizado'));
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('permite cambiar el producto a otra categoría de la tabla', async () => {
      const user = await renderProductos();
      await user.click(within(fila('Mouse Logitech')).getAllByRole('button')[0]);
      escribir('Categoría *', 'gaming_gear');
      enviar();
      await waitFor(() =>
        expect(mocks.update).toHaveBeenCalledWith('MOUSE1', expect.objectContaining({ categoria: 'gaming_gear' }))
      );
    });
  });

  describe('eliminar', () => {
    it('al confirmar borra el producto', async () => {
      const user = await renderProductos();
      await user.click(within(fila('RTX 4070')).getAllByRole('button')[1]);
      await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith('RTX1'));
      expect(Swal.fire).toHaveBeenCalledWith(toast('Producto eliminado'));
    });

    it('si se cancela no borra nada', async () => {
      Swal.fire.mockResolvedValue({ isConfirmed: false });
      const user = await renderProductos();
      await user.click(within(fila('RTX 4070')).getAllByRole('button')[1]);
      await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
      expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it('si ms-productos falla al borrar muestra el error', async () => {
      mocks.eliminar.mockRejectedValue(errorApi('tiene órdenes asociadas', 409));
      const user = await renderProductos();
      await user.click(within(fila('RTX 4070')).getAllByRole('button')[1]);
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'tiene órdenes asociadas', 'error'));
    });
  });

  describe('casos límite', () => {
    const editar = (user, fila_) => user.click(within(fila_).getAllByRole('button')[0]);

    it('si la lista llega sin datos muestra el mensaje de vacío', async () => {
      await renderProductos(null);
      expect(await screen.findByText('No hay productos guardados todavía.')).toBeInTheDocument();
    });

    it('muestra el valor de la categoría tal cual si no está en la tabla y 0 si no hay stock', async () => {
      await renderProductos([
        { id: 'CAB1', nombre: 'Cable', precio: 1500, stock: null, stock_critico: null, categoria: 'audio', imagen: '', descuento_porcentaje: null },
      ]);
      const cable = within(fila('Cable'));
      expect(cable.getByText('audio')).toBeInTheDocument();
      expect(cable.getByText('0')).toBeInTheDocument();
    });

    it('al editar un producto con datos nulos deja los campos vacíos', async () => {
      const user = await renderProductos([
        { id: 'NUL1', nombre: null, descripcion: null, precio: null, stock: null, stock_critico: null,
          categoria: null, imagen: null, descuento_porcentaje: null },
      ]);
      await editar(user, screen.getByText('NUL1').closest('tr'));
      expect(campo('Nombre *')).toHaveValue('');
      expect(campo('Descripción (Opcional)')).toHaveValue('');
      expect(campo('Precio ($) *')).toHaveValue(null);
      expect(campo('Stock Crítico')).toHaveValue(null);
      expect(campo('Categoría *')).toHaveValue('');
    });

    it('si ms-productos falla al actualizar muestra el error', async () => {
      mocks.update.mockRejectedValue(errorApi('falló al actualizar', 500));
      const user = await renderProductos();
      await editar(user, fila('Mouse Logitech'));
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'falló al actualizar', 'error'));
    });

  });
});
