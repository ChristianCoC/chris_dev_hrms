import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
} from "../controllers/requestController.js";

const router = Router();

// Crear una nueva solicitud (Cualquier empleado autenticado)
router.post("/", verifyToken, createRequest);

// Obtener las solicitudes del usuario en sesión
router.get("/my", verifyToken, getMyRequests);

// Obtener todas las solicitudes de la empresa (Admin y RRHH: roles 1, 2 y 3)
router.get("/", verifyToken, authorizeRoles(1, 2, 3), getAllRequests);

// Actualizar estado de una solicitud (Admin y RRHH)
router.patch("/:id/status", verifyToken, authorizeRoles(1, 2, 3), updateRequestStatus);
router.patch("/:id", verifyToken, authorizeRoles(1, 2, 3), updateRequestStatus);

export default router;
