# Guía de Comandos del Proyecto (LaCuerda Downloader)

Este documento detalla las instrucciones y descripciones de los comandos necesarios para ejecutar, configurar y desarrollar las diferentes partes de este proyecto.

---

## 📋 Requisitos Previos

Antes de ejecutar cualquier comando, asegúrate de tener configurado lo siguiente:

1. **Instalación de Dependencias**:
   Asegúrate de instalar los paquetes de Node.js tanto en la raíz como en el frontend.
   ```bash
   # Instalar dependencias del proyecto raíz (Backend / Scrapers)
   npm install

   # Instalar dependencias del Frontend
   cd frontend && npm install && cd ..
   ```

2. **Base de Datos PostgreSQL**:
   Debes tener una base de datos PostgreSQL activa y configurada.
   
3. **Archivo de Configuración (`config.json`)**:
   Debe existir un archivo `config.json` en la raíz del proyecto con la configuración de la base de datos y comportamiento de los scrapers. Ejemplo:
   ```json
   {
     "postgres": {
       "host": "localhost",
       "port": 5432,
       "user": "tu_usuario",
       "password": "tu_contraseña",
       "database": "chords_db"
     },
     "requestDelayMs": 2000,
     "downloadAllVersions": false,
     "userAgent": "Mozilla/5.0..."
   }
   ```

---

## 🚀 Comandos del Scraper y Backend (Raíz)

Ejecuta estos comandos desde el **directorio raíz** del proyecto.

### 1. Descargar desde `urls.txt`
Descarga y archiva canciones específicas que hayas añadido al archivo `urls.txt`.
```bash
npm start
# o también:
npm run start
```
* **Descripción**: Lee las URLs (directas de LaCuerda o de Wayback Machine) especificadas en `urls.txt`, busca snapshots de Wayback Machine si es necesario y guarda los acordes y tablaturas directamente en la base de datos de PostgreSQL.

### 2. Consultar Base de Datos
Inspecciona rápidamente las canciones y tablaturas descargadas en tu base de datos local.
```bash
npm run query
```
* **Descripción**: Imprime en consola un resumen de todas las canciones en la base de datos PostgreSQL, incluyendo artista, título, tipo de tablatura, URL original y las primeras 5 líneas de su contenido.

### 3. Crawl Alfabético (Scraper Masivo)
Inicia, reanuda o reintenta descargas masivas de todo el catálogo de forma secuencial y alfabética.

* **Iniciar nuevo rastreo**:
  ```bash
  # Comando general
  node src/crawl_alpha.js --start <url_de_inicio>

  # Ejemplo:
  node src/crawl_alpha.js --start https://acordes.lacuerda.net/tabs/z/index0.html
  ```
  * **Descripción**: Comienza el rastreo alfabético desde la URL de índice especificada. Guarda el progreso automáticamente en `crawl_state.json`.

* **Reanudar rastreo interrumpido**:
  ```bash
  npm run crawl:resume
  # o también:
  node src/crawl_alpha.js --resume
  ```
  * **Descripción**: Carga el estado actual desde `crawl_state.json` y continúa el rastreo alfabético exactamente en el punto donde se detuvo (por ejemplo, después de detenerlo con `Ctrl+C`).

* **Reintentar descargas fallidas**:
  ```bash
  npm run crawl:retry
  # o también:
  node src/crawl_alpha.js --retry-failed
  ```
  * **Descripción**: Lee las URLs que no pudieron descargarse debido a errores de conexión u otros problemas (almacenadas en la tabla `failed_urls` de la base de datos) y vuelve a intentar procesarlas.

---

## 💻 Comandos del Servidor y Aplicación Web

Los siguientes comandos administran la aplicación interactiva para ver y buscar las canciones descargadas.

### 1. Modo de Desarrollo (Frontend + Backend con HMR)
Levanta ambos servidores en paralelo con hot-reload en frontend y backend.
```bash
npm run dev
```
* **Descripción**:
  - Lanza el servidor de Vite para el **Frontend** en `http://localhost:5173` (con HMR / recarga en caliente).
  - Lanza el servidor Fastify en `http://localhost:3000` con `node --watch` (reinicio automático al cambiar archivos del backend).
  - **Solo necesitas abrir `http://localhost:3000`** — el backend detecta que está en modo desarrollo (`NODE_ENV=development`) y actúa como proxy transparente: reenvía todas las peticiones de HTML/JS/CSS hacia Vite en `:5173`, por lo que el HMR funciona de forma invisible.

* **Arquitectura de archivos en desarrollo**:
  ```
  http://localhost:3000  (Fastify — punto de entrada único)
      │
      ├── /api/*    →  Manejado por el backend (base de datos, auth, etc.)
      ├── /TXT/*    →  Archivos de tablaturas servidos por el backend
      └── /*        →  Proxy hacia http://localhost:5173 (Vite HMR)
  ```

* **Hot-reload**:
  - **Frontend**: Vite detecta cambios en `frontend/src/` y aplica HMR sin recargar la página.
  - **Backend**: `node --watch` detecta cambios en `src/` y reinicia el servidor automáticamente.

### 2. Construcción de Producción del Frontend
Compila la interfaz de usuario en archivos listos para producción.
```bash
npm run build
```
* **Descripción**: Ejecuta el bundle y compilación optimizada del frontend de React/Vite, dejando los archivos estáticos en la carpeta `/public` de la raíz del proyecto.

### 3. Ejecución en Producción
Compila el frontend y levanta la aplicación en modo producción lista para usar.
```bash
npm run prod
```
* **Descripción**: Ejecuta primero la compilación (`npm run build`) y posteriormente inicia el servidor Fastify (`node src/server.js`) **sin** `NODE_ENV=development`, por lo que sirve directamente los archivos estáticos de `/public` sin proxy hacia Vite. Todo se sirve desde `http://localhost:3000`.

* **Arquitectura de archivos en producción**:
  ```
  http://localhost:3000  (Fastify — servidor único)
      │
      ├── /api/*    →  Manejado por el backend
      ├── /TXT/*    →  Archivos de tablaturas
      └── /*        →  Archivos estáticos de /public (build de Vite)
                        index.html para rutas del cliente (SPA)
  ```

## Para crear un backup de la base de datos
pg_dump -h localhost -p 5432 -U postgres -d la_cuerda_offline_db -Fc -v > backup_lacuerda.dump

## Para restaurar la base de datos desde un backup
pg_restore -h localhost -p 5432 -U postgres -d la_cuerda_offline_db -v backup_lacuerda.dump

---

## 🐳 Levantar el Proyecto con Docker

Este proyecto incluye soporte completo para Docker y Docker Compose para facilitar su despliegue y administración de dependencias (Node, PostgreSQL).

### 1. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto para definir los valores de configuración. Puedes basarte en el archivo `.env.example`:

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `DB_HOST` | Host de la base de datos. En Docker Compose se usa `postgres` | `postgres` |
| `DB_PORT` | Puerto de conexión a PostgreSQL | `5432` |
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | `postgres` |
| `DB_NAME` | Nombre de la base de datos | `la_cuerda_offline_db` |
| `APP_PORT` | Puerto en tu máquina local para acceder a la aplicación web | `3000` |

### 2. Comandos para Levantar la Aplicación
Ejecuta los siguientes comandos desde el directorio raíz del proyecto:

* **Levantar la aplicación por primera vez o reconstruyendo cambios**:
  ```bash
  docker compose up --build -d
  ```
* **Levantar la aplicación en segundo plano**:
  ```bash
  docker compose up -d
  ```
* **Ver logs del sistema**:
  ```bash
  docker compose logs -f
  ```
* **Detener los contenedores sin borrar los datos**:
  ```bash
  docker compose down
  ```
* **Detener los contenedores borrando volúmenes (¡Reinicia la DB!)**:
  ```bash
  docker compose down -v
  ```

Una vez levantado, puedes acceder a la interfaz web en `http://localhost:3000` (o el puerto configurado en `APP_PORT`).

---

## 🗄️ Importar y Exportar la Base de Datos (PostgreSQL Dump)

### A) En una máquina normal (Local)
Ejecuta estos comandos en la terminal de tu máquina si tienes instalado `postgresql-client` localmente:

* **Exportar (Crear Backup)**:
  ```bash
  pg_dump -h localhost -p 5432 -U postgres -d la_cuerda_offline_db -Fc -v > backup_lacuerda.dump
  ```
* **Importar (Restaurar Backup)**:
  ```bash
  pg_restore -h localhost -p 5432 -U postgres -d la_cuerda_offline_db -v backup_lacuerda.dump
  ```

### B) Usando contenedores de Docker
Si la base de datos corre dentro de Docker pero no tienes PostgreSQL instalado en tu host local, puedes ejecutar los comandos directamente interactuando con el contenedor de Docker:

* **Exportar (Crear Backup)**:
  ```bash
  docker exec -t lacuerda_db pg_dump -U postgres -d la_cuerda_offline_db -Fc > backup_lacuerda.dump
  ```
  *(Este comando genera el archivo `backup_lacuerda.dump` directamente en el directorio actual de tu máquina host).*

* **Importar (Restaurar Backup)**:
  1. Copia el archivo dump dentro del contenedor temporalmente:
     ```bash
     docker cp backup_lacuerda.dump lacuerda_db:/tmp/backup_lacuerda.dump
     ```
  2. Ejecuta la restauración dentro del contenedor:
     ```bash
     docker exec -it lacuerda_db pg_restore -U postgres -d la_cuerda_offline_db -v /tmp/backup_lacuerda.dump
     ```
  3. (Opcional) Borra el archivo temporal del contenedor:
     ```bash
     docker exec -it lacuerda_db rm /tmp/backup_lacuerda.dump
     ```