import test from 'node:test';
import assert from 'node:assert/strict';
import { registerUser } from '../src/controllers/authController.js';

test('registerUser debe exportarse como handler de registro', () => {
  assert.equal(typeof registerUser, 'function');
});
