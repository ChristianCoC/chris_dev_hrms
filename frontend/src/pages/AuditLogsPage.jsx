import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '../api/client.js';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async (targetPage = 1) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/audit-logs?page=${targetPage}&limit=25`);
      setLogs(res.data?.logs || []);
      setTotalPages(res.totalPages || 1);
      setTotalRecords(res.total || 0);
      setPage(targetPage);
    } catch (err) {
      console.error('Error al cargar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, []);

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'CLAIM_CREATED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Reclamo Creado</span>;
      case 'CLAIM_STATUS_UPDATED':
      case 'CLAIM_RESOLVED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Reclamo Actualizado</span>;
      case 'USER_DELETED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Usuario Eliminado</span>;
      case 'EMPLOYEE_UPDATED':
      case 'USER_UPDATED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Ficha Modificada</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{action}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            <span>Registro de Auditoría y Trazabilidad</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Historial inmutable de operaciones sensibles ejecutadas en la plataforma (
            {totalRecords === 1 ? '1 evento registrado' : `${totalRecords} eventos registrados`}
            )
          </p>
        </div>

        <button
          onClick={() => fetchLogs(page)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar registros</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-700 font-semibold">
              <tr>
                <th className="px-4 py-3">Fecha y Hora</th>
                <th className="px-4 py-3">Acción Registrada</th>
                <th className="px-4 py-3">Entidad Afectada</th>
                <th className="px-4 py-3">Ejecutado por</th>
                <th className="px-4 py-3">Dirección IP</th>
                <th className="px-4 py-3 text-right">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">
                    Cargando bitácora de auditoría...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No se registran eventos de auditoría todavía.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 font-sans whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="font-semibold text-slate-900">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="text-slate-400 block text-[10px]">
                          ID: {log.entity_id.substring(0, 16)}...
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      {log.user_email ? (
                        <div>
                          <div className="text-slate-900 font-medium">
                            {log.user_first_name} {log.user_last_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.user_email}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sistema / Anónimo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver JSON</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchLogs(page - 1)}
                className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchLogs(page + 1)}
                className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Visor de valores auditados */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">
              Detalle del Evento #{selectedLog.id}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Acción: <strong className="text-slate-800">{selectedLog.action}</strong> sobre entidad{' '}
              <strong className="text-slate-800">{selectedLog.entity_type}</strong>
            </p>

            <div className="mt-4 space-y-3">
              {selectedLog.old_values && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Valores Previos (old_values):
                  </span>
                  <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs overflow-x-auto font-mono text-slate-700">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Valores Nuevos (new_values):
                  </span>
                  <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs overflow-x-auto font-mono text-slate-700">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
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

export default AuditLogsPage;
