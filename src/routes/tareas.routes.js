import { Router } from "express";
import { crear, eliminar, listar, actualizar } from "../controllers/tareas.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
const equipoOrganizacion = requireRol("responsable_organizacion", "integrante");

router.get("/", listar);
router.post("/", equipoOrganizacion, crear);
router.put("/:id", equipoOrganizacion, actualizar);
router.delete("/:id", equipoOrganizacion, eliminar);

export default router;
