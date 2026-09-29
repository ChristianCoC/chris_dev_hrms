import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Users, FileText, ShieldAlert, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';

export const Navbar = () => {
  const { user, roleName, isAdminOrHR, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
    }`;

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white tracking-wider text-sm shadow-sm">
                HR
              </div>
              <div>
                <span className="font-semibold text-base tracking-tight text-white">
                  HRMS
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs text-slate-400 border-l border-slate-700 pl-2">
                  Gestión Organizacional
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/claims" className={navLinkClass}>
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Reclamos</span>
              </NavLink>

              {isAdminOrHR && (
                <>
                  <NavLink to="/employees" className={navLinkClass}>
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Personal</span>
                  </NavLink>

                  <NavLink to="/audit-logs" className={navLinkClass}>
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Auditoría</span>
                  </NavLink>
                </>
              )}
            </nav>
          </div>

          {/* Right Section: Notifications & User Profile */}
          <div className="flex items-center gap-4">
            <NotificationDropdown />

            {/* User Info */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-white">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="text-[11px] text-slate-400">
                {roleName}
              </span>
            </div>

            {/* Logout CTA */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center gap-2 py-2 border-t border-slate-800 overflow-x-auto">
          <NavLink to="/claims" className={navLinkClass}>
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Reclamos</span>
          </NavLink>

          {isAdminOrHR && (
            <>
              <NavLink to="/employees" className={navLinkClass}>
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Personal</span>
              </NavLink>

              <NavLink to="/audit-logs" className={navLinkClass}>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Auditoría</span>
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
