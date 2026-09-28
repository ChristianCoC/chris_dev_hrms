import test from 'node:test';
import assert from 'node:assert/strict';
import { logAuditEvent, getAuditLogs } from '../src/services/auditService.js';
import { listAuditLogs } from '../src/controllers/auditController.js';

test('auditService y auditController deben exportar sus métodos principales', () => {
  assert.equal(typeof logAuditEvent, 'function');
  assert.equal(typeof getAuditLogs, 'function');
  assert.equal(typeof listAuditLogs, 'function');
});
