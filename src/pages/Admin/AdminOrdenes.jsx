import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatoCLP } from '../../lib/validaciones';

export default function AdminOrdenes() {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [expandida, setExpandida] = useState(null);
  const [itemsPorOrden, setItemsPorOrden] = useState({});
  const [cargandoItems, setCargandoItems] = useState(null);

  useEffect(() => {
    async function cargarOrdenes() {
      const { data, error } = await supabase
        .from('ordenes')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('Error al cargar órdenes:', error.message);
      } else {
        setOrdenes(data || []);
      }

      setCargando(false);
    }

    cargarOrdenes();
  }, []);

  async function alternarDetalle(ordenId) {
    if (expandida === ordenId) {
      setExpandida(null);
      return;
    }

    setExpandida(ordenId);

    if (!itemsPorOrden[ordenId]) {
      setCargandoItems(ordenId);

      const { data, error } = await supabase
        .from('orden_items')
        .select('*')
        .eq('orden_id', ordenId);

      if (error) {
        console.error('Error al cargar los productos de la orden:', error.message);
      } else {
        setItemsPorOrden((prev) => ({
          ...prev,
          [ordenId]: data || [],
        }));
      }

      setCargandoItems(null);
    }
  }

  function imprimirBoleta(orden, items) {
    const ventana = window.open('', '_blank', 'width=850,height=700');

    if (!ventana) {
      alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.');
      return;
    }

    const filas = items.map((item) => `
      <tr>
        <td>${escaparHTML(item.nombre_producto || 'Producto')}</td>
        <td class="numero">${Number(item.cantidad) || 0}</td>
        <td class="numero">${formatoCLP(item.precio_unitario)}</td>
        <td class="numero">${formatoCLP((Number(item.precio_unitario) || 0) * (Number(item.cantidad) || 0))}</td>
      </tr>
    `).join('');

    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Boleta orden #${escaparHTML(orden.id)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #222;
            max-width: 800px;
            margin: 35px auto;
            padding: 20px;
          }
          .encabezado {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #800000;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          h1 { margin: 0 0 8px; font-size: 27px; }
          h2 { font-size: 17px; margin-top: 25px; }
          .muted { color: #666; font-size: 13px; line-height: 1.6; }
          .folio {
            border: 1px solid #800000;
            padding: 12px;
            text-align: center;
            min-width: 150px;
          }
          .folio strong { display: block; font-size: 20px; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 11px 8px; border-bottom: 1px solid #ddd; text-align: left; }
          th { background: #f3f3f3; }
          .numero { text-align: right; white-space: nowrap; }
          .total {
            text-align: right;
            font-size: 21px;
            font-weight: bold;
            margin-top: 22px;
            padding-top: 15px;
            border-top: 2px solid #800000;
          }
          .estado { margin-top: 18px; font-weight: bold; }
          .pie {
            margin-top: 45px;
            border-top: 1px solid #ddd;
            padding-top: 15px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="encabezado">
          <div>
            <h1>CLstore</h1>
            <div class="muted">Comprobante de compra</div>
            <div class="muted">Fecha: ${escaparHTML(new Date(orden.creado_en).toLocaleString('es-CL'))}</div>
          </div>
          <div class="folio">
            BOLETA / ORDEN
            <strong>#${escaparHTML(orden.id)}</strong>
          </div>
        </div>

        <h2>Datos del comprador</h2>
        <div>${escaparHTML(`${orden.nombre_comprador || ''} ${orden.apellidos_comprador || ''}`.trim() || 'No informado')}</div>
        <div class="muted">${escaparHTML(orden.correo_comprador || 'Sin correo registrado')}</div>
        <div class="muted">
          ${escaparHTML(orden.direccion || 'Dirección no informada')},
          ${escaparHTML(orden.comuna || '')},
          ${escaparHTML(orden.region || '')}
        </div>

        <h2>Detalle de productos</h2>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="numero">Cantidad</th>
              <th class="numero">Precio unitario</th>
              <th class="numero">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${filas || '<tr><td colspan="4">No hay productos registrados en esta orden.</td></tr>'}
          </tbody>
        </table>

        <div class="total">Total: ${formatoCLP(orden.total)}</div>
        <div class="estado">Estado de la orden: ${escaparHTML(orden.estado || 'Sin estado')}</div>

        <div class="pie">
          CLstore · Gracias por tu compra.<br>
          Este documento es un comprobante generado por el sistema.
        </div>

        <div class="no-print" style="text-align:center;margin-top:25px">
          <button onclick="window.print()" style="padding:10px 20px;cursor:pointer">
            Imprimir / Guardar como PDF
          </button>
        </div>
      </body>
      </html>
    `);

    ventana.document.close();
  }

  function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[caracter]);
  }

  return (
    <section className="p-4">
      <h4 className="fw-bold mb-4">
        <i className="fa-solid fa-receipt me-2"></i>
        Historial de Órdenes
      </h4>

      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Comprador</th>
                  <th>Comuna</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="text-end pe-4">Detalle</th>
                </tr>
              </thead>

              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Cargando órdenes...
                    </td>
                  </tr>
                )}

                {!cargando && ordenes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Todavía no hay órdenes registradas.
                    </td>
                  </tr>
                )}

                {ordenes.map((orden) => {
                  const items = itemsPorOrden[orden.id] || [];

                  return (
                    <Fragment key={orden.id}>
                      <tr>
                        <td className="text-muted">#{orden.id}</td>
                        <td>{new Date(orden.creado_en).toLocaleString('es-CL')}</td>
                        <td className="fw-semibold">
                          {orden.nombre_comprador} {orden.apellidos_comprador}
                        </td>
                        <td>{orden.comuna}</td>
                        <td>{formatoCLP(orden.total)}</td>
                        <td>
                          <span className={`badge ${orden.estado === 'exitosa' ? 'bg-success' : 'bg-danger'}`}>
                            {orden.estado === 'exitosa' ? 'Exitosa' : 'Fallida'}
                          </span>
                        </td>
                        <td className="text-end pe-4">
                          <button
                            className="btn btn-sm btn-outline-secondary rounded-pill"
                            onClick={() => alternarDetalle(orden.id)}
                          >
                            {expandida === orden.id ? 'Ocultar' : 'Ver boleta'}
                          </button>
                        </td>
                      </tr>

                      {expandida === orden.id && (
                        <tr>
                          <td colSpan={7} className="bg-light">
                            <div className="p-3">
                              {cargandoItems === orden.id ? (
                                <p className="text-muted mb-0">Cargando productos de la orden...</p>
                              ) : (
                                <>
                                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                                    <div>
                                      <h5 className="fw-bold mb-1">Boleta de compra #{orden.id}</h5>
                                      <p className="small text-muted mb-0">
                                        {orden.correo_comprador} · {orden.direccion}, {orden.comuna}, {orden.region}
                                      </p>
                                    </div>
                                    <button
                                      className="btn btn-sm btn-primary rounded-pill"
                                      onClick={() => imprimirBoleta(orden, items)}
                                      disabled={items.length === 0}
                                    >
                                      <i className="fa-solid fa-print me-2"></i>
                                      Imprimir / Guardar PDF
                                    </button>
                                  </div>

                                  <div className="table-responsive">
                                    <table className="table table-sm table-bordered bg-white mb-3">
                                      <thead className="table-secondary">
                                        <tr>
                                          <th>Producto</th>
                                          <th>Cantidad</th>
                                          <th>Precio unitario</th>
                                          <th>Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.length === 0 ? (
                                          <tr>
                                            <td colSpan={4} className="text-center text-muted">
                                              No hay productos en esta orden.
                                            </td>
                                          </tr>
                                        ) : (
                                          items.map((item) => (
                                            <tr key={item.id}>
                                              <td>{item.nombre_producto}</td>
                                              <td>{item.cantidad}</td>
                                              <td>{formatoCLP(item.precio_unitario)}</td>
                                              <td>
                                                {formatoCLP(
                                                  (Number(item.precio_unitario) || 0) *
                                                  (Number(item.cantidad) || 0)
                                                )}
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="text-end fs-5 fw-bold">
                                    Total: {formatoCLP(orden.total)}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}