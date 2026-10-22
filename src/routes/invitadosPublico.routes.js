// /api/publico/invitaciones · Formulario público del invitado, sin login (Responsable: Lucas)
import { Router } from "express";
import multer from "multer";
import { obtener, responder } from "../controllers/invitadosPublico.controller.js";

const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error("El comprobante tiene que ser un PDF, JPG o PNG"));
    }
    cb(null, true);
  }
});

// El comprobante es opcional: si multer falla (tamaño o tipo), respondemos 400 en vez del 500 por defecto
const subirComprobante = (req, res, next) => {
  upload.single("comprobante")(req, res, (error) => {
    if (!error) return next();
    const mensaje = error.code === "LIMIT_FILE_SIZE" ? "El comprobante no puede superar los 5 MB" : error.message;
    res.status(400).json({ mensaje });
  });
};

const router = Router();

router.get("/:token", obtener);
router.post("/:token/respuestas", subirComprobante, responder);

export default router;
