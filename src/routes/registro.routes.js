// /api/publico/registro · autoregistro con prueba gratuita de 30 días (sin login)
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { registrar } from "../controllers/registro.controller.js";

// Sin login: pocas altas por IP, para que no se creen empresas en cantidad
const limiteRegistros = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: "Demasiados registros desde esta conexión. Probá de nuevo en una hora." }
});

const router = Router();
router.post("/", limiteRegistros, registrar);

export default router;
