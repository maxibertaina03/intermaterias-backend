import os from "os";

export const obtenerInstancia = (req, res) => {
  res.json({ instancia: os.hostname() });
};