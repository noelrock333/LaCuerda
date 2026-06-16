import apiRoutes from './api/index.js';
import staticRoutes from './static.js';
import { SongsController } from '../controllers/songsController.js';

export default async function routes(fastify, options) {
  // Registrar las rutas de la API bajo el prefijo /api
  fastify.register(apiRoutes, { prefix: '/api' });
  
  // Registrar la ruta TXT (que es una ruta de texto plano de nivel superior)
  fastify.get('/TXT/:artistSlug/:versionSlug', SongsController.getVersionTxt);
  
  // Registrar el servicio estático (debe ser el último para no interferir con las rutas dinámicas)
  fastify.register(staticRoutes);
}
