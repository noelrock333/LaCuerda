import fs from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');

if (!fs.existsSync(configPath)) {
  console.error('[ERROR] No se encontró config.json. Ejecuta la inicialización primero.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export default config;
