import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatoCLP } from '../../lib/validaciones';

const ICONO_DEFAULT = 'fa-folder';

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
  const [categoriasDb, setCategoriasDb] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargarProductos() {
    setCargando(true);

    const [resProductos, resCategorias] = await Promise.all([
      supabase.from('productos').select('*').order('nombre'),
      supabase.from('categorias').select('*').order('etiqueta'),
    ]);

    if (resProductos.error) {
      setError(`Error al cargar productos: ${resProductos.error.message}`);
    } else {
      setProductos(resProductos.data || []);
    }

    if (resCategorias.error) {
      setError(`Error al cargar categorías: ${resCategorias.error.message}`);
    } else {
      setCategoriasDb(resCategorias.data || []);
    }

    setCargando(false);
  }

  useEffect(() => {
    cargarProductos();
  }, []);

  const categorias = categoriasDb.map((c) => ({
    valor: c.valor,
    etiqueta: c.etiqueta,
    icono: c.icono || ICONO_DEFAULT,
  }));

  function cancelarEdicion() {
    setEditando(null);
    setNombre('');
  }

  async function crearCategoria(e) {
    e.preventDefault();

    const etiqueta = nuevaCategoria.trim();
    const valor = generarValor(etiqueta);

    if (!etiqueta || !valor) {
      setError('Ingresa un nombre válido para la categoría.');
      setMensaje('');
      return;
    }

    if (categorias.some((cat) => cat.valor === valor)) {
      setError('Esa categoría ya existe.');
      setMensaje('');
      return;
    }

    setError('');
    setMensaje('');
    setGuardando(true);

    const { error: errorCrear } = await supabase
      .from('categorias')
      .insert({ valor, etiqueta });

    setGuardando(false);

    if (errorCrear) {
      setError(`No se pudo crear la categoría: ${errorCrear.message}`);
      return;
    }

    setNuevaCategoria('');
    setMensaje(`Categoría "${etiqueta}" creada correctamente.`);
    await cargarProductos();
  }

  async function guardarCategoria(e) {
    e.preventDefault();

    const etiqueta = nombre.trim();
    const valorNuevo = generarValor(etiqueta);

    if (!etiqueta || !valorNuevo) {
      setError('Ingresa un nombre válido para la categoría.');
      setMensaje('');
      return;
    }

    if (
      valorNuevo !== editando.valor &&
      categorias.some((cat) => cat.valor === valorNuevo)
    ) {
      setError('Ya existe otra categoría con ese nombre.');
      setMensaje('');
      return;
    }

    setError('');
    setMensaje('');
    setGuardando(true);

    // Al cambiar "valor", la clave foránea (on update cascade)
    // actualiza automáticamente la categoría de sus productos.
    const { error: errorActualizar } = await supabase
      .from('categorias')
      .update({ valor: valorNuevo, etiqueta })
      .eq('valor', editando.valor);

    setGuardando(false);

    if (errorActualizar) {
      setError(`No se pudo actualizar la categoría: ${errorActualizar.message}`);
      return;
    }

    cancelarEdicion();
    setMensaje('Categoría actualizada correctamente.');
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
      setMensaje('');
      return;
    }

    const { error: errorEliminar } = await supabase
      .from('categorias')
      .delete()
      .eq('valor', categoria.valor);

    if (errorEliminar) {
      setError(`No se pudo eliminar la categoría: ${errorEliminar.message}`);
      setMensaje('');
      return;
    }

    if (editando?.valor === categoria.valor) cancelarEdicion();
    setError('');
    setMensaje(`Categoría "${categoria.etiqueta}" eliminada.`);
    await cargarProductos();
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
            <i className="fa-solid fa-plus me-2"></i>
            Crear categoría
          </h5>
        </div>

        <div className="card-body">
          <form onSubmit={crearCategoria} className="d-flex gap-2 flex-wrap">
            <input
              className="form-control flex-grow-1"
              style={{ minWidth: 220, width: 'auto' }}
              placeholder="Nombre de la nueva categoría"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              maxLength={100}
              required
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={guardando}
            >
              Crear categoría
            </button>
          </form>
        </div>
      </div>

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
                onClick={() => {
                  cancelarEdicion();
                  setError('');
                  setMensaje('');
                }}
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
          Aún no hay categorías. Crea la primera con el formulario de arriba.
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