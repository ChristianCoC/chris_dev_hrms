import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { resendInvitation, createEmployee } from '../src/controllers/userController.js';

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

describe('Módulo de Invitaciones y Empleados (userController)', () => {
  test('resendInvitation debe exportarse como función', () => {
    assert.equal(typeof resendInvitation, 'function');
  });

  test('resendInvitation debe retornar 404 si el usuario no existe', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, email, first_name')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      params: { id: 'non-existing-uuid' },
      user: { id: 'admin-uuid', role_id: 1 },
      headers: {},
    };
    const res = createMockRes();

    await resendInvitation(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /Usuario no encontrado/i);

    mock.reset();
  });

  test('resendInvitation debe retornar 400 si la cuenta ya está activa', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, email, first_name')) {
        return {
          rows: [
            {
              id: 'user-active-uuid',
              email: 'activo@hrms.com',
              first_name: 'Carlos',
              last_name: 'Pérez',
              role_id: 4,
              is_active: true,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      params: { id: 'user-active-uuid' },
      user: { id: 'admin-uuid', role_id: 1 },
      headers: {},
    };
    const res = createMockRes();

    await resendInvitation(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /La cuenta ya ha sido activada y no requiere reenvío de invitación/i);

    mock.reset();
  });

  test('resendInvitation debe emitir nuevo token y responder 200 si la cuenta está pendiente', async () => {
    let updateExecuted = false;
    let auditLogged = false;

    mock.method(pool, 'query', async (sql, values) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, email, first_name')) {
        return {
          rows: [
            {
              id: 'user-pending-uuid',
              email: 'pendiente@hrms.com',
              first_name: 'Ana',
              last_name: 'Gómez',
              role_id: 4,
              is_active: false,
            },
          ],
          rowCount: 1,
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE users SET reset_token')) {
        updateExecuted = true;
        return { rowCount: 1 };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
        auditLogged = true;
        return { rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      params: { id: 'user-pending-uuid' },
      user: { id: 'admin-uuid', role_id: 1 },
      headers: {},
    };
    const res = createMockRes();

    await resendInvitation(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.match(res.body.message, /Invitación reenviada correctamente/i);
    assert.equal(updateExecuted, true);

    mock.reset();
  });

  test('createEmployee debe rechazar con 400 si el document_number ya existe', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [], rowCount: 0 };
      }
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE document_number')) {
        return { rows: [{ id: 'existing-id' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      body: {
        email: 'nuevo@hrms.com',
        first_name: 'Lucía',
        last_name: 'Paz',
        role_id: 4,
        document_number: '38123456',
      },
      user: { id: 'admin-uuid', role_id: 1 },
      headers: {},
    };
    const res = createMockRes();

    await createEmployee(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /El número de documento ya está registrado/i);

    mock.reset();
  });

  test('createEmployee debe rechazar con 400 si el file_number ya existe', async () => {
    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [], rowCount: 0 };
      }
      if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE file_number')) {
        return { rows: [{ id: 'existing-id' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = {
      body: {
        email: 'nuevo2@hrms.com',
        first_name: 'Lucía',
        last_name: 'Paz',
        role_id: 4,
        file_number: '1042',
      },
      user: { id: 'admin-uuid', role_id: 1 },
      headers: {},
    };
    const res = createMockRes();

    await createEmployee(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /El número de legajo ya está registrado/i);

    mock.reset();
  });
});
