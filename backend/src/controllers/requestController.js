import fs from "fs";
import path from "path";
import { query } from "../config/db.js";
import { logAuditFromRequest } from "../services/auditService.js";
import { REQUESTS_UPLOAD_DIR } from "../middlewares/uploadMiddleware.js";

const VALID_REQUEST_TYPES = [
  "indumentaria",
  "licencia",
  "materiales",
  "herramientas",
  "otro",
];

const VALID_RESOLVE_STATUSES = ["approved", "rejected"];

/**
 * Elimina un archivo temporal de forma segura si la validación falla
 */
const cleanupUploadedFile = (file) => {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      console.warn("⚠️ No se pudo eliminar el archivo temporal:", err.message);
    }
  }
};

/**
 * Crear una nueva solicitud operativa con soporte para archivo adjunto opcional.
 * Cualquier colaborador autenticado puede crear una solicitud.
 */
export const createRequest = async (req, res) => {
  const { type, title, description } = req.body;
  const userId = req.user.id;
  const attachedFile = req.file;

  if (!type || !title || !description) {
    cleanupUploadedFile(attachedFile);
    return res.status(400).json({
      status: "error",
      message: "Faltan campos requeridos: type, title y description son obligatorios.",
    });
  }

  const normalizedType = String(type).trim().toLowerCase();
  if (!VALID_REQUEST_TYPES.includes(normalizedType)) {
    cleanupUploadedFile(attachedFile);
    return res.status(400).json({
      status: "error",
      message: `El tipo de solicitud es inválido. Valores permitidos: ${VALID_REQUEST_TYPES.join(", ")}.`,
    });
  }

  const trimmedTitle = String(title).trim();
  if (trimmedTitle.length === 0 || trimmedTitle.length > 150) {
    cleanupUploadedFile(attachedFile);
    return res.status(400).json({
      status: "error",
      message: "El título es obligatorio y no puede superar los 150 caracteres.",
    });
  }

  const trimmedDescription = String(description).trim();
  if (trimmedDescription.length === 0) {
    cleanupUploadedFile(attachedFile);
    return res.status(400).json({
      status: "error",
      message: "La descripción de la solicitud no puede estar vacía.",
    });
  }

  const attachmentName = attachedFile ? attachedFile.originalname : null;
  const attachmentPath = attachedFile ? attachedFile.filename : null;
  const attachmentMime = attachedFile ? attachedFile.mimetype : null;

  try {
    const result = await query(
      `INSERT INTO requests (user_id, type, title, description, status, attachment_name, attachment_path, attachment_mime)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
       RETURNING id, user_id, type, title, description, status, resolution_notes, resolved_by, attachment_name, attachment_mime, created_at, updated_at;`,
      [
        userId,
        normalizedType,
        trimmedTitle,
        trimmedDescription,
        attachmentName,
        attachmentPath,
        attachmentMime,
      ]
    );

    const newRequest = result.rows[0];

    // Registrar evento de auditoría
    await logAuditFromRequest(req, {
      action: "REQUEST_CREATED",
      entityType: "requests",
      entityId: String(newRequest.id),
      newValues: {
        type: newRequest.type,
        title: newRequest.title,
        status: newRequest.status,
        hasAttachment: Boolean(newRequest.attachment_name),
      },
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
    cleanupUploadedFile(attachedFile);
    console.error("❌ Error al crear solicitud:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al procesar la solicitud.",
    });
  }
};

/**
 * Obtener exclusivamente las solicitudes del usuario autenticado en sesión.
 * Excluye attachment_path por seguridad interna.
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
         r.attachment_name,
         r.attachment_mime,
         (r.attachment_name IS NOT NULL) AS has_attachment,
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
    });
  }
};

/**
 * Obtener todas las solicitudes registradas (Solo Admin y RRHH).
 * Admite filtros opcionales por type, status o búsqueda por texto.
 * Excluye attachment_path por seguridad interna.
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
        r.attachment_name,
        r.attachment_mime,
        (r.attachment_name IS NOT NULL) AS has_attachment,
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
    });
  }
};

/**
 * Descarga o visualización protegida del archivo adjunto de una solicitud.
 * Regla de privacidad (RBAC): Solo el creador, Administrador (1) o Recursos Humanos (2).
 */
export const downloadRequestAttachment = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const result = await query(
      `SELECT id, user_id, title, attachment_name, attachment_path, attachment_mime 
       FROM requests 
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Solicitud no encontrada.",
      });
    }

    const requestItem = result.rows[0];

    if (!requestItem.attachment_name || !requestItem.attachment_path) {
      return res.status(404).json({
        status: "error",
        message: "La solicitud no cuenta con ningún archivo adjunto.",
      });
    }

    // Regla de privacidad (RBAC): dueño de la solicitud, Administrador (1) o Recursos Humanos (2)
    const isOwner = String(requestItem.user_id) === String(user.id);
    const isAdmin = Number(user.role_id) === 1;
    const isHR = Number(user.role_id) === 2;

    if (!isOwner && !isAdmin && !isHR) {
      return res.status(403).json({
        status: "error",
        message: "No tienes permisos para acceder al archivo adjunto de esta solicitud.",
      });
    }

    const fullFilePath = path.isAbsolute(requestItem.attachment_path)
      ? requestItem.attachment_path
      : path.resolve(REQUESTS_UPLOAD_DIR, requestItem.attachment_path);

    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({
        status: "error",
        message: "El archivo adjunto no se encuentra disponible en el servidor.",
      });
    }

    // Enviar archivo con cabeceras seguras
    const mimeType = requestItem.attachment_mime || "application/octet-stream";
    const encodedFileName = encodeURIComponent(requestItem.attachment_name);

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${requestItem.attachment_name}"; filename*=UTF-8''${encodedFileName}`
    );

    return res.sendFile(fullFilePath);
  } catch (error) {
    console.error("❌ Error al descargar archivo adjunto:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al procesar la descarga del archivo adjunto.",
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
        message: "La solicitud que intentas actualizar no existe.",
      });
    }

    const currentRequest = existingResult.rows[0];

    // Inmutabilidad
    if (currentRequest.status === "approved" || currentRequest.status === "rejected") {
      return res.status(403).json({
        status: "error",
        message: `Esta solicitud ya fue ${
          currentRequest.status === "approved" ? "aprobada" : "rechazada"
        } y no puede modificarse nuevamente.`,
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

    // Registrar en audit_logs
    await logAuditFromRequest(req, {
      action: "REQUEST_STATUS_UPDATED",
      entityType: "requests",
      entityId: String(updatedRequest.id),
      oldValues: {
        status: currentRequest.status,
      },
      newValues: {
        status: updatedRequest.status,
        resolution_notes: updatedRequest.resolution_notes,
      },
    });

    // Enviar notificación automática al colaborador solicitante
    try {
      const statusLabel = normalizedStatus === "approved" ? "aprobada" : "rechazada";
      const notifMessage = trimmedNotes
        ? `Tu solicitud "${currentRequest.title}" ha sido ${statusLabel}. Dictamen: ${trimmedNotes}`
        : `Tu solicitud "${currentRequest.title}" ha sido ${statusLabel} por el área de Recursos Humanos.`;

      await query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'request_update');`,
        [currentRequest.user_id, `Solicitud ${statusLabel}`, notifMessage]
      );
    } catch (notifErr) {
      console.warn("⚠️ No se pudo registrar la notificación automática de solicitud:", notifErr.message);
    }

    return res.status(200).json({
      status: "success",
      message: `Solicitud ${normalizedStatus === "approved" ? "aprobada" : "rechazada"} correctamente.`,
      data: {
        request: updatedRequest,
      },
      request: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Error al actualizar estado de solicitud:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al actualizar la solicitud.",
    });
  }
};
