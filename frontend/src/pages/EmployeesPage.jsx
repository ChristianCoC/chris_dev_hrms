import React, { useState, useEffect } from 'react';
import {
  Search,
  Building2,
  Phone,
  Edit3,
  CheckCircle2,
  UserPlus,
  Mail,
  AlertCircle,
  ExternalLink,
  UserX,
  Users,
  ShieldAlert,
  ShieldCheck,
  PlusCircle,
  History,
  Lock,
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '../context/AuthContext.jsx';
import { employeeService } from '../services/employeeService.js';
import { disciplinaryService } from '../services/disciplinaryService.js';
import { Modal, EmptyState } from '../components/ui/index.js';

const ROLE_HIERARCHY = {
  1: 1, // Administrador (Rango 1 - Máximo)
  2: 2, // Recursos Humanos (Rango 2)
  3: 3, // Líder de Área (Rango 3)
  4: 4, // Empleado (Rango 4 - Mínimo)
};

export const EmployeesPage = () => {
  const { user, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal de alta de empleado
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role_id: 4,
    document_number: '',
    file_number: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [etherealUrl, setEtherealUrl] = useState('');

  // Modal de edición
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    document_number: '',
    file_number: '',
    phone: '',
    department: '',
    hire_date: '',
    role_id: 4,
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Modal persistente de reenvío de invitación
  const [resendResultModal, setResendResultModal] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  // Modal de confirmación de baja lógica (desactivación)
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  // Modal de Legajo y Sanciones Disciplinarias
  const [disciplinaryModalEmployee, setDisciplinaryModalEmployee] = useState(null);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState([]);
  const [loadingDisciplinary, setLoadingDisciplinary] = useState(false);
  const [disciplinaryError, setDisciplinaryError] = useState('');
  const [disciplinarySuccess, setDisciplinarySuccess] = useState('');
  const [disciplinaryTab, setDisciplinaryTab] = useState('history'); // 'history' | 'new'
  const [savingDisciplinary, setSavingDisciplinary] = useState(false);
  const [disciplinaryForm, setDisciplinaryForm] = useState({
    type: 'llamado_atencion',
    severity: 'leve',
    incident_date: new Date().toISOString().split('T')[0],
    reason: '',
    description: '',
    suspension_days: 1,
  });

  const fetchEmployeesAndStats = async () => {
    try {
      setError('');
      setLoading(true);
      const [empRes, statsRes] = await Promise.all([
        employeeService.getAll({
          search,
          department: departmentFilter,
          role_id: roleFilter,
        }),
        employeeService.getStats(),
      ]);

      const rawEmployees =
        empRes?.data?.employees ||
        empRes?.employees ||
        (Array.isArray(empRes?.data) ? empRes.data : []) ||
        (Array.isArray(empRes) ? empRes : []);

      setEmployees(Array.isArray(rawEmployees) ? rawEmployees : []);
      setStats(statsRes?.data || statsRes || null);
    } catch (err) {
      setError(err.message || 'Error al obtener la lista de empleados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesAndStats();
  }, [search, departmentFilter, roleFilter]);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setCreateError('');

    try {
      setCreating(true);
      const res = await employeeService.create({
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim(),
        role_id: Number(createForm.role_id),
        document_number: createForm.document_number ? createForm.document_number.trim() : null,
        file_number: createForm.file_number ? createForm.file_number.trim() : null,
      });

      setIsCreateModalOpen(false);
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        role_id: 4,
        document_number: '',
        file_number: '',
      });

      const msg = res.message || 'Empleado dado de alta e invitación enviada exitosamente.';
      setSuccessMessage(msg);
      if (res.previewUrl) {
        setEtherealUrl(res.previewUrl);
      }
      setTimeout(() => {
        setSuccessMessage('');
      }, 7000);

      await fetchEmployeesAndStats();
    } catch (err) {
      setCreateError(err.message || 'Error al dar de alta al empleado.');
    } finally {
      setCreating(false);
    }
  };

  const handleResendInvitation = async (employee) => {
    try {
      setResendingId(employee.id);
      const res = await employeeService.resendInvitation(employee.id);
      setResendResultModal({
        employee,
        previewUrl: res.previewUrl,
        message: res.message || 'Invitación reenviada correctamente',
      });
      await fetchEmployeesAndStats();
    } catch (err) {
      alert(err.message || 'Error al reenviar la invitación.');
    } finally {
      setResendingId(null);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!employeeToDeactivate) return;
    setDeactivateError('');

    try {
      setDeactivating(true);
      const res = await employeeService.deactivate(employeeToDeactivate.id);
      setSuccessMessage(
        res.message ||
          `El colaborador ${employeeToDeactivate.first_name} ${employeeToDeactivate.last_name} fue dado de baja correctamente.`
      );
      setEmployeeToDeactivate(null);
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      await fetchEmployeesAndStats();
    } catch (err) {
      setDeactivateError(err.message || 'Error al procesar la baja del empleado.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleOpenEdit = (employee) => {
    setEditingEmployee(employee);
    setEditForm({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      document_number: employee.document_number || '',
      file_number: employee.file_number || '',
      phone: employee.phone || '',
      department: employee.department || '',
      hire_date: employee.hire_date ? employee.hire_date.substring(0, 10) : '',
      role_id: employee.role_id || 4,
    });
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      setSaving(true);
      await employeeService.update(editingEmployee.id, editForm);
      setSuccessMessage('Ficha del empleado actualizada correctamente.');
      setEditingEmployee(null);
      setTimeout(() => setSuccessMessage(''), 3500);
      await fetchEmployeesAndStats();
    } catch (err) {
      alert(err.message || 'Error al actualizar empleado');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return 'Sin registrar';
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const loadEmployeeDisciplinary = async (empId) => {
    try {
      setLoadingDisciplinary(true);
      setDisciplinaryError('');
      const res = await disciplinaryService.getEmployeeDisciplinaryActions(empId);
      const items = res?.data?.disciplinary_actions || res?.disciplinary_actions || [];
      setDisciplinaryRecords(Array.isArray(items) ? items : []);
    } catch (err) {
      setDisciplinaryError(err.message || 'Error al cargar el historial disciplinario.');
    } finally {
      setLoadingDisciplinary(false);
    }
  };

  const userLevel = ROLE_HIERARCHY[user?.role_id] || 99;
  const targetLevel = disciplinaryModalEmployee
    ? ROLE_HIERARCHY[disciplinaryModalEmployee.role_id] || 99
    : 99;
  const isSelfDisciplinary = disciplinaryModalEmployee?.id === user?.id;
  const canSanction =
    !isSelfDisciplinary &&
    (user?.role_id === 1 || user?.role_id === 2) &&
    userLevel < targetLevel;

  const handleOpenDisciplinaryModal = (emp) => {
    setDisciplinaryModalEmployee(emp);
    setDisciplinaryTab('history');
    setDisciplinaryError('');
    setDisciplinarySuccess('');
    setDisciplinaryForm({
      type: 'llamado_atencion',
      severity: 'leve',
      incident_date: new Date().toISOString().split('T')[0],
      reason: '',
      description: '',
      suspension_days: 1,
    });
    loadEmployeeDisciplinary(emp.id);
  };

  const handleCreateDisciplinary = async (e) => {
    e.preventDefault();
    if (!disciplinaryModalEmployee) return;

    if (!canSanction) {
      setDisciplinaryError(
        'Jerarquía insuficiente. No puedes registrar sanciones sobre un colaborador de igual o mayor rango.'
      );
      return;
    }

    try {
      setSavingDisciplinary(true);
      setDisciplinaryError('');
      setDisciplinarySuccess('');

      await disciplinaryService.createDisciplinaryAction({
        user_id: disciplinaryModalEmployee.id,
        type: disciplinaryForm.type,
        severity: disciplinaryForm.severity,
        incident_date: disciplinaryForm.incident_date,
        reason: disciplinaryForm.reason,
        description: disciplinaryForm.description,
        suspension_days:
          disciplinaryForm.type === 'suspension'
            ? parseInt(disciplinaryForm.suspension_days, 10)
            : 0,
      });

      setDisciplinarySuccess('Medida disciplinaria registrada exitosamente con notificación al colaborador.');
      await loadEmployeeDisciplinary(disciplinaryModalEmployee.id);
      setDisciplinaryTab('history');
      setDisciplinaryForm({
        type: 'llamado_atencion',
        severity: 'leve',
        incident_date: new Date().toISOString().split('T')[0],
        reason: '',
        description: '',
        suspension_days: 1,
      });
    } catch (err) {
      setDisciplinaryError(err.message || 'Error al registrar la sanción disciplinaria.');
    } finally {
      setSavingDisciplinary(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Directorio y Gestión de Personal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Administración de colaboradores, asignación departamental y roles de acceso
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setCreateError('');
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Empleado</span>
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          {etherealUrl && (
            <div className="pl-6">
              <a
                href={etherealUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline font-semibold"
              >
                <span>Ver correo simulado de invitación en Ethereal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Total de Personal</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.totalEmployees || 0}
            </div>
            <span className="text-[11px] text-slate-400">Colaboradores registrados</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Departamentos</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.byDepartment?.length || 0}
            </div>
            <span className="text-[11px] text-slate-400">Áreas organizacionales</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Reclamos Pendientes</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {stats.claimsByStatus?.find((c) => c.status === 'pending')?.count || 0}
            </div>
            <span className="text-[11px] text-slate-400">Requieren atención de RRHH</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Reclamos Resueltos</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {stats.claimsByStatus?.find((c) => c.status === 'approved')?.count || 0}
            </div>
            <span className="text-[11px] text-slate-400">Atendidos exitosamente</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por nombre, apellido, correo, DNI o legajo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 pl-9 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="w-full md:w-56">
          <input
            type="text"
            placeholder="Filtrar por departamento..."
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
          />
        </div>

        <div className="w-full md:w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">Todos los roles</option>
            <option value="1">Administrador</option>
            <option value="2">Recursos Humanos</option>
            <option value="3">Líder de Área</option>
            <option value="4">Empleado</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Rol asignado</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha de ingreso</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Cargando nómina de empleados...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <EmptyState
                      icon={Users}
                      title="No se encontraron colaboradores"
                      description="Intenta ajustando los términos de búsqueda o los filtros aplicados."
                    />
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {emp.email}
                      </div>
                      <div className="text-[11px] mt-1 flex flex-wrap items-center gap-x-2 text-slate-500 font-normal">
                        <span>
                          <span className="font-semibold text-slate-600">Legajo:</span>{' '}
                          {emp.file_number ? (
                            <span className="text-slate-700 font-medium">#{emp.file_number}</span>
                          ) : (
                            <span className="text-slate-400 italic">Sin registrar</span>
                          )}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          <span className="font-semibold text-slate-600">DNI:</span>{' '}
                          {emp.document_number ? (
                            <span className="text-slate-700 font-medium">{emp.document_number}</span>
                          ) : (
                            <span className="text-slate-400 italic">Sin registrar</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          emp.department ? 'text-slate-700 font-medium' : 'text-slate-400 italic'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {emp.department || 'Sin asignar'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          emp.phone ? 'text-slate-700 font-medium' : 'text-slate-400 italic'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {emp.phone || 'No registrado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {ROLE_LABELS[emp.role_id] || emp.role_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Activo
                        </span>
                      ) : emp.deactivation_date || !emp.is_pending_activation ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Inactivo / Baja
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pendiente de activación
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        emp.hire_date ? 'text-slate-700 font-medium' : 'text-slate-400 italic'
                      }`}
                    >
                      {formatDate(emp.hire_date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {isAdmin && !emp.is_active && emp.is_pending_activation && (
                          <button
                            type="button"
                            onClick={() => handleResendInvitation(emp)}
                            disabled={resendingId === emp.id}
                            title="Reenviar enlace de activación"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Mail className="w-3.5 h-3.5 text-amber-600" />
                            <span>
                              {resendingId === emp.id ? 'Reenviando...' : 'Reenviar acceso'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenDisciplinaryModal(emp)}
                          title="Legajo y Sanciones"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-amber-200 rounded-md transition-colors"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                          <span>Legajo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        {isAdmin && emp.is_active && emp.id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeactivateError('');
                              setEmployeeToDeactivate(emp);
                            }}
                            title="Dar de baja colaborador"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Baja</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Editar Ficha de Empleado */}
      <Modal
        isOpen={Boolean(editingEmployee)}
        onClose={() => setEditingEmployee(null)}
        title="Editar Ficha de Personal"
        subtitle={
          editingEmployee
            ? `Modifica la información laboral de ${editingEmployee.first_name} ${editingEmployee.last_name}.`
            : ''
        }
        icon={Edit3}
        preventClose={saving}
      >
        <form onSubmit={handleSaveEmployee} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre</label>
              <input
                type="text"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                required
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Apellido</label>
              <input
                type="text"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                required
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Documento (DNI/Cédula)
              </label>
              <input
                type="text"
                placeholder="Ej: 38123456"
                value={editForm.document_number}
                onChange={(e) => setEditForm({ ...editForm, document_number: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Legajo
              </label>
              <input
                type="text"
                placeholder="Ej: 1042"
                value={editForm.file_number}
                onChange={(e) => setEditForm({ ...editForm, file_number: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento</label>
            <input
              type="text"
              placeholder="Ej: Desarrollo, Operaciones, Finanzas"
              value={editForm.department}
              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
            <input
              type="text"
              placeholder="+54 11 4455-6677"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha de contratación
            </label>
            <input
              type="date"
              value={editForm.hire_date}
              onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rol de seguridad
            </label>
            <select
              value={editForm.role_id}
              onChange={(e) =>
                setEditForm({ ...editForm, role_id: parseInt(e.target.value, 10) })
              }
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white text-slate-800"
            >
              <option value={4}>Empleado Regular</option>
              <option value={3}>Líder de Área / Manager</option>
              <option value={2}>Recursos Humanos</option>
              <option value={1}>Administrador</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setEditingEmployee(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Alta de Nuevo Empleado */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateError('');
        }}
        title="Alta de Nuevo Empleado"
        subtitle="Ingresa los datos para registrar e invitar al nuevo colaborador al sistema HRMS."
        icon={UserPlus}
        preventClose={creating}
      >
        {createError && (
          <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{createError}</span>
          </div>
        )}

        <form onSubmit={handleCreateEmployee} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre</label>
              <input
                type="text"
                placeholder="Juan"
                value={createForm.first_name}
                onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                required
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Apellido</label>
              <input
                type="text"
                placeholder="Pérez"
                value={createForm.last_name}
                onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                required
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Documento <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej: 38123456"
                value={createForm.document_number}
                onChange={(e) =>
                  setCreateForm({ ...createForm, document_number: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Legajo <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej: 1042"
                value={createForm.file_number}
                onChange={(e) => setCreateForm({ ...createForm, file_number: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
            <div className="relative">
              <input
                type="email"
                placeholder="empleado@empresa.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                className="w-full px-3 py-1.5 pl-8 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Rol en el sistema</label>
            <select
              value={createForm.role_id}
              onChange={(e) =>
                setCreateForm({ ...createForm, role_id: parseInt(e.target.value, 10) })
              }
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white text-slate-800"
            >
              <option value={4}>Empleado Regular</option>
              <option value={3}>Líder de Área / Manager</option>
              <option value={2}>Recursos Humanos</option>
              <option value={1}>Administrador</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setCreateError('');
              }}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {creating ? 'Registrando...' : 'Dar de alta y enviar invitación'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Persistente: Enlace de Activación Generado */}
      <Modal
        isOpen={Boolean(resendResultModal)}
        onClose={() => setResendResultModal(null)}
        title="Enlace de activación generado"
        subtitle={resendResultModal?.employee?.email || ''}
        icon={Mail}
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Se ha emitido un nuevo enlace de acceso para{' '}
          <strong className="text-slate-800">
            {resendResultModal?.employee?.first_name} {resendResultModal?.employee?.last_name}
          </strong>
          . En entorno local puedes acceder a la previsualización del correo:
        </p>

        {resendResultModal?.previewUrl ? (
          <div className="mt-4 p-3.5 rounded-lg bg-blue-50/80 border border-blue-200/80">
            <div className="text-[11px] font-semibold text-blue-900 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Bandeja de prueba Ethereal:</span>
            </div>
            <a
              href={resendResultModal.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors w-full justify-center"
            >
              <span>Abrir previsualización del correo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
            El correo fue procesado por el servidor.
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setResendResultModal(null)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Modal: Confirmar Baja de Empleado */}
      <Modal
        isOpen={Boolean(employeeToDeactivate)}
        onClose={() => {
          if (!deactivating) setEmployeeToDeactivate(null);
        }}
        title="Confirmar Baja de Empleado"
        subtitle="Desactivación lógica de colaborador"
        icon={UserX}
        preventClose={deactivating}
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          ¿Estás seguro de que deseas dar de baja a{' '}
          <strong className="text-slate-900">
            {employeeToDeactivate?.first_name} {employeeToDeactivate?.last_name}
          </strong>
          ? El usuario perderá el acceso al sistema inmediatamente pero se preservará su historial.
        </p>

        {deactivateError && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{deactivateError}</span>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setEmployeeToDeactivate(null)}
            disabled={deactivating}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDeactivate}
            disabled={deactivating}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <UserX className="w-3.5 h-3.5" />
            <span>{deactivating ? 'Procesando...' : 'Confirmar Baja'}</span>
          </button>
        </div>
      </Modal>

      {/* Modal: Legajo y Sanciones Disciplinarias */}
      <Modal
        isOpen={Boolean(disciplinaryModalEmployee)}
        onClose={() => {
          if (!savingDisciplinary) setDisciplinaryModalEmployee(null);
        }}
        title={`Legajo Disciplinario - ${disciplinaryModalEmployee?.first_name} ${disciplinaryModalEmployee?.last_name}`}
        subtitle={
          disciplinaryModalEmployee?.file_number
            ? `Legajo #${disciplinaryModalEmployee.file_number} • ${disciplinaryModalEmployee.department || 'Sin área asignada'}`
            : disciplinaryModalEmployee?.department || 'Gestión de novedades y medidas disciplinarias'
        }
        icon={ShieldAlert}
        maxWidth="max-w-2xl"
        preventClose={savingDisciplinary}
      >
        <div className="space-y-4">
          {/* Tarjeta de Identidad del Colaborador (Nombre, Legajo, DNI y Área del personal) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                {disciplinaryModalEmployee?.first_name?.[0]}
                {disciplinaryModalEmployee?.last_name?.[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {disciplinaryModalEmployee?.first_name} {disciplinaryModalEmployee?.last_name}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 text-slate-500 text-[11px] mt-0.5">
                  <span>
                    <strong className="text-slate-700 font-semibold">Legajo:</strong>{' '}
                    {disciplinaryModalEmployee?.file_number ? (
                      <span className="text-slate-800 font-medium">#{disciplinaryModalEmployee.file_number}</span>
                    ) : (
                      <span className="text-slate-400 italic">Sin registrar</span>
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="text-slate-700 font-semibold">DNI:</strong>{' '}
                    {disciplinaryModalEmployee?.document_number ? (
                      <span className="text-slate-800 font-medium">{disciplinaryModalEmployee.document_number}</span>
                    ) : (
                      <span className="text-slate-400 italic">Sin registrar</span>
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    <strong className="text-slate-700 font-semibold">Área:</strong>{' '}
                    {disciplinaryModalEmployee?.department || 'Sin asignar'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs">
                {ROLE_LABELS[disciplinaryModalEmployee?.role_id] || disciplinaryModalEmployee?.role_name || 'Empleado'}
              </span>
              {canSanction ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Habilitado para sancionar
                </span>
              ) : (
                <span
                  title={
                    isSelfDisciplinary
                      ? "No puedes registrar sanciones sobre ti mismo."
                      : "Jerarquía insuficiente: Sólo un empleado de mayor rango puede emitir sanciones."
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                >
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Solo lectura (Jerarquía)</span>
                </span>
              )}
            </div>
          </div>

          {/* Navegación por pestañas */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setDisciplinaryTab('history')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                disciplinaryTab === 'history'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historial ({disciplinaryRecords.length})</span>
            </button>

            {canSanction ? (
              <button
                type="button"
                onClick={() => setDisciplinaryTab('new')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  disciplinaryTab === 'new'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Registrar Sanción / Apercibimiento</span>
              </button>
            ) : (
              <div
                title={
                  isSelfDisciplinary
                    ? "No puedes registrar sanciones sobre ti mismo."
                    : `Jerarquía insuficiente: Un empleado de ${ROLE_LABELS[user?.role_id]} no puede sancionar a un ${ROLE_LABELS[disciplinaryModalEmployee?.role_id]}. Las medidas disciplinarias deben ser emitidas por un empleado de mayor rango.`
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-100 cursor-not-allowed opacity-80"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Registrar Sanción (Bloqueado por jerarquía)</span>
              </div>
            )}
          </div>

          {/* Notificaciones de Éxito o Error */}
          {disciplinarySuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{disciplinarySuccess}</span>
            </div>
          )}

          {disciplinaryError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{disciplinaryError}</span>
            </div>
          )}

          {/* Pestaña: Historial Disciplinario */}
          {disciplinaryTab === 'history' && (
            <div className="space-y-3">
              {loadingDisciplinary ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Cargando expediente...</span>
                </div>
              ) : disciplinaryRecords.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={ShieldCheck}
                    title="Legajo Limpio"
                    description="Este colaborador no registra llamados de atención, apercibimientos ni suspensiones en su historial."
                  />
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                  {disciplinaryRecords.map((item) => {
                    const typeLabels = {
                      llamado_atencion: 'Llamado de atención',
                      apercibimiento: 'Apercibimiento',
                      suspension: 'Suspensión',
                      otro: 'Novedad disciplinaria',
                    };
                    const severityColors = {
                      leve: 'bg-amber-50 text-amber-700 border-amber-200',
                      moderada: 'bg-orange-50 text-orange-700 border-orange-200',
                      grave: 'bg-rose-50 text-rose-700 border-rose-200',
                    };

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900">
                              {typeLabels[item.type] || item.type}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                severityColors[item.severity] || severityColors.leve
                              }`}
                            >
                              Severidad: {item.severity}
                            </span>
                            {item.type === 'suspension' && item.suspension_days > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                {item.suspension_days} día(s) de suspensión
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Fecha del hecho: {formatDate(item.incident_date)}
                          </span>
                        </div>

                        <div>
                          <p className="font-medium text-slate-800">{item.reason}</p>
                          <p className="text-slate-600 mt-1 whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {item.description}
                          </p>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                          <span>
                            Emitido por:{' '}
                            <strong className="text-slate-600 font-medium">
                              {item.issuer_first_name} {item.issuer_last_name}
                            </strong>{' '}
                            ({item.issuer_role_name || 'RRHH'})
                          </span>
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pestaña: Registrar Nueva Sanción */}
          {disciplinaryTab === 'new' && (
            <form onSubmit={handleCreateDisciplinary} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipo de Medida
                  </label>
                  <select
                    value={disciplinaryForm.type}
                    onChange={(e) =>
                      setDisciplinaryForm({ ...disciplinaryForm, type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="llamado_atencion">Llamado de Atención</option>
                    <option value="apercibimiento">Apercibimiento</option>
                    <option value="suspension">Suspensión</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Gravedad / Severidad
                  </label>
                  <select
                    value={disciplinaryForm.severity}
                    onChange={(e) =>
                      setDisciplinaryForm({ ...disciplinaryForm, severity: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="leve">Leve (Ámbar)</option>
                    <option value="moderada">Moderada (Naranja)</option>
                    <option value="grave">Grave (Rojo)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fecha del Incidente
                  </label>
                  <input
                    type="date"
                    required
                    value={disciplinaryForm.incident_date}
                    onChange={(e) =>
                      setDisciplinaryForm({ ...disciplinaryForm, incident_date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                {disciplinaryForm.type === 'suspension' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-rose-700">
                      Días de Suspensión (Mayor a 0) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={disciplinaryForm.suspension_days}
                      onChange={(e) =>
                        setDisciplinaryForm({
                          ...disciplinaryForm,
                          suspension_days: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo Resumido (Máx. 200 caracteres) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Ej: Llegada tardía reiterada sin justificación previa"
                  value={disciplinaryForm.reason}
                  onChange={(e) =>
                    setDisciplinaryForm({ ...disciplinaryForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descripción Detallada del Hecho *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalla las circunstancias del hecho, normativa infringida o antecedentes pertinentes..."
                  value={disciplinaryForm.description}
                  onChange={(e) =>
                    setDisciplinaryForm({ ...disciplinaryForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDisciplinaryTab('history')}
                  disabled={savingDisciplinary}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDisciplinary}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{savingDisciplinary ? 'Registrando...' : 'Registrar en Legajo'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
