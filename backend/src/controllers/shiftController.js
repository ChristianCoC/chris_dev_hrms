import { query } from "../config/db.js";
import { logAuditFromRequest } from "../services/auditService.js";

export const VALID_SHIFT_TYPES = ["trabajo", "franco", "licencia", "feriado"];

/**
 * Obtiene las fechas de lunes y domingo de la semana actual en formato YYYY-MM-DD
 */
export const getDefaultWeekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0: domingo, 1: lunes, ..., 6: sábado
  // Convertir a lunes como primer día (1 lunes ... 7 domingo)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: formatLocalYMD(monday),
    endDate: formatLocalYMD(sunday),
  };
};

/**
 * Asignar o actualizar un turno de trabajo (UPSERT atómico por user_id y shift_date)
 * Matriz Jerárquica Estricta (RBAC):
 * - Administrador (role_id: 1): Puede asignar y modificar su propio horario y el de todos los rangos (1, 2, 3, 4) sin restricciones de tipo.
 * - Recursos Humanos (role_id: 2): Prohibido auto-asignarse (403). Prohibido rangos <= 2 (403). Permitido rangos inferiores: Líder (3) y Empleado (4).
 * - Líder de Área (role_id: 3): Prohibido auto-asignarse (403). Prohibido rangos <= 3 (403). Permitido solo Empleados (4) y exclusivamente 'trabajo' o 'franco'.
 * - Empleado (role_id: 4): Sin permisos de escritura (403).
 */
export const upsertShift = async (req, res) => {
  const userRole = Number(req.user?.role_id);
  if (![1, 2, 3].includes(userRole)) {
    return res.status(403).json({
      status: "error",
      message: "No tienes permisos para asignar o modificar turnos de trabajo.",
    });
  }

  const {
    user_id,
    shift_date,
    shift_type,
    start_time = null,
    end_time = null,
    location = null,
    notes = null,
  } = req.body;

  if (!user_id || !shift_date || !shift_type) {
    return res.status(400).json({
      status: "error",
      message:
        "Faltan campos obligatorios: user_id, shift_date y shift_type son requeridos.",
    });
  }

  if (isNaN(Date.parse(shift_date))) {
    return res.status(400).json({
      status: "error",
      message: "La fecha del turno no es válida.",
    });
  }

  const normalizedType = String(shift_type).trim().toLowerCase();
  if (!VALID_SHIFT_TYPES.includes(normalizedType)) {
    return res.status(400).json({
      status: "error",
      message: `El tipo de turno es inválido. Valores permitidos: ${VALID_SHIFT_TYPES.join(
        ", "
      )}.`,
    });
  }

  // Reglas de horario según tipo de turno
  let finalStartTime = null;
  let finalEndTime = null;

  if (normalizedType === "trabajo") {
    if (!start_time || !end_time) {
      return res.status(400).json({
        status: "error",
        message:
          "Para turnos de tipo trabajo, los horarios de inicio y fin son obligatorios.",
      });
    }

    const startTrim = String(start_time).trim();
    const endTrim = String(end_time).trim();

    if (startTrim === endTrim) {
      return res.status(400).json({
        status: "error",
        message: "El horario de entrada y salida no pueden ser idénticos.",
      });
    }

    finalStartTime = startTrim;
    finalEndTime = endTrim;
  } else {
    // Para franco, licencia o feriado, se fuerza null
    finalStartTime = null;
    finalEndTime = null;
  }

  const cleanLocation = location ? String(location).trim().slice(0, 120) : null;
  const cleanNotes = notes ? String(notes).trim().slice(0, 300) : null;

  try {
    // Validar que el colaborador destino exista y esté activo
    const userCheck = await query(
      "SELECT id, first_name, last_name, role_id, is_active FROM users WHERE id = $1",
      [user_id]
    );

    if (userCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "El colaborador especificado no existe.",
      });
    }

    const targetUser = userCheck.rows[0];
    if (!targetUser.is_active) {
      return res.status(400).json({
        status: "error",
        message: "No es posible asignar turnos a un colaborador inactivo o dado de baja.",
      });
    }

    const targetRoleId = Number(targetUser.role_id);
    const isSelf = String(targetUser.id) === String(req.user.id);

    // Validación jerárquica RBAC estricta
    if (userRole === 2) {
      // Recursos Humanos (role_id: 2)
      if (isSelf) {
        return res.status(403).json({
          status: "error",
          message: "Los usuarios de Recursos Humanos no pueden gestionar su propio horario.",
        });
      }
      if (targetRoleId <= 2) {
        return res.status(403).json({
          status: "error",
          message: "No tienes permisos para gestionar turnos de colaboradores de rango igual o superior.",
        });
      }
    } else if (userRole === 3) {
      // Líder de Área (role_id: 3)
      if (isSelf) {
        return res.status(403).json({
          status: "error",
          message: "Los Líderes de Área no pueden gestionar su propio horario.",
        });
      }
      if (targetRoleId <= 3) {
        return res.status(403).json({
          status: "error",
          message: "Los Líderes de Área solo pueden gestionar turnos de colaboradores con rol Empleado.",
        });
      }
      if (normalizedType !== "trabajo" && normalizedType !== "franco") {
        return res.status(403).json({
          status: "error",
          message: "Los Líderes de Área solo pueden asignar turnos de trabajo o francos.",
        });
      }

      // Si existe un turno previo de tipo licencia o feriado, no puede sobrescribirlo
      const existingShiftCheck = await query(
        "SELECT id, shift_type FROM work_shifts WHERE user_id = $1 AND shift_date = $2",
        [user_id, shift_date]
      );

      if (existingShiftCheck.rowCount > 0) {
        const existingType = existingShiftCheck.rows[0].shift_type;
        if (["licencia", "feriado"].includes(existingType)) {
          return res.status(403).json({
            status: "error",
            message:
              "Los Líderes de Área no pueden modificar o sobrescribir licencias o feriados gestionados por RRHH o Administración.",
          });
        }
      }
    }

    // Insertar o actualizar atómicamente por (user_id, shift_date)
    const upsertQuery = `
      INSERT INTO work_shifts (
        user_id,
        shift_date,
        shift_type,
        start_time,
        end_time,
        location,
        notes,
        assigned_by,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, shift_date)
      DO UPDATE SET
        shift_type = EXCLUDED.shift_type,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        location = EXCLUDED.location,
        notes = EXCLUDED.notes,
        assigned_by = EXCLUDED.assigned_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id, 
        user_id, 
        TO_CHAR(shift_date, 'YYYY-MM-DD') AS shift_date, 
        shift_type, 
        TO_CHAR(start_time, 'HH24:MI') AS start_time, 
        TO_CHAR(end_time, 'HH24:MI') AS end_time, 
        location, 
        notes, 
        assigned_by, 
        created_at, 
        updated_at;
    `;

    const result = await query(upsertQuery, [
      user_id,
      shift_date,
      normalizedType,
      finalStartTime,
      finalEndTime,
      cleanLocation,
      cleanNotes,
      req.user.id,
    ]);

    const shift = result.rows[0];

    // Registrar en logs de auditoría
    await logAuditFromRequest(req, {
      action: "WORK_SHIFT_ASSIGNED",
      entityType: "work_shifts",
      entityId: String(shift.id),
      newValues: {
        user_id: shift.user_id,
        shift_date: shift.shift_date,
        shift_type: shift.shift_type,
        start_time: shift.start_time,
        end_time: shift.end_time,
        location: shift.location,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Turno de trabajo asignado correctamente.",
      data: {
        shift,
      },
      shift,
    });
  } catch (error) {
    console.error("❌ Error al asignar turno de trabajo:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al asignar el turno de trabajo.",
    });
  }
};

/**
 * Obtener turnos de trabajo filtrados por rango de fechas (semanal).
 * Visibilidad Jerárquica:
 * - Admin (1): Ve los turnos de todos los colaboradores activos.
 * - RRHH (2): Ve sus propios turnos más los de rangos inferiores (role_id 3 y 4).
 * - Líder de Área (3): Ve sus propios turnos más los de los Empleados (role_id: 4).
 * - Empleado (4): Ve únicamente sus propios turnos.
 */
export const getShifts = async (req, res) => {
  const parseParam = (val) => (Array.isArray(val) ? val[0] : val);
  const rawStartDate = parseParam(req.query?.startDate);
  const rawEndDate = parseParam(req.query?.endDate);
  const rawUserId = parseParam(req.query?.userId);
  const rawDepartment = parseParam(req.query?.department);

  const user = req.user;
  const userRole = Number(user?.role_id);

  const defaults = getDefaultWeekRange();
  const isValidDate = (d) => typeof d === "string" && !isNaN(Date.parse(d));
  const effectiveStartDate = isValidDate(rawStartDate)
    ? String(rawStartDate).trim().slice(0, 10)
    : defaults.startDate;
  const effectiveEndDate = isValidDate(rawEndDate)
    ? String(rawEndDate).trim().slice(0, 10)
    : defaults.endDate;

  try {
    const conditions = ["s.shift_date >= $1::date", "s.shift_date <= $2::date"];
    const values = [effectiveStartDate, effectiveEndDate];
    let paramIndex = 3;

    // Reglas de visibilidad jerárquica estricta
    if (userRole === 1) {
      // Admin (1): Ve los turnos de todos los colaboradores activos
    } else if (userRole === 2) {
      // RRHH (2): Ve sus propios turnos más los de rangos inferiores (3 y 4)
      conditions.push(`(s.user_id = $${paramIndex} OR u.role_id IN (3, 4))`);
      values.push(user.id);
      paramIndex++;
    } else if (userRole === 3) {
      // Líder de Área (3): Ve sus propios turnos más los de los Empleados (4)
      conditions.push(`(s.user_id = $${paramIndex} OR u.role_id = 4)`);
      values.push(user.id);
      paramIndex++;
    } else {
      // Empleado (4) o cualquier otro rol: estrictamente sus propios turnos
      conditions.push(`s.user_id = $${paramIndex}`);
      values.push(user.id);
      paramIndex++;
    }

    // Filtros opcionales
    if (rawUserId && String(rawUserId).trim()) {
      conditions.push(`s.user_id = $${paramIndex++}`);
      values.push(String(rawUserId).trim());
    }
    if (rawDepartment && String(rawDepartment).trim()) {
      conditions.push(`u.department = $${paramIndex++}`);
      values.push(String(rawDepartment).trim());
    }

    const sqlQuery = `
      SELECT 
        s.id,
        s.user_id,
        TO_CHAR(s.shift_date, 'YYYY-MM-DD') AS shift_date,
        s.shift_type,
        TO_CHAR(s.start_time, 'HH24:MI') AS start_time,
        TO_CHAR(s.end_time, 'HH24:MI') AS end_time,
        s.location,
        s.notes,
        s.assigned_by,
        s.created_at,
        s.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.document_number,
        u.file_number,
        u.department,
        a.first_name AS assigner_first_name,
        a.last_name AS assigner_last_name
      FROM work_shifts s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN users a ON s.assigned_by = a.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.shift_date ASC, u.last_name ASC, s.start_time ASC;
    `;

    const result = await query(sqlQuery, values);

    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        shifts: result.rows,
      },
      shifts: result.rows,
    });
  } catch (error) {
    console.error("❌ Error al obtener grilla de turnos:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener los turnos de trabajo.",
    });
  }
};

/**
 * Eliminar una asignación de turno puntual por su ID.
 * Matriz Jerárquica Estricta:
 * - Admin (1): Puede eliminar cualquier turno (propio o ajeno).
 * - RRHH (2): No puede eliminar propio (403), no puede eliminar rangos <= 2 (403). Solo rangos 3 y 4.
 * - Líder (3): No puede eliminar propio (403), no puede eliminar rangos <= 3 (403). Solo rol 4 (y no licencias/feriados).
 */
export const deleteShift = async (req, res) => {
  const userRole = Number(req.user?.role_id);
  if (![1, 2, 3].includes(userRole)) {
    return res.status(403).json({
      status: "error",
      message: "No tienes permisos para eliminar turnos de trabajo.",
    });
  }

  const { id } = req.params;

  try {
    const shiftCheck = await query(
      `SELECT s.id, s.user_id, TO_CHAR(s.shift_date, 'YYYY-MM-DD') AS shift_date, s.shift_type,
              u.role_id AS target_role_id
       FROM work_shifts s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (shiftCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "El turno especificado no existe.",
      });
    }

    const shift = shiftCheck.rows[0];
    const targetRoleId = Number(shift.target_role_id);
    const isSelf = String(shift.user_id) === String(req.user.id);

    // Jerarquía de seguridad RBAC
    if (userRole === 2) {
      if (isSelf) {
        return res.status(403).json({
          status: "error",
          message: "Los usuarios de Recursos Humanos no pueden eliminar su propio horario.",
        });
      }
      if (targetRoleId <= 2) {
        return res.status(403).json({
          status: "error",
          message: "No tienes permisos para eliminar turnos de colaboradores de rango igual o superior.",
        });
      }
    } else if (userRole === 3) {
      if (isSelf) {
        return res.status(403).json({
          status: "error",
          message: "Los Líderes de Área no pueden eliminar su propio horario.",
        });
      }
      if (targetRoleId <= 3) {
        return res.status(403).json({
          status: "error",
          message: "Los Líderes de Área solo pueden eliminar turnos de colaboradores con rol Empleado.",
        });
      }
      if (["licencia", "feriado"].includes(shift.shift_type)) {
        return res.status(403).json({
          status: "error",
          message: "Los Líderes de Área no pueden eliminar turnos de tipo licencia o feriado.",
        });
      }
    }

    await query("DELETE FROM work_shifts WHERE id = $1", [id]);

    // Registrar en logs de auditoría
    await logAuditFromRequest(req, {
      action: "WORK_SHIFT_DELETED",
      entityType: "work_shifts",
      entityId: String(shift.id),
      oldValues: {
        user_id: shift.user_id,
        shift_date: shift.shift_date,
        shift_type: shift.shift_type,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Turno eliminado correctamente.",
    });
  } catch (error) {
    console.error("❌ Error al eliminar turno:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al eliminar el turno.",
    });
  }
};
