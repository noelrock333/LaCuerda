/**
 * crawl_alpha.js — Scraper alfabético para LaCuerda.net
 *
 * Descarga todas las versiones de todas las canciones de todos los artistas
 * de forma alfabética, comenzando desde una URL de índice de letra.
 *
 * Uso:
 *   node src/crawl_alpha.js --start https://acordes.lacuerda.net/tabs/z/index0.html
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
import { ChordsDatabase } from './database.js';
import {
  fetchWithRetry,
  parseLaCuerdaPage,
  parseAlphaIndexPage,
  parseArtistPage
} from './scraper.js';

// ─── Configuración ────────────────────────────────────────────────────────────

const configPath = path.resolve('config.json');
if (!fs.existsSync(configPath)) {
  console.error('[ERROR] No se encontró config.json.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const STATE_FILE = path.resolve('crawl_state.json');
const BASE_URL   = 'https://acordes.lacuerda.net';

const db = new ChordsDatabase(config.postgres);

// Retardo entre peticiones: usa el configurado en config.json o 2s por defecto
const DELAY_MS = config.requestDelayMs || 2000;

// ─── Estado del Crawl ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} CrawlState
 * @property {string}   startedAt          - Timestamp de inicio del crawl
 * @property {string}   lastUpdated        - Timestamp de última actualización
 * @property {string[]} pendingIndexPages  - Páginas de índice alfabético pendientes (index0.html, etc.)
 * @property {string[]} pendingArtistPages - Páginas de artista pendientes
 * @property {string[]} pendingSongPages   - Páginas de canción (índice de versiones) pendientes
 * @property {string[]} pendingVersionPages- Versiones individuales pendientes de descargar
 * @property {Object}   stats              - Estadísticas acumuladas
 */

function createEmptyState(startUrl) {
  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    pendingIndexPages: [startUrl],
    pendingArtistPages: [],
    pendingSongPages: [],
    pendingVersionPages: [],
    stats: { success: 0, skipped: 0, errors: 0 }
  };
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[WARN] No se pudo leer crawl_state.json, se creará uno nuevo.');
    }
  }
  return null;
}

/**
 * Guarda el estado en disco de forma atómica (escribe a .tmp y renombra).
 */
function saveState(state) {
  state.lastUpdated = new Date().toISOString();
  const tmpPath = STATE_FILE + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STATE_FILE);
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function log(prefix, msg) {
  const ts = new Date().toLocaleTimeString('es-MX');
  console.log(`[${ts}] ${prefix} ${msg}`);
}

function printStats(state) {
  const total = Object.values(state.pendingIndexPages?.length  || 0) +
                (state.pendingArtistPages?.length  || 0) +
                (state.pendingSongPages?.length    || 0) +
                (state.pendingVersionPages?.length || 0);
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
 * Procesa una página de índice alfabético y encola los artistas encontrados.
 * Si hay una siguiente página de índice, también la encola.
 */
async function processIndexPage(url, state) {
  log('[ÍNDICE]', url);
  try {
    const html = await fetchWithRetry(url, { userAgent: config.userAgent }, 3);
    const { artists, nextPageUrl } = parseAlphaIndexPage(html, url);

    log('  →', `Encontrados ${artists.length} artistas.`);

    for (const artist of artists) {
      if (!state.pendingArtistPages.includes(artist.url)) {
        state.pendingArtistPages.push(artist.url);
      }
    }

    // Encolar la siguiente página de índice si existe
    if (nextPageUrl && !state.pendingIndexPages.includes(nextPageUrl)) {
      // La añadimos al PRINCIPIO para mantener el orden alfabético
      state.pendingIndexPages.unshift(nextPageUrl);
    }
  } catch (error) {
    // Si la página no existe (404) la ignoramos; si es otro error, lo registramos
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
 * Procesa la página de catálogo de un artista y encola las páginas de canciones.
 */
async function processArtistPage(url, state) {
  log('[ARTISTA]', url);
  try {
    const html = await fetchWithRetry(url, { userAgent: config.userAgent }, 3);
    const { songs } = parseArtistPage(html, url);

    log('  →', `Encontradas ${songs.length} canciones.`);

    for (const song of songs) {
      if (!state.pendingSongPages.includes(song.url)) {
        state.pendingSongPages.push(song.url);
      }
    }
  } catch (error) {
    log('[ERROR]', `Al procesar artista ${url}: ${error.message}`);
    await db.recordFailedUrl(url, error.message);
    state.stats.errors++;
  }
}

/**
 * Procesa la página de versiones de una canción y encola cada versión individual.
 * Si la página ya es una versión completa, la guarda directamente.
 */
async function processSongPage(url, state) {
  log('[CANCIÓN]', url);
  try {
    const html = await fetchWithRetry(url, { userAgent: config.userAgent }, 3);
    const parsed = parseLaCuerdaPage(html, url, url);

    if (parsed.isVersionPage) {
      // La página de índice de la canción contiene directamente una versión
      await db.saveSong(parsed.song);
      await db.markFailedUrlResolved(url).catch(() => {}); // Limpiar si estaba en failed
      log('  [OK]', `${parsed.song.artist} — ${parsed.song.title} (v${parsed.song.version_number}) [${parsed.song.type.toUpperCase()}]`);
      state.stats.success++;
    } else {
      // Es un índice de versiones → encolar todas las versiones
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
  // Verificar si ya está en la DB
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
      // Inesperado: una versión que resulta ser una página de índice
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
  await db.init();

  console.log('\n══════════════════════════════════════════════════');
  console.log('   SCRAPER ALFABÉTICO LACUERDA.NET');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Inicio:        ${state.startedAt}`);
  console.log(`  Retardo:       ${DELAY_MS}ms entre peticiones`);
  console.log(`  Índices en cola:  ${state.pendingIndexPages.length}`);
  console.log(`  Artistas en cola: ${state.pendingArtistPages.length}`);
  console.log(`  Canciones en cola:${state.pendingSongPages.length}`);
  console.log(`  Versiones en cola:${state.pendingVersionPages.length}`);
  console.log('══════════════════════════════════════════════════\n');

  // Procesar en orden de prioridad: índices → artistas → canciones → versiones
  while (running) {
    let didWork = false;

    if (state.pendingIndexPages.length > 0) {
      const url = state.pendingIndexPages.shift();
      await processIndexPage(url, state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (state.pendingArtistPages.length > 0) {
      const url = state.pendingArtistPages.shift();
      await processArtistPage(url, state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (state.pendingSongPages.length > 0) {
      const url = state.pendingSongPages.shift();
      await processSongPage(url, state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (state.pendingVersionPages.length > 0) {
      const url = state.pendingVersionPages.shift();
      await processVersionPage(url, state);
      saveState(state);
      didWork = true;
      await delay();
      continue;
    }

    if (!didWork) {
      // No hay más trabajo pendiente
      break;
    }
  }

  // ── Finalización ──
  if (!running && shuttingDown) {
    saveState(state);
    console.log('\n[PAUSA] Estado guardado en crawl_state.json.');
    console.log('[INFO]  Reanuda con: node src/crawl_alpha.js --resume');
  } else {
    // Crawl completado normalmente; eliminar el archivo de estado
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
    pendingIndexPages: [],
    pendingArtistPages: [],
    pendingSongPages: failedUrls.map(r => r.url),
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
      await runCrawl(state);

    } else if (mode === '--start') {
      const startUrl = args[1];
      if (!startUrl) {
        console.error('[ERROR] Debes proporcionar una URL de inicio. Ejemplo:');
        console.error('  node src/crawl_alpha.js --start https://acordes.lacuerda.net/tabs/z/index0.html');
        process.exit(1);
      }
      // Si ya hay un estado guardado, preguntar si continuar
      if (fs.existsSync(STATE_FILE)) {
        console.log('[WARN] Ya existe un crawl_state.json guardado. Se creará uno nuevo desde la URL indicada.');
        console.log('[WARN] Si quieres reanudar el anterior, usa: node src/crawl_alpha.js --resume');
      }
      const state = createEmptyState(startUrl);
      saveState(state);
      await runCrawl(state);

    } else {
      // Si existe un estado guardado, reanudar automáticamente
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
        console.log('  node src/crawl_alpha.js --start https://acordes.lacuerda.net/tabs/z/index0.html');
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
