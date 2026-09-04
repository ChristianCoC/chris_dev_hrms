import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const signToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role_id: user.role_id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Credenciales inválidas.',
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    const result = await query(
      'SELECT id, email, password, role_id, first_name, last_name FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.',
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.',
      });
    }

    const token = signToken(user);

    return res.status(200).json({
      status: 'success',
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role_id: user.role_id,
      },
    });
  } catch (error) {
    console.error('❌ Error al iniciar sesión:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Error interno al iniciar sesión.',
      error: error.message,
    });
  }
};

export default { loginUser };
