import { Router } from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { authorizeRoles } from '../middlewares/roleMiddleware.js';
import { listAuditLogs } from '../controllers/auditController.js';

const router = Router();

// Solo Administradores (rol 1) y Recursos Humanos (rol 2) pueden ver la auditoría
router.get('/', verifyToken, authorizeRoles(1, 2), listAuditLogs);

export default router;
