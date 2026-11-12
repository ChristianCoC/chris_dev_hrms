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
   * Admite tanto un objeto JSON simple como FormData (multipart/form-data) con archivo adjunto.
   */
  create: (data) => api.post('/api/requests', data),

  /**
   * Actualiza el estado de una solicitud (Aprobar / Rechazar con notas).
   */
  updateStatus: (id, data) => api.patch(`/api/requests/${id}/status`, data),

  /**
   * Descarga de forma autenticada el archivo adjunto de una solicitud.
   */
  downloadAttachment: async (requestId, fileName) => {
    const blob = await api.get(`/api/requests/${requestId}/attachment`, {
      responseType: 'blob',
    });

    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName || `adjunto_solicitud_${requestId}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
    return true;
  },
};

export default requestService;
