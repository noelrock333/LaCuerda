// Diccionario de pisadas absolutas para acordes de guitarra estándar (6 cuerdas: Mi-La-Re-Sol-Si-mi)
// 'x' = cuerda silenciada, 0 = cuerda al aire, número = número de traste absoluto.
export const CHORD_DIAGRAMS = {
  // Mayores
  'C': { frets: ['x', 3, 2, 0, 1, 0] },
  'D': { frets: ['x', 'x', 0, 2, 3, 2] },
  'E': { frets: [0, 2, 2, 1, 0, 0] },
  'F': { frets: [1, 3, 3, 2, 1, 1] },
  'G': { frets: [3, 2, 0, 0, 0, 3] },
  'A': { frets: ['x', 0, 2, 2, 2, 0] },
  'B': { frets: ['x', 2, 4, 4, 4, 2] },
  
  'C#': { frets: ['x', 4, 6, 6, 6, 4] },
  'Db': { frets: ['x', 4, 6, 6, 6, 4] },
  'D#': { frets: ['x', 6, 8, 8, 8, 6] },
  'Eb': { frets: ['x', 6, 8, 8, 8, 6] },
  'F#': { frets: [2, 4, 4, 3, 2, 2] },
  'Gb': { frets: [2, 4, 4, 3, 2, 2] },
  'G#': { frets: [4, 6, 6, 5, 4, 4] },
  'Ab': { frets: [4, 6, 6, 5, 4, 4] },
  'A#': { frets: ['x', 1, 3, 3, 3, 1] },
  'Bb': { frets: ['x', 1, 3, 3, 3, 1] },

  // Menores
  'Cm': { frets: ['x', 3, 5, 5, 4, 3] },
  'Dm': { frets: ['x', 'x', 0, 2, 3, 1] },
  'Em': { frets: [0, 2, 2, 0, 0, 0] },
  'Fm': { frets: [1, 3, 3, 1, 1, 1] },
  'Gm': { frets: [3, 5, 5, 3, 3, 3] },
  'Am': { frets: ['x', 0, 2, 2, 1, 0] },
  'Bm': { frets: ['x', 2, 4, 4, 3, 2] },

  'C#m': { frets: ['x', 4, 6, 6, 5, 4] },
  'Dbm': { frets: ['x', 4, 6, 6, 5, 4] },
  'D#m': { frets: ['x', 6, 8, 8, 7, 6] },
  'Ebm': { frets: ['x', 6, 8, 8, 7, 6] },
  'F#m': { frets: [2, 4, 4, 2, 2, 2] },
  'Gbm': { frets: [2, 4, 4, 2, 2, 2] },
  'G#m': { frets: [4, 6, 6, 4, 4, 4] },
  'Abm': { frets: [4, 6, 6, 4, 4, 4] },
  'Bbm': { frets: ['x', 1, 3, 3, 2, 1] },
  'A#m': { frets: ['x', 1, 3, 3, 2, 1] },

  // Séptimas dominantes
  'C7': { frets: ['x', 3, 2, 3, 1, 0] },
  'D7': { frets: ['x', 'x', 0, 2, 1, 2] },
  'E7': { frets: [0, 2, 0, 1, 0, 0] },
  'F7': { frets: [1, 3, 1, 2, 1, 1] },
  'G7': { frets: [3, 2, 0, 0, 0, 1] },
  'A7': { frets: ['x', 0, 2, 0, 2, 0] },
  'B7': { frets: ['x', 2, 1, 2, 0, 2] },

  'C#7': { frets: ['x', 4, 3, 4, 2, 'x'] },
  'D#7': { frets: ['x', 6, 5, 6, 4, 'x'] },
  'Eb7': { frets: ['x', 6, 5, 6, 4, 'x'] },
  'F#7': { frets: [2, 4, 2, 3, 2, 2] },
  'G#7': { frets: [4, 6, 4, 5, 4, 4] },
  'Bb7': { frets: ['x', 1, 3, 1, 3, 1] },

  // Menores Séptimas
  'Cm7': { frets: ['x', 3, 5, 3, 4, 3] },
  'Dm7': { frets: ['x', 'x', 0, 2, 1, 1] },
  'Em7': { frets: [0, 2, 0, 0, 0, 0] },
  'Fm7': { frets: [1, 3, 1, 1, 1, 1] },
  'Gm7': { frets: [3, 5, 3, 3, 3, 3] },
  'Am7': { frets: ['x', 0, 2, 0, 1, 0] },
  'Bm7': { frets: ['x', 2, 4, 2, 3, 2] },

  // Mayores Séptimas
  'Cmaj7': { frets: ['x', 3, 2, 0, 0, 0] },
  'Dmaj7': { frets: ['x', 'x', 0, 2, 2, 2] },
  'Emaj7': { frets: [0, 2, 1, 1, 0, 0] },
  'Fmaj7': { frets: [1, 3, 2, 2, 1, 1] },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2] },
  'Amaj7': { frets: ['x', 0, 2, 1, 2, 0] },
  'Bmaj7': { frets: ['x', 2, 4, 3, 4, 2] },

  // Suspendidos y otros
  'Csus4': { frets: ['x', 3, 3, 0, 1, 1] },
  'Dsus4': { frets: ['x', 'x', 0, 2, 3, 3] },
  'Esus4': { frets: [0, 2, 2, 2, 0, 0] },
  'Gsus4': { frets: [3, 3, 0, 0, 3, 3] },
  'Asus4': { frets: ['x', 0, 2, 2, 3, 0] },
  'Dsus2': { frets: ['x', 'x', 0, 2, 3, 0] },
  'Asus2': { frets: ['x', 0, 2, 2, 0, 0] }
};

/**
 * Normaliza un acorde quitándole partes de bajo invertidas (ej: C/G -> C)
 * y simplificando variaciones no soportadas al acorde base más cercano.
 * @param {string} rawName Nombre original del acorde
 * @returns {string} Nombre normalizado
 */
export function normalizeChordName(rawName) {
  if (!rawName) return '';
  
  // Limpiar espacios y quitar bajos de acordes invertidos
  let name = rawName.trim().split('/')[0];
  
  // Si está en el diccionario, usarlo directo
  if (CHORD_DIAGRAMS[name]) return name;
  
  // Limpiezas comunes
  name = name.replace(/add9|add11|add13/i, '');
  if (CHORD_DIAGRAMS[name]) return name;

  name = name.replace(/sus9/i, 'sus4');
  if (CHORD_DIAGRAMS[name]) return name;

  // Simplificación de 9a o mayores a 7a o mayor7
  if (name.endsWith('9') || name.endsWith('11') || name.endsWith('13')) {
    const base = name.slice(0, -1);
    if (base.endsWith('m')) {
      if (CHORD_DIAGRAMS[base + '7']) return base + '7';
      if (CHORD_DIAGRAMS[base]) return base;
    }
    if (CHORD_DIAGRAMS[base + '7']) return base + '7';
    if (CHORD_DIAGRAMS[base]) return base;
  }
  
  // Simplificar variaciones de 7a menor
  if (name.endsWith('m7/9') || name.endsWith('m7+')) {
    const base = name.split('7')[0] + '7';
    if (CHORD_DIAGRAMS[base]) return base;
  }

  // Quitar 'M' de mayor séptima si se usa 'maj7'
  const matchM7 = name.match(/^([A-G][#b]?)M7$/);
  if (matchM7) {
    const base = matchM7[1] + 'maj7';
    if (CHORD_DIAGRAMS[base]) return base;
  }

  // Si termina con 6, usar el acorde base
  if (name.endsWith('6')) {
    const base = name.slice(0, -1);
    if (CHORD_DIAGRAMS[base]) return base;
  }
  
  // Último recurso: devolver las letras de la raíz musical (ej: C#m7 -> C#m, F#sus4 -> F#)
  const rootMatch = name.match(/^([A-G][#b]?)(m)?/);
  if (rootMatch) {
    const base = rootMatch[1] + (rootMatch[2] || '');
    if (CHORD_DIAGRAMS[base]) return base;
  }
  
  return name;
}

/**
 * Procesa la pisada para calcular el traste inicial y las posiciones relativas de renderizado.
 * @param {string} rawName Nombre del acorde
 * @returns {Object|null} Objeto con las posiciones procesadas
 */
export function getChordFingering(rawName) {
  const name = normalizeChordName(rawName);
  const info = CHORD_DIAGRAMS[name];
  if (!info) return null;

  const frets = info.frets;
  
  // Filtrar los trastes numéricos activos (> 0)
  const activeFrets = frets.filter(f => typeof f === 'number' && f > 0);
  
  let baseFret = 1;
  const maxFret = activeFrets.length > 0 ? Math.max(...activeFrets) : 0;
  
  // Si la pisada usa trastes más altos que el 4, cambiamos el traste base
  if (maxFret > 4) {
    baseFret = Math.min(...activeFrets);
  }

  return {
    name,
    frets,
    baseFret
  };
}
