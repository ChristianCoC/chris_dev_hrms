/**
 * Middleware para verificar si el usuario tiene un rol permitido.
 * @param {...number} allowedRoles - IDs de los roles permitidos (ej: 1 para Admin, 2 para HR)
 */
export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'Usuario no encontrado',
            });
        }

        if (!allowedRoles.includes(req.user.role_id)) {
            return res.status(403).json({
                status: 'error',
                message: 'Acceso denegado. No tiene los permisos necesarios para realizar esta acción.'
            });
        }

        next();
    };
};