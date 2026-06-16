import { FavoritesController } from '../../controllers/favoritesController.js';
import { authenticate } from '../../hooks/authHook.js';

export default async function favoritesRoutes(fastify, options) {
  fastify.get('/favorites', { preHandler: authenticate }, FavoritesController.getFavorites);
  fastify.post('/favorites', { preHandler: authenticate }, FavoritesController.addFavorite);
  fastify.delete('/favorites/:songId', { preHandler: authenticate }, FavoritesController.removeFavorite);
  
  // No requiere preHandler global de auth porque devuelve un estado por defecto si no hay token
  fastify.get('/favorites/status/:songId', FavoritesController.getFavoriteStatus);
  
  fastify.put('/favorites/awesome/:songId', { preHandler: authenticate }, FavoritesController.updateFavoriteAwesome);
}
