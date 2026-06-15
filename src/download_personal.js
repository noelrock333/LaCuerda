import fs from 'fs';
import path from 'path';
import { ChordsDatabase, slugify } from './database.js';
import { fetchWithRetry, parseLaCuerdaPage } from './scraper.js';

// 1. Cargar configuración
const configPath = path.resolve('config.json');
if (!fs.existsSync(configPath)) {
  console.error('[ERROR] No se encontró config.json. Ejecuta la inicialización primero.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 2. Inicializar base de datos
const db = new ChordsDatabase(config.postgres);

// 3. Utilidad para extraer slugs del URL
function parseSlugsFromUrl(url) {
  const cleanUrl = url.replace(/^https?:\/\//i, '').replace(/:\d+/g, '').split('/');
  if (cleanUrl.length < 3) {
    return { artistSlug: '', songSlug: '', isVersion: false };
  }
  const artistSlug = slugify(cleanUrl[1]);
  const lastSegment = cleanUrl[2];
  const isVersion = lastSegment.endsWith('.shtml') && (lastSegment.includes('-') && lastSegment.match(/-\d+$/));
  const songSlug = lastSegment.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
  return {
    artistSlug,
    songSlug,
    isVersion: !!isVersion
  };
}

// 4. Verificar si ya fue descargada
async function isUrlAlreadyDownloaded(url) {
  const { artistSlug, songSlug, isVersion } = parseSlugsFromUrl(url);
  if (!artistSlug || !songSlug) return false;
  
  if (isVersion) {
    return await db.isSongDownloaded(url);
  } else {
    // Si es un índice, consideramos descargado si existe al menos alguna versión local
    return await db.hasSongVersions(artistSlug, songSlug);
  }
}

// 5. Proceso Principal
async function main() {
  console.log('==================================================');
  console.log(' DESCARGADOR PERSONAL DE CANCIONES (LIVE SITE) ');
  console.log('==================================================');

  // Leer listado personal
  const listPath = path.resolve('personal_list.txt');
  if (!fs.existsSync(listPath)) {
    console.error(`[ERROR] No se encontró ${listPath}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(listPath, 'utf-8').split(/\r?\n/);
  const queue = [];
  const processedUrls = new Set();
  let currentArtist = null;

  console.log(`Analizando lista de canciones...`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Ignorar comentarios o placeholders generales
    const isCategoryOrComment = 
      /^(por aprender|partes|rolas que me se|ensayar|ensayos|varias|practicar)/i.test(line) ||
      line.startsWith('[') ||
      (line.endsWith(':') && line.length < 25);

    if (isCategoryOrComment) {
      continue;
    }

    // Detectar si la línea representa un encabezado de artista
    const isArtistHeading = 
      !line.includes('-') &&
      !line.includes('http') &&
      !line.includes('(') &&
      line.length > 0 &&
      line.length <= 30 &&
      /^[A-ZÁÉÍÓÚÑ]/.test(line);

    if (isArtistHeading) {
      currentArtist = line;
      continue;
    }

    // Encontrar todas las URLs de la línea
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = line.match(urlRegex) || [];

    // Encontrar todas las anotaciones entre paréntesis
    const parenRegex = /\(([^)]+)\)/g;
    const annotations = [];
    let match;
    while ((match = parenRegex.exec(line)) !== null) {
      annotations.push(match[1]);
    }

    // Limpiar texto: remover URLs y paréntesis
    let cleanText = line.replace(urlRegex, '').replace(/\([^)]*\)/g, '');
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    const lineTargets = [];

    // 1. Si hay URLs en la línea, intentar parsear acordes
    for (const url of urls) {
      const cleanUrl = url.trim();
      if (/lacuerda\.net/i.test(cleanUrl)) {
        lineTargets.push({
          url: cleanUrl,
          annotations,
          source: 'lacuerda'
        });
      } else if (/ultimate-guitar\.com/i.test(cleanUrl)) {
        const matchUG = cleanUrl.match(/\/tab\/([^/]+)\/([^/]+)/);
        if (matchUG) {
          const artist = matchUG[1];
          const song = matchUG[2]
            .replace(/-chords(-\d+)?$/, '')
            .replace(/-tab(-\d+)?$/, '');
          lineTargets.push({
            url: `https://acordes.lacuerda.net/${slugify(artist)}/${slugify(song)}.shtml`,
            annotations: [...annotations, `UG original: ${cleanUrl}`],
            source: 'ug'
          });
        }
      } else if (/cifraclub\.com/i.test(cleanUrl)) {
        const matchCC = cleanUrl.match(/cifraclub\.(?:com\.br|com)\/([^/]+)\/([^/]+)/);
        if (matchCC) {
          const artist = matchCC[1];
          const song = matchCC[2];
          lineTargets.push({
            url: `https://acordes.lacuerda.net/${slugify(artist)}/${slugify(song)}.shtml`,
            annotations: [...annotations, `CifraClub original: ${cleanUrl}`],
            source: 'cifraclub'
          });
        }
      }
    }

    // 2. Si no hay URLs de acordes, usar el texto limpio y el artista de contexto si aplica
    if (lineTargets.length === 0 && cleanText) {
      const normalizedText = cleanText.replace(/[’‘`´]/g, "'");
      
      if (normalizedText.includes('-')) {
        const parts = normalizedText.split(/\s*-\s*/);
        const song = parts[0].trim();
        const artistPart = parts[1] ? parts[1].trim() : '';
        
        if (song) {
          const resolvedArtist = artistPart || currentArtist;
          if (resolvedArtist) {
            lineTargets.push({
              url: `https://acordes.lacuerda.net/${slugify(resolvedArtist)}/${slugify(song)}.shtml`,
              annotations,
              source: 'text_with_hyphen'
            });
          }
        }
      } else {
        // No hay guion, pero tenemos un artista actual de contexto
        if (currentArtist) {
          lineTargets.push({
            url: `https://acordes.lacuerda.net/${slugify(currentArtist)}/${slugify(normalizedText)}.shtml`,
            annotations,
            source: 'text_with_context_artist'
          });
        }
      }
    }

    // Agregar resultados a la cola
    if (lineTargets.length > 0) {
      for (const item of lineTargets) {
        queue.push({
          url: item.url,
          annotations: item.annotations,
          isBest: false
        });
      }
    }
  }

  console.log(`Total de tareas de descarga en cola: ${queue.length}\n`);

  if (queue.length === 0) {
    console.log('No se encontraron canciones para procesar.');
    process.exit(0);
  }

  // Conectar DB
  await db.init();

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  while (queue.length > 0) {
    const task = queue.shift();

    // Normalizar URL (quitar espacios sobrantes)
    task.url = task.url.trim();

    if (processedUrls.has(task.url)) {
      continue;
    }
    processedUrls.add(task.url);

    // Comprobar si ya existe
    if (await isUrlAlreadyDownloaded(task.url)) {
      console.log(`[SALTADO] Ya descargada: ${task.url}`);
      skippedCount++;
      continue;
    }

    console.log(`[PROCESANDO] ${task.url}...`);

    try {
      const html = await fetchWithRetry(task.url, { userAgent: config.userAgent }, 3);
      const parsed = parseLaCuerdaPage(html, task.url, task.url);

      if (parsed.isVersionPage) {
        // Es página con la tablatura/acordes
        let contributor = parsed.song.contributor || 'Colaborador';
        if (task.annotations && task.annotations.length > 0) {
          contributor += ` (Nota: ${task.annotations.join(', ')})`;
        }
        parsed.song.contributor = contributor;
        parsed.song.is_best = task.isBest || false;

        await db.saveSong(parsed.song);
        console.log(` [OK] Guardado: ${parsed.song.artist} - ${parsed.song.title} (v${parsed.song.version_number}) [${parsed.song.type.toUpperCase()}]`);
        successCount++;
      } else {
        // Es una página de índice
        console.log(` -> Se detectó página de índice. Encontradas ${parsed.versions.length} versiones.`);
        
        let targets = [];
        if (config.downloadAllVersions) {
          targets = parsed.versions;
        } else {
          // Intentar seleccionar la mejor versión
          const best = parsed.versions.find(v => v.isBest);
          if (best) {
            targets = [best];
            console.log(` -> Seleccionando mejor versión: ${best.source_url}`);
          } else {
            // Seleccionar la primera versión de acordes o primera versión en general
            const firstChords = parsed.versions.find(v => v.type === 'chords');
            targets = [firstChords || parsed.versions[0]];
            console.log(` -> Seleccionando versión por defecto: ${targets[0].source_url}`);
          }
        }

        // Agregar las versiones seleccionadas a la cola
        for (const target of targets) {
          if (!processedUrls.has(target.source_url) && !(await db.isSongDownloaded(target.source_url))) {
            queue.push({
              url: target.source_url,
              annotations: task.annotations,
              isBest: target.isBest
            });
            console.log(`   + Encolada versión: ${target.source_url} (Mejor: ${target.isBest ? 'Sí' : 'No'})`);
          }
        }
      }
    } catch (error) {
      console.error(` [ERROR] Falló el procesamiento de ${task.url}: ${error.message}`);
      errorCount++;
    }

    // Retardo para respetar tasa de peticiones y no saturar el servidor original
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, config.requestDelayMs || 2000));
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

main()
  .catch(err => {
    console.error('Error fatal durante la descarga:', err);
  })
  .finally(async () => {
    await db.close();
  });
