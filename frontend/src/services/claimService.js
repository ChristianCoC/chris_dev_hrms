import api from '../api/client.js';

export const claimService = {
  /**
   * Obtiene la lista de reclamos según el rol del usuario en sesión.
   */
  getAll: () => api.get('/api/claims'),

  /**
   * Registra un nuevo reclamo interno.
   */
  create: (data) => api.post('/api/claims', data),

  /**
   * Resuelve o actualiza el estado de un reclamo (Admin y RRHH).
   */
  resolve: (id, data) => api.patch(`/api/claims/${id}/resolve`, data),
};

export default claimService;
