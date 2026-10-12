import { render, screen, fireEvent } from '@testing-library/react';
import AdminReportes from '../pages/Admin/AdminReportes';
import { cadena } from '../../test/cadenaSupabase';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => <div>Gráfico de ventas</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

const estado = {
  ordenes: [],
  productos: [],
  perfiles: [],
  blogs: [],
  orden_items: [],
  errorDe: {},
};

function datosBase() {
  estado.ordenes = [
    {
      id: 'o1',
      total: 10000,
      estado: 'exitosa',
      creado_en: '2026-10-12T15:00:00.000Z',
      nombre_comprador: 'Ana',
      apellidos_comprador: 'Pérez',
      comuna: 'Arica',
    },
    {
      id: 'o2',
      total: 4000,
      estado: 'fallida',
      creado_en: '2026-10-12T16:00:00.000Z',
      nombre_comprador: 'Luis',
      apellidos_comprador: 'Díaz',
      comuna: 'Iquique',
    },
  ];
  estado.productos = [
    { id: 'p1', nombre: 'Mouse', categoria: 'perifericos', precio: 10000, stock: 2, stock_critico: 5 },
    { id: 'p2', nombre: 'RTX', categoria: 'componentes', precio: 500000, stock: 8, stock_critico: 2 },
  ];
  estado.perfiles = [
    { id: 'u1', tipo: 'Cliente' },
    { id: 'u2', tipo: 'Administrador' },
  ];
  estado.blogs = [{ id: 'b1', titulo: 'Guía' }];
  estado.orden_items = [
    { orden_id: 'o1', nombre_producto: 'Mouse', cantidad: 2, precio_unitario: 5000 },
    { orden_id: 'o2', nombre_producto: 'RTX', cantidad: 1, precio_unitario: 4000 },
  ];
  estado.errorDe = {};
}

function mockDesdeEstado() {
  mocks.from.mockImplementation((tabla) => cadena(() => ({
    data: estado[tabla],
    error: estado.errorDe[tabla] || null,
  })));
}

function campo(etiqueta) {
  return screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input');
}

function acotarOctubre() {
  fireEvent.change(campo('Desde'), { target: { value: '2026-10-01' } });
  fireEvent.change(campo('Hasta'), { target: { value: '2026-10-31' } });
}

describe('AdminReportes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    datosBase();
    mockDesdeEstado();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra "Calculando reportes..." mientras espera', async () => {
    const pendientes = [];
    mocks.from.mockImplementation(() => {
      let resolve;
      const promise = new Promise((resolver) => { resolve = resolver; });
      pendientes.push(resolve);
      const builder = {
        select() { return builder; },
        order() { return builder; },
        then: (res, rej) => promise.then(res, rej),
      };
      return builder;
    });
    render(<AdminReportes />);
    expect(screen.getByText('Calculando reportes...')).toBeInTheDocument();
    pendientes.forEach((resolve) => resolve({ data: [], error: null }));
    expect(await screen.findByText('Ventas exitosas')).toBeInTheDocument();
    expect(screen.queryByText('Calculando reportes...')).not.toBeInTheDocument();
  });

  it('resume ventas, órdenes, inventario y usuarios del período', async () => {
    render(<AdminReportes />);
    acotarOctubre();
    expect(await screen.findAllByText('$10.000')).toHaveLength(3);
    expect(screen.getByText('1 exitosas · 1 fallidas')).toBeInTheDocument();
    expect(screen.getByText('10 unidades en inventario')).toBeInTheDocument();
    expect(screen.getByText('1 blogs publicados')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Luis Díaz')).toBeInTheDocument();
    expect(screen.getByText('Exitosa')).toBeInTheDocument();
    expect(screen.getByText('Fallida')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getAllByText('Mouse').length).toBeGreaterThan(0);
    expect(screen.queryByText('RTX')).not.toBeInTheDocument();
    expect(screen.getByText(/1 producto\(s\)/)).toBeInTheDocument();
    expect(screen.getByText('Gráfico de ventas')).toBeInTheDocument();
  });

  it('un período sin órdenes deja las ventas en cero y conserva el inventario', async () => {
    render(<AdminReportes />);
    await screen.findByText('Ventas exitosas');
    fireEvent.change(campo('Desde'), { target: { value: '2020-01-01' } });
    fireEvent.change(campo('Hasta'), { target: { value: '2020-01-31' } });
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('No hay órdenes para las fechas seleccionadas.')).toBeInTheDocument();
    expect(screen.getByText('No hay ventas exitosas en el período seleccionado.')).toBeInTheDocument();
    expect(screen.getByText('No hay artículos asociados a órdenes exitosas del período.')).toBeInTheDocument();
    expect(screen.getByText('Mouse')).toBeInTheDocument();
    expect(screen.getByText('10 unidades en inventario')).toBeInTheDocument();
  });

  it('sin stock crítico muestra el inventario en orden', async () => {
    estado.productos = [{ id: 'p2', nombre: 'RTX', categoria: 'componentes', precio: 500000, stock: 8, stock_critico: 2 }];
    estado.ordenes = [];
    estado.orden_items = [];
    estado.perfiles = [];
    estado.blogs = [];
    render(<AdminReportes />);
    acotarOctubre();
    expect(await screen.findByText('No hay productos bajo su nivel de stock crítico.')).toBeInTheDocument();
    expect(screen.getByText('No hay usuarios registrados.')).toBeInTheDocument();
  });

  it('muestra el error de la consulta que falló', async () => {
    estado.errorDe = { productos: { message: 'sin permiso' } };
    render(<AdminReportes />);
    expect(await screen.findByText(/productos: sin permiso/)).toBeInTheDocument();
  });
});
