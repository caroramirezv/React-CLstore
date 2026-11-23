import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { listarContactos, eliminarContacto } from '../../api/contactoApi';

export default function AdminContactos() {
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  async function cargarContactos() {
    setCargando(true);
    setError('');
    try {
      setContactos((await listarContactos()) || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los mensajes.');
    }
    setCargando(false);
  }

  useEffect(() => {
    cargarContactos();
  }, []);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return contactos;
    return contactos.filter((c) =>
      [c.nombre, c.email, c.mensaje].some((campo) => String(campo ?? '').toLowerCase().includes(termino))
    );
  }, [contactos, busqueda]);

  async function eliminar(contacto) {
    const confirmacion = await Swal.fire({
      title: '¿Eliminar este mensaje?',
      text: `Se eliminará el mensaje de "${contacto.nombre}". Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#800000',
    });
    if (!confirmacion.isConfirmed) return;

    try {
      await eliminarContacto(contacto.id);
    } catch (err) {
      Swal.fire('No se pudo eliminar', err.message, 'error');
      return;
    }
    setContactos((prev) => prev.filter((c) => c.id !== contacto.id));
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Mensaje eliminado', showConfirmButton: false, timer: 1500 });
  }

  return (
    <section className="p-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <h4 className="fw-bold mb-0">
          <i className="fa-solid fa-envelope me-2"></i>
          Mensajes de contacto
          {!cargando && !error && <span className="badge bg-secondary ms-2 fs-6">{contactos.length}</span>}
        </h4>
        <div className="d-flex gap-2">
          <input
            type="search"
            className="form-control"
            style={{ minWidth: 240 }}
            placeholder="Buscar por nombre, correo o mensaje"
            aria-label="Buscar mensajes"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button type="button" className="btn btn-outline-secondary rounded-pill" onClick={cargarContactos} disabled={cargando}>
            <i className="fa-solid fa-rotate me-1"></i> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th>Fecha</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Mensaje</th>
                  <th className="text-end pe-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      Cargando mensajes...
                    </td>
                  </tr>
                )}

                {!cargando && !error && contactos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      Todavía no hay mensajes de contacto.
                    </td>
                  </tr>
                )}

                {!cargando && contactos.length > 0 && visibles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      Ningún mensaje coincide con la búsqueda.
                    </td>
                  </tr>
                )}

                {visibles.map((c) => (
                  <tr key={c.id}>
                    <td className="text-nowrap">{c.creado_en ? new Date(c.creado_en).toLocaleString('es-CL') : '—'}</td>
                    <td className="fw-semibold">{c.nombre}</td>
                    <td>
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </td>
                    <td style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{c.mensaje}</td>
                    <td className="text-end pe-4 text-nowrap">
                      <a
                        className="btn btn-sm btn-outline-secondary rounded-pill me-2"
                        href={`mailto:${c.email}?subject=${encodeURIComponent('Respuesta a tu mensaje en CLstore')}`}
                      >
                        Responder
                      </a>
                      <button type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => eliminar(c)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
