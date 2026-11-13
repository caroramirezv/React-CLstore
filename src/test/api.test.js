import { aResultado, ApiError, peticion, API_URLS, registrarManejadorSesionExpirada } from '../api/http';
import { listarProductos, crearProducto, subirImagenProducto, eliminarProducto } from '../api/productosApi';
import { actualizarCategoria } from '../api/categoriasApi';
import { subirImagenBlog } from '../api/blogsApi';
import { login, registro, obtenerPerfil, crearUsuario } from '../api/usuariosApi';
import { agregarAlCarrito, cambiarCantidadCarrito, vaciarCarritoRemoto } from '../api/carritoApi';
import { crearOrden, listarOrdenes, obtenerOrden } from '../api/ordenesApi';
import { listarResenas } from '../api/resenasApi';
import { enviarContacto } from '../api/contactoApi';
import { guardarToken, borrarToken, obtenerToken } from '../api/token';

// Respuesta mínima compatible con lo que usa peticion(): ok, status y text()
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (cuerpo === undefined ? '' : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)),
});

describe('capa api (clientes de los microservicios)', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ultimaLlamada = () => {
    const [url, opciones] = fetchMock.mock.calls.at(-1);
    return { url: new URL(String(url)), opciones };
  };

  describe('lecturas', () => {
    it('listarProductos arma la query con los filtros e ignora los vacíos', async () => {
      fetchMock.mockResolvedValue(respuesta(200, []));
      await listarProductos({ categoria: 'consolas', q: '', oferta: true, excluir: undefined, orden: 'descuento_desc', limit: 3 });
      const { url, opciones } = ultimaLlamada();
      expect(url.origin).toBe(API_URLS.productos);
      expect(url.pathname).toBe('/api/productos');
      expect(Object.fromEntries(url.searchParams)).toEqual({ categoria: 'consolas', oferta: 'true', orden: 'descuento_desc', limit: '3' });
      expect(opciones.method).toBe('GET');
    });

    it('las lecturas no envían token aunque exista (un token vencido no debe romper el catálogo)', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(200, []));
      await listarProductos();
      expect(ultimaLlamada().opciones.headers.Authorization).toBeUndefined();
    });

    it('devuelve el JSON de la respuesta', async () => {
      fetchMock.mockResolvedValue(respuesta(200, [{ id: 'a' }]));
      await expect(listarProductos()).resolves.toEqual([{ id: 'a' }]);
    });
  });

  describe('escrituras', () => {
    it('crearProducto envía POST con JSON y el token como Bearer', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(201, { id: 'TEC1' }));
      await crearProducto({ id: 'TEC1', nombre: 'Teclado' });
      const { url, opciones } = ultimaLlamada();
      expect(url.pathname).toBe('/api/productos');
      expect(opciones.method).toBe('POST');
      expect(opciones.headers.Authorization).toBe('Bearer abc.def.ghi');
      expect(opciones.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(opciones.body)).toEqual({ id: 'TEC1', nombre: 'Teclado' });
    });

    it('sin token no agrega Authorization (el servicio responderá 401)', async () => {
      fetchMock.mockResolvedValue(respuesta(201, {}));
      await crearProducto({ id: 'TEC1' });
      expect(ultimaLlamada().opciones.headers.Authorization).toBeUndefined();
    });

    it('codifica el identificador en la ruta', async () => {
      fetchMock.mockResolvedValue(respuesta(204));
      await actualizarCategoria('gaming gear/x', { etiqueta: 'Gaming' });
      expect(ultimaLlamada().url.pathname).toBe('/api/categorias/gaming%20gear%2Fx');
    });

    it('una respuesta 204 devuelve null', async () => {
      fetchMock.mockResolvedValue(respuesta(204));
      await expect(eliminarProducto('TEC1')).resolves.toBeNull();
      expect(ultimaLlamada().opciones.method).toBe('DELETE');
    });
  });

  describe('subida de imágenes', () => {
    it('sube el archivo como multipart (campo "archivo") sin fijar Content-Type y devuelve la URL', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(201, { url: 'http://localhost:8081/uploads/productos/x.png' }));
      const foto = new File(['img'], 'foto.png', { type: 'image/png' });
      await expect(subirImagenProducto(foto)).resolves.toBe('http://localhost:8081/uploads/productos/x.png');
      const { url, opciones } = ultimaLlamada();
      expect(url.pathname).toBe('/api/productos/imagenes');
      expect(opciones.method).toBe('POST');
      expect(opciones.body).toBeInstanceOf(FormData);
      expect(opciones.body.get('archivo')).toBe(foto);
      expect(opciones.headers['Content-Type']).toBeUndefined(); // lo fija el navegador con su boundary
      expect(opciones.headers.Authorization).toBe('Bearer abc.def.ghi');
    });

    it('la portada de un blog va a ms-blogs', async () => {
      fetchMock.mockResolvedValue(respuesta(201, { url: 'http://localhost:8083/uploads/blogs/x.png' }));
      await subirImagenBlog(new File(['img'], 'p.png', { type: 'image/png' }));
      const { url } = ultimaLlamada();
      expect(url.origin).toBe(API_URLS.blogs);
      expect(url.pathname).toBe('/api/blogs/imagenes');
    });
  });

  describe('errores', () => {
    it('usa el "detail" de la respuesta RFC 7807 como mensaje y conserva el estado', async () => {
      fetchMock.mockResolvedValue(respuesta(409, { status: 409, detail: 'Ya existe un producto con ese código.' }));
      const error = await crearProducto({ id: 'X' }).catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Ya existe un producto con ese código.');
      expect(error.status).toBe(409);
    });

    it('expone el detalle por campo de una validación fallida (400)', async () => {
      fetchMock.mockResolvedValue(respuesta(400, { detail: 'Datos inválidos. nombre: es obligatorio', errores: { nombre: 'es obligatorio' } }));
      const error = await crearProducto({}).catch((e) => e);
      expect(error.status).toBe(400);
      expect(error.errores).toEqual({ nombre: 'es obligatorio' });
    });

    it('401 y 403 sin cuerpo tienen un mensaje claro', async () => {
      fetchMock.mockResolvedValueOnce(respuesta(401));
      expect((await crearProducto({}).catch((e) => e)).message).toMatch(/sesión no es válida/);
      fetchMock.mockResolvedValueOnce(respuesta(403));
      expect((await crearProducto({}).catch((e) => e)).message).toMatch(/No tienes permisos/);
    });

    it('un error 500 con cuerpo no JSON no rompe y da un mensaje genérico', async () => {
      fetchMock.mockResolvedValue(respuesta(500, '<html>Internal Server Error</html>'));
      const error = await listarProductos().catch((e) => e);
      expect(error.status).toBe(500);
      expect(error.message).toMatch(/Error inesperado del servidor \(500\)/);
    });

    it('si el microservicio no responde lanza ApiError con estado 0', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      const error = await listarProductos().catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
      expect(error.message).toMatch(/No se pudo conectar/);
    });
  });

  describe('token', () => {
    it('se guarda, se lee y se borra', () => {
      expect(obtenerToken()).toBeNull();
      guardarToken('t1');
      expect(obtenerToken()).toBe('t1');
      borrarToken();
      expect(obtenerToken()).toBeNull();
    });
  });

  describe('aResultado', () => {
    it('convierte éxito y fallo en { data, error } sin rechazar nunca', async () => {
      await expect(aResultado(Promise.resolve([1]))).resolves.toEqual({ data: [1], error: null });
      const fallo = new Error('x');
      await expect(aResultado(Promise.reject(fallo))).resolves.toEqual({ data: null, error: fallo });
    });
  });

  describe('servicios de usuarios, carrito, órdenes, reseñas y contacto', () => {
    it('login y registro NO envían token (todavía no hay sesión)', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(200, { token: 't', usuario: {} }));
      await login('a@gmail.com', 'Abc123');
      expect(ultimaLlamada().url.origin).toBe(API_URLS.usuarios);
      expect(ultimaLlamada().url.pathname).toBe('/api/auth/login');
      expect(JSON.parse(ultimaLlamada().opciones.body)).toEqual({ correo: 'a@gmail.com', password: 'Abc123' });
      expect(ultimaLlamada().opciones.headers.Authorization).toBeUndefined();
      await registro({ correo: 'a@gmail.com' });
      expect(ultimaLlamada().url.pathname).toBe('/api/auth/registro');
      expect(ultimaLlamada().opciones.headers.Authorization).toBeUndefined();
    });

    it('obtenerPerfil y crearUsuario envían el token', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(200, {}));
      await obtenerPerfil();
      expect(ultimaLlamada().url.pathname).toBe('/api/usuarios/me');
      expect(ultimaLlamada().opciones.headers.Authorization).toBe('Bearer abc.def.ghi');
      await crearUsuario({ correo: 'x@gmail.com' });
      expect(ultimaLlamada().opciones.method).toBe('POST');
      expect(ultimaLlamada().opciones.headers.Authorization).toBe('Bearer abc.def.ghi');
    });

    it('el carrito va a ms-carrito con el token y el cuerpo esperado', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(200, []));
      await agregarAlCarrito('rtx3080', 2);
      expect(ultimaLlamada().url.origin).toBe(API_URLS.carrito);
      expect(ultimaLlamada().url.pathname).toBe('/api/carrito/items');
      expect(JSON.parse(ultimaLlamada().opciones.body)).toEqual({ producto_id: 'rtx3080', cantidad: 2 });
      await cambiarCantidadCarrito('rtx3080', 5);
      expect(ultimaLlamada().opciones.method).toBe('PUT');
      expect(ultimaLlamada().url.pathname).toBe('/api/carrito/items/rtx3080');
      expect(JSON.parse(ultimaLlamada().opciones.body)).toEqual({ cantidad: 5 });
      fetchMock.mockResolvedValue(respuesta(204));
      await vaciarCarritoRemoto();
      expect(ultimaLlamada().opciones.method).toBe('DELETE');
      expect(ultimaLlamada().url.pathname).toBe('/api/carrito');
    });

    it('crearOrden envía el token solo si hay sesión (compra de invitado sin token)', async () => {
      fetchMock.mockResolvedValue(respuesta(201, { orden_id: 1, total: 100, estado: 'exitosa' }));
      await crearOrden({ nombre: 'Ana', items: [] });
      expect(ultimaLlamada().url.origin).toBe(API_URLS.ordenes);
      expect(ultimaLlamada().opciones.headers.Authorization).toBeUndefined();
      guardarToken('abc.def.ghi');
      await crearOrden({ nombre: 'Ana', items: [] });
      expect(ultimaLlamada().opciones.headers.Authorization).toBe('Bearer abc.def.ghi');
    });

    it('una compra rechazada (409) deja el id de la orden fallida en error.datos.orden_id', async () => {
      fetchMock.mockResolvedValue(respuesta(409, { status: 409, detail: "Stock insuficiente para 'RTX': disponible 1, solicitado 2.", orden_id: 77 }));
      const error = await crearOrden({ items: [] }).catch((e) => e);
      expect(error.status).toBe(409);
      expect(error.message).toBe("Stock insuficiente para 'RTX': disponible 1, solicitado 2.");
      expect(error.datos.orden_id).toBe(77);
    });

    it('listarOrdenes filtra por estado y obtenerOrden pide el detalle por id', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(200, []));
      await listarOrdenes({ estado: 'exitosa' });
      expect(ultimaLlamada().url.search).toBe('?estado=exitosa');
      await obtenerOrden(41);
      expect(ultimaLlamada().url.pathname).toBe('/api/ordenes/41');
    });

    it('listarResenas pide por producto_id (público) y enviarContacto no usa token', async () => {
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(200, []));
      await listarResenas('rtx3080');
      expect(ultimaLlamada().url.origin).toBe(API_URLS.resenas);
      expect(ultimaLlamada().url.search).toBe('?producto_id=rtx3080');
      expect(ultimaLlamada().opciones.headers.Authorization).toBeUndefined();
      fetchMock.mockResolvedValue(respuesta(201, { id: 1 }));
      await enviarContacto({ nombre: 'Ana', email: 'a@gmail.com', mensaje: 'Hola' });
      expect(ultimaLlamada().url.origin).toBe(API_URLS.contacto);
      expect(ultimaLlamada().opciones.headers.Authorization).toBeUndefined();
    });
  });

  describe('sesión vencida (401)', () => {
    it('un 401 a una llamada CON token borra el token y avisa al manejador', async () => {
      const manejador = vi.fn();
      const quitar = registrarManejadorSesionExpirada(manejador);
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(401));
      await obtenerPerfil().catch(() => {});
      expect(obtenerToken()).toBeNull();
      expect(manejador).toHaveBeenCalledTimes(1);
      quitar();
    });

    it('un 401 SIN token (login fallido) no avisa ni borra nada', async () => {
      const manejador = vi.fn();
      const quitar = registrarManejadorSesionExpirada(manejador);
      fetchMock.mockResolvedValue(respuesta(401, { detail: 'Correo o contraseña incorrectos.' }));
      const error = await login('a@gmail.com', 'mala').catch((e) => e);
      expect(error.message).toBe('Correo o contraseña incorrectos.');
      expect(manejador).not.toHaveBeenCalled();
      quitar();
    });

    it('un 403 o un 409 con token NO cierran la sesión', async () => {
      const manejador = vi.fn();
      const quitar = registrarManejadorSesionExpirada(manejador);
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(403));
      await crearUsuario({}).catch(() => {});
      fetchMock.mockResolvedValue(respuesta(409, { detail: 'x' }));
      await crearUsuario({}).catch(() => {});
      expect(obtenerToken()).toBe('abc.def.ghi');
      expect(manejador).not.toHaveBeenCalled();
      quitar();
    });

    it('la función devuelta por registrarManejadorSesionExpirada deja de avisar', async () => {
      const manejador = vi.fn();
      registrarManejadorSesionExpirada(manejador)();
      guardarToken('abc.def.ghi');
      fetchMock.mockResolvedValue(respuesta(401));
      await obtenerPerfil().catch(() => {});
      expect(manejador).not.toHaveBeenCalled();
    });
  });

  it('peticion usa la URL base indicada y agrega los parámetros', async () => {
    fetchMock.mockResolvedValue(respuesta(200, {}));
    await peticion('http://localhost:9999', '/api/x', { params: { a: 1 } });
    expect(String(ultimaLlamada().url)).toBe('http://localhost:9999/api/x?a=1');
  });
});
