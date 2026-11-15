import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  getEmployees,
  getEmployeeStats,
  getEmployeeById,
  updateEmployeeHR,
  deactivateEmployee,
} from '../src/controllers/employeeController.js';

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

describe('Módulo de Empleados (employeeController)', () => {
  test('employeeController debe exportar todas las funciones requeridas', () => {
    assert.equal(typeof getEmployees, 'function');
    assert.equal(typeof getEmployeeStats, 'function');
    assert.equal(typeof getEmployeeById, 'function');
    assert.equal(typeof updateEmployeeHR, 'function');
    assert.equal(typeof deactivateEmployee, 'function');
  });

  test('getEmployees debe responder 200 y devolver la lista de empleados con document_number y file_number', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'admin@devpro.com',
        first_name: 'Christian',
        last_name: 'Siles',
        document_number: '38123456',
        file_number: '1001',
        phone: null,
        department: null,
        hire_date: null,
        role_id: 1,
        is_active: true,
        role_name: 'admin',
        role_level: 1,
      },
      {
        id: 'user-2',
        email: 'empleado@devpro.com',
        first_name: 'Ana',
        last_name: 'Doe',
        document_number: null,
        file_number: null,
        phone: null,
        department: null,
        hire_date: null,
        role_id: 4,
        is_active: false,
        role_name: 'employee',
        role_level: 4,
      },
    ];

    let executedQuery = '';
    let executedValues = [];

    mock.method(pool, 'query', async (sql, values) => {
      if (typeof sql === 'string' && sql.includes('FROM users u')) {
        executedQuery = sql;
        executedValues = values;
        return { rows: mockUsers, rowCount: mockUsers.length };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = { query: { search: '38123456' } };
    const res = createMockRes();

    await getEmployees(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.results, 2);
    assert.ok(Array.isArray(res.body.data.employees));
    assert.ok(Array.isArray(res.body.employees));
    assert.equal(res.body.data.employees[0].document_number, '38123456');
    assert.equal(res.body.data.employees[0].file_number, '1001');

    // Comprobar que la búsqueda por texto incluye document_number y file_number
    assert.ok(executedQuery.includes('u.document_number ILIKE'));
    assert.ok(executedQuery.includes('u.file_number ILIKE'));
    assert.deepEqual(executedValues, ['%38123456%']);

    mock.reset();
  });

  describe('Baja Lógica / Desactivación de Empleados (deactivateEmployee)', () => {
    test('debe bloquear con 400 si el administrador intenta darse de baja a sí mismo', async () => {
      const req = {
        params: { id: 'admin-uuid-1' },
        user: { id: 'admin-uuid-1', role_id: 1, email: 'admin@devpro.com' },
      };
      const res = createMockRes();

      await deactivateEmployee(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /No puedes darte de baja a ti mismo/i);
    });

    test('debe retornar 404 si el empleado a desactivar no existe', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, first_name')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'user-inexistente' },
        user: { id: 'admin-uuid-1', role_id: 1, email: 'admin@devpro.com' },
      };
      const res = createMockRes();

      await deactivateEmployee(req, res);

      mock.reset();

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /Empleado no encontrado/i);
    });

    test('debe retornar 400 si el colaborador ya está inactivo o dado de baja', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: 'emp-2',
                first_name: 'Carlos',
                last_name: 'Gómez',
                email: 'carlos@devpro.com',
                is_active: false,
                deactivation_date: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'emp-2' },
        user: { id: 'admin-uuid-1', role_id: 1, email: 'admin@devpro.com' },
      };
      const res = createMockRes();

      await deactivateEmployee(req, res);

      mock.reset();

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /ya se encuentra dado de baja/i);
    });

    test('debe desactivar con éxito (200), marcar is_active = false, guardar deactivation_date y registrar auditoría', async () => {
      let updateExecuted = false;
      let auditLogExecuted = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: 'emp-active-1',
                first_name: 'Lucía',
                last_name: 'Pérez',
                email: 'lucia@devpro.com',
                is_active: true,
                deactivation_date: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE users') && sql.includes('SET is_active = false')) {
          updateExecuted = true;
          return {
            rows: [
              {
                id: 'emp-active-1',
                email: 'lucia@devpro.com',
                first_name: 'Lucía',
                last_name: 'Pérez',
                is_active: false,
                deactivation_date: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          auditLogExecuted = true;
          assert.equal(values[1], 'EMPLOYEE_DEACTIVATED_BY_ADMIN');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'emp-active-1' },
        user: { id: 'admin-uuid-1', role_id: 1, email: 'admin@devpro.com' },
      };
      const res = createMockRes();

      await deactivateEmployee(req, res);

      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(updateExecuted, 'Debe ejecutar la actualización en la BD');
      assert.ok(auditLogExecuted, 'Debe registrar la baja en audit_logs');
      assert.equal(res.body.data.employee.is_active, false);
      assert.ok(res.body.data.employee.deactivation_date);
    });

    test('Recursos Humanos (2) puede dar de baja a Empleado (rol 4) o Líder (rol 3) con HTTP 200', async () => {
      let updateExecuted = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: 'emp-regular-1',
                first_name: 'Roberto',
                last_name: 'Gómez',
                email: 'roberto@devpro.com',
                role_id: 4,
                is_active: true,
                deactivation_date: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE users') && sql.includes('SET is_active = false')) {
          updateExecuted = true;
          return {
            rows: [
              {
                id: 'emp-regular-1',
                email: 'roberto@devpro.com',
                first_name: 'Roberto',
                last_name: 'Gómez',
                is_active: false,
                deactivation_date: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          assert.equal(values[1], 'EMPLOYEE_DEACTIVATED_BY_HR');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'emp-regular-1' },
        user: { id: 'hr-user-id', role_id: 2, email: 'hr@devpro.com' },
      };
      const res = createMockRes();

      await deactivateEmployee(req, res);

      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(updateExecuted);
      assert.equal(res.body.data.employee.is_active, false);
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta dar de baja a un Administrador (rol 1)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: 'admin-target-id',
                first_name: 'Admin',
                last_name: 'Principal',
                role_id: 1,
                is_active: true,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'admin-target-id' },
        user: { id: 'hr-user-id', role_id: 2, email: 'hr@devpro.com' },
      };
      const res = createMockRes();

      await deactivateEmployee(req, res);

      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía/i
      );
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta dar de baja a otro Recursos Humanos (rol 2)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users WHERE id = $1')) {
          return {
            rows: [
              {
                id: 'hr-peer-id',
                first_name: 'Colega',
                last_name: 'RRHH',
                role_id: 2,
                is_active: true,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'hr-peer-id' },
        user: { id: 'hr-user-id', role_id: 2, email: 'hr@devpro.com' },
      };
      const res = createMockRes();

      await deactivateEmployee(req, res);

      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía/i
      );
    });
  });

  describe('Seguridad Jerárquica en updateEmployeeHR', () => {
    test('Administrador (1) puede actualizar cualquier colaborador y ascenderlo a rol 2 con HTTP 200', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, first_name, last_name')) {
          return {
            rows: [
              {
                id: 'emp-promoted',
                first_name: 'Elena',
                last_name: 'Ríos',
                role_id: 4,
                document_number: '12345678',
                file_number: '555',
                phone: null,
                department: 'Sistemas',
                hire_date: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE users')) {
          return {
            rows: [
              {
                id: 'emp-promoted',
                email: 'elena@devpro.com',
                first_name: 'Elena',
                last_name: 'Ríos',
                role_id: 2,
                document_number: '12345678',
                file_number: '555',
                phone: null,
                department: 'RRHH',
                hire_date: null,
                updated_at: new Date(),
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
        params: { id: 'emp-promoted' },
        body: { role_id: 2, department: 'RRHH' },
        user: { id: 'admin-uuid', role_id: 1 },
      };
      const res = createMockRes();

      await updateEmployeeHR(req, res);

      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.employee.role_id, 2);
    });

    test('Recursos Humanos (2) puede editar y asignar rol 3 a un empleado de rol 4 con HTTP 200', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, first_name, last_name')) {
          return {
            rows: [
              {
                id: 'emp-4',
                first_name: 'Mario',
                last_name: 'Bros',
                role_id: 4,
                document_number: null,
                file_number: null,
                phone: null,
                department: 'Plomería',
                hire_date: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE users')) {
          return {
            rows: [
              {
                id: 'emp-4',
                email: 'mario@devpro.com',
                first_name: 'Mario',
                last_name: 'Bros',
                role_id: 3,
                document_number: null,
                file_number: null,
                phone: null,
                department: 'Plomería',
                hire_date: null,
                updated_at: new Date(),
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
        params: { id: 'emp-4' },
        body: { role_id: 3 },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateEmployeeHR(req, res);

      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.employee.role_id, 3);
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta otorgar role_id 1 o 2', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, first_name, last_name')) {
          return {
            rows: [
              {
                id: 'emp-4',
                first_name: 'Mario',
                last_name: 'Bros',
                role_id: 4,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'emp-4' },
        body: { role_id: 1 },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateEmployeeHR(req, res);

      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /Recursos Humanos solo puede otorgar roles de menor jerarquía \(Líder de Área o Empleado\)/i
      );
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta editar a un Administrador (rol 1)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, first_name, last_name')) {
          return {
            rows: [
              {
                id: 'admin-id',
                first_name: 'Admin',
                last_name: 'Chief',
                role_id: 1,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'admin-id' },
        body: { phone: '11223344' },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateEmployeeHR(req, res);

      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía/i
      );
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta editar a un par de Recursos Humanos (rol 2)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, first_name, last_name')) {
          return {
            rows: [
              {
                id: 'hr-peer-id',
                first_name: 'Colega',
                last_name: 'RRHH',
                role_id: 2,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'hr-peer-id' },
        body: { phone: '11223344' },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateEmployeeHR(req, res);

      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía/i
      );
    });

    test('Recursos Humanos (2) es bloqueado con HTTP 403 si intenta editarse a sí mismo a través de updateEmployeeHR', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, first_name, last_name')) {
          return {
            rows: [
              {
                id: 'hr-user-id',
                first_name: 'Mi',
                last_name: 'PropioPerfil',
                role_id: 2,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: 'hr-user-id' },
        body: { phone: '11223344' },
        user: { id: 'hr-user-id', role_id: 2 },
      };
      const res = createMockRes();

      await updateEmployeeHR(req, res);

      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(
        res.body.message,
        /No tienes permisos para modificar el perfil, rol o estado de un usuario de igual o mayor jerarquía/i
      );
    });
  });
});
