const BASE_URL = import.meta.env.VITE_API_URL || '';

export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('hrms_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Si se solicita respuesta en blob
  if (options.responseType === 'blob') {
    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.message || `Error en la solicitud (${response.status})`);
    }
    return await response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      // Si el token expira o no es válido, limpiar sesión
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    const errorMsg = data.message || `Error en la solicitud (${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
};

export const api = {
  get: (endpoint, options = {}) => apiFetch(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      method: 'POST',
      body: typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      method: 'PUT',
      body: typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  patch: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      method: 'PATCH',
      body: typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  delete: (endpoint, options = {}) => apiFetch(endpoint, { method: 'DELETE', ...options }),
};

export default api;
