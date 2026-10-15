// /api/propuestas (propuestas e ítems) · Responsable: Tomi
// Reemplazar la ruta provisoria por las reales (ver ESTRUCTURA.md: "Endpoints por área").
import { Router } from "express";

const router = Router();

router.all("/{*resto}", (req, res) => {
  res.status(501).json({ mensaje: "En construcción (Tomi)" });
});

export default router;
