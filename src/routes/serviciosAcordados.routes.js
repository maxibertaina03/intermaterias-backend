// /api/servicios-acordados (coordinación de servicios del evento) · Responsable: Facu
// Reemplazar la ruta provisoria por las reales (ver ESTRUCTURA.md: "Endpoints por área").
import { Router } from "express";

const router = Router();

router.all("/{*resto}", (req, res) => {
  res.status(501).json({ mensaje: "En construcción (Facu)" });
});

export default router;
