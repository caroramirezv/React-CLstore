import { render, screen } from '@testing-library/react';
import AdminDashboard from '../pages/Admin/AdminDashboard';
import { cadena } from '../../test/cadenaSupabase';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));
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

const estado = {
  ordenes: [{ total: 10000, estado: 'exitosa' }, { total: 5000, estado: 'exitosa' }],
  productos: [
    { stock: 2, stock_critico: 5, categoria: 'perifericos' },
    { stock: 8, stock_critico: 2, categoria: 'componentes' },
    { stock: 3, stock_critico: null, categoria: 'audio' },
  ],
  usuarios: 4,
};

function renderDashboard() {
  mocks.from.mockImplementation((tabla) => {
    if (tabla === 'ordenes') return cadena(() => ({ data: estado.ordenes }));
    if (tabla === 'productos') return cadena(() => ({ data: estado.productos }));
    return cadena(() => ({ count: estado.usuarios }));
  });
  render(<AdminDashboard />);
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    estado.ordenes = [{ total: 10000, estado: 'exitosa' }, { total: 5000, estado: 'exitosa' }];
    estado.productos = [
      { stock: 2, stock_critico: 5, categoria: 'perifericos' },
      { stock: 8, stock_critico: 2, categoria: 'componentes' },
      { stock: 3, stock_critico: null, categoria: 'audio' },
    ];
    estado.usuarios = 4;
  });

  it('muestra "Cargando dashboard..." mientras espera', async () => {
    const pendientes = [];
    mocks.from.mockImplementation(() => {
      let resolve;
      const promise = new Promise((resolver) => { resolve = resolver; });
      pendientes.push(resolve);
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        then: (res, rej) => promise.then(res, rej),
      };
      return builder;
    });
    render(<AdminDashboard />);
    expect(screen.getByText('Cargando dashboard...')).toBeInTheDocument();
    pendientes.forEach((resolve) => resolve({ data: [], count: 0 }));
    expect(await screen.findByRole('heading', { name: /Dashboard/ })).toBeInTheDocument();
  });

  it('suma ventas, inventario y usuarios', async () => {
    renderDashboard();
    expect(await screen.findByText('$15.000')).toBeInTheDocument();
    expect(screen.getByText('2 órdenes pagadas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('13 unidades en inventario')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('cuentas registradas')).toBeInTheDocument();
  });

  it('avisa cuando hay stock crítico y agrupa el gráfico por categoría', async () => {
    renderDashboard();
    expect(await screen.findByText(/1 producto\(s\) con stock en nivel crítico/)).toBeInTheDocument();
    expect(screen.getByText('Periféricos: 2')).toBeInTheDocument();
    expect(screen.getByText('Componentes: 8')).toBeInTheDocument();
    expect(screen.getByText('audio: 3')).toBeInTheDocument();
  });

  it('sin stock crítico no muestra la alerta', async () => {
    estado.productos = [{ stock: 9, stock_critico: 2, categoria: 'consolas' }];
    estado.ordenes = [];
    estado.usuarios = 0;
    renderDashboard();
    expect(await screen.findByText('$0')).toBeInTheDocument();
    expect(screen.queryByText(/nivel crítico/)).not.toBeInTheDocument();
    expect(screen.getByText('Consolas: 9')).toBeInTheDocument();
  });
});
