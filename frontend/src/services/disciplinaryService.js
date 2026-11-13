import api from '../api/client.js';

export const disciplinaryService = {
  /**
   * Registra una nueva acción o sanción disciplinaria sobre un colaborador (Admin y RRHH).
   */
  createDisciplinaryAction: (data) => api.post('/api/disciplinary', data),

  /**
   * Obtiene el historial disciplinario de un colaborador específico por su UUID.
   * Restringido por RBAC: Dueño del legajo, Administrador y Recursos Humanos.
   */
  getEmployeeDisciplinaryActions: (userId) =>
    api.get(`/api/disciplinary/user/${userId}`),

  /**
   * Obtiene el historial disciplinario del colaborador autenticado en sesión.
   */
  getMyDisciplinaryActions: () => api.get('/api/disciplinary/my-records'),
};

export default disciplinaryService;
