import { query } from "../config/db.js";
import { logAuditFromRequest } from "../services/auditService.js";

/**
 * Obtiene las notificaciones del usuario en sesión, incluyendo datos del remitente si existen.
 */
export const getMyNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query(
      `SELECT 
        n.id, 
        n.title, 
        n.message, 
        n.type, 
        n.is_read, 
        n.created_at, 
        n.sender_id,
        c.title AS claim_title,
        sender.first_name AS sender_first_name,
        sender.last_name AS sender_last_name,
        sender.email AS sender_email,
        CASE 
          WHEN sender.id IS NOT NULL THEN CONCAT(sender.first_name, ' ', sender.last_name)
          ELSE NULL 
        END AS sender_name
      FROM notifications n
      LEFT JOIN claims c ON n.related_claim_id = c.id
      LEFT JOIN users sender ON n.sender_id = sender.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        notifications: result.rows,
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener notificaciones:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener las notificaciones.",
    });
  }
};

/**
 * Marca una notificación específica como leída.
 */
export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id, title, is_read`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Notificación no encontrada o no pertenece al usuario.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Notificación marcada como leída.",
      data: {
        notification: result.rows[0],
      },
    });
  } catch (error) {
    console.error("❌ Error al marcar notificación como leída:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al marcar la notificación como leída.",
    });
  }
};

/**
 * Marca todas las notificaciones pendientes del usuario como leídas.
 */
export const markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE RETURNING id`,
      [userId]
    );

    return res.status(200).json({
      status: "success",
      message: "Todas las notificaciones fueron marcadas como leídas.",
      data: {
        updatedCount: result.rowCount,
      },
    });
  } catch (error) {
    console.error("❌ Error al marcar todas las notificaciones como leídas:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al marcar las notificaciones como leídas.",
    });
  }
};

/**
 * Emite un comunicado institucional o mensaje a colaboradores activos (Admin / RRHH).
 */
export const sendAnnouncement = async (req, res) => {
  // Validación defensiva estricta de rol: exclusivo Administrador (1) y Recursos Humanos (2)
  const allowedRoles = [1, 2];
  const userRoleId = Number(req.user?.role_id);

  if (!userRoleId || !allowedRoles.includes(userRoleId)) {
    return res.status(403).json({
      status: "error",
      message: "No tienes permisos para emitir comunicados o notificaciones.",
    });
  }

  const { targetType, targetId, title, message, type } = req.body;

  // 1. Validaciones básicas de presencia y longitud
  if (!title || !message || !targetType) {
    return res.status(400).json({
      status: "error",
      message: "Faltan campos requeridos: 'title', 'message' y 'targetType' son obligatorios.",
    });
  }

  const trimmedTitle = String(title).trim();
  const trimmedMessage = String(message).trim();

  if (!trimmedTitle || !trimmedMessage) {
    return res.status(400).json({
      status: "error",
      message: "El título y el mensaje no pueden estar vacíos.",
    });
  }

  if (trimmedTitle.length > 150) {
    return res.status(400).json({
      status: "error",
      message: "El título no puede superar los 150 caracteres.",
    });
  }

  if (trimmedMessage.length > 1000) {
    return res.status(400).json({
      status: "error",
      message: "El mensaje no puede superar los 1000 caracteres.",
    });
  }

  const validTargetTypes = ["all", "department", "user"];
  if (!validTargetTypes.includes(targetType)) {
    return res.status(400).json({
      status: "error",
      message: "El tipo de destino ('targetType') debe ser 'all', 'department' o 'user'.",
    });
  }

  if ((targetType === "department" || targetType === "user") && (!targetId || !String(targetId).trim())) {
    return res.status(400).json({
      status: "error",
      message: `Debes especificar un 'targetId' válido para el destino '${targetType}'.`,
    });
  }

  const notificationType = type && String(type).trim()
    ? String(type).trim()
    : targetType === "user"
      ? "direct_message"
      : "announcement";

  try {
    // 2. Obtener lista de destinatarios activos
    let recipientsResult;
    if (targetType === "all") {
      recipientsResult = await query(
        `SELECT id FROM users WHERE is_active = true`
      );
    } else if (targetType === "department") {
      recipientsResult = await query(
        `SELECT id FROM users WHERE is_active = true AND department ILIKE $1`,
        [String(targetId).trim()]
      );
    } else if (targetType === "user") {
      recipientsResult = await query(
        `SELECT id FROM users WHERE is_active = true AND id = $1`,
        [String(targetId).trim()]
      );
    }

    if (!recipientsResult || recipientsResult.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message:
          targetType === "user"
            ? "El colaborador destinatario no existe o no se encuentra activo."
            : "No se encontraron colaboradores activos para el destino especificado.",
      });
    }

    const recipientIds = recipientsResult.rows.map((r) => r.id);

    // 3. Inserción masiva de notificaciones con sender_id e is_read = false
    const valueClauses = [];
    const queryParams = [trimmedTitle, trimmedMessage, notificationType, req.user.id];

    recipientIds.forEach((id, idx) => {
      valueClauses.push(`($1, $2, $3, $${idx + 5}, $4, false)`);
      queryParams.push(id);
    });

    await query(
      `INSERT INTO notifications (title, message, type, user_id, sender_id, is_read)
       VALUES ${valueClauses.join(", ")}`,
      queryParams
    );

    // 4. Registro de auditoría
    await logAuditFromRequest(req, {
      action: "ANNOUNCEMENT_SENT",
      entityType: "NOTIFICATION",
      entityId: req.user.id,
      newValues: {
        targetType,
        targetId: targetId ? String(targetId).trim() : null,
        title: trimmedTitle,
        recipientsCount: recipientIds.length,
        type: notificationType,
      },
    });

    // 5. Respuesta HTTP 201
    return res.status(201).json({
      status: "success",
      message: `Comunicado emitido exitosamente a ${recipientIds.length} colaborador${
        recipientIds.length === 1 ? "" : "es"
      }.`,
      data: {
        recipientsCount: recipientIds.length,
        targetType,
        title: trimmedTitle,
        type: notificationType,
      },
    });
  } catch (error) {
    console.error("❌ Error al emitir comunicado:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al emitir el comunicado.",
    });
  }
};
