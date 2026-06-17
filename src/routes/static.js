import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_URL = 'http://localhost:5173';

export default async function staticRoutes(fastify, options) {
  if (isDev) {
    // En modo desarrollo, reenviar todas las peticiones de HTML al servidor de Vite
    // que tiene HMR. Las rutas de API (/api, /TXT) las maneja el propio Fastify.
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/TXT/')) {
        reply.status(404).send('No encontrado / Not Found');
        return;
      }

      // Proxy transparente hacia el Vite dev server
      try {
        const targetUrl = `${VITE_DEV_URL}${request.url}`;
        const viteResponse = await fetch(targetUrl, {
          method: request.method,
          headers: { ...request.headers, host: 'localhost:5173' },
        });

        const contentType = viteResponse.headers.get('content-type') || '';
        reply.status(viteResponse.status);
        reply.header('content-type', contentType);

        // Para activos binarios (JS, CSS, imágenes) transmitir el buffer
        const body = await viteResponse.arrayBuffer();
        reply.send(Buffer.from(body));
      } catch (err) {
        // Si Vite no está corriendo, mostrar un mensaje claro
        reply
          .status(503)
          .type('text/html')
          .send(`
            <html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:#eee">
              <h2>⚠️ Vite dev server no disponible</h2>
              <p>Asegúrate de que el frontend esté corriendo en <code>${VITE_DEV_URL}</code></p>
              <p>Error: <code>${err.message}</code></p>
              <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;cursor:pointer">Reintentar</button>
            </body></html>
          `);
      }
    });

  } else {
    // En producción, servir el build estático de /public
    fastify.register(fastifyStatic, {
      root: path.join(__dirname, '../../public'),
      prefix: '/'
    });

    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/TXT/')) {
        reply.status(404).send('No encontrado / Not Found');
        return;
      }
      return reply.sendFile('index.html');
    });
  }
}
