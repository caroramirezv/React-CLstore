import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminBlogs from '../pages/Admin/AdminBlogs';
import { cadena } from '../../test/cadenaSupabase';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(() => Promise.resolve({ isConfirmed: true })) } }));
vi.mock('bootstrap', () => ({ Modal: { getInstance: () => null } }));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

const blogs = [
  {
    id: 'guia-pc',
    titulo: 'Cómo armar un PC',
    resumen: 'Parte por la placa.',
    imagen: 'pc.jpg',
    contenido: ['Primer párrafo', 'Segundo'],
    fuente_nombre: 'Equipo CLstore',
    fuente_url: 'https://clstore.example/guia',
    created_at: '2026-10-01T12:00:00.000Z',
  },
  { id: 'nota', titulo: 'Sin foto', resumen: '', imagen: '', contenido: [], created_at: null },
];

const estado = {
  blogs,
  errorLista: null,
  uno: { data: null, error: null },
  alInsertar: vi.fn(),
  alActualizar: vi.fn(),
  alEliminar: vi.fn(),
  alEq: vi.fn(),
};

function renderBlogs() {
  mocks.from.mockImplementation(() => cadena(() => ({
    data: estado.blogs,
    error: estado.errorLista,
    uno: estado.uno,
    alInsertar: estado.alInsertar,
    alActualizar: estado.alActualizar,
    alEliminar: estado.alEliminar,
    alEq: estado.alEq,
  })));
  render(<AdminBlogs />);
  return userEvent.setup();
}

function campo(etiqueta) {
  return screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input, textarea');
}

describe('AdminBlogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    estado.blogs = blogs;
    estado.errorLista = null;
    estado.uno = { data: null, error: null };
  });

  it('muestra "Cargando blogs..." mientras espera', async () => {
    let resolver;
    mocks.from.mockImplementation(() => ({
      select: () => ({ order: () => new Promise((resolve) => { resolver = resolve; }) }),
    }));
    render(<AdminBlogs />);
    expect(screen.getByText('Cargando blogs...')).toBeInTheDocument();
    resolver({ data: [], error: null });
    expect(await screen.findByText('Todavía no hay blogs publicados.')).toBeInTheDocument();
  });

  it('lista título, resumen, id e imagen', async () => {
    renderBlogs();
    expect(await screen.findByText('Cómo armar un PC')).toBeInTheDocument();
    expect(screen.getByText('Parte por la placa.')).toBeInTheDocument();
    expect(screen.getByText('ID: guia-pc')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cómo armar un PC' })).toHaveAttribute('src', 'pc.jpg');
    expect(screen.getByText('Sin resumen')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('si la carga falla avisa y deja la tabla vacía', async () => {
    estado.errorLista = { message: 'sin permiso' };
    estado.blogs = [];
    renderBlogs();
    expect(await screen.findByText('Todavía no hay blogs publicados.')).toBeInTheDocument();
    expect(Swal.fire).toHaveBeenCalledWith('No se pudieron cargar los blogs', 'sin permiso', 'error');
  });

  it('rechaza el envío si faltan datos y no inserta', async () => {
    const user = renderBlogs();
    await screen.findByRole('button', { name: /Nuevo blog/ });
    fireEvent.submit(screen.getByRole('button', { name: 'Crear blog', hidden: true }).form);
    expect(Swal.fire).toHaveBeenCalledWith('Faltan datos', expect.any(String), 'warning');
    expect(estado.alInsertar).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Nuevo blog/ }));
    expect(screen.getByRole('heading', { name: 'Crear blog', hidden: true })).toBeInTheDocument();
  });

  it('rechaza una URL de fuente que no es http(s)', () => {
    renderBlogs();
    fireEvent.change(campo('Identificador *'), { target: { value: 'guia' } });
    fireEvent.change(campo('Título *'), { target: { value: 'Título' } });
    fireEvent.change(campo('Resumen *'), { target: { value: 'Resumen' } });
    fireEvent.change(campo('Contenido del artículo *'), { target: { value: 'Texto' } });
    fireEvent.change(campo('URL de la fuente'), { target: { value: 'ftp://archivo' } });
    fireEvent.submit(campo('Título *').form);
    expect(Swal.fire).toHaveBeenCalledWith('URL no válida', expect.any(String), 'error');
    expect(estado.alInsertar).not.toHaveBeenCalled();
  });

  it('rechaza un identificador que ya existe', async () => {
    estado.uno = { data: { id: 'guia' }, error: null };
    renderBlogs();
    fireEvent.change(campo('Identificador *'), { target: { value: 'guia' } });
    fireEvent.change(campo('Título *'), { target: { value: 'Título' } });
    fireEvent.change(campo('Resumen *'), { target: { value: 'Resumen' } });
    fireEvent.change(campo('Contenido del artículo *'), { target: { value: 'Texto' } });
    fireEvent.submit(campo('Título *').form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Identificador repetido', expect.any(String), 'error'));
    expect(estado.alInsertar).not.toHaveBeenCalled();
  });

  it('crea el blog separando los párrafos por líneas en blanco', async () => {
    renderBlogs();
    fireEvent.change(campo('Identificador *'), { target: { value: 'guia-nueva' } });
    fireEvent.change(campo('Título *'), { target: { value: 'Guía nueva' } });
    fireEvent.change(campo('Resumen *'), { target: { value: 'Un resumen' } });
    fireEvent.change(campo('Contenido del artículo *'), { target: { value: 'Hola\n\nMundo' } });
    fireEvent.submit(campo('Título *').form);
    await waitFor(() => expect(estado.alInsertar).toHaveBeenCalledWith({
      id: 'guia-nueva',
      titulo: 'Guía nueva',
      resumen: 'Un resumen',
      imagen: null,
      contenido: ['Hola', 'Mundo'],
      fuente_nombre: null,
      fuente_url: null,
    }));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Blog creado', icon: 'success' }));
  });

  it('rechaza un archivo que no es imagen y uno que pesa más de 5 MB', () => {
    renderBlogs();
    const input = campo('Imagen (opcional)');
    fireEvent.change(input, { target: { files: [new File(['x'], 'nota.txt', { type: 'text/plain' })] } });
    expect(Swal.fire).toHaveBeenCalledWith('Archivo no válido', expect.any(String), 'error');

    const grande = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(grande, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [grande] } });
    expect(Swal.fire).toHaveBeenCalledWith('Imagen demasiado grande', expect.any(String), 'error');
  });

  it('editar carga el artículo y guarda los cambios', async () => {
    const user = renderBlogs();
    await screen.findByText('Cómo armar un PC');
    const fila = screen.getByText('Cómo armar un PC').closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar blog', hidden: true })).toBeInTheDocument();
    expect(campo('Identificador *')).toBeDisabled();
    expect(campo('Identificador *')).toHaveValue('guia-pc');
    expect(campo('Contenido del artículo *')).toHaveValue('Primer párrafo\n\nSegundo');
    fireEvent.change(campo('Título *'), { target: { value: 'Título editado' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar cambios', hidden: true }).form);
    await waitFor(() => expect(estado.alActualizar).toHaveBeenCalledWith(expect.objectContaining({
      titulo: 'Título editado',
      contenido: ['Primer párrafo', 'Segundo'],
    })));
    expect(estado.alEq).toHaveBeenCalledWith('id', 'guia-pc');
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Blog actualizado' }));
  });

  it('eliminar pide confirmación y, si se cancela, no borra', async () => {
    Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
    const user = renderBlogs();
    await screen.findByText('Sin foto');
    const fila = screen.getByText('Sin foto').closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar este blog?' }));
    expect(estado.alEliminar).not.toHaveBeenCalled();
  });

  it('eliminar confirmado borra el blog', async () => {
    const user = renderBlogs();
    await screen.findByText('Sin foto');
    const fila = screen.getByText('Sin foto').closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(estado.alEliminar).toHaveBeenCalled());
    expect(estado.alEq).toHaveBeenCalledWith('id', 'nota');
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Blog eliminado' }));
  });
});
