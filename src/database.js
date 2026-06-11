import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export class ChordsDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Inicializa la conexión a la base de datos y crea la tabla si no existe.
   */
  init() {
    // Asegurarse de que el directorio del archivo de base de datos existe
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Crear la tabla con una estructura estándar que sea fácil de migrar a Postgres
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist TEXT NOT NULL,
        title TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        type TEXT NOT NULL,          -- 'chords' | 'tab' | 'bass' | etc.
        chords TEXT,                 -- Lista de acordes (guardado como string separado por comas o JSON)
        content TEXT NOT NULL,       -- Contenido pre-formateado de acordes y letra
        source_url TEXT UNIQUE NOT NULL, -- URL original de LaCuerda (actúa como clave única)
        archive_url TEXT NOT NULL,   -- URL de Wayback Machine utilizada
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear índice para búsquedas rápidas por artista/título
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_songs_artist_title ON songs (artist, title)
    `);
  }

  /**
   * Verifica si una URL original ya ha sido descargada e insertada en la base de datos.
   * @param {string} sourceUrl URL original de LaCuerda
   * @returns {boolean}
   */
  isSongDownloaded(sourceUrl) {
    const stmt = this.db.prepare('SELECT 1 FROM songs WHERE source_url = ? LIMIT 1');
    const result = stmt.get(sourceUrl);
    return !!result;
  }

  /**
   * Guarda o actualiza una canción en la base de datos.
   * @param {Object} song Datos de la canción
   * @param {string} song.artist
   * @param {string} song.title
   * @param {number} song.version_number
   * @param {string} song.type
   * @param {string} song.chords
   * @param {string} song.content
   * @param {string} song.source_url
   * @param {string} song.archive_url
   */
  saveSong(song) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO songs (
        artist, title, version_number, type, chords, content, source_url, archive_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      song.artist,
      song.title,
      song.version_number,
      song.type,
      song.chords,
      song.content,
      song.source_url,
      song.archive_url
    );
  }

  /**
   * Obtiene todas las canciones guardadas (útil para reportes y exportación).
   * @returns {Array<Object>}
   */
  getAllSongs() {
    const stmt = this.db.prepare('SELECT * FROM songs ORDER BY artist, title, version_number');
    return stmt.all();
  }

  /**
   * Busca canciones cuyo título o artista coincida con la consulta (query).
   * @param {string} query Texto a buscar
   * @returns {Array<Object>}
   */
  searchSongs(query) {
    if (!query || query.trim() === '') {
      return this.getAllSongs();
    }
    const stmt = this.db.prepare(`
      SELECT id, artist, title, version_number, type, chords, source_url, archive_url, scraped_at 
      FROM songs 
      WHERE artist LIKE ? OR title LIKE ? 
      ORDER BY artist, title, version_number
    `);
    const searchPattern = `%${query.trim()}%`;
    return stmt.all(searchPattern, searchPattern);
  }

  /**
   * Obtiene una canción específica por su ID.
   * @param {number} id ID de la canción
   * @returns {Object|undefined}
   */
  getSongById(id) {
    const stmt = this.db.prepare('SELECT * FROM songs WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Cierra la conexión de la base de datos.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
