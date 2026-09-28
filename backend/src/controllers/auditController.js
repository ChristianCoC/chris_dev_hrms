import { getAuditLogs } from '../services/auditService.js';

export const listAuditLogs = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  const { action, entity_type } = req.query;

  try {
    const data = await getAuditLogs({
      limit,
      offset,
      action: action || null,
      entityType: entity_type || null,
    });

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total: data.total,
      totalPages: Math.ceil(data.total / limit) || 1,
      data: {
        logs: data.logs,
      },
    });
  } catch (error) {
    console.error('❌ Error al obtener registros de auditoría:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno al consultar los registros de auditoría.',
      error: error.message,
    });
  }
};

export default { listAuditLogs };
