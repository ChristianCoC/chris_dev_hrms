import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  User,
  Clock,
  Building2,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { disciplinaryService } from '../services/disciplinaryService.js';
import { EmptyState } from '../components/ui/index.js';

const TYPE_CONFIG = {
  llamado_atencion: {
    label: 'Llamado de Atención',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  apercibimiento: {
    label: 'Apercibimiento',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  suspension: {
    label: 'Suspensión',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  otro: {
    label: 'Novedad Disciplinaria',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

const SEVERITY_CONFIG = {
  leve: {
    label: 'Leve',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  moderada: {
    label: 'Moderada',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  grave: {
    label: 'Grave',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export const MyDisciplinaryPage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMyDisciplinaryRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await disciplinaryService.getMyDisciplinaryActions();
      const items = res?.data?.disciplinary_actions || res?.disciplinary_actions || [];
      setRecords(Array.isArray(items) ? items : []);
      if (res?.data?.employee || res?.employee) {
        setEmployeeProfile(res?.data?.employee || res?.employee);
      }
    } catch (err) {
      setError(err.message || 'Error al obtener tu legajo disciplinario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDisciplinaryRecords();
  }, []);

  const profile = employeeProfile || user;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const totalSuspensionDays = records.reduce(
    (acc, cur) => acc + (parseInt(cur.suspension_days, 10) || 0),
    0
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md mb-2">
            <FileText className="w-3.5 h-3.5" />
            <span>Expediente de Personal</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Mi Legajo Digital
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Consulta privada del historial de llamados de atención, apercibimientos y medidas disciplinarias.
          </p>
        </div>

        {/* Ficha rápida del colaborador */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex items-center gap-4 text-xs">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
            {profile?.first_name?.[0]}
            {profile?.last_name?.[0]}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">
              {profile?.first_name} {profile?.last_name}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 text-slate-500 text-xs mt-0.5">
              <span>
                <strong className="text-slate-600 font-semibold">Legajo:</strong>{' '}
                {profile?.file_number ? (
                  <span className="text-slate-800 font-medium">#{profile.file_number}</span>
                ) : (
                  <span className="text-slate-400 italic">Sin registrar</span>
                )}
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-600 font-semibold">DNI:</strong>{' '}
                {profile?.document_number ? (
                  <span className="text-slate-800 font-medium">{profile.document_number}</span>
                ) : (
                  <span className="text-slate-400 italic">Sin registrar</span>
                )}
              </span>
              {profile?.department && (
                <>
                  <span>•</span>
                  <span>
                    <strong className="text-slate-600 font-semibold">Área:</strong>{' '}
                    {profile.department}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Estado del Legajo: Tarjeta de Resumen */}
      {!loading && !error && (
        <div
          className={`p-4 rounded-xl border transition-all ${
            records.length === 0
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {records.length === 0 ? (
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-sm font-semibold">
                {records.length === 0
                  ? 'Legajo Impecable • Sin Sanciones Registradas'
                  : `Historial Activo • ${records.length} registro(s) en tu legajo`}
              </h2>
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                {records.length === 0
                  ? 'Tu expediente se encuentra al día y no registra llamados de atención, apercibimientos ni suspensiones. Mantén tu compromiso con las políticas de la organización.'
                  : `Se registran medidas disciplinarias en tu expediente${
                      totalSuspensionDays > 0
                        ? ` con un acumulado de ${totalSuspensionDays} día(s) de suspensión.`
                        : '.'
                    } Cada medida ha sido debidamente notificada y registrada bajo auditoría.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Registros Disciplinarios */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <BadgeAlert className="w-4 h-4 text-slate-500" />
            <span>Detalle de Notificaciones y Medidas Disciplinarias</span>
          </h2>
          <span className="text-xs text-slate-400">
            {records.length} {records.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Consultando tu legajo digital...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={ShieldCheck}
              title="Sin novedades disciplinarias"
              description="No posees apercibimientos ni medidas disciplinarias registradas en tu historial laboral."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((item) => {
              const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG.otro;
              const severityInfo = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.leve;

              return (
                <div key={item.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${typeInfo.badgeClass}`}
                      >
                        {typeInfo.label}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${severityInfo.badgeClass}`}
                      >
                        Severidad: {severityInfo.label}
                      </span>
                      {item.type === 'suspension' && item.suspension_days > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          {item.suspension_days} {item.suspension_days === 1 ? 'día' : 'días'} de suspensión
                        </span>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Fecha del hecho: {formatDate(item.incident_date)}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {item.reason}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-line">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Registrado por:{' '}
                        <strong className="text-slate-600 font-medium">
                          {item.issuer_first_name} {item.issuer_last_name}
                        </strong>{' '}
                        ({item.issuer_role_name || 'Recursos Humanos'})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Notificado: {formatDateTime(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDisciplinaryPage;
