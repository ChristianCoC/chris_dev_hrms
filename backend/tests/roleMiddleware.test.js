import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeRoles } from '../src/middlewares/roleMiddleware.js';

test('authorizeRoles debe bloquear con 401 si no hay usuario en req', () => {
  const middleware = authorizeRoles(1, 2);
  const req = {};
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
  const next = () => {
    nextCalled = true;
  };

  middleware(req, res, next);

  assert.equal(statusCode, 401);
  assert.equal(jsonResponse.status, 'error');
  assert.equal(nextCalled, false);
});

test('authorizeRoles debe bloquear con 403 si el rol no está permitido', () => {
  const middleware = authorizeRoles(1, 2);
  const req = { user: { id: 'uuid-123', role_id: 4 } };
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
  const next = () => {
    nextCalled = true;
  };

  middleware(req, res, next);

  assert.equal(statusCode, 403);
  assert.equal(jsonResponse.status, 'error');
  assert.equal(nextCalled, false);
});

test('authorizeRoles debe llamar next() si el rol está permitido', () => {
  const middleware = authorizeRoles(1, 2);
  const req = { user: { id: 'uuid-123', role_id: 1 } };
  const res = {};
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  middleware(req, res, next);

  assert.equal(nextCalled, true);
});
