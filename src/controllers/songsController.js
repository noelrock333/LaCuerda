import { SongsService } from '../services/songsService.js';

export class SongsController {
  static async search(request, reply) {
    const { q } = request.query;
    try {
      const results = await SongsService.search(q);
      return results;
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Error al buscar en la base de datos' });
    }
  }

  static async getGroupedByArtist(request, reply) {
    try {
      const result = await SongsService.getGroupedByArtist();
      return result;
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Error al recuperar catálogo agrupado' });
    }
  }

  static async getArtistDetail(request, reply) {
    const { artistSlug } = request.params;
    try {
      const result = await SongsService.getArtistBySlug(artistSlug);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al recuperar artista' });
    }
  }


  static async getSongDetail(request, reply) {
    const { artistSlug, songSlug } = request.params;
    try {
      const result = await SongsService.getSongDetail(artistSlug, songSlug);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al recuperar canción' });
    }
  }

  static async getVersionDetail(request, reply) {
    const { artistSlug, versionSlug } = request.params;
    try {
      const result = await SongsService.getVersionDetail(artistSlug, versionSlug);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al recuperar versión' });
    }
  }

  static async updateVersion(request, reply) {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'ID inválido' });
    }

    try {
      const result = await SongsService.updateVersion(id, request.body);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al actualizar la versión' });
    }
  }

  static async getVersionTxt(request, reply) {
    const { artistSlug, versionSlug } = request.params;
    try {
      const txtContent = await SongsService.getVersionTxt(artistSlug, versionSlug);
      return reply
        .type('text/plain; charset=utf-8')
        .send(txtContent);
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send(error.message || 'Error al recuperar versión en formato texto plano');
    }
  }
}
