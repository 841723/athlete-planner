# Contenedor de producción del frontend: compila con Vite y sirve con nginx,
# que proxya /api al backend.
FROM node:24-slim AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json frontend/
RUN --mount=type=cache,target=/root/.npm npm ci --prefix frontend
COPY frontend/ frontend/
RUN npm run build --prefix frontend

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
