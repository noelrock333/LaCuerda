import { db } from '../db/index.js';
import { parseFavoriteLinksBatches } from '../utils/parseFavoriteLinks.js';
import { slugify, getArtistSlugFromSourceUrl } from '../utils/slugify.js';
import { processImportQueue } from './importService.js';

const NOT_FOUND_INDEX_MSG =
  'No se encontró coincidencia exacta. Si el link apunta al índice de la canción (sin -N), usa la URL de una versión específica, ej. cancion-3.shtml';

function buildSongResult(song) {
  const artistSlug = getArtistSlugFromSourceUrl(song.source_url) || slugify(song.artist);
  const parts = song.source_url.split('/');
  const versionSlug = parts[parts.length - 1];
  return {
    id: song.id,
    artist: song.artist,
    title: song.title,
    version_number: song.version_number,
    type: song.type,
    source_url: song.source_url,
    artistSlug,
    versionSlug
  };
}

function emptyBatchSummary(batchId, name) {
  return {
    batchId,
    name: name || null,
    total: 0,
    skipped: 0,
    added: 0,
    already_exists: 0,
    not_found: 0,
    error: 0,
    chidas: 0
  };
}

function incrementSummary(summary, status, isChida) {
  summary.total += 1;
  if (status === 'skipped') summary.skipped += 1;
  if (status === 'added') summary.added += 1;
  if (status === 'already_exists') summary.already_exists += 1;
  if (status === 'not_found') summary.not_found += 1;
  if (status === 'error') summary.error += 1;
  if (isChida && (status === 'added' || status === 'already_exists')) {
    summary.chidas += 1;
  }
}

function isSongIndexUrl(url) {
  const filename = url.split('/').pop() || '';
  return /\.shtml$/i.test(filename) && !/-\d+\.shtml$/i.test(filename);
}

export class FavoritesImportService {
  static normalizeBatches(body) {
    if (body?.batches && Array.isArray(body.batches)) {
      return body.batches
        .filter((b) => b?.text?.trim())
        .map((b, i) => ({
          id: b.id || `batch-${i + 1}`,
          name: b.name?.trim() || null,
          text: b.text
        }));
    }
    if (body?.text?.trim()) {
      return [{ id: 'batch-1', name: null, text: body.text }];
    }
    throw { status: 400, message: 'Se requiere al menos un batch con texto' };
  }

  static async importFromBatches(userId, body) {
    const batches = FavoritesImportService.normalizeBatches(body);
    const entries = parseFavoriteLinksBatches(batches);

    const batchSummariesMap = new Map();
    for (const batch of batches) {
      batchSummariesMap.set(batch.id, emptyBatchSummary(batch.id, batch.name));
    }

    const globalSummary = {
      total: 0,
      skipped: 0,
      added: 0,
      already_exists: 0,
      not_found: 0,
      error: 0,
      chidas: 0,
      batches: batches.length
    };

    const results = [];
    const seenUrls = new Set();

    for (const entry of entries) {
      const batchSummary = batchSummariesMap.get(entry.batchId) || emptyBatchSummary(entry.batchId, entry.batchName);

      if (entry.status === 'skipped') {
        const result = {
          batchId: entry.batchId,
          line: entry.line,
          url: entry.url,
          status: 'skipped',
          is_chida: entry.isChida,
          message: entry.message
        };
        results.push(result);
        incrementSummary(batchSummary, 'skipped', false);
        incrementSummary(globalSummary, 'skipped', false);
        continue;
      }

      if (seenUrls.has(entry.url)) {
        const result = {
          batchId: entry.batchId,
          line: entry.line,
          url: entry.url,
          status: 'already_exists',
          is_chida: entry.isChida,
          message: 'URL duplicada en otra lista o línea anterior'
        };
        results.push(result);
        incrementSummary(batchSummary, 'already_exists', entry.isChida);
        incrementSummary(globalSummary, 'already_exists', entry.isChida);
        continue;
      }
      seenUrls.add(entry.url);

      try {
        let song = await db.getSongBySourceUrl(entry.url);

        if (!song) {
          await processImportQueue(entry.url, {
            downloadAllVersions: false,
            skipIfExists: true,
            forceRefresh: false
          });
          song = await db.getSongBySourceUrl(entry.url);
        }

        if (!song) {
          const message = isSongIndexUrl(entry.url)
            ? NOT_FOUND_INDEX_MSG
            : 'No se encontró en la base de datos local ni en lacuerda.net';
          const result = {
            batchId: entry.batchId,
            line: entry.line,
            url: entry.url,
            status: 'not_found',
            is_chida: entry.isChida,
            message
          };
          results.push(result);
          incrementSummary(batchSummary, 'not_found', false);
          incrementSummary(globalSummary, 'not_found', false);
          continue;
        }

        const favStatus = await db.addFavorite(userId, song.id, entry.isChida);

        const result = {
          batchId: entry.batchId,
          line: entry.line,
          url: entry.url,
          status: favStatus,
          is_chida: entry.isChida,
          song: buildSongResult(song)
        };
        results.push(result);
        incrementSummary(batchSummary, favStatus, entry.isChida);
        incrementSummary(globalSummary, favStatus, entry.isChida);
      } catch (error) {
        const result = {
          batchId: entry.batchId,
          line: entry.line,
          url: entry.url,
          status: 'error',
          is_chida: entry.isChida,
          message: error.message || 'Error al procesar'
        };
        results.push(result);
        incrementSummary(batchSummary, 'error', false);
        incrementSummary(globalSummary, 'error', false);
      }
    }

    return {
      summary: globalSummary,
      batchSummaries: Array.from(batchSummariesMap.values()),
      results
    };
  }
}
