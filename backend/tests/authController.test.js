import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { registerUser } from '../src/controllers/authController.js';

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
      password: 'password123',
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

  test('debe retornar 400 si el email ya se encuentra registrado', async () => {
    // Mockear pool.query para simular que el email ya existe
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [{ id: 'existing-uuid-123' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      body: {
        email: 'existente@hrms.com',
        password: 'password123',
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
      // 1. Verificación de email existente -> 0 filas
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [], rowCount: 0 };
      }
      // 2. Inserción de usuario
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
        password: 'password123',
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
