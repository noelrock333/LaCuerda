import { parseWaybackUrl } from '../scraper.js';

const ACORDES_URL_REGEX = /https?:\/\/acordes\.lacuerda\.net\/[^\s<>"']+\.shtml/gi;
const CHIDA_REGEX = /\(chida\)/i;

function normalizeFavoriteUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  const wayback = parseWaybackUrl(trimmed);
  const url = wayback ? wayback.originalUrl : trimmed;

  if (!/^https?:\/\/acordes\.lacuerda\.net\//i.test(url)) {
    return null;
  }
  if (!/\.shtml$/i.test(url)) {
    return null;
  }
  return url;
}

function parseBatchText(batchId, batchName, text) {
  const lines = text.split(/\r?\n/);
  const entries = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const isChida = CHIDA_REGEX.test(trimmed);
    const matches = [...trimmed.matchAll(ACORDES_URL_REGEX)];

    if (matches.length === 0) {
      entries.push({
        batchId,
        batchName: batchName || null,
        line: index + 1,
        url: null,
        isChida,
        status: 'skipped',
        message: 'Sin URL válida de acordes.lacuerda.net'
      });
      return;
    }

    for (const match of matches) {
      const normalized = normalizeFavoriteUrl(match[0]);
      if (!normalized) {
        entries.push({
          batchId,
          batchName: batchName || null,
          line: index + 1,
          url: match[0],
          isChida,
          status: 'skipped',
          message: 'URL no válida (dominio o extensión incorrecta)'
        });
        continue;
      }

      entries.push({
        batchId,
        batchName: batchName || null,
        line: index + 1,
        url: normalized,
        isChida,
        status: 'pending'
      });
    }
  });

  return entries;
}

/**
 * Parsea múltiples batches de texto con links de favoritos legacy.
 * @param {Array<{ id: string, name?: string, text: string }>} batches
 * @returns {Array<object>}
 */
export function parseFavoriteLinksBatches(batches) {
  const allEntries = [];

  for (const batch of batches) {
    if (!batch?.text?.trim()) {
      continue;
    }
    const batchId = batch.id || `batch-${allEntries.length}`;
    const batchName = batch.name?.trim() || null;
    allEntries.push(...parseBatchText(batchId, batchName, batch.text));
  }

  return allEntries;
}

/**
 * Compatibilidad: un solo texto como un batch único.
 */
export function parseFavoriteLinks(text) {
  return parseFavoriteLinksBatches([{ id: 'batch-1', text }]);
}
