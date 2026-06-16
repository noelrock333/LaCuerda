import { SongsController } from '../../controllers/songsController.js';
import { authenticateAdminOrMod } from '../../hooks/authHook.js';

export default async function songsRoutes(fastify, options) {
  fastify.get('/search', SongsController.search);
  fastify.get('/songs/grouped-by-artist', SongsController.getGroupedByArtist);
  fastify.get('/songs/:artistSlug/:songSlug', SongsController.getSongDetail);
  fastify.get('/version/:artistSlug/:versionSlug', SongsController.getVersionDetail);
  fastify.put('/version/:id', { preHandler: authenticateAdminOrMod }, SongsController.updateVersion);
}
