import { pgTable, serial, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql, ilike, or } from 'drizzle-orm';
import pg from 'pg';

const { Pool } = pg;

/**
 * Convierte un texto en un slug amigable de URL al estilo de LaCuerda.net.
 * Ej. "Mon Laferte" -> "mon_laferte"
 * @param {string} text 
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD') // Quitar acentos y caracteres especiales
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_') // Reemplazar caracteres no alfanuméricos por guion bajo
    .replace(/^_+|_+$/g, ''); // Quitar guiones bajos sobrantes al inicio/final
}

// Definir el esquema de la tabla utilizando nombres de propiedad en snake_case 
// para asegurar compatibilidad total con el código existente.
export const songs = pgTable('songs', {
  id: serial('id').primaryKey(),
  artist: text('artist').notNull(),
  title: text('title').notNull(),
  version_number: integer('version_number').notNull(),
  type: text('type').notNull(),
  chords: text('chords'),
  contributor: text('contributor').default('Colaborador'),
  content: text('content').notNull(),
  source_url: text('source_url').notNull().unique(),
  archive_url: text('archive_url').notNull(),
  is_best: boolean('is_best').default(false),
  scraped_at: timestamp('scraped_at').defaultNow()
});

export class ChordsDatabase {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.db = null;
  }

  /**
   * Inicializa la conexión a la base de datos PostgreSQL y crea la tabla si no existe.
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
  }

  /**
   * Verifica si una URL original ya ha sido descargada e insertada en la base de datos.
   * @param {string} sourceUrl URL original de LaCuerda
   * @returns {Promise<boolean>}
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
   * @param {Object} song Datos de la canción
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
        is_best: song.is_best || false
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
          scraped_at: sql`CURRENT_TIMESTAMP`
        }
      });
  }

  /**
   * Obtiene todas las canciones guardadas.
   * @returns {Promise<Array<Object>>}
   */
  async getAllSongs() {
    return await this.db
      .select()
      .from(songs)
      .orderBy(songs.artist, songs.title, songs.version_number);
  }

  /**
   * Obtiene todas las canciones guardadas de un artista a partir de su slug.
   * @param {string} artistSlug Slug del artista (ej: mon_laferte)
   * @returns {Promise<Array<Object>>}
   */
  async getSongsByArtistSlug(artistSlug) {
    const allArtistsResult = await this.db
      .select({ artist: songs.artist })
      .from(songs);
    
    const uniqueArtists = Array.from(new Set(allArtistsResult.map(row => row.artist)));
    
    const matchedArtist = uniqueArtists.find(artist => slugify(artist) === artistSlug);
    if (!matchedArtist) return [];

    return await this.db
      .select()
      .from(songs)
      .where(eq(songs.artist, matchedArtist))
      .orderBy(songs.title, songs.version_number);
  }

  /**
   * Comprueba si ya existen versiones locales guardadas para un tema.
   * @param {string} artistSlug Slug del artista
   * @param {string} songSlug Slug del tema
   * @returns {Promise<boolean>}
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
   * @param {string} artistSlug 
   * @returns {Promise<string|null>}
   */
  async getArtistNameBySlug(artistSlug) {
    const allArtistsResult = await this.db
      .select({ artist: songs.artist })
      .from(songs);
    
    const uniqueArtists = Array.from(new Set(allArtistsResult.map(row => row.artist)));
    return uniqueArtists.find(artist => slugify(artist) === artistSlug) || null;
  }

  /**
   * Busca artistas y canciones de forma independiente (búsqueda en dos columnas).
   * @param {string} query Parámetro de búsqueda
   * @returns {Promise<{artists: Array<{name: string, slug: string}>, songs: Array<Object>}>}
   */
  async searchArtistsAndSongs(query) {
    if (!query || query.trim() === '') {
      return { artists: [], songs: [] };
    }
    
    const searchPattern = `%${query.trim()}%`;

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
      .where(or(ilike(songs.title, searchPattern), ilike(songs.artist, searchPattern)))
      .orderBy(songs.artist, songs.title, songs.id);

    // 2. Encontrar artistas
    const artistsResult = await this.db
      .select({
        artist: songs.artist
      })
      .from(songs)
      .where(ilike(songs.artist, searchPattern))
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
   * @param {string} letter Letra inicial (e.g. 'A', 'B', o '0-9' para caracteres especiales/números)
   * @param {number} limit Límite de resultados (por defecto 50)
   * @param {number} offset Desplazamiento
   * @returns {Promise<{artists: Array<{name: string, slug: string}>, total: number}>}
   */
  async getArtistsByLetter(letter, limit = 50, offset = 0) {
    let whereClause;
    const cleanLetter = letter.trim().toUpperCase();

    if (cleanLetter === '0-9' || cleanLetter === 'OTHERS' || cleanLetter === '*') {
      // Artistas que empiezan con número o carácter no alfabético (excluyendo letras con acento y Ñ)
      whereClause = sql`artist ~ '^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]'`;
    } else if (cleanLetter.length === 1 && cleanLetter >= 'A' && cleanLetter <= 'Z') {
      // Construir regex para la letra considerando variaciones con acentos comunes en español
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

    // Obtener total de artistas únicos para la paginación
    const totalResult = await this.db
      .select({
        count: sql`count(distinct ${songs.artist})`
      })
      .from(songs)
      .where(whereClause);
    
    const total = parseInt(totalResult[0]?.count || 0, 10);

    // Obtener la página de artistas únicos
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
   * @param {number} id ID de la canción
   * @returns {Promise<Object|undefined>}
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
