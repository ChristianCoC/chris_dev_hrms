import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../src/middlewares/authMiddleware.js';

test('verifyToken debe retornar 401 si no hay header Authorization', () => {
  const req = { headers: {} };
  let statusCode = null;
  let jsonResponse = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };

  let nextCalled = false;
  verifyToken(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 401);
  assert.equal(jsonResponse.status, 'error');
  assert.equal(nextCalled, false);
});

test('verifyToken debe adjuntar user en req si el token es válido', () => {
  const secret = process.env.JWT_SECRET || 'dev_secret_key_change_me';
  const token = jwt.sign({ id: 'user-xyz', role_id: 1, email: 'test@hrms.com' }, secret);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {};
  let nextCalled = false;

  verifyToken(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 'user-xyz');
  assert.equal(req.user.role_id, 1);
});
