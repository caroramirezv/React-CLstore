import { render, screen, fireEvent, within } from '@testing-library/react';
import AdminReportes from '../pages/Admin/AdminReportes';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>Gráfico de ventas<span>{children}</span></div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  // Llama al formatter como lo haría recharts al mostrar el tooltip de una barra.
  Tooltip: ({ formatter }) => <span>{formatter ? formatter(1500) : null}</span>,
  CartesianGrid: () => null,
}));

// La vista pide 5 tablas a la vez; solo "ordenes" usa .order().
const mocks = vi.hoisted(() => ({ tablas: {} }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (tabla) => {
      const resultado = Promise.resolve(mocks.tablas[tabla]);
      return { select: () => (tabla === 'ordenes' ? { order: () => resultado } : resultado) };
    },
  },
}));

function datosBase() {
  return {
    ordenes: { data: [
      { id: 'o1', total: 10000, estado: 'exitosa', creado_en: '2026-10-10T15:00:00', nombre_comprador: 'Ana', apellidos_comprador: 'Pérez', comuna: 'Arica' },
      { id: 'o2', total: 4000, estado: 'fallida', creado_en: '2026-10-11T10:00:00', nombre_comprador: 'Luis', apellidos_comprador: 'Díaz', comuna: 'Iquique' },
      { id: 'o3', total: 7000, estado: 'exitosa', creado_en: '2026-09-15T10:00:00', nombre_comprador: 'Eva', apellidos_comprador: 'Rojas', comuna: 'Pica' },
    ], error: null },
    productos: { data: [
      { id: 'p1', nombre: 'Mouse', categoria: 'perifericos', precio: 10000, stock: 2, stock_critico: 5 },
      { id: 'p2', nombre: 'RTX', categoria: 'componentes', precio: 500000, stock: 8, stock_critico: 2 },
    ], error: null },
    perfiles: { data: [{ id: 'u1', tipo: 'Cliente' }, { id: 'u2', tipo: 'Administrador' }], error: null },
    blogs: { data: [{ id: 'b1', titulo: 'Guía' }], error: null },
    orden_items: { data: [
      { orden_id: 'o1', nombre_producto: 'Mouse', cantidad: 2, precio_unitario: 5000 },
      { orden_id: 'o2', nombre_producto: 'RTX', cantidad: 1, precio_unitario: 4000 },
      { orden_id: 'o3', nombre_producto: 'Teclado', cantidad: 1, precio_unitario: 7000 },
    ], error: null },
  };
}

// Valor que aparece debajo del título de una tarjeta (ej. "Ventas exitosas" -> "$10.000").
const valorDe = (titulo) => screen.getByText(titulo).nextElementSibling;
const campo = (etiqueta) => screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input');
const tarjeta = (titulo) => within(screen.getByText(titulo).closest('.card-body'));

async function renderReportes(tablas = datosBase()) {
  mocks.tablas = tablas;
  render(<AdminReportes />);
  await screen.findByText('Ventas exitosas');
}

describe('AdminReportes', () => {
  beforeEach(() => {
    // Fija "hoy" (12-oct-2026) para que el período por defecto sea 01-oct a 12-oct.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0, 0));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('muestra "Calculando reportes..." mientras carga', async () => {
    mocks.tablas = datosBase();
    render(<AdminReportes />);
    expect(screen.getByText('Calculando reportes...')).toBeInTheDocument();
    await screen.findByText('Ventas exitosas');
    expect(screen.queryByText('Calculando reportes...')).not.toBeInTheDocument();
  });

  it('calcula ventas y órdenes solo del período (fuera de rango no cuenta)', async () => {
    await renderReportes();
    expect(valorDe('Ventas exitosas')).toHaveTextContent('$10.000'); // o3 es de septiembre
    expect(valorDe('Órdenes registradas')).toHaveTextContent('2');
    expect(screen.getByText('1 exitosas · 1 fallidas')).toBeInTheDocument();
  });

  it('la tabla de órdenes lista solo las del período', async () => {
    await renderReportes();
    expect(screen.getByText('#o1')).toBeInTheDocument();
    expect(screen.getByText('#o2')).toBeInTheDocument();
    expect(screen.queryByText('#o3')).not.toBeInTheDocument();
  });

  it('al ampliar la fecha "Desde" incluye las órdenes anteriores', async () => {
    await renderReportes();
    fireEvent.change(campo('Desde'), { target: { value: '2026-09-01' } });
    expect(screen.getByText('#o3')).toBeInTheDocument();
    expect(valorDe('Ventas exitosas')).toHaveTextContent('$17.000');
  });

  it('muestra inventario, usuarios y blogs actuales', async () => {
    await renderReportes();
    expect(valorDe('Productos en catálogo')).toHaveTextContent('2');
    expect(screen.getByText('10 unidades en inventario')).toBeInTheDocument(); // 2 + 8
    expect(valorDe('Usuarios registrados')).toHaveTextContent('2');
    expect(screen.getByText('1 blogs publicados')).toBeInTheDocument();
  });

  it('avisa los productos con stock crítico', async () => {
    await renderReportes();
    expect(screen.getByText('1 producto(s)')).toBeInTheDocument();
    expect(tarjeta('Alertas de inventario').getByText('Mouse')).toBeInTheDocument();
  });

  it('sin stock crítico muestra el mensaje en verde', async () => {
    const tablas = datosBase();
    tablas.productos = { data: [{ id: 'p2', nombre: 'RTX', categoria: 'componentes', precio: 1, stock: 8, stock_critico: 2 }], error: null };
    await renderReportes(tablas);
    expect(screen.getByText('No hay productos bajo su nivel de stock crítico.')).toBeInTheDocument();
  });

  it('cuenta los usuarios por tipo', async () => {
    await renderReportes();
    const usuarios = tarjeta('Usuarios por tipo');
    expect(usuarios.getByText('Cliente')).toBeInTheDocument();
    expect(usuarios.getByText('Administrador')).toBeInTheDocument();
  });

  it('el top de productos solo considera órdenes exitosas del período', async () => {
    await renderReportes();
    const top = tarjeta('Productos más vendidos');
    expect(top.getByText('Mouse')).toBeInTheDocument(); // o1
    expect(top.queryByText('RTX')).not.toBeInTheDocument(); // o2 fallida
    expect(top.queryByText('Teclado')).not.toBeInTheDocument(); // o3 fuera de rango
  });

  it('dibuja el gráfico cuando hay ventas', async () => {
    await renderReportes();
    expect(screen.getByText('Gráfico de ventas')).toBeInTheDocument();
  });

  it('sin órdenes muestra los mensajes de vacío', async () => {
    const tablas = datosBase();
    tablas.ordenes = { data: [], error: null };
    await renderReportes(tablas);
    expect(screen.getByText('No hay órdenes para las fechas seleccionadas.')).toBeInTheDocument();
    expect(screen.getByText('No hay ventas exitosas en el período seleccionado.')).toBeInTheDocument();
    expect(valorDe('Ventas exitosas')).toHaveTextContent('$0');
  });

  it('si una consulta falla muestra el aviso y sigue mostrando el resto', async () => {
    const tablas = datosBase();
    tablas.productos = { data: null, error: { message: 'falló' } };
    await renderReportes(tablas);
    expect(screen.getByText(/productos: falló/)).toBeInTheDocument();
    expect(valorDe('Productos en catálogo')).toHaveTextContent('0');
    expect(screen.getByText('#o1')).toBeInTheDocument();
  });

  it('el tooltip del gráfico muestra el monto en pesos', async () => {
    await renderReportes();
    expect(screen.getByText('$1.500')).toBeInTheDocument();
  });

  it('al acotar la fecha \"Hasta\" deja fuera las órdenes posteriores', async () => {
    await renderReportes();
    fireEvent.change(campo('Hasta'), { target: { value: '2026-10-10' } });
    expect(screen.getByText('#o1')).toBeInTheDocument();
    expect(screen.queryByText('#o2')).not.toBeInTheDocument(); // o2 es del 11-oct
    expect(valorDe('Órdenes registradas')).toHaveTextContent('1');
  });

  it('sin fechas en los filtros muestra todas las órdenes', async () => {
    await renderReportes();
    fireEvent.change(campo('Desde'), { target: { value: '' } });
    fireEvent.change(campo('Hasta'), { target: { value: '' } });
    expect(screen.getByText('#o3')).toBeInTheDocument();
    expect(valorDe('Ventas exitosas')).toHaveTextContent('$17.000');
  });

  it('tolera datos incompletos (sin tipo, sin nombre, sin montos, sin lista de blogs)', async () => {
    const tablas = datosBase();
    tablas.ordenes = { data: [
      { id: 'o4', total: null, estado: 'exitosa', creado_en: '2026-10-10T09:00:00', nombre_comprador: 'Zoe', apellidos_comprador: 'Mora', comuna: 'Arica' },
    ], error: null };
    tablas.productos = { data: [{ id: 'p9', nombre: 'Cable', categoria: 'perifericos', precio: 1, stock: null, stock_critico: null }], error: null };
    tablas.perfiles = { data: [{ id: 'u9', tipo: null }], error: null };
    tablas.blogs = { data: null, error: null };
    tablas.orden_items = { data: [{ orden_id: 'o4', nombre_producto: null, cantidad: null, precio_unitario: null }], error: null };
    await renderReportes(tablas);
    expect(tarjeta('Usuarios por tipo').getByText('Sin tipo')).toBeInTheDocument();
    expect(tarjeta('Productos más vendidos').getByText('Producto sin nombre')).toBeInTheDocument();
    expect(valorDe('Ventas exitosas')).toHaveTextContent('$0');
    expect(screen.getByText('0 blogs publicados')).toBeInTheDocument();
    expect(screen.getByText('0 unidades en inventario')).toBeInTheDocument();
  });

  it('si una consulta lanza una excepción muestra su mensaje', async () => {
    const tablas = datosBase();
    tablas.blogs = { then: (_resolver, rechazar) => rechazar(new Error('sin conexión')) };
    await renderReportes(tablas);
    expect(screen.getByText('sin conexión')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('Error al cargar reportes:', expect.any(Error));
  });

  it('si la excepción no trae mensaje usa uno genérico', async () => {
    const tablas = datosBase();
    tablas.blogs = { then: (_resolver, rechazar) => rechazar({}) };
    await renderReportes(tablas);
    expect(screen.getByText('Error inesperado al cargar reportes.')).toBeInTheDocument();
  });

  it('suma las unidades de un producto que aparece en varias líneas de la misma orden', async () => {
    const tablas = datosBase();
    tablas.orden_items.data.push({ orden_id: 'o1', nombre_producto: 'Mouse', cantidad: 1, precio_unitario: 5000 });
    await renderReportes(tablas);
    const top = tarjeta('Productos más vendidos');
    expect(top.getByText('3')).toBeInTheDocument(); // 2 + 1
    expect(top.getByText('$15.000')).toBeInTheDocument();
  });
});
