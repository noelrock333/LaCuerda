/**
 * Convierte un texto en un slug amigable de URL al estilo de LaCuerda.net.
 * Ej. "Mon Laferte" -> "mon_laferte"
 * @param {string} text 
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD') // Quitar acentos y caracteres especiales
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_') // Reemplazar caracteres no alfanuméricos por guion bajo
    .replace(/^_+|_+$/g, ''); // Quitar guiones bajos sobrantes al inicio/final
}

/**
 * Obtiene el slug de una canción a partir de su URL de origen.
 * e.g. https://acordes.lacuerda.net/mon_laferte/tu_falta_de_querer-5.shtml -> tu_falta_de_querer
 * @param {string} sourceUrl
 * @returns {string}
 */
export function getSongSlug(sourceUrl) {
  const parts = sourceUrl.split('/');
  const lastPart = parts[parts.length - 1];
  return lastPart.replace(/-\d+\.shtml$/, '').replace(/\.shtml$/, '');
}
