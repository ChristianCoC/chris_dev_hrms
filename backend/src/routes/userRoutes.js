import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import { getAllUsers, deleteUser, updateUser } from "../controllers/userController.js";

const router = Router();

router.get('/profile', verifyToken, (req, res) => {
    return res.status(200).json({
        status: 'success',
        message: '¡Bienvenido a tu perfil!',
        user: req.user,
    });
});

router.get('/admin-panel', verifyToken, authorizeRoles(1, 2), (req, res) => {
    return res.status(200).json({
        status: 'success',
        message: '¡Bienvenido al área de administración!',
        secretData: 'Aquí iran las funcionalidades y datos sensibles del panel de administración.',
    });
});

router.get('/', verifyToken, authorizeRoles(1, 2), getAllUsers);
router.delete('/:id', verifyToken, authorizeRoles(1), deleteUser);
router.put('/:id', verifyToken, authorizeRoles(1, 2), updateUser);

export default router;