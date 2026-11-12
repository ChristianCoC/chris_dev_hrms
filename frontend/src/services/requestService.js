import api from '../api/client.js';

export const requestService = {
  /**
   * Obtiene las solicitudes del usuario autenticado en sesión.
   */
  getMy: () => api.get('/api/requests/my'),

  /**
   * Obtiene todas las solicitudes de la empresa (Admin y RRHH) con filtros opcionales.
   */
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.type && params.type !== 'all') query.append('type', params.type);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    const queryString = query.toString();
    return api.get(`/api/requests${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Registra una nueva solicitud operativa.
   */
  create: (data) => api.post('/api/requests', data),

  /**
   * Actualiza el estado de una solicitud (Aprobar / Rechazar con notas).
   */
  updateStatus: (id, data) => api.patch(`/api/requests/${id}/status`, data),
};

export default requestService;
