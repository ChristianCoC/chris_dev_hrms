import { query } from "../config/db.js";
import { logAuditEvent } from "../services/auditService.js";
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

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
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (req.user.id === id) {
    return res.status(400).json({
      status: "error",
      message: "Operación denegada. No puedes eliminar tu propio usuario.",
    });
  }

  try {
    const userChek = await query("SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1", [id]);

    if (userChek.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    const deletedUserData = userChek.rows[0];

    await query("DELETE FROM users WHERE id = $1", [id]);

    // Registrar evento de auditoría
    const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId: req.user.id,
      action: "USER_DELETED",
      entityType: "users",
      entityId: id,
      oldValues: {
        email: deletedUserData.email,
        first_name: deletedUserData.first_name,
        last_name: deletedUserData.last_name,
        role_id: deletedUserData.role_id,
      },
      ipAddress,
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
      error: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, role_id } = req.body;
  const isUpdatingSelf = req.user.id === id;
  const isAuthorizedManager = [1, 2].includes(req.user.role_id);

  if (!isUpdatingSelf && !isAuthorizedManager) {
    return res.status(403).json({
      status: "error",
      message: "Acceso denegado. No tiene los permisos necesarios para actualizar este usuario.",
    });
  }

  const fieldsToUpdate = [];
  const valuesToUpdate = [];
  let queryIndex = 1;

  if (first_name) {
    fieldsToUpdate.push(`first_name = $${queryIndex++}`);
    valuesToUpdate.push(first_name);
  }

  if (last_name) {
    fieldsToUpdate.push(`last_name = $${queryIndex++}`);
    valuesToUpdate.push(last_name);
  }

  if (role_id) {
    if (!isAuthorizedManager) {
      return res.status(403).json({
        status: "error",
        message: "Acceso denegado. No tiene los permisos necesarios para actualizar el rol de este usuario.",
      });
    }
    fieldsToUpdate.push(`role_id = $${queryIndex++}`);
    valuesToUpdate.push(role_id);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "No se proporcionaron campos válidos para actualizar.",
    });
  }

  try {
    const updateQuery = `
            UPDATE users
            SET ${fieldsToUpdate.join(", ")}, updated_at = NOW()
            WHERE id = $${queryIndex}
            RETURNING id, email, first_name, last_name, role_id, updated_at;`;
    valuesToUpdate.push(id);

    const result = await query(updateQuery, valuesToUpdate);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    const updatedUser = result.rows[0];

    // Registrar evento de auditoría
    const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId: req.user.id,
      action: "USER_UPDATED",
      entityType: "users",
      entityId: id,
      newValues: {
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role_id: updatedUser.role_id,
      },
      ipAddress,
    });

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
      error: error.message,
    });
  }
};

/**
 * Crear nuevo empleado mediante invitación interna.
 * Sólo accesible para usuarios con rol Administrador (role_id = 1).
 * Genera contraseña temporal, token de activación (48h) y envía email vía Ethereal.
 */
export const createEmployee = async (req, res) => {
  const { email, first_name, last_name, role_id, document_number, file_number } = req.body;

  if (!email || !first_name || !last_name || !role_id) {
    return res.status(400).json({
      status: "error",
      message: "Faltan campos requeridos: email, first_name, last_name, role_id.",
    });
  }

  // validar role_id permitido
  const allowedRoles = [1, 2, 3, 4];
  if (!allowedRoles.includes(Number(role_id))) {
    return res.status(400).json({
      status: "error",
      message: "role_id no es válido.",
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

    const cleanDoc = document_number && String(document_number).trim() ? String(document_number).trim() : null;
    const cleanFile = file_number && String(file_number).trim() ? String(file_number).trim() : null;

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

    // generar contraseña temporal aleatoria
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // token de activación (48h)
    const activationToken = crypto.randomBytes(32).toString('hex');

    const insertQuery = `
      INSERT INTO users (email, password, first_name, last_name, role_id, document_number, file_number, reset_token, reset_token_expires, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '48 hour', false, NOW(), NULL)
      RETURNING id, email, first_name, last_name, role_id, document_number, file_number, is_active, created_at, updated_at;`;

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

    // envío de email vía Ethereal
    let previewUrl = null;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/activate?token=${activationToken}`;
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const mailOptions = {
        from: '"HRMS Soporte" <no-reply@devpro.com>',
        to: normalizedEmail,
        subject: 'Invitación a HRMS - Activa tu cuenta',
        text: `Hola ${first_name},\n\nHas sido invitado a unirte al HRMS. Usa el siguiente enlace para activar tu cuenta y definir una contraseña (válido 48h):\n${activationLink}\n\nTu contraseña temporal es: ${tempPassword}\n\nSi no esperabas esta invitación, ignora este correo.`,
        html: `<div style="font-family:Arial,sans-serif;color:#0F172A;max-width:580px;margin:0 auto;padding:24px;border:1px solid #E2E8F0;border-radius:8px;">
          <h2 style="color:#1D4ED8;margin-bottom:8px;">HRMS - Invitación</h2>
          <p>Hola <strong>${first_name}</strong>,</p>
          <p>Has sido invitado a crear una cuenta. Haz clic en el botón para activar (válido 48h).</p>
          <div style="margin:24px 0;text-align:center;"><a href="${activationLink}" style="background:#1D4ED8;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Activar mi cuenta</a></div>
          <p>Contraseña temporal: <code>${tempPassword}</code></p>
          <p>Si el botón no funciona, copia el enlace: <a href="${activationLink}" style="color:#1D4ED8;">${activationLink}</a></p>
          <p style="color:#64748B;font-size:12px;margin-top:24px;border-top:1px solid #E2E8F0;padding-top:12px;">Este enlace expirará en 48 horas.</p>
        </div>`,
      };
      const info = await transporter.sendMail(mailOptions);
      previewUrl = nodemailer.getTestMessageUrl(info);
    } catch (mailErr) {
      console.error('⚠️ Error enviando invitación Ethereal:', mailErr.message);
    }

    // auditoría
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId: req.user.id,
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
      ipAddress,
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
      error: error.message,
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

    // Enviar correo con Nodemailer / Ethereal
    let previewUrl = null;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = `${frontendUrl}/activate?token=${activationToken}`;

    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });

      const mailOptions = {
        from: '"HRMS Soporte" <no-reply@devpro.com>',
        to: user.email,
        subject: "Reenvío de Invitación - Activa tu cuenta en HRMS",
        text: `Hola ${user.first_name},\n\nSe ha emitido un nuevo enlace de activación para tu cuenta en HRMS (válido por 48 horas):\n${activationLink}\n\nSi no esperabas este correo, puedes ignorarlo.`,
        html: `<div style="font-family:Arial,sans-serif;color:#0F172A;max-width:580px;margin:0 auto;padding:24px;border:1px solid #E2E8F0;border-radius:8px;">
          <h2 style="color:#1D4ED8;margin-bottom:8px;">HRMS - Nuevo Enlace de Activación</h2>
          <p>Hola <strong>${user.first_name}</strong>,</p>
          <p>Un administrador ha solicitado el reenvío de tu invitación de acceso a HRMS. Haz clic en el botón a continuación para crear tu contraseña definitiva (enlace válido por 48 horas):</p>
          <div style="margin:24px 0;text-align:center;">
            <a href="${activationLink}" style="background:#1D4ED8;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Activar mi cuenta</a>
          </div>
          <p style="font-size:12px;color:#64748B;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${activationLink}" style="color:#1D4ED8;">${activationLink}</a></p>
          <p style="color:#94A3B8;font-size:11px;margin-top:24px;border-top:1px solid #E2E8F0;padding-top:12px;">Este enlace expirará en 48 horas.</p>
        </div>`,
      };

      const info = await transporter.sendMail(mailOptions);
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✉️ Invitación reenviada a: ${user.email}`);
      console.log(`🔗 Ethereal preview: ${previewUrl}`);
    } catch (mailErr) {
      console.error("⚠️ Error enviando correo de reenvío con Nodemailer:", mailErr.message);
    }

    // Auditoría
    const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || null;
    await logAuditEvent({
      userId: req.user.id,
      action: "INVITATION_RESENT_BY_ADMIN",
      entityType: "users",
      entityId: user.id,
      newValues: {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      ipAddress,
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
      error: error.message,
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
