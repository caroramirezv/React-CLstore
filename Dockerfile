FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 \
 && (npm ci --legacy-peer-deps || npm install --legacy-peer-deps)
COPY . .
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_PRODUCTOS_URL=$VITE_API_URL \
    VITE_API_CATEGORIAS_URL=$VITE_API_URL \
    VITE_API_BLOGS_URL=$VITE_API_URL \
    VITE_API_USUARIOS_URL=$VITE_API_URL \
    VITE_API_CARRITO_URL=$VITE_API_URL \
    VITE_API_ORDENES_URL=$VITE_API_URL \
    VITE_API_RESENAS_URL=$VITE_API_URL \
    VITE_API_CONTACTO_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
