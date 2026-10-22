// Permite seguir solo si el usuario tiene ALGUNO de los roles indicados.
// Uso en una ruta: router.post("/", requireRol("responsable_propuesta"), crearPropuesta);
// Roles: admin_empresa · atencion_cliente · responsable_propuesta · responsable_organizacion · integrante
export const requireRol = (...roles) => (req, res, next) => {
  const tiene = req.usuario?.roles?.some((rol) => roles.includes(rol));
  if (!tiene) {
    return res.status(403).json({ mensaje: "No tenés permiso para hacer esto" });
  }
  next();
};
