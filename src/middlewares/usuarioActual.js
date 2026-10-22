import { clerkClient, getAuth } from "@clerk/express";
import pool from "../data/db.js";

// Identifica a la persona que hace el pedido y deja sus datos en req.usuario:
//   req.usuario = { id_usuario, id_empresa, nombre, email, roles: ["atencion_cliente", ...] }
// TODAS las consultas de datos de una empresa filtran con req.usuario.id_empresa (multitenant).
//
// Dos modos:
// - Con CLERK_SECRET_KEY en el .env → login real con Clerk (usuario y contraseña; el front manda el token).
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

// Alta automática: la primera vez que alguien entra con Clerk se le crea su usuario
// en la empresa por defecto (CLERK_ID_EMPRESA, por defecto 1) y con los roles de CLERK_ROLES
// (por defecto, los 4). Los roles y la empresa se pueden cambiar después en la base.
const ROLES_POR_DEFECTO = ["atencion_cliente", "responsable_propuesta", "responsable_organizacion", "integrante"];

const crearDesdeClerk = async (clerk_user_id) => {
  const u = await clerkClient.users.getUser(clerk_user_id);
  const nombre = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Usuario";
  const email = u.primaryEmailAddress?.emailAddress ?? null;
  const id_empresa = Number(process.env.CLERK_ID_EMPRESA || 1);
  const roles = process.env.CLERK_ROLES ? process.env.CLERK_ROLES.split(",").map((r) => r.trim()) : ROLES_POR_DEFECTO;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO usuarios (id_empresa, nombre, email, clerk_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (clerk_user_id) DO NOTHING
       RETURNING id_usuario`,
      [id_empresa, nombre, email, clerk_user_id]
    );
    if (rows[0]) {
      await client.query(
        `INSERT INTO usuario_roles (id_usuario, rol) SELECT $1, unnest($2::varchar[])`,
        [rows[0].id_usuario, roles]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return buscarPorClerk(clerk_user_id);
};

export const usuarioActual = async (req, res, next) => {
  try {
    let usuario;

    if (usaClerk) {
      const { isAuthenticated, userId } = getAuth(req);
      if (!isAuthenticated) {
        return res.status(401).json({ mensaje: "Tenés que iniciar sesión" });
      }
      usuario = (await buscarPorClerk(userId)) ?? (await crearDesdeClerk(userId));
    } else {
      if (!process.env.DEV_ID_USUARIO) {
        return res.status(401).json({ mensaje: "Tenés que iniciar sesión" });
      }
      usuario = await buscarPorId(process.env.DEV_ID_USUARIO);
    }

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
