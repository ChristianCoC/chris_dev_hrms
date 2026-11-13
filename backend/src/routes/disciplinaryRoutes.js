import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/roleMiddleware.js";
import {
  createDisciplinaryAction,
  getEmployeeDisciplinaryActions,
  getMyDisciplinaryActions,
} from "../controllers/disciplinaryController.js";

const router = Router();

// Registrar una nueva acción disciplinaria (Exclusivo Administrador: 1 y Recursos Humanos: 2)
router.post("/", verifyToken, authorizeRoles(1, 2), createDisciplinaryAction);

// Consultar el legajo del colaborador autenticado (Cualquier empleado)
router.get("/my-records", verifyToken, getMyDisciplinaryActions);

// Consultar legajo de un colaborador específico (Protegido por RBAC: Dueño, Admin y RRHH)
router.get("/user/:userId", verifyToken, getEmployeeDisciplinaryActions);

export default router;
