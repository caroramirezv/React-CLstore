# Integración del front con los microservicios

El front ya no usa Supabase: todo pasa por la carpeta `src/api/`, que habla con 8 microservicios Spring Boot + MySQL.

| Servicio | Puerto | Qué reemplaza de Supabase |
|---|---|---|
| ms-productos | 8081 | tabla `productos` y fotos de Storage |
| ms-categoria | 8082 | tabla `categorias` |
| ms-blogs | 8083 | tabla `blogs` y portadas de Storage |
| ms-usuarios | 8084 | Auth + tabla `perfiles` + función `create-user` |
| ms-carrito | 8085 | tabla `carrito_items` |
| ms-ordenes | 8086 | `crear_orden`, `registrar_orden_fallida`, `ordenes`, `orden_items` |
| ms-resenas | 8087 | tabla `resenas` |
| ms-contacto | 8088 | tabla `contactos` |

## Puesta en marcha

1. Levanta MySQL y los 8 servicios (ver el README de `microservicios-clstore`).
2. `npm run dev`. Con los puertos por defecto no hace falta configurar nada (opcional: copia `.env.example` a `.env`).
3. **Primer ingreso**: ms-usuarios crea un administrador inicial si no hay usuarios: `admin@duoc.cl` / `Admin123`
   (cámbialos con `ADMIN_CORREO` / `ADMIN_PASSWORD` antes del primer arranque).
4. Limpieza opcional (ya nada importa Supabase): `npm uninstall @supabase/supabase-js @supabase/ssr`, y puedes borrar
   `src/lib/supabaseClient.js` y la carpeta `supabase/`.

## Cómo funciona la sesión

- `POST /api/auth/login` (o `/registro`) devuelve `{ token, usuario }`. `AuthContext` guarda el JWT en `localStorage`
  (`clstore_token`) con `src/api/token.js` y carga el perfil con `GET /api/usuarios/me`.
- La capa `src/api/http.js` agrega `Authorization: Bearer <token>` solo en llamadas que lo necesitan. Los `GET` públicos
  del catálogo nunca lo envían (un token vencido no rompe la tienda).
- Si un servicio responde **401 a una llamada con token**, la sesión venció: se borra el token y `AuthContext` cierra la sesión.
- Si ms-usuarios no responde al abrir la app, **no** se pierde el token guardado.
- `AuthContext` conserva la misma interfaz de antes (`signIn`, `signUp`, `signOut`, `usuario`, `perfil`, `loading`,
  `esAdminOVendedor`), por eso `ProtectedRoute`, `Navbar`, `InicioSesion` y `Registro` no cambiaron.

## Compra

- **Invitado**: el carrito vive en memoria; `POST /api/ordenes` sin token crea una orden sin usuario.
- **Con sesión**: el carrito vive en ms-carrito (cada cambio devuelve el carrito actualizado) y la orden queda a nombre del usuario.
- El front **no envía precios**: ms-ordenes lee precio y stock de ms-productos, descuenta el stock de forma atómica y,
  si falla (sin stock, producto retirado), registra la orden como `fallida` y responde `409` con `orden_id` y el motivo.
  `Checkout` lo muestra en la pantalla de fallo, igual que antes.
- `ResumenCompra` pide `GET /api/ordenes/{id}` (con las líneas): solo su dueño o el personal pueden verla.

## Cambios de comportamiento a tener presentes

- **Los usuarios de Supabase no se migran** (sus contraseñas están hasheadas por Supabase): deben registrarse de nuevo, o crearlos el admin.
- Editar una categoría ya no cambia su identificador (`valor`), solo etiqueta/icono.
- Solo un **Administrador** puede crear, editar o eliminar cuentas de Administrador (un Vendedor ya no puede ascenderse).
- Código/identificador repetido: el servicio responde 409 (ya no se consulta antes).
- Las imágenes se guardan en disco en el servicio (`uploads/`) y la URL guardada es absoluta (`http://localhost:8081/uploads/...`).
- Desaparece el campo `VITE_API_TOKEN`: el token ya sale del login.

## Verificación hecha

- Prueba de extremo a extremo en Chromium con **las páginas y contextos reales** (`AuthProvider`, `CartProvider`) contra un servidor
  que replica las reglas de los 8 servicios: **56/56** (login/registro, sesión vencida, carrito con sesión e invitado,
  compra exitosa / sin stock / producto retirado, permisos por rol, usuarios, órdenes, reseñas, contacto, servicios caídos).
- `src/test/api.test.js` ejecutado en Node con un mini-shim: **28/28**.
- **No ejecutado**: la suite completa de Vitest (no hay `node_modules`) ni los servicios Java reales (sin Maven/MySQL).
  Corre `npm test`: adapté los tests que mockeaban Supabase y agregué `AuthContext.test.jsx` y `CartContext.test.jsx`.
