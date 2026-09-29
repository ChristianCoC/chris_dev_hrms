import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  1: 'Administrador',
  2: 'Recursos Humanos',
  3: 'Líder de Área',
  4: 'Empleado',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('hrms_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('hrms_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyStoredAuth = async () => {
      const storedToken = localStorage.getItem('hrms_token');
      if (storedToken) {
        try {
          const res = await api.get('/api/users/profile');
          if (res.user) {
            setUser((prev) => ({ ...prev, ...res.user }));
            localStorage.setItem('hrms_user', JSON.stringify(res.user));
          }
        } catch {
          // Token expirado o inválido
          logout();
        }
      }
      setLoading(false);
    };

    verifyStoredAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    if (res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('hrms_token', res.token);
      localStorage.setItem('hrms_user', JSON.stringify(res.user));
      return res;
    }
    throw new Error('Respuesta inválida del servidor');
  };

  const register = async (payload) => {
    return await api.post('/api/auth/register', payload);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
  };

  const roleName = user?.role_id ? (ROLE_LABELS[user.role_id] || 'Usuario') : 'Invitado';
  const isAdmin = user?.role_id === 1;
  const isHR = user?.role_id === 2;
  const isAdminOrHR = [1, 2].includes(user?.role_id);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    roleName,
    isAdmin,
    isHR,
    isAdminOrHR,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;
