// /api/servicios-acordados · coordinación de servicios del evento
import { Router } from "express";
import { actualizar, confirmar, listar } from "../controllers/serviciosAcordados.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const coordinacion = requireRol("responsable_organizacion", "integrante");

router.get("/", listar);
router.put("/:id", coordinacion, actualizar);
router.post("/:id/confirmar", coordinacion, confirmar);

export default router;
