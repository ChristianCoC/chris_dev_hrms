import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import LoginPage from './pages/LoginPage.jsx';

import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ClaimsPage from './pages/ClaimsPage.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';

const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
};

export const App = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Iniciando aplicación HRMS...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/claims" replace /> : <LoginPage />}
      />

      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/claims" replace /> : <ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={isAuthenticated ? <Navigate to="/claims" replace /> : <ResetPasswordPage />}
      />

      {/* Rutas Protegidas dentro de AppLayout */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/claims"
          element={
            <AppLayout>
              <ClaimsPage />
            </AppLayout>
          }
        />
      </Route>

      {/* Rutas Protegidas Exclusivas de RRHH y Administración (Roles 1 y 2) */}
      <Route element={<ProtectedRoute allowedRoles={[1, 2]} />}>
        <Route
          path="/employees"
          element={
            <AppLayout>
              <EmployeesPage />
            </AppLayout>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <AppLayout>
              <AuditLogsPage />
            </AppLayout>
          }
        />
      </Route>

      {/* Redirección por defecto */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? "/claims" : "/login"} replace />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/claims" : "/login"} replace />}
      />
    </Routes>
  );
};

export default App;
