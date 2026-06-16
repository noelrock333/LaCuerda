/**
 * Genera la cabecera en formato ASCII tradicional para el visor en texto plano.
 * @param {Object} song Datos del tema
 * @returns {string} Cabecera formateada
 */
export function generateTxtHeaderBackend(song) {
  const lineLength = 70;
  
  const padLine = (label, value) => {
    const cleanVal = (value || '').toUpperCase();
    const contentStr = `| ${label}: ${cleanVal}`;
    const spacesNeed = lineLength - contentStr.length - 1;
    return contentStr + ' '.repeat(Math.max(0, spacesNeed)) + '|';
  };

  const titleLine = "|           TABLATURAS Y ACORDES DE MÚSICA EN ESPAÑOL                |";
  const middleBorder = "+-------------------------- lacuerda.net ----------------------------+";
  const headerBorder = "======================================================================";
  
  let idCode = song.song_code || 'version';
  if (!idCode && song.source_url) {
    const parts = song.source_url.split('/');
    const filePart = parts[parts.length - 1].replace(/\.shtml$/, '');
    idCode = filePart;
  }
  const typeLabel = (song.type || 'chords').toUpperCase() === 'TAB' ? 'TAB' : 'ACO';
  
  const versionLabel = `-${typeLabel}-${idCode}-+`;
  const neededDashes = lineLength - versionLabel.length;
  let dividerLine = '+';
  if (neededDashes > 1) {
    dividerLine += '-'.repeat(neededDashes - 1) + versionLabel;
  } else {
    dividerLine = `+-------------------------------------------------------${typeLabel}-${idCode}-+`;
  }
  
  if (dividerLine.length > 70) {
    dividerLine = dividerLine.substring(0, 69) + '+';
  } else if (dividerLine.length < 70) {
    dividerLine = dividerLine.substring(0, dividerLine.length - 1) + '-'.repeat(70 - dividerLine.length) + '+';
  }

  const headerLines = [
    headerBorder,
    titleLine,
    middleBorder,
    padLine("ARTISTA", song.artist),
    padLine("CANCION", song.title)
  ];

  if (song.composers) {
    headerLines.push(padLine("AUTOR", song.composers));
  }
  if (song.album) {
    const albumVal = song.album + (song.year ? ` [${song.year}]` : '');
    headerLines.push(padLine("ALBUM", albumVal));
  }

  headerLines.push(dividerLine);
  headerLines.push(padLine("TRANS", song.contributor));
  headerLines.push(headerBorder);

  return headerLines.join('\n');
}
