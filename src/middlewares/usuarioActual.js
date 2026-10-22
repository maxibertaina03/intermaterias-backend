import { getAuth } from "@clerk/express";
import pool from "../data/db.js";

// Identifica a la persona que hace el pedido y deja sus datos en req.usuario:
//   req.usuario = { id_usuario, id_empresa, empresa, nombre, email, usuario, es_superadmin,
//                   roles: ["admin_empresa", "atencion_cliente", ...] }
// TODAS las consultas de datos de una empresa filtran con req.usuario.id_empresa (multitenant).
// El super admin no tiene empresa (id_empresa null): solo administra empresas.
//
// Dos modos:
// - Con CLERK_SECRET_KEY en el .env → login real con Clerk (usuario y contraseña; el front manda el token).
//   Solo entra quien tiene su usuario dado de alta (lo crea el administrador de su empresa).
// - Sin Clerk → modo desarrollo: usa el usuario DEV_ID_USUARIO del .env.

export const usaClerk = Boolean(process.env.CLERK_SECRET_KEY);

// Un usuario de una empresa desactivada no entra; el super admin sí.
const SELECT_USUARIO = `
  SELECT u.id_usuario, u.id_empresa, e.nombre AS empresa, u.nombre, u.email, u.usuario, u.es_superadmin,
         COALESCE(array_agg(r.rol) FILTER (WHERE r.rol IS NOT NULL), '{}') AS roles
    FROM usuarios u
    LEFT JOIN empresas e ON e.id_empresa = u.id_empresa
    LEFT JOIN usuario_roles r ON r.id_usuario = u.id_usuario`;
const ACTIVO = "u.activo AND (u.es_superadmin OR e.activo)";

const buscarPorId = async (id_usuario) => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO} WHERE u.id_usuario = $1 AND ${ACTIVO} GROUP BY u.id_usuario, e.nombre`,
    [id_usuario]
  );
  return rows[0] ?? null;
};

const buscarPorClerk = async (clerk_user_id) => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO} WHERE u.clerk_user_id = $1 AND ${ACTIVO} GROUP BY u.id_usuario, e.nombre`,
    [clerk_user_id]
  );
  return rows[0] ?? null;
};

export const usuarioActual = async (req, res, next) => {
  try {
    let usuario;

    if (usaClerk) {
      const { isAuthenticated, userId } = getAuth(req);
      if (!isAuthenticated) {
        return res.status(401).json({ mensaje: "Tenés que iniciar sesión" });
      }
      usuario = await buscarPorClerk(userId);
    } else {
      if (!process.env.DEV_ID_USUARIO) {
        return res.status(401).json({ mensaje: "Tenés que iniciar sesión" });
      }
      usuario = await buscarPorId(process.env.DEV_ID_USUARIO);
    }

    if (!usuario) {
      return res.status(403).json({ mensaje: "No tenés acceso al sistema. Pedile el alta al administrador de tu empresa." });
    }
    req.usuario = usuario;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al identificar al usuario" });
  }
};
