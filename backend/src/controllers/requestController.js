import { query } from "../config/db.js";
import { logAuditEvent } from "../services/auditService.js";

const VALID_REQUEST_TYPES = [
  "indumentaria",
  "licencia",
  "materiales",
  "herramientas",
  "otro",
];

const VALID_RESOLVE_STATUSES = ["approved", "rejected"];

/**
 * Crear una nueva solicitud operativa.
 * Cualquier colaborador autenticado puede crear una solicitud.
 */
export const createRequest = async (req, res) => {
  const { type, title, description } = req.body;
  const userId = req.user.id;

  if (!type || !title || !description) {
    return res.status(400).json({
      status: "error",
      message: "Faltan campos requeridos: type, title y description son obligatorios.",
    });
  }

  const normalizedType = String(type).trim().toLowerCase();
  if (!VALID_REQUEST_TYPES.includes(normalizedType)) {
    return res.status(400).json({
      status: "error",
      message: `El tipo de solicitud es inválido. Valores permitidos: ${VALID_REQUEST_TYPES.join(", ")}.`,
    });
  }

  const trimmedTitle = String(title).trim();
  if (trimmedTitle.length === 0 || trimmedTitle.length > 150) {
    return res.status(400).json({
      status: "error",
      message: "El título es obligatorio y no puede superar los 150 caracteres.",
    });
  }

  const trimmedDescription = String(description).trim();
  if (trimmedDescription.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "La descripción de la solicitud no puede estar vacía.",
    });
  }

  try {
    const result = await query(
      `INSERT INTO requests (user_id, type, title, description, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, user_id, type, title, description, status, resolution_notes, resolved_by, created_at, updated_at;`,
      [userId, normalizedType, trimmedTitle, trimmedDescription]
    );

    const newRequest = result.rows[0];

    // Registrar evento de auditoría
    const ipAddress = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId,
      action: "REQUEST_CREATED",
      entityType: "requests",
      entityId: String(newRequest.id),
      newValues: {
        type: newRequest.type,
        title: newRequest.title,
        status: newRequest.status,
      },
      ipAddress,
    });

    return res.status(201).json({
      status: "success",
      message: "Solicitud creada correctamente.",
      data: {
        request: newRequest,
      },
      request: newRequest,
    });
  } catch (error) {
    console.error("❌ Error al crear solicitud:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al procesar la solicitud.",
      error: error.message,
    });
  }
};

/**
 * Obtener exclusivamente las solicitudes del usuario autenticado en sesión.
 */
export const getMyRequests = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query(
      `SELECT 
         r.id,
         r.user_id,
         r.type,
         r.title,
         r.description,
         r.status,
         r.resolution_notes,
         r.resolved_by,
         r.created_at,
         r.updated_at,
         u.first_name,
         u.last_name,
         u.email,
         u.file_number,
         u.department,
         res.first_name AS resolver_first_name,
         res.last_name AS resolver_last_name
       FROM requests r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN users res ON r.resolved_by = res.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        requests: result.rows,
      },
      requests: result.rows,
    });
  } catch (error) {
    console.error("❌ Error al obtener mis solicitudes:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener tus solicitudes.",
      error: error.message,
    });
  }
};

/**
 * Obtener todas las solicitudes registradas (Solo Admin y RRHH).
 * Admite filtros opcionales por type, status o búsqueda por texto.
 */
export const getAllRequests = async (req, res) => {
  const { status, type, search } = req.query;

  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status && status.trim()) {
      conditions.push(`r.status = $${paramIndex++}`);
      values.push(status.trim().toLowerCase());
    }

    if (type && type.trim()) {
      conditions.push(`r.type = $${paramIndex++}`);
      values.push(type.trim().toLowerCase());
    }

    if (search && search.trim()) {
      conditions.push(
        `(r.title ILIKE $${paramIndex} OR r.description ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.file_number ILIKE $${paramIndex})`
      );
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        r.id,
        r.user_id,
        r.type,
        r.title,
        r.description,
        r.status,
        r.resolution_notes,
        r.resolved_by,
        r.created_at,
        r.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.file_number,
        u.department,
        res.first_name AS resolver_first_name,
        res.last_name AS resolver_last_name
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users res ON r.resolved_by = res.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `;

    const result = await query(sql, values);

    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        requests: result.rows,
      },
      requests: result.rows,
    });
  } catch (error) {
    console.error("❌ Error al obtener todas las solicitudes:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener el listado de solicitudes.",
      error: error.message,
    });
  }
};

/**
 * Resolver/Actualizar el estado de una solicitud (approved / rejected).
 * Solo Administradores y RRHH. Inmutable una vez resuelta.
 */
export const updateRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status, resolution_notes, notes } = req.body;
  const resolvedById = req.user.id;

  if (!status || !VALID_RESOLVE_STATUSES.includes(String(status).trim().toLowerCase())) {
    return res.status(400).json({
      status: "error",
      message: `El estado es inválido. Debe ser uno de los siguientes: ${VALID_RESOLVE_STATUSES.join(", ")}.`,
    });
  }

  const normalizedStatus = String(status).trim().toLowerCase();
  const rawNotes = resolution_notes !== undefined ? resolution_notes : notes;
  const trimmedNotes = rawNotes ? String(rawNotes).trim() : null;

  if (trimmedNotes && trimmedNotes.length > 500) {
    return res.status(400).json({
      status: "error",
      message: "Las notas de resolución no pueden superar los 500 caracteres.",
    });
  }

  try {
    const existingResult = await query(
      "SELECT id, user_id, title, status FROM requests WHERE id = $1",
      [id]
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Solicitud no encontrada.",
      });
    }

    const currentRequest = existingResult.rows[0];

    // Inmutabilidad: si ya está resuelta (approved o rejected), no se puede modificar
    if (currentRequest.status === "approved" || currentRequest.status === "rejected") {
      return res.status(403).json({
        status: "error",
        message: "La solicitud ya ha sido resuelta y no puede ser modificada.",
      });
    }

    const updateResult = await query(
      `UPDATE requests
       SET status = $1,
           resolution_notes = $2,
           resolved_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, user_id, type, title, description, status, resolution_notes, resolved_by, created_at, updated_at;`,
      [normalizedStatus, trimmedNotes, resolvedById, id]
    );

    const updatedRequest = updateResult.rows[0];

    // Enviar notificación al solicitante
    try {
      const notifTitle = "Actualización de Solicitud";
      const notifMessage = `Tu solicitud "${currentRequest.title}" ha sido ${
        normalizedStatus === "approved" ? "aprobada" : "rechazada"
      }.`;
      await query(
        `INSERT INTO notifications (title, message, type, user_id)
         VALUES ($1, $2, 'request_update', $3)`,
        [notifTitle, notifMessage, currentRequest.user_id]
      );
    } catch (notifErr) {
      console.warn("⚠️ No se pudo registrar la notificación de solicitud:", notifErr.message);
    }

    // Registrar evento de auditoría
    const ipAddress = req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId: resolvedById,
      action: "REQUEST_RESOLVED",
      entityType: "requests",
      entityId: String(id),
      oldValues: {
        status: currentRequest.status,
      },
      newValues: {
        status: normalizedStatus,
        resolution_notes: trimmedNotes,
      },
      ipAddress,
    });

    return res.status(200).json({
      status: "success",
      message: `Solicitud ${normalizedStatus === "approved" ? "aprobada" : "rechazada"} correctamente.`,
      data: {
        request: updatedRequest,
      },
      request: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Error al actualizar estado de la solicitud:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al actualizar la solicitud.",
      error: error.message,
    });
  }
};
