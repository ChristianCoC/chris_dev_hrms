import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  sendAnnouncement,
} from "../controllers/notificationController.js";

const router = Router();

// Notificaciones del usuario en sesión
router.get("/", verifyToken, getMyNotifications);
router.patch("/read-all", verifyToken, markAllAsRead);
router.patch("/:id/read", verifyToken, markAsRead);

// Emisión de comunicados (Exclusivo Administrador y Recursos Humanos: roles 1 y 2)
router.post("/announce", verifyToken, authorizeRoles(1, 2), sendAnnouncement);

export default router;
