
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatoCLP } from '../../lib/validaciones';

const CATEGORIAS_INICIALES = [
  { valor: 'componentes', etiqueta: 'Componentes', icono: 'fa-microchip' },
  { valor: 'consolas', etiqueta: 'Consolas & Laptops', icono: 'fa-gamepad' },
  { valor: 'perifericos', etiqueta: 'Periféricos & Monitores', icono: 'fa-keyboard' },
];

const ICONO_DEFAULT = 'fa-folder';

function etiquetaCategoria(valor) {
  const conocida = CATEGORIAS_INICIALES.find(
    (cat) => cat.valor === valor
  );

  if (conocida) return conocida.etiqueta;

  return valor
    .split(/[-_]/g)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}

function generarValor(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function AdminCategorias() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargarProductos() {
    setCargando(true);
    setError('');

    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre');

    if (error) {
      setError(`Error al cargar productos: ${error.message}`);
    } else {
      setProductos(data || []);
    }

    setCargando(false);
  }

  useEffect(() => {
    cargarProductos();
  }, []);

  const categorias = [
    ...new Set(productos.map((p) => p.categoria).filter(Boolean)),
  ].map((valor) => {
    const conocida = CATEGORIAS_INICIALES.find(
      (cat) => cat.valor === valor
    );

    return {
      valor,
      etiqueta: conocida?.etiqueta || etiquetaCategoria(valor),
      icono: conocida?.icono || ICONO_DEFAULT,
    };
  });

  function cancelarEdicion() {
    setEditando(null);
    setNombre('');
    setError('');
    setMensaje('');
  }

  async function guardarCategoria(e) {
    e.preventDefault();

    const etiqueta = nombre.trim();
    const valorNuevo = generarValor(etiqueta);

    if (!etiqueta || !valorNuevo) {
      setError('Ingresa un nombre válido para la categoría.');
      return;
    }

    setError('');
    setMensaje('');

    if (editando) {
      const { error: errorActualizar } = await supabase
        .from('productos')
        .update({ categoria: valorNuevo })
        .eq('categoria', editando.valor);

      if (errorActualizar) {
        setError(
          `No se pudo actualizar la categoría. Comprueba la restricción CHECK de productos.categoria: ${errorActualizar.message}`
        );
        return;
      }

      setMensaje('Categoría actualizada correctamente.');
    } else {
      if (categorias.some((cat) => cat.valor === valorNuevo)) {
        setError('Esa categoría ya existe.');
        return;
      }

      setError(
        'Tu tabla productos no tiene una tabla independiente de categorías. Para crear una categoría nueva, primero debes permitir su valor en la restricción CHECK y después asignarla a uno o más productos.'
      );
      return;
    }

    cancelarEdicion();
    await cargarProductos();
  }

  async function eliminarCategoria(categoria) {
    const asociados = productos.filter(
      (p) => p.categoria === categoria.valor
    );

    if (asociados.length > 0) {
      setError(
        `No se puede eliminar "${categoria.etiqueta}" porque tiene ${asociados.length} producto(s). Cambia primero su categoría desde la administración de productos.`
      );
      return;
    }

    setError(
      'Las categorías se obtienen de los productos. Cuando no queden productos asociados, desaparecerán automáticamente de esta página.'
    );
  }

  if (cargando) {
    return (
      <div className="p-4 text-center text-muted">
        Cargando categorías...
      </div>
    );
  }

  return (
    <section className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">
          <i className="fa-solid fa-layer-group me-2"></i>
          Categorías
        </h4>

        <button
          className="btn btn-outline-primary"
          type="button"
          onClick={cargarProductos}
        >
          <i className="fa-solid fa-rotate me-2"></i>
          Actualizar
        </button>
      </div>

      {error && <div className="alert alert-warning">{error}</div>}
      {mensaje && <div className="alert alert-success">{mensaje}</div>}

      <div className="card border-0 shadow-sm rounded-3 mb-4">
        <div className="card-header bg-white py-3">
          <h5 className="fw-bold mb-0">
            {editando ? 'Editar categoría' : 'Selecciona una categoría para editar'}
          </h5>
        </div>

        <div className="card-body">
          {editando ? (
            <form onSubmit={guardarCategoria}>
              <label htmlFor="nombreCategoria" className="form-label">
                Nombre de la categoría
              </label>

              <input
                id="nombreCategoria"
                className="form-control mb-3"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={100}
              />

              <button
                className="btn btn-primary me-2"
                type="submit"
                disabled={guardando}
              >
                Guardar cambios
              </button>

              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={cancelarEdicion}
              >
                Cancelar
              </button>
            </form>
          ) : (
            <p></p>
          )}
        </div>
      </div>

      {categorias.length === 0 ? (
        <div className="alert alert-info">
          No se encontraron categorías en los productos.
        </div>
      ) : (
        categorias.map((cat) => {
          const lista = productos.filter(
            (p) => p.categoria === cat.valor
          );

          return (
            <div
              key={cat.valor}
              className="card border-0 shadow-sm rounded-3 mb-4"
            >
              <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2 py-3">
                <span className="fw-bold">
                  <i
                    className={`fa-solid ${cat.icono} me-2 text-primary`}
                  ></i>
                  {cat.etiqueta}
                  <span className="badge bg-secondary ms-2">
                    {lista.length} producto(s)
                  </span>
                </span>

                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    type="button"
                    onClick={() => {
                      setEditando(cat);
                      setNombre(cat.etiqueta);
                      setError('');
                      setMensaje('');
                    }}
                  >
                    <i className="fa-solid fa-pen me-1"></i>
                    Editar
                  </button>

                  <button
                    className="btn btn-sm btn-outline-danger"
                    type="button"
                    onClick={() => eliminarCategoria(cat)}
                  >
                    <i className="fa-solid fa-trash me-1"></i>
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="card-body p-0">
                {lista.length === 0 ? (
                  <p className="text-muted text-center py-3 mb-0">
                    Sin productos en esta categoría.
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Imagen</th>
                          <th>Nombre</th>
                          <th>Precio</th>
                          <th>Stock</th>
                        </tr>
                      </thead>

                      <tbody>
                        {lista.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <img
                                src={p.imagen || '/img/Logo.png'}
                                alt={p.nombre}
                                className="rounded"
                                style={{
                                  width: 40,
                                  height: 40,
                                  objectFit: 'cover',
                                }}
                              />
                            </td>
                            <td>{p.nombre}</td>
                            <td>{formatoCLP(p.precio)}</td>
                            <td>{p.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
