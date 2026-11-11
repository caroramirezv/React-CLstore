import { useEffect, useState } from 'react';
import { listarProductos } from '../api/productosApi';
import ProductCard from '../components/ProductCard';

export default function Ofertas() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    listarProductos({ oferta: true, orden: 'descuento_desc' })
      .then((data) => setProductos(data || []))
      .catch(() => setProductos([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="container my-5">
      <div className="text-center mb-5">
        <h1 className="fw-bold">
          <i className="fa-solid fa-tags text-danger me-2"></i>Ofertas
        </h1>
      </div>

      <div className="row row-cols-1 row-cols-md-3 g-4">
        {cargando && <p className="text-center text-muted col-12 my-4">Cargando ofertas...</p>}
        {!cargando && productos.length === 0 && (
          <div className="col-12 text-center text-muted my-5">
            <i className="fa-solid fa-tag fa-2x mb-3 d-block"></i>
            No hay ofertas activas en este momento. Vuelve a revisar pronto.
          </div>
        )}
        {productos.map((p) => (
          <ProductCard key={p.id} producto={p} />
        ))}
      </div>
    </div>
  );
}
