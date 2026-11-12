import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Megaphone,
  Mail,
  FileText,
  ClipboardList,
  Send,
  Users,
  Building2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { notificationService } from '../services/notificationService.js';
import { employeeService } from '../services/employeeService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Modal } from './ui/Modal.jsx';

export const NotificationDropdown = () => {
  const { user, isAdmin, isHR, isAdminOrHR } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Privilegio estricto para emitir comunicados: Exclusivo Administrador (1) y Recursos Humanos (2)
  const canAnnounce =
    Boolean(isAdminOrHR) ||
    user?.role_id === 1 ||
    user?.role_id === 2 ||
    user?.role_name === 'Administrador' ||
    user?.role_name === 'Recursos Humanos';

  // Estado del modal de emisión de comunicados
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [targetType, setTargetType] = useState('all');
  const [targetId, setTargetId] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementType, setAnnouncementType] = useState('announcement');
  const [submitting, setSubmitting] = useState(false);
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementSuccess, setAnnouncementSuccess] = useState('');

  // Lista de colaboradores y departamentos para selección guiada
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getMy();
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
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar lista de empleados al abrir modal de comunicados
  useEffect(() => {
    if (!isAnnouncementModalOpen || !canAnnounce) return;

    const loadEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const res = await employeeService.getAll();
        const raw =
          res?.data?.employees ||
          res?.employees ||
          (Array.isArray(res?.data) ? res.data : []) ||
          (Array.isArray(res) ? res : []);
        const activeList = raw.filter((e) => e.is_active);
        setAvailableEmployees(activeList);

        const depts = Array.from(
          new Set(
            activeList
              .map((e) => e.department)
              .filter((d) => d && typeof d === 'string' && d.trim().length > 0)
          )
        ).sort();
        setAvailableDepartments(depts);
      } catch (err) {
        console.error('Error al cargar empleados para comunicado:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };

    loadEmployees();
  }, [isAnnouncementModalOpen, canAnnounce]);

  const markAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error al marcar notificación:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error al marcar todas como leídas:', err);
    }
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    setAnnouncementError('');
    setAnnouncementSuccess('');

    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setAnnouncementError('El título y el mensaje son obligatorios.');
      return;
    }

    if ((targetType === 'department' || targetType === 'user') && !targetId.trim()) {
      setAnnouncementError(
        targetType === 'department'
          ? 'Por favor selecciona o ingresa un departamento.'
          : 'Por favor selecciona un colaborador destinatario.'
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await notificationService.sendAnnouncement({
        targetType,
        targetId: targetId.trim() || undefined,
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        type: announcementType,
      });

      const successMsg = res.message || 'Comunicado emitido exitosamente.';
      setAnnouncementSuccess(successMsg);

      setTimeout(() => {
        setIsAnnouncementModalOpen(false);
        setAnnouncementTitle('');
        setAnnouncementMessage('');
        setTargetType('all');
        setTargetId('');
        setAnnouncementSuccess('');
      }, 1800);

      await fetchNotifications();
    } catch (err) {
      setAnnouncementError(err.message || 'Error al emitir el comunicado.');
    } finally {
      setSubmitting(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatRelativeTime = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffMinutes < 1) return 'Hace un momento';
    if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const renderTypeIcon = (type) => {
    switch (type) {
      case 'announcement':
        return (
          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <Megaphone className="w-3.5 h-3.5" />
          </div>
        );
      case 'direct_message':
        return (
          <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Mail className="w-3.5 h-3.5" />
          </div>
        );
      case 'request_update':
        return (
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <ClipboardList className="w-3.5 h-3.5" />
          </div>
        );
      case 'claim_update':
        return (
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Campana */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-label="Abrir centro de notificaciones"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Desplegable de Notificaciones */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-100">
          {/* Cabecera del desplegable */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                    {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {unreadCount === 0
                  ? 'Bandeja de avisos al día'
                  : `${unreadCount} pendiente${unreadCount > 1 ? 's' : ''} de lectura`}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  title="Marcar todas como leídas"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-white rounded border border-slate-200 transition-colors"
                >
                  <CheckCheck className="w-3 h-3 text-blue-600" />
                  <span>Leer todas</span>
                </button>
              )}

              {canAnnounce && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setAnnouncementError('');
                    setAnnouncementSuccess('');
                    setIsAnnouncementModalOpen(true);
                  }}
                  title="Emitir nuevo comunicado institucional"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs transition-colors"
                >
                  <Megaphone className="w-3 h-3" />
                  <span>Comunicado</span>
                </button>
              )}
            </div>
          </div>

          {/* Lista de Notificaciones */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Cargando notificaciones...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCheck className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Estás al día</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  No tienes avisos pendientes de lectura en este momento.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors relative flex items-start gap-3 ${
                    item.is_read
                      ? 'bg-white hover:bg-slate-50/60 opacity-80'
                      : 'bg-blue-50/40 hover:bg-blue-50/70 border-l-3 border-l-blue-600'
                  }`}
                >
                  {/* Ícono temático */}
                  {renderTypeIcon(item.type)}

                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs tracking-tight line-clamp-1 ${
                          item.is_read
                            ? 'font-medium text-slate-800'
                            : 'font-bold text-slate-900'
                        }`}
                      >
                        {item.title || 'Aviso del sistema'}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed break-words">
                      {item.message}
                    </p>

                    {/* Metadatos adicionales: Remitente / Reclamo */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      {item.sender_name && (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>Por: {item.sender_name}</span>
                        </span>
                      )}

                      {item.claim_title && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Reclamo: {item.claim_title}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acción individual: Marcar como leída */}
                  {!item.is_read && (
                    <button
                      onClick={(e) => markAsRead(item.id, e)}
                      title="Marcar como leída"
                      className="text-slate-400 hover:text-blue-600 p-1 hover:bg-blue-100/50 rounded transition-colors self-start shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Emisión de Comunicados (Admin / RRHH) */}
      <Modal
        isOpen={isAnnouncementModalOpen}
        onClose={() => {
          if (!submitting) {
            setIsAnnouncementModalOpen(false);
            setAnnouncementError('');
            setAnnouncementSuccess('');
          }
        }}
        title="Emitir Nuevo Comunicado"
        subtitle="Envía notificaciones organizacionales o mensajes a colaboradores activos."
        icon={Megaphone}
        maxWidth="max-w-lg"
        preventClose={submitting}
      >
        {announcementError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{announcementError}</span>
          </div>
        )}

        {announcementSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{announcementSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSendAnnouncement} className="space-y-4">
          {/* Tipo de Destinatarios */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alcance de destinatarios
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType('all');
                  setTargetId('');
                  setAnnouncementType('announcement');
                }}
                className={`px-3 py-2 rounded-lg border text-xs font-medium text-center transition-colors ${
                  targetType === 'all'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Toda la empresa
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType('department');
                  setTargetId('');
                  setAnnouncementType('announcement');
                }}
                className={`px-3 py-2 rounded-lg border text-xs font-medium text-center transition-colors ${
                  targetType === 'department'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Por Departamento
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType('user');
                  setTargetId('');
                  setAnnouncementType('direct_message');
                }}
                className={`px-3 py-2 rounded-lg border text-xs font-medium text-center transition-colors ${
                  targetType === 'user'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Colaborador único
              </button>
            </div>
          </div>

          {/* Selector de Departamento */}
          {targetType === 'department' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecciona el Departamento
              </label>
              {availableDepartments.length > 0 ? (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Elige un departamento --</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ej: Operaciones, Recursos Humanos, Sistemas"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                />
              )}
            </div>
          )}

          {/* Selector de Colaborador Específico */}
          {targetType === 'user' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecciona al colaborador destinatario
              </label>
              {loadingEmployees ? (
                <p className="text-xs text-slate-400">Cargando nómina activa...</p>
              ) : (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Selecciona un colaborador --</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.email})
                      {emp.file_number ? ` - Legajo #${emp.file_number}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Título / Asunto */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Título del comunicado / Asunto
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {announcementTitle.length}/150
              </span>
            </div>
            <input
              type="text"
              placeholder="Ej: Mantenimiento programado de servidores este viernes"
              value={announcementTitle}
              onChange={(e) => {
                if (e.target.value.length <= 150) {
                  setAnnouncementTitle(e.target.value);
                }
              }}
              required
              maxLength={150}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
            />
          </div>

          {/* Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Cuerpo del mensaje
              </label>
              <span
                className={`text-[10px] font-mono ${
                  announcementMessage.length >= 1000
                    ? 'text-rose-600 font-bold'
                    : 'text-slate-400'
                }`}
              >
                {announcementMessage.length}/1000
              </span>
            </div>
            <textarea
              rows={4}
              placeholder="Escribe detalladamente las instrucciones o el comunicado institucional..."
              value={announcementMessage}
              onChange={(e) => {
                if (e.target.value.length <= 1000) {
                  setAnnouncementMessage(e.target.value);
                }
              }}
              required
              maxLength={1000}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
            />
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAnnouncementModalOpen(false)}
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Emitiendo...' : 'Enviar comunicado'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default NotificationDropdown;
