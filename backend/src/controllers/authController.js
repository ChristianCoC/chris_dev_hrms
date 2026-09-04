import bcrypt from 'bcrypt';
import { query } from '../config/db.js';

export const registerUser = async (req, res) => {
  const { email, password, first_name, last_name, role_id } = req.body;

  if (!email || !password || !first_name || !last_name || !role_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Faltan campos requeridos: email, password, first_name, last_name, role_id.',
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

export default { registerUser };

