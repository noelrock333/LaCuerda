import crypto from 'crypto';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { sql } from 'drizzle-orm';

export class AuthService {
  static async register({ username, password }) {
    if (!username || !password) {
      throw { status: 400, message: 'Usuario y contraseña son requeridos' };
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      throw { status: 400, message: 'El nombre de usuario debe tener al menos 3 caracteres' };
    }

    const existingUser = await db.getUserByUsername(cleanUsername);
    if (existingUser) {
      throw { status: 400, message: 'El nombre de usuario ya está registrado' };
    }

    const passwordHash = hashPassword(password);
    const user = await db.createUser(cleanUsername, passwordHash);

    // Crear sesión automática al registrarse
    const token = crypto.randomUUID();
    await db.createSession(token, user.id);

    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }

  static async login({ username, password }) {
    if (!username || !password) {
      throw { status: 400, message: 'Usuario y contraseña son requeridos' };
    }

    const user = await db.getUserByUsername(username.trim());
    if (!user) {
      throw { status: 400, message: 'Credenciales inválidas' };
    }

    const isMatch = verifyPassword(password, user.password);
    if (!isMatch) {
      throw { status: 400, message: 'Credenciales inválidas' };
    }

    const token = crypto.randomUUID();
    await db.createSession(token, user.id);

    return { token, user: { id: user.id, username: user.username, role: user.role } };
  }

  static async logout(token) {
    if (token) {
      await db.deleteSession(token);
    }
    return { success: true };
  }

  static async getMe(userId) {
    const result = await db.db.execute(sql`SELECT id, username, role FROM users WHERE id = ${userId} LIMIT 1`);
    const user = result.rows[0];
    if (!user) {
      throw { status: 404, message: 'Usuario no encontrado' };
    }
    return { user: { id: user.id, username: user.username, role: user.role } };
  }
}
