import { Router } from 'express';
import { registerUser, forgotPassword, resetPassword, activateAccount } from '../controllers/authController.js';
import { loginUser } from '../controllers/loginController.js';

const router = Router();

// Endpoints públicos de autenticación (sin middleware verifyToken)
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/activate', activateAccount);

export default router;
