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
  });
});
