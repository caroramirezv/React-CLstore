import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminOrdenes from '../pages/Admin/AdminOrdenes';

// Consulta 1: la lista de órdenes. Consulta 2 (al abrir una boleta): los items de esa orden.
const mocks = vi.hoisted(() => ({ ordenes: { data: [], error: null }, items: {}, itemsError: null }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (tabla) =>
      tabla === 'orden_items'
        ? { select: () => ({ eq: (_col, id) => Promise.resolve({ data: Object.hasOwn(mocks.items, id) ? mocks.items[id] : [], error: mocks.itemsError }) }) }
        : { select: () => ({ order: () => Promise.resolve(mocks.ordenes) }) },
  },
}));

const ordenes = [
  {
    id: 41, creado_en: '2026-10-12T15:00:00', nombre_comprador: 'Ana', apellidos_comprador: 'Pérez',
    correo_comprador: 'ana@gmail.com', direccion: 'Calle 123', comuna: 'Arica', region: 'Arica y Parinacota',
    total: 20000, estado: 'exitosa',
  },
  {
    id: 42, creado_en: '2026-10-11T15:00:00', nombre_comprador: 'Luis', apellidos_comprador: 'Díaz',
    correo_comprador: 'luis@gmail.com', direccion: 'Prat 10', comuna: 'Iquique', region: 'Tarapacá',
    total: 5000, estado: 'fallida',
  },
];

function renderOrdenes(respuesta = { data: ordenes, error: null }) {
  mocks.ordenes = respuesta;
  mocks.itemsError = null;
  mocks.items = {
    41: [{ id: 'i1', nombre_producto: 'Mouse <pro>', cantidad: 2, precio_unitario: 10000 }],
    42: [],
  };
  render(<AdminOrdenes />);
  return userEvent.setup();
}

const fila = (nombre) => screen.getByText(nombre).closest('tr');

describe('AdminOrdenes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra "Cargando órdenes..." y luego la tabla', async () => {
    renderOrdenes();
    expect(screen.getByText('Cargando órdenes...')).toBeInTheDocument();
    await screen.findByText('Ana Pérez');
    expect(screen.queryByText('Cargando órdenes...')).not.toBeInTheDocument();
  });

  it('lista cada orden con comprador, comuna, total y estado', async () => {
    renderOrdenes();
    await screen.findByText('Ana Pérez');
    const filaAna = fila('Ana Pérez');
    expect(within(filaAna).getByText('#41')).toBeInTheDocument();
    expect(within(filaAna).getByText('Arica')).toBeInTheDocument();
    expect(within(filaAna).getByText('$20.000')).toBeInTheDocument();
    expect(within(filaAna).getByText('Exitosa')).toBeInTheDocument();
    expect(within(fila('Luis Díaz')).getByText('Fallida')).toBeInTheDocument();
  });

  it('sin órdenes muestra el mensaje de vacío', async () => {
    renderOrdenes({ data: [], error: null });
    expect(await screen.findByText('Todavía no hay órdenes registradas.')).toBeInTheDocument();
  });

  it('si la consulta falla no muestra órdenes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderOrdenes({ data: null, error: { message: 'falló' } });
    expect(await screen.findByText('Todavía no hay órdenes registradas.')).toBeInTheDocument();
  });

  it('"Ver boleta" despliega el detalle con los productos de la orden', async () => {
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ver boleta' }));
    expect(await screen.findByText('Boleta de compra #41')).toBeInTheDocument();
    expect(screen.getByText('Mouse <pro>')).toBeInTheDocument();
    expect(screen.getByText('$10.000')).toBeInTheDocument(); // precio unitario
    expect(screen.getByText('Total: $20.000')).toBeInTheDocument();
    expect(within(fila('Ana Pérez')).getByRole('button', { name: 'Ocultar' })).toBeInTheDocument();
  });

  it('"Ocultar" cierra el detalle', async () => {
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ver boleta' }));
    await screen.findByText('Boleta de compra #41');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByText('Boleta de compra #41')).not.toBeInTheDocument();
  });

  it('una orden sin items avisa y deshabilita la impresión', async () => {
    const user = renderOrdenes();
    await screen.findByText('Luis Díaz');
    await user.click(within(fila('Luis Díaz')).getByRole('button', { name: 'Ver boleta' }));
    expect(await screen.findByText('No hay productos en esta orden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeDisabled();
  });

  it('"Imprimir" abre una ventana con la boleta y escapa el HTML del producto', async () => {
    const ventana = { document: { write: vi.fn(), close: vi.fn() } };
    vi.spyOn(window, 'open').mockReturnValue(ventana);
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ver boleta' }));
    await user.click(await screen.findByRole('button', { name: /Imprimir/ }));
    const html = ventana.document.write.mock.calls[0][0];
    expect(html).toContain('Boleta orden #41');
    expect(html).toContain('Mouse &lt;pro&gt;');
    expect(html).not.toContain('Mouse <pro>');
    expect(ventana.document.close).toHaveBeenCalled();
  });

  it('si el navegador bloquea la ventana avisa con un alert', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ver boleta' }));
    await user.click(await screen.findByRole('button', { name: /Imprimir/ }));
    expect(alerta).toHaveBeenCalledWith(expect.stringContaining('bloqueó la ventana'));
  });

  it('si falla la consulta de los productos de la orden lo registra en consola', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = renderOrdenes();
    mocks.itemsError = { message: 'falló' };
    await screen.findByText('Ana Pérez');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ver boleta' }));
    await waitFor(() =>
      expect(consola).toHaveBeenCalledWith('Error al cargar los productos de la orden:', 'falló')
    );
  });

  it('la boleta usa textos por defecto cuando faltan datos de la orden', async () => {
    const ventana = { document: { write: vi.fn(), close: vi.fn() } };
    vi.spyOn(window, 'open').mockReturnValue(ventana);
    const user = renderOrdenes({
      data: [{
        id: 43, creado_en: '2026-10-10T10:00:00', total: 0, estado: null, nombre_comprador: null,
        apellidos_comprador: null, correo_comprador: null, direccion: null, comuna: null, region: null,
      }],
      error: null,
    });
    mocks.items[43] = [{ id: 'i3', nombre_producto: null, cantidad: null, precio_unitario: null }];
    await screen.findByText('#43');
    await user.click(screen.getByRole('button', { name: 'Ver boleta' }));
    await user.click(await screen.findByRole('button', { name: /Imprimir/ }));
    const html = ventana.document.write.mock.calls[0][0];
    expect(html).toContain('No informado');
    expect(html).toContain('Sin correo registrado');
    expect(html).toContain('Dirección no informada');
    expect(html).toContain('Sin estado');
    expect(html).toContain('<td>Producto</td>');
  });

  it('si la lista llega sin datos ni error muestra el mensaje de vacío', async () => {
    renderOrdenes({ data: null, error: null });
    expect(await screen.findByText('Todavía no hay órdenes registradas.')).toBeInTheDocument();
  });

  it('al abrir otra vez una boleta ya cargada la muestra de nuevo', async () => {
    const user = renderOrdenes();
    await screen.findByText('Ana Pérez');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ver boleta' }));
    await screen.findByText('Boleta de compra #41');
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ocultar' }));
    await user.click(within(fila('Ana Pérez')).getByRole('button', { name: 'Ver boleta' }));
    expect(await screen.findByText('Boleta de compra #41')).toBeInTheDocument();
    expect(screen.getByText('Mouse <pro>')).toBeInTheDocument();
  });

  it('si la consulta de items no trae datos trata la orden como sin productos', async () => {
    const user = renderOrdenes();
    mocks.items[42] = null;
    await screen.findByText('Luis Díaz');
    await user.click(within(fila('Luis Díaz')).getByRole('button', { name: 'Ver boleta' }));
    expect(await screen.findByText('No hay productos en esta orden.')).toBeInTheDocument();
  });
});
