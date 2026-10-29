import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
} from '../src/controllers/requestController.js';

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

describe('Módulo de Solicitudes (requestController)', () => {
  test('requestController debe exportar las funciones requeridas', () => {
    assert.equal(typeof createRequest, 'function');
    assert.equal(typeof getMyRequests, 'function');
    assert.equal(typeof getAllRequests, 'function');
    assert.equal(typeof updateRequestStatus, 'function');
  });

  describe('Creación de Solicitudes (createRequest)', () => {
    test('debe retornar 400 si faltan campos obligatorios', async () => {
      const req = {
        user: { id: 'user-uuid-1' },
        body: { type: 'indumentaria' }, // falta title y description
      };
      const res = createMockRes();

      await createRequest(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /Faltan campos requeridos/i);
    });

    test('debe retornar 400 si el tipo de solicitud no es válido', async () => {
      const req = {
        user: { id: 'user-uuid-1' },
        body: {
          type: 'tipo_inexistente',
          title: 'Pedido de botas',
          description: 'Talle 42',
        },
      };
      const res = createMockRes();

      await createRequest(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /tipo de solicitud es inválido/i);
    });

    test('debe retornar 400 si el título supera los 150 caracteres', async () => {
      const req = {
        user: { id: 'user-uuid-1' },
        body: {
          type: 'materiales',
          title: 'A'.repeat(151),
          description: 'Hojas y lapiceras',
        },
      };
      const res = createMockRes();

      await createRequest(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /no puede superar los 150 caracteres/i);
    });

    test('debe crear la solicitud con éxito (status 201) y registrar auditoría', async () => {
      let insertExecuted = false;
      let auditLogged = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO requests')) {
          insertExecuted = true;
          return {
            rows: [
              {
                id: 10,
                user_id: 'user-uuid-1',
                type: 'indumentaria',
                title: 'Campera de seguridad',
                description: 'Talle L para trabajo en depósito',
                status: 'pending',
                resolution_notes: null,
                resolved_by: null,
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          assert.equal(values[1], 'REQUEST_CREATED');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'user-uuid-1' },
        body: {
          type: 'indumentaria',
          title: 'Campera de seguridad',
          description: 'Talle L para trabajo en depósito',
        },
      };
      const res = createMockRes();

      await createRequest(req, res);

      mock.reset();

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.ok(insertExecuted, 'Debe ejecutar la inserción en requests');
      assert.ok(auditLogged, 'Debe registrar evento REQUEST_CREATED');
      assert.equal(res.body.data.request.status, 'pending');
    });
  });

  describe('Consulta de Solicitudes (getMyRequests & getAllRequests)', () => {
    test('getMyRequests debe retornar las solicitudes del usuario', async () => {
      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('WHERE r.user_id = $1')) {
          assert.equal(values[0], 'user-uuid-1');
          return {
            rows: [
              {
                id: 1,
                title: 'Licencia por estudio',
                type: 'licencia',
                status: 'pending',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = { user: { id: 'user-uuid-1' } };
      const res = createMockRes();

      await getMyRequests(req, res);

      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.results, 1);
      assert.equal(res.body.data.requests[0].type, 'licencia');
    });

    test('getAllRequests debe permitir filtrar por estado o tipo', async () => {
      mock.method(pool, 'query', async (sql, values) => {
        return {
          rows: [
            { id: 1, title: 'Pedido de laptop', status: 'approved' },
            { id: 2, title: 'Licencia médica', status: 'approved' },
          ],
          rowCount: 2,
        };
      });

      const req = { query: { status: 'approved' } };
      const res = createMockRes();

      await getAllRequests(req, res);

      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.results, 2);
    });
  });

  describe('Resolución de Solicitudes (updateRequestStatus)', () => {
    test('debe retornar 400 si el estado no es approved ni rejected', async () => {
      const req = {
        params: { id: '1' },
        user: { id: 'admin-1' },
        body: { status: 'in_progress' },
      };
      const res = createMockRes();

      await updateRequestStatus(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /El estado es inválido/i);
    });

    test('debe retornar 400 si las notas de resolución superan los 500 caracteres', async () => {
      const req = {
        params: { id: '1' },
        user: { id: 'admin-1' },
        body: {
          status: 'approved',
          resolution_notes: 'X'.repeat(501),
        },
      };
      const res = createMockRes();

      await updateRequestStatus(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /no pueden superar los 500 caracteres/i);
    });

    test('debe retornar 404 si la solicitud no existe', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, user_id, title, status FROM requests')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '9999' },
        user: { id: 'admin-1' },
        body: { status: 'approved' },
      };
      const res = createMockRes();

      await updateRequestStatus(req, res);

      mock.reset();

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /Solicitud no encontrada/i);
    });

    test('debe retornar 403 si la solicitud ya está aprobada o rechazada (inmutable)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, user_id, title, status FROM requests')) {
          return {
            rows: [
              {
                id: 5,
                user_id: 'emp-1',
                title: 'Casco de obra',
                status: 'approved',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '5' },
        user: { id: 'admin-1' },
        body: { status: 'rejected' },
      };
      const res = createMockRes();

      await updateRequestStatus(req, res);

      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /ya ha sido resuelta y no puede ser modificada/i);
    });

    test('debe actualizar a approved o rejected con éxito (status 200), notificar y registrar auditoría', async () => {
      let updateExecuted = false;
      let notificationInserted = false;
      let auditLogged = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, user_id, title, status FROM requests')) {
          return {
            rows: [
              {
                id: 7,
                user_id: 'emp-123',
                title: 'Kit de destornilladores',
                status: 'pending',
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE requests')) {
          updateExecuted = true;
          return {
            rows: [
              {
                id: 7,
                user_id: 'emp-123',
                type: 'herramientas',
                title: 'Kit de destornilladores',
                status: 'approved',
                resolution_notes: 'Aprobado para retirar en almacén central',
                resolved_by: 'admin-1',
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO notifications')) {
          notificationInserted = true;
          return { rows: [], rowCount: 1 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          assert.equal(values[1], 'REQUEST_RESOLVED');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '7' },
        user: { id: 'admin-1' },
        body: {
          status: 'approved',
          resolution_notes: 'Aprobado para retirar en almacén central',
        },
      };
      const res = createMockRes();

      await updateRequestStatus(req, res);

      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(updateExecuted, 'Debe actualizar el registro en la BD');
      assert.ok(notificationInserted, 'Debe enviar notificación al empleado');
      assert.ok(auditLogged, 'Debe registrar evento REQUEST_RESOLVED');
      assert.equal(res.body.data.request.status, 'approved');
    });
  });
});
