// /api/eventos/:id/invitacion y /:id/invitados · Invitados al evento (Responsable: Lucas)
import { Router } from "express";
import { crearOActualizar, listar } from "../controllers/invitaciones.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const conPermiso = requireRol("atencion_cliente", "responsable_organizacion");

router.post("/:id/invitacion", conPermiso, crearOActualizar);
router.get("/:id/invitados", conPermiso, listar);

export default router;
