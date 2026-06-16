import { FavoritesService } from '../services/favoritesService.js';
import { db } from '../db/index.js';

export class FavoritesController {
  static async getFavorites(request, reply) {
    try {
      const result = await FavoritesService.getFavorites(request.userId);
      return result;
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Error al recuperar favoritos' });
    }
  }

  static async addFavorite(request, reply) {
    const { song_id } = request.body || {};
    try {
      const result = await FavoritesService.addFavorite(request.userId, song_id);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al agregar favorito' });
    }
  }

  static async removeFavorite(request, reply) {
    const songId = parseInt(request.params.songId, 10);
    try {
      const result = await FavoritesService.removeFavorite(request.userId, songId);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al eliminar favorito' });
    }
  }

  static async getFavoriteStatus(request, reply) {
    const songId = parseInt(request.params.songId, 10);
    
    // Si no está autenticado, devolvemos isFavorite: false de inmediato
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isFavorite: false, isAwesome: false };
    }

    const token = authHeader.substring(7);
    try {
      const session = await db.getSession(token);
      const userId = session ? session.user_id : null;
      const result = await FavoritesService.getFavoriteStatus(userId, songId);
      return result;
    } catch (error) {
      request.log.error(error);
      return { isFavorite: false, isAwesome: false };
    }
  }

  static async updateFavoriteAwesome(request, reply) {
    const songId = parseInt(request.params.songId, 10);
    const { is_awesome } = request.body || {};
    try {
      const result = await FavoritesService.updateFavoriteAwesome(request.userId, songId, is_awesome);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al actualizar estado awesome' });
    }
  }
}
