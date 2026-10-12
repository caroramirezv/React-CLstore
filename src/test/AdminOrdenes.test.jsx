import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminOrdenes from '../pages/Admin/AdminOrdenes';
import { cadena } from '../../test/cadenaSupabase';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

const ordenes = [
  {
    id: 41,
    creado_en: '2026-10-12T15:00:00.000Z',
    nombre_comprador: 'Ana',
    apellidos_comprador: 'Pérez',
    correo_comprador: 'ana@gmail.com',
    direccion: 'Calle 123',
    comuna: 'Arica',
    region: 'Arica y Parinacota',
    total: 20000,
    estado: 'exitosa',
  },
  {
    id: 42,
    creado_en: '2026-10-11T15:00:00.000Z',
    nombre_comprador: 'Luis',
    apellidos_comprador: 'Díaz',
    correo_comprador: 'luis@gmail.com',
    direccion: 'Prat 10',
    comuna: 'Iquique',
    region: 'Tarapacá',
    total: 5000,
    estado: 'fallida',
  },
];

const items = {
  41: [{ id: 'i1', nombre_producto: 'Mouse <pro>', cantidad: 2, precio_unitario: 10000 }],
  42: [],
};

function renderOrdenes(lista = ordenes, error = null) {
  mocks.from.mockImplementation((tabla) => {
    if (tabla === 'orden_items') {
      return {
        select: () => ({
          eq: (_col, id) => Promise.resolve({ data: items[id] || [], error: null }),
        }),
      };
    }
    return cadena(() => ({ data: error ? null : lista, error }));
  });
  render(<AdminOrdenes />);
  return userEvent.setup();
}

describe('AdminOrdenes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra "Cargando órdenes..." mientras espera', async () => {
    let resolver;
    mocks.from.mockImplementation(() => ({
      select: () => ({ order: () => new Promise((resolve) => { resolver = resolve; }) }),
    }));
    render(<AdminOrdenes />);
    expect(screen.getByText('Cargando órdenes...')).toBeInTheDocument();
    resolver({ data: [], error: null });
    expect(await screen.findByText('Todavía no hay órdenes registradas.')).toBeInTheDocument();
  });

  it('lista comprador, comuna, total y estado', async () => {
    renderOrdenes();
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Luis Díaz')).toBeInTheDocument();
    expect(screen.getByText('Arica')).toBeInTheDocument();
    expect(screen.getByText('$20.000')).toBeInTheDocument();
    expect(screen.getByText('Exitosa')).toBeInTheDocument();
    expect(screen.getByText('Fallida')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Ver boleta' })).toHaveLength(2);
  });

  it('si la carga falla deja la tabla vacía', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderOrdenes([], { message: 'falló' });
    expect(await screen.findByText('Todavía no hay órdenes registradas.')).toBeInTheDocument();
  });

  it('abrir la boleta muestra el detalle y permite ocultarlo', async () => {
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(screen.getAllByRole('button', { name: 'Ver boleta' })[0]);
    expect(await screen.findByText('Mouse <pro>')).toBeInTheDocument();
    expect(screen.getByText('Boleta de compra #41')).toBeInTheDocument();
    expect(screen.getByText('ana@gmail.com · Calle 123, Arica, Arica y Parinacota')).toBeInTheDocument();
    expect(screen.getAllByText('$20.000').length).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByText('Boleta de compra #41')).not.toBeInTheDocument();
  });

  it('imprimir escribe un comprobante con el HTML escapado', async () => {
    const write = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ document: { write, close: vi.fn() } });
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(screen.getAllByRole('button', { name: 'Ver boleta' })[0]);
    await screen.findByRole('button', { name: /Imprimir/ });
    await user.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toContain('Mouse &lt;pro&gt;');
    expect(write.mock.calls[0][0]).toContain('#41');
  });

  it('avisa si el navegador bloquea la ventana de impresión', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(screen.getAllByRole('button', { name: 'Ver boleta' })[0]);
    await user.click(await screen.findByRole('button', { name: /Imprimir/ }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/bloqueó la ventana/));
  });

  it('deshabilita imprimir cuando la orden no tiene productos', async () => {
    const user = renderOrdenes();
    await screen.findByText('Luis Díaz');
    await user.click(screen.getAllByRole('button', { name: 'Ver boleta' })[1]);
    expect(await screen.findByText('No hay productos en esta orden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeDisabled();
  });
});
