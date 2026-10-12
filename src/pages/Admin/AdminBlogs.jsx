import { useEffect, useState } from 'react';
import { Modal } from 'bootstrap';
import Swal from 'sweetalert2';
import { supabase } from '../../lib/supabaseClient';

const FORM_VACIO = {
  id: '', titulo: '', resumen: '', imagen: '', contenidoTexto: '', fuente_nombre: '', fuente_url: '',
};
const MAX_IMAGEN = 5 * 1024 * 1024;

export default function AdminBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [esEdicion, setEsEdicion] = useState(false);
  const [imagenArchivo, setImagenArchivo] = useState(null);
  const [imagenPreview, setImagenPreview] = useState('');

  async function cargarBlogs() {
    setCargando(true);
    const { data, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
    if (error) {
      Swal.fire('No se pudieron cargar los blogs', error.message, 'error');
      setBlogs([]);
    } else setBlogs(data || []);
    setCargando(false);
  }

  useEffect(() => { cargarBlogs(); }, []);

  function abrirCreacion() {
    setForm(FORM_VACIO);
    setImagenArchivo(null);
    setImagenPreview('');
    setEsEdicion(false);
  }

  function abrirEdicion(blog) {
    setForm({
      id: blog.id || '', titulo: blog.titulo || '', resumen: blog.resumen || '',
      imagen: blog.imagen || '', contenidoTexto: (blog.contenido || []).join('\n\n'),
      fuente_nombre: blog.fuente_nombre || '', fuente_url: blog.fuente_url || '',
    });
    setImagenArchivo(null);
    setImagenPreview(blog.imagen || '');
    setEsEdicion(true);
  }

  function cerrarModal() {
    Modal.getInstance(document.getElementById('modalBlog'))?.hide();
    setImagenArchivo(null);
  }

  function seleccionarImagen(event) {
    const archivo = event.target.files?.[0] || null;
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      Swal.fire('Archivo no válido', 'Selecciona un archivo de imagen.', 'error');
      event.target.value = '';
      return;
    }
    if (archivo.size > MAX_IMAGEN) {
      Swal.fire('Imagen demasiado grande', 'La imagen debe pesar 5 MB o menos.', 'error');
      event.target.value = '';
      return;
    }
    setImagenArchivo(archivo);
    setImagenPreview(URL.createObjectURL(archivo));
  }

  async function guardar(event) {
    event.preventDefault();
    if (!form.id.trim() || !form.titulo.trim() || !form.resumen.trim() || !form.contenidoTexto.trim()) {
      Swal.fire('Faltan datos', 'Completa el identificador, título, resumen y contenido del blog.', 'warning');
      return;
    }
    if (form.fuente_url && !/^https?:\/\//i.test(form.fuente_url.trim())) {
      Swal.fire('URL no válida', 'La URL de la fuente debe comenzar con http:// o https://.', 'error');
      return;
    }

    setGuardando(true);
    try {
      if (!esEdicion) {
        const { data: existente, error: errorConsulta } = await supabase.from('blogs').select('id').eq('id', form.id.trim()).maybeSingle();
        if (errorConsulta) throw errorConsulta;
        if (existente) {
          Swal.fire('Identificador repetido', 'Ya existe un blog con ese identificador.', 'error');
          return;
        }
      }

      let imagenFinal = form.imagen.trim();
      if (imagenArchivo) {
        const extension = imagenArchivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const ruta = `${form.id.trim().replace(/[^a-zA-Z0-9_-]/g, '-')}/${Date.now()}.${extension}`;
        const { error: errorSubida } = await supabase.storage.from('blogs').upload(ruta, imagenArchivo, {
          cacheControl: '3600', upsert: false, contentType: imagenArchivo.type,
        });
        if (errorSubida) throw new Error(`${errorSubida.message}. Comprueba que exista el bucket de Storage "blogs" y sus permisos.`);
        imagenFinal = supabase.storage.from('blogs').getPublicUrl(ruta).data.publicUrl;
      }

      const contenido = form.contenidoTexto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      const payload = {
        titulo: form.titulo.trim(), resumen: form.resumen.trim(), imagen: imagenFinal || null,
        contenido, fuente_nombre: form.fuente_nombre.trim() || null, fuente_url: form.fuente_url.trim() || null,
      };
      const resultado = esEdicion
        ? await supabase.from('blogs').update(payload).eq('id', form.id.trim())
        : await supabase.from('blogs').insert({ id: form.id.trim(), ...payload });
      if (resultado.error) throw resultado.error;

      cerrarModal();
      await cargarBlogs();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: esEdicion ? 'Blog actualizado' : 'Blog creado', showConfirmButton: false, timer: 1800 });
    } catch (error) {
      Swal.fire('No se pudo guardar el blog', error.message || 'Ocurrió un error inesperado.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(blog) {
    const confirmacion = await Swal.fire({
      title: '¿Eliminar este blog?', text: `Se eliminará "${blog.titulo}". Esta acción no se puede deshacer.`, icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#800000',
    });
    if (!confirmacion.isConfirmed) return;
    const { error } = await supabase.from('blogs').delete().eq('id', blog.id);
    if (error) { Swal.fire('No se pudo eliminar', error.message, 'error'); return; }
    await cargarBlogs();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Blog eliminado', showConfirmButton: false, timer: 1500 });
  }

  return (
    <section className="p-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <button className="btn btn-primary rounded-pill px-4" data-bs-toggle="modal" data-bs-target="#modalBlog" onClick={abrirCreacion}>
          <i className="fa-solid fa-plus me-2"></i>Nuevo blog
        </button>
      </div>

      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-body p-0"><div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-dark"><tr><th>Imagen</th><th>Título</th><th>Resumen</th><th>Fecha</th><th className="text-end pe-4">Acciones</th></tr></thead>
            <tbody>
              {cargando && <tr><td colSpan={5} className="text-center text-muted py-4">Cargando blogs...</td></tr>}
              {!cargando && blogs.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">Todavía no hay blogs publicados.</td></tr>}
              {!cargando && blogs.map((blog) => (
                <tr key={blog.id}>
                  <td>{blog.imagen ? <img src={blog.imagen} alt={blog.titulo} className="rounded" style={{ width: 58, height: 48, objectFit: 'cover' }} /> : <div className="rounded bg-light text-muted d-flex align-items-center justify-content-center" style={{ width: 58, height: 48 }}><i className="fa-regular fa-image"></i></div>}</td>
                  <td><div className="fw-semibold">{blog.titulo}</div><small className="text-muted">ID: {blog.id}</small></td>
                  <td style={{ minWidth: 220, maxWidth: 380 }}><span className="text-muted">{blog.resumen || 'Sin resumen'}</span></td>
                  <td className="text-nowrap">{blog.created_at ? new Date(blog.created_at).toLocaleDateString('es-CL') : '—'}</td>
                  <td className="text-end pe-4 text-nowrap">
                    <button className="btn btn-sm btn-outline-primary rounded-pill me-1" data-bs-toggle="modal" data-bs-target="#modalBlog" onClick={() => abrirEdicion(blog)} title="Editar"><i className="fa-solid fa-pen"></i></button>
                    <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => eliminar(blog)} title="Eliminar"><i className="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </div>

      <div className="modal fade" id="modalBlog" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable"><div className="modal-content">
          <div className="modal-header"><h5 className="modal-title fw-bold">{esEdicion ? 'Editar blog' : 'Crear blog'}</h5><button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
          <form onSubmit={guardar}>
            <div className="modal-body row g-3">
              <div className="col-md-4"><label className="form-label fw-semibold">Identificador *</label><input className="form-control" required minLength={2} maxLength={80} disabled={esEdicion} placeholder="Ej: guia-armar-pc" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.trim() })} /><small className="text-muted">Se usa en la dirección del artículo.</small></div>
              <div className="col-md-8"><label className="form-label fw-semibold">Título *</label><input className="form-control" required maxLength={180} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div className="col-12"><label className="form-label fw-semibold">Resumen *</label><textarea className="form-control" rows={2} required maxLength={500} value={form.resumen} onChange={(e) => setForm({ ...form, resumen: e.target.value })} placeholder="Breve descripción que aparecerá en la lista de blogs." /></div>
              <div className="col-md-6"><label className="form-label fw-semibold">Imagen (opcional)</label><input type="file" className="form-control" accept="image/*" onChange={seleccionarImagen} /><small className="text-muted">Máximo 5 MB. Si no eliges una imagen nueva, se conserva la actual.</small>{imagenPreview && <img src={imagenPreview} alt="Vista previa" className="img-thumbnail mt-2" style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'contain' }} />}</div>
              <div className="col-md-6"><label className="form-label fw-semibold">URL de imagen (opcional)</label><input type="url" className="form-control" placeholder="https://..." value={form.imagen} onChange={(e) => { setForm({ ...form, imagen: e.target.value }); if (!imagenArchivo) setImagenPreview(e.target.value); }} /><small className="text-muted">Puedes usar una URL o subir un archivo.</small></div>
              <div className="col-12"><label className="form-label fw-semibold">Contenido del artículo *</label><textarea className="form-control" rows={7} required value={form.contenidoTexto} onChange={(e) => setForm({ ...form, contenidoTexto: e.target.value })} placeholder={'Escribe el contenido. Separa cada párrafo con una línea en blanco.'} /><small className="text-muted">Cada bloque separado por una línea en blanco se guardará como un párrafo.</small></div>
              <div className="col-md-6"><label className="form-label fw-semibold">Autor / fuente</label><input className="form-control" maxLength={120} value={form.fuente_nombre} onChange={(e) => setForm({ ...form, fuente_nombre: e.target.value })} placeholder="Equipo CLstore" /></div>
              <div className="col-md-6"><label className="form-label fw-semibold">URL de la fuente</label><input type="url" className="form-control" value={form.fuente_url} onChange={(e) => setForm({ ...form, fuente_url: e.target.value })} placeholder="https://..." /></div>
            </div>
            <div className="modal-footer"><button type="button" className="btn btn-outline-secondary rounded-pill" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary rounded-pill px-4" disabled={guardando}>{guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear blog'}</button></div>
          </form>
        </div></div>
      </div>
    </section>
  );
}
