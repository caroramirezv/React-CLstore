import { Link } from 'react-router-dom';
import { formatoCLP, calcularPrecioFinal } from '../lib/validaciones';
import { useCart } from '../context/CartContext';

export default function ProductCard({ producto, mostrarBotonAgregar = true }) {
  const { agregarProducto } = useCart();
  const { precioOriginal, precioFinal, enOferta, descuento } = calcularPrecioFinal(producto);

  return (
    <div className="col">
      <div className="card h-100 card-product shadow-sm position-relative">
        {enOferta && (
          <span className="badge bg-danger position-absolute top-0 start-0 m-2 fs-6">-{descuento}%</span>
        )}
        <img src={producto.imagen} className="card-img-top" alt={producto.nombre} />
        <div className="card-body d-flex flex-column justify-content-between">
          <div>
            <h5 className="card-title fw-bold">{producto.nombre}</h5>
            {enOferta ? (
              <p className="card-text mb-0">
                <span className="text-muted text-decoration-line-through me-2">{formatoCLP(precioOriginal)}</span>
                <span className="fs-4 fw-bold text-danger">{formatoCLP(precioFinal)}</span>
              </p>
            ) : (
              <p className="card-text fs-4 fw-bold text-primary">{formatoCLP(precioFinal)}</p>
            )}
          </div>
          <div className="d-grid gap-2 mt-3">
            <Link to={`/productos/${producto.id}`} className="btn btn-outline-secondary rounded-pill">
              Más Información
            </Link>
            {mostrarBotonAgregar && (
              <button className="btn btn-primary rounded-pill w-100" onClick={() => agregarProducto(producto)}>
                <i className="fa-solid fa-cart-plus me-1"></i> Agregar al Carrito
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
