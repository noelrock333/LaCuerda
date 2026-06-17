# ============================================================
# Etapa 1: Build del frontend (Vite + React)
# ============================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar archivos de dependencias primero (cache de capas)
COPY frontend/package*.json ./
RUN npm ci

# Copiar el resto del código del frontend y compilar
COPY frontend/ ./
RUN npm run build
# El output queda en /app/public (outDir: '../public' en vite.config.js)

# ============================================================
# Etapa 2: Runtime del backend (Fastify)
# ============================================================
FROM node:22-alpine AS runtime

WORKDIR /app

# Copiar dependencias del backend
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar el código fuente del backend
COPY src/ ./src/

# Copiar los assets compilados del frontend desde la etapa anterior
COPY --from=frontend-builder /app/public ./public/

# Exponer el puerto del servidor
EXPOSE 3000

# Variables de entorno con valores por defecto (sobreescribibles via docker-compose o -e)
ENV NODE_ENV=production \
    DB_HOST=postgres \
    DB_PORT=5432 \
    DB_USER=postgres \
    DB_PASSWORD=postgres \
    DB_NAME=la_cuerda_offline_db \
    PORT=3000

# Comando de inicio
CMD ["node", "src/server.js"]
