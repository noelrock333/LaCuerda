import config from '../config/index.js';
import { db } from '../db/index.js';
import { songs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { slugify, getArtistSlugFromSourceUrl } from '../utils/slugify.js';
import { fetchWithRetry, parseWaybackUrl, parseLaCuerdaPage } from '../scraper.js';

const LACUERDA_BASE = 'https://acordes.lacuerda.net';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImportUrl(url) {
  const trimmed = url.trim();
  const wayback = parseWaybackUrl(trimmed);
  if (wayback) {
    return wayback.originalUrl;
  }
  return trimmed;
}

function validateLacuerdaUrl(url) {
  const normalized = normalizeImportUrl(url);
  if (!/lacuerda\.net/i.test(normalized)) {
    throw { status: 400, message: 'La URL debe apuntar a lacuerda.net' };
  }
  return normalized;
}

function validateSlug(slug, label = 'Slug') {
  if (!slug || !/^[a-z0-9_][a-z0-9_.-]*$/i.test(slug)) {
    throw { status: 400, message: `${label} inválido` };
  }
}

function buildVersionSlugFromSourceUrl(sourceUrl) {
  const parts = sourceUrl.split('/');
  return parts[parts.length - 1];
}

function buildLacuerdaUrl(artistSlug, slug, type) {
  validateSlug(artistSlug, 'Artista');
  if (type === 'version') {
    validateSlug(slug, 'Versión');
    const versionSlug = slug.endsWith('.shtml') ? slug : `${slug}.shtml`;
    return `${LACUERDA_BASE}/${artistSlug}/${versionSlug}`;
  }
  validateSlug(slug, 'Canción');
  const songSlug = slug.replace(/\.shtml$/i, '');
  return `${LACUERDA_BASE}/${artistSlug}/${songSlug}.shtml`;
}

async function getSongRecordBySourceUrl(sourceUrl) {
  const result = await db.db
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

async function buildImportResult(sourceUrl, action) {
  const record = await getSongRecordBySourceUrl(sourceUrl);
  if (!record) {
    return null;
  }
  return {
    id: record.id,
    artist: record.artist,
    title: record.title,
    version_number: record.version_number,
    type: record.type,
    source_url: record.source_url,
    action,
    artistSlug: getArtistSlugFromSourceUrl(record.source_url) || slugify(record.artist),
    versionSlug: buildVersionSlugFromSourceUrl(record.source_url)
  };
}

function buildSummary(imported) {
  return imported.reduce(
    (acc, item) => {
      if (item.action === 'created') acc.created += 1;
      if (item.action === 'updated') acc.updated += 1;
      return acc;
    },
    { created: 0, updated: 0, failed: 0 }
  );
}

async function processImportQueue(initialUrl, options = {}) {
  const {
    downloadAllVersions = false,
    skipIfExists = false,
    forceRefresh = false
  } = options;

  const normalizedUrl = validateLacuerdaUrl(initialUrl);
  const queue = [{ url: normalizedUrl, isBest: false }];
  const processedUrls = new Set();
  const imported = [];
  const errors = [];

  while (queue.length > 0) {
    const task = queue.shift();
    const sourceUrl = normalizeImportUrl(task.url);

    if (processedUrls.has(sourceUrl)) {
      continue;
    }
    processedUrls.add(sourceUrl);

    if (skipIfExists && !forceRefresh && (await db.isSongDownloaded(sourceUrl))) {
      continue;
    }

    try {
      const html = await fetchWithRetry(sourceUrl, { userAgent: config.userAgent }, 3);
      const parsed = parseLaCuerdaPage(html, sourceUrl, sourceUrl);

      if (parsed.isVersionPage) {
        const wasExisting = await db.isSongDownloaded(parsed.song.source_url);
        if (skipIfExists && !forceRefresh && wasExisting) {
          continue;
        }

        parsed.song.is_best = task.isBest || false;
        await db.saveSong(parsed.song);

        const result = await buildImportResult(
          parsed.song.source_url,
          wasExisting ? 'updated' : 'created'
        );
        if (result) {
          imported.push(result);
        }
      } else if (parsed.versions.length === 0) {
        errors.push({ url: sourceUrl, message: 'No se encontraron versiones en la página' });
      } else {
        let targets = [];
        if (downloadAllVersions) {
          targets = parsed.versions;
        } else {
          const best = parsed.versions.find((v) => v.isBest);
          if (best) {
            targets = [best];
          } else {
            const firstChords = parsed.versions.find((v) => v.type === 'chords');
            targets = [firstChords || parsed.versions[0]];
          }
        }

        for (const target of targets) {
          const targetUrl = target.source_url;
          if (skipIfExists && !forceRefresh && (await db.isSongDownloaded(targetUrl))) {
            continue;
          }
          if (!processedUrls.has(targetUrl)) {
            queue.push({
              url: targetUrl,
              isBest: target.isBest
            });
          }
        }
      }
    } catch (error) {
      errors.push({ url: sourceUrl, message: error.message || 'Error al procesar la URL' });
    }

    if (queue.length > 0) {
      await sleep(config.requestDelayMs || 2000);
    }
  }

  return { imported, errors };
}

export class ImportService {
  static async importSongFromUrl({ url, downloadAllVersions = false }) {
    if (!url || typeof url !== 'string' || !url.trim()) {
      throw { status: 400, message: 'La URL es requerida' };
    }

    const { imported, errors } = await processImportQueue(url, {
      downloadAllVersions,
      skipIfExists: false,
      forceRefresh: true
    });

    if (imported.length === 0 && errors.length > 0) {
      throw {
        status: 502,
        message: errors[0].message || 'No se pudo importar la canción'
      };
    }

    const summary = buildSummary(imported);
    summary.failed = errors.length;

    return { imported, errors, summary };
  }

  static async autoImportFromPath({ artistSlug, slug, type }) {
    if (!artistSlug || !slug || !type) {
      throw { status: 400, message: 'artistSlug, slug y type son requeridos' };
    }
    if (type !== 'song' && type !== 'version') {
      throw { status: 400, message: 'type debe ser "song" o "version"' };
    }

    const lacuerdaUrl = buildLacuerdaUrl(artistSlug, slug, type);

    if (type === 'song') {
      const songSlug = slug.replace(/\.shtml$/i, '');
      if (await db.hasSongVersions(artistSlug, songSlug)) {
        const redirectSlug = slug.includes('.shtml') ? slug : `${songSlug}.shtml`;
        return {
          status: 'exists',
          redirectTo: `/${artistSlug}/${redirectSlug}`,
          imported: []
        };
      }
    } else if (await db.isSongDownloaded(lacuerdaUrl)) {
      const versionSlug = slug.endsWith('.shtml') ? slug : `${slug}.shtml`;
      return {
        status: 'exists',
        redirectTo: `/${artistSlug}/${versionSlug}`,
        imported: []
      };
    }

    const { imported, errors } = await processImportQueue(lacuerdaUrl, {
      downloadAllVersions: false,
      skipIfExists: true,
      forceRefresh: false
    });

    if (imported.length === 0) {
      const message = errors[0]?.message || 'No se encontró esta canción en LaCuerda.net';
      throw { status: 404, message };
    }

    const primary = imported[0];
    return {
      status: 'imported',
      redirectTo: `/${primary.artistSlug}/${primary.versionSlug}`,
      imported
    };
  }
}
