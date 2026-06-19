import { SongsController } from '../../controllers/songsController.js';
import { authenticateAdminOrMod } from '../../hooks/authHook.js';

export default async function songsRoutes(fastify, options) {
  fastify.get('/search', SongsController.search);
  fastify.get('/songs/grouped-by-artist', SongsController.getGroupedByArtist);
  fastify.get('/songs/:artistSlug/:songSlug', SongsController.getSongDetail);
  fastify.get('/version/:artistSlug/:versionSlug', SongsController.getVersionDetail);
  fastify.put('/version/:id', { preHandler: authenticateAdminOrMod }, SongsController.updateVersion);

  fastify.post('/songs/import', {
    preHandler: authenticateAdminOrMod,
    config: { timeout: 120000 }
  }, SongsController.importSong);

  fastify.post('/songs/auto-import', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
      timeout: 30000
    }
  }, SongsController.autoImport);
}
