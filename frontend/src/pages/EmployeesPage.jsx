import React, { useState, useEffect } from 'react';
import { Users, Search, Building2, Phone, Calendar, Shield, Edit3, X, CheckCircle2, UserPlus, Mail, AlertCircle, ExternalLink } from 'lucide-react';
import api from '../api/client.js';
import { useAuth, ROLE_LABELS } from '../context/AuthContext.jsx';

export const EmployeesPage = () => {
  const { isAdmin } = useAuth();
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
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [etherealUrl, setEtherealUrl] = useState('');

  // Modal de edición
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
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

  const fetchEmployeesAndStats = async () => {
    try {
      setError('');
      setLoading(true);
      const [empRes, statsRes] = await Promise.all([
        api.get(`/api/employees?search=${encodeURIComponent(search)}&department=${encodeURIComponent(departmentFilter)}&role_id=${roleFilter}`),
        api.get('/api/employees/stats'),
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
      const res = await api.post('/api/employees', {
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim(),
        role_id: Number(createForm.role_id),
      });

      setIsCreateModalOpen(false);
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        role_id: 4,
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
      const res = await api.post(`/api/employees/${employee.id}/resend-invitation`);
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

  const handleOpenEdit = (employee) => {
    setEditingEmployee(employee);
    setEditForm({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
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
      await api.put(`/api/employees/${editingEmployee.id}`, editForm);
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
            placeholder="Buscar por nombre, apellido o correo..."
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
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No se encontraron colaboradores con los criterios seleccionados.
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
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 ${emp.department ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {emp.department || 'Sin asignar'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 ${emp.phone ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>
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
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pendiente de activación
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${emp.hire_date ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>
                      {formatDate(emp.hire_date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {isAdmin && !emp.is_active && (
                          <button
                            type="button"
                            onClick={() => handleResendInvitation(emp)}
                            disabled={resendingId === emp.id}
                            title="Reenviar enlace de activación"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Mail className="w-3.5 h-3.5 text-amber-600" />
                            <span>{resendingId === emp.id ? 'Reenviando...' : 'Reenviar acceso'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
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
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setEditingEmployee(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">
              Editar Ficha de Personal
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Modifica la información laboral de {editingEmployee.first_name} {editingEmployee.last_name}.
            </p>

            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-3">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de contratación</label>
                <input
                  type="date"
                  value={editForm.hire_date}
                  onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rol de seguridad</label>
                <select
                  value={editForm.role_id}
                  onChange={(e) => setEditForm({ ...editForm, role_id: parseInt(e.target.value, 10) })}
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
          </div>
        </div>
      )}
      {/* Modal: Alta de Nuevo Empleado */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setCreateError('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Alta de Nuevo Empleado
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ingresa los datos para registrar e invitar al nuevo colaborador al sistema HRMS.
            </p>

            {createError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEmployee} className="mt-4 space-y-3">
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
                  onChange={(e) => setCreateForm({ ...createForm, role_id: parseInt(e.target.value, 10) })}
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
          </div>
        </div>
      )}
      {/* Modal Persistente: Enlace de Activación Generado (sin temporizador ni auto-cierre) */}
      {resendResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setResendResultModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Enlace de activación generado
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {resendResultModal.employee?.email}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Se ha emitido un nuevo enlace de acceso para{' '}
              <strong className="text-slate-800">
                {resendResultModal.employee?.first_name} {resendResultModal.employee?.last_name}
              </strong>
              . En entorno local puedes acceder a la previsualización del correo:
            </p>

            {resendResultModal.previewUrl ? (
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
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;
