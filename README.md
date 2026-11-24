CLstore · Frontend en React

Tienda online de electrónica (CLstore) con catálogo, carrito, compra y panel de administración. Este repositorio contiene solo el frontend: toda la lógica de negocio y los datos viven en 8 microservicios Spring Boot + MySQL, que el front consume a través de la carpeta src/api/.

Repositorio de los microservicios: https://github.com/sahvega-sy/Micro-and-servicios.git

Arquitectura
Navegador ──▶ Frontend React (Vite / nginx)
                   │
                   ├──▶ ms-productos   :8081
                   ├──▶ ms-categoria   :8082
                   ├──▶ ms-blogs       :8083
                   ├──▶ ms-usuarios    :8084   (login, registro, Google, perfiles, JWT)
                   ├──▶ ms-carrito     :8085
                   ├──▶ ms-ordenes     :8086   (consulta precio/stock a ms-productos)
                   ├──▶ ms-resenas     :8087
                   └──▶ ms-contacto    :8088
Servicio	Puerto	Responsabilidad
ms-productos	8081	Productos y fotos (/uploads/productos/)
ms-categoria	8082	Categorías
ms-blogs	8083	Blogs y portadas (/uploads/blogs/)
ms-usuarios	8084	Autenticación (/api/auth/*), usuarios y perfil (/api/usuarios/*)
ms-carrito	8085	Carrito de usuarios con sesión
ms-ordenes	8086	Órdenes; valida precio y stock, descuenta stock y registra órdenes fallidas
ms-resenas	8087	Reseñas de productos
ms-contacto	8088	Mensajes del formulario de contacto
Documentación de la API (Swagger / OpenAPI)

Cada microservicio expone su propia documentación interactiva. Con los servicios en ejecución en local:

Servicio	Swagger UI	OpenAPI (JSON)
ms-productos	localhost:8081/swagger-ui/index.html	/v3/api-docs
ms-categoria	localhost:8082/swagger-ui/index.html	/v3/api-docs
ms-blogs	localhost:8083/swagger-ui/index.html	/v3/api-docs
ms-usuarios	localhost:8084/swagger-ui/index.html	/v3/api-docs
ms-carrito	localhost:8085/swagger-ui/index.html	/v3/api-docs
ms-ordenes	localhost:8086/swagger-ui/index.html	/v3/api-docs
ms-resenas	localhost:8087/swagger-ui/index.html	/v3/api-docs
ms-contacto	localhost:8088/swagger-ui/index.html	/v3/api-docs

Para probar endpoints protegidos: inicia sesión con POST /api/auth/login en ms-usuarios, copia el token y pégalo en Authorize como Bearer <token>.

Nota: el nginx.conf del front no proxea Swagger; accede a cada servicio directamente por su puerto.

Funcionalidades

Tienda

Home, catálogo con filtros, detalle de producto, ofertas, blogs, "Nosotros" y contacto.
Carrito: en memoria para invitados y guardado en ms-carrito para usuarios con sesión.
Checkout y resumen de compra. El front no envía precios: ms-ordenes los lee desde ms-productos. Si no hay stock o el producto fue retirado, la orden queda como fallida (HTTP 409) y el checkout muestra el motivo.
Registro, inicio de sesión con correo/contraseña e inicio de sesión con Google.

Panel de administración (/admin)

Acceso solo para usuarios de tipo Administrador o Vendedor (ProtectedRoute).
Secciones: Dashboard, Productos, Categorías, Blogs, Usuarios, Órdenes y Contactos.
Reportes (gráficos con Recharts): solo para Administrador.
Solo un Administrador puede crear, editar o eliminar cuentas de administrador.
Tecnologías
React 18 + Vite
React Router 7
Bootstrap 5
Recharts (reportes)
SweetAlert2 (alertas)
@react-oauth/google (login con Google)
Vitest + React Testing Library (pruebas)
Docker + nginx (despliegue)
Requisitos previos
Node.js 22 (el Dockerfile usa node:22-alpine)
npm
Los 8 microservicios y MySQL en ejecución (ver el README del repo de microservicios)
Instalación y ejecución local
bash
git clone https://github.com/caroramirezv/React-CLstore.git
cd React-CLstore
npm install --legacy-peer-deps
npm run dev

Con los puertos por defecto (8081–8088 en localhost) no necesitas configurar nada.

Variables de entorno (opcionales)

Se definen con prefijo VITE_ y sobrescriben la URL de cada microservicio:

Variable	Valor por defecto
VITE_API_PRODUCTOS_URL	http://localhost:8081
VITE_API_CATEGORIAS_URL	http://localhost:8082
VITE_API_BLOGS_URL	http://localhost:8083
VITE_API_USUARIOS_URL	http://localhost:8084
VITE_API_CARRITO_URL	http://localhost:8085
VITE_API_ORDENES_URL	http://localhost:8086
VITE_API_RESENAS_URL	http://localhost:8087
VITE_API_CONTACTO_URL	http://localhost:8088
VITE_GOOGLE_CLIENT_ID	(vacío: el login con Google no funcionará)
Primer ingreso

Si no hay usuarios, ms-usuarios crea un administrador inicial. Cambia las credenciales con ADMIN_CORREO y ADMIN_PASSWORD antes del primer arranque del servicio, y no uses los valores de ejemplo en producción.

Scripts
Comando	Qué hace
npm run dev	Servidor de desarrollo con Vite
npm run build	Build de producción en dist/
npm run preview	Sirve el build localmente
npm test	Ejecuta las pruebas con Vitest
npm run coverage	Pruebas con reporte de cobertura
Despliegue con Docker

El Dockerfile hace un build multi-etapa: compila con Node y sirve dist/ con nginx.

bash
docker build \
  --build-arg VITE_API_URL=http://localhost:8080 \
  --build-arg VITE_GOOGLE_CLIENT_ID=<tu_client_id> \
  -t clstore-front .

nginx.conf actúa como proxy hacia los microservicios por nombre de host, así que el contenedor debe estar en la misma red Docker que ellos (ms-productos, ms-categoria, ms-blogs, ms-usuarios, ms-carrito, ms-ordenes, ms-resenas, ms-contacto):

Ruta	Destino
/api/productos, /uploads/productos/	ms-productos:8081
/api/categorias	ms-categoria:8082
/api/blogs, /uploads/blogs/	ms-blogs:8083
/api/usuarios, /api/auth	ms-usuarios:8084
/api/carrito	ms-carrito:8085
/api/ordenes	ms-ordenes:8086
/api/resenas	ms-resenas:8087
/api/contactos	ms-contacto:8088

/api/productos/stock/ responde 403: es solo para llamadas internas entre servicios. Cualquier otra ruta cae en index.html para que funcione React Router.

Sesión y seguridad
POST /api/auth/login (o /registro, /google) devuelve { token, usuario }. El JWT se guarda en localStorage (clstore_token) y el perfil se carga con GET /api/usuarios/me.
src/api/http.js agrega Authorization: Bearer <token> solo en las llamadas que lo requieren; los GET públicos del catálogo nunca lo envían.
Si un servicio responde 401 a una llamada con token, se borra el token y se cierra la sesión.
Si ms-usuarios no responde al abrir la app, el token guardado se conserva y se reintenta al recargar.
Rutas del frontend
Ruta	Página
/	Home
/productos, /productos/:id	Catálogo y detalle
/ofertas	Ofertas
/carrito, /pagar	Carrito y checkout
/resumen-compra, /resumen-compra/:ordenId	Resumen de la compra
/blogs, /blogs/:id	Blogs
/contacto, /nosotros	Contacto y quiénes somos
/registro, /iniciar-sesion	Cuenta
/admin	Panel (Administrador / Vendedor)
Estructura del proyecto
React-CLstore/
├── public/img/          # Imágenes estáticas
├── src/
│   ├── api/             # Cliente HTTP (http.js, token.js) y un módulo por microservicio
│   ├── components/      # Navbar, Footer, ProductCard, ProtectedRoute, boletaModal
│   ├── context/         # AuthContext (sesión) y CartContext (carrito)
│   ├── data/            # Regiones y comunas
│   ├── lib/             # Validaciones
│   ├── pages/           # Páginas de la tienda
│   │   └── Admin/       # Panel de administración
│   ├── styles/          # CSS base y por página
│   └── test/            # Pruebas (Vitest + Testing Library)
├── Dockerfile
├── nginx.conf
├── vite.config.js
└── package.json
Pruebas

Se usa Vitest con jsdom y React Testing Library. Hay pruebas para la capa de API, los contextos de sesión y carrito, las páginas de la tienda, cada sección del panel de administración y las validaciones.

bash
npm test
npm run coverage
