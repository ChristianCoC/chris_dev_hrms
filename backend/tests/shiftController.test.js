import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  upsertShift,
  getShifts,
  deleteShift,
  VALID_SHIFT_TYPES,
  getDefaultWeekRange,
} from '../src/controllers/shiftController.js';

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

describe('Módulo de Horarios y Turnos (shiftController)', () => {
  test('shiftController debe exportar las funciones requeridas', () => {
    assert.equal(typeof upsertShift, 'function');
    assert.equal(typeof getShifts, 'function');
    assert.equal(typeof deleteShift, 'function');
    assert.ok(Array.isArray(VALID_SHIFT_TYPES));
    assert.equal(typeof getDefaultWeekRange, 'function');
  });

  describe('Asignación y Actualización de Turnos (upsertShift)', () => {
    test('debe retornar 403 si un usuario sin rol de planificación (como Empleado rol 4) intenta asignar un turno', async () => {
      // Empleado (4)
      const reqEmp = {
        user: { id: 'emp-1', role_id: 4 },
        body: {
          user_id: 'emp-1',
          shift_date: '2026-11-16',
          shift_type: 'trabajo',
          start_time: '08:00',
          end_time: '16:00',
        },
      };
      const resEmp = createMockRes();
      await upsertShift(reqEmp, resEmp);

      assert.equal(resEmp.statusCode, 403);
      assert.match(resEmp.body.message, /No tienes permisos/i);

      // Rol desconocido (5)
      const reqUnknown = {
        user: { id: 'unknown-1', role_id: 5 },
        body: {
          user_id: 'emp-2',
          shift_date: '2026-11-16',
          shift_type: 'franco',
        },
      };
      const resUnknown = createMockRes();
      await upsertShift(reqUnknown, resUnknown);

      assert.equal(resUnknown.statusCode, 403);
      assert.match(resUnknown.body.message, /No tienes permisos/i);
    });

    test('debe retornar 400 si faltan campos obligatorios', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
        },
      };
      const res = createMockRes();

      await upsertShift(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Faltan campos obligatorios/i);
    });

    test('debe retornar 400 si el tipo de turno es inválido', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
          shift_date: '2026-11-16',
          shift_type: 'tipo_invalido',
        },
      };
      const res = createMockRes();

      await upsertShift(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /tipo de turno es inválido/i);
    });

    test('debe retornar 400 si shift_type es trabajo y faltan horarios de inicio o fin', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
          shift_date: '2026-11-16',
          shift_type: 'trabajo',
          start_time: '08:00',
        },
      };
      const res = createMockRes();

      await upsertShift(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /horarios de inicio y fin son obligatorios/i);
    });

    test('debe retornar 400 si la hora de inicio y fin son idénticas', async () => {
      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-1',
          shift_date: '2026-11-16',
          shift_type: 'trabajo',
          start_time: '08:00',
          end_time: '08:00',
        },
      };
      const res = createMockRes();

      await upsertShift(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /no pueden ser idénticos/i);
    });

    test('debe retornar 404 si el colaborador especificado no existe', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-inexistente',
          shift_date: '2026-11-16',
          shift_type: 'trabajo',
          start_time: '08:00',
          end_time: '16:00',
        },
      };
      const res = createMockRes();

      await upsertShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /colaborador especificado no existe/i);
    });

    test('debe retornar 400 si el colaborador está inactivo o dado de baja', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [{ id: 'emp-baja', first_name: 'Ana', last_name: 'Pérez', role_id: 4, is_active: false }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'emp-baja',
          shift_date: '2026-11-16',
          shift_type: 'trabajo',
          start_time: '08:00',
          end_time: '16:00',
        },
      };
      const res = createMockRes();

      await upsertShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /inactivo o dado de baja/i);
    });

    test('Administrador (1) puede asignarse su propio turno exitosamente (HTTP 200)', async () => {
      let upsertExecuted = false;

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [{ id: 'admin-1', first_name: 'Admin', last_name: 'Principal', role_id: 1, is_active: true }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO work_shifts')) {
          upsertExecuted = true;
          return {
            rows: [
              {
                id: 1,
                user_id: 'admin-1',
                shift_date: '2026-11-16',
                shift_type: 'trabajo',
                start_time: '08:00',
                end_time: '16:00',
                location: 'Sede Central',
                notes: 'Horario propio',
                assigned_by: 'admin-1',
                created_at: new Date(),
                updated_at: new Date(),
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
        user: { id: 'admin-1', role_id: 1 },
        body: {
          user_id: 'admin-1',
          shift_date: '2026-11-16',
          shift_type: 'trabajo',
          start_time: '08:00',
          end_time: '16:00',
          location: 'Sede Central',
        },
      };
      const res = createMockRes();

      await upsertShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(upsertExecuted);
    });

    describe('Seguridad Jerárquica para Recursos Humanos (role_id: 2)', () => {
      test('RRHH (2) recibe 403 al intentar auto-asignarse su propio horario', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'hr-1', first_name: 'Valeria', last_name: 'Ríos', role_id: 2, is_active: true }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        });

        const req = {
          user: { id: 'hr-1', role_id: 2 },
          body: {
            user_id: 'hr-1',
            shift_date: '2026-11-16',
            shift_type: 'trabajo',
            start_time: '09:00',
            end_time: '18:00',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 403);
        assert.match(res.body.message, /no pueden gestionar su propio horario/i);
      });

      test('RRHH (2) recibe 403 al intentar asignar turnos a un Administrador (role_id: 1)', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'admin-user', first_name: 'Super', last_name: 'Admin', role_id: 1, is_active: true }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        });

        const req = {
          user: { id: 'hr-1', role_id: 2 },
          body: {
            user_id: 'admin-user',
            shift_date: '2026-11-16',
            shift_type: 'trabajo',
            start_time: '08:00',
            end_time: '16:00',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 403);
        assert.match(res.body.message, /rango igual o superior/i);
      });

      test('RRHH (2) recibe 403 al intentar asignar turnos a otro colaborador de RRHH (role_id: 2)', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'hr-2', first_name: 'Esteban', last_name: 'Paz', role_id: 2, is_active: true }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        });

        const req = {
          user: { id: 'hr-1', role_id: 2 },
          body: {
            user_id: 'hr-2',
            shift_date: '2026-11-16',
            shift_type: 'trabajo',
            start_time: '08:00',
            end_time: '16:00',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 403);
        assert.match(res.body.message, /rango igual o superior/i);
      });

      test('RRHH (2) puede asignar exitosamente turnos a un Líder de Área (role_id: 3) y Empleado (role_id: 4)', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'leader-1', first_name: 'Líder', last_name: 'Ventas', role_id: 3, is_active: true }],
              rowCount: 1,
            };
          }
          if (typeof sql === 'string' && sql.includes('INSERT INTO work_shifts')) {
            return {
              rows: [
                {
                  id: 15,
                  user_id: 'leader-1',
                  shift_date: '2026-11-16',
                  shift_type: 'licencia',
                  start_time: null,
                  end_time: null,
                  assigned_by: 'hr-1',
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
          user: { id: 'hr-1', role_id: 2 },
          body: {
            user_id: 'leader-1',
            shift_date: '2026-11-16',
            shift_type: 'licencia',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.status, 'success');
      });
    });

    describe('Seguridad Jerárquica para Líder de Área (role_id: 3)', () => {
      test('Líder (3) recibe 403 al intentar auto-asignarse su propio horario', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'leader-1', first_name: 'Líder', last_name: 'Tech', role_id: 3, is_active: true }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        });

        const req = {
          user: { id: 'leader-1', role_id: 3 },
          body: {
            user_id: 'leader-1',
            shift_date: '2026-11-16',
            shift_type: 'trabajo',
            start_time: '08:00',
            end_time: '16:00',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 403);
        assert.match(res.body.message, /no pueden gestionar su propio horario/i);
      });

      test('Líder (3) recibe 403 al intentar asignar turnos a otro Líder (3) o RRHH (2)', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'other-leader', first_name: 'Líder', last_name: 'Ops', role_id: 3, is_active: true }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        });

        const req = {
          user: { id: 'leader-1', role_id: 3 },
          body: {
            user_id: 'other-leader',
            shift_date: '2026-11-16',
            shift_type: 'trabajo',
            start_time: '08:00',
            end_time: '16:00',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 403);
        assert.match(res.body.message, /solo pueden gestionar turnos de colaboradores con rol Empleado/i);
      });

      test('Líder (3) puede asignar trabajo y franco a un Empleado (role_id: 4) con HTTP 200', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'emp-team-1', first_name: 'Pedro', last_name: 'Paz', role_id: 4, is_active: true }],
              rowCount: 1,
            };
          }
          if (typeof sql === 'string' && sql.includes('SELECT id, shift_type FROM work_shifts')) {
            return { rows: [], rowCount: 0 };
          }
          if (typeof sql === 'string' && sql.includes('INSERT INTO work_shifts')) {
            return {
              rows: [
                {
                  id: 30,
                  user_id: 'emp-team-1',
                  shift_date: '2026-11-18',
                  shift_type: 'trabajo',
                  start_time: '09:00',
                  end_time: '17:00',
                  assigned_by: 'leader-1',
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
          user: { id: 'leader-1', role_id: 3 },
          body: {
            user_id: 'emp-team-1',
            shift_date: '2026-11-18',
            shift_type: 'trabajo',
            start_time: '09:00',
            end_time: '17:00',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.status, 'success');
      });

      test('Líder de Área es bloqueado con 403 si intenta asignar licencia o feriado', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'emp-team-1', first_name: 'Pedro', last_name: 'Paz', role_id: 4, is_active: true }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        });

        const reqLicencia = {
          user: { id: 'leader-1', role_id: 3 },
          body: {
            user_id: 'emp-team-1',
            shift_date: '2026-11-18',
            shift_type: 'licencia',
          },
        };
        const resLicencia = createMockRes();
        await upsertShift(reqLicencia, resLicencia);

        assert.equal(resLicencia.statusCode, 403);
        assert.match(resLicencia.body.message, /Líderes de Área solo pueden asignar turnos de trabajo o francos/i);
        mock.reset();
      });

      test('Líder de Área es bloqueado con 403 si intenta sobrescribir una licencia o feriado existente', async () => {
        mock.method(pool, 'query', async (sql) => {
          if (typeof sql === 'string' && sql.includes('FROM users')) {
            return {
              rows: [{ id: 'emp-team-1', first_name: 'Pedro', last_name: 'Paz', role_id: 4, is_active: true }],
              rowCount: 1,
            };
          }
          if (typeof sql === 'string' && sql.includes('SELECT id, shift_type FROM work_shifts')) {
            return {
              rows: [{ id: 50, shift_type: 'licencia' }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        });

        const req = {
          user: { id: 'leader-1', role_id: 3 },
          body: {
            user_id: 'emp-team-1',
            shift_date: '2026-11-18',
            shift_type: 'trabajo',
            start_time: '08:00',
            end_time: '16:00',
          },
        };
        const res = createMockRes();

        await upsertShift(req, res);
        mock.reset();

        assert.equal(res.statusCode, 403);
        assert.match(res.body.message, /no pueden modificar o sobrescribir licencias o feriados/i);
      });
    });
  });

  describe('Consulta de Turnos (getShifts) y Visibilidad Jerárquica', () => {
    test('Empleado (4) debe consultar estrictamente sus propios turnos (WHERE user_id = req.user.id)', async () => {
      let capturedQuery = '';
      let capturedValues = [];

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          capturedQuery = sql;
          capturedValues = values;
          return {
            rows: [
              {
                id: 1,
                user_id: 'emp-own-id',
                shift_date: '2026-11-16',
                shift_type: 'trabajo',
                start_time: '08:00',
                end_time: '16:00',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'emp-own-id', role_id: 4 },
        query: {
          startDate: '2026-11-16',
          endDate: '2026-11-22',
          userId: 'target-otro-usuario',
        },
      };
      const res = createMockRes();

      await getShifts(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(capturedQuery.includes('s.user_id = $3'));
      assert.equal(capturedValues[2], 'emp-own-id');
    });

    test('RRHH (2) ve sus propios turnos más los de roles inferiores (3 y 4)', async () => {
      let capturedQuery = '';

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          capturedQuery = sql;
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'hr-1', role_id: 2 },
        query: { startDate: '2026-11-16', endDate: '2026-11-22' },
      };
      const res = createMockRes();

      await getShifts(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(capturedQuery.includes('u.role_id IN (3, 4)'));
    });

    test('Líder de Área (3) ve sus propios turnos más los de Empleados (rol 4)', async () => {
      let capturedQuery = '';

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          capturedQuery = sql;
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'leader-1', role_id: 3 },
        query: { startDate: '2026-11-16', endDate: '2026-11-22' },
      };
      const res = createMockRes();

      await getShifts(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(capturedQuery.includes('u.role_id = 4'));
    });

    test('Administrador (1) no tiene restricción de rol en la consulta', async () => {
      let capturedQuery = '';

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          capturedQuery = sql;
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        user: { id: 'admin-1', role_id: 1 },
        query: { startDate: '2026-11-16', endDate: '2026-11-22' },
      };
      const res = createMockRes();

      await getShifts(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(!capturedQuery.includes('u.role_id'));
    });
  });

  describe('Eliminación de Turnos (deleteShift) y Seguridad Jerárquica', () => {
    test('debe retornar 403 si un empleado intenta eliminar un turno', async () => {
      const req = {
        params: { id: '5' },
        user: { id: 'emp-1', role_id: 4 },
      };
      const res = createMockRes();

      await deleteShift(req, res);

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /No tienes permisos/i);
    });

    test('RRHH (2) recibe 403 al intentar eliminar su propio horario', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          return {
            rows: [{ id: 70, user_id: 'hr-1', target_role_id: 2, shift_type: 'trabajo' }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '70' },
        user: { id: 'hr-1', role_id: 2 },
      };
      const res = createMockRes();

      await deleteShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /no pueden eliminar su propio horario/i);
    });

    test('RRHH (2) recibe 403 al intentar eliminar turno de un Administrador (1)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          return {
            rows: [{ id: 71, user_id: 'admin-1', target_role_id: 1, shift_type: 'trabajo' }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '71' },
        user: { id: 'hr-1', role_id: 2 },
      };
      const res = createMockRes();

      await deleteShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /rango igual o superior/i);
    });

    test('RRHH (2) puede eliminar exitosamente el turno de un Empleado (rol 4) o Líder (rol 3)', async () => {
      let deleteCalled = false;

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          return {
            rows: [{ id: 72, user_id: 'emp-1', target_role_id: 4, shift_type: 'trabajo' }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('DELETE FROM work_shifts')) {
          deleteCalled = true;
          return { rows: [], rowCount: 1 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '72' },
        user: { id: 'hr-1', role_id: 2 },
      };
      const res = createMockRes();

      await deleteShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(deleteCalled);
    });

    test('Líder de Área (3) recibe 403 al intentar eliminar turno de otro Líder (3) o Administrador (1)', async () => {
      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          return {
            rows: [{ id: 73, user_id: 'leader-2', target_role_id: 3, shift_type: 'trabajo' }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '73' },
        user: { id: 'leader-1', role_id: 3 },
      };
      const res = createMockRes();

      await deleteShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /solo pueden eliminar turnos de colaboradores con rol Empleado/i);
    });

    test('Líder de Área (3) puede eliminar un turno de trabajo de un Empleado (4)', async () => {
      let deleteCalled = false;

      mock.method(pool, 'query', async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          return {
            rows: [{ id: 74, user_id: 'emp-1', target_role_id: 4, shift_type: 'trabajo' }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('DELETE FROM work_shifts')) {
          deleteCalled = true;
          return { rows: [], rowCount: 1 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '74' },
        user: { id: 'leader-1', role_id: 3 },
      };
      const res = createMockRes();

      await deleteShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.ok(deleteCalled);
    });

    test('Admin (1) puede eliminar cualquier turno y registra auditoría', async () => {
      let deleteExecuted = false;
      let auditLogged = false;

      mock.method(pool, 'query', async (sql, values) => {
        if (typeof sql === 'string' && sql.includes('FROM work_shifts s')) {
          return {
            rows: [{ id: 10, user_id: 'emp-1', target_role_id: 4, shift_type: 'trabajo' }],
            rowCount: 1,
          };
        }
        if (typeof sql === 'string' && sql.includes('DELETE FROM work_shifts WHERE id = $1')) {
          deleteExecuted = true;
          return { rows: [], rowCount: 1 };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          assert.equal(values[1], 'WORK_SHIFT_DELETED');
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const req = {
        params: { id: '10' },
        user: { id: 'admin-1', role_id: 1 },
      };
      const res = createMockRes();

      await deleteShift(req, res);
      mock.reset();

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(deleteExecuted);
      assert.ok(auditLogged);
    });
  });
});
