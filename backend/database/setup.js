import fs from 'fs/promises'; 
import pool from '../src/config/db.js';

const initializeDB = async () => {
  try {
    console.log('⏳ Leyendo archivo de inicialización SQL...');
    
    const sqlScript = await fs.readFile('./database/init.sql', 'utf-8');
    
    console.log('⏳ Ejecutando creación de tablas en PostgreSQL...');
    await pool.query(sqlScript); 
    
    console.log('✅ Base de datos inicializada y tablas creadas correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    process.exit(1); 
  }
};

initializeDB();