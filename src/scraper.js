import * as cheerio from 'cheerio';

/**
 * Realiza una petición HTTP con reintentos y retroceso exponencial (backoff).
 * @param {string} url 
 * @param {Object} options 
 * @param {number} retries 
 * @returns {Promise<string>}
 */
export async function fetchWithRetry(url, options = {}, retries = 3) {
  const userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          ...options.headers
        },
        signal: AbortSignal.timeout(15000) // 15s timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      // Obtener buffer y decodificar dinámicamente detectando si es UTF-8 o Latin-1 (ISO-8859-1)
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const utf8Text = buffer.toString('utf8');

      // Si la decodificación en UTF-8 produce caracteres de reemplazo (),
      // significa que la página está codificada en Latin1. De lo contrario, usamos UTF-8.
      if (utf8Text.includes('\uFFFD')) {
        return buffer.toString('latin1');
      }
      return utf8Text;
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = 3000 * (i + 1);
      console.warn(`[FETCH FAIL] ${url}. Reintentando en ${delay / 1000}s... (Intento ${i + 1}/${retries}). Error: ${error.message}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

/**
 * Consulta la API de disponibilidad de Wayback Machine para obtener el snapshot más cercano.
 * @param {string} originalUrl URL original a buscar
 * @param {string} userAgent
 * @returns {Promise<{archiveUrl: string, timestamp: string, originalUrl: string} | null>}
 */
export async function getArchiveSnapshot(originalUrl, userAgent) {
  // 1. Intentar con la API de disponibilidad (URL original)
  let snapshot = await queryAvailabilityApi(originalUrl, userAgent);
  if (snapshot) return snapshot;

  // 2. Alternar protocolo en la API de disponibilidad
  const alternatedUrl = originalUrl.startsWith('https://') 
    ? originalUrl.replace(/^https:\/\//i, 'http://')
    : originalUrl.replace(/^http:\/\//i, 'https://');
  snapshot = await queryAvailabilityApi(alternatedUrl, userAgent);
  if (snapshot) return snapshot;

  // 3. Fallback: Consultar el CDX Server (más preciso y estable) con la URL original
  snapshot = await queryCdxApi(originalUrl, userAgent);
  if (snapshot) return snapshot;

  // 4. Alternar protocolo en el CDX Server
  snapshot = await queryCdxApi(alternatedUrl, userAgent);
  return snapshot;
}

/**
 * Realiza la consulta directa a la API de disponibilidad.
 */
async function queryAvailabilityApi(targetUrl, userAgent) {
  const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}`;
  try {
    const responseText = await fetchWithRetry(apiUrl, { userAgent }, 2);
    const data = JSON.parse(responseText);
    const closest = data?.archived_snapshots?.closest;

    if (closest && closest.available && closest.url) {
      // Modificar el URL para usar el formato raw 'id_' (evita scripts de Archive.org)
      const archiveUrl = closest.url.replace(/\/web\/(\d+)\//, '/web/$1id_/');
      return {
        archiveUrl,
        timestamp: closest.timestamp,
        originalUrl: closest.url.split('/http')[1] ? 'http' + closest.url.split('/http')[1] : targetUrl
      };
    }
  } catch (error) {
    console.warn(`[WARN API WAYBACK] Consulta fallida para ${targetUrl}:`, error.message);
  }
  return null;
}

/**
 * Consulta la API CDX Server de Wayback Machine para obtener el snapshot exitoso (200) más reciente.
 */
async function queryCdxApi(targetUrl, userAgent) {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(targetUrl)}&output=json&filter=statuscode:200&limit=-1`;
  try {
    const responseText = await fetchWithRetry(cdxUrl, { userAgent }, 2);
    const data = JSON.parse(responseText);
    
    // El CDX Server API retorna un array donde el primer elemento son las cabeceras
    // y el segundo es la fila con los valores.
    if (data && data.length >= 2) {
      const row = data[1];
      const timestamp = row[1];
      const original = row[2];
      
      const archiveUrl = `https://web.archive.org/web/${timestamp}id_/${original}`;
      return {
        archiveUrl,
        timestamp,
        originalUrl: original
      };
    }
  } catch (error) {
    console.warn(`[WARN API CDX] Consulta CDX fallida para ${targetUrl}:`, error.message);
  }
  return null;
}

/**
 * Parsea una URL de Wayback Machine para extraer el timestamp y la URL original.
 * @param {string} url 
 * @returns {{timestamp: string, originalUrl: string} | null}
 */
export function parseWaybackUrl(url) {
  const match = url.match(/web\.archive\.org\/web\/(\d+)(?:id_)?\/(https?:\/\/.*)/);
  if (match) {
    return {
      timestamp: match[1],
      originalUrl: match[2]
    };
  }
  return null;
}

/**
 * Convierte un URL original y un timestamp en un URL de Wayback Machine optimizado (raw).
 * @param {string} originalUrl 
 * @param {string} timestamp 
 * @returns {string}
 */
export function buildArchiveUrl(originalUrl, timestamp) {
  return `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
}

/**
 * Parsea el HTML de una página de LaCuerda.
 * @param {string} html HTML de la página
 * @param {string} sourceUrl URL original de la página (ej. acordes.lacuerda.net/...)
 * @param {string} archiveUrl URL de la Wayback Machine
 * @returns {Object} Datos estructurados de la canción o lista de versiones
 */
export function parseLaCuerdaPage(html, sourceUrl, archiveUrl) {
  const $ = cheerio.load(html);

  // 1. Verificar si es una página de versión (contiene la tablatura/acordes completa)
  const isVersionPage = $('#t_body').length > 0;

  if (isVersionPage) {
    // Nombre del artista y título
    let title = '';
    let artist = '';

    // Estilo 2025 (ID tH1, con h1 y h2)
    if ($('#tH1').length > 0) {
      title = $('#tH1 h1').text().trim();
      artist = $('#tH1 h2').text().trim();
    }
    // Estilo 2026 (ID t_h1, con enlaces al artista y canción)
    else if ($('#t_h1').length > 0) {
      const links = $('#t_h1 a');
      if (links.length >= 2) {
        artist = $(links[0]).text().trim();
        title = $(links[1]).text().trim();
      } else if (links.length === 1) {
        artist = $(links[0]).text().trim();
      }
    }

    // Limpiar títulos
    if (title && title.includes(' corregir')) {
      title = title.replace(' corregir', '').trim();
    }

    // Extraer número de versión desde la URL (ej: tu_falta_de_querer-5.shtml -> 5)
    let versionNumber = 1;
    const matchVersion = sourceUrl.match(/-(\d+)\.shtml/);
    if (matchVersion) {
      versionNumber = parseInt(matchVersion[1], 10);
    }

    // Extraer tipo de tablatura (otipo), acordes y colaborador desde los scripts
    let type = 'chords';
    let chords = '';
    let contributor = 'Colaborador';

    $('script').each((i, el) => {
      const scriptText = $(el).html() || '';
      
      // Buscar tipo: otipo = 'R' | 'T' | 'B' ...
      const matchTipo = scriptText.match(/otipo\s*=\s*['"]([^'"]+)['"]/);
      if (matchTipo) {
        const t = matchTipo[1];
        if (t === 'R') type = 'chords';      // Letra y Acordes
        else if (t === 'T') type = 'tab';    // Tablatura
        else if (t === 'B') type = 'bass';   // Bajo
        else type = t.toLowerCase();
      }

      // Buscar lista de acordes iniciales: odes = 'Bb G Eb...'
      const matchOdes = scriptText.match(/odes\s*=\s*['"]([^'"]+)['"]/);
      if (matchOdes) {
        chords = matchOdes[1].trim().replace(/@/g, '#');
      }

      // Buscar colaborador: oclb = 'U:lpetronio;lpetronio'
      const matchOclb = scriptText.match(/oclb\s*=\s*['"]([^'"]+)['"]/);
      if (matchOclb) {
        contributor = matchOclb[1].split(';')[0].replace(/^U:/i, '').trim();
      }
    });

    // Extraer y limpiar contenido de la tablatura (<pre id="tCode"> o #t_body pre)
    // El contenedor principal de los acordes suele ser #t_body pre o #tCode
    const $pre = $('#t_body pre').length > 0 ? $('#t_body pre') : $('#tCode');
    
    // Remover divs vacíos de formato si existen
    $pre.find('div').each((i, el) => {
      if ($(el).text().trim() === '') {
        $(el).remove();
      }
    });

    let content = $pre.text();

    // Si odes no estaba en el script, intentar poblarlo extrayendo todos los acordes en links <a>
    if (!chords) {
      const chordsSet = new Set();
      $pre.find('a').each((i, el) => {
        const chord = $(el).text().trim();
        if (chord && chord.length <= 10) {
          chordsSet.add(chord);
        }
      });
      chords = Array.from(chordsSet).join(' ');
    }

    // Si falló la extracción de artista/título desde el DOM, intentar con el <title>
    if (!title || !artist) {
      // Intentar extraer slugs de la URL original para disambiguar
      const urlParts = sourceUrl.replace(/^https?:\/\//i, '').split('/');
      const artistSlug = urlParts[1] ? urlParts[1].toLowerCase() : '';

      const pageTitle = $('title').text(); // "TU FALTA DE QUERER, Mon Laferte: Acordes" o "Mon Laferte, Mi buen amor: Letra y Acordes"
      const parts = pageTitle.split(',');
      if (parts.length >= 2) {
        const partA = parts[0].trim();
        const partB = parts[1].split(':')[0].trim();
        
        // Normalizar fragmentos para comparar con el artistSlug
        const slugA = partA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const slugB = partB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        
        if (slugA === artistSlug || artistSlug.includes(slugA) || slugA.includes(artistSlug)) {
          artist = partA;
          title = partB;
        } else if (slugB === artistSlug || artistSlug.includes(slugB) || slugB.includes(artistSlug)) {
          artist = partB;
          title = partA;
        } else {
          // Fallback clásico
          title = partA;
          artist = partB;
        }
      } else {
        title = pageTitle.split(':')[0].trim();
        artist = 'Desconocido';
      }
    }

    return {
      isVersionPage: true,
      song: {
        artist: artist || 'Desconocido',
        title: title || 'Desconocido',
        version_number: versionNumber,
        type,
        chords: chords || null,
        contributor: contributor || 'Colaborador',
        content: content.trim(),
        source_url: sourceUrl,
        archive_url: archiveUrl
      }
    };
  }

  // 2. Verificar si es una página de lista de versiones (con thumbs de versiones)
  const isList = $('#rThumbs').length > 0;
  if (isList) {
    const versions = [];
    $('#rThumbs ul li').each((i, el) => {
      const $li = $(el);
      const isBest = $li.find('.rtMejor').length > 0;
      const href = $li.find('.rtLabel a').attr('href');
      
      // Determinar tipo a partir de la clase del icono
      const iconClass = $li.find('.tipoIcon').attr('class') || '';
      let type = 'chords';
      if (iconClass.includes('tiR')) type = 'chords';
      else if (iconClass.includes('tiT')) type = 'tab';
      else if (iconClass.includes('tiB')) type = 'bass';

      if (href) {
        // Resolver URL relativa usando URL de origen
        const resolvedUrl = new URL(href, sourceUrl).href;
        versions.push({
          source_url: resolvedUrl,
          isBest,
          type
        });
      }
    });

    return {
      isVersionPage: false,
      versions
    };
  }

  throw new Error('La estructura de la página de LaCuerda no es compatible con el parser.');
}

/**
 * Parsea una página de índice alfabético de LaCuerda.net (ej: /tabs/z/index0.html).
 * Extrae los links a páginas de artistas y detecta si hay una página siguiente.
 *
 * @param {string} html HTML de la página de índice
 * @param {string} baseUrl URL base para resolver hrefs relativos (ej: https://acordes.lacuerda.net/tabs/z/index0.html)
 * @returns {{ artists: Array<{url: string, name: string}>, nextPageUrl: string|null }}
 */
export function parseAlphaIndexPage(html, baseUrl) {
  const $ = cheerio.load(html);
  const artists = [];

  // La lista principal de artistas está en #i_main
  $('#i_main li').each((i, el) => {
    const $a = $(el).find('a').first();
    const href = $a.attr('href');
    if (!href) return;

    // Extraer el nombre del artista: remover "Acordes de " y el sufijo de número de canciones
    let rawText = $a.text().trim();
    rawText = rawText.replace(/^Acordes de\s+/i, '').trim();

    // La URL del artista es relativa (ej: /zabala_y_barrera/ o zabala_y_barrera)
    const resolvedUrl = new URL(href, baseUrl).href;

    artists.push({ url: resolvedUrl, name: rawText });
  });

  // Detectar paginación: buscar link a la siguiente página de índice (index1.html, index2.html…)
  // El patrón es indexN.html donde N > número actual
  const currentMatch = baseUrl.match(/index(\d+)\.html/);
  const currentPage = currentMatch ? parseInt(currentMatch[1], 10) : 0;
  const nextPageUrl = new URL(`index${currentPage + 1}.html`, baseUrl).href;

  // Verificar si la página actual tiene resultados (si no, no hay siguiente)
  const hasResults = artists.length > 0;

  return {
    artists,
    // Retornamos la URL candidata a la siguiente página; el crawler verificará si existe
    nextPageUrl: hasResults ? nextPageUrl : null
  };
}

/**
 * Parsea la página de catálogo de un artista de LaCuerda.net.
 * Extrae los links a páginas de índice de versiones de cada canción.
 *
 * @param {string} html HTML de la página del artista
 * @param {string} baseUrl URL de la página del artista (para resolver hrefs relativos)
 * @returns {{ songs: Array<{url: string, title: string}> }}
 */
export function parseArtistPage(html, baseUrl) {
  const $ = cheerio.load(html);
  const songs = [];
  const seen = new Set();

  // La lista de canciones del artista está en #b_main
  $('#b_main li').each((i, el) => {
    const $a = $(el).find('a').first();
    const href = $a.attr('href');
    if (!href) return;

    // El título de la canción: remover el texto "acordes" o "tab" que sigue en <em>
    let title = $a.clone().find('em').remove().end().text().trim();

    // Resolver URL (puede ser relativa como "amiga_veneno" o "/artista/cancion")
    const resolvedUrl = new URL(href, baseUrl).href;

    // Deduplicar (algunos artistas listan la misma canción dos veces con diferente acento)
    if (!seen.has(resolvedUrl)) {
      seen.add(resolvedUrl);
      songs.push({ url: resolvedUrl, title });
    }
  });

  return { songs };
}
