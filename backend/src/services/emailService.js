import nodemailer from 'nodemailer';

/**
 * Crea o reutiliza un transporte de correo para entorno local (Ethereal Email).
 */
const createMailTransporter = async () => {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

/**
 * Envía un correo electrónico formateado usando Nodemailer / Ethereal.
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.text
 * @param {string} options.html
 * @returns {Promise<string|null>} Retorna la URL de vista previa en Ethereal si está disponible
 */
export const sendSystemEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = await createMailTransporter();
    const info = await transporter.sendMail({
      from: '"HRMS Soporte" <no-reply@devpro.com>',
      to,
      subject,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`✉️ Correo simulado enviado a: ${to} | Asunto: "${subject}"`);
    if (previewUrl) {
      console.log(`🔗 Vista previa Ethereal Email: ${previewUrl}`);
    }
    return previewUrl || null;
  } catch (error) {
    console.error(`⚠️ Advertencia al enviar correo a ${to}:`, error.message);
    return null;
  }
};

/**
 * Envía correo para restablecer contraseña (1 hora de vigencia).
 */
export const sendPasswordResetEmail = async ({ to, name, resetLink }) => {
  const text = `Hola ${name},\n\nHas solicitado restablecer tu contraseña de HRMS. Accede al siguiente enlace para definir una nueva clave (válido por 1 hora):\n\n${resetLink}\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.\n\nEquipo HRMS`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0F172A; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
      <h2 style="color: #1D4ED8; margin-bottom: 8px;">HRMS - Recuperación de Contraseña</h2>
      <p style="font-size: 14px;">Hola <strong>${name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5;">Has solicitado restablecer tu contraseña para acceder al sistema. Haz clic en el botón a continuación para ingresar una nueva clave:</p>
      <div style="margin: 24px 0;">
        <a href="${resetLink}" style="background-color: #1D4ED8; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">Restablecer mi contraseña</a>
      </div>
      <p style="color: #64748B; font-size: 12px;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${resetLink}" style="color: #1D4ED8;">${resetLink}</a></p>
      <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 12px;">Este enlace expirará en 1 hora. Si no realizaste esta solicitud, tu cuenta sigue estando segura y no se requiere ninguna acción.</p>
    </div>
  `;

  return sendSystemEmail({ to, subject: 'Recuperación de Contraseña - HRMS', text, html });
};

/**
 * Envía invitación inicial para nuevo colaborador (48 horas de vigencia).
 */
export const sendInvitationEmail = async ({ to, name, activationLink, tempPassword }) => {
  const text = `Hola ${name},\n\nHas sido invitado a unirte al HRMS. Usa el siguiente enlace para activar tu cuenta y definir una contraseña (válido 48h):\n${activationLink}\n\nTu contraseña temporal es: ${tempPassword}\n\nSi no esperabas esta invitación, ignora este correo.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0F172A; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
      <h2 style="color: #1D4ED8; margin-bottom: 8px;">HRMS - Invitación</h2>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Has sido invitado a crear una cuenta. Haz clic en el botón para activar (válido 48h).</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${activationLink}" style="background: #1D4ED8; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Activar mi cuenta</a>
      </div>
      <p>Contraseña temporal: <code>${tempPassword}</code></p>
      <p style="font-size: 12px; color: #64748B;">Si el botón no funciona, copia el enlace: <a href="${activationLink}" style="color: #1D4ED8;">${activationLink}</a></p>
      <p style="color: #64748B; font-size: 12px; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 12px;">Este enlace expirará en 48 horas.</p>
    </div>
  `;

  return sendSystemEmail({ to, subject: 'Invitación a HRMS - Activa tu cuenta', text, html });
};

/**
 * Envía reenvío de invitación para activación de cuenta (48 horas de vigencia).
 */
export const sendResendInvitationEmail = async ({ to, name, activationLink }) => {
  const text = `Hola ${name},\n\nSe ha emitido un nuevo enlace de activación para tu cuenta en HRMS (válido por 48 horas):\n${activationLink}\n\nSi no esperabas este correo, puedes ignorarlo.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0F172A; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
      <h2 style="color: #1D4ED8; margin-bottom: 8px;">HRMS - Nuevo Enlace de Activación</h2>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Un administrador ha solicitado el reenvío de tu invitación de acceso a HRMS. Haz clic en el botón a continuación para crear tu contraseña definitiva (enlace válido por 48 horas):</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${activationLink}" style="background: #1D4ED8; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Activar mi cuenta</a>
      </div>
      <p style="font-size: 12px; color: #64748B;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${activationLink}" style="color: #1D4ED8;">${activationLink}</a></p>
      <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 12px;">Este enlace expirará en 48 horas.</p>
    </div>
  `;

  return sendSystemEmail({ to, subject: 'Reenvío de Invitación - Activa tu cuenta en HRMS', text, html });
};
