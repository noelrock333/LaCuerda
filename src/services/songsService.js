import { db } from '../db/index.js';
import { songs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { slugify, getSongSlug } from '../utils/slugify.js';
import { generateTxtHeaderBackend } from '../utils/txtFormatter.js';

export class SongsService {
  static async search(query) {
    return await db.searchArtistsAndSongs(query);
  }

  static async getGroupedByArtist() {
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
  }

  static async getArtistsByLetter(letter, page = 1) {
    const limit = 50;
    const offset = (page - 1) * limit;
    
    const { artists, total } = await db.getArtistsByLetter(letter, limit, offset);
    return {
      letter,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      artists
    };
  }

  static async getArtistBySlug(artistSlug) {
    const songsList = await db.getSongsByArtistSlug(artistSlug);
    const artistName = await db.getArtistNameBySlug(artistSlug);
    
    if (!artistName) {
      throw { status: 404, message: 'Artista no encontrado' };
    }

    const songGroups = {};
    songsList.forEach(song => {
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
  }

  static async getSongDetail(artistSlug, songSlug) {
    const songsList = await db.getSongsByArtistSlug(artistSlug);
    const artistName = await db.getArtistNameBySlug(artistSlug);
    
    if (!artistName) {
      throw { status: 404, message: 'Artista no encontrado' };
    }

    const filtered = songsList.filter(song => getSongSlug(song.source_url) === songSlug);
    if (filtered.length === 0) {
      throw { status: 404, message: 'Canción no encontrada' };
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
        archive_url: song.archive_url,
        song_code: song.song_code,
        album: song.album,
        year: song.year,
        composers: song.composers,
        contributor_id: song.contributor_id
      }))
    };
  }

  static async getVersionDetail(artistSlug, versionSlug) {
    const songsList = await db.getSongsByArtistSlug(artistSlug);
    const artistName = await db.getArtistNameBySlug(artistSlug);
    
    if (!artistName) {
      throw { status: 404, message: 'Artista no encontrado' };
    }

    const cleanSlug = versionSlug.replace(/\.shtml$/i, '');
    let baseSongName = cleanSlug;
    let versionNumber = 1;

    const match = cleanSlug.match(/^(.+)-(\d+)$/);
    if (match) {
      baseSongName = match[1];
      versionNumber = parseInt(match[2], 10);
    }

    const matchSong = songsList.find(song => {
      const slug = getSongSlug(song.source_url);
      return slug === baseSongName && song.version_number === versionNumber;
    });

    if (!matchSong) {
      const fallbackSong = songsList.find(song => getSongSlug(song.source_url) === baseSongName);
      if (fallbackSong) {
        return fallbackSong;
      }
      throw { status: 404, message: 'Versión no encontrada' };
    }

    return matchSong;
  }

  static async updateVersion(id, body) {
    const { title, artist, content, chords, composers, album, year } = body || {};
    
    if (!title || !artist || !content) {
      throw { status: 400, message: 'Título, artista y contenido son requeridos' };
    }

    await db.db
      .update(songs)
      .set({
        title: title.trim(),
        artist: artist.trim(),
        content: content,
        chords: chords ? chords.trim() : null,
        composers: composers ? composers.trim() : null,
        album: album ? album.trim() : null,
        year: year ? parseInt(year, 10) : null
      })
      .where(eq(songs.id, id));

    return { success: true };
  }

  static async getVersionTxt(artistSlug, versionSlug) {
    const songsList = await db.getSongsByArtistSlug(artistSlug);
    const artistName = await db.getArtistNameBySlug(artistSlug);
    
    if (!artistName) {
      throw { status: 404, message: 'Artista no encontrado' };
    }

    const cleanSlug = versionSlug.replace(/\.txt$/i, '').replace(/\.shtml$/i, '');
    let baseSongName = cleanSlug;
    let versionNumber = 1;

    const match = cleanSlug.match(/^(.+)-(\d+)$/);
    if (match) {
      baseSongName = match[1];
      versionNumber = parseInt(match[2], 10);
    }

    const matchSong = songsList.find(song => {
      const slug = getSongSlug(song.source_url);
      return slug === baseSongName && song.version_number === versionNumber;
    });

    const finalSong = matchSong || songsList.find(song => getSongSlug(song.source_url) === baseSongName);

    if (!finalSong) {
      throw { status: 404, message: 'Versión no encontrada' };
    }

    const header = generateTxtHeaderBackend(finalSong);
    return `${header}\n\n${finalSong.content}`;
  }
}
