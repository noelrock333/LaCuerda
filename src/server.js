import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { ChordsDatabase, slugify } from './database.js';

// Resolver directorios en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar configuración
const configPath = path.resolve('config.json');
if (!fs.existsSync(configPath)) {
  console.error('[ERROR] No se encontró config.json. Ejecuta la inicialización primero.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Inicializar la base de datos
const db = new ChordsDatabase(config.postgres);

// Inicializar Fastify con logs estándar
const fastify = Fastify({
  logger: true
});

// Registrar plugin estático para servir el frontend desde /public
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/'
});

/**
 * Helper para obtener el slug de una canción a partir de su URL de origen.
 * e.g. https://acordes.lacuerda.net/mon_laferte/tu_falta_de_querer-5.shtml -> tu_falta_de_querer
 */
function getSongSlug(sourceUrl) {
  const parts = sourceUrl.split('/');
  const lastPart = parts[parts.length - 1];
  return lastPart.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
}

// ==========================================================================
// ENDPOINTS DE LA API REST
// ==========================================================================

// 1. Buscador en la portada (dos columnas: artistas y canciones)
// GET /api/search?q=mon
fastify.get('/api/search', async (request, reply) => {
  const { q } = request.query;
  try {
    const results = await db.searchArtistsAndSongs(q);
    return results;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al buscar en la base de datos' });
  }
});

// 1.2. Obtener catálogo agrupado de todos los artistas y canciones
// GET /api/songs/grouped-by-artist
fastify.get('/api/songs/grouped-by-artist', async (request, reply) => {
  try {
    const allSongs = await db.getAllSongs();
    
    const grouped = {};
    allSongs.forEach(song => {
      const artistName = song.artist;
      const artistSlug = slugify(artistName);
      const songTitle = song.title;
      const songSlug = getSongSlug(song.source_url);

      if (!grouped[artistSlug]) {
        grouped[artistSlug] = {
          artist: artistName,
          artistSlug: artistSlug,
          songs: {}
        };
      }

      if (!grouped[artistSlug].songs[songSlug]) {
        grouped[artistSlug].songs[songSlug] = {
          title: songTitle,
          songSlug: songSlug,
          versionsCount: 0
        };
      }
      grouped[artistSlug].songs[songSlug].versionsCount++;
    });

    const result = Object.values(grouped).map(artistGroup => {
      return {
        artist: artistGroup.artist,
        artistSlug: artistGroup.artistSlug,
        songs: Object.values(artistGroup.songs).sort((a, b) => a.title.localeCompare(b.title))
      };
    }).sort((a, b) => a.artist.localeCompare(b.artist));

    return result;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al recuperar catálogo agrupado' });
  }
});

// 1.5. Obtener lista de artistas por letra inicial (paginado de 50 en 50)
// GET /api/artists/by-letter/:letter?page=1
fastify.get('/api/artists/by-letter/:letter', async (request, reply) => {
  const { letter } = request.params;
  const page = parseInt(request.query.page || 1, 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  try {
    const { artists, total } = await db.getArtistsByLetter(letter, limit, offset);
    return {
      letter,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      artists
    };
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al recuperar artistas por letra' });
  }
});

// 2. Obtener catálogo agrupado de canciones de un artista por su slug
// GET /api/artists/mon_laferte
fastify.get('/api/artists/:artistSlug', async (request, reply) => {
  const { artistSlug } = request.params;
  try {
    const songs = await db.getSongsByArtistSlug(artistSlug);
    const artistName = await db.getArtistNameBySlug(artistSlug);
    
    if (!artistName) {
      return reply.status(404).send({ error: 'Artista no encontrado' });
    }

    // Agrupar las versiones físicas de la base de datos bajo un nombre de canción único
    const songGroups = {};
    songs.forEach(song => {
      const slug = getSongSlug(song.source_url);
      if (!songGroups[slug]) {
        songGroups[slug] = {
          title: song.title,
          slug: slug,
          versions: []
        };
      }
      songGroups[slug].versions.push({
        id: song.id,
        version_number: song.version_number,
        type: song.type,
        contributor: song.contributor,
        chords: song.chords
      });
    });

    return {
      artist: artistName,
      slug: artistSlug,
      songs: Object.values(songGroups)
    };
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al recuperar artista' });
  }
});

// 3. Obtener listado de versiones de una canción
// GET /api/songs/mon_laferte/tu_falta_de_querer
fastify.get('/api/songs/:artistSlug/:songSlug', async (request, reply) => {
  const { artistSlug, songSlug } = request.params;
  try {
    const songs = await db.getSongsByArtistSlug(artistSlug);
    const artistName = await db.getArtistNameBySlug(artistSlug);
    
    if (!artistName) {
      return reply.status(404).send({ error: 'Artista no encontrado' });
    }

    // Filtrar canciones de este artista que coincidan con el slug de canción
    const filtered = songs.filter(song => getSongSlug(song.source_url) === songSlug);
    if (filtered.length === 0) {
      return reply.status(404).send({ error: 'Canción no encontrada' });
    }

    return {
      artist: artistName,
      title: filtered[0].title,
      slug: songSlug,
      versions: filtered.map(song => ({
        id: song.id,
        version_number: song.version_number,
        type: song.type,
        contributor: song.contributor,
        chords: song.chords,
        content: song.content,
        is_best: song.is_best || false,
        source_url: song.source_url,
        archive_url: song.archive_url
      }))
    };
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al recuperar canción' });
  }
});

// 4. Obtener el contenido de una versión específica usando el slug clásico
// GET /api/version/mon_laferte/tu_falta_de_querer-5.shtml
// GET /api/version/mon_laferte/tu_falta_de_querer-5
// GET /api/version/mon_laferte/mi_buen_amor.shtml (version 1 por defecto)
fastify.get('/api/version/:artistSlug/:versionSlug', async (request, reply) => {
  const { artistSlug, versionSlug } = request.params;
  try {
    const songs = await db.getSongsByArtistSlug(artistSlug);
    const artistName = await db.getArtistNameBySlug(artistSlug);
    
    if (!artistName) {
      return reply.status(404).send({ error: 'Artista no encontrado' });
    }

    // Quitar .shtml si existe
    const cleanSlug = versionSlug.replace(/\.shtml$/i, '');

    // Desglosar nombre base de canción y número de versión
    let baseSongName = cleanSlug;
    let versionNumber = 1;

    const match = cleanSlug.match(/^(.+)-(\d+)$/);
    if (match) {
      baseSongName = match[1];
      versionNumber = parseInt(match[2], 10);
    }

    // Buscar coincidencia exacta
    const matchSong = songs.find(song => {
      const slug = getSongSlug(song.source_url);
      return slug === baseSongName && song.version_number === versionNumber;
    });

    if (!matchSong) {
      // Intentar fallback a la primera versión disponible de ese tema
      const fallbackSong = songs.find(song => getSongSlug(song.source_url) === baseSongName);
      if (fallbackSong) {
        return fallbackSong;
      }
      return reply.status(404).send({ error: 'Versión no encontrada' });
    }

    return matchSong;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al recuperar versión' });
  }
});

// ==========================================================================
// MÉTODOS DE SEGURIDAD & AUTENTICACIÓN
// ==========================================================================

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'No autorizado: falta token' });
    throw new Error('Unauthorized');
  }

  const token = authHeader.substring(7);
  const session = await db.getSession(token);
  if (!session) {
    reply.status(401).send({ error: 'No autorizado: sesión inválida o expirada' });
    throw new Error('Unauthorized');
  }

  return session.user_id;
}

// ==========================================================================
// ENDPOINTS DE AUTENTICACIÓN
// ==========================================================================

fastify.post('/api/auth/register', async (request, reply) => {
  const { username, password } = request.body || {};
  if (!username || !password) {
    return reply.status(400).send({ error: 'Usuario y contraseña son requeridos' });
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 3) {
    return reply.status(400).send({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
  }

  try {
    const existingUser = await db.getUserByUsername(cleanUsername);
    if (existingUser) {
      return reply.status(400).send({ error: 'El nombre de usuario ya está registrado' });
    }

    const passwordHash = hashPassword(password);
    const user = await db.createUser(cleanUsername, passwordHash);

    // Crear sesión automática al registrarse
    const token = crypto.randomUUID();
    await db.createSession(token, user.id);

    return { token, user: { id: user.id, username: user.username } };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al registrar el usuario' });
  }
});

fastify.post('/api/auth/login', async (request, reply) => {
  const { username, password } = request.body || {};
  if (!username || !password) {
    return reply.status(400).send({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const user = await db.getUserByUsername(username.trim());
    if (!user) {
      return reply.status(400).send({ error: 'Credenciales inválidas' });
    }

    const isMatch = verifyPassword(password, user.password);
    if (!isMatch) {
      return reply.status(400).send({ error: 'Credenciales inválidas' });
    }

    const token = crypto.randomUUID();
    await db.createSession(token, user.id);

    return { token, user: { id: user.id, username: user.username } };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al iniciar sesión' });
  }
});

fastify.post('/api/auth/logout', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      await db.deleteSession(token);
    } catch (error) {
      fastify.log.error(error);
    }
  }
  return { success: true };
});

fastify.get('/api/auth/me', async (request, reply) => {
  try {
    const userId = await authenticate(request, reply);
    const result = await db.db.execute(sql`SELECT id, username FROM users WHERE id = ${userId} LIMIT 1`);
    const user = result.rows[0];
    if (!user) {
      return reply.status(404).send({ error: 'Usuario no encontrado' });
    }
    return { user: { id: user.id, username: user.username } };
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al validar sesión' });
  }
});

// ==========================================================================
// ENDPOINTS DE FAVORITOS
// ==========================================================================

fastify.get('/api/favorites', async (request, reply) => {
  try {
    const userId = await authenticate(request, reply);
    const list = await db.getFavorites(userId);
    return list;
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al recuperar favoritos' });
  }
});

fastify.post('/api/favorites', async (request, reply) => {
  const { song_id } = request.body || {};
  if (!song_id) {
    return reply.status(400).send({ error: 'ID de versión (song_id) es requerido' });
  }

  try {
    const userId = await authenticate(request, reply);
    await db.addFavorite(userId, song_id);
    return { success: true };
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al agregar favorito' });
  }
});

fastify.delete('/api/favorites/:songId', async (request, reply) => {
  const songId = parseInt(request.params.songId, 10);
  if (isNaN(songId)) {
    return reply.status(400).send({ error: 'ID de versión inválido' });
  }

  try {
    const userId = await authenticate(request, reply);
    await db.removeFavorite(userId, songId);
    return { success: true };
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Error al eliminar favorito' });
  }
});

fastify.get('/api/favorites/status/:songId', async (request, reply) => {
  const songId = parseInt(request.params.songId, 10);
  if (isNaN(songId)) {
    return reply.status(400).send({ error: 'ID de versión inválido' });
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isFavorite: false };
  }

  const token = authHeader.substring(7);
  try {
    const session = await db.getSession(token);
    if (!session) {
      return { isFavorite: false };
    }
    const isFav = await db.isFavorite(session.user_id, songId);
    return { isFavorite: isFav };
  } catch (error) {
    fastify.log.error(error);
    return { isFavorite: false };
  }
});

// ==========================================================================
// SPA ROUTER: ENRUTAMIENTO CATCH-ALL
// ==========================================================================

// Cualquier ruta que no coincida con archivos estáticos o endpoints API
// servirá el shell 'index.html' para permitir que el router del cliente maneje la ruta.
fastify.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    reply.status(404).send({ error: 'Endpoint API no encontrado' });
    return;
  }
  
  return reply.sendFile('index.html');
});

// Hook de cierre para liberar la conexión PostgreSQL limpiamente
fastify.addHook('onClose', async (instance) => {
  fastify.log.info('Cerrando conexión de base de datos...');
  await db.close();
});

// Iniciar servidor en el puerto 3000
const start = async () => {
  try {
    await db.init();
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('\n==================================================');
    console.log('  VISUALIZADOR INICIADO CORRECTAMENTE             ');
    console.log('  Abre tu navegador en: http://localhost:3000    ');
    console.log('==================================================\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
