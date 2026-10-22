import pool from "../../data/db.js";

// Usuarios de una empresa con sus roles. Nunca devuelve al super admin.
const SELECT_USUARIO = `
  SELECT u.id_usuario, u.id_empresa, u.nombre, u.email, u.usuario, u.activo,
         COALESCE(array_agg(r.rol ORDER BY r.rol) FILTER (WHERE r.rol IS NOT NULL), '{}') AS roles
    FROM usuarios u
    LEFT JOIN usuario_roles r ON r.id_usuario = u.id_usuario`;

export const getAll = async (id_empresa) => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO} WHERE u.id_empresa = $1 GROUP BY u.id_usuario ORDER BY u.activo DESC, u.nombre`,
    [id_empresa]
  );
  return rows;
};

export const getById = async (id_empresa, id_usuario) => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO} WHERE u.id_usuario = $1 AND u.id_empresa = $2 GROUP BY u.id_usuario`,
    [id_usuario, id_empresa]
  );
  return rows[0] ?? null;
};

export const getClerkId = async (id_empresa, id_usuario) => {
  const { rows } = await pool.query(
    "SELECT clerk_user_id FROM usuarios WHERE id_usuario = $1 AND id_empresa = $2",
    [id_usuario, id_empresa]
  );
  return rows[0]?.clerk_user_id ?? null;
};

export const existeUsuario = async (usuario) => {
  const { rowCount } = await pool.query("SELECT 1 FROM usuarios WHERE lower(usuario) = lower($1)", [usuario]);
  return rowCount > 0;
};

export const existeEmpresa = async (id_empresa) => {
  const { rowCount } = await pool.query("SELECT 1 FROM empresas WHERE id_empresa = $1", [id_empresa]);
  return rowCount > 0;
};

const guardarRoles = (client, id_usuario, roles) =>
  client.query(
    "INSERT INTO usuario_roles (id_usuario, rol) SELECT $1, unnest($2::varchar[])",
    [id_usuario, roles]
  );

export const create = async (id_empresa, { nombre, email, usuario, clerk_user_id, roles }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO usuarios (id_empresa, nombre, email, usuario, clerk_user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
      [id_empresa, nombre, email ?? null, usuario, clerk_user_id]
    );
    await guardarRoles(client, rows[0].id_usuario, roles);
    await client.query("COMMIT");
    return getById(id_empresa, rows[0].id_usuario);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// Solo cambia lo que viene: nombre, email, activo y/o roles (los roles se reemplazan todos).
export const update = async (id_empresa, id_usuario, { nombre, email, activo, roles }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE usuarios
          SET nombre = COALESCE($3, nombre),
              email = CASE WHEN $4::boolean THEN $5 ELSE email END,
              activo = COALESCE($6, activo)
        WHERE id_usuario = $1 AND id_empresa = $2`,
      [id_usuario, id_empresa, nombre ?? null, email !== undefined, email ?? null, activo ?? null]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    if (roles) {
      await client.query("DELETE FROM usuario_roles WHERE id_usuario = $1", [id_usuario]);
      await guardarRoles(client, id_usuario, roles);
    }
    await client.query("COMMIT");
    return getById(id_empresa, id_usuario);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
