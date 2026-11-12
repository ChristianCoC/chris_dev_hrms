/**
 * Middleware centralizado de manejo global de errores.
 * Captura excepciones no controladas y previene la fuga de detalles internos o esquemas SQL.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`❌ [${req.method} ${req.originalUrl}] Error ${statusCode}:`, err.message);

  return res.status(statusCode).json({
    status: 'error',
    message: err.isOperational ? err.message : (statusCode === 500 ? 'Error interno del servidor.' : err.message),
    ...(isDev && { stack: err.stack }),
  });
};

export default errorHandler;
