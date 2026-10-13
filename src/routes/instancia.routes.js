import { Router } from "express";
import { obtenerInstancia } from "../controllers/instancia.controller.js";

const router = Router();

router.get("/", obtenerInstancia);

export default router;