import { db } from '../db/index.js';

export class FavoritesService {
  static async getFavorites(userId) {
    return await db.getFavorites(userId);
  }

  static async addFavorite(userId, songId) {
    if (!songId) {
      throw { status: 400, message: 'ID de versión (song_id) es requerido' };
    }
    await db.addFavorite(userId, songId);
    return { success: true };
  }

  static async removeFavorite(userId, songId) {
    if (isNaN(songId)) {
      throw { status: 400, message: 'ID de versión inválido' };
    }
    await db.removeFavorite(userId, songId);
    return { success: true };
  }

  static async getFavoriteStatus(userId, songId) {
    if (isNaN(songId)) {
      throw { status: 400, message: 'ID de versión inválido' };
    }

    if (!userId) {
      return { isFavorite: false, isAwesome: false };
    }

    const favRecord = await db.getFavoriteRecord(userId, songId);
    return {
      isFavorite: !!favRecord,
      isAwesome: favRecord ? favRecord.is_awesome : false
    };
  }

  static async updateFavoriteAwesome(userId, songId, isAwesome) {
    if (isNaN(songId)) {
      throw { status: 400, message: 'ID de versión inválido' };
    }
    await db.updateFavoriteAwesome(userId, songId, isAwesome);
    return { success: true, is_awesome: isAwesome };
  }
}
