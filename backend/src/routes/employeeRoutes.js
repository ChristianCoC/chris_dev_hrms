import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import { createEmployee } from "../controllers/userController.js";
import {
  getEmployees,
  getEmployeeStats,
  getEmployeeById,
  updateEmployeeHR,
} from "../controllers/employeeController.js";

const router = Router();

// Estadísticas para Dashboard RRHH (Admin y RRHH)
router.get("/stats", verifyToken, authorizeRoles(1, 2), getEmployeeStats);

// Listado de empleados con filtros (Admin y RRHH)
router.get("/", verifyToken, authorizeRoles(1, 2), getEmployees);

// Crear nuevo empleado (solo Administrador)
router.post("/", verifyToken, authorizeRoles(1), createEmployee);

// Detalle de un empleado (Admin, RRHH, o el propio empleado consultando su perfil)
router.get("/:id", verifyToken, (req, res, next) => {
  // Si es rol 1 o 2, puede consultar a cualquiera. Si es rol 3 o 4, solo a sí mismo.
  if ([1, 2].includes(req.user.role_id) || req.user.id === req.params.id) {
    return getEmployeeById(req, res);
  }
  return res.status(403).json({
    status: "error",
    message: "Acceso denegado. No tiene permisos para consultar este empleado.",
  });
});

// Actualización de datos de RRHH (Solo Admin y RRHH)
router.put("/:id", verifyToken, authorizeRoles(1, 2), updateEmployeeHR);
router.patch("/:id", verifyToken, authorizeRoles(1, 2), updateEmployeeHR);

export default router;
