import { AuthController } from '../../controllers/authController.js';
import { authenticate } from '../../hooks/authHook.js';

export default async function authRoutes(fastify, options) {
  fastify.post('/register', AuthController.register);
  fastify.post('/login', AuthController.login);
  fastify.post('/logout', AuthController.logout);
  fastify.get('/me', { preHandler: authenticate }, AuthController.me);
}
