import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

// Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_COMPLEXITY_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.';

export const registerUser = async (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({
      status: 'error',
      message: 'Faltan campos requeridos: email, password, first_name, last_name, role_id.',
    });
  }

  if (!PASSWORD_REGEX.test(password)) {
    return res.status(400).json({
      status: 'error',
      message: PASSWORD_COMPLEXITY_MESSAGE,
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El email ya se encuentra registrado.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO users (email, password, first_name, last_name, role_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NULL)
      RETURNING id, email, first_name, last_name, role_id, created_at, updated_at;
    `;

    const result = await query(insertQuery, [
      normalizedEmail,
      hashedPassword,
      String(first_name).trim(),
      String(last_name).trim(),
      4, // Employee role forced
    ]);

    const createdUser = result.rows[0];
    const { password: _password, ...safeUser } = createdUser;

    return res.status(201).json({
      status: 'success',
      message: 'Usuario registrado correctamente.',
      user: safeUser,
    });
  } catch (error) {
    console.error('❌ Error al registrar usuario:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Error interno al registrar el usuario.',
    });
  }
};

/**
 * Solicitar enlace de recuperación de contraseña
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      status: 'error',
      message: 'El correo electrónico es requerido.',
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    const userResult = await query(
      'SELECT id, email, first_name FROM users WHERE email = $1',
      [normalizedEmail]
    );

    // Mensaje genérico por seguridad (para evitar enumeración de usuarios)
    const genericSuccessMessage =
      'Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.';

    if (userResult.rows.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: genericSuccessMessage,
      });
    }

    const user = userResult.rows[0];

    // Generar token criptográfico seguro
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Guardar token y expiración (1 hora) en la base de datos
    await query(
      "UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour', updated_at = NOW() WHERE id = $2",
      [resetToken, user.id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Enviar correo de recuperación vía servicio centralizado de correo
    const previewUrl = await sendPasswordResetEmail({
      to: user.email,
      name: user.first_name,
      resetLink,
    });

    return res.status(200).json({
      status: 'success',
      message: genericSuccessMessage,
      previewUrl,
    });
  } catch (error) {
    console.error('❌ Error en forgotPassword:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno al procesar la recuperación de contraseña.',
    });
  }
};

/**
 * Restablecer contraseña con token validado
 */
export const resetPassword = async (req, res) => {
  const { token, password, new_password } = req.body;
  const targetPassword = password || new_password;

  if (!token || !targetPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'El token y la nueva contraseña son requeridos.',
    });
  }

  if (!PASSWORD_REGEX.test(targetPassword)) {
    return res.status(400).json({
      status: 'error',
      message: PASSWORD_COMPLEXITY_MESSAGE,
    });
  }

  try {
    // Validar token no expirado
    const userResult = await query(
      'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo.',
      });
    }

    const user = userResult.rows[0];

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(targetPassword, 10);

    // Actualizar contraseña y limpiar campos de reset
    await query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL, is_active = true, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
    });
  } catch (error) {
    console.error('❌ Error en resetPassword:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno al restablecer la contraseña.',
    });
  }
};

/**
 * Activar cuenta de usuario invitado con token validado
 */
export const activateAccount = async (req, res) => {
  const { token, password, new_password } = req.body;
  const targetPassword = password || new_password;

  if (!token || !targetPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'El token y la nueva contraseña son requeridos.',
    });
  }

  if (!PASSWORD_REGEX.test(targetPassword)) {
    return res.status(400).json({
      status: 'error',
      message: PASSWORD_COMPLEXITY_MESSAGE,
    });
  }

  try {
    const userResult = await query(
      'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El enlace de activación es inválido o ha expirado. Por favor contacta al administrador.',
      });
    }

    const user = userResult.rows[0];
    const hashedPassword = await bcrypt.hash(targetPassword, 10);

    await query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL, is_active = true, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Cuenta activada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.',
    });
  } catch (error) {
    console.error('❌ Error en activateAccount:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno al activar la cuenta.',
    });
  }
};

export default {
  registerUser,
  forgotPassword,
  resetPassword,
  activateAccount,
};
