import { AuthService } from '../services/authService.js';

export class AuthController {
  static async register(request, reply) {
    try {
      const result = await AuthService.register(request.body || {});
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al registrar el usuario' });
    }
  }
  
  static async login(request, reply) {
    try {
      const result = await AuthService.login(request.body || {});
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al iniciar sesión' });
    }
  }

  static async logout(request, reply) {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    try {
      const result = await AuthService.logout(token);
      return result;
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Error al cerrar sesión' });
    }
  }

  static async me(request, reply) {
    try {
      const result = await AuthService.getMe(request.userId);
      return result;
    } catch (error) {
      request.log.error(error);
      const status = error.status || 500;
      reply.status(status).send({ error: error.message || 'Error al validar sesión' });
    }
  }
}
