import { ArtistsController } from '../../controllers/artistsController.js';
import { SongsController } from '../../controllers/songsController.js';

export default async function artistsRoutes(fastify, options) {
  fastify.get('/artists/by-letter/:letter', ArtistsController.getArtistsByLetter);
  fastify.get('/artists/:artistSlug', SongsController.getArtistDetail);
}
