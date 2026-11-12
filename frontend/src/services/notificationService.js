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

  /**
   * Marca todas las notificaciones pendientes como leídas.
   */
  markAllAsRead: () => api.patch('/api/notifications/read-all'),

  /**
   * Emite un comunicado institucional o mensaje (Admin / RRHH).
   * @param {Object} data { targetType, targetId, title, message, type }
   */
  sendAnnouncement: (data) => api.post('/api/notifications/announce', data),
};

export default notificationService;
