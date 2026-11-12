import api from '../api/client.js';

export const authService = {
  /**
   * Autentica a un usuario con email y contraseña.
   */
  login: (email, password) => api.post('/api/auth/login', { email, password }),

  /**
   * Obtiene el perfil del usuario autenticado.
   */
  getProfile: () => api.get('/api/users/profile'),

  /**
   * Activa la cuenta de un colaborador mediante token e instala su clave definitiva.
   */
  activateAccount: (token, password) =>
    api.post('/api/auth/activate', { token, password }),

  /**
   * Solicita el enlace de recuperación de contraseña.
   */
  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }),

  /**
   * Registro de usuario (en desuso / legado).
   */
  register: (payload) => api.post('/api/auth/register', payload),

  /**
   * Restablece la contraseña mediante un token de recuperación válido.
   */
  resetPassword: (token, password) =>
    api.post('/api/auth/reset-password', { token, password }),
};

export default authService;
