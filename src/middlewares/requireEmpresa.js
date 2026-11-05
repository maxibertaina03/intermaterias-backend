// Las rutas de datos (clientes, eventos, propuestas…) son de una empresa.
// El super admin no pertenece a ninguna: solo administra empresas.
export const requireEmpresa = (req, res, next) => {
  if (!req.usuario?.id_empresa) {
    return res.status(403).json({ mensaje: "Esta sección es de las empresas: el super admin solo administra empresas" });
  }
  next();
};

// Prueba gratuita vencida: la empresa sigue viendo sus datos, pero no puede cargar ni modificar nada.
export const soloLecturaSiPruebaVencida = (req, res, next) => {
  if (req.usuario?.prueba_vencida && req.method !== "GET") {
    return res.status(403).json({
      codigo: "prueba_vencida",
      mensaje: "Tu prueba gratuita terminó: podés ver tus datos, pero no cargar ni modificar. Próximamente vas a poder suscribirte.",
    });
  }
  next();
};

// Administración de empresas: solo el super admin.
export const requireSuperAdmin = (req, res, next) => {
  if (!req.usuario?.es_superadmin) {
    return res.status(403).json({ mensaje: "No tenés permiso para hacer esto" });
  }
  next();
};
