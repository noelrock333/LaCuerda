import { SongsService } from '../services/songsService.js';

export class ArtistsController {
  static async getArtistsByLetter(request, reply) {
    const { letter } = request.params;
    const page = parseInt(request.query.page || 1, 10);
    try {
      const result = await SongsService.getArtistsByLetter(letter, page);
      return result;
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Error al recuperar artistas por letra' });
    }
  }
}
