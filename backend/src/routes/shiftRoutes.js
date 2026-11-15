import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import {
  upsertShift,
  getShifts,
  deleteShift,
} from "../controllers/shiftController.js";

const router = Router();

// Consultar turnos semanales (Cualquier usuario autenticado - los empleados solo ven los propios)
router.get("/", verifyToken, getShifts);

// Asignar o actualizar un turno (Administrador, Recursos Humanos y Líder de Área)
router.post("/", verifyToken, authorizeRoles(1, 2, 3), upsertShift);

// Eliminar un turno asignado puntual (Administrador, Recursos Humanos y Líder de Área)
router.delete("/:id", verifyToken, authorizeRoles(1, 2, 3), deleteShift);

export default router;
