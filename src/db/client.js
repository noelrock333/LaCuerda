import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql, or, and } from 'drizzle-orm';
import pg from 'pg';
import { songs, users, sessions, favorites, failedUrls } from './schema.js';
import { slugify, getSongSlug, getArtistSlugFromSourceUrl } from '../utils/slugify.js';

const { Pool } = pg;

export class ChordsDatabase {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.db = null;
  }

  /**
   * Inicializa la conexión a la base de datos PostgreSQL y crea las tablas si no existen.
   */
  async init() {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database
    });

    this.db = drizzle(this.pool);

    // Habilitar la extensión unaccent para búsquedas sin acentos
    await this.db.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent`);

    // Asegurarse de que la tabla exista
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        artist VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        version_number INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        chords TEXT,
        contributor VARCHAR(255) DEFAULT 'Colaborador',
        content TEXT NOT NULL,
        source_url VARCHAR(512) UNIQUE NOT NULL,
        archive_url VARCHAR(512) NOT NULL,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear índice para búsquedas rápidas por artista/título
    await this.db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_songs_artist_title ON songs (artist, title)
    `);

    // Añadir columna is_best si no existe (migración en caliente)
    await this.db.execute(sql`
      ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_best BOOLEAN DEFAULT FALSE
    `);

    // Añadir columnas de metadatos complementarios e información del colaborador
    await this.db.execute(sql`
      ALTER TABLE songs 
      ADD COLUMN IF NOT EXISTS song_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS album VARCHAR(255),
      ADD COLUMN IF NOT EXISTS year INTEGER,
      ADD COLUMN IF NOT EXISTS composers VARCHAR(512),
      ADD COLUMN IF NOT EXISTS contributor_id VARCHAR(100)
    `);

    // Crear tabla users
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Añadir columna de rol si no existe (migración en caliente)
    await this.db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
    `);

    // Crear tabla sessions
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear tabla failed_urls para registrar errores de crawling
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS failed_urls (
        id SERIAL PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        error_message TEXT,
        failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        resolved BOOLEAN DEFAULT FALSE
      )
    `);

    // Crear tabla favorites
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_song UNIQUE (user_id, song_id)
      )
    `);

    // Añadir columna is_awesome si no existe (migración en caliente)
    await this.db.execute(sql`
      ALTER TABLE favorites ADD COLUMN IF NOT EXISTS is_awesome BOOLEAN DEFAULT FALSE
    `);
  }

  /**
   * Verifica si una URL original ya ha sido descargada e insertada en la base de datos.
   */
  async isSongDownloaded(sourceUrl) {
    const result = await this.db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.source_url, sourceUrl))
      .limit(1);
    return result.length > 0;
  }

  /**
   * Guarda o actualiza una canción en la base de datos.
   */
  async saveSong(song) {
    await this.db
      .insert(songs)
      .values({
        artist: song.artist,
        title: song.title,
        version_number: song.version_number,
        type: song.type,
        chords: song.chords,
        contributor: song.contributor || 'Colaborador',
        content: song.content,
        source_url: song.source_url,
        archive_url: song.archive_url,
        is_best: song.is_best || false,
        song_code: song.song_code || null,
        album: song.album || null,
        year: song.year || null,
        composers: song.composers || null,
        contributor_id: song.contributor_id || null
      })
      .onConflictDoUpdate({
        target: songs.source_url,
        set: {
          artist: song.artist,
          title: song.title,
          version_number: song.version_number,
          type: song.type,
          chords: song.chords,
          contributor: song.contributor || 'Colaborador',
          content: song.content,
          archive_url: song.archive_url,
          is_best: song.is_best || false,
          scraped_at: sql`CURRENT_TIMESTAMP`,
          song_code: song.song_code || null,
          album: song.album || null,
          year: song.year || null,
          composers: song.composers || null,
          contributor_id: song.contributor_id || null
        }
      });
  }

  /**
   * Obtiene todas las canciones guardadas.
   */
  async getAllSongs() {
    return await this.db
      .select()
      .from(songs)
      .orderBy(songs.artist, songs.title, songs.version_number);
  }

  /**
   * Resuelve el nombre del artista a partir de un slug de ruta (nombre o segmento URL).
   */
  async resolveArtistNameBySlug(artistSlug) {
    const allArtistsResult = await this.db
      .select({ artist: songs.artist })
      .from(songs);

    const uniqueArtists = Array.from(new Set(allArtistsResult.map((row) => row.artist)));

    const byName = uniqueArtists.find((artist) => slugify(artist) === artistSlug);
    if (byName) return byName;

    const urlRows = await this.db
      .select({ artist: songs.artist, source_url: songs.source_url })
      .from(songs);

    for (const row of urlRows) {
      if (getArtistSlugFromSourceUrl(row.source_url) === artistSlug) {
        return row.artist;
      }
    }

    return null;
  }

  /**
   * Obtiene todas las canciones guardadas de un artista a partir de su slug.
   */
  async getSongsByArtistSlug(artistSlug) {
    const matchedArtist = await this.resolveArtistNameBySlug(artistSlug);
    if (!matchedArtist) return [];

    return await this.db
      .select()
      .from(songs)
      .where(eq(songs.artist, matchedArtist))
      .orderBy(songs.title, songs.version_number);
  }

  /**
   * Comprueba si ya existen versiones locales guardadas para un tema.
   */
  async hasSongVersions(artistSlug, songSlug) {
    const songsList = await this.getSongsByArtistSlug(artistSlug);
    return songsList.some(song => {
      const parts = song.source_url.split('/');
      const lastPart = parts[parts.length - 1];
      const currentSlug = lastPart.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
      return currentSlug === songSlug;
    });
  }

  /**
   * Resuelve el nombre del artista original a partir de su slug.
   */
  async getArtistNameBySlug(artistSlug) {
    return await this.resolveArtistNameBySlug(artistSlug);
  }

  /**
   * Busca artistas y canciones de forma independiente (búsqueda en dos columnas).
   */
  async searchArtistsAndSongs(query) {
    if (!query || query.trim() === '') {
      return { artists: [], songs: [] };
    }

    // Separar en palabras normalizadas (alfanuméricas y sin acentos)
    const cleanWords = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 0);

    if (cleanWords.length === 0) {
      return { artists: [], songs: [] };
    }

    // Generar condiciones: todas las palabras buscadas deben coincidir parcial o totalmente
    const songConditions = cleanWords.map(word => {
      const pattern = `%${word}%`;
      return or(
        sql`regexp_replace(lower(unaccent(${songs.title})), '[^a-z0-9]', '', 'g') LIKE ${pattern}`,
        sql`regexp_replace(lower(unaccent(${songs.artist})), '[^a-z0-9]', '', 'g') LIKE ${pattern}`
      );
    });

    const artistConditions = cleanWords.map(word => {
      const pattern = `%${word}%`;
      return sql`regexp_replace(lower(unaccent(${songs.artist})), '[^a-z0-9]', '', 'g') LIKE ${pattern}`;
    });

    // 1. Encontrar canciones únicas usando DISTINCT ON
    const songsResult = await this.db
      .selectDistinctOn([songs.artist, songs.title], {
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        version_number: songs.version_number,
        type: songs.type,
        chords: songs.chords,
        source_url: songs.source_url
      })
      .from(songs)
      .where(and(...songConditions))
      .orderBy(songs.artist, songs.title, songs.id);

    // 2. Encontrar artistas
    const artistsResult = await this.db
      .select({
        artist: songs.artist
      })
      .from(songs)
      .where(and(...artistConditions))
      .groupBy(songs.artist)
      .orderBy(songs.artist);

    const artists = artistsResult.map(row => ({
      name: row.artist,
      slug: slugify(row.artist)
    }));

    return { artists, songs: songsResult };
  }

  /**
   * Obtiene artistas únicos que comienzan con una letra específica, ordenados alfabéticamente y paginados.
   */
  async getArtistsByLetter(letter, limit = 50, offset = 0) {
    let whereClause;
    const cleanLetter = letter.trim().toUpperCase();

    if (cleanLetter === '0-9' || cleanLetter === 'OTHERS' || cleanLetter === '*') {
      whereClause = sql`artist ~ '^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]'`;
    } else if (cleanLetter.length === 1 && cleanLetter >= 'A' && cleanLetter <= 'Z') {
      let regexPattern = `^[${cleanLetter.toLowerCase()}${cleanLetter.toUpperCase()}`;
      if (cleanLetter === 'A') regexPattern += 'áÁàÀâÂãÃäÄåÅ';
      if (cleanLetter === 'E') regexPattern += 'éÉèÈêÊëË';
      if (cleanLetter === 'I') regexPattern += 'íÍìÌîÎïÏ';
      if (cleanLetter === 'O') regexPattern += 'óÓòÒôÔõÕöÖ';
      if (cleanLetter === 'U') regexPattern += 'úÚùÙûÛüÜ';
      if (cleanLetter === 'N') regexPattern += 'ñÑ';
      regexPattern += ']';
      
      whereClause = sql`artist ~ ${regexPattern}`;
    } else {
      whereClause = sql`true`;
    }

    const totalResult = await this.db
      .select({
        count: sql`count(distinct ${songs.artist})`
      })
      .from(songs)
      .where(whereClause);
    
    const total = parseInt(totalResult[0]?.count || 0, 10);

    const artistsResult = await this.db
      .select({
        artist: songs.artist
      })
      .from(songs)
      .where(whereClause)
      .groupBy(songs.artist)
      .orderBy(songs.artist)
      .limit(limit)
      .offset(offset);

    const artists = artistsResult.map(row => ({
      name: row.artist,
      slug: slugify(row.artist)
    }));

    return { artists, total };
  }

  /**
   * Obtiene una canción específica por su ID.
   */
  async getSongById(id) {
    const result = await this.db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    
    return result[0];
  }

  /**
   * Busca un usuario por su nickname.
   */
  async getUserByUsername(username) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }

  /**
   * Crea un usuario nuevo en la base de datos.
   */
  async createUser(username, hashedPassword) {
    const result = await this.db
      .insert(users)
      .values({ username, password: hashedPassword })
      .returning({ id: users.id, username: users.username, role: users.role });
    return result[0];
  }

  /**
   * Crea una sesión activa de usuario.
   */
  async createSession(token, userId) {
    await this.db
      .insert(sessions)
      .values({ token, user_id: userId });
  }

  /**
   * Obtiene la sesión a partir del token.
   */
  async getSession(token) {
    const result = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);
    return result[0];
  }

  /**
   * Elimina una sesión (logout).
   */
  async deleteSession(token) {
    await this.db
      .delete(sessions)
      .where(eq(sessions.token, token));
  }

  /**
   * Obtiene todas las canciones/versiones favoritas de un usuario.
   */
  async getFavorites(userId) {
    return await this.db
      .select({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        version_number: songs.version_number,
        type: songs.type,
        contributor: songs.contributor,
        source_url: songs.source_url,
        archive_url: songs.archive_url,
        is_best: songs.is_best,
        song_code: songs.song_code,
        album: songs.album,
        year: songs.year,
        composers: songs.composers,
        contributor_id: songs.contributor_id,
        is_awesome: favorites.is_awesome
      })
      .from(favorites)
      .innerJoin(songs, eq(favorites.song_id, songs.id))
      .where(eq(favorites.user_id, userId))
      .orderBy(songs.artist, songs.title, songs.version_number);
  }

  /**
   * Obtiene una versión por su source_url exacta.
   */
  async getSongBySourceUrl(sourceUrl) {
    const result = await this.db
      .select({
        id: songs.id,
        artist: songs.artist,
        title: songs.title,
        version_number: songs.version_number,
        type: songs.type,
        source_url: songs.source_url
      })
      .from(songs)
      .where(eq(songs.source_url, sourceUrl))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Agrega una versión a favoritos.
   * @returns {'added' | 'already_exists'}
   */
  async addFavorite(userId, songId, isAwesome = false) {
    try {
      await this.db
        .insert(favorites)
        .values({ user_id: userId, song_id: songId, is_awesome: isAwesome });
      return 'added';
    } catch (e) {
      if (e.code !== '23505') {
        throw e;
      }
      if (isAwesome) {
        await this.updateFavoriteAwesome(userId, songId, true);
      }
      return 'already_exists';
    }
  }

  /**
   * Elimina una versión de favoritos.
   */
  async removeFavorite(userId, songId) {
    await this.db
      .delete(favorites)
      .where(and(eq(favorites.user_id, userId), eq(favorites.song_id, songId)));
  }

  /**
   * Comprueba si una versión ya es favorita del usuario.
   */
  async isFavorite(userId, songId) {
    const result = await this.db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.user_id, userId), eq(favorites.song_id, songId)))
      .limit(1);
    return result.length > 0;
  }

  /**
   * Obtiene el registro de favorito con su estado awesome completo.
   */
  async getFavoriteRecord(userId, songId) {
    const result = await this.db
      .select({ id: favorites.id, is_awesome: favorites.is_awesome })
      .from(favorites)
      .where(and(eq(favorites.user_id, userId), eq(favorites.song_id, songId)))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Actualiza el estado awesome (chida) de una versión favorita.
   */
  async updateFavoriteAwesome(userId, songId, isAwesome) {
    await this.db
      .update(favorites)
      .set({ is_awesome: isAwesome })
      .where(and(eq(favorites.user_id, userId), eq(favorites.song_id, songId)));
  }

  /**
   * Registra una URL fallida durante el crawling (o incrementa su contador de reintentos).
   */
  async recordFailedUrl(url, errorMessage) {
    await this.db.execute(sql`
      INSERT INTO failed_urls (url, error_message, retry_count, resolved)
      VALUES (${url}, ${errorMessage}, 1, FALSE)
      ON CONFLICT (url) DO UPDATE
        SET error_message = ${errorMessage},
            failed_at = CURRENT_TIMESTAMP,
            retry_count = failed_urls.retry_count + 1,
            resolved = FALSE
    `);
  }

  /**
   * Obtiene todas las URLs fallidas pendientes de reintentar.
   */
  async getFailedUrls(includeResolved = false) {
    if (includeResolved) {
      return await this.db.select().from(failedUrls).orderBy(failedUrls.failed_at);
    }
    return await this.db
      .select()
      .from(failedUrls)
      .where(eq(failedUrls.resolved, false))
      .orderBy(failedUrls.failed_at);
  }

  /**
   * Marca una URL fallida como resuelta exitosamente.
   */
  async markFailedUrlResolved(url) {
    await this.db
      .update(failedUrls)
      .set({ resolved: true })
      .where(eq(failedUrls.url, url));
  }

  /**
   * Cierra la conexión de la base de datos.
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.db = null;
    }
  }
}
