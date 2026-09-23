import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { getMyNotifications, markAsRead } from "../controllers/notificationController.js";

const router = Router();

router.get("/", verifyToken, getMyNotifications);
router.patch("/:id/read", verifyToken, markAsRead);

export default router;