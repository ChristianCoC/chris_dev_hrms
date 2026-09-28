import { query } from '../config/db.js';

/**
 * Registra una acción relevante en la tabla audit_logs
 * @param {Object} params
 * @param {string} params.userId - UUID del usuario que realiza la acción
 * @param {string} params.action - Nombre de la acción (ej: 'CLAIM_RESOLVED', 'USER_DELETED')
 * @param {string} params.entityType - Tipo de entidad afectada (ej: 'claims', 'users')
 * @param {string} params.entityId - ID de la entidad afectada
 * @param {Object} [params.oldValues] - Estado anterior en formato objeto/JSON
 * @param {Object} [params.newValues] - Estado nuevo en formato objeto/JSON
 * @param {string} [params.ipAddress] - Dirección IP del cliente
 */
export const logAuditEvent = async ({
  userId,
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
}) => {
  try {
    const insertQuery = `
      INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, old_values, new_values, ip_address, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, action, entity_type, timestamp;
    `;

    const result = await query(insertQuery, [
      userId,
      action,
      entityType,
      entityId ? String(entityId) : null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress || null,
    ]);

    return result.rows[0];
  } catch (error) {
    // Si falla el log de auditoría, se registra en consola pero no interrumpe el flujo principal
    console.error('⚠️ Error al registrar log de auditoría:', error.message);
    return null;
  }
};

/**
 * Obtiene los registros de auditoría paginados con datos del usuario
 */
export const getAuditLogs = async ({ limit = 50, offset = 0, action = null, entityType = null } = {}) => {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (action) {
    conditions.push(`a.action = $${paramIndex++}`);
    values.push(action);
  }

  if (entityType) {
    conditions.push(`a.entity_type = $${paramIndex++}`);
    values.push(entityType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sqlQuery = `
    SELECT 
      a.id,
      a.user_id,
      u.email AS user_email,
      u.first_name AS user_first_name,
      u.last_name AS user_last_name,
      a.action,
      a.entity_type,
      a.entity_id,
      a.old_values,
      a.new_values,
      a.ip_address,
      a.timestamp
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ${whereClause}
    ORDER BY a.timestamp DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  values.push(limit, offset);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM audit_logs a
    ${whereClause}
  `;

  const [logsResult, countResult] = await Promise.all([
    query(sqlQuery, values),
    query(countQuery, values.slice(0, paramIndex - 3)),
  ]);

  return {
    total: parseInt(countResult.rows[0].total, 10),
    logs: logsResult.rows,
  };
};

export default { logAuditEvent, getAuditLogs };
