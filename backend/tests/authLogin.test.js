import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../src/config/db.js';
import { loginUser } from '../src/controllers/loginController.js';

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

describe('Módulo de Inicio de Sesión (loginUser)', () => {
  test('loginUser debe exportarse como handler de login', () => {
    assert.equal(typeof loginUser, 'function');
  });

  test('debe retornar 400 si falta email o password en las credenciales', async () => {
    // 1. Body vacío
    {
      const req = { body: {} };
      const res = createMockRes();
      await loginUser(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /Credenciales inválidas/i);
    }

    // 2. Solo email
    {
      const req = { body: { email: 'usuario@hrms.com' } };
      const res = createMockRes();
      await loginUser(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
    }

    // 3. Solo password
    {
      const req = { body: { password: 'secretPassword' } };
      const res = createMockRes();
      await loginUser(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
    }
  });

  test('debe retornar 401 si el usuario no existe en la base de datos', async () => {
    mock.method(pool, 'query', async () => {
      return { rows: [], rowCount: 0 };
    });

    const req = { body: { email: 'inexistente@hrms.com', password: 'password123' } };
    const res = createMockRes();

    await loginUser(req, res);

    mock.reset();

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /Credenciales inválidas/i);
  });

  test('debe retornar 401 si la contraseña no coincide con el hash', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword123', 10);

    mock.method(pool, 'query', async () => {
      return {
        rows: [
          {
            id: 'uuid-user-1',
            email: 'usuario@hrms.com',
            password: passwordHash,
            role_id: 4,
            first_name: 'Esteban',
            last_name: 'Quito',
          },
        ],
        rowCount: 1,
      };
    });

    const req = { body: { email: 'usuario@hrms.com', password: 'WrongPassword' } };
    const res = createMockRes();

    await loginUser(req, res);

    mock.reset();

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /Credenciales inválidas/i);
  });

  test('debe autenticar con éxito (status 200), retornar token JWT válido y perfil seguro', async () => {
    const rawPassword = 'CorrectPassword123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    mock.method(pool, 'query', async () => {
      return {
        rows: [
          {
            id: 'uuid-user-123',
            email: 'empleado@hrms.com',
            password: passwordHash,
            role_id: 4,
            first_name: 'Lucía',
            last_name: 'Mendoza',
          },
        ],
        rowCount: 1,
      };
    });

    const req = { body: { email: 'empleado@hrms.com', password: rawPassword } };
    const res = createMockRes();

    await loginUser(req, res);

    mock.reset();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.token, 'Debe emitir un token JWT');

    // Verificar decodificación del token
    const decoded = jwt.decode(res.body.token);
    assert.equal(decoded.id, 'uuid-user-123');
    assert.equal(decoded.role_id, 4);
    assert.equal(decoded.email, 'empleado@hrms.com');

    // Verificar que los datos del usuario no incluyan el hash de password
    assert.equal(res.body.user.id, 'uuid-user-123');
    assert.equal(res.body.user.first_name, 'Lucía');
    assert.equal(res.body.user.password, undefined);
  });

  test('debe retornar 500 si la base de datos lanza un error', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('Connection timeout');
    });

    const req = { body: { email: 'test@hrms.com', password: 'password123' } };
    const res = createMockRes();

    await loginUser(req, res);

    mock.reset();

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /Error interno al iniciar sesión/i);
  });
});
