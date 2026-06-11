import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChordsDatabase } from './database.js';

// Resolver directorios en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar configuración
const configPath = path.resolve('config.json');
if (!fs.existsSync(configPath)) {
  console.error('[ERROR] No se encontró config.json. Ejecuta la inicialización primero.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Inicializar la base de datos
const db = new ChordsDatabase(config.dbPath);
db.init();

// Inicializar Fastify con logs estándar
const fastify = Fastify({
  logger: true
});

// Registrar plugin estático para servir el frontend desde /public
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/'
});

// Endpoint: Obtener listado de canciones con filtro de búsqueda opcional
// GET /api/songs?q=mon
fastify.get('/api/songs', async (request, reply) => {
  const { q } = request.query;
  try {
    const songs = db.searchSongs(q);
    return songs;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al buscar canciones en la base de datos' });
  }
});

// Endpoint: Obtener detalles completos de una canción específica por ID
// GET /api/songs/1
fastify.get('/api/songs/:id', async (request, reply) => {
  const { id } = request.params;
  const songId = parseInt(id, 10);
  
  if (isNaN(songId)) {
    return reply.status(400).send({ error: 'El ID de la canción debe ser un número válido' });
  }

  try {
    const song = db.getSongById(songId);
    if (!song) {
      return reply.status(404).send({ error: 'Canción no encontrada en la base de datos' });
    }
    return song;
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Error al recuperar detalles de la canción' });
  }
});

// Hook de cierre para liberar la conexión SQLite limpiamente
fastify.addHook('onClose', (instance, done) => {
  fastify.log.info('Cerrando conexión de base de datos...');
  db.close();
  done();
});

// Iniciar servidor en el puerto 3000
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('\n==================================================');
    console.log('  VISUALIZADOR INICIADO CORRECTAMENTE             ');
    console.log('  Abre tu navegador en: http://localhost:3000    ');
    console.log('==================================================\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
