import test from 'node:test';
import assert from 'node:assert/strict';
import { loginUser } from '../src/controllers/loginController.js';

test('loginUser debe exportarse como handler de login', () => {
  assert.equal(typeof loginUser, 'function');
});
