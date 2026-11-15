import api from '../api/client.js';

export const shiftService = {
  /**
   * Obtiene la grilla de turnos según rango de fechas y filtros opcionales.
   * Admin, RRHH y Líder de Área reciben los turnos de los colaboradores (o filtrados).
   * Empleados reciben estrictamente sus propios turnos.
   */
  getShifts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.userId) query.append('userId', params.userId);
    if (params.department) query.append('department', params.department);
    const queryString = query.toString();
    return api.get(`/api/shifts${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Asigna o actualiza un turno laboral de forma atómica.
   */
  assignShift: (data) => api.post('/api/shifts', data),

  /**
   * Elimina la asignación de un turno.
   */
  deleteShift: (id) => api.delete(`/api/shifts/${id}`),
};

export default shiftService;
