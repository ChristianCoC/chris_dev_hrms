import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, closePool } from './config/db.js';

// Cargar variables de entorno
dotenv.config();

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const getArgentinaDateTime = (date = new Date()) => {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
};

/**
 * Configuración de CORS
 * Permite que el frontend en React (Vite) se comunique sin bloqueos
 */
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

// Middlewares globales
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Limitar tamaño del JSON
app.use(express.urlencoded({ limit: '10mb', extended: true }));

/**
 * Middleware de logging para las peticiones
 */
app.use((req, res, next) => {
  if (NODE_ENV === 'development') {
    console.log(`📨 ${req.method} ${req.path}`);
  }
  next();
});

/**
 * Health Check - Ruta de prueba
 * Verifica que el servidor está funcionando y la BD está conectada
 */
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    const currentDate = new Date();
    
    res.status(200).json({
      status: 'ok',
      message: 'HRMS Server is running correctly',
      argentinaTimestamp: getArgentinaDateTime(currentDate),
      timezone: ARGENTINA_TIME_ZONE,
      environment: NODE_ENV,
      database: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    });
  } catch (error) {
    const currentDate = new Date();

    res.status(503).json({
      status: 'error',
      message: 'HRMS Server is experiencing issues',
      error: error.message,
      argentinaTimestamp: getArgentinaDateTime(currentDate),
      timezone: ARGENTINA_TIME_ZONE,
    });
  }
});

/**
 * Rutas futuras (placeholder)
 */
app.use('/api/auth', (req, res) => {
  res.json({ message: 'Auth routes coming soon...' });
});

app.use('/api/employees', (req, res) => {
  res.json({ message: 'Employee routes coming soon...' });
});

app.use('/api/claims', (req, res) => {
  res.json({ message: 'Claims routes coming soon...' });
});

app.use('/api/notifications', (req, res) => {
  res.json({ message: 'Notifications routes coming soon...' });
});

/**
 * Manejo de ruta no encontrada (404)
 */
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl,
  });
});

/**
 * Manejo global de errores
 */
app.use((err, req, res, next) => {
  console.error('❌ Error global:', err.message);
  
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    getArgentinaDateTime: getArgentinaDateTime(),
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

/**
 * Iniciar servidor
 */
const server = app.listen(PORT, () => {
  console.log(`
  
    🚀 HRMS Server iniciado correctamente                    
    📍 Servidor: http://localhost:${PORT}                    
    🌍 Entorno: ${NODE_ENV.toUpperCase()}                    
    🔗 CORS habilitado desde: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}
    🕒 Hora de Argentina: ${getArgentinaDateTime()}
  
  `);
});

/**
 * Manejo de señales de cierre (Graceful Shutdown)
 */
process.on('SIGTERM', async() => {
  console.log('📋 SIGTERM recibido. Cerrando servidor...');
  server.close(async () => {
    await closePool();
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('📋 SIGINT recibido. Cerrando servidor...');
  server.close(async () => {
    await closePool();
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

export default app;
