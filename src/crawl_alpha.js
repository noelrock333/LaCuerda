/**
 * crawl_alpha.js — Scraper alfabético para LaCuerda.net
 *
 * Descarga por artista: índice → listar artistas → por cada artista listar
 * canciones → descargar todas → siguiente artista → siguiente índice.
 *
 * Uso:
 *   node src/crawl_alpha.js --start https://acordes.lacuerda.net/tabs/a/index100.html
 *   node src/crawl_alpha.js --resume
 *   node src/crawl_alpha.js --retry-failed
 *
 * Características:
 *   - Pausa y reinicio: guarda el progreso en crawl_state.json
 *   - Registro de errores: URLs fallidas se guardan en la tabla `failed_urls` de la DB
 *   - Descarga TODAS las versiones de cada canción
 *   - Ctrl+C guarda el estado limpiamente antes de salir
 */

import fs from 'fs';
import path from 'path';
import config from './config/index.js';
import { ChordsDatabase } from './db/index.js';
import {
  fetchWithRetry,
  parseLaCuerdaPage,
  parseAlphaIndexPage,
  parseArtistPage
} from './scraper.js';

// ─── Configuración ────────────────────────────────────────────────────────────

const STATE_FILE = path.resolve(process.env.CRAWL_STATE_FILE || 'crawl_state.json');

const db = new ChordsDatabase(config.postgres);

const DELAY_MS = config.requestDelayMs || 2000;

// ─── Estado del Crawl ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} ArtistRef
 * @property {string} url
 * @property {string} name
 *
 * @typedef {Object} SongRef
 * @property {string} url
 * @property {string} title
 *
 * @typedef {Object} CrawlState
 * @property {string}        startedAt
 * @property {string}        lastUpdated
 * @property {string|null}   currentIndexUrl
 * @property {number}        currentIndexTotalArtists
 * @property {ArtistRef|null} currentArtist
 * @property {number}        currentArtistTotalSongs
 * @property {string[]}      pendingIndexPages
 * @property {ArtistRef[]}   pendingArtistPages
 * @property {SongRef[]}     pendingSongPages
 * @property {string[]}      pendingVersionPages
 * @property {Object}        stats
 */

function createEmptyState(startUrl) {
  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    currentIndexUrl: null,
    currentIndexTotalArtists: 0,
    currentArtist: null,
    currentArtistTotalSongs: 0,
    pendingIndexPages: [startUrl],
    pendingArtistPages: [],
    pendingSongPages: [],
    pendingVersionPages: [],
    stats: { success: 0, skipped: 0, errors: 0 }
  };
}

function normalizeState(state) {
  state.currentIndexUrl = state.currentIndexUrl ?? null;
  state.currentIndexTotalArtists = state.currentIndexTotalArtists ?? 0;
  state.currentArtist = state.currentArtist ?? null;
  state.currentArtistTotalSongs = state.currentArtistTotalSongs ?? 0;
  state.pendingIndexPages = state.pendingIndexPages ?? [];
  state.pendingArtistPages = (state.pendingArtistPages ?? []).map(a =>
    typeof a === 'string' ? { url: a, name: a } : a
  );
  state.pendingSongPages = (state.pendingSongPages ?? []).map(s =>
    typeof s === 'string' ? { url: s, title: s } : s
  );
  state.pendingVersionPages = state.pendingVersionPages ?? [];
  state.stats = state.stats ?? { success: 0, skipped: 0, errors: 0 };
  return state;
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return normalizeState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')));
    } catch (e) {
      console.warn('[WARN] No se pudo leer crawl_state.json, se creará uno nuevo.');
    }
  }
  return null;
}

/**
 * Guarda el estado en disco. Intenta escritura atómica (tmp + rename);
 * en volúmenes Docker/bind mount de un solo archivo, rename falla con EBUSY
 * y se usa escritura directa como fallback.
 */
function saveState(state) {
  state.lastUpdated = new Date().toISOString();
  const content = JSON.stringify(state, null, 2);
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = STATE_FILE + '.tmp';
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, STATE_FILE);
  } catch (err) {
    if (['EBUSY', 'EPERM', 'EXDEV', 'ENOTSUP'].includes(err.code)) {
      fs.writeFileSync(STATE_FILE, content, 'utf-8');
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      return;
    }
    throw err;
  }
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function log(prefix, msg) {
  const ts = new Date().toLocaleTimeString('es-MX');
  console.log(`[${ts}] ${prefix} ${msg}`);
}

function songUrl(song) {
  return typeof song === 'string' ? song : song.url;
}

function hasArtistUrl(state, url) {
  if (state.currentArtist?.url === url) return true;
  return state.pendingArtistPages.some(a => a.url === url);
}

function hasSongUrl(state, url) {
  return state.pendingSongPages.some(s => s.url === url);
}

function printStats(state) {
  console.log(`\n  ✅ Exitosas:   ${state.stats.success}`);
  console.log(`  ⏭️  Saltadas:   ${state.stats.skipped}`);
  console.log(`  ❌ Errores:    ${state.stats.errors}`);
  console.log(`  📋 En cola:    ${state.pendingIndexPages.length + state.pendingArtistPages.length + state.pendingSongPages.length + state.pendingVersionPages.length} URLs restantes`);
}

async function delay() {
  if (DELAY_MS > 0) {
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
}

// ─── Lógica de Crawling ───────────────────────────────────────────────────────

/**
 * Procesa una página de índice alfabético: lista todos los artistas del bloque
 * y encola el siguiente índice (index100, index200, …).
 */
async function processIndexPage(url, state) {
  log('[ÍNDICE]', url);
  try {
    const html = await fetchWithRetry(url, { userAgent: config.userAgent }, 3);
    const { artists, nextPageUrl } = parseAlphaIndexPage(html, url);

    state.currentIndexUrl = url;
    state.currentIndexTotalArtists = artists.length;

    log('  →', `Encontrados ${artists.length} artistas.`);

    for (const artist of artists) {
      if (!hasArtistUrl(state, artist.url)) {
        state.pendingArtistPages.push(artist);
      }
    }

    if (nextPageUrl && !state.pendingIndexPages.includes(nextPageUrl)) {
      state.pendingIndexPages.push(nextPageUrl);
    }
  } catch (error) {
    if (error.message && error.message.includes('404')) {
      log('  →', 'Página no encontrada (fin de la paginación).');
    } else {
      log('[ERROR]', `Al procesar índice ${url}: ${error.message}`);
      await db.recordFailedUrl(url, error.message);
      state.stats.errors++;
    }
  }
}

/**
 * Lista todas las canciones de un artista (1 fetch) y las encola para descarga.
 */
async function processArtistPage(state) {
  const artist = state.pendingArtistPages.shift();
  state.currentArtist = artist;

  const artistNum = state.currentIndexTotalArtists - state.pendingArtistPages.length;
  log('[ARTISTA]', `${artistNum}/${state.currentIndexTotalArtists} ${artist.name}`);

  try {
    const html = await fetchWithRetry(artist.url, { userAgent: config.userAgent }, 3);
    const { songs } = parseArtistPage(html, artist.url);

    state.currentArtistTotalSongs = songs.length;
    log('  →', `Encontradas ${songs.length} canciones.`);

    for (const song of songs) {
      if (!hasSongUrl(state, song.url)) {
        state.pendingSongPages.push({ url: song.url, title: song.title });
      }
    }
  } catch (error) {
    log('[ERROR]', `Al procesar artista ${artist.url}: ${error.message}`);
    await db.recordFailedUrl(artist.url, error.message);
    state.stats.errors++;
  }
}

/**
 * Procesa la página de versiones de una canción y encola cada versión individual.
 * Si la página ya es una versión completa, la guarda directamente.
 */
async function processSongPage(song, state) {
  const url = songUrl(song);
  const title = typeof song === 'string' ? song : song.title;
  const songNum = state.currentArtistTotalSongs - state.pendingSongPages.length;
  const artistName = state.currentArtist?.name ?? '';

  log('[CANCIÓN]', `${songNum}/${state.currentArtistTotalSongs} ${title}${artistName ? ` (${artistName})` : ''}`);

  try {
    const html = await fetchWithRetry(url, { userAgent: config.userAgent }, 3);
    const parsed = parseLaCuerdaPage(html, url, url);

    if (parsed.isVersionPage) {
      await db.saveSong(parsed.song);
      await db.markFailedUrlResolved(url).catch(() => {});
      log('  [OK]', `${parsed.song.artist} — ${parsed.song.title} (v${parsed.song.version_number}) [${parsed.song.type.toUpperCase()}]`);
      state.stats.success++;
    } else {
      log('  →', `Encontradas ${parsed.versions.length} versiones.`);
      for (const v of parsed.versions) {
        if (!state.pendingVersionPages.includes(v.source_url)) {
          state.pendingVersionPages.push(v.source_url);
        }
      }
    }
  } catch (error) {
    log('[ERROR]', `Al procesar canción ${url}: ${error.message}`);
    await db.recordFailedUrl(url, error.message);
    state.stats.errors++;
  }
}

/**
 * Descarga y guarda una versión individual (tablatura/acordes completos).
 */
async function processVersionPage(url, state) {
  if (await db.isSongDownloaded(url)) {
    log('[SALTADO]', `Ya en DB: ${url}`);
    state.stats.skipped++;
    return;
  }

  log('[VERSIÓN]', url);
  try {
    const html = await fetchWithRetry(url, { userAgent: config.userAgent }, 3);
    const parsed = parseLaCuerdaPage(html, url, url);

    if (parsed.isVersionPage) {
      await db.saveSong(parsed.song);
      await db.markFailedUrlResolved(url).catch(() => {});
      log('  [OK]', `${parsed.song.artist} — ${parsed.song.title} (v${parsed.song.version_number}) [${parsed.song.type.toUpperCase()}]`);
      state.stats.success++;
    } else {
      log('[WARN]', `La URL de versión resultó ser un índice: ${url}`);
      for (const v of parsed.versions) {
        if (!state.pendingVersionPages.includes(v.source_url)) {
          state.pendingVersionPages.push(v.source_url);
        }
      }
    }
  } catch (error) {
    log('[ERROR]', `Al procesar versión ${url}: ${error.message}`);
    await db.recordFailedUrl(url, error.message);
    state.stats.errors++;
  }
}

function isArtistWorkPending(state) {
  return state.pendingSongPages.length > 0 || state.pendingVersionPages.length > 0;
}

function clearCompletedArtist(state) {
  if (!isArtistWorkPending(state)) {
    state.currentArtist = null;
    state.currentArtistTotalSongs = 0;
  }
}

// ─── Bucle Principal ──────────────────────────────────────────────────────────

let running = true;
let shuttingDown = false;

process.on('SIGINT', async () => {
  if (shuttingDown) {
    console.log('\n[FORCE] Salida forzada.');
    process.exit(1);
  }
  shuttingDown = true;
  running = false;
  console.log('\n\n[PAUSA] Ctrl+C recibido. Guardando estado...');
});

async function runCrawl(state) {
  normalizeState(state);
  await db.init();

  console.log('\n══════════════════════════════════════════════════');
  console.log('   SCRAPER ALFABÉTICO LACUERDA.NET');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Inicio:           ${state.startedAt}`);
  console.log(`  Retardo:          ${DELAY_MS}ms entre peticiones`);
  console.log(`  Índice actual:    ${state.currentIndexUrl ?? '(ninguno)'}`);
  console.log(`  Artista actual:   ${state.currentArtist?.name ?? '(ninguno)'}`);
  console.log(`  Índices en cola:  ${state.pendingIndexPages.length}`);
  console.log(`  Artistas en cola: ${state.pendingArtistPages.length}`);
  console.log(`  Canciones en cola:${state.pendingSongPages.length}`);
  console.log(`  Versiones en cola:${state.pendingVersionPages.length}`);
  console.log('══════════════════════════════════════════════════\n');

  // Prioridad: versiones → canciones → artistas → índices
  while (running) {
    let didWork = false;

    if (state.pendingVersionPages.length > 0) {
      const url = state.pendingVersionPages.shift();
      await processVersionPage(url, state);
      clearCompletedArtist(state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (state.pendingSongPages.length > 0) {
      const song = state.pendingSongPages.shift();
      await processSongPage(song, state);
      clearCompletedArtist(state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (!isArtistWorkPending(state) && state.pendingArtistPages.length > 0) {
      state.currentArtist = null;
      state.currentArtistTotalSongs = 0;
      await processArtistPage(state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (!isArtistWorkPending(state) && state.pendingArtistPages.length === 0 && state.pendingIndexPages.length > 0) {
      state.currentIndexUrl = null;
      state.currentIndexTotalArtists = 0;
      const url = state.pendingIndexPages.shift();
      await processIndexPage(url, state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (!didWork) {
      break;
    }
  }

  if (!running && shuttingDown) {
    saveState(state);
    console.log('\n[PAUSA] Estado guardado en crawl_state.json.');
    console.log('[INFO]  Reanuda con: node src/crawl_alpha.js --resume');
  } else {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
    console.log('\n══════════════════════════════════════════════════');
    console.log('   CRAWL COMPLETADO ✅');
    console.log('══════════════════════════════════════════════════');
  }

  printStats(state);
}

// ─── Modo: Reintentar URLs Fallidas ──────────────────────────────────────────

async function retryFailed() {
  await db.init();
  const failedUrls = await db.getFailedUrls();

  if (failedUrls.length === 0) {
    console.log('[INFO] No hay URLs fallidas pendientes de reintentar.');
    return;
  }

  console.log(`\n[REINTENTOS] ${failedUrls.length} URLs fallidas encontradas.\n`);

  const state = {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    currentIndexUrl: null,
    currentIndexTotalArtists: 0,
    currentArtist: null,
    currentArtistTotalSongs: 0,
    pendingIndexPages: [],
    pendingArtistPages: [],
    pendingSongPages: failedUrls.map(r => ({ url: r.url, title: r.url })),
    pendingVersionPages: [],
    stats: { success: 0, skipped: 0, errors: 0 }
  };

  await runCrawl(state);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  try {
    if (mode === '--retry-failed') {
      await retryFailed();

    } else if (mode === '--resume') {
      const state = loadState();
      if (!state) {
        console.error('[ERROR] No se encontró crawl_state.json. Usa --start <url> para comenzar.');
        process.exit(1);
      }
      console.log(`[RESUMIENDO] Desde estado guardado el: ${state.lastUpdated}`);
      if (state.currentArtist) {
        console.log(`[RESUMIENDO] Artista en curso: ${state.currentArtist.name}`);
      }
      await runCrawl(state);

    } else if (mode === '--start') {
      const startUrl = args[1];
      if (!startUrl) {
        console.error('[ERROR] Debes proporcionar una URL de inicio. Ejemplo:');
        console.error('  node src/crawl_alpha.js --start https://acordes.lacuerda.net/tabs/a/index100.html');
        process.exit(1);
      }
      if (fs.existsSync(STATE_FILE)) {
        console.log('[WARN] Ya existe un crawl_state.json guardado. Se creará uno nuevo desde la URL indicada.');
        console.log('[WARN] Si quieres reanudar el anterior, usa: node src/crawl_alpha.js --resume');
      }
      const state = createEmptyState(startUrl);
      saveState(state);
      await runCrawl(state);

    } else {
      const savedState = loadState();
      if (savedState) {
        console.log(`[AUTO-RESUME] Encontrado crawl_state.json (${savedState.lastUpdated}).`);
        console.log('[AUTO-RESUME] Reanudando desde el último punto guardado...\n');
        await runCrawl(savedState);
      } else {
        console.log('Uso:');
        console.log('  node src/crawl_alpha.js --start <url>     Iniciar desde una URL de índice');
        console.log('  node src/crawl_alpha.js --resume          Reanudar crawl guardado');
        console.log('  node src/crawl_alpha.js --retry-failed    Reintentar URLs fallidas de la DB');
        console.log('\nEjemplo:');
        console.log('  node src/crawl_alpha.js --start https://acordes.lacuerda.net/tabs/a/index100.html');
        process.exit(0);
      }
    }
  } finally {
    await db.close();
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
