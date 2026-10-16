import { Router } from "express";
import {
  aceptar,
  actualizar,
  agregarItem,
  crear,
  eliminarItem,
  listar,
  obtenerPorEvento,
  presentar,
  rechazar,
  actualizarItem
} from "../controllers/propuestas.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const responsablePropuesta = requireRol("responsable_propuesta");

router.get("/", listar);
router.get("/evento/:idEvento", obtenerPorEvento);
router.post("/", responsablePropuesta, crear);
router.put("/:id", responsablePropuesta, actualizar);
router.post("/:id/items", responsablePropuesta, agregarItem);
router.put("/:id/items/:idItem", responsablePropuesta, actualizarItem);
router.delete("/:id/items/:idItem", responsablePropuesta, eliminarItem);
router.post("/:id/presentar", responsablePropuesta, presentar);
router.post("/:id/aceptar", responsablePropuesta, aceptar);
router.post("/:id/rechazar", responsablePropuesta, rechazar);

export default router;
