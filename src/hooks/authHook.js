import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Fastify preHandler hook para autenticar solicitudes HTTP mediante token Bearer.
 * Inserta el userId en request.userId.
 */
export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'No autorizado: falta token' });
    return reply;
  }

  const token = authHeader.substring(7);
  const session = await db.getSession(token);
  if (!session) {
    reply.status(401).send({ error: 'No autorizado: sesión inválida o expirada' });
    return reply;
  }

  request.userId = session.user_id;
}

/**
 * Fastify preHandler hook para autenticar solicitudes que requieren rol de Admin o Mod.
 */
export async function authenticateAdminOrMod(request, reply) {
  await authenticate(request, reply);
  if (reply.sent) return;

  const result = await db.db.execute(sql`SELECT role FROM users WHERE id = ${request.userId} LIMIT 1`);
  const user = result.rows[0];
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    reply.status(403).send({ error: 'No autorizado: se requieren permisos de administrador o moderador' });
    return reply;
  }
}
