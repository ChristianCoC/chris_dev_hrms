import api from '../api/client.js';

export const auditService = {
  /**
   * Obtiene registros de auditoría paginados con filtros opcionales.
   */
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.action) query.append('action', params.action);
    if (params.entity_type) query.append('entity_type', params.entity_type);
    const queryString = query.toString();
    return api.get(`/api/audit-logs${queryString ? `?${queryString}` : ''}`);
  },
};

export default auditService;
