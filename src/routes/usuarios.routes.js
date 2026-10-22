// /api/usuarios · el administrador de cada empresa da de alta a su equipo (Responsable: masita)
import { Router } from "express";
import { listar, obtener, crear, actualizar } from "../controllers/usuarios.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const admin = requireRol("admin_empresa");

router.get("/", admin, listar);
router.get("/:id", admin, obtener);
router.post("/", admin, crear);
router.put("/:id", admin, actualizar);

export default router;
