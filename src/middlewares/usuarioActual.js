import { clerkClient, getAuth } from "@clerk/express";
import pool from "../data/db.js";

// Identifica a la persona que hace el pedido y deja sus datos en req.usuario:
//   req.usuario = { id_usuario, id_empresa, nombre, email, roles: ["atencion_cliente", ...] }
// TODAS las consultas de datos de una empresa filtran con req.usuario.id_empresa (multitenant).
//
// Dos modos:
// - Con CLERK_SECRET_KEY en el .env → login real con Clerk (el front manda el token).
// - Sin Clerk → modo desarrollo: usa el usuario DEV_ID_USUARIO del .env.

export const usaClerk = Boolean(process.env.CLERK_SECRET_KEY);

const SELECT_USUARIO = `
  SELECT u.id_usuario, u.id_empresa, u.nombre, u.email,
         COALESCE(array_agg(r.rol) FILTER (WHERE r.rol IS NOT NULL), '{}') AS roles
    FROM usuarios u
    LEFT JOIN usuario_roles r ON r.id_usuario = u.id_usuario`;

const buscarPorId = async (id_usuario) => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO} WHERE u.id_usuario = $1 AND u.activo GROUP BY u.id_usuario`,
    [id_usuario]
  );
  return rows[0] ?? null;
};

const buscarPorClerk = async (clerk_user_id) => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO} WHERE u.clerk_user_id = $1 AND u.activo GROUP BY u.id_usuario`,
    [clerk_user_id]
  );
  return rows[0] ?? null;
};

// Alta del personal por email: la empresa carga a la persona en "usuarios" con su email;
// la primera vez que entra con Clerk usando ese email, queda vinculada (clerk_user_id).
const vincularPorEmail = async (clerk_user_id) => {
  const usuarioClerk = await clerkClient.users.getUser(clerk_user_id);
  const email = usuarioClerk.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  const { rows } = await pool.query(
    `UPDATE usuarios SET clerk_user_id = $1
      WHERE id_usuario = (
        SELECT id_usuario FROM usuarios
         WHERE lower(email) = lower($2) AND clerk_user_id IS NULL AND activo
         ORDER BY id_usuario LIMIT 1)
      RETURNING id_usuario`,
    [clerk_user_id, email]
  );
  return rows[0] ? buscarPorId(rows[0].id_usuario) : null;
};

export const usuarioActual = async (req, res, next) => {
  try {
    let usuario;

    if (usaClerk) {
      const { isAuthenticated, userId } = getAuth(req);
      if (!isAuthenticated) {
        return res.status(401).json({ mensaje: "Tenés que iniciar sesión" });
      }
      usuario = (await buscarPorClerk(userId)) ?? (await vincularPorEmail(userId));
    } else {
      if (!process.env.DEV_ID_USUARIO) {
        return res.status(401).json({ mensaje: "Tenés que iniciar sesión" });
      }
      usuario = await buscarPorId(process.env.DEV_ID_USUARIO);
    }

    if (!usuario) {
      return res.status(403).json({ mensaje: "No tenés acceso al sistema. Pedí que te den de alta con tu email." });
    }
    req.usuario = usuario;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al identificar al usuario" });
  }
};
