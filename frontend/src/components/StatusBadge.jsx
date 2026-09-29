import React from 'react';

const STATUS_CONFIG = {
  pending: {
    label: 'Pendiente',
    classes: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  in_progress: {
    label: 'En curso',
    classes: 'bg-blue-50 text-blue-800 border-blue-200/80',
    dot: 'bg-blue-500',
  },
  approved: {
    label: 'Aprobado',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rechazado',
    classes: 'bg-rose-50 text-rose-800 border-rose-200/80',
    dot: 'bg-rose-500',
  },
};

const PRIORITY_CONFIG = {
  high: {
    label: 'Alta',
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
  normal: {
    label: 'Normal',
    classes: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  low: {
    label: 'Baja',
    classes: 'bg-slate-50 text-slate-500 border-slate-200',
  },
};

export const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || {
    label: status || 'Desconocido',
    classes: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.classes}`}
    >
      Prioridad {config.label.toLowerCase()}
    </span>
  );
};

export default StatusBadge;
