// /api/primeros-pasos · progreso de la empresa para la tarjeta "Primeros pasos" (masita)
import { Router } from "express";
import { obtener } from "../controllers/primerosPasos.controller.js";

const router = Router();

router.get("/", obtener);

export default router;
