// /api/invitados · Invitados al evento (Responsable: Lucas)
import { Router } from "express";
import { descargarComprobante, verificar } from "../controllers/invitados.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const conPermiso = requireRol("atencion_cliente", "responsable_organizacion");

router.patch("/:id/verificar", conPermiso, verificar);
router.get("/:id/comprobante", conPermiso, descargarComprobante);

export default router;
