import { Router } from "express";
import {
  obtenerEmpresas,
  obtenerEmpresa,
  crearEmpresa,
  editarEmpresa,
  eliminarEmpresa
} from "../controllers/empresas.controller.js";
import { validarEmpresa } from "../middlewares/validarEmpresa.js";
import { crearAdministrador } from "../controllers/usuarios.controller.js";

const router = Router();

router.get("/", obtenerEmpresas);
router.get("/:id", obtenerEmpresa);
router.post("/", validarEmpresa, crearEmpresa);
router.put("/:id", editarEmpresa);
router.delete("/:id", eliminarEmpresa);
router.post("/:id/admin", crearAdministrador);   // primer administrador de la empresa

export default router;
