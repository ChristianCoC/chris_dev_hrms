import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import { uploadRequestAttachment } from "../middlewares/uploadMiddleware.js";
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
  downloadRequestAttachment,
} from "../controllers/requestController.js";

const router = Router();

// Crear una nueva solicitud con soporte de archivo adjunto (Cualquier colaborador autenticado)
router.post("/", verifyToken, uploadRequestAttachment, createRequest);

// Obtener las solicitudes del usuario en sesión
router.get("/my", verifyToken, getMyRequests);

// Descargar/Visualizar archivo adjunto protegido (dueño, Admin y RRHH)
router.get("/:id/attachment", verifyToken, downloadRequestAttachment);

// Obtener todas las solicitudes de la empresa (Admin y RRHH: roles 1 y 2, y Líder de Área: 3)
router.get("/", verifyToken, authorizeRoles(1, 2, 3), getAllRequests);

// Actualizar estado de una solicitud (Admin y RRHH)
router.patch("/:id/status", verifyToken, authorizeRoles(1, 2, 3), updateRequestStatus);
router.patch("/:id", verifyToken, authorizeRoles(1, 2, 3), updateRequestStatus);

export default router;
