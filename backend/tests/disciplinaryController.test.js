import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  createDisciplinaryAction,
  getEmployeeDisciplinaryActions,
  getMyDisciplinaryActions,
  VALID_DISCIPLINARY_TYPES,
  VALID_SEVERITIES,
} from '../src/controllers/disciplinaryController.js';

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

describe('Módulo de Legajo Digital y Sanciones (disciplinaryController)', () => {
  test('disciplinaryController debe exportar las funciones requeridas', () => {
    assert.equal(typeof createDisciplinaryAction, 'function');
    assert.equal(typeof getEmployeeDisciplinaryActions, 'function');
    assert.equal(typeof getMyDisciplinaryActions, 'function');
    assert.ok(Array.isArray(VALID_DISCIPLINARY_TYPES));
    assert.ok(Array.isArray(VALID_SEVERITIES));
  });

  describe('Registro de Medidas Disciplinarias (createDisciplinaryAction)', () => {
    test('debe retornar 403 si un usuario sin rol Admin ni RRHH intenta crear un registro', async () => {
      // Líder de Área (3)
      const reqLeader = {
        user: { id: 'leader-1', role_id: 3 },
        body: {
          user_id: 'emp-1',
          type: 'apercibimiento',
          incident_date: '2026-11-10',
          reason: 'Llegada tarde reiterada',
          description: 'Se presentaron reiteradas demoras sin justificativo.',
        },
      };
      const resLeader = createMockRes();
      await createDisciplinaryAction(reqLeader, resLeader);

      assert.equal(resLeader.statusCode, 403);
      assert.match(resLeader.body.message, /No tienes permisos/i);

      // Empleado (4)
      const reqEmp = {
        user: { id: 'emp-1', role_id: 4 },
        body: {
          user_id: 'emp-2',
          type: 'llamado_atencion',
          incident_date: '2026-11-10',
          reason: 'Falta menor',
          description: 'Sin justificar.',
        },
      };
      const resEmp = createMockRes();
      await createDisciplinaryAction(reqEmp, resEmp);

      assert.equal(resEmp.statusCode, 403);
      assert.match(resEmp.body.message, /No tienes permisos/i);
    });

    test('debe retornar 400 si faltan campos obligatorios', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
          // falta type, incident_date, reason, description
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Faltan campos obligatorios/i);
    });

    test('debe retornar 400 si el tipo de medida es inválido', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
          type: 'tipo_inexistente',
          incident_date: '2026-11-10',
          reason: 'Desobediencia',
          description: 'Incumplimiento de directivas de seguridad.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /tipo de medida disciplinaria es inválido/i);
    });

    test('debe retornar 400 si la severidad es inválida', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
          type: 'llamado_atencion',
          severity: 'extrema',
          incident_date: '2026-11-10',
          reason: 'Desobediencia',
          description: 'Incumplimiento de directivas de seguridad.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /severidad es inválida/i);
    });

    test('debe retornar 400 si el tipo es suspension y suspension_days no es mayor a 0', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
          type: 'suspension',
          severity: 'grave',
          incident_date: '2026-11-10',
          reason: 'Falta grave en planta',
          description: 'Manipulación inadecuada de tableros eléctricos.',
          suspension_days: 0,
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /los días de suspensión deben ser mayores a 0/i);
    });

    test('debe retornar 404 si el colaborador destinatario no existe', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'user-fantasma',
          type: 'llamado_atencion',
          incident_date: '2026-11-10',
          reason: 'Demora en reporte',
          description: 'Falta de entrega de planilla mensual.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /colaborador especificado no existe/i);
    });

    test('debe retornar 400 si el colaborador está inactivo o dado de baja', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'emp-baja',
                first_name: 'Juan',
                last_name: 'Pérez',
                role_id: 4,
                is_active: false,
                role_name: 'Empleado',
                role_level: 4,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-baja',
          type: 'llamado_atencion',
          incident_date: '2026-11-10',
          reason: 'Demora en reporte',
          description: 'Falta de entrega de planilla mensual.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /inactivo o dado de baja/i);
    });

    test('debe bloquear con 400 si un usuario intenta sancionarse a sí mismo', async () => {
      const req = {
        user: { id: 'hr-1', role_id: 2 },
        body: {
          user_id: 'hr-1',
          type: 'llamado_atencion',
          incident_date: '2026-11-10',
          reason: 'Auto amonestación',
          description: 'No permitido.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /No puedes registrar una sanción.*sobre ti mismo/i);
    });

    test('debe bloquear con 403 si Recursos Humanos (role_id 2) intenta sancionar a un Administrador (role_id 1)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'admin-target',
                first_name: 'Admin',
                last_name: 'Boss',
                role_id: 1,
                is_active: true,
                role_name: 'Administrador',
                role_level: 1,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles WHERE id = $1')) {
          return {
            rows: [{ id: 2, name: 'Recursos Humanos', level: 2 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'hr-1', role_id: 2 },
        body: {
          user_id: 'admin-target',
          type: 'llamado_atencion',
          incident_date: '2026-11-10',
          reason: 'Intento indebido',
          description: 'Sanción inválida.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Jerarquía insuficiente.*igual o mayor rango/i);
    });

    test('debe bloquear con 403 si Recursos Humanos (role_id 2) intenta sancionar a otro Recursos Humanos (role_id 2)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'hr-peer',
                first_name: 'Colega',
                last_name: 'RRHH',
                role_id: 2,
                is_active: true,
                role_name: 'Recursos Humanos',
                role_level: 2,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles WHERE id = $1')) {
          return {
            rows: [{ id: 2, name: 'Recursos Humanos', level: 2 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'hr-1', role_id: 2 },
        body: {
          user_id: 'hr-peer',
          type: 'apercibimiento',
          incident_date: '2026-11-10',
          reason: 'Falta entre pares',
          description: 'Sanción entre pares no permitida.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Jerarquía insuficiente.*igual o mayor rango/i);
    });

    test('debe bloquear con 403 si Administrador (role_id 1) intenta sancionar a otro Administrador (role_id 1)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'admin-peer',
                first_name: 'Admin',
                last_name: 'Dos',
                role_id: 1,
                is_active: true,
                role_name: 'Administrador',
                role_level: 1,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles WHERE id = $1')) {
          return {
            rows: [{ id: 1, name: 'Administrador', level: 1 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'admin-peer',
          type: 'llamado_atencion',
          incident_date: '2026-11-10',
          reason: 'Conflicto entre administradores',
          description: 'Sanción entre administradores no permitida.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Jerarquía insuficiente.*igual o mayor rango/i);
    });

    test('debe crear exitosamente (status 201) por Administrador (role_id 1), con notificación y auditoría', async () => {
      let insertExecuted = false;
      let notificationInserted = false;
      let auditLogged = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'emp-10',
                first_name: 'Carlos',
                last_name: 'Gómez',
                role_id: 4,
                is_active: true,
                role_name: 'Empleado',
                role_level: 4,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles WHERE id = $1')) {
          return {
            rows: [{ id: 1, name: 'Administrador', level: 1 }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO disciplinary_actions')) {
          insertExecuted = true;
          return {
            rows: [
              {
                id: 1,
                user_id: 'emp-10',
                issued_by: 'admin-1',
                type: 'suspension',
                severity: 'grave',
                incident_date: '2026-11-10',
                reason: 'Incumplimiento de normas de seguridad',
                description: 'Operación de maquinaria sin EPP reglamentario.',
                suspension_days: 3,
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO notifications')) {
          notificationInserted = true;
          assert.equal(values[0], 'emp-10'); // user_id destinatario
          assert.equal(values[1], 'admin-1'); // sender_id
          assert.equal(values[4], 'direct_message');
          return { rows: [], rowCount: 1 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          assert.equal(values[1], 'DISCIPLINARY_ACTION_CREATED');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-10',
          type: 'suspension',
          severity: 'grave',
          incident_date: '2026-11-10',
          reason: 'Incumplimiento de normas de seguridad',
          description: 'Operación de maquinaria sin EPP reglamentario.',
          suspension_days: 3,
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.ok(insertExecuted, 'Debe insertar en disciplinary_actions');
      assert.ok(notificationInserted, 'Debe generar notificación automática');
      assert.ok(auditLogged, 'Debe registrar evento de auditoría');
      assert.equal(res.body.data.disciplinary_action.suspension_days, 3);
    });

    test('debe crear exitosamente (status 201) por Administrador (role_id 1) sancionando a Recursos Humanos (role_id 2)', async () => {
      let insertExecuted = false;

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'hr-target',
                first_name: 'Paula',
                last_name: 'RRHH',
                role_id: 2,
                is_active: true,
                role_name: 'Recursos Humanos',
                role_level: 2,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles WHERE id = $1')) {
          return {
            rows: [{ id: 1, name: 'Administrador', level: 1 }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO disciplinary_actions')) {
          insertExecuted = true;
          return {
            rows: [
              {
                id: 3,
                user_id: 'hr-target',
                issued_by: 'admin-1',
                type: 'apercibimiento',
                severity: 'moderada',
                incident_date: '2026-11-10',
                reason: 'Incumplimiento de procedimientos',
                description: 'Falta en protocolo de contratación.',
                suspension_days: 0,
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && (sql.includes('INSERT INTO notifications') || sql.includes('INSERT INTO audit_logs'))) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'hr-target',
          type: 'apercibimiento',
          severity: 'moderada',
          incident_date: '2026-11-10',
          reason: 'Incumplimiento de procedimientos',
          description: 'Falta en protocolo de contratación.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.ok(insertExecuted);
    });

    test('debe crear exitosamente (status 201) por Recursos Humanos (role_id 2) sancionando a un Empleado (role_id 4)', async () => {
      let insertExecuted = false;

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'emp-20',
                first_name: 'María',
                last_name: 'Lopez',
                role_id: 4,
                is_active: true,
                role_name: 'Empleado',
                role_level: 4,
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles WHERE id = $1')) {
          return {
            rows: [{ id: 2, name: 'Recursos Humanos', level: 2 }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO disciplinary_actions')) {
          insertExecuted = true;
          return {
            rows: [
              {
                id: 2,
                user_id: 'emp-20',
                issued_by: 'hr-1',
                type: 'apercibimiento',
                severity: 'moderada',
                incident_date: '2026-11-09',
                reason: 'Ausencia injustificada',
                description: 'No concurrió a su turno de guardia sin previo aviso.',
                suspension_days: 0,
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && (sql.includes('INSERT INTO notifications') || sql.includes('INSERT INTO audit_logs'))) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'hr-1', role_id: 2 },
        body: {
          user_id: 'emp-20',
          type: 'apercibimiento',
          severity: 'moderada',
          incident_date: '2026-11-09',
          reason: 'Ausencia injustificada',
          description: 'No concurrió a su turno de guardia sin previo aviso.',
        },
      };
      const res = createMockRes();

      await createDisciplinaryAction(req, res);
      mock.reset();

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.status, 'success');
      assert.ok(insertExecuted);
      assert.equal(res.body.data.disciplinary_action.type, 'apercibimiento');
    });
  });

  describe('Consulta de Historial Disciplinario y Confidencialidad', () => {
    test('getEmployeeDisciplinaryActions: debe bloquear con 403 a un colaborador ajeno', async () => {
      const req = {
        params: { userId: 'target-employee-uuid' },
        user: { id: 'other-employee-uuid', role_id: 4 },
      };
      const res = createMockRes();

      await getEmployeeDisciplinaryActions(req, res);

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Acceso denegado/i);
    });

    test('getEmployeeDisciplinaryActions: debe bloquear con 403 a un Líder de Área (3) sobre terceros', async () => {
      const req = {
        params: { userId: 'target-employee-uuid' },
        user: { id: 'leader-uuid', role_id: 3 },
      };
      const res = createMockRes();

      await getEmployeeDisciplinaryActions(req, res);

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Acceso denegado/i);
    });

    test('getEmployeeDisciplinaryActions: debe retornar 200 cuando el empleado consulta su propio historial', async () => {
      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('FROM disciplinary_actions d')) {
          assert.equal(values[0], 'emp-own-uuid');
          return {
            rows: [
              {
                id: 1,
                user_id: 'emp-own-uuid',
                type: 'llamado_atencion',
                severity: 'leve',
                incident_date: '2026-11-01',
                reason: 'Demora técnica',
                description: 'Falta de entrega de reporte semanal.',
                issuer_first_name: 'Ana',
                issuer_last_name: 'Directora',
                issuer_role_name: 'Recursos Humanos',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { userId: 'emp-own-uuid' },
        user: { id: 'emp-own-uuid', role_id: 4 },
      };
      const res = createMockRes();

      await getEmployeeDisciplinaryActions(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.disciplinary_actions.length, 1);
    });

    test('getEmployeeDisciplinaryActions: debe retornar 200 a un Administrador (role_id 1)', async () => {
      mock.method(pool, 'query', async () => {
        return {
          rows: [
            {
              id: 1,
              user_id: 'emp-target',
              type: 'apercibimiento',
              severity: 'moderada',
              reason: 'Llegada tarde',
            },
          ],
          rowCount: 1,
        };
      });

      const req = {
        params: { userId: 'emp-target' },
        user: { id: 'admin-uuid', role_id: 1 },
      };
      const res = createMockRes();

      await getEmployeeDisciplinaryActions(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
    });

    test('getEmployeeDisciplinaryActions: debe retornar 200 a Recursos Humanos (role_id 2)', async () => {
      mock.method(pool, 'query', async () => {
        return {
          rows: [],
          rowCount: 0,
        };
      });

      const req = {
        params: { userId: 'emp-target' },
        user: { id: 'hr-uuid', role_id: 2 },
      };
      const res = createMockRes();

      await getEmployeeDisciplinaryActions(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
    });

    test('getMyDisciplinaryActions: debe retornar 200 con el historial del usuario en sesión', async () => {
      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('FROM disciplinary_actions d')) {
          assert.equal(values[0], 'session-user-id');
          return {
            rows: [
              {
                id: 5,
                user_id: 'session-user-id',
                type: 'llamado_atencion',
                severity: 'leve',
                incident_date: '2026-10-15',
                reason: 'Registro de turno omitido',
                description: 'Se omitió fichaje de ingreso.',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'session-user-id', role_id: 4 },
      };
      const res = createMockRes();

      await getMyDisciplinaryActions(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.equal(res.body.data.disciplinary_actions.length, 1);
    });
  });
});
