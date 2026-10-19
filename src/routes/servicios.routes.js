// /api/servicios · catálogo por organizadora
import { Router } from "express";
import { actualizar, crear, eliminar, listar, obtener } from "../controllers/servicios.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const gestion = requireRol("atencion_cliente", "responsable_propuesta", "responsable_organizacion");

router.get("/", listar);
router.get("/:id", obtener);
router.post("/", gestion, crear);
router.put("/:id", gestion, actualizar);
router.delete("/:id", gestion, eliminar);

export default router;
