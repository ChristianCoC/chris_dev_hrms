import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Componente Modal base reutilizable.
 * Proporciona overlay con desenfoque, cierre por ESC o botón, y contenedor accesible.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Indica si el modal está visible
 * @param {Function} props.onClose - Función invocada al solicitar el cierre
 * @param {string|React.ReactNode} [props.title] - Título del modal
 * @param {string|React.ReactNode} [props.subtitle] - Subtítulo o descripción secundaria
 * @param {React.ReactNode} [props.icon] - Ícono representativo en la cabecera
 * @param {string} [props.maxWidth='max-w-md'] - Ancho máximo Tailwind (ej: 'max-w-md', 'max-w-lg', 'max-w-xl')
 * @param {boolean} [props.preventClose=false] - Deshabilita el cierre si hay una acción en curso
 * @param {React.ReactNode} props.children - Contenido del cuerpo del modal
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'max-w-md',
  preventClose = false,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !preventClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, preventClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !preventClose) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-xl ${maxWidth} w-full p-6 border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150`}
      >
        {!preventClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1 hover:bg-slate-100"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {(title || icon) && (
          <div className="flex items-center gap-3 mb-3">
            {icon && <div className="shrink-0">{icon}</div>}
            <div className="pr-6">
              {title && (
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        )}

        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
