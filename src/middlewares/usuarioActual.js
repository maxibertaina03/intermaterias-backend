import pool from "../data/db.js";

// Identifica a la persona que hace el pedido y deja sus datos en req.usuario:
//   req.usuario = { id_usuario, id_empresa, nombre, email, roles: ["atencion_cliente", ...] }
// TODAS las consultas de datos de una empresa filtran con req.usuario.id_empresa (multitenant).
//
// Hoy (mientras se hace el login): modo desarrollo con DEV_ID_USUARIO en el .env.
// Login con Clerk (masita): acá se obtiene el usuario a partir del token de Clerk.
const buscarUsuario = async (id_usuario) => {
  const { rows } = await pool.query(
    `SELECT u.id_usuario, u.id_empresa, u.nombre, u.email,
            COALESCE(array_agg(r.rol) FILTER (WHERE r.rol IS NOT NULL), '{}') AS roles
       FROM usuarios u
       LEFT JOIN usuario_roles r ON r.id_usuario = u.id_usuario
      WHERE u.id_usuario = $1 AND u.activo
      GROUP BY u.id_usuario`,
    [id_usuario]
  );
  return rows[0] ?? null;
};

export const usuarioActual = async (req, res, next) => {
  try {
    const idDesarrollo = process.env.DEV_ID_USUARIO;
    if (!idDesarrollo) {
      return res.status(401).json({ mensaje: "Tenés que iniciar sesión" });
    }
    const usuario = await buscarUsuario(idDesarrollo);
    if (!usuario) {
      return res.status(403).json({ mensaje: "No tenés acceso al sistema" });
    }
    req.usuario = usuario;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al identificar al usuario" });
  }
};
