# Contenedor de desarrollo del frontend (Vite HMR). El código fuente se monta
# por bind mount desde docker-compose; aquí solo se instalan las dependencias.
FROM node:24-slim

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json frontend/
RUN --mount=type=cache,target=/root/.npm npm ci --prefix frontend
COPY frontend/ frontend/

EXPOSE 3000

CMD ["npm", "--prefix", "frontend", "run", "dev", "--", "--host", "0.0.0.0"]
