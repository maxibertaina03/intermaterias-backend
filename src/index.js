import "dotenv/config";
import os from "os";
import express from "express";
import cors from "cors";
import empresasRouter from "./routes/empresas.routes.js";
import instanciaRouter from "./routes/instancia.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Agrega el header X-Instancia a todas las respuestas
app.use((req, res, next) => {
  res.setHeader("X-Instancia", os.hostname());
  next();
});

app.use("/api/empresas", empresasRouter);
app.use("/api/instancia", instanciaRouter);

// Ruta 404 para rutas inexistentes (siempre al final)
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});