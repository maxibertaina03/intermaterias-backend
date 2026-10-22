import { Router } from "express";
import { listar } from "../controllers/pendientes.controller.js";

const router = Router();

router.get("/", listar);

export default router;
