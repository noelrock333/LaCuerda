import crypto from 'crypto';

/**
 * Genera un hash seguro para contraseñas usando pbkdf2/scrypt.
 * @param {string} password Contraseña en texto plano
 * @returns {string} Hash formateado 'salt:hash'
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifica si una contraseña coincide con el hash almacenado.
 * @param {string} password Contraseña en texto plano
 * @param {string} storedHash Hash almacenado en formato 'salt:hash'
 * @returns {boolean} True si coincide
 */
export function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}
