import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminBlogs from '../pages/Admin/AdminBlogs';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));

// ms-blogs: una función por operación (listar, crear, actualizar, borrar y subir imagen).
const mocks = vi.hoisted(() => ({
  lista: [],
  insert: vi.fn(),
  update: vi.fn(),
  eliminar: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('../api/blogsApi', () => ({
  listarBlogs: () => (mocks.lista instanceof Error ? Promise.reject(mocks.lista) : Promise.resolve(mocks.lista)),
  crearBlog: (blog) => mocks.insert(blog),
  actualizarBlog: (id, blog) => mocks.update(id, blog),
  eliminarBlog: (id) => mocks.eliminar(id),
  subirImagenBlog: (archivo) => mocks.upload(archivo),
}));

// Error de microservicio (ApiError) con el código HTTP, como lo lanza src/api/http.js
const errorApi = (mensaje, status) => Object.assign(new Error(mensaje), { status });

const blogs = [
  { id: 'guia-pc', titulo: 'Cómo armar un PC', resumen: 'Guía corta', imagen: 'pc.jpg',
    contenido: ['Uno', 'Dos'], fuente_nombre: 'Ana', fuente_url: 'https://ana.cl', created_at: '2026-10-01T12:00:00' },
  { id: 'ofertas', titulo: 'Ofertas de octubre', resumen: 'Lo mejor', imagen: null,
    contenido: ['Texto'], fuente_nombre: null, fuente_url: null, created_at: null },
];

const campo = (etiqueta) =>
  screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, textarea');
const escribir = (etiqueta, valor) => fireEvent.change(campo(etiqueta), { target: { value: valor } });
const enviar = () => fireEvent.submit(campo('Título *').closest('form'));
const fila = (titulo) => screen.getByText(titulo).closest('tr');
const toast = (titulo) => expect.objectContaining({ title: titulo });

// lista: blogs, null (sin datos) o un Error (ms-blogs falla)
function renderBlogs(lista = blogs) {
  mocks.lista = lista;
  render(<AdminBlogs />);
  return userEvent.setup();
}

function llenarBlogNuevo() {
  escribir('Identificador *', 'nuevo-blog');
  escribir('Título *', 'Nuevo blog');
  escribir('Resumen *', 'Un resumen');
  escribir('Contenido del artículo *', 'Primer párrafo\n\nSegundo párrafo');
}

describe('AdminBlogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Swal.fire.mockResolvedValue({ isConfirmed: true });
    mocks.insert.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.eliminar.mockResolvedValue(null);
    mocks.upload.mockResolvedValue('https://cdn.test/blogs/portada-subida.png');
    URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
  });

  describe('listado', () => {
    it('muestra "Cargando blogs..." y luego una fila por blog', async () => {
      renderBlogs();
      expect(screen.getByText('Cargando blogs...')).toBeInTheDocument();
      expect(await screen.findByText('Cómo armar un PC')).toBeInTheDocument();
      expect(screen.getByText('Ofertas de octubre')).toBeInTheDocument();
      expect(screen.getByText('ID: guia-pc')).toBeInTheDocument();
      expect(screen.queryByText('Cargando blogs...')).not.toBeInTheDocument();
    });

    it('sin blogs muestra el mensaje de vacío', async () => {
      renderBlogs([]);
      expect(await screen.findByText('Todavía no hay blogs publicados.')).toBeInTheDocument();
    });

    it('si la carga falla avisa con un Swal', async () => {
      renderBlogs(new Error('falló'));
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudieron cargar los blogs', 'falló', 'error')
      );
    });
  });

  describe('crear', () => {
    it('guarda el blog separando el contenido en párrafos', async () => {
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
      llenarBlogNuevo();
      enviar();
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith({
          id: 'nuevo-blog', titulo: 'Nuevo blog', resumen: 'Un resumen', imagen: null,
          contenido: ['Primer párrafo', 'Segundo párrafo'], fuente_nombre: null, fuente_url: null,
        })
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Blog creado'));
    });

    it('exige identificador, título, resumen y contenido', async () => {
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
      llenarBlogNuevo();
      escribir('Resumen *', '   ');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('Faltan datos', expect.any(String), 'warning');
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('rechaza una URL de fuente que no empieza con http(s)', async () => {
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
      llenarBlogNuevo();
      escribir('URL de la fuente', 'ftp://ejemplo.cl');
      enviar();
      expect(Swal.fire).toHaveBeenCalledWith('URL no válida', expect.any(String), 'error');
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('rechaza un identificador que ya existe (ms-blogs responde 409)', async () => {
      mocks.insert.mockRejectedValue(errorApi('Ya existe un blog con ese identificador.', 409));
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
      llenarBlogNuevo();
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Identificador repetido', expect.any(String), 'error'));
    });

    it('si ms-blogs falla al crear muestra el error', async () => {
      mocks.insert.mockRejectedValue(errorApi('falló', 500));
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
      llenarBlogNuevo();
      enviar();
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('No se pudo guardar el blog', 'falló', 'error'));
    });
  });

  describe('imagen', () => {
    const abrirNuevo = async () => {
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
      return user;
    };
    const elegir = (archivo) =>
      fireEvent.change(campo('Imagen (opcional)'), { target: { files: archivo ? [archivo] : [] } });

    it('rechaza un archivo que no es imagen', async () => {
      await abrirNuevo();
      elegir(new File(['hola'], 'nota.txt', { type: 'text/plain' }));
      expect(Swal.fire).toHaveBeenCalledWith('Archivo no válido', expect.any(String), 'error');
      expect(screen.queryByAltText('Vista previa')).not.toBeInTheDocument();
    });

    it('rechaza una imagen de más de 5 MB', async () => {
      await abrirNuevo();
      elegir(new File([new ArrayBuffer(5 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' }));
      expect(Swal.fire).toHaveBeenCalledWith('Imagen demasiado grande', expect.any(String), 'error');
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('ignora el cambio si no se elige ningún archivo', async () => {
      await abrirNuevo();
      elegir(null);
      expect(Swal.fire).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('muestra la vista previa de la imagen elegida', async () => {
      await abrirNuevo();
      elegir(new File(['img'], 'portada.png', { type: 'image/png' }));
      expect(screen.getByAltText('Vista previa')).toHaveAttribute('src', 'blob:vista-previa');
    });

    it('sube la imagen a ms-blogs y guarda la URL que devuelve', async () => {
      await abrirNuevo();
      llenarBlogNuevo();
      const foto = new File(['img'], 'Portada.PNG', { type: 'image/png' });
      elegir(foto);
      enviar();
      await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
      expect(mocks.upload).toHaveBeenCalledWith(foto);
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'nuevo-blog', imagen: 'https://cdn.test/blogs/portada-subida.png' })
      );
    });

    it('si falla la subida avisa con el motivo y no guarda el blog', async () => {
      mocks.upload.mockRejectedValue(errorApi('bucket no existe', 500));
      await abrirNuevo();
      llenarBlogNuevo();
      elegir(new File(['img'], 'portada.png', { type: 'image/png' }));
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith(
          'No se pudo guardar el blog',
          expect.stringContaining('bucket no existe'),
          'error'
        )
      );
      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('la URL de imagen escrita actualiza la vista previa y se guarda', async () => {
      await abrirNuevo();
      llenarBlogNuevo();
      escribir('URL de imagen (opcional)', 'https://img.cl/a.jpg');
      expect(screen.getByAltText('Vista previa')).toHaveAttribute('src', 'https://img.cl/a.jpg');
      enviar();
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ imagen: 'https://img.cl/a.jpg' }))
      );
    });

    it('con un archivo elegido, escribir la URL no cambia la vista previa', async () => {
      await abrirNuevo();
      elegir(new File(['img'], 'portada.png', { type: 'image/png' }));
      escribir('URL de imagen (opcional)', 'https://img.cl/b.jpg');
      expect(screen.getByAltText('Vista previa')).toHaveAttribute('src', 'blob:vista-previa');
    });

    it('guarda el autor y la URL de la fuente', async () => {
      await abrirNuevo();
      llenarBlogNuevo();
      escribir('Autor / fuente', 'Equipo CLstore');
      escribir('URL de la fuente', 'https://clstore.cl');
      enviar();
      await waitFor(() =>
        expect(mocks.insert).toHaveBeenCalledWith(
          expect.objectContaining({ fuente_nombre: 'Equipo CLstore', fuente_url: 'https://clstore.cl' })
        )
      );
    });
  });

  describe('editar', () => {
    it('abre el formulario con los datos y el identificador bloqueado', async () => {
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(within(fila('Cómo armar un PC')).getByRole('button', { name: 'Editar' }));
      expect(screen.getByText('Editar blog')).toBeInTheDocument();
      expect(campo('Identificador *')).toHaveValue('guia-pc');
      expect(campo('Identificador *')).toBeDisabled();
      expect(campo('Contenido del artículo *')).toHaveValue('Uno\n\nDos');
    });

    it('actualiza el blog por su identificador', async () => {
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(within(fila('Cómo armar un PC')).getByRole('button', { name: 'Editar' }));
      escribir('Título *', 'Armar un PC en 2026');
      enviar();
      await waitFor(() =>
        expect(mocks.update).toHaveBeenCalledWith(
          'guia-pc',
          expect.objectContaining({ titulo: 'Armar un PC en 2026', contenido: ['Uno', 'Dos'] })
        )
      );
      expect(Swal.fire).toHaveBeenCalledWith(toast('Blog actualizado'));
      expect(mocks.insert).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('al confirmar borra el blog', async () => {
      const user = renderBlogs();
      await screen.findByText('Ofertas de octubre');
      await user.click(within(fila('Ofertas de octubre')).getByRole('button', { name: 'Eliminar' }));
      await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith('ofertas'));
      expect(Swal.fire).toHaveBeenCalledWith(toast('Blog eliminado'));
    });

    it('si se cancela no borra nada', async () => {
      Swal.fire.mockResolvedValue({ isConfirmed: false });
      const user = renderBlogs();
      await screen.findByText('Ofertas de octubre');
      await user.click(within(fila('Ofertas de octubre')).getByRole('button', { name: 'Eliminar' }));
      await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
      expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it('si ms-blogs falla al borrar muestra el error', async () => {
      mocks.eliminar.mockRejectedValue(errorApi('sin permisos', 403));
      const user = renderBlogs();
      await screen.findByText('Ofertas de octubre');
      await user.click(within(fila('Ofertas de octubre')).getByRole('button', { name: 'Eliminar' }));
      await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('No se pudo eliminar', 'sin permisos', 'error'));
    });
  });

  describe('casos límite', () => {
    it('si la lista llega sin datos muestra el mensaje de vacío', async () => {
      renderBlogs(null);
      expect(await screen.findByText('Todavía no hay blogs publicados.')).toBeInTheDocument();
    });

    it('un blog sin resumen ni datos opcionales se lista y se abre vacío al editar', async () => {
      const user = renderBlogs([{ id: 'vacio', titulo: 'Sin datos', resumen: null, imagen: null, contenido: null,
        fuente_nombre: null, fuente_url: null, created_at: null }]);
      await screen.findByText('Sin datos');
      expect(within(fila('Sin datos')).getByText('Sin resumen')).toBeInTheDocument();
      await user.click(within(fila('Sin datos')).getByRole('button', { name: 'Editar' }));
      expect(campo('Resumen *')).toHaveValue('');
      expect(campo('Contenido del artículo *')).toHaveValue('');
      expect(campo('Autor / fuente')).toHaveValue('');
      expect(campo('URL de la fuente')).toHaveValue('');
    });

    it('si el error de guardado no trae mensaje usa uno genérico', async () => {
      mocks.insert.mockRejectedValue({});
      const user = renderBlogs();
      await screen.findByText('Cómo armar un PC');
      await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
      llenarBlogNuevo();
      enviar();
      await waitFor(() =>
        expect(Swal.fire).toHaveBeenCalledWith('No se pudo guardar el blog', 'Ocurrió un error inesperado.', 'error')
      );
    });
  });
});
