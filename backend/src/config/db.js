import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'hrms_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  
  // Optimizaciones para alta concurrencia
  max: 120, 
  idleTimeoutMillis: 15000, 
  connectionTimeoutMillis: 3000, 
  query_timeout: 30000,
  
  // Optimizaciones de rendimiento
  application_name: 'hrms_app',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Monitoreo del estado del pool
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err.message);
  process.exit(-1);
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Nueva conexión establecida');
  }
});

export const getPoolMetrics = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    active: pool.totalCount - pool.idleCount,
    waiting: pool.waitingCount,
  };
};

export const query = async (sqlQuery, values = []) => {
  const startTime = Date.now();
  
  try {
    const result = await pool.query(sqlQuery, values);
    const duration = Date.now() - startTime;
    
    // Logging de rendimiento en desarrollo
    if (process.env.NODE_ENV === 'development' && duration > 500) {
      console.warn(`⚠️ Consulta lenta (${duration}ms):`, sqlQuery.substring(0, 50));
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error en consulta (${duration}ms):`, {
      error: error.message,
      query: sqlQuery.substring(0, 80),
    });
    throw error;
  }
};

export const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transacción revertida:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

export const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as server_time, version()');
    console.log('✅ Conexión a PostgreSQL exitosa:', result.rows[0].version);
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a PostgreSQL:', error.message);
    return false;
  }
};

export const closePool = async () => {
  try {
    const metrics = getPoolMetrics();
    console.log('📊 Estado final del pool:', metrics);
    
    await pool.end();
    console.log('✅ Pool de conexiones cerrado correctamente');
  } catch (error) {
    console.error('❌ Error al cerrar el pool:', error.message);
  }
};

export default pool;

