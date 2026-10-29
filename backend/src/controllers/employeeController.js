import { query } from "../config/db.js";
import { logAuditEvent } from "../services/auditService.js";

/**
 * Obtener lista de empleados con filtros opcionales (búsqueda, departamento, rol)
 */
export const getEmployees = async (req, res) => {
  const { search, department, role_id } = req.query;

  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (search && search.trim()) {
      conditions.push(
        `(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.document_number ILIKE $${paramIndex} OR u.file_number ILIKE $${paramIndex})`
      );
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (department && department.trim()) {
      conditions.push(`u.department ILIKE $${paramIndex}`);
      values.push(`%${department.trim()}%`);
      paramIndex++;
    }

    if (role_id && role_id !== "" && !isNaN(parseInt(role_id, 10))) {
      conditions.push(`u.role_id = $${paramIndex}`);
      values.push(parseInt(role_id, 10));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sqlQuery = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.document_number,
        u.file_number,
        u.phone,
        u.department,
        u.hire_date,
        u.role_id,
        COALESCE(u.is_active, false) AS is_active,
        u.deactivation_date,
        CASE WHEN u.reset_token IS NOT NULL AND u.is_active = false THEN true ELSE false END AS is_pending_activation,
        r.name AS role_name,
        r.level AS role_level,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.last_name ASC, u.first_name ASC
    `;

    const result = await query(sqlQuery, values);

    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        employees: result.rows,
      },
      employees: result.rows,
    });
  } catch (error) {
    console.error("❌ Error al obtener empleados:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener la lista de empleados.",
      error: error.message,
    });
  }
};

/**
 * Obtener estadísticas globales de RRHH para el Dashboard
 */
export const getEmployeeStats = async (req, res) => {
  try {
    // Total de empleados
    const totalResult = await query("SELECT COUNT(*) AS total FROM users");
    const totalEmployees = parseInt(totalResult.rows[0].total, 10);

    // Conteo por departamento
    const deptResult = await query(`
      SELECT COALESCE(department, 'Sin Asignar') AS department, COUNT(*) AS count
      FROM users
      GROUP BY department
      ORDER BY count DESC
    `);

    // Conteo por rol
    const rolesResult = await query(`
      SELECT r.name AS role_name, COUNT(u.id) AS count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id, r.name
      ORDER BY r.level ASC
    `);

    // Conteo de reclamos por estado
    const claimsResult = await query(`
      SELECT status, COUNT(*) AS count
      FROM claims
      GROUP BY status
    `);

    return res.status(200).json({
      status: "success",
      data: {
        totalEmployees,
        byDepartment: deptResult.rows,
        byRole: rolesResult.rows,
        claimsByStatus: claimsResult.rows,
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener estadísticas de empleados:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener estadísticas de empleados.",
      error: error.message,
    });
  }
};

/**
 * Obtener detalle de un empleado por ID (incluyendo resumen de reclamos)
 */
export const getEmployeeById = async (req, res) => {
  const { id } = req.params;

  try {
    const userQuery = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.document_number,
        u.file_number,
        u.phone,
        u.department,
        u.hire_date,
        u.role_id,
        COALESCE(u.is_active, false) AS is_active,
        u.deactivation_date,
        CASE WHEN u.reset_token IS NOT NULL AND u.is_active = false THEN true ELSE false END AS is_pending_activation,
        r.name AS role_name,
        r.level AS role_level,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `;

    const userResult = await query(userQuery, [id]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Empleado no encontrado.",
      });
    }

    // Estadísticas de reclamos del empleado
    const claimsStats = await query(`
      SELECT 
        COUNT(*) AS total_claims,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_claims,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_claims,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_claims
      FROM claims
      WHERE filed_by_id = $1
    `, [id]);

    return res.status(200).json({
      status: "success",
      data: {
        employee: userResult.rows[0],
        claimsStats: claimsStats.rows[0],
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener detalle del empleado:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener detalle del empleado.",
      error: error.message,
    });
  }
};

/**
 * Actualizar datos de RRHH del empleado (departamento, teléfono, fecha contratación, rol, etc.)
 */
export const updateEmployeeHR = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone, department, hire_date, role_id, document_number, file_number } = req.body;

  try {
    const currentEmployeeQuery = await query(
      "SELECT id, first_name, last_name, document_number, file_number, phone, department, hire_date, role_id FROM users WHERE id = $1",
      [id]
    );

    if (currentEmployeeQuery.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Empleado no encontrado.",
      });
    }

    const currentData = currentEmployeeQuery.rows[0];
    const fieldsToUpdate = [];
    const valuesToUpdate = [];
    let queryIndex = 1;

    if (first_name !== undefined) {
      fieldsToUpdate.push(`first_name = $${queryIndex++}`);
      valuesToUpdate.push(String(first_name).trim());
    }
    if (last_name !== undefined) {
      fieldsToUpdate.push(`last_name = $${queryIndex++}`);
      valuesToUpdate.push(String(last_name).trim());
    }
    if (document_number !== undefined) {
      const cleanDoc = document_number && String(document_number).trim() ? String(document_number).trim() : null;
      if (cleanDoc) {
        const existingDoc = await query(
          "SELECT id FROM users WHERE document_number = $1 AND id != $2",
          [cleanDoc, id]
        );
        if (existingDoc.rowCount > 0) {
          return res.status(400).json({
            status: "error",
            message: "El número de documento ya se encuentra registrado.",
          });
        }
      }
      fieldsToUpdate.push(`document_number = $${queryIndex++}`);
      valuesToUpdate.push(cleanDoc);
    }
    if (file_number !== undefined) {
      const cleanFile = file_number && String(file_number).trim() ? String(file_number).trim() : null;
      if (cleanFile) {
        const existingFile = await query(
          "SELECT id FROM users WHERE file_number = $1 AND id != $2",
          [cleanFile, id]
        );
        if (existingFile.rowCount > 0) {
          return res.status(400).json({
            status: "error",
            message: "El número de legajo ya se encuentra registrado.",
          });
        }
      }
      fieldsToUpdate.push(`file_number = $${queryIndex++}`);
      valuesToUpdate.push(cleanFile);
    }
    if (phone !== undefined) {
      fieldsToUpdate.push(`phone = $${queryIndex++}`);
      valuesToUpdate.push(phone ? String(phone).trim() : null);
    }
    if (department !== undefined) {
      fieldsToUpdate.push(`department = $${queryIndex++}`);
      valuesToUpdate.push(department ? String(department).trim() : null);
    }
    if (hire_date !== undefined) {
      fieldsToUpdate.push(`hire_date = $${queryIndex++}`);
      valuesToUpdate.push(hire_date || null);
    }
    if (role_id !== undefined) {
      fieldsToUpdate.push(`role_id = $${queryIndex++}`);
      valuesToUpdate.push(parseInt(role_id, 10));
    }

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No se proporcionaron campos para actualizar.",
      });
    }

    valuesToUpdate.push(id);
    const updateQuery = `
      UPDATE users
      SET ${fieldsToUpdate.join(", ")}, updated_at = NOW()
      WHERE id = $${queryIndex}
      RETURNING id, email, first_name, last_name, document_number, file_number, phone, department, hire_date, role_id, updated_at;
    `;

    const result = await query(updateQuery, valuesToUpdate);
    const updatedEmployee = result.rows[0];

    // Registrar evento de auditoría
    const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId: req.user.id,
      action: "EMPLOYEE_UPDATED",
      entityType: "employees",
      entityId: id,
      oldValues: currentData,
      newValues: updatedEmployee,
      ipAddress,
    });

    return res.status(200).json({
      status: "success",
      message: "Datos de empleado actualizados correctamente.",
      data: {
        employee: updatedEmployee,
      },
    });
  } catch (error) {
    console.error("❌ Error al actualizar empleado:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al actualizar datos del empleado.",
      error: error.message,
    });
  }
};

/**
 * Dar de baja lógica a un empleado (desactivación).
 * Exclusivo para administradores (role_id = 1).
 */
export const deactivateEmployee = async (req, res) => {
  const { id } = req.params;

  // Si el usuario a desactivar es el mismo que ejecuta la acción
  if (req.user.id === id) {
    return res.status(400).json({
      status: "error",
      message: "No puedes darte de baja a ti mismo.",
    });
  }

  try {
    const userResult = await query(
      "SELECT id, email, first_name, last_name, is_active FROM users WHERE id = $1",
      [id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Empleado no encontrado.",
      });
    }

    const employee = userResult.rows[0];

    // Si ya está inactivo
    if (employee.is_active === false) {
      return res.status(400).json({
        status: "error",
        message: "El empleado ya se encuentra dado de baja.",
      });
    }

    // Actualizar registro: is_active = false, deactivation_date = NOW(), updated_at = NOW()
    const updateResult = await query(
      `UPDATE users 
       SET is_active = false, deactivation_date = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, email, first_name, last_name, is_active, deactivation_date, updated_at`,
      [id]
    );

    const deactivatedUser = updateResult.rows[0];

    // Registrar en audit_logs
    const ipAddress = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId: req.user.id,
      action: "EMPLOYEE_DEACTIVATED_BY_ADMIN",
      entityType: "users",
      entityId: id,
      oldValues: {
        is_active: employee.is_active,
      },
      newValues: {
        is_active: false,
        deactivation_date: deactivatedUser.deactivation_date,
      },
      ipAddress,
    });

    return res.status(200).json({
      status: "success",
      message: "Empleado dado de baja correctamente.",
      data: {
        employee: deactivatedUser,
      },
    });
  } catch (error) {
    console.error("❌ Error al dar de baja al empleado:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al procesar la baja del empleado.",
      error: error.message,
    });
  }
};

export default {
  getEmployees,
  getEmployeeStats,
  getEmployeeById,
  updateEmployeeHR,
  deactivateEmployee,
};
