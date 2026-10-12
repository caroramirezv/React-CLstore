import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { formatoCLP } from '../../lib/validaciones';

const inicioMes = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
};
const fechaHoy = () => new Date().toISOString().slice(0, 10);

export default function AdminReportes() {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [fechaDesde, setFechaDesde] = useState(inicioMes);
  const [fechaHasta, setFechaHasta] = useState(fechaHoy);
  const [datos, setDatos] = useState({ ordenes: [], productos: [], perfiles: [], blogs: [], items: [] });


async function cargarReportes() {
  setCargando(true);
  setErrorCarga('');
  try {
    const consultas = [
      ['órdenes', supabase
        .from('ordenes')
        
.select('id, total, estado, creado_en, nombre_comprador, apellidos_comprador, comuna')

        .order('creado_en', { ascending: false })],

      ['productos', supabase
        .from('productos')
        .select('id, nombre, categoria, precio, stock, stock_critico')],

      ['perfiles', supabase
        .from('perfiles')
        .select('id, tipo, created_at')],

      ['blogs', supabase
        .from('blogs')
        .select('id, titulo, created_at')],

      ['artículos de órdenes', supabase
        .from('orden_items')
        .select('orden_id, nombre_producto, cantidad, precio_unitario')],
    ];
    const resultados = await Promise.all(
      consultas.map(async ([nombre, consulta]) => ({
        nombre,
        ...(await consulta),
      }))
    );
    const nuevosDatos = {
      ordenes: [],
      productos: [],
      perfiles: [],
      blogs: [],
      items: [],
    };
    const equivalencias = {
      'órdenes': 'ordenes',
      productos: 'productos',
      perfiles: 'perfiles',
      blogs: 'blogs',
      'artículos de órdenes': 'items',
    };

    const errores = [];
    resultados.forEach((resultado) => {
      if (resultado.error) {
        errores.push(
          `${resultado.nombre}: ${resultado.error.message}`
        );
        console.error(
        `Error consultando ${resultado.nombre}:`,
        JSON.stringify(resultado.error, null, 2)
      );
      } else {
        nuevosDatos[equivalencias[resultado.nombre]] =
          resultado.data || [];
      }
    });
    setDatos(nuevosDatos);
    if (errores.length) {
      setErrorCarga(errores.join(' · '));
    }
    console.log(
      'Órdenes recuperadas desde Supabase:',
      nuevosDatos.ordenes.length
    );
  } catch (error) {
    console.error('Error al cargar reportes:', error);
    setErrorCarga(error.message || 'Error inesperado al cargar reportes.');
  } finally {
    setCargando(false);
  }
}


  useEffect(() => { cargarReportes(); }, []);

  const resumen = useMemo(() => {
    const desde = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
    const hasta = fechaHasta ? new Date(`${fechaHasta}T23:59:59.999`) : null;
    const ordenesPeriodo = datos.ordenes.filter((o) => {
      const fecha = new Date(o.creado_en);
      return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
    });
    const exitosas = ordenesPeriodo.filter(
      (orden) => orden.estado === 'exitosa'
    );

    const fallidas = ordenesPeriodo.filter(
      (orden) => orden.estado === 'fallida'
    );
    const ventas = exitosas.reduce((s, o) => s + Number(o.total || 0), 0);
    const unidades = datos.productos.reduce((s, p) => s + Number(p.stock || 0), 0);
    const stockBajo = datos.productos.filter((p) => p.stock_critico != null && Number(p.stock) <= Number(p.stock_critico));
    const tipoUsuarios = datos.perfiles.reduce((acc, p) => { const tipo = p.tipo || 'Sin tipo'; acc[tipo] = (acc[tipo] || 0) + 1; return acc; }, {});
    const ventasPorDiaMap = {};
    exitosas.forEach((o) => {
      const dia = new Date(o.creado_en).toLocaleDateString('sv-SE');
      ventasPorDiaMap[dia] = (ventasPorDiaMap[dia] || 0) + Number(o.total || 0);
    });
    const ventasPorDia = Object.entries(ventasPorDiaMap).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([fecha, total]) => ({ fecha: fecha.slice(5), total }));
    const idsExitosos = new Set(exitosas.map((o) => o.id));
    const productosVendidos = {};
    datos.items.filter((it) => idsExitosos.has(it.orden_id)).forEach((it) => {
      const nombre = it.nombre_producto || 'Producto sin nombre';
      if (!productosVendidos[nombre]) productosVendidos[nombre] = { nombre, unidades: 0, ingresos: 0 };
      productosVendidos[nombre].unidades += Number(it.cantidad || 0);
      productosVendidos[nombre].ingresos += Number(it.cantidad || 0) * Number(it.precio_unitario || 0);
    });
    const topProductos = Object.values(productosVendidos).sort((a, b) => b.unidades - a.unidades).slice(0, 5);
    return { ordenesPeriodo, exitosas, fallidas, ventas, unidades, stockBajo, tipoUsuarios, ventasPorDia, topProductos };
  }, [datos, fechaDesde, fechaHasta]);

  return (
    <section className="p-4">
      <div className="card border-0 shadow-sm rounded-3 mb-4"><div className="card-body"><div className="row g-3 align-items-end">
        <div className="col-sm-5 col-md-4"><label className="form-label fw-semibold">Desde</label><input type="date" className="form-control" value={fechaDesde} max={fechaHasta || undefined} onChange={(e) => setFechaDesde(e.target.value)} /></div>
        <div className="col-sm-5 col-md-4"><label className="form-label fw-semibold">Hasta</label><input type="date" className="form-control" value={fechaHasta} min={fechaDesde || undefined} onChange={(e) => setFechaHasta(e.target.value)} /></div>
        <div className="col-sm-2 col-md-4"><span className="small text-muted">Las tarjetas de ventas y órdenes se calculan según este período. Inventario, usuarios y blogs muestran el estado actual.</span></div>
      </div></div></div>

      {errorCarga && <div className="alert alert-warning"><i className="fa-solid fa-triangle-exclamation me-2"></i>{errorCarga}</div>}
      {cargando ? <div className="text-center text-muted p-5">Calculando reportes...</div> : <>
        <div className="row g-3 mb-4">
          <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="text-muted small mb-2"><i className="fa-solid fa-sack-dollar me-2"></i>Ventas exitosas</div><div className="fs-4 fw-bold">{formatoCLP(resumen.ventas)}</div><small className="text-muted">Total del período</small></div></div></div>
          <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="text-muted small mb-2"><i className="fa-solid fa-receipt me-2"></i>Órdenes registradas</div><div className="fs-4 fw-bold">{resumen.ordenesPeriodo.length}</div><small className="text-muted">{resumen.exitosas.length} exitosas · {resumen.fallidas.length} fallidas</small></div></div></div>
          <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="text-muted small mb-2"><i className="fa-solid fa-boxes-stacked me-2"></i>Productos en catálogo</div><div className="fs-4 fw-bold">{datos.productos.length}</div><small className="text-muted">{resumen.unidades} unidades en inventario</small></div></div></div>
          <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="text-muted small mb-2"><i className="fa-solid fa-users me-2"></i>Usuarios registrados</div><div className="fs-4 fw-bold">{datos.perfiles.length}</div><small className="text-muted">{datos.blogs.length} blogs publicados</small></div></div></div>
        </div>

        {resumen.stockBajo.length > 0 && <div className="alert alert-warning"><i className="fa-solid fa-triangle-exclamation me-2"></i><strong>{resumen.stockBajo.length} producto(s)</strong> tienen stock crítico.</div>}

        <div className="row g-4 mb-4">
          <div className="col-lg-7"><div className="card border-0 shadow-sm rounded-3 h-100"><div className="card-body"><h6 className="fw-bold mb-3">Ventas por día</h6>{resumen.ventasPorDia.length === 0 ? <p className="text-muted small mb-0">No hay ventas exitosas en el período seleccionado.</p> : <ResponsiveContainer width="100%" height={280}><BarChart data={resumen.ventasPorDia}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fecha" /><YAxis /><Tooltip formatter={(v) => formatoCLP(v)} /><Bar dataKey="total" name="Ventas" fill="#0d6efd" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>}</div></div></div>
          <div className="col-lg-5"><div className="card border-0 shadow-sm rounded-3 h-100"><div className="card-body"><h6 className="fw-bold mb-3">Usuarios por tipo</h6>{Object.entries(resumen.tipoUsuarios).length === 0 ? <p className="text-muted small">No hay usuarios registrados.</p> : Object.entries(resumen.tipoUsuarios).map(([tipo, cantidad]) => <div key={tipo} className="mb-3"><div className="d-flex justify-content-between mb-1"><span>{tipo}</span><strong>{cantidad}</strong></div><div className="progress" style={{ height: 8 }}><div className="progress-bar" role="progressbar" style={{ width: `${Math.min(100, cantidad / Math.max(1, datos.perfiles.length) * 100)}%` }} aria-valuenow={cantidad} aria-valuemin="0" aria-valuemax={datos.perfiles.length}></div></div></div>)}</div></div></div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-6"><div className="card border-0 shadow-sm rounded-3 h-100"><div className="card-body"><h6 className="fw-bold mb-3">Productos más vendidos</h6>{resumen.topProductos.length === 0 ? <p className="text-muted small mb-0">No hay artículos asociados a órdenes exitosas del período.</p> : <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Producto</th><th className="text-end">Unidades</th><th className="text-end">Ingresos</th></tr></thead><tbody>{resumen.topProductos.map((p) => <tr key={p.nombre}><td>{p.nombre}</td><td className="text-end">{p.unidades}</td><td className="text-end text-nowrap">{formatoCLP(p.ingresos)}</td></tr>)}</tbody></table></div>}</div></div></div>
          <div className="col-lg-6"><div className="card border-0 shadow-sm rounded-3 h-100"><div className="card-body"><h6 className="fw-bold mb-3">Alertas de inventario</h6>{resumen.stockBajo.length === 0 ? <div className="text-success"><i className="fa-solid fa-circle-check me-2"></i>No hay productos bajo su nivel de stock crítico.</div> : <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Producto</th><th className="text-end">Stock</th><th className="text-end">Crítico</th></tr></thead><tbody>{resumen.stockBajo.map((p) => <tr key={p.id}><td>{p.nombre}</td><td className="text-end"><span className="badge bg-danger">{p.stock}</span></td><td className="text-end">{p.stock_critico}</td></tr>)}</tbody></table></div>}</div></div></div>
        </div>

        <div className="card border-0 shadow-sm rounded-3"><div className="card-header bg-white py-3"><h6 className="fw-bold mb-0">Órdenes del período</h6></div><div className="card-body p-0"><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead className="table-dark"><tr><th>ID</th><th>Fecha</th><th>Comprador</th><th>Comuna</th><th>Estado</th><th className="text-end pe-4">Total</th></tr></thead><tbody>
          {resumen.ordenesPeriodo.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">No hay órdenes para las fechas seleccionadas.</td></tr>}
          {resumen.ordenesPeriodo.map((o) => <tr key={o.id}><td>#{o.id}</td><td className="text-nowrap">{new Date(o.creado_en).toLocaleString('es-CL')}</td><td>{o.nombre_comprador} {o.apellidos_comprador}</td><td>{o.comuna}</td><td><span className={`badge ${o.estado === 'exitosa' ? 'bg-success' : 'bg-danger'}`}>{o.estado === 'exitosa' ? 'Exitosa' : 'Fallida'}</span></td><td className="text-end pe-4 text-nowrap">{formatoCLP(o.total)}</td></tr>)}
        </tbody></table></div></div></div>
      </>}
    </section>
  );
}
