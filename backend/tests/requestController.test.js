import test, { describe, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pool from '../src/config/db.js';
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
  downloadRequestAttachment,
} from '../src/controllers/requestController.js';

const createMockRes = () => {
  return {
    statusCode: null,
    body: null,
    headers: {},
    sentFile: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, val) {
      this.headers[name] = val;
      return this;
    },
    sendFile(filePath) {
      this.sentFile = filePath;
      this.statusCode = this.statusCode || 200;
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
    assert.equal(typeof downloadRequestAttachment, 'function');
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

    test('debe crear la solicitud con archivo adjunto y guardar sus metadatos', async () => {
      let insertExecuted = false;
      let insertedValues = null;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO requests')) {
          insertExecuted = true;
          insertedValues = values;
          return {
            rows: [
              {
                id: 11,
                user_id: 'user-uuid-1',
                type: 'materiales',
                title: 'Gasto de papelería técnica',
                description: 'Factura de compra de insumos de librería técnica',
                attachment_name: 'factura_libreria.pdf',
                attachment_mime: 'application/pdf',
                status: 'pending',
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'user-uuid-1' },
        body: {
          type: 'materiales',
          title: 'Gasto de papelería técnica',
          description: 'Factura de compra de insumos de librería técnica',
        },
        file: {
          originalname: 'factura_libreria.pdf',
          filename: 'cf35d1f8-8bb3-4e45-8bb3-3f1444d18ec2.pdf',
          mimetype: 'application/pdf',
          size: 102400,
        },
      };
      const res = createMockRes();

      await createRequest(req, res);

      mock.reset();

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.ok(insertExecuted, 'Debe ejecutar la inserción en requests');
      assert.equal(insertedValues[4], 'factura_libreria.pdf');
      assert.equal(insertedValues[5], 'cf35d1f8-8bb3-4e45-8bb3-3f1444d18ec2.pdf');
      assert.equal(insertedValues[6], 'application/pdf');
      assert.equal(res.body.data.request.attachment_name, 'factura_libreria.pdf');
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
      assert.match(res.body.message, /no existe|solicitud no encontrada/i);
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
      assert.match(res.body.message, /no puede modificarse nuevamente|ya ha sido resuelta/i);
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
          assert.ok(
            ['REQUEST_STATUS_UPDATED', 'REQUEST_RESOLVED'].includes(values[1]),
            `Acción inesperada: ${values[1]}`
          );
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
      assert.ok(auditLogged, 'Debe registrar evento de auditoría');
      assert.equal(res.body.data.request.status, 'approved');
    });
  });

  describe('Descarga de Archivos Adjuntos (downloadRequestAttachment)', () => {
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'requests');
    const testFileName = 'unit-test-attachment.pdf';
    const testFilePath = path.join(uploadDir, testFileName);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(testFilePath, 'dummy pdf binary data for testing');

    after(() => {
      if (fs.existsSync(testFilePath)) {
        try {
          fs.unlinkSync(testFilePath);
        } catch {
          // ignore
        }
      }
    });

    test('debe retornar 404 si la solicitud no existe', async () => {
      mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));

      const req = {
        params: { id: '9999' },
        user: { id: 'emp-1', role_id: 4 },
      };
      const res = createMockRes();

      await downloadRequestAttachment(req, res);
      mock.reset();

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /no encontrada/i);
    });

    test('debe retornar 404 si la solicitud no cuenta con archivo adjunto', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [{ id: 10, user_id: 'emp-1', attachment_name: null, attachment_path: null }],
        rowCount: 1,
      }));

      const req = {
        params: { id: '10' },
        user: { id: 'emp-1', role_id: 4 },
      };
      const res = createMockRes();

      await downloadRequestAttachment(req, res);
      mock.reset();

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /no cuenta con ningún archivo/i);
    });

    test('debe retornar 403 si un usuario ajeno sin rol Admin ni RRHH intenta descargar el archivo', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            id: 10,
            user_id: 'owner-uuid',
            title: 'Solicitud confidencial',
            attachment_name: testFileName,
            attachment_path: testFileName,
            attachment_mime: 'application/pdf',
          },
        ],
        rowCount: 1,
      }));

      // Usuario ajeno con rol Empleado (4) o Líder de Área (3)
      const req = {
        params: { id: '10' },
        user: { id: 'other-user-uuid', role_id: 4 },
      };
      const res = createMockRes();

      await downloadRequestAttachment(req, res);
      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /No tienes permisos/i);
    });

    test('debe retornar 404 si el archivo adjunto físico no existe en disco', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            id: 10,
            user_id: 'owner-uuid',
            attachment_name: 'archivo_fantasma.pdf',
            attachment_path: 'archivo_fantasma_no_existe.pdf',
            attachment_mime: 'application/pdf',
          },
        ],
        rowCount: 1,
      }));

      const req = {
        params: { id: '10' },
        user: { id: 'owner-uuid', role_id: 4 },
      };
      const res = createMockRes();

      await downloadRequestAttachment(req, res);
      mock.reset();

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /no se encuentra disponible en el servidor/i);
    });

    test('debe permitir la descarga (status 200) al dueño de la solicitud', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            id: 10,
            user_id: 'owner-uuid',
            attachment_name: 'recibo.pdf',
            attachment_path: testFileName,
            attachment_mime: 'application/pdf',
          },
        ],
        rowCount: 1,
      }));

      const req = {
        params: { id: '10' },
        user: { id: 'owner-uuid', role_id: 4 },
      };
      const res = createMockRes();

      await downloadRequestAttachment(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(res.sentFile);
      assert.equal(res.headers['Content-Type'], 'application/pdf');
    });

    test('debe permitir la descarga (status 200) a un Administrador (role_id 1)', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            id: 10,
            user_id: 'owner-uuid',
            attachment_name: 'recibo.pdf',
            attachment_path: testFileName,
            attachment_mime: 'application/pdf',
          },
        ],
        rowCount: 1,
      }));

      const req = {
        params: { id: '10' },
        user: { id: 'admin-uuid', role_id: 1 },
      };
      const res = createMockRes();

      await downloadRequestAttachment(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(res.sentFile);
    });

    test('debe permitir la descarga (status 200) a Recursos Humanos (role_id 2)', async () => {
      mock.method(pool, 'query', async () => ({
        rows: [
          {
            id: 10,
            user_id: 'owner-uuid',
            attachment_name: 'recibo.pdf',
            attachment_path: testFileName,
            attachment_mime: 'application/pdf',
          },
        ],
        rowCount: 1,
      }));

      const req = {
        params: { id: '10' },
        user: { id: 'hr-uuid', role_id: 2 },
      };
      const res = createMockRes();

      await downloadRequestAttachment(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(res.sentFile);
    });
  });
});
