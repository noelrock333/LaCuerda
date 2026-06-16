import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function staticRoutes(fastify, options) {
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../public'),
    prefix: '/'
  });

  // Cualquier ruta que no coincida con archivos estáticos o endpoints API
  // servirá el shell 'index.html' para permitir que el router del cliente maneje la ruta.
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/TXT/')) {
      reply.status(404).send('No encontrado / Not Found');
      return;
    }
    
    return reply.sendFile('index.html');
  });
}
