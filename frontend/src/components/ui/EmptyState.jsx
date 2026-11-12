import React from 'react';

/**
 * Componente EmptyState reutilizable para listados vacíos o sin resultados de búsqueda.
 *
 * @param {Object} props
 * @param {React.ComponentType<{ className?: string }>|React.ReactNode} [props.icon] - Ícono a renderizar
 * @param {string} props.title - Mensaje o título principal
 * @param {string} [props.description] - Descripción detallada o sugerencia
 * @param {React.ReactNode} [props.action] - Botón o acción opcional
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = 'py-16',
}) => {
  return (
    <div className={`text-center px-4 ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          {typeof Icon === 'function' ? <Icon className="w-6 h-6 text-slate-400" /> : Icon}
        </div>
      )}
      <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
      {description && (
        <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
