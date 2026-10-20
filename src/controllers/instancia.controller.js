import os from "os";
import { createRequire } from "module";

const { version } = createRequire(import.meta.url)("../../package.json");

// Qué réplica respondió (para ver el balanceo de Nginx) y qué versión del sistema corre.
export const obtenerInstancia = (req, res) => {
  res.json({ instancia: os.hostname(), version });
};
