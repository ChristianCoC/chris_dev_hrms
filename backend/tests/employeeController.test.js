import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  getEmployees,
  getEmployeeStats,
  getEmployeeById,
  updateEmployeeHR,
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
  });

  test('getEmployees debe responder 200 y devolver la lista de empleados con estructura compatible', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'admin@devpro.com',
        first_name: 'Christian',
        last_name: 'Siles',
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
        phone: null,
        department: null,
        hire_date: null,
        role_id: 4,
        is_active: false,
        role_name: 'employee',
        role_level: 4,
      },
    ];

    mock.method(pool, 'query', async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM users u')) {
        return { rows: mockUsers, rowCount: mockUsers.length };
      }
      return { rows: [], rowCount: 0 };
    });

    const req = { query: {} };
    const res = createMockRes();

    await getEmployees(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.results, 2);
    assert.ok(Array.isArray(res.body.data.employees));
    assert.ok(Array.isArray(res.body.employees));
    assert.equal(res.body.data.employees.length, 2);
    assert.equal(res.body.data.employees[0].first_name, 'Christian');
    assert.equal(res.body.data.employees[1].is_active, false);

    mock.reset();
  });
});
