import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  sendAnnouncement,
} from '../src/controllers/notificationController.js';
import { authorizeRoles } from '../src/middlewares/roleMiddleware.js';

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

describe('Módulo de Notificaciones y Comunicados (notificationController)', () => {
  test('notificationController debe exportar las funciones requeridas', () => {
    assert.equal(typeof getMyNotifications, 'function');
    assert.equal(typeof markAsRead, 'function');
    assert.equal(typeof markAllAsRead, 'function');
    assert.equal(typeof sendAnnouncement, 'function');
  });

  describe('Control estricto de roles en sendAnnouncement (Defensivo)', () => {
    test('Líder de Área (role_id: 3) debe ser bloqueado con HTTP 403', async () => {
      const req = {
        user: { id: 'lider-uuid-1', role_id: 3 },
        body: {
          title: 'Comunicado de Equipo',
          message: 'Mensaje para todos',
          targetType: 'all',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.message, 'No tienes permisos para emitir comunicados o notificaciones.');
    });

    test('Empleado Regular (role_id: 4) debe ser bloqueado con HTTP 403', async () => {
      const req = {
        user: { id: 'emp-uuid-1', role_id: 4 },
        body: {
          title: 'Aviso',
          message: 'Mensaje general',
          targetType: 'all',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.message, 'No tienes permisos para emitir comunicados o notificaciones.');
    });

    test('Usuario sin rol o no autenticado debe ser bloqueado con HTTP 403', async () => {
      const req = {
        user: { id: 'anon-uuid-1' },
        body: {
          title: 'Aviso',
          message: 'Mensaje general',
          targetType: 'all',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.message, 'No tienes permisos para emitir comunicados o notificaciones.');
    });
  });

  describe('Validaciones de entrada (sendAnnouncement)', () => {
    test('debe retornar 400 si faltan campos obligatorios', async () => {
      const req = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: { title: 'Aviso importante' }, // falta message y targetType
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /Faltan campos requeridos/i);
    });

    test('debe retornar 400 si el título o mensaje están vacíos tras trim', async () => {
      const req = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: '   ',
          message: 'Mensaje de prueba',
          targetType: 'all',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /no pueden estar vacíos/i);
    });

    test('debe retornar 400 si el título supera los 150 caracteres', async () => {
      const req = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: 'T'.repeat(151),
          message: 'Cuerpo del comunicado',
          targetType: 'all',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /no puede superar los 150 caracteres/i);
    });

    test('debe retornar 400 si el mensaje supera los 1000 caracteres', async () => {
      const req = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: 'Aviso General',
          message: 'M'.repeat(1001),
          targetType: 'all',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /no puede superar los 1000 caracteres/i);
    });

    test('debe retornar 400 si el tipo de destino targetType es inválido', async () => {
      const req = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: 'Aviso General',
          message: 'Cuerpo del comunicado',
          targetType: 'invalid_type',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /targetType.*debe ser 'all', 'department' o 'user'/i);
    });

    test('debe retornar 400 si targetType es department o user y falta targetId', async () => {
      const reqDept = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: 'Reunión de Área',
          message: 'Presentación trimestral',
          targetType: 'department',
          targetId: '   ',
        },
      };
      const resDept = createMockRes();
      await sendAnnouncement(reqDept, resDept);

      assert.equal(resDept.statusCode, 400);
      assert.equal(resDept.body.status, 'error');
      assert.match(resDept.body.message, /especificar un 'targetId' válido/i);

      const reqUser = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: 'Mensaje Directo',
          message: 'Recordatorio de documentación',
          targetType: 'user',
          targetId: '',
        },
      };
      const resUser = createMockRes();
      await sendAnnouncement(reqUser, resUser);

      assert.equal(resUser.statusCode, 400);
      assert.equal(resUser.body.status, 'error');
    });
  });

  describe('Envío de Comunicados por Roles Autorizados (HTTP 201)', () => {
    test('Administrador (role_id: 1): Puede emitir comunicado masivo (all) con HTTP 201', async () => {
      let insertExecuted = false;
      let auditLogged = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('SELECT id FROM users WHERE is_active = true')) {
          return {
            rows: [
              { id: 'user-uuid-1' },
              { id: 'user-uuid-2' },
              { id: 'user-uuid-3' },
            ],
            rowCount: 3,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO notifications')) {
          insertExecuted = true;
          assert.equal(values[0], 'Feriado Institucional');
          assert.equal(values[1], 'El próximo lunes la empresa permanecerá cerrada.');
          assert.equal(values[2], 'announcement');
          assert.equal(values[3], 'admin-uuid-1');
          return { rows: [], rowCount: 3 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          assert.equal(values[1], 'ANNOUNCEMENT_SENT');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: 'Feriado Institucional',
          message: 'El próximo lunes la empresa permanecerá cerrada.',
          targetType: 'all',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.recipientsCount, 3);
      assert.equal(insertExecuted, true);
      assert.equal(auditLogged, true);
    });

    test('Recursos Humanos (role_id: 2): Puede emitir comunicado por departamento (department) con HTTP 201', async () => {
      let queryByDept = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('department ILIKE $1')) {
          queryByDept = true;
          assert.equal(values[0], 'Operaciones');
          return {
            rows: [{ id: 'user-uuid-1' }, { id: 'user-uuid-2' }],
            rowCount: 2,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO notifications')) {
          assert.equal(values[3], 'rrhh-uuid-2');
          return { rows: [], rowCount: 2 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'rrhh-uuid-2', role_id: 2 },
        body: {
          title: 'Protocolo de Depósito',
          message: 'Actualización en el manejo de cargas y stocks.',
          targetType: 'department',
          targetId: 'Operaciones',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.recipientsCount, 2);
      assert.equal(queryByDept, true);
    });

    test('Recursos Humanos (role_id: 2): Puede emitir mensaje individual (user) con HTTP 201', async () => {
      let queryByUser = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('is_active = true AND id = $1')) {
          queryByUser = true;
          assert.equal(values[0], 'colab-uuid-77');
          return {
            rows: [{ id: 'colab-uuid-77' }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO notifications')) {
          assert.equal(values[2], 'direct_message');
          assert.equal(values[3], 'rrhh-uuid-2');
          return { rows: [], rowCount: 1 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'rrhh-uuid-2', role_id: 2 },
        body: {
          title: 'Recordatorio de Firma',
          message: 'Por favor acércate a RRHH para firmar el recibo.',
          targetType: 'user',
          targetId: 'colab-uuid-77',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.recipientsCount, 1);
      assert.equal(queryByUser, true);
    });

    test('debe responder 404 si el colaborador destinatario no existe o está inactivo', async () => {
      mock.method(pool, 'query', async () => {
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-uuid-1', role_id: 1 },
        body: {
          title: 'Notificación',
          message: 'Mensaje de prueba',
          targetType: 'user',
          targetId: 'uuid-no-existente',
        },
      };
      const res = createMockRes();

      await sendAnnouncement(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /no existe o no se encuentra activo/i);
    });
  });

  describe('Control de Acceso por Middleware (authorizeRoles(1, 2))', () => {
    test('Administrador (role_id: 1) debe tener acceso permitido', () => {
      const middleware = authorizeRoles(1, 2);
      let nextCalled = false;
      const req = { user: { id: 'admin-1', role_id: 1 } };
      const res = createMockRes();

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, null);
    });

    test('Recursos Humanos (role_id: 2) debe tener acceso permitido', () => {
      const middleware = authorizeRoles(1, 2);
      let nextCalled = false;
      const req = { user: { id: 'rrhh-1', role_id: 2 } };
      const res = createMockRes();

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, null);
    });

    test('Líder de Área (role_id: 3) debe ser bloqueado con HTTP 403', () => {
      const middleware = authorizeRoles(1, 2);
      let nextCalled = false;
      const req = { user: { id: 'lider-1', role_id: 3 } };
      const res = createMockRes();

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /permisos necesarios/i);
    });

    test('Empleado (role_id: 4) debe ser bloqueado con HTTP 403', () => {
      const middleware = authorizeRoles(1, 2);
      let nextCalled = false;
      const req = { user: { id: 'empleado-1', role_id: 4 } };
      const res = createMockRes();

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.status, 'error');
      assert.match(res.body.message, /permisos necesarios/i);
    });
  });

  describe('Lectura y Gestión de Notificaciones (getMyNotifications & markAllAsRead)', () => {
    test('getMyNotifications debe devolver las notificaciones con datos del remitente', async () => {
      mock.method(pool, 'query', async () => {
        return {
          rows: [
            {
              id: 'notif-1',
              title: 'Comunicado General',
              message: 'Texto del comunicado',
              type: 'announcement',
              is_read: false,
              created_at: new Date(),
              sender_id: 'admin-1',
              sender_name: 'Admin General',
            },
          ],
          rowCount: 1,
        };
      });

      const req = { user: { id: 'user-1' } };
      const res = createMockRes();

      await getMyNotifications(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.notifications.length, 1);
      assert.equal(res.body.data.notifications[0].sender_name, 'Admin General');
    });

    test('markAllAsRead debe marcar todas las notificaciones pendientes con status 200', async () => {
      mock.method(pool, 'query', async () => {
        return {
          rows: [{ id: 'notif-1' }, { id: 'notif-2' }],
          rowCount: 2,
        };
      });

      const req = { user: { id: 'user-1' } };
      const res = createMockRes();

      await markAllAsRead(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.updatedCount, 2);
    });
  });
});
