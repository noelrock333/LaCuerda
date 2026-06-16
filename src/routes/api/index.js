import authRoutes from './auth.js';
import songsRoutes from './songs.js';
import favoritesRoutes from './favorites.js';
import artistsRoutes from './artists.js';

export default async function apiRoutes(fastify, options) {
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(songsRoutes);
  fastify.register(favoritesRoutes);
  fastify.register(artistsRoutes);
}
