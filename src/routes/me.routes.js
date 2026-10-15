// /api/me · datos del usuario logueado (Responsable: masita, login)
import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json(req.usuario);
});

export default router;
