import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import api from '../api/client.js';

export const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/notifications');
      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Consultar periódicamente cada 45 segundos
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar al hacer clic fuera del dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error al marcar notificación:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-label="Abrir centro de notificaciones"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden text-slate-800">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
              <p className="text-xs text-slate-500">
                {unreadCount === 0 ? 'Sin pendientes' : `${unreadCount} no leída${unreadCount > 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={fetchNotifications}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Actualizar
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Cargando notificaciones...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Estás al día</p>
                <p className="text-xs text-slate-400 mt-1">
                  No tienes notificaciones pendientes de lectura en este momento.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors ${
                    item.is_read ? 'bg-white opacity-75' : 'bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-900">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {item.message}
                  </p>
                  {item.claim_title && (
                    <div className="mt-2 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded inline-block">
                      Reclamo: {item.claim_title}
                    </div>
                  )}
                  {!item.is_read && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={(e) => markAsRead(item.id, e)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Check className="w-3 h-3" />
                        Marcar como leída
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
