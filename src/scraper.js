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
  // Intentar primero con la URL de origen
  let snapshot = await queryAvailabilityApi(originalUrl, userAgent);
  if (snapshot) return snapshot;

  // Si falla, alternar el protocolo (de https a http o viceversa) para burlar la intermitencia del API
  const alternatedUrl = originalUrl.startsWith('https://') 
    ? originalUrl.replace(/^https:\/\//i, 'http://')
    : originalUrl.replace(/^http:\/\//i, 'https://');
    
  return await queryAvailabilityApi(alternatedUrl, userAgent);
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
    let title = $('#tH1 h1').text().trim();
    let artist = $('#tH1 h2').text().trim();

    // Limpiar títulos
    if (title.includes(' corregir')) {
      title = title.replace(' corregir', '').trim();
    }

    // Extraer número de versión desde la URL (ej: tu_falta_de_querer-5.shtml -> 5)
    let versionNumber = 1;
    const matchVersion = sourceUrl.match(/-(\d+)\.shtml/);
    if (matchVersion) {
      versionNumber = parseInt(matchVersion[1], 10);
    }

    // Extraer tipo de tablatura (otipo) y acordes desde los scripts
    let type = 'chords';
    let chords = '';

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
      const pageTitle = $('title').text(); // "TU FALTA DE QUERER, Mon Laferte: Acordes"
      const parts = pageTitle.split(',');
      if (parts.length > 0) title = parts[0].trim();
      if (parts[1]) {
        const subParts = parts[1].split(':');
        artist = subParts[0].trim();
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
