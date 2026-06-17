import Fastify from 'fastify';
import { db } from './db/index.js';
import routes from './routes/index.js';
import { hashPassword } from './utils/crypto.js';
import { sql } from 'drizzle-orm';

// Inicializar Fastify con logs estándar
const fastify = Fastify({
  logger: true
});

// Registrar todas las rutas y plugins estáticos
fastify.register(routes);

// Hook de cierre para liberar la conexión PostgreSQL limpiamente
fastify.addHook('onClose', async (instance) => {
  fastify.log.info('Cerrando conexión de base de datos...');
  await db.close();
});

// Iniciar servidor en el puerto 3000
const start = async () => {
  try {
    await db.init();
    
    // Sembrar usuarios de prueba (admin y moderator) si no existen
    try {
      const adminUser = await db.getUserByUsername('admin');
      if (!adminUser) {
        const adminHash = hashPassword('admin123');
        await db.db.execute(sql`
          INSERT INTO users (username, password, role)
          VALUES ('admin', ${adminHash}, 'admin')
        `);
        console.log('[SEED] Creado usuario administrador: admin / admin123');
      }
      
      const modUser = await db.getUserByUsername('moderator');
      if (!modUser) {
        const modHash = hashPassword('mod123');
        await db.db.execute(sql`
          INSERT INTO users (username, password, role)
          VALUES ('moderator', ${modHash}, 'moderator')
        `);
        console.log('[SEED] Creado usuario moderador: moderator / mod123');
      }
    } catch (seedError) {
      console.error('[SEED ERROR] Error al sembrar usuarios por defecto:', seedError.message);
    }

    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log('\n==================================================');
    console.log('  VISUALIZADOR INICIADO CORRECTAMENTE             ');
    console.log(`  Abre tu navegador en: http://localhost:${PORT}    `);
    console.log('==================================================\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
