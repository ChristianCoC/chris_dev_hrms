import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, ExternalLink } from 'lucide-react';
import api from '../api/client.js';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Por favor ingresa tu correo institucional.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/api/auth/forgot-password', { email });
      setSuccess(true);
      if (res.previewUrl) {
        setPreviewUrl(res.previewUrl);
      }
    } catch (err) {
      setError(err.message || 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white tracking-wider text-xl mx-auto shadow-sm">
          HR
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Recuperar Contraseña
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Ingresa tu correo para recibir un enlace de recuperación
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-xl border border-slate-200">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Solicitud recibida correctamente</p>
                  <p className="mt-1 text-emerald-800">
                    Si el correo <strong>{email}</strong> se encuentra registrado en nuestro sistema, hemos enviado un enlace para restablecer tu contraseña.
                  </p>
                  <p className="mt-2 text-emerald-700 text-[11px]">
                    El enlace será válido por 1 hora. Revisa también tu carpeta de spam o correo no deseado.
                  </p>
                </div>
              </div>

              {previewUrl && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span>Simulación de Correo (Ethereal Email)</span>
                  </p>
                  <p className="mt-1 text-blue-700 text-[11px]">
                    Puedes inspeccionar el correo simulado generado para esta prueba:
                  </p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    <span>Abrir correo en Ethereal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al inicio de sesión</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo institucional
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@organizacion.com"
                    required
                    className="w-full px-3 py-2 pl-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder:text-slate-400"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                  Te enviaremos las instrucciones de recuperación a tu casilla de correo registrada.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enviando enlace...</span>
                  </>
                ) : (
                  <span>Enviar enlace de recuperación</span>
                )}
              </button>

              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver al inicio de sesión</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
