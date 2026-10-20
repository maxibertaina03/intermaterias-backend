import "dotenv/config";
import os from "os";
import express from "express";
import cors from "cors";
import empresasRouter from "./routes/empresas.routes.js";
import instanciaRouter from "./routes/instancia.routes.js";
import { clerkMiddleware } from "@clerk/express";
import { usaClerk, usuarioActual } from "./middlewares/usuarioActual.js";
import meRouter from "./routes/me.routes.js";
import clientesRouter from "./routes/clientes.routes.js";
import eventosRouter from "./routes/eventos.routes.js";
import propuestasRouter from "./routes/propuestas.routes.js";
import tareasRouter from "./routes/tareas.routes.js";
import pendientesRouter from "./routes/pendientes.routes.js";
import serviciosAcordadosRouter from "./routes/serviciosAcordados.routes.js";
import serviciosRouter from "./routes/servicios.routes.js";
import proveedoresRouter from "./routes/proveedores.routes.js";
import sedesRouter from "./routes/sedes.routes.js";
import tiposEventoRouter from "./routes/tiposEvento.routes.js";

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

// ── Rutas que necesitan saber quién es el usuario (y de qué empresa) ──
// Todas ya están montadas: cada uno completa su archivo de routes/ sin tocar este.
if (usaClerk) app.use(clerkMiddleware());   // lee el token de Clerk que manda el front
app.use("/api", usuarioActual);
app.use("/api/me", meRouter);                                   // masita (login)
app.use("/api/clientes", clientesRouter);                       // Lucas
app.use("/api/eventos", eventosRouter);                         // Lucas
app.use("/api/propuestas", propuestasRouter);                   // Tomi
app.use("/api/tareas", tareasRouter);                           // Tomi
app.use("/api/pendientes", pendientesRouter);                   // Tomi
app.use("/api/servicios-acordados", serviciosAcordadosRouter);  // Facu
app.use("/api/servicios", serviciosRouter);                     // Facu
app.use("/api/proveedores", proveedoresRouter);                 // Facu
app.use("/api/sedes", sedesRouter);                             // Facu
app.use("/api/tipos-evento", tiposEventoRouter);                // Facu

// Ruta 404 para rutas inexistentes (siempre al final)
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(usaClerk ? "Login: Clerk" : `Login: modo desarrollo (DEV_ID_USUARIO=${process.env.DEV_ID_USUARIO ?? "sin definir"})`);
});
