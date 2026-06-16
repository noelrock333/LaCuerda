import fs from 'fs';
import path from 'path';
import { ChordsDatabase } from './db/index.js';
import { slugify } from './utils/slugify.js';
import {
  fetchWithRetry,
  getArchiveSnapshot,
  parseWaybackUrl,
  buildArchiveUrl,
  parseLaCuerdaPage
} from './scraper.js';

// Cargar configuración
const configPath = path.resolve('config.json');
if (!fs.existsSync(configPath)) {
  console.error('[ERROR] No se encontró config.json. Ejecuta la inicialización primero.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const db = new ChordsDatabase(config.postgres);

console.log('--------------------------------------------------');
console.log('  DESCARGADOR DE TABLATURAS LACUERDA.NET (WAYBACK) ');
console.log('--------------------------------------------------');
console.log(`Base de datos: PostgreSQL (localhost:5432)`);
console.log(`Retardo entre peticiones: ${config.requestDelayMs}ms`);
console.log(`Descargar todas las versiones: ${config.downloadAllVersions ? 'Sí' : 'No (Solo la mejor)'}`);
console.log('--------------------------------------------------');

// Leer URLs a procesar
const urlsPath = path.resolve('urls.txt');
if (!fs.existsSync(urlsPath)) {
  console.error('[ERROR] No se encontró urls.txt. Crea el archivo con las URLs que deseas descargar.');
  process.exit(1);
}

const inputUrls = fs.readFileSync(urlsPath, 'utf-8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.length > 0 && !line.startsWith('#'))
  .map(line => line.split(/\s+/)[0]);

if (inputUrls.length === 0) {
  console.log('No se encontraron URLs activas en urls.txt. Agrega algunas URLs y vuelve a intentarlo.');
  process.exit(0);
}

// Obtiene el slug de artista y canción desde la URL de origen
function parseSlugsFromUrl(url) {
  const cleanUrl = url.replace(/^https?:\/\//i, '').replace(/:\d+/g, '').split('/');
  if (cleanUrl.length < 3) {
    return { artistSlug: '', songSlug: '', isVersion: false };
  }
  const artistSlug = slugify(cleanUrl[1]);
  const lastSegment = cleanUrl[2];
  const isVersion = lastSegment.endsWith('.shtml') || lastSegment.match(/-\d+$/);
  const songSlug = lastSegment.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
  return {
    artistSlug,
    songSlug,
    isVersion
  };
}

async function isUrlAlreadyDownloaded(url) {
  const { artistSlug, songSlug, isVersion } = parseSlugsFromUrl(url);
  if (!artistSlug || !songSlug) return false;
  
  if (isVersion) {
    return await db.isSongDownloaded(url);
  } else {
    // Si es un índice de canción, omitir si ya se descargó al menos una versión
    return await db.hasSongVersions(artistSlug, songSlug);
  }
}

// Inicializar cola de procesamiento
// Cada elemento en la cola es un objeto: { url, timestamp, sourceUrl }
// - url: La URL que se va a descargar (Wayback o directa)
// - timestamp: Si ya se conoce el timestamp de Wayback
// - sourceUrl: La URL original del sitio lacuerda.net
const queue = [];
const processedUrls = new Set();

// Poblar cola inicial
for (const rawUrl of inputUrls) {
  const waybackInfo = parseWaybackUrl(rawUrl);
  if (waybackInfo) {
    queue.push({
      url: rawUrl.replace(/\/web\/(\d+)\//, '/web/$1id_/'), // Asegurar que use id_
      timestamp: waybackInfo.timestamp,
      sourceUrl: waybackInfo.originalUrl
    });
  } else {
    // Es una URL directa de LaCuerda
    queue.push({
      url: rawUrl,
      timestamp: null,
      sourceUrl: rawUrl
    });
  }
}

async function processQueue() {
  await db.init();
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  while (queue.length > 0) {
    const task = queue.shift();

    // Evitar procesar el mismo URL de origen dos veces en la misma ejecución
    if (processedUrls.has(task.sourceUrl)) {
      continue;
    }
    processedUrls.add(task.sourceUrl);

    // Verificar si la versión específica ya está en la base de datos
    if (await isUrlAlreadyDownloaded(task.sourceUrl)) {
      console.log(`[SALTADO] Ya descargada en DB: ${task.sourceUrl}`);
      skippedCount++;
      continue;
    }

    console.log(`\n[PROCESANDO] ${task.sourceUrl}...`);

    let downloadUrl = task.url;
    let timestamp = task.timestamp;

    // Si no tenemos timestamp y no es un URL de Wayback, debemos consultar la API de disponibilidad
    if (!timestamp) {
      console.log(`-> Buscando snapshot en Wayback Machine...`);
      const snapshot = await getArchiveSnapshot(task.sourceUrl, config.userAgent);
      if (!snapshot) {
        console.error(`[ERROR] No hay snapshot disponible en Wayback Machine para: ${task.sourceUrl}`);
        errorCount++;
        continue;
      }
      downloadUrl = snapshot.archiveUrl;
      timestamp = snapshot.timestamp;
      console.log(`-> Snapshot encontrado del: ${timestamp}`);
    }

    // Asegurar que usamos el modificador raw (id_) para evitar los scripts pesados de Wayback
    if (downloadUrl.includes('web.archive.org') && !downloadUrl.includes('id_/')) {
      downloadUrl = downloadUrl.replace(/\/web\/(\d+)\//, '/web/$1id_/');
    }

    try {
      console.log(`-> Descargando: ${downloadUrl}`);
      const html = await fetchWithRetry(downloadUrl, { userAgent: config.userAgent }, 3);
      
      const parsed = parseLaCuerdaPage(html, task.sourceUrl, downloadUrl);

      if (parsed.isVersionPage) {
        // Es una página con la tablatura/acordes completos. Guardarla.
        parsed.song.is_best = task.isBest || false;
        await db.saveSong(parsed.song);
        console.log(`[OK] Guardado: ${parsed.song.artist} - ${parsed.song.title} (Versión ${parsed.song.version_number}) [${parsed.song.type.toUpperCase()}]${task.isBest ? ' [MEJOR VERSIÓN]' : ''}`);
        successCount++;
      } else {
        // Es una página de índice con múltiples versiones
        console.log(`-> Se detectó página de índice. Encontradas ${parsed.versions.length} versiones.`);
        
        let targets = [];
        if (config.downloadAllVersions) {
          targets = parsed.versions;
        } else {
          // Buscar la mejor versión (rtMejor)
          const best = parsed.versions.find(v => v.isBest);
          if (best) {
            targets = [best];
            console.log(`-> Seleccionando mejor versión: ${best.source_url}`);
          } else {
            // Si no hay ninguna marcada como "mejor", buscar la primera versión de acordes ('chords')
            const firstChords = parsed.versions.find(v => v.type === 'chords');
            targets = [firstChords || parsed.versions[0]];
            console.log(`-> Seleccionando versión por defecto: ${targets[0].source_url}`);
          }
        }

        // Agregar las versiones seleccionadas a la cola de procesamiento
        for (const target of targets) {
          if (!processedUrls.has(target.source_url) && !(await db.isSongDownloaded(target.source_url))) {
            // Reusar el timestamp del índice para evitar consultar la API de disponibilidad de nuevo
            const archiveVersionUrl = buildArchiveUrl(target.source_url, timestamp);
            queue.push({
              url: archiveVersionUrl,
              timestamp: timestamp,
              sourceUrl: target.source_url,
              isBest: target.isBest
            });
            console.log(`   + Encolada versión: ${target.source_url} (Mejor: ${target.isBest ? 'Sí' : 'No'})`);
          }
        }
      }
    } catch (error) {
      console.error(`[ERROR] Falló el procesamiento de ${task.sourceUrl}:`, error.message);
      errorCount++;
    }

    // Respetar el retardo (delay) entre peticiones si la cola no está vacía
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, config.requestDelayMs));
    }
  }

  console.log('\n==================================================');
  console.log('             PROCESAMIENTO COMPLETADO             ');
  console.log('==================================================');
  console.log(`Exitosos:   ${successCount}`);
  console.log(`Saltados:   ${skippedCount}`);
  console.log(`Errores:    ${errorCount}`);
  console.log('==================================================');
}

processQueue()
  .catch(err => {
    console.error('Error fatal durante el procesamiento:', err);
  })
  .finally(async () => {
    await db.close();
  });
