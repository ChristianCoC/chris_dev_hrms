import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { resendInvitation, createEmployee, updateUser } from '../src/controllers/userController.js';

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

  describe('Seguridad Jerárquica al crear empleados (createEmployee)', () => {
    test('Administrador (1) puede crear usuarios con cualquier rol válido (1, 2, 3 o 4) con HTTP 201', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
          return { rows: [], rowCount: 0 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO users')) {
          return {
            rows: [
              {
                id: 'new-user-1',
                email: 'admin2@hrms.com',
                first_name: 'Carlos',
                last_name: 'Admin',
                role_id: 1,
                document_number: null,
                file_number: null,
                is_active: false,
                created_at: new Date(),
                updated_at: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        body: {
          email: 'admin2@hrms.com',
          first_name: 'Carlos',
          last_name: 'Admin',
          role_id: 1,
        },
        user: { id: 'admin-root', role_id: 1 },
        headers: {},
      };
      const res = createMockRes();

      await createEmployee(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.user.role_id, 1);

      mock.reset();
    });

    test('Recursos Humanos (2) puede crear colaboradores asignando rol 3 (Líder) o 4 (Empleado) con HTTP 201', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE email')) {
          return { rows: [], rowCount: 0 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO users')) {
          return {
            rows: [
              {
                id: 'new-emp-1',
                email: 'empleado3@hrms.com',
                first_name: 'Martín',
                last_name: 'Gómez',
                role_id: 3,
                document_number: null,
                file_number: null,
                is_active: false,
                created_at: new Date(),
                updated_at: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        body: {
          email: 'empleado3@hrms.com',
          first_name: 'Martín',
          last_name: 'Gómez',
          role_id: 3,
        },
        user: { id: 'hr-user-id', role_id: 2 },
        headers: {},
      };
      const res = createMockRes();

      await createEmployee(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.user.role_id, 3);

      mock.reset();
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta crear usuario con rol 1 (Administrador)', async () => {
      const req = {
        body: {
          email: 'intento_admin@hrms.com',
          first_name: 'Hacker',
          last_name: 'Root',
          role_id: 1,
        },
        user: { id: 'hr-user-id', role_id: 2 },
        headers: {},
      };
      const res = createMockRes();

      await createEmployee(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.match(
        res.body.message,
        /Recursos Humanos solo puede otorgar roles de menor jerarquía \(Líder de Área o Empleado\)/i
      );
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta crear usuario con rol 2 (Recursos Humanos)', async () => {
      const req = {
        body: {
          email: 'intento_hr@hrms.com',
          first_name: 'Colega',
          last_name: 'HR',
          role_id: 2,
        },
        user: { id: 'hr-user-id', role_id: 2 },
        headers: {},
      };
      const res = createMockRes();

      await createEmployee(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.match(
        res.body.message,
        /Recursos Humanos solo puede otorgar roles de menor jerarquía \(Líder de Área o Empleado\)/i
      );
    });
  });

  describe('Seguridad Jerárquica en updateUser', () => {
    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta editar a un Administrador (1)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'admin-target-id', email: 'admin@hrms.com', first_name: 'Admin', last_name: 'Boss', role_id: 1 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'admin-target-id' },
        body: { first_name: 'Nuevo Nombre' },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateUser(req, res);

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía/i
      );

      mock.reset();
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta editar a un par de Recursos Humanos (2)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'hr-target-id', email: 'par@hrms.com', first_name: 'Par', last_name: 'HR', role_id: 2 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'hr-target-id' },
        body: { first_name: 'Cambio' },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateUser(req, res);

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía/i
      );

      mock.reset();
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta otorgar rol 1 o 2', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, email, first_name, last_name, role_id FROM users WHERE id = $1')) {
          return {
            rows: [{ id: 'emp-target-id', email: 'emp@hrms.com', first_name: 'Emp', last_name: 'Low', role_id: 4 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'emp-target-id' },
        body: { role_id: 1 },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateUser(req, res);

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /Recursos Humanos solo puede otorgar roles de menor jerarquía \(Líder de Área o Empleado\)/i
      );

      mock.reset();
    });
  });
});
