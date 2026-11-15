import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  User,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Filter,
  Coffee,
  CalendarOff,
  Sparkles,
  Building2,
  Search,
  Edit3,
  Calendar as CalendarIcon,
  HelpCircle,
  ShieldAlert,
  Lock,
  FileDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { shiftService } from '../services/shiftService.js';
import { employeeService } from '../services/employeeService.js';
import { Modal, EmptyState } from '../components/ui/index.js';
import { exportPersonalShiftsPdf, exportMatrixShiftsPdf } from '../utils/shiftExportPdf.js';

// Configuración visual por tipo de turno
const SHIFT_TYPE_CONFIG = {
  trabajo: {
    label: 'Trabajo',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headerBg: 'bg-blue-50 border-blue-200',
    icon: Clock,
  },
  franco: {
    label: 'Franco',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-emerald-50 border-emerald-200',
    icon: Coffee,
  },
  licencia: {
    label: 'Licencia',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    headerBg: 'bg-amber-50 border-amber-200',
    icon: CalendarOff,
  },
  feriado: {
    label: 'Feriado',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    headerBg: 'bg-purple-50 border-purple-200',
    icon: Sparkles,
  },
};

/**
 * Matriz de Seguridad Jerárquica RBAC:
 * - Admin (role_id 1): true para todos (incluido a sí mismo).
 * - RRHH (role_id 2): targetEmployee.id !== currentUser.id && targetEmployee.role_id > 2 (roles 3 y 4).
 * - Líder (role_id 3): targetEmployee.id !== currentUser.id && targetEmployee.role_id === 4 (rol 4).
 * - Empleado (role_id 4): false.
 */
export const canManageEmployeeShifts = (currentUser, targetEmployee) => {
  if (!currentUser || !targetEmployee) return false;
  const cRole = Number(currentUser.role_id);
  const tRole = Number(targetEmployee.role_id);
  const isSelf = String(currentUser.id) === String(targetEmployee.id);

  if (cRole === 1) return true;
  if (cRole === 2) return !isSelf && tRole > 2;
  if (cRole === 3) return !isSelf && tRole === 4;
  return false;
};

// Obtener el lunes de la semana correspondiente a una fecha
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 es Domingo, 1 es Lunes...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Formatear Date a 'YYYY-MM-DD' en tiempo local
function formatDateYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Normalizar fecha de BD ('YYYY-MM-DD' o ISO) a 'YYYY-MM-DD'
function normalizeDateStr(rawDate) {
  if (!rawDate) return '';
  if (typeof rawDate === 'string') {
    return rawDate.slice(0, 10);
  }
  if (rawDate instanceof Date) {
    return formatDateYMD(rawDate);
  }
  return String(rawDate).slice(0, 10);
}

// Formatear etiqueta de rango de semana en español
function formatWeekLabel(mondayDate, sundayDate) {
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  const m1 = months[mondayDate.getMonth()];
  const m2 = months[sundayDate.getMonth()];
  const y1 = mondayDate.getFullYear();
  const y2 = sundayDate.getFullYear();

  if (y1 === y2) {
    if (m1 === m2) {
      return `Lun ${mondayDate.getDate()} – Dom ${sundayDate.getDate()} ${m1} ${y1}`;
    }
    return `Lun ${mondayDate.getDate()} ${m1} – Dom ${sundayDate.getDate()} ${m2} ${y1}`;
  }
  return `Lun ${mondayDate.getDate()} ${m1} ${y1} – Dom ${sundayDate.getDate()} ${m2} ${y2}`;
}

export const ShiftsPage = () => {
  const { user } = useAuth();
  const roleId = Number(user?.role_id);
  const canPlan = [1, 2, 3].includes(roleId); // Admin (1), RRHH (2) y Líder de Área (3)
  const isLeader = roleId === 3;

  // Vista activa: quienes pueden planificar pueden alternar entre matriz general y vista personal
  const [activeTab, setActiveTab] = useState(canPlan ? 'matrix' : 'personal');

  // Estado de navegación de la semana activa (almacena el Lunes)
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));

  // Lista de turnos obtenidos de la API
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Lista de colaboradores (para roles de planificación en la matriz y el modal)
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Filtros para la matriz general
  const [searchEmployee, setSearchEmployee] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Modal de asignación / edición de turno
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null); // Si es null, es creación
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Formulario del modal
  const [formData, setFormData] = useState({
    user_id: '',
    shift_date: '',
    shift_type: 'trabajo',
    start_time: '08:00',
    end_time: '16:00',
    location: '',
    notes: '',
  });

  // Cálculo de los 7 días de la semana activa (Lunes a Domingo)
  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      const dateStr = formatDateYMD(d);
      days.push({
        dateObj: d,
        dateStr,
        dayName: dayNames[i],
        shortDay: dayNames[i].slice(0, 3),
        dayNumber: d.getDate(),
        monthNumber: d.getMonth() + 1,
        isToday: dateStr === formatDateYMD(new Date()),
      });
    }
    return days;
  }, [currentMonday]);

  const sundayDate = useMemo(() => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + 6);
    return d;
  }, [currentMonday]);

  const weekLabel = useMemo(() => {
    return formatWeekLabel(currentMonday, sundayDate);
  }, [currentMonday, sundayDate]);

  // Cargar lista de colaboradores para todos los roles con permisos de planificación (1, 2 y 3)
  useEffect(() => {
    if (!canPlan) return;

    let isMounted = true;
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const res = await employeeService.getAll();
        const raw =
          res?.data?.employees ||
          res?.employees ||
          (Array.isArray(res?.data) ? res.data : []) ||
          (Array.isArray(res) ? res : []);
        if (isMounted) {
          // Filtrar colaboradores activos
          const activeOnes = (Array.isArray(raw) ? raw : []).filter(
            (e) => e.is_active !== false
          );
          setEmployees(activeOnes);
        }
      } catch (err) {
        console.error('Error al cargar empleados para la grilla:', err);
      } finally {
        if (isMounted) setLoadingEmployees(false);
      }
    };

    fetchEmployees();
    return () => {
      isMounted = false;
    };
  }, [canPlan]);

  // Cargar turnos para la semana activa
  const fetchShifts = async () => {
    try {
      setLoading(true);
      setError('');
      const startDate = formatDateYMD(currentMonday);
      const endDate = formatDateYMD(sundayDate);

      const params = { startDate, endDate };
      if (canPlan && activeTab === 'matrix' && departmentFilter) {
        params.department = departmentFilter;
      }

      const res = await shiftService.getShifts(params);
      const rawShifts =
        res?.data?.shifts ||
        res?.shifts ||
        (Array.isArray(res?.data) ? res.data : []) ||
        (Array.isArray(res) ? res : []);
      setShifts(Array.isArray(rawShifts) ? rawShifts : []);
    } catch (err) {
      console.error('Error al obtener turnos:', err);
      setError(err?.response?.data?.message || err.message || 'Error al cargar los turnos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [currentMonday, departmentFilter, activeTab]);

  // Navegación de semana
  const handlePrevWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(prev.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Mapa de turnos indexado por [userId_YYYY-MM-DD]
  const shiftsMap = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      const dStr = normalizeDateStr(s.shift_date);
      const key = `${s.user_id}_${dStr}`;
      map.set(key, s);
    }
    return map;
  }, [shifts]);

  // Turnos personales del usuario en sesión
  const myPersonalShifts = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      if (s.user_id === user?.id) {
        const dStr = normalizeDateStr(s.shift_date);
        map.set(dStr, s);
      }
    }
    return map;
  }, [shifts, user]);

  // Colaboradores visibles en la matriz según permisos jerárquicos de visualización:
  // - Admin (1): todos
  // - RRHH (2): él mismo + roles 3 y 4
  // - Líder (3): él mismo + rol 4
  const visibleEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (roleId === 1) return true;
      if (roleId === 2) {
        return String(emp.id) === String(user?.id) || Number(emp.role_id) > 2;
      }
      if (roleId === 3) {
        return String(emp.id) === String(user?.id) || Number(emp.role_id) === 4;
      }
      return String(emp.id) === String(user?.id);
    });
  }, [employees, roleId, user]);

  // Lista de colaboradores filtrados por búsqueda y departamento
  const filteredEmployees = useMemo(() => {
    return visibleEmployees.filter((emp) => {
      if (departmentFilter && emp.department !== departmentFilter) {
        return false;
      }
      if (searchEmployee) {
        const term = searchEmployee.toLowerCase();
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
        const fileNum = (emp.file_number || '').toLowerCase();
        const docNum = (emp.document_number || '').toLowerCase();
        return (
          fullName.includes(term) ||
          fileNum.includes(term) ||
          docNum.includes(term)
        );
      }
      return true;
    });
  }, [visibleEmployees, departmentFilter, searchEmployee]);

  // Colaboradores a los que el usuario logueado TIENE PERMISO de gestionar horarios
  const assignableEmployees = useMemo(() => {
    return employees.filter((emp) => canManageEmployeeShifts(user, emp));
  }, [employees, user]);

  // Departamentos únicos para el filtro
  const departments = useMemo(() => {
    const depts = new Set();
    visibleEmployees.forEach((e) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [visibleEmployees]);

  // Abrir modal para crear turno en un slot específico
  const handleOpenCreateModal = (preselectedUserId = '', preselectedDate = '') => {
    setEditingShift(null);
    setModalError('');
    setFormData({
      user_id: preselectedUserId || (assignableEmployees[0]?.id || ''),
      shift_date: preselectedDate || formatDateYMD(currentMonday),
      shift_type: 'trabajo',
      start_time: '08:00',
      end_time: '16:00',
      location: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar turno existente
  const handleOpenEditModal = (shift) => {
    setEditingShift(shift);
    setModalError('');
    const dStr = normalizeDateStr(shift.shift_date);
    setFormData({
      user_id: shift.user_id,
      shift_date: dStr,
      shift_type: shift.shift_type || 'trabajo',
      start_time: shift.start_time ? shift.start_time.slice(0, 5) : '08:00',
      end_time: shift.end_time ? shift.end_time.slice(0, 5) : '16:00',
      location: shift.location || '',
      notes: shift.notes || '',
    });
    setIsModalOpen(true);
  };

  // Verificar si un turno es bloqueado para edición por el Líder de Área (licencia/feriado)
  const isShiftLockedForLeader = Boolean(
    isLeader && editingShift && ['licencia', 'feriado'].includes(editingShift.shift_type)
  );

  // Manejar guardado (asignación o actualización)
  const handleSubmitShift = async (e) => {
    e.preventDefault();
    setModalError('');

    if (isShiftLockedForLeader) {
      setModalError(
        'Los turnos de tipo licencia o feriado son gestionados exclusivamente por RRHH y Administración y no pueden ser modificados por un Líder de Área.'
      );
      return;
    }

    if (!formData.user_id) {
      setModalError('Debes seleccionar un colaborador.');
      return;
    }
    if (!formData.shift_date) {
      setModalError('Debes seleccionar una fecha.');
      return;
    }

    if (isLeader && !['trabajo', 'franco'].includes(formData.shift_type)) {
      setModalError('Los Líderes de Área solo pueden asignar turnos de trabajo o francos.');
      return;
    }

    if (formData.shift_type === 'trabajo') {
      if (!formData.start_time || !formData.end_time) {
        setModalError('Para turnos de trabajo, los horarios de entrada y salida son obligatorios.');
        return;
      }
      if (formData.start_time === formData.end_time) {
        setModalError('El horario de entrada y de salida no pueden ser idénticos.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        user_id: formData.user_id,
        shift_date: formData.shift_date,
        shift_type: formData.shift_type,
        start_time: formData.shift_type === 'trabajo' ? formData.start_time : null,
        end_time: formData.shift_type === 'trabajo' ? formData.end_time : null,
        location: formData.location || null,
        notes: formData.notes || null,
      };

      await shiftService.assignShift(payload);
      setSuccessMessage(
        editingShift
          ? 'Turno actualizado con éxito.'
          : 'Turno asignado exitosamente.'
      );
      setTimeout(() => setSuccessMessage(''), 4000);
      setIsModalOpen(false);
      await fetchShifts();
    } catch (err) {
      console.error('Error al guardar turno:', err);
      setModalError(
        err?.response?.data?.message || err.message || 'Error al guardar el turno.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Manejar eliminación de asignación
  const handleDeleteShift = async () => {
    if (!editingShift) return;

    if (isShiftLockedForLeader) {
      setModalError(
        'Los Líderes de Área no pueden eliminar turnos de tipo licencia o feriado.'
      );
      return;
    }

    if (!window.confirm('¿Confirmas que deseas eliminar la asignación de este turno?')) {
      return;
    }

    try {
      setDeleting(true);
      await shiftService.deleteShift(editingShift.id);
      setSuccessMessage('Asignación de turno eliminada con éxito.');
      setTimeout(() => setSuccessMessage(''), 4000);
      setIsModalOpen(false);
      await fetchShifts();
    } catch (err) {
      console.error('Error al eliminar turno:', err);
      setModalError(
        err?.response?.data?.message || err.message || 'Error al eliminar el turno.'
      );
    } finally {
      setDeleting(false);
    }
  };

  // Manejar descarga en formato PDF según vista activa
  const handleExportPdf = () => {
    if (activeTab === 'personal' || !canPlan) {
      exportPersonalShiftsPdf({
        user,
        weekDays,
        weekLabel,
        shifts: Array.from(myPersonalShifts.values()),
      });
    } else {
      exportMatrixShiftsPdf({
        weekDays,
        weekLabel,
        employees: filteredEmployees,
        shiftsMap,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Cabecera Principal con Alto Contraste y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Horarios y Turnos Laborales
              </h1>
              <p className="text-xs text-slate-500">
                Planificación semanal de turnos, francos, licencias y feriados
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales: Descarga PDF y Asignar Turno */}
        <div className="flex items-center gap-2">
          {/* Botón de Descarga PDF para todos los rangos */}
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors"
            title="Descargar Horario en PDF"
          >
            <FileDown className="w-4 h-4 text-blue-600" />
            <span>Descargar Horario (PDF)</span>
          </button>

          {canPlan && assignableEmployees.length > 0 && (
            <button
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Asignar Turno</span>
            </button>
          )}
        </div>
      </div>

      {/* Alertas globales de éxito o error */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selector de Semana y Vistas */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Controles de semana */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleCurrentWeek}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
          >
            Hoy
          </button>

          <button
            onClick={handleNextWeek}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Semana siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="ml-2 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-800">
              {weekLabel}
            </span>
          </div>
        </div>

        {/* Pestañas de Vista para Roles de Planificación (Admin, RRHH y Líder de Área) */}
        {canPlan && (
          <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start md:self-auto">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Planificación General
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'personal'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mi Grilla Semanal
            </button>
          </div>
        )}
      </div>

      {/* CONTENIDO: VISTA PERSONAL (Para Empleados o Administradores/Líderes en tab personal) */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Mi Grilla Semanal de Trabajo
            </h2>
            <span className="text-xs text-slate-500">
              7 días de la semana
            </span>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const shift = myPersonalShifts.get(day.dateStr);
                const typeCfg = shift ? SHIFT_TYPE_CONFIG[shift.shift_type] : null;
                const IconComponent = typeCfg?.icon || CalendarDays;

                return (
                  <div
                    key={day.dateStr}
                    className={`rounded-xl border transition-shadow bg-white flex flex-col ${
                      day.isToday
                        ? 'border-blue-400 ring-2 ring-blue-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Encabezado del día */}
                    <div
                      className={`px-3 py-2 border-b rounded-t-xl flex items-center justify-between ${
                        day.isToday ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">
                          {day.dayName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {day.dayNumber}/{day.monthNumber}
                        </span>
                      </div>
                      {day.isToday && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded">
                          Hoy
                        </span>
                      )}
                    </div>

                    {/* Cuerpo de la tarjeta de turno */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-3">
                      {shift ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                typeCfg?.badgeClass || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <IconComponent className="w-3 h-3" />
                              <span>{typeCfg?.label || shift.shift_type}</span>
                            </span>
                          </div>

                          {/* Horario si es trabajo */}
                          {shift.shift_type === 'trabajo' && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              <span>
                                {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)} hs
                              </span>
                            </div>
                          )}

                          {/* Ubicación / Puesto */}
                          {shift.location && (
                            <div className="flex items-start gap-1 text-[11px] text-slate-600">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{shift.location}</span>
                            </div>
                          )}

                          {/* Notas */}
                          {shift.notes && (
                            <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-500 italic border border-slate-100">
                              "{shift.notes}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-6 flex flex-col items-center justify-center text-center text-slate-400 space-y-1">
                          <Clock className="w-5 h-5 opacity-40" />
                          <span className="text-xs">Sin asignar</span>
                        </div>
                      )}

                      {/* Footer si el usuario tiene permiso para editar turnos propios (solo Admin) */}
                      {roleId === 1 && shift && (
                        <button
                          onClick={() => handleOpenEditModal(shift)}
                          className="w-full mt-2 inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Modificar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO: MATRIZ DE PLANIFICACIÓN GENERAL (Roles 1, 2 y 3) */}
      {canPlan && activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Filtros de la Matriz */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              {/* Buscador */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar colaborador o legajo..."
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filtro por Departamento */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos los departamentos</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <span>{filteredEmployees.length} colaboradores visibles</span>
            </div>
          </div>

          {/* Tabla Matriz */}
          {loading || loadingEmployees ? (
            <div className="py-16 flex justify-center items-center bg-white rounded-xl border border-slate-200">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <EmptyState
              title="No se encontraron colaboradores"
              description="No hay colaboradores visibles que coincidan con los filtros seleccionados."
              icon={User}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4 min-w-[200px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                        Colaborador
                      </th>
                      {weekDays.map((day) => (
                        <th
                          key={day.dateStr}
                          className={`py-3 px-3 text-center min-w-[130px] border-r border-slate-200 last:border-r-0 ${
                            day.isToday ? 'bg-blue-50/80 text-blue-900 font-bold' : ''
                          }`}
                        >
                          <div>{day.dayName}</div>
                          <div className="text-[10px] font-normal text-slate-500">
                            {day.dayNumber}/{day.monthNumber}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEmployees.map((emp) => {
                      const initials = `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase();
                      const canManage = canManageEmployeeShifts(user, emp);

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Columna Colaborador (Sticky) */}
                          <td className="py-2.5 px-4 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-slate-200">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {initials || 'U'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-900 truncate">
                                  <span className="truncate">{emp.first_name} {emp.last_name}</span>
                                  {!canManage && (
                                    <span title="Asignado por rango superior (solo lectura)">
                                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5">
                                  {emp.file_number && (
                                    <span>Leg. {emp.file_number}</span>
                                  )}
                                  {emp.department && (
                                    <>
                                      <span>•</span>
                                      <span>{emp.department}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Celdas para cada uno de los 7 días */}
                          {weekDays.map((day) => {
                            const shift = shiftsMap.get(`${emp.id}_${day.dateStr}`);
                            const typeCfg = shift ? SHIFT_TYPE_CONFIG[shift.shift_type] : null;

                            return (
                              <td
                                key={day.dateStr}
                                className={`py-2 px-2 text-center border-r border-slate-200 last:border-r-0 align-top ${
                                  day.isToday ? 'bg-blue-50/20' : ''
                                }`}
                              >
                                {shift ? (
                                  canManage ? (
                                    <div
                                      onClick={() => handleOpenEditModal(shift)}
                                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all hover:shadow-sm ${
                                        typeCfg?.badgeClass || 'bg-slate-50 text-slate-700 border-slate-200'
                                      }`}
                                      title="Click para modificar o eliminar"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-[11px] truncate">
                                          {typeCfg?.label || shift.shift_type}
                                        </span>
                                        <Edit3 className="w-3 h-3 opacity-50 shrink-0" />
                                      </div>

                                      {shift.shift_type === 'trabajo' && (
                                        <div className="mt-1 text-[11px] font-semibold flex items-center gap-1">
                                          <Clock className="w-3 h-3 shrink-0" />
                                          <span>
                                            {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                                          </span>
                                        </div>
                                      )}

                                      {shift.location && (
                                        <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                                          📍 {shift.location}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      className={`p-2 rounded-lg border text-left cursor-default ${
                                        typeCfg?.badgeClass || 'bg-slate-50 text-slate-700 border-slate-200'
                                      } opacity-85`}
                                      title="Asignado por rango superior (solo lectura)"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-[11px] truncate">
                                          {typeCfg?.label || shift.shift_type}
                                        </span>
                                        <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                      </div>

                                      {shift.shift_type === 'trabajo' && (
                                        <div className="mt-1 text-[11px] font-semibold flex items-center gap-1">
                                          <Clock className="w-3 h-3 shrink-0" />
                                          <span>
                                            {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                                          </span>
                                        </div>
                                      )}

                                      {shift.location && (
                                        <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                                          📍 {shift.location}
                                        </div>
                                      )}
                                    </div>
                                  )
                                ) : canManage ? (
                                  <button
                                    onClick={() => handleOpenCreateModal(emp.id, day.dateStr)}
                                    className="w-full h-12 rounded-lg border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors group"
                                    title="Asignar turno en este día"
                                  >
                                    <Plus className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                                  </button>
                                ) : (
                                  <div
                                    className="w-full h-12 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-center text-slate-300 text-xs"
                                    title="Asignado por rango superior (solo lectura)"
                                  >
                                    —
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE ASIGNACIÓN / EDICIÓN DE TURNO */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !submitting && !deleting && setIsModalOpen(false)}
        title={editingShift ? 'Modificar Turno Laboral' : 'Asignar Turno Laboral'}
        subtitle={
          editingShift
            ? 'Actualiza los datos del turno asignado o elimina su registro.'
            : 'Asigna horario de trabajo, franco, licencia o feriado para la fecha seleccionada.'
        }
        icon={CalendarDays}
        maxWidth="max-w-lg"
        preventClose={submitting || deleting}
      >
        <form onSubmit={handleSubmitShift} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Advertencia para Líder si el turno existente es Licencia o Feriado */}
          {isShiftLockedForLeader && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Este turno corresponde a una <strong>{editingShift.shift_type}</strong> gestionada por Recursos Humanos o Administración. Los Líderes de Área no pueden modificarla ni eliminarla.
              </span>
            </div>
          )}

          {/* Selección de Colaborador (Filtrado por permisos jerárquicos) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Colaborador <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.user_id}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
              disabled={Boolean(editingShift) || submitting || isShiftLockedForLeader}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              required
            >
              <option value="">Selecciona un colaborador...</option>
              {assignableEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} {emp.file_number ? `(Legajo: ${emp.file_number})` : ''} - {emp.department || 'Sin dpto'}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha del Turno */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha del Turno <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.shift_date}
              onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
              disabled={submitting || isShiftLockedForLeader}
              className="w-full text-xs rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              required
            />
          </div>

          {/* Tipo de Turno */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Turno <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(SHIFT_TYPE_CONFIG).map(([typeKey, cfg]) => {
                const IconComponent = cfg.icon;
                const isSelected = formData.shift_type === typeKey;
                // Si es Líder de Área, solo puede elegir 'trabajo' o 'franco'
                const isDisabledForLeader = isLeader && (typeKey === 'licencia' || typeKey === 'feriado');
                const isDisabled = submitting || isShiftLockedForLeader || isDisabledForLeader;

                return (
                  <button
                    type="button"
                    key={typeKey}
                    disabled={isDisabled}
                    onClick={() => setFormData({ ...formData, shift_type: typeKey })}
                    className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? `${cfg.badgeClass} ring-2 ring-blue-500 font-bold shadow-sm`
                        : isDisabledForLeader
                        ? 'opacity-40 border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
            {isLeader && (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span>ℹ️ Licencias y feriados son gestionados exclusivamente por RRHH/Admin.</span>
              </p>
            )}
          </div>

          {/* Horario de Entrada y Salida (Solo si es trabajo) */}
          {formData.shift_type === 'trabajo' && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-3">
              <div className="text-[11px] font-semibold text-blue-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Horario laboral establecido</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Hora Entrada <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    disabled={submitting || isShiftLockedForLeader}
                    className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Hora Salida <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    disabled={submitting || isShiftLockedForLeader}
                    className="w-full text-xs rounded-lg border border-slate-300 py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ubicación / Puesto */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ubicación / Puesto asignado (Opcional)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ej: Sede Central, Sucursal Norte, Remoto..."
                maxLength={120}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                disabled={submitting || isShiftLockedForLeader}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Notas Operativas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas operativas (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Instrucciones específicas, tareas asignadas, reemplazo de turno..."
              maxLength={300}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={submitting || isShiftLockedForLeader}
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-100"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div>
              {editingShift && (
                <button
                  type="button"
                  onClick={handleDeleteShift}
                  disabled={submitting || deleting || isShiftLockedForLeader}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{deleting ? 'Eliminando...' : 'Eliminar Turno'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting || deleting}
                className="px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || deleting || isShiftLockedForLeader}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>{editingShift ? 'Actualizar Turno' : 'Guardar Turno'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShiftsPage;
