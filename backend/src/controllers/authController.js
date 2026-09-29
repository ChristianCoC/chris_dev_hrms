import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { query } from '../config/db.js';

// Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_COMPLEXITY_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.';

export const registerUser = async (req, res) => {
  const { email, password, first_name, last_name, role_id } = req.body;

  if (!email || !password || !first_name || !last_name || !role_id) {
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
      role_id,
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
      error: error.message,
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

    // Simular envío de correo con Ethereal Email (Nodemailer)
    let previewUrl = null;
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const mailOptions = {
        from: '"HRMS Soporte" <no-reply@devpro.com>',
        to: user.email,
        subject: 'Recuperación de Contraseña - HRMS',
        text: `Hola ${user.first_name},\n\nHas solicitado restablecer tu contraseña de HRMS. Accede al siguiente enlace para definir una nueva clave (válido por 1 hora):\n\n${resetLink}\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.\n\nEquipo HRMS`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0F172A; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
            <h2 style="color: #1D4ED8; margin-bottom: 8px;">HRMS - Recuperación de Contraseña</h2>
            <p style="font-size: 14px;">Hola <strong>${user.first_name}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.5;">Has solicitado restablecer tu contraseña para acceder al sistema. Haz clic en el botón a continuación para ingresar una nueva clave:</p>
            <div style="margin: 24px 0;">
              <a href="${resetLink}" style="background-color: #1D4ED8; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Restablecer mi contraseña</a>
            </div>
            <p style="color: #64748B; font-size: 12px;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${resetLink}" style="color: #1D4ED8;">${resetLink}</a></p>
            <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 12px;">Este enlace expirará en 1 hora. Si no realizaste esta solicitud, tu cuenta sigue estando segura y no se requiere ninguna acción.</p>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✉️ Correo de recuperación simulado enviado a: ${user.email}`);
      console.log(`🔗 Vista previa Ethereal Email: ${previewUrl}`);
      console.log(`🔗 Enlace directo de reset: ${resetLink}`);
    } catch (mailError) {
      console.error('⚠️ Advertencia con Nodemailer Ethereal:', mailError.message);
      console.log(`🔗 Enlace directo de recuperación (fallback): ${resetLink}`);
    }

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
      error: error.message,
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
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
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
      error: error.message,
    });
  }
};

export default {
  registerUser,
  forgotPassword,
  resetPassword,
};
