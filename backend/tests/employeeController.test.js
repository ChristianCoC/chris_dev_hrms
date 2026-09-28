import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEmployees,
  getEmployeeStats,
  getEmployeeById,
  updateEmployeeHR,
} from '../src/controllers/employeeController.js';

test('employeeController debe exportar todas las funciones requeridas', () => {
  assert.equal(typeof getEmployees, 'function');
  assert.equal(typeof getEmployeeStats, 'function');
  assert.equal(typeof getEmployeeById, 'function');
  assert.equal(typeof updateEmployeeHR, 'function');
});
