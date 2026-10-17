// /api/sedes
import { Router } from "express";
import { actualizarSede, crearSede, eliminarSede, listarSedes, obtenerSede } from "../controllers/catalogos.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const gestion = requireRol("atencion_cliente", "responsable_propuesta", "responsable_organizacion");

router.get("/", listarSedes);
router.get("/:id", obtenerSede);
router.post("/", gestion, crearSede);
router.put("/:id", gestion, actualizarSede);
router.delete("/:id", gestion, eliminarSede);

export default router;
