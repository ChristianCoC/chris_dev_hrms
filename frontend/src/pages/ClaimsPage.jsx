import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Clock, CheckCircle2, XCircle, AlertCircle, X, MessageSquareQuote } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge.jsx';

export const ClaimsPage = () => {
  const [claims, setClaims] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal para radicar nuevo reclamo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Formulario de resolución (Admin / RRHH)
  const [resolveStatus, setResolveStatus] = useState('approved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingClaim, setResolvingClaim] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const { isAdminOrHR, user } = useAuth();

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/claims');
      const list = res.data?.claims || [];
      setClaims(list);
      if (list.length > 0) {
        setSelectedClaim((prev) => (prev ? list.find((c) => c.id === prev.id) || list[0] : list[0]));
      } else {
        setSelectedClaim(null);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar los reclamos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleCreateClaim = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    try {
      setSubmittingClaim(true);
      const res = await api.post('/api/claims', {
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });

      setIsModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('normal');
      setActionSuccess('Reclamo radicado correctamente.');
      setTimeout(() => setActionSuccess(''), 3500);

      await fetchClaims();
      if (res.data?.claim) {
        setSelectedClaim(res.data.claim);
      }
    } catch (err) {
      alert(err.message || 'Error al radicar reclamo');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleResolveClaim = async (e) => {
    e.preventDefault();
    if (!selectedClaim) return;

    try {
      setResolvingClaim(true);
      await api.patch(`/api/claims/${selectedClaim.id}/resolve`, {
        status: resolveStatus,
        resolution_notes: resolutionNotes.trim() || undefined,
      });

      setActionSuccess(`Reclamo actualizado a estado: ${resolveStatus}.`);
      setResolutionNotes('');
      setTimeout(() => setActionSuccess(''), 3500);
      await fetchClaims();
    } catch (err) {
      alert(err.message || 'Error al resolver reclamo');
    } finally {
      setResolvingClaim(false);
    }
  };

  // Filtrado de la lista
  const filteredClaims = claims.filter((claim) => {
    const matchesStatus =
      statusFilter === 'all' || claim.status === statusFilter;
    const matchesSearch =
      claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (claim.filed_by_name &&
        claim.filed_by_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const formatDate = (isoDate) => {
    if (!isoDate) return 'Sin fecha';
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isAdminOrHR ? 'Gestión Central de Reclamos' : 'Mis Solicitudes y Reclamos'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAdminOrHR
              ? 'Panel de revisión, asignación y resolución de solicitudes de personal'
              : 'Espacio para radicar y hacer seguimiento a tus incidencias y solicitudes laborales'}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Radicar nuevo reclamo</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Quick Summary Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[
          { id: 'all', label: 'Todos', count: claims.length },
          { id: 'pending', label: 'Pendientes', count: claims.filter((c) => c.status === 'pending').length },
          { id: 'in_progress', label: 'En curso', count: claims.filter((c) => c.status === 'in_progress').length },
          { id: 'approved', label: 'Aprobados', count: claims.filter((c) => c.status === 'approved').length },
          { id: 'rejected', label: 'Rechazados', count: claims.filter((c) => c.status === 'rejected').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === tab.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
            }`}
          >
            {tab.label} <span className="opacity-70 ml-1">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Master List */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por título, contenido o empleado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pl-8 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder:text-slate-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* List Content */}
          <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Cargando reclamos...
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Sin reclamos que mostrar</p>
                <p className="text-xs text-slate-400 mt-1">
                  {claims.length === 0
                    ? 'Aún no se han registrado reclamos en esta sección.'
                    : 'Ningún reclamo coincide con los filtros aplicados.'}
                </p>
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;
                return (
                  <div
                    key={claim.id}
                    onClick={() => setSelectedClaim(claim)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/60 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                        {claim.title}
                      </h3>
                      <StatusBadge status={claim.status} />
                    </div>

                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {claim.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {claim.filed_by_name
                          ? `${claim.filed_by_name} ${claim.filed_by_last_name || ''}`
                          : 'Mi solicitud'}
                      </span>
                      <span>{formatDate(claim.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detail View */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          {selectedClaim ? (
            <div>
              {/* Header Info */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StatusBadge status={selectedClaim.status} />
                  <PriorityBadge priority={selectedClaim.priority} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {selectedClaim.title}
                </h2>
                <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-y-1 gap-x-4">
                  {selectedClaim.filed_by_name && (
                    <span>
                      Radicado por:{' '}
                      <strong className="text-slate-700">
                        {selectedClaim.filed_by_name} {selectedClaim.filed_by_last_name || ''}
                      </strong>
                    </span>
                  )}
                  <span>Fecha: {formatDate(selectedClaim.created_at)}</span>
                  {selectedClaim.resolved_by_name && (
                    <span>
                      Gestionado por: <strong className="text-slate-700">{selectedClaim.resolved_by_name}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Description Body */}
              <div className="py-5 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Detalle de la solicitud
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {selectedClaim.description}
                </p>
              </div>

              {/* Resolution Notes Callout */}
              {selectedClaim.resolution_notes && (
                <div className="py-5 border-b border-slate-100">
                  <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200/80">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 mb-1">
                      <MessageSquareQuote className="w-4 h-4 text-blue-600" />
                      <span>Dictamen / Notas de resolución de RRHH</span>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {selectedClaim.resolution_notes}
                    </p>
                    {selectedClaim.resolved_at && (
                      <span className="block mt-2 text-[10px] text-blue-600/80">
                        Resuelto el: {formatDate(selectedClaim.resolved_at)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Resolution Action Panel (Admin / RRHH Only) */}
              {isAdminOrHR ? (
                <div className="mt-6 pt-2">
                  <h3 className="text-xs font-semibold text-slate-900 mb-3">
                    Gestión y Resolución del Reclamo
                  </h3>
                  <form onSubmit={handleResolveClaim} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nuevo estado de la solicitud
                      </label>
                      <select
                        value={resolveStatus}
                        onChange={(e) => setResolveStatus(e.target.value)}
                        className="w-full sm:w-64 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="approved">Aprobar solicitud</option>
                        <option value="rejected">Rechazar solicitud</option>
                        <option value="in_progress">Poner en curso / revisión</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Notas u observaciones para el empleado
                      </label>
                      <textarea
                        rows={3}
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Explica el dictamen o las acciones a seguir tomadas por RRHH..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={resolvingClaim}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                      {resolvingClaim ? 'Actualizando...' : 'Guardar dictamen y notificar al empleado'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-400">
                  {selectedClaim.status === 'pending'
                    ? 'Tu solicitud está en cola de revisión por el departamento de Recursos Humanos.'
                    : `Esta solicitud fue atendida y clasificada como "${selectedClaim.status}".`}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Ningún reclamo seleccionado</p>
              <p className="text-xs text-slate-400 mt-1">
                Haz clic en una de las solicitudes del panel izquierdo para ver sus detalles.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Radicar Nuevo Reclamo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900">
              Radicar nuevo reclamo o solicitud
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Ingresa los detalles para que el equipo de RRHH pueda atender tu requerimiento.
            </p>

            <form onSubmit={handleCreateClaim} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título de la solicitud
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej: Cambio de silla ergonómica por dolencia lumbar"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prioridad
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
                >
                  <option value="low">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción detallada
                </label>
                <textarea
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe con claridad el motivo de tu solicitud o incidencia..."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {submittingClaim ? 'Radicando...' : 'Crear reclamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimsPage;
