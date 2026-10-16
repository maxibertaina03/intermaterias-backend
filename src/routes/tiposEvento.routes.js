// /api/tipos-evento
import { Router } from "express";
import { actualizarTipo, crearTipo, eliminarTipo, listarTipos } from "../controllers/catalogos.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const gestion = requireRol("atencion_cliente", "responsable_propuesta", "responsable_organizacion");

router.get("/", listarTipos);
router.post("/", gestion, crearTipo);
router.put("/:id", gestion, actualizarTipo);
router.delete("/:id", gestion, eliminarTipo);

export default router;
