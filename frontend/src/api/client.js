import ky from 'ky';
import useAuthStore from '../store/useAuthStore.js';

/**
 * Instancia configurada de Ky con interceptores para inyectar token de autenticación
 * y manejar automáticamente redirecciones o cierres de sesión en errores 401.
 */
const client = ky.create({
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = useAuthStore.getState().token;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      }
    ],
    afterResponse: [
      async ({ response }) => {
        if (response?.status === 401) {
          useAuthStore.getState().logout();
        }
        return response;
      }
    ]
  }
});

/**
 * Wrapper de compatibilidad que mantiene la misma interfaz que apiFetch nativo.
 * Convierte el cuerpo stringificado a JSON para que Ky lo maneje y serialice de forma segura.
 */
export async function apiFetch(url, options = {}) {
  try {
    const { method = 'GET', body, headers } = options;
    const kyOptions = {
      method,
      headers,
      // Desactivar reintentos para mutaciones POST/PUT/DELETE
      retry: method === 'GET' ? 1 : 0
    };
    
    if (body) {
      kyOptions.json = JSON.parse(body);
    }
    
    // Ejecutar la petición con la instancia de Ky
    const response = await client(url, kyOptions);
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch (error) {
    // Si Ky arrojó un error HTTP (código no 2xx), parsear el cuerpo del error
    if (error.response) {
      let message = `Error HTTP: ${error.response.status}`;
      try {
        const data = await error.response.json();
        if (data && data.error) {
          message = data.error;
        }
      } catch (e) {
        // No es JSON, ignorar
      }
      throw new Error(message);
    }
    throw error;
  }
}
