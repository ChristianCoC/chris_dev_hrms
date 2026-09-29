import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { registerUser, forgotPassword, resetPassword } from '../src/controllers/authController.js';

const createMockRes = () => {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
};

describe('Módulo de Registro (registerUser)', () => {
  test('registerUser debe exportarse como handler de registro', () => {
    assert.equal(typeof registerUser, 'function');
  });

  test('debe retornar 400 si faltan campos requeridos en el body', async () => {
    const requiredFields = ['email', 'password', 'first_name', 'last_name', 'role_id'];

    const basePayload = {
      email: 'test@hrms.com',
      password: 'Password123',
      first_name: 'Juan',
      last_name: 'Pérez',
      role_id: 4,
    };

    // Probar body completamente vacío
    {
      const req = { body: {} };
      const res = createMockRes();
      await registerUser(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /Faltan campos requeridos/i);
    }

    // Probar omitiendo cada campo obligatorio
    for (const field of requiredFields) {
      const payload = { ...basePayload };
      delete payload[field];

      const req = { body: payload };
      const res = createMockRes();

      await registerUser(req, res);

      assert.equal(res.statusCode, 400, `Debería retornar 400 cuando falta ${field}`);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /Faltan campos requeridos/i);
    }
  });

  test('debe retornar 400 si la contraseña no cumple con la complejidad requerida', async () => {
    const invalidPasswords = [
      'corta1A', // menos de 8 caracteres
      'solominusculas123', // sin mayúscula
      'SOLOMAYUSCULAS123', // sin minúscula
      'SinNumerosLetras', // sin número
    ];

    for (const invalidPass of invalidPasswords) {
      const req = {
        body: {
          email: 'valido@hrms.com',
          password: invalidPass,
          first_name: 'Pedro',
          last_name: 'Picapiedra',
          role_id: 4,
        },
      };
      const res = createMockRes();
      await registerUser(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.equal(
        res.body.message,
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'
      );
    }
  });

  test('debe retornar 400 si el email ya se encuentra registrado', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [{ id: 'existing-uuid-123' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      body: {
        email: 'existente@hrms.com',
        password: 'Password123',
        first_name: 'Carlos',
        last_name: 'Gómez',
        role_id: 4,
      },
    };
    const res = createMockRes();

    await registerUser(req, res);

    mock.reset();

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /El email ya se encuentra registrado/i);
  });

  test('debe registrar un usuario exitosamente con status 201 y no exponer la contraseña', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [], rowCount: 0 };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO users')) {
        return {
          rows: [
            {
              id: 'new-user-uuid',
              email: 'nuevo@hrms.com',
              first_name: 'Ana',
              last_name: 'López',
              role_id: 4,
              created_at: new Date().toISOString(),
              updated_at: null,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      body: {
        email: 'nuevo@hrms.com',
        password: 'SecurePassword123!',
        first_name: 'Ana',
        last_name: 'López',
        role_id: 4,
      },
    };
    const res = createMockRes();

    await registerUser(req, res);

    mock.reset();

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.user.email, 'nuevo@hrms.com');
    assert.equal(res.body.user.password, undefined, 'La contraseña hasheada no debe exponerse en la respuesta');
  });

  test('debe retornar 500 si la base de datos lanza un error inesperado', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('Database connection failed');
    });

    const req = {
      body: {
        email: 'error@hrms.com',
        password: 'Password123',
        first_name: 'Error',
        last_name: 'Test',
        role_id: 4,
      },
    };
    const res = createMockRes();

    await registerUser(req, res);

    mock.reset();

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /Error interno al registrar el usuario/i);
  });
});

describe('Módulo de Recuperación de Contraseña (forgotPassword & resetPassword)', () => {
  test('forgotPassword debe retornar 400 si falta el email', async () => {
    const req = { body: {} };
    const res = createMockRes();

    await forgotPassword(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /correo electrónico es requerido/i);
  });

  test('forgotPassword debe responder 200 con mensaje genérico seguro si el email no existe', async () => {
    mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));

    const req = { body: { email: 'no_existe@hrms.com' } };
    const res = createMockRes();

    await forgotPassword(req, res);

    mock.reset();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.match(res.body.message, /recibirás un enlace/i);
  });

  test('resetPassword debe retornar 400 si falta el token o la contraseña', async () => {
    // 1. Falta password
    {
      const req = { body: { token: 'sample-token' } };
      const res = createMockRes();
      await resetPassword(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
    }

    // 2. Falta token
    {
      const req = { body: { password: 'NewPassword123!' } };
      const res = createMockRes();
      await resetPassword(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
    }
  });

  test('resetPassword debe retornar 400 si la nueva contraseña no cumple con la complejidad requerida', async () => {
    const req = { body: { token: 'sample-token', password: 'invalida' } };
    const res = createMockRes();
    await resetPassword(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.equal(
      res.body.message,
      'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'
    );
  });

  test('resetPassword debe retornar 400 si el token es inválido o expiró', async () => {
    mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));

    const req = { body: { token: 'token-invalido', password: 'NewPassword123!' } };
    const res = createMockRes();

    await resetPassword(req, res);

    mock.reset();

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /inválido o ha expirado/i);
  });

  test('resetPassword debe actualizar contraseña y retornar 200 si el token es válido', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, email FROM users WHERE reset_token')) {
        return { rows: [{ id: 'user-uuid-123', email: 'user@hrms.com' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const req = { body: { token: 'valid-token', password: 'NewSecurePassword123!' } };
    const res = createMockRes();

    await resetPassword(req, res);

    mock.reset();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.match(res.body.message, /actualizada correctamente/i);
  });
});
