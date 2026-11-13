import { query } from "../config/db.js";
import { logAuditFromRequest } from "../services/auditService.js";

export const VALID_DISCIPLINARY_TYPES = [
  "llamado_atencion",
  "apercibimiento",
  "suspension",
  "otro",
];

export const VALID_SEVERITIES = ["leve", "moderada", "grave"];

const TYPE_LABELS = {
  llamado_atencion: "Llamado de atención",
  apercibimiento: "Apercibimiento",
  suspension: "Suspensión",
  otro: "Novedad disciplinaria",
};

/**
 * Registra una nueva acción o sanción disciplinaria sobre un colaborador.
 * Exclusivo para Administrador (1) y Recursos Humanos (2).
 */
export const createDisciplinaryAction = async (req, res) => {
  const userRole = Number(req.user?.role_id);
  if (userRole !== 1 && userRole !== 2) {
    return res.status(403).json({
      status: "error",
      message: "No tienes permisos para registrar sanciones o novedades disciplinarias.",
    });
  }

  const {
    user_id,
    type,
    severity = "leve",
    incident_date,
    reason,
    description,
    suspension_days = 0,
  } = req.body;

  if (!user_id || !type || !incident_date || !reason || !description) {
    return res.status(400).json({
      status: "error",
      message:
        "Faltan campos obligatorios: user_id, type, incident_date, reason y description son requeridos.",
    });
  }

  const normalizedType = String(type).trim().toLowerCase();
  if (!VALID_DISCIPLINARY_TYPES.includes(normalizedType)) {
    return res.status(400).json({
      status: "error",
      message: `El tipo de medida disciplinaria es inválido. Valores permitidos: ${VALID_DISCIPLINARY_TYPES.join(
        ", "
      )}.`,
    });
  }

  const normalizedSeverity = String(severity || "leve")
    .trim()
    .toLowerCase();
  if (!VALID_SEVERITIES.includes(normalizedSeverity)) {
    return res.status(400).json({
      status: "error",
      message: `La severidad es inválida. Valores permitidos: ${VALID_SEVERITIES.join(
        ", "
      )}.`,
    });
  }

  if (isNaN(Date.parse(incident_date))) {
    return res.status(400).json({
      status: "error",
      message: "La fecha del incidente no es válida.",
    });
  }

  const trimmedReason = String(reason).trim();
  if (trimmedReason.length === 0 || trimmedReason.length > 200) {
    return res.status(400).json({
      status: "error",
      message: "El motivo es obligatorio y no puede superar los 200 caracteres.",
    });
  }

  const trimmedDescription = String(description).trim();
  if (trimmedDescription.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "La descripción detallada del incidente es obligatoria.",
    });
  }

  let finalSuspensionDays = 0;
  if (normalizedType === "suspension") {
    finalSuspensionDays = parseInt(suspension_days, 10);
    if (isNaN(finalSuspensionDays) || finalSuspensionDays <= 0) {
      return res.status(400).json({
        status: "error",
        message:
          "Para sanciones de tipo suspensión, los días de suspensión deben ser mayores a 0.",
      });
    }
  }

  try {
    // No permitir auto-sanción
    if (String(req.user.id) === String(user_id)) {
      return res.status(400).json({
        status: "error",
        message: "Operación inválida. No puedes registrar una sanción o amonestación sobre ti mismo.",
      });
    }

    // Verificar que el empleado destinatario exista y esté activo, con su rol y nivel
    const targetUserResult = await query(
      `SELECT u.id, u.first_name, u.last_name, u.role_id, u.is_active, r.name AS role_name, r.level AS role_level
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [user_id]
    );

    if (targetUserResult.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "El colaborador especificado no existe en la base de datos.",
      });
    }

    const targetUser = targetUserResult.rows[0];
    if (!targetUser.is_active) {
      return res.status(400).json({
        status: "error",
        message:
          "No es posible registrar medidas disciplinarias sobre un colaborador inactivo o dado de baja.",
      });
    }

    // Obtener nivel jerárquico del emisor
    const issuerRoleResult = await query(
      "SELECT id, name, level FROM roles WHERE id = $1",
      [req.user.role_id]
    );
    const issuerRole = issuerRoleResult.rows[0];
    const issuerLevel = Number(issuerRole?.level ?? req.user.role_id);
    const targetLevel = Number(targetUser.role_level ?? targetUser.role_id);

    // Jerarquía estricta: el emisor debe ser de MAYOR RANGO (menor número de nivel jerárquico)
    if (issuerLevel >= targetLevel) {
      return res.status(403).json({
        status: "error",
        message: `Jerarquía insuficiente. No puedes sancionar a un colaborador de igual o mayor rango (${targetUser.role_name}). Las medidas disciplinarias deben ser aplicadas por un superior de mayor jerarquía.`,
      });
    }

    const insertResult = await query(
      `INSERT INTO disciplinary_actions (
        user_id,
        issued_by,
        type,
        severity,
        incident_date,
        reason,
        description,
        suspension_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, issued_by, type, severity, incident_date, reason, description, suspension_days, created_at;`,
      [
        user_id,
        req.user.id,
        normalizedType,
        normalizedSeverity,
        incident_date,
        trimmedReason,
        trimmedDescription,
        finalSuspensionDays,
      ]
    );

    const createdAction = insertResult.rows[0];

    // Registrar en logs de auditoría
    await logAuditFromRequest(req, {
      action: "DISCIPLINARY_ACTION_CREATED",
      entityType: "disciplinary_actions",
      entityId: String(createdAction.id),
      newValues: {
        user_id: createdAction.user_id,
        type: createdAction.type,
        severity: createdAction.severity,
        incident_date: createdAction.incident_date,
        suspension_days: createdAction.suspension_days,
        reason: createdAction.reason,
      },
    });

    // Enviar notificación automática directa al colaborador sancionado
    try {
      const typeLabel = TYPE_LABELS[normalizedType] || "Medida disciplinaria";
      const extraNotice =
        normalizedType === "suspension"
          ? ` (${finalSuspensionDays} días de suspensión)`
          : "";
      const notifMessage = `Se ha incorporado una constancia a tu legajo digital: ${typeLabel}${extraNotice}. Motivo: ${trimmedReason}.`;

      await query(
        `INSERT INTO notifications (user_id, sender_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5);`,
        [user_id, req.user.id, "Registro en Legajo Digital", notifMessage, "direct_message"]
      );
    } catch (notifErr) {
      console.warn(
        "⚠️ No se pudo registrar la notificación automática de sanción:",
        notifErr.message
      );
    }

    return res.status(201).json({
      status: "success",
      message: "Medida disciplinaria registrada exitosamente.",
      data: {
        disciplinary_action: createdAction,
      },
      disciplinary_action: createdAction,
    });
  } catch (error) {
    console.error("❌ Error al registrar acción disciplinaria:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al registrar la medida disciplinaria.",
    });
  }
};

/**
 * Consulta el historial disciplinario de un colaborador específico.
 * Confidencialidad estricta (RBAC): Solo el propio colaborador, Administrador (1) o Recursos Humanos (2).
 */
export const getEmployeeDisciplinaryActions = async (req, res) => {
  const { userId } = req.params;
  const user = req.user;

  const isOwner = String(user.id) === String(userId);
  const isAdmin = Number(user.role_id) === 1;
  const isHR = Number(user.role_id) === 2;

  if (!isOwner && !isAdmin && !isHR) {
    return res.status(403).json({
      status: "error",
      message:
        "Acceso denegado. No tienes permisos para consultar el legajo disciplinario de este colaborador.",
    });
  }

  try {
    const result = await query(
      `SELECT 
        d.id,
        d.user_id,
        d.issued_by,
        d.type,
        d.severity,
        d.incident_date,
        d.reason,
        d.description,
        d.suspension_days,
        d.created_at,
        u.first_name AS employee_first_name,
        u.last_name AS employee_last_name,
        u.email AS employee_email,
        u.document_number AS employee_document_number,
        u.file_number AS employee_file_number,
        u.department AS employee_department,
        issuer.first_name AS issuer_first_name,
        issuer.last_name AS issuer_last_name,
        issuer.email AS issuer_email,
        r.name AS issuer_role_name
      FROM disciplinary_actions d
      JOIN users u ON d.user_id = u.id
      JOIN users issuer ON d.issued_by = issuer.id
      LEFT JOIN roles r ON issuer.role_id = r.id
      WHERE d.user_id = $1
      ORDER BY d.incident_date DESC, d.created_at DESC;`,
      [userId]
    );

    const employeeResult = await query(
      `SELECT id, first_name, last_name, email, department, file_number, document_number, phone, hire_date
       FROM users WHERE id = $1`,
      [userId]
    );
    const employee = employeeResult.rows[0] || null;

    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        employee,
        disciplinary_actions: result.rows,
      },
      employee,
      disciplinary_actions: result.rows,
    });
  } catch (error) {
    console.error(
      "❌ Error al consultar historial disciplinario:",
      error.message
    );
    return res.status(500).json({
      status: "error",
      message: "Error interno al consultar el historial disciplinario.",
    });
  }
};

/**
 * Consulta el historial disciplinario del colaborador autenticado en sesión.
 * Accesible para cualquier colaborador autenticado.
 */
export const getMyDisciplinaryActions = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query(
      `SELECT 
        d.id,
        d.user_id,
        d.issued_by,
        d.type,
        d.severity,
        d.incident_date,
        d.reason,
        d.description,
        d.suspension_days,
        d.created_at,
        u.first_name AS employee_first_name,
        u.last_name AS employee_last_name,
        u.email AS employee_email,
        u.document_number AS employee_document_number,
        u.file_number AS employee_file_number,
        u.department AS employee_department,
        issuer.first_name AS issuer_first_name,
        issuer.last_name AS issuer_last_name,
        issuer.email AS issuer_email,
        r.name AS issuer_role_name
      FROM disciplinary_actions d
      JOIN users u ON d.user_id = u.id
      JOIN users issuer ON d.issued_by = issuer.id
      LEFT JOIN roles r ON issuer.role_id = r.id
      WHERE d.user_id = $1
      ORDER BY d.incident_date DESC, d.created_at DESC;`,
      [userId]
    );

    const employeeResult = await query(
      `SELECT id, first_name, last_name, email, department, file_number, document_number, phone, hire_date
       FROM users WHERE id = $1`,
      [userId]
    );
    const employee = employeeResult.rows[0] || null;

    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        employee,
        disciplinary_actions: result.rows,
      },
      employee,
      disciplinary_actions: result.rows,
    });
  } catch (error) {
    console.error(
      "❌ Error al consultar legajo propio:",
      error.message
    );
    return res.status(500).json({
      status: "error",
      message: "Error interno al consultar tu legajo digital.",
    });
  }
};
