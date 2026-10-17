// /api/clientes (clientes y contactos)
import { Router } from "express";
import {
  actualizar, actualizarContacto, crear, crearContacto, eliminar, listar, listarContactos, obtener,
} from "../controllers/clientes.controller.js";
import { requireRol } from "../middlewares/requireRol.js";

const router = Router();
// Registran clientes quienes atienden y negocian con ellos
const gestionClientes = requireRol("atencion_cliente", "responsable_propuesta");

router.get("/", listar);
router.get("/:id", obtener);
router.post("/", gestionClientes, crear);
router.put("/:id", gestionClientes, actualizar);
router.delete("/:id", gestionClientes, eliminar);

router.get("/:id/contactos", listarContactos);
router.post("/:id/contactos", gestionClientes, crearContacto);
router.put("/:id/contactos/:idContacto", gestionClientes, actualizarContacto);

export default router;
