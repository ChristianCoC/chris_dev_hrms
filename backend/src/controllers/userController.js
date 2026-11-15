import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { query } from "../config/db.js";
import { logAuditFromRequest } from "../services/auditService.js";
import { sendInvitationEmail, sendResendInvitationEmail } from "../services/emailService.js";
import { sanitizeString } from "../utils/requestUtils.js";

/**
 * Obtener todos los usuarios registrados en el sistema.
 */
export const getAllUsers = async (req, res) => {
  try {
    const result = await query(
      "SELECT id, email, first_name, last_name, role_id, created_at, updated_at FROM users",
    );
    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        users: result.rows,
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener usuarios:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener la lista de usuarios.",
    });
  }
};

/**
 * Eliminar un usuario por ID (exclusivo Administrador).
 * No permite que el administrador se elimine a sí mismo.
 */
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (req.user.id === id) {
    return res.status(400).json({
      status: "error",
      message: "Operación denegada. No puedes eliminar tu propio usuario.",
    });
  }

  try {
    const userCheck = await query("SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1", [id]);

    if (userCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    const deletedUserData = userCheck.rows[0];

    await query("DELETE FROM users WHERE id = $1", [id]);

    // Registrar evento de auditoría
    await logAuditFromRequest(req, {
      action: "USER_DELETED",
      entityType: "users",
      entityId: id,
      oldValues: {
        email: deletedUserData.email,
        first_name: deletedUserData.first_name,
        last_name: deletedUserData.last_name,
        role_id: deletedUserData.role_id,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Usuario eliminado correctamente del sistema.",
    });
  } catch (error) {
    console.error("❌ Error al eliminar usuario:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al eliminar el usuario.",
    });
  }
};

/**
 * Actualizar datos de usuario (nombre, apellido, rol).
 */
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, role_id } = req.body;
  const requesterRoleId = Number(req.user?.role_id);
  const isUpdatingSelf = String(req.user?.id) === String(id);
  const isAuthorizedManager = [1, 2].includes(requesterRoleId);

  if (!isUpdatingSelf && !isAuthorizedManager) {
    return res.status(403).json({
      status: "error",
      message: "Acceso denegado. No tiene los permisos necesarios para actualizar este usuario.",
    });
  }

  try {
    const targetUserCheck = await query(
      "SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1",
      [id]
    );

    if (targetUserCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    const currentTarget = targetUserCheck.rows[0];
    const targetRoleId = Number(currentTarget.role_id);

    // Regla de Protección sobre Usuarios Objetivo para Recursos Humanos (role_id: 2)
    if (requesterRoleId === 2) {
      if (targetRoleId <= 2 || isUpdatingSelf) {
        return res.status(403).json({
          status: "error",
          message: "No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía.",
        });
      }

      if (role_id !== undefined && Number(role_id) <= 2) {
        return res.status(403).json({
          status: "error",
          message: "Recursos Humanos solo puede otorgar roles de menor jerarquía (Líder de Área o Empleado).",
        });
      }
    }

    const fieldsToUpdate = [];
    const valuesToUpdate = [];
    let queryIndex = 1;

    if (first_name) {
      fieldsToUpdate.push(`first_name = $${queryIndex++}`);
      valuesToUpdate.push(String(first_name).trim());
    }

    if (last_name) {
      fieldsToUpdate.push(`last_name = $${queryIndex++}`);
      valuesToUpdate.push(String(last_name).trim());
    }

    if (role_id !== undefined) {
      if (!isAuthorizedManager) {
        return res.status(403).json({
          status: "error",
          message: "Acceso denegado. No tiene los permisos necesarios para actualizar el rol de este usuario.",
        });
      }

      const allowedRoles = [1, 2, 3, 4];
      if (!allowedRoles.includes(Number(role_id))) {
        return res.status(400).json({
          status: "error",
          message: "role_id no es válido.",
        });
      }

      fieldsToUpdate.push(`role_id = $${queryIndex++}`);
      valuesToUpdate.push(Number(role_id));
    }

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No se proporcionaron campos válidos para actualizar.",
      });
    }

    const updateQuery = `
      UPDATE users
      SET ${fieldsToUpdate.join(", ")}, updated_at = NOW()
      WHERE id = $${queryIndex}
      RETURNING id, email, first_name, last_name, role_id, updated_at;
    `;
    valuesToUpdate.push(id);

    const result = await query(updateQuery, valuesToUpdate);
    const updatedUser = result.rows[0];

    // Registrar evento de auditoría general
    await logAuditFromRequest(req, {
      action: "USER_UPDATED",
      entityType: "users",
      entityId: id,
      newValues: {
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role_id: updatedUser.role_id,
      },
    });

    // Auditoría específica si hubo cambio de rol
    if (role_id !== undefined && Number(role_id) !== Number(currentTarget.role_id)) {
      await logAuditFromRequest(req, {
        action: "EMPLOYEE_ROLE_UPDATED",
        entityType: "users",
        entityId: id,
        oldValues: {
          role_id: currentTarget.role_id,
        },
        newValues: {
          role_id: updatedUser.role_id,
        },
        details: {
          previous_role_id: currentTarget.role_id,
          new_role_id: updatedUser.role_id,
        },
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Perfil de usuario actualizado correctamente.",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("❌ Error al actualizar usuario:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al actualizar el perfil del usuario.",
    });
  }
};

/**
 * Crear nuevo empleado mediante invitación interna.
 * Administrador (role_id = 1) puede otorgar cualquier rol (1, 2, 3 o 4).
 * Recursos Humanos (role_id = 2) solo puede otorgar roles de menor rango (3 o 4).
 * Genera contraseña temporal, token de activación (48h) y envía email vía Ethereal.
 */
export const createEmployee = async (req, res) => {
  const { email, first_name, last_name, role_id, document_number, file_number } = req.body;

  const requesterRoleId = Number(req.user?.role_id);
  const targetRoleId = Number(role_id);

  if (requesterRoleId !== 1 && requesterRoleId !== 2) {
    return res.status(403).json({
      status: "error",
      message: "Acceso denegado. No tienes permisos para crear colaboradores.",
    });
  }

  if (!email || !first_name || !last_name || !role_id) {
    return res.status(400).json({
      status: "error",
      message: "Faltan campos requeridos: email, first_name, last_name, role_id.",
    });
  }

  // Validar role_id permitido
  const allowedRoles = [1, 2, 3, 4];
  if (!allowedRoles.includes(targetRoleId)) {
    return res.status(400).json({
      status: "error",
      message: "role_id no es válido.",
    });
  }

  // Regla de asignación para Recursos Humanos: únicamente roles > 2 (Líder o Empleado)
  if (requesterRoleId === 2 && targetRoleId <= 2) {
    return res.status(403).json({
      status: "error",
      message: "Recursos Humanos solo puede otorgar roles de menor jerarquía (Líder de Área o Empleado).",
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return res.status(400).json({
        status: "error",
        message: "El email ya está en uso.",
      });
    }

    const cleanDoc = sanitizeString(document_number);
    const cleanFile = sanitizeString(file_number);

    if (cleanDoc) {
      const existingDoc = await query('SELECT id FROM users WHERE document_number = $1', [cleanDoc]);
      if (existingDoc.rowCount > 0) {
        return res.status(400).json({
          status: "error",
          message: "El número de documento ya está registrado en el sistema.",
        });
      }
    }

    if (cleanFile) {
      const existingFile = await query('SELECT id FROM users WHERE file_number = $1', [cleanFile]);
      if (existingFile.rowCount > 0) {
        return res.status(400).json({
          status: "error",
          message: "El número de legajo ya está registrado en el sistema.",
        });
      }
    }

    // Generar contraseña temporal aleatoria
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Token de activación (48h)
    const activationToken = crypto.randomBytes(32).toString('hex');

    const insertQuery = `
      INSERT INTO users (email, password, first_name, last_name, role_id, document_number, file_number, reset_token, reset_token_expires, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '48 hour', false, NOW(), NULL)
      RETURNING id, email, first_name, last_name, role_id, document_number, file_number, is_active, created_at, updated_at;
    `;

    const result = await query(insertQuery, [
      normalizedEmail,
      hashedPassword,
      String(first_name).trim(),
      String(last_name).trim(),
      Number(role_id),
      cleanDoc,
      cleanFile,
      activationToken,
    ]);

    const newUser = result.rows[0];
    const { password: _pwd, reset_token: _token, ...safeUser } = newUser;

    // Envío de correo centralizado
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/activate?token=${activationToken}`;
    const previewUrl = await sendInvitationEmail({
      to: normalizedEmail,
      name: String(first_name).trim(),
      activationLink,
      tempPassword,
    });

    // Auditoría
    await logAuditFromRequest(req, {
      action: 'USER_CREATED_BY_ADMIN',
      entityType: 'users',
      entityId: newUser.id,
      newValues: {
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role_id: newUser.role_id,
        document_number: newUser.document_number,
        file_number: newUser.file_number,
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Empleado creado y correo de activación enviado.",
      user: safeUser,
      previewUrl,
    });
  } catch (error) {
    console.error('❌ Error al crear empleado:', error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al crear el empleado.",
    });
  }
};

/**
 * Reenviar enlace de invitación/activación a un empleado pendiente.
 * Exclusivo para administradores (role_id = 1).
 */
export const resendInvitation = async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await query(
      "SELECT id, email, first_name, last_name, role_id, is_active FROM users WHERE id = $1",
      [id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    const user = userResult.rows[0];
    const requesterRoleId = Number(req.user?.role_id);
    const targetRoleId = Number(user.role_id);
    const isSelf = String(req.user?.id) === String(user.id);

    if (requesterRoleId === 2 && (targetRoleId <= 2 || isSelf)) {
      return res.status(403).json({
        status: "error",
        message: "No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía.",
      });
    }

    // Si la cuenta ya está activa, bloquear
    if (user.is_active === true) {
      return res.status(400).json({
        status: "error",
        message: "La cuenta ya ha sido activada y no requiere reenvío de invitación.",
      });
    }

    // Generar un nuevo token criptográfico seguro
    const activationToken = crypto.randomBytes(32).toString("hex");

    // Actualizar reset_token y expiración a 48 horas
    await query(
      "UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '48 hour', updated_at = NOW() WHERE id = $2",
      [activationToken, user.id]
    );

    // Enviar correo centralizado
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = `${frontendUrl}/activate?token=${activationToken}`;
    const previewUrl = await sendResendInvitationEmail({
      to: user.email,
      name: user.first_name,
      activationLink,
    });

    // Auditoría
    await logAuditFromRequest(req, {
      action: "INVITATION_RESENT_BY_ADMIN",
      entityType: "users",
      entityId: user.id,
      newValues: {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Invitación reenviada correctamente",
      previewUrl,
    });
  } catch (error) {
    console.error("❌ Error en resendInvitation:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al reenviar la invitación.",
    });
  }
};

export default {
  getAllUsers,
  deleteUser,
  updateUser,
  createEmployee,
  resendInvitation,
};
