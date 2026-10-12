import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const { perfil } = useAuth();
  const [destacados, setDestacados] = useState([]);

  useEffect(() => {
    supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(3)
      .then(({ data }) => setDestacados(data || []));
  }, []);

  return (
    <>
      <div className="container-fluid p-0">
      <div
        id="carouselHome"
        className="carousel slide"
        data-bs-ride="carousel"
        data-bs-interval="4000"
      >
        <div className="carousel-inner">
          <div className="carousel-item active">
            <Link to="/ofertas" className="d-block">
              <img
                src="/img/Carrusel1.png"
                className="d-block w-100 carousel-banner-img"
                alt="Ir a todos los productos"
              />
            </Link>
          </div>

          <div className="carousel-item">
            <Link
              to="/productos?categoria=Componentes"
              className="d-block"
            >
              <img
                src="/img/Carrusel2.png"
                className="d-block w-100 carousel-banner-img"
                alt="Ir a productos de la categoría Componentes"
              />
            </Link>
          </div>

          <div className="carousel-item">
            <Link to="/productos" className="d-block">
              <img
                src="/img/Carrusel3.png"
                className="d-block w-100 carousel-banner-img"
                alt="Ir a las ofertas"
              />
            </Link>
          </div>
        </div>

        <button
          className="carousel-control-prev"
          type="button"
          data-bs-target="#carouselHome"
          data-bs-slide="prev"
          aria-label="Banner anterior"
        >
          <span className="carousel-control-prev-icon" />
        </button>

        <button
          className="carousel-control-next"
          type="button"
          data-bs-target="#carouselHome"
          data-bs-slide="next"
          aria-label="Banner siguiente"
        >
          <span className="carousel-control-next-icon" />
        </button>

        <div className="carousel-indicators">
          <button
            type="button"
            data-bs-target="#carouselHome"
            data-bs-slide-to="0"
            className="active"
            aria-current="true"
            aria-label="Mostrar productos"
          />
          <button
            type="button"
            data-bs-target="#carouselHome"
            data-bs-slide-to="1"
            aria-label="Mostrar componentes"
          />
          <button
            type="button"
            data-bs-target="#carouselHome"
            data-bs-slide-to="2"
            aria-label="Mostrar ofertas"
          />
        </div>
      </div>
    </div>

      {perfil && (
        <h2 className="text-center fw-bold mt-4 mb-0">¡Bienvenido/a de nuevo, {perfil.nombre}!</h2>
      )}

      <div className="container my-5">
        <h2 className="fw-bold mb-4 text-center">Productos Destacados</h2>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
          {destacados.map((p) => (
            <ProductCard key={p.id} producto={p} mostrarBotonAgregar={false} />
          ))}
        </div>
        <div className="text-center mt-4 d-flex gap-3 justify-content-center flex-wrap">
          <Link to="/productos" className="btn btn-primary rounded-pill">
            Ver catálogo completo <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
          <Link to="/ofertas" className="btn btn-outline-danger rounded-pill">
            <i className="fa-solid fa-tags ms-1 me-1"></i> Ver Ofertas
          </Link>
        </div>
      </div>
    </>
  );
}
