import { Router } from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { authorizeRoles } from '../middlewares/roleMiddleware.js';
import { createClaim, resolveClaim, getClaims } from '../controllers/claimController.js';

const router = Router();

router.post('/', verifyToken, createClaim);
router.patch('/:id/resolve', verifyToken, authorizeRoles(1, 2), resolveClaim);
router.get('/', verifyToken, getClaims);

export default router;