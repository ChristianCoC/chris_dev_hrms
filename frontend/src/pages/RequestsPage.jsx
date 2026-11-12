import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Paperclip,
  Upload,
  X,
} from 'lucide-react';
import { requestService } from '../services/requestService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

const REQUEST_TYPE_LABELS = {
  indumentaria: 'Indumentaria',
  licencia: 'Licencia',
  materiales: 'Materiales',
  herramientas: 'Herramientas',
  otro: 'Otro',
};

const REQUEST_TYPE_STYLES = {
  indumentaria: 'bg-purple-50 text-purple-700 border-purple-200',
  licencia: 'bg-sky-50 text-sky-700 border-sky-200',
  materiales: 'bg-amber-50 text-amber-700 border-amber-200',
  herramientas: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  otro: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const RequestsPage = () => {
  const { isAdminOrHR } = useAuth();

  // Tab para Admin/RRHH: 'all' (Todas las solicitudes) o 'my' (Mis solicitudes)
  const [activeTab, setActiveTab] = useState(isAdminOrHR ? 'all' : 'my');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal: Nueva Solicitud
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: 'indumentaria',
    title: '',
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const fileInputRef = useRef(null);

  // Modal: Revisar Solicitud (Admin / RRHH)
  const [requestToReview, setRequestToReview] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('approved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Estado de descarga de archivos adjuntos
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');

      let res;
      if (isAdminOrHR && activeTab === 'all') {
        res = await requestService.getAll({
          search: search.trim() || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        });
      } else {
        res = await requestService.getMy();
      }

      const rawList = res?.data?.requests || res?.requests || (Array.isArray(res) ? res : []);
      setRequests(Array.isArray(rawList) ? rawList : []);
    } catch (err) {
      setError(err.message || 'Error al obtener el listado de solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab, search, typeFilter, statusFilter]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFileError('');

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setFileError('Formato no permitido. Solo se aceptan PDF, JPG, PNG o WebP.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('El archivo seleccionado supera el límite de 5 MB.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!createForm.title.trim()) {
      setCreateError('Por favor ingresa un título o asunto para la solicitud.');
      return;
    }
    if (!createForm.description.trim()) {
      setCreateError('Por favor ingresa una descripción detallada.');
      return;
    }

    try {
      setCreating(true);

      if (selectedFile) {
        const formData = new FormData();
        formData.append('type', createForm.type);
        formData.append('title', createForm.title.trim());
        formData.append('description', createForm.description.trim());
        formData.append('attachment', selectedFile);

        await requestService.create(formData);
      } else {
        await requestService.create({
          type: createForm.type,
          title: createForm.title.trim(),
          description: createForm.description.trim(),
        });
      }

      setIsCreateModalOpen(false);
      setCreateForm({
        type: 'indumentaria',
        title: '',
        description: '',
      });
      setSelectedFile(null);
      setFileError('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      setFeedbackMessage('Solicitud registrada correctamente.');
      setTimeout(() => setFeedbackMessage(''), 4000);
      await fetchRequests();
    } catch (err) {
      setCreateError(err.message || 'Error al registrar la solicitud.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenReview = (request) => {
    setReviewError('');
    setRequestToReview(request);
    setReviewStatus(request.status === 'rejected' ? 'rejected' : 'approved');
    setResolutionNotes(request.resolution_notes || '');
  };

  const handleResolveRequest = async (e) => {
    e.preventDefault();
    if (!requestToReview) return;
    setReviewError('');

    try {
      setResolving(true);
      await requestService.updateStatus(requestToReview.id, {
        status: reviewStatus,
        resolution_notes: resolutionNotes.trim() || null,
      });

      setRequestToReview(null);
      setFeedbackMessage(
        `Solicitud ${reviewStatus === 'approved' ? 'aprobada' : 'rechazada'} exitosamente.`
      );
      setTimeout(() => setFeedbackMessage(''), 4000);
      await fetchRequests();
    } catch (err) {
      setReviewError(err.message || 'Error al actualizar el estado de la solicitud.');
    } finally {
      setResolving(false);
    }
  };

  const handleDownloadAttachment = async (requestId, fileName, e) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(requestId);
      await requestService.downloadAttachment(requestId, fileName);
    } catch (err) {
      alert(err.message || 'Error al descargar el archivo adjunto.');
    } finally {
      setDownloadingId(null);
    }
  };

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

  // Filtrado local para la pestaña 'Mis Solicitudes'
  const displayedRequests = requests.filter((req) => {
    if (activeTab === 'all') return true;
    if (typeFilter !== 'all' && req.type !== typeFilter) return false;
    if (statusFilter !== 'all' && req.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = req.title?.toLowerCase().includes(q);
      const matchDesc = req.description?.toLowerCase().includes(q);
      return matchTitle || matchDesc;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Módulo de Solicitudes Operativas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestión interna de indumentaria, licencias, materiales, herramientas y servicios
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError('');
            setFileError('');
            setSelectedFile(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Solicitud</span>
        </button>
      </div>

      {feedbackMessage && (
        <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Selector de Pestañas (Solo Admin y RRHH) */}
      {isAdminOrHR && (
        <div className="flex border-b border-slate-200 mb-6 gap-6 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`pb-3 font-semibold transition-colors relative ${
              activeTab === 'all'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todas las Solicitudes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`pb-3 font-semibold transition-colors relative ${
              activeTab === 'my'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Mis Solicitudes
          </button>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === 'all'
                  ? 'Buscar por título, descripción, empleado o legajo...'
                  : 'Buscar en mis solicitudes...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="all">Todos los tipos de solicitud</option>
              <option value="indumentaria">Indumentaria</option>
              <option value="licencia">Licencia</option>
              <option value="materiales">Materiales</option>
              <option value="herramientas">Herramientas</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contenedor de la Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando solicitudes...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-rose-600">{error}</div>
        ) : displayedRequests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No se encontraron solicitudes"
            description="No se registran solicitudes que coincidan con los criterios seleccionados."
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Título y Detalle</th>
                  <th className="px-4 py-3">Adjunto</th>
                  {isAdminOrHR && activeTab === 'all' && (
                    <>
                      <th className="px-4 py-3">Solicitante</th>
                      <th className="px-4 py-3">Legajo / Dpto</th>
                    </>
                  )}
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Notas de Resolución</th>
                  {isAdminOrHR && activeTab === 'all' && (
                    <th className="px-4 py-3 text-right">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Tipo */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          REQUEST_TYPE_STYLES[req.type] || REQUEST_TYPE_STYLES.otro
                        }`}
                      >
                        {REQUEST_TYPE_LABELS[req.type] || req.type}
                      </span>
                    </td>

                    {/* Título y Descripción */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-semibold text-slate-900 line-clamp-1">
                        {req.title}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {req.description}
                      </div>
                    </td>

                    {/* Adjunto */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {req.attachment_name ? (
                        <button
                          type="button"
                          onClick={(e) =>
                            handleDownloadAttachment(req.id, req.attachment_name, e)
                          }
                          disabled={downloadingId === req.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                          title={`Descargar ${req.attachment_name}`}
                        >
                          <Paperclip className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate max-w-[130px]">
                            {downloadingId === req.id ? 'Descargando...' : req.attachment_name}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Sin adjunto</span>
                      )}
                    </td>

                    {/* Solicitante (si activeTab === 'all') */}
                    {isAdminOrHR && activeTab === 'all' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {req.first_name} {req.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{req.email}</div>
                      </td>
                    )}

                    {/* Legajo / Departamento */}
                    {isAdminOrHR && activeTab === 'all' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-700">
                          {req.file_number ? `Leg. ${req.file_number}` : 'Sin legajo'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {req.department || 'Sin dpto.'}
                        </div>
                      </td>
                    )}

                    {/* Fecha */}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {formatDate(req.created_at)}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={req.status} />
                    </td>

                    {/* Notas de Resolución */}
                    <td className="px-4 py-3 max-w-xs">
                      {req.resolution_notes ? (
                        <div className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-800 block text-[10px] uppercase mb-0.5">
                            {req.resolver_first_name
                              ? `Por: ${req.resolver_first_name} ${req.resolver_last_name || ''}`
                              : 'Respuesta'}
                          </span>
                          {req.resolution_notes}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Sin notas</span>
                      )}
                    </td>

                    {/* Acciones para Admin / RRHH */}
                    {isAdminOrHR && activeTab === 'all' && (
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {req.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Revisar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                            title="Ver detalles de la resolución"
                          >
                            <span>Ver Ficha</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nueva Solicitud */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!creating) {
            setIsCreateModalOpen(false);
            setCreateError('');
            setFileError('');
          }
        }}
        title="Registrar Nueva Solicitud"
        subtitle="Petición operativa dirigida a Administración y RRHH"
        icon={ClipboardList}
        maxWidth="max-w-lg"
        preventClose={creating}
      >
        <form onSubmit={handleCreateRequest} className="mt-2 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Solicitud
            </label>
            <select
              value={createForm.type}
              onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="indumentaria">Indumentaria (Uniformes, Calzado, EPP)</option>
              <option value="licencia">Licencia (Estudio, Médica, Vacaciones)</option>
              <option value="materiales">Materiales (Papelería, Insumos de oficina)</option>
              <option value="herramientas">Herramientas (Dispositivos, Hardware, Accesos)</option>
              <option value="otro">Otro requerimiento operativo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Asunto / Título
            </label>
            <input
              type="text"
              maxLength={150}
              placeholder="Ej. Solicitud de botas de seguridad talle 42"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción Detallada
            </label>
            <textarea
              rows={4}
              placeholder="Especifica los detalles de tu necesidad, justificación o especificaciones técnicas..."
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none placeholder:text-slate-400"
            />
          </div>

          {/* Adjuntar Archivo Opcional */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adjuntar comprobante o certificado <span className="font-normal text-slate-400">(Opcional)</span>
            </label>
            <div className="mt-1 border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
                id="request-attachment-input"
              />

              {!selectedFile ? (
                <label
                  htmlFor="request-attachment-input"
                  className="flex items-center justify-center gap-2 cursor-pointer text-xs text-slate-600 py-1"
                >
                  <Upload className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="font-medium text-indigo-600 hover:text-indigo-700">
                    Seleccionar archivo
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    (PDF, JPG, PNG o WebP — máx. 5 MB)
                  </span>
                </label>
              ) : (
                <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-md border border-slate-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-800 truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors shrink-0"
                    title="Quitar archivo adjunto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {fileError && (
              <p className="mt-1.5 text-[11px] text-rose-600 font-medium">{fileError}</p>
            )}
          </div>

          {createError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {creating ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Revisar Solicitud (Aprobar / Rechazar) */}
      <Modal
        isOpen={!!requestToReview}
        onClose={() => setRequestToReview(null)}
        title={requestToReview ? `Revisión de Solicitud #${requestToReview.id}` : ''}
        subtitle={
          requestToReview
            ? `Solicitante: ${requestToReview.first_name} ${requestToReview.last_name}`
            : ''
        }
        icon={FileText}
        maxWidth="max-w-lg"
        preventClose={resolving}
      >
        {requestToReview && (
          <div>
            {/* Ficha Resumida */}
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2.5 mb-4 text-xs">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    REQUEST_TYPE_STYLES[requestToReview.type] || REQUEST_TYPE_STYLES.otro
                  }`}
                >
                  {REQUEST_TYPE_LABELS[requestToReview.type] || requestToReview.type}
                </span>
                <span className="text-slate-400 text-[11px]">
                  {formatDate(requestToReview.created_at)}
                </span>
              </div>

              <div>
                <strong className="text-slate-800 block text-xs">{requestToReview.title}</strong>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                  {requestToReview.description}
                </p>
              </div>

              {/* Botón destacado para ver o descargar comprobante adjunto */}
              {requestToReview.attachment_name && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Documentación / Comprobante adjunto:
                  </span>
                  <button
                    type="button"
                    onClick={(e) =>
                      handleDownloadAttachment(
                        requestToReview.id,
                        requestToReview.attachment_name,
                        e
                      )
                    }
                    disabled={downloadingId === requestToReview.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>
                      {downloadingId === requestToReview.id
                        ? 'Descargando comprobante...'
                        : `Abrir / Descargar: ${requestToReview.attachment_name}`}
                    </span>
                  </button>
                </div>
              )}

              {requestToReview.file_number && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Legajo:</span>{' '}
                  {requestToReview.file_number} •{' '}
                  <span className="font-semibold text-slate-700">Departamento:</span>{' '}
                  {requestToReview.department || 'Sin asignar'}
                </div>
              )}
            </div>

            {/* Si ya está resuelta, es solo informativa (inmutable) */}
            {requestToReview.status === 'approved' || requestToReview.status === 'rejected' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700">
                  <span className="font-semibold block text-slate-900 mb-1">
                    Estado Actual: {requestToReview.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                  </span>
                  <p className="text-slate-600">
                    {requestToReview.resolution_notes || 'Sin notas adicionales.'}
                  </p>
                  {requestToReview.resolver_first_name && (
                    <span className="block text-[11px] text-slate-400 mt-2">
                      Resuelto por: {requestToReview.resolver_first_name}{' '}
                      {requestToReview.resolver_last_name}
                    </span>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRequestToReview(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResolveRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Resolución
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReviewStatus('approved')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        reviewStatus === 'approved'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprobar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewStatus('rejected')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        reviewStatus === 'rejected'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Rechazar</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notas de Resolución (Opcional, máx 500 caracteres)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    placeholder="Instrucciones de entrega, motivo del rechazo o fecha estipulada..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none placeholder:text-slate-400"
                  />
                  <div className="text-right text-[10px] text-slate-400 mt-0.5">
                    {resolutionNotes.length}/500 caracteres
                  </div>
                </div>

                {reviewError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{reviewError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestToReview(null)}
                    disabled={resolving}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resolving}
                    className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 ${
                      reviewStatus === 'approved'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {resolving
                      ? 'Procesando...'
                      : reviewStatus === 'approved'
                      ? 'Confirmar Aprobación'
                      : 'Confirmar Rechazo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RequestsPage;
