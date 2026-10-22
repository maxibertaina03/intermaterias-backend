// /api/eventos (solicitudes, eventos, cambios, cierre y cancelación) · Responsable: Lucas
import { Router } from "express";
import {
  actualizar, cambiarEstado, cancelar, crear, listar, obtener, obtenerCambios,
} from "../controllers/eventos.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
// Reciben y registran la solicitud
const atencionCliente = requireRol("atencion_cliente");
// Coordinan la preparación: cambian estado, editan logística, cancelan
const organizacion = requireRol("atencion_cliente", "responsable_organizacion");

router.get("/", listar);
router.get("/:id", obtener);
router.get("/:id/cambios", obtenerCambios);
router.post("/", atencionCliente, crear);
router.put("/:id", organizacion, actualizar);
router.patch("/:id/estado", organizacion, cambiarEstado);
router.post("/:id/cancelar", organizacion, cancelar);

export default router;
