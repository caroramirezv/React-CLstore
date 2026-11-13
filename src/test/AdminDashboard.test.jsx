import { render, screen } from '@testing-library/react';
import AdminDashboard from '../pages/Admin/AdminDashboard';

// Los gráficos de recharts no se dibujan en jsdom: se reemplazan por una lista simple.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ data }) => (
    <ul>
      {data.map((fila) => (
        <li key={fila.categoria}>{fila.categoria}: {fila.stock}</li>
      ))}
    </ul>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

// Todo viene de microservicios: productos (ms-productos), órdenes exitosas (ms-ordenes) y usuarios (ms-usuarios).
// "usuarios" es un número: el mock devuelve esa cantidad de usuarios.
const mocks = vi.hoisted(() => ({ ordenes: [], productos: [], usuarios: 0, filtrosOrdenes: null }));
vi.mock('../api/productosApi', () => ({ listarProductos: () => Promise.resolve(mocks.productos) }));
vi.mock('../api/ordenesApi', () => ({
  listarOrdenes: (filtros) => {
    mocks.filtrosOrdenes = filtros;
    return Promise.resolve(mocks.ordenes);
  },
}));
vi.mock('../api/usuariosApi', () => ({
  listarUsuarios: () => Promise.resolve(Array.from({ length: mocks.usuarios }, (_, i) => ({ id: `u${i}` }))),
}));

function renderDashboard({ ordenes, productos, usuarios = 4 } = {}) {
  mocks.ordenes = ordenes ?? [{ total: 10000, estado: 'exitosa' }, { total: 5000, estado: 'exitosa' }];
  mocks.productos = productos ?? [
    { stock: 2, stock_critico: 5, categoria: 'perifericos' },
    { stock: 8, stock_critico: 2, categoria: 'componentes' },
    { stock: 3, stock_critico: null, categoria: 'audio' },
  ];
  mocks.usuarios = usuarios;
  render(<AdminDashboard />);
}

describe('AdminDashboard', () => {
  it('muestra "Cargando dashboard..." y luego las tarjetas', async () => {
    renderDashboard();
    expect(screen.getByText('Cargando dashboard...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando dashboard...')).not.toBeInTheDocument();
  });

  it('suma las ventas de las órdenes exitosas', async () => {
    renderDashboard();
    expect(await screen.findByText('$15.000')).toBeInTheDocument();
    expect(screen.getByText('2 órdenes pagadas')).toBeInTheDocument();
  });

  it('cuenta productos y unidades en inventario', async () => {
    renderDashboard();
    expect(await screen.findByText('13 unidades en inventario')).toBeInTheDocument(); // 2 + 8 + 3
    expect(screen.getByText('Productos').parentElement.nextElementSibling).toHaveTextContent('3');
  });

  it('muestra la cantidad de usuarios registrados', async () => {
    renderDashboard({ usuarios: 4 });
    const texto = await screen.findByText('cuentas registradas');
    expect(texto.previousElementSibling).toHaveTextContent('4');
  });

  it('avisa cuántos productos están en stock crítico', async () => {
    renderDashboard();
    // solo el de stock 2 con crítico 5; el que no tiene stock_critico no cuenta
    expect(await screen.findByText(/1 producto\(s\) con stock en nivel crítico/)).toBeInTheDocument();
  });

  it('sin productos en stock crítico no muestra la alerta', async () => {
    renderDashboard({ productos: [{ stock: 10, stock_critico: 2, categoria: 'componentes' }] });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.queryByText(/stock en nivel crítico/)).not.toBeInTheDocument();
  });

  it('agrupa el stock por categoría con su nombre legible', async () => {
    renderDashboard();
    expect(await screen.findByText('Periféricos: 2')).toBeInTheDocument();
    expect(screen.getByText('Componentes: 8')).toBeInTheDocument();
    expect(screen.getByText('audio: 3')).toBeInTheDocument(); // categoría desconocida queda tal cual
  });

  it('sin datos muestra todo en cero', async () => {
    renderDashboard({ ordenes: [], productos: [], usuarios: 0 });
    expect(await screen.findByText('$0')).toBeInTheDocument();
    expect(screen.getByText('0 órdenes pagadas')).toBeInTheDocument();
    expect(screen.getByText('0 unidades en inventario')).toBeInTheDocument();
  });

  it('si ms-productos falla muestra el dashboard con los productos en cero', async () => {
    // reemplaza la lectura de productos por un rechazo solo para este render
    const original = mocks.productos;
    mocks.productos = { then: (_resolver, rechazar) => rechazar(new Error('sin conexión')) };
    mocks.ordenes = [{ total: 10000, estado: 'exitosa' }];
    mocks.usuarios = 2;
    render(<AdminDashboard />);
    expect(await screen.findByText('$10.000')).toBeInTheDocument();
    expect(screen.getByText('0 unidades en inventario')).toBeInTheDocument();
    mocks.productos = original;
  });

  it('pide a ms-ordenes solo las órdenes exitosas', async () => {
    renderDashboard();
    await screen.findByText('$15.000');
    expect(mocks.filtrosOrdenes).toEqual({ estado: 'exitosa' });
  });

  it('tolera respuestas vacías y montos o stock nulos', async () => {
    mocks.ordenes = undefined; // la consulta no devolvió datos
    mocks.productos = undefined;
    mocks.usuarios = 0;
    const { unmount } = render(<AdminDashboard />);
    expect(await screen.findByText('$0')).toBeInTheDocument();
    expect(screen.getByText('0 unidades en inventario')).toBeInTheDocument();
    unmount();

    renderDashboard({
      ordenes: [{ total: null, estado: 'exitosa' }],
      productos: [{ stock: null, stock_critico: null, categoria: 'audio' }],
    });
    expect(await screen.findByText('1 órdenes pagadas')).toBeInTheDocument();
    expect(screen.getByText('audio: 0')).toBeInTheDocument();
  });
});
