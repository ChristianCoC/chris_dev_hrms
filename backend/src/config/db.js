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
    await pool.query(`
      INSERT INTO roles (id, name, description, level) VALUES
        (1, 'Administrador', 'Control total y administración del sistema HRMS', 1),
        (2, 'Recursos Humanos', 'Gestión de personal, reclamos, solicitudes y comunicados', 2),
        (3, 'Líder de Área', 'Gestión de equipo y solicitudes departamentales', 3),
        (4, 'Empleado', 'Colaborador estándar con acceso a solicitudes y reclamos personales', 4)
      ON CONFLICT (id) DO NOTHING
    `);
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number VARCHAR(30)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS file_number VARCHAR(30)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_date TIMESTAMP NULL');
    await pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(150)');
    await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'system'");
    await pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)');
    await pool.query('ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500)');
    await pool.query('ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(100)');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disciplinary_actions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        issued_by UUID NOT NULL REFERENCES users(id),
        type VARCHAR(50) NOT NULL CHECK (type IN ('llamado_atencion', 'apercibimiento', 'suspension', 'otro')),
        severity VARCHAR(20) NOT NULL DEFAULT 'leve' CHECK (severity IN ('leve', 'moderada', 'grave')),
        incident_date DATE NOT NULL,
        reason VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        suspension_days INTEGER DEFAULT 0 CHECK (suspension_days >= 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        resolution_notes VARCHAR(500),
        resolved_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
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

