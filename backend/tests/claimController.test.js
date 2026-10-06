import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { resolveClaim } from '../src/controllers/claimController.js';

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

describe('Módulo de Reclamos (resolveClaim)', () => {
  test('resolveClaim debe exportarse como función', () => {
    assert.equal(typeof resolveClaim, 'function');
  });

  test('debe retornar 400 si el estado enviado no es válido', async () => {
    const req = {
      params: { id: '1' },
      body: { status: 'invalid_status' },
      user: { id: 2 },
    };
    const res = createMockRes();

    await resolveClaim(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /El estado es inválido/i);
  });

  test('debe retornar 400 si las notas superan los 500 caracteres', async () => {
    const longNotes = 'a'.repeat(501);
    const req = {
      params: { id: '1' },
      body: { status: 'approved', resolution_notes: longNotes },
      user: { id: 2 },
    };
    const res = createMockRes();

    await resolveClaim(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /500 caracteres/i);
  });

  test('debe retornar 400 si req.body.notes supera los 500 caracteres', async () => {
    const longNotes = 'x'.repeat(501);
    const req = {
      params: { id: '1' },
      body: { status: 'rejected', notes: longNotes },
      user: { id: 2 },
    };
    const res = createMockRes();

    await resolveClaim(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'error');
    assert.match(res.body.message, /500 caracteres/i);
  });

  test('debe retornar 404 si el reclamo no existe', async () => {
    const mockQuery = mock.method(pool, 'query', async () => ({
      rowCount: 0,
      rows: [],
    }));

    try {
      const req = {
        params: { id: '9999' },
        body: { status: 'approved', resolution_notes: 'Ok' },
        user: { id: 2 },
        headers: {},
      };
      const res = createMockRes();

      await resolveClaim(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.message, 'Reclamo no encontrado.');
    } finally {
      mockQuery.mock.restore();
    }
  });

  test('debe retornar 403 con mensaje de cierre si el reclamo ya está aprobado (approved)', async () => {
    const mockQuery = mock.method(pool, 'query', async (sql) => {
      if (sql.includes('SELECT')) {
        return {
          rowCount: 1,
          rows: [{ id: 1, title: 'Reclamo Prueba', status: 'approved', filed_by_id: 5 }],
        };
      }
      return { rowCount: 1, rows: [] };
    });

    try {
      const req = {
        params: { id: '1' },
        body: { status: 'rejected', resolution_notes: 'Cambio de opinión' },
        user: { id: 2 },
        headers: {},
      };
      const res = createMockRes();

      await resolveClaim(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.message, 'El reclamo ya ha sido cerrado y no puede ser modificado.');
    } finally {
      mockQuery.mock.restore();
    }
  });

  test('debe retornar 403 con mensaje de cierre si el reclamo ya está rechazado (rejected)', async () => {
    const mockQuery = mock.method(pool, 'query', async (sql) => {
      if (sql.includes('SELECT')) {
        return {
          rowCount: 1,
          rows: [{ id: 2, title: 'Reclamo Prueba 2', status: 'rejected', filed_by_id: 5 }],
        };
      }
      return { rowCount: 1, rows: [] };
    });

    try {
      const req = {
        params: { id: '2' },
        body: { status: 'approved', resolution_notes: 'Reaprobación' },
        user: { id: 2 },
        headers: {},
      };
      const res = createMockRes();

      await resolveClaim(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.message, 'El reclamo ya ha sido cerrado y no puede ser modificado.');
    } finally {
      mockQuery.mock.restore();
    }
  });

  test('debe actualizar exitosamente si el reclamo está en pending o in_progress', async () => {
    const mockQuery = mock.method(pool, 'query', async (sql) => {
      if (sql.includes('SELECT')) {
        return {
          rowCount: 1,
          rows: [{ id: 3, title: 'Reclamo Pendiente', status: 'pending', filed_by_id: 5 }],
        };
      }
      if (sql.includes('UPDATE')) {
        return {
          rowCount: 1,
          rows: [{
            id: 3,
            title: 'Reclamo Pendiente',
            status: 'approved',
            resolution_notes: 'Aprobado correctamente',
            resolved_at: new Date(),
            assigned_to_id: 2,
          }],
        };
      }
      // notification / audit
      return { rowCount: 1, rows: [] };
    });

    try {
      const req = {
        params: { id: '3' },
        body: { status: 'approved', resolution_notes: 'Aprobado correctamente' },
        user: { id: 2 },
        headers: {},
      };
      const res = createMockRes();

      await resolveClaim(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.claim.status, 'approved');
    } finally {
      mockQuery.mock.restore();
    }
  });
});
