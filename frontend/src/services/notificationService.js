import api from '../api/client.js';

export const notificationService = {
  /**
   * Obtiene las notificaciones del usuario en sesión.
   */
  getMy: () => api.get('/api/notifications'),

  /**
   * Marca una notificación como leída.
   */
  markAsRead: (id) => api.patch(`/api/notifications/${id}/read`),
};

export default notificationService;
