// /api/me · datos del usuario logueado (Responsable: masita, login)
import { Router } from "express";
import { actualizarRecorrido } from "../controllers/primerosPasos.controller.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(req.usuario);
});

// Recorrido guiado: { recorrido_visto?, primeros_pasos_cerrado? }. Va antes de la regla de
// "prueba vencida = solo lectura": cerrar el recorrido no modifica datos de la empresa.
router.patch("/recorrido", actualizarRecorrido);

export default router;
