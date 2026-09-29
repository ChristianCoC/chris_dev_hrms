import { Router } from 'express';
import { registerUser, forgotPassword, resetPassword } from '../controllers/authController.js';
import { loginUser } from '../controllers/loginController.js';

const router = Router();

// Endpoints públicos de autenticación (sin middleware verifyToken)
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
