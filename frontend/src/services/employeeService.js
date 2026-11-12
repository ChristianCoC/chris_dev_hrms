import api from '../api/client.js';

export const employeeService = {
  /**
   * Obtiene lista de empleados con filtros opcionales (search, department, role_id).
   */
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.department) query.append('department', params.department);
    if (params.role_id) query.append('role_id', params.role_id);
    const queryString = query.toString();
    return api.get(`/api/employees${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Obtiene métricas de empleados para el panel de RRHH.
   */
  getStats: () => api.get('/api/employees/stats'),

  /**
   * Obtiene detalle de un colaborador por ID.
   */
  getById: (id) => api.get(`/api/employees/${id}`),

  /**
   * Da de alta un nuevo empleado (Admin).
   */
  create: (data) => api.post('/api/employees', data),

  /**
   * Actualiza datos de RRHH del colaborador.
   */
  update: (id, data) => api.put(`/api/employees/${id}`, data),

  /**
   * Reenvía enlace de invitación/activación (Admin).
   */
  resendInvitation: (id) => api.post(`/api/employees/${id}/resend-invitation`),

  /**
   * Da de baja lógica a un colaborador (Admin).
   */
  deactivate: (id) => api.patch(`/api/employees/${id}/deactivate`),
};

export default employeeService;
