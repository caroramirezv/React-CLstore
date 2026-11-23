import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Swal from 'sweetalert2';
import AdminContactos from '../pages/Admin/AdminContactos';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));

// ms-contacto: bandeja de mensajes (listar y eliminar).
const mocks = vi.hoisted(() => ({
  lista: [],
  eliminar: vi.fn(),
}));
vi.mock('../api/contactoApi', () => ({
  listarContactos: () => (mocks.lista instanceof Error ? Promise.reject(mocks.lista) : Promise.resolve(mocks.lista)),
  eliminarContacto: (id) => mocks.eliminar(id),
}));

const contactos = [
  { id: 2, nombre: 'Ana Pérez', email: 'ana@gmail.com', mensaje: '¿Tienen stock de la RTX 3080?', creado_en: '2026-11-20T15:30:00Z' },
  { id: 1, nombre: 'Luis Soto', email: 'luis@duoc.cl', mensaje: 'Mi pedido llegó incompleto', creado_en: '2026-11-18T10:00:00Z' },
];

function renderVista(lista = contactos) {
  mocks.lista = lista;
  mocks.eliminar.mockReset();
  mocks.eliminar.mockResolvedValue(null);
  Swal.fire.mockReset();
  Swal.fire.mockResolvedValue({ isConfirmed: true });
  render(<AdminContactos />);
  return { user: userEvent.setup() };
}

describe('AdminContactos', () => {
  it('muestra "Cargando mensajes..." y luego la lista con el contador', async () => {
    renderVista();
    expect(screen.getByText('Cargando mensajes...')).toBeInTheDocument();
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Cargando mensajes...')).not.toBeInTheDocument();
    expect(screen.getByText('Luis Soto')).toBeInTheDocument();
    expect(screen.getByText('¿Tienen stock de la RTX 3080?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('2');
  });

  it('el correo es un enlace mailto y hay un botón para responder', async () => {
    renderVista();
    expect(await screen.findByRole('link', { name: 'ana@gmail.com' })).toHaveAttribute('href', 'mailto:ana@gmail.com');
    const botones = screen.getAllByRole('link', { name: 'Responder' });
    expect(botones[0].getAttribute('href')).toMatch(/^mailto:ana@gmail\.com\?subject=/);
  });

  it('sin mensajes avisa que todavía no hay ninguno', async () => {
    renderVista([]);
    expect(await screen.findByText('Todavía no hay mensajes de contacto.')).toBeInTheDocument();
  });

  it('si ms-contacto falla muestra el error', async () => {
    renderVista(new Error('No tienes permisos para realizar esta acción.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para realizar esta acción.');
  });

  it('el buscador filtra por nombre, correo o mensaje', async () => {
    const { user } = renderVista();
    await screen.findByText('Ana Pérez');
    await user.type(screen.getByLabelText('Buscar mensajes'), 'incompleto');
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
    expect(screen.getByText('Luis Soto')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar mensajes'));
    await user.type(screen.getByLabelText('Buscar mensajes'), 'zzz');
    expect(screen.getByText('Ningún mensaje coincide con la búsqueda.')).toBeInTheDocument();
  });

  it('eliminar pide confirmación, borra en ms-contacto y quita la fila', async () => {
    const { user } = renderVista();
    const fila = (await screen.findByText('Ana Pérez')).closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(mocks.eliminar).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument());
    expect(screen.getByText('Luis Soto')).toBeInTheDocument();
  });

  it('si se cancela la confirmación no se elimina nada', async () => {
    const { user } = renderVista();
    Swal.fire.mockResolvedValue({ isConfirmed: false });
    const fila = (await screen.findByText('Ana Pérez')).closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }));
    expect(mocks.eliminar).not.toHaveBeenCalled();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });

  it('si eliminar falla avisa y conserva la fila', async () => {
    const { user } = renderVista();
    const fila = (await screen.findByText('Ana Pérez')).closest('tr');
    mocks.eliminar.mockRejectedValue(new Error('No se encontró el recurso solicitado.'));
    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() =>
      expect(Swal.fire).toHaveBeenCalledWith('No se pudo eliminar', 'No se encontró el recurso solicitado.', 'error')
    );
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });
});
