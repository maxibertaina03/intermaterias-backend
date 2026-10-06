export const validarEmpresa = (req, res, next) => {
  const { nombre, cuit } = req.body ?? {};

  if (!nombre || !cuit) {
    return res.status(400).json({ mensaje: "Los campos nombre y cuit son obligatorios" });
  }

  next();
};
