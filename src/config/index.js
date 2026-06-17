import fs from 'fs';
import path from 'path';

// Si las variables de entorno de Docker están presentes, las usamos directamente.
// De lo contrario, recurrimos al config.json local (desarrollo sin Docker).
const hasEnvConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;

let config;

if (hasEnvConfig) {
  config = {
    postgres: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '2000', 10),
    userAgent: process.env.USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    downloadAllVersions: process.env.DOWNLOAD_ALL_VERSIONS !== 'false',
  };
} else {
  const configPath = path.resolve('config.json');
  if (!fs.existsSync(configPath)) {
    console.error('[ERROR] No se encontró config.json y tampoco hay variables de entorno configuradas.');
    process.exit(1);
  }
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export default config;
