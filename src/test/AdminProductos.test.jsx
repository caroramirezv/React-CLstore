import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminProductos from '../pages/Admin/AdminProductos';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));

// Una función por operación: listar, buscar repetido, insertar, actualizar y borrar.
const mocks = vi.hoisted(() => ({
  lista: { data: [] },
  existente: { data: null },
  insert: vi.fn(),
  update: vi.fn(),
  eliminar: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (ruta, archivo, opciones) => mocks.upload(ruta, archivo, opciones),
        getPublicUrl: (ruta) => ({ data: { publicUrl: `https://cdn.test/${ruta}` } }),
      }),
    },
    from: () => ({
      select: (columnas) =>
        columnas === '*'
          ? { order: () => Promise.resolve(mocks.lista) }
          : { eq: () => ({ maybeSingle: () => Promise.resolve(mocks.existente) }) },
      insert: (fila) => mocks.insert(fila),
      update: (payload) => ({ eq: (col, valor) => mocks.update(payload, col, valor) }),
      delete: () => ({ eq: (col, valor) => mocks.eliminar(col, valor) }),
    }),
  },
}));

const productos = [
  { id: 'MOUSE1', nombre: 'Mouse Logitech', precio: 10000, stock: 2, stock_critico: 5, categoria: 'perifericos',
    imagen: 'mouse.jpg', descuento_porcentaje: 15, descripcion: 'Óptico' },
  { id: 'RTX1', nombre: 'RTX 4070', precio: 500000, stock: 8, stock_critico: 2, categoria: 'componentes',
    imagen: '', descuento_porcentaje: null },
];

const campo = (etiqueta) =>
  screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, select, textarea');
const escribir = (etiqueta, valor) => fireEvent.change(campo(etiqueta), { target: { value: valor } });
const enviar = () => fireEvent.submit(campo('Nombre *').closest('form'));
const fila = (nombre) => screen.getByText(nombre).closest('tr');
const toast = (titulo) => expect.objectContaining({ title: titulo });

async function renderProductos(lista = productos) {
  mocks.lista = { data: lista };
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
    mocks.existente = { data: null };
    mocks.insert.mockResolvedValue({ error: null });
    mocks.update.mockResolvedValue({ error: null });
    mocks.eliminar.mockResolvedValue({ error: null });
    mocks.upload.mockResolvedValue({ error: null });
    URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
  });

  describe('listado', () => {
    it('muestra una fila por producto con categoría, precio y oferta', async () => {
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

  describe('crear', () => {
    it('guarda un producto nuevo con los datos del formulario', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      enviar();
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith({
          id: 'TEC1', nombre: 'Teclado', descripcion: '', precio: 20000, stock: 5, stock_critico: null,
          categoria: 'perifericos', imagen: '/img/Logo.png', busqueda: 'teclado', descuento_porcentaje: null,
        })
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Producto creado'));
    });

    it('rechaza un código que ya existe', async () => {
      mocks.existente = { data: { id: 'TEC1' } };
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Código repetido', expect.any(String), 'error'));
      expect(mocks.insert).not.toHaveBeenCalled();
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

    it('si Supabase falla al insertar muestra el error', async () => {
      mocks.insert.mockResolvedValue({ error: { message: 'falló' } });
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

    it('sube la imagen elegida y guarda su URL pública', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      const foto = new File(['img'], 'Teclado.PNG', { type: 'image/png' });
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [foto] } });
      expect(URL.createObjectURL).toHaveBeenCalledWith(foto);
      expect(screen.getByText('Teclado.PNG')).toBeInTheDocument();
      enviar();
      await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
      const [ruta, archivo, opciones] = mocks.upload.mock.calls[0];
      expect(ruta).toMatch(/^TEC1\/\d+\.png$/);
      expect(archivo).toBe(foto);
      expect(opciones).toEqual({ cacheControl: '3600', upsert: false, contentType: 'image/png' });
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'TEC1', imagen: `https://cdn.test/${ruta}` })
      );
    });

    it('usa la extensión jpg si el nombre del archivo no tiene una válida', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      const foto = new File(['img'], 'foto.!!!', { type: 'image/jpeg' });
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [foto] } });
      enviar();
      await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
      expect(mocks.upload.mock.calls[0][0]).toMatch(/^TEC1\/\d+\.jpg$/);
    });

    it('si falla la subida de la imagen avisa y no guarda el producto', async () => {
      mocks.upload.mockResolvedValue({ error: { message: 'bucket no existe' } });
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
          expect.objectContaining({ nombre: 'Mouse Pro', precio: 10000, stock: 2, descuento_porcentaje: 15 }),
          'id',
          'MOUSE1'
        )
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Producto actualizado'));
      expect(mocks.insert).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('al confirmar borra el producto', async () => {
      const user = await renderProductos();
      await user.click(within(fila('RTX 4070')).getAllByRole('button')[1]);
      await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith('id', 'RTX1'));
      expect(Swal.fire).toHaveBeenCalledWith(toast('Producto eliminado'));
    });

    it('si se cancela no borra nada', async () => {
      Swal.fire.mockResolvedValue({ isConfirmed: false });
      const user = await renderProductos();
      await user.click(within(fila('RTX 4070')).getAllByRole('button')[1]);
      await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
      expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it('si Supabase falla al borrar muestra el error', async () => {
      mocks.eliminar.mockResolvedValue({ error: { message: 'tiene órdenes asociadas' } });
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

    it('muestra la categoría tal cual si no es conocida y 0 si no hay stock', async () => {
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
    });

    it('si Supabase falla al actualizar muestra el error', async () => {
      mocks.update.mockResolvedValue({ error: { message: 'falló al actualizar' } });
      const user = await renderProductos();
      await editar(user, fila('Mouse Logitech'));
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'falló al actualizar', 'error'));
    });

    it('usa la extensión jpg si el nombre del archivo termina en punto', async () => {
      const user = await renderProductos();
      await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
      llenarProductoNuevo();
      const foto = new File(['img'], 'foto.', { type: 'image/jpeg' });
      fireEvent.change(campo('Foto del producto (Opcional)'), { target: { files: [foto] } });
      enviar();
      await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
      expect(mocks.upload.mock.calls[0][0]).toMatch(/^TEC1\/\d+\.jpg$/);
    });
  });
});
