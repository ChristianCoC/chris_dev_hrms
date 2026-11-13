import { Router } from "express";
import { query } from "../config/db.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import { getAllUsers, deleteUser, updateUser } from "../controllers/userController.js";

const router = Router();

router.get('/profile', verifyToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, email, first_name, last_name, phone, department, hire_date, role_id, document_number, file_number, is_active
             FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Usuario no encontrado.',
            });
        }

        return res.status(200).json({
            status: 'success',
            message: '¡Bienvenido a tu perfil!',
            user: result.rows[0],
        });
    } catch (error) {
        console.error('❌ Error al obtener perfil:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Error interno al consultar el perfil.',
        });
    }
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