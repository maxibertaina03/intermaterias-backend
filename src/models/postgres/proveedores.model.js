import pool from "../../data/db.js";

const SELECT_PROVEEDOR = `
  SELECT p.*,
         COALESCE((
           SELECT array_agg(ps.id_servicio ORDER BY ps.id_servicio)
             FROM proveedor_servicios ps
             JOIN servicios s ON s.id_servicio = ps.id_servicio AND s.id_empresa = p.id_empresa
            WHERE ps.id_proveedor = p.id_proveedor
         ), ARRAY[]::integer[]) AS id_servicios
    FROM proveedores p`;

export const getAll = async (id_empresa) => {
  const { rows } = await pool.query(
    `${SELECT_PROVEEDOR} WHERE p.id_empresa = $1 ORDER BY p.nombre`,
    [id_empresa]
  );
  return rows;
};

export const getById = async (id_empresa, id_proveedor) => {
  const { rows } = await pool.query(
    `${SELECT_PROVEEDOR} WHERE p.id_empresa = $1 AND p.id_proveedor = $2`,
    [id_empresa, id_proveedor]
  );
  return rows[0] ?? null;
};

export const create = async (id_empresa, { nombre, contacto_nombre, telefono, email, observaciones, activo }) => {
  const { rows } = await pool.query(
    `INSERT INTO proveedores (id_empresa, nombre, contacto_nombre, telefono, email, observaciones, activo)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE)) RETURNING *`,
    [id_empresa, nombre, contacto_nombre ?? null, telefono ?? null, email ?? null,
      observaciones ?? null, activo ?? null]
  );
  return { ...rows[0], id_servicios: [] };
};

export const update = async (id_empresa, id_proveedor, datos) => {
  const has = (key) => datos[key] !== undefined;
  const { rows } = await pool.query(
    `UPDATE proveedores SET
       nombre = CASE WHEN $1::boolean THEN $2 ELSE nombre END,
       contacto_nombre = CASE WHEN $3::boolean THEN $4 ELSE contacto_nombre END,
       telefono = CASE WHEN $5::boolean THEN $6 ELSE telefono END,
       email = CASE WHEN $7::boolean THEN $8 ELSE email END,
       observaciones = CASE WHEN $9::boolean THEN $10 ELSE observaciones END,
       activo = CASE WHEN $11::boolean THEN $12::boolean ELSE activo END
     WHERE id_proveedor = $13 AND id_empresa = $14 RETURNING *`,
    [has("nombre"), datos.nombre ?? null, has("contacto_nombre"), datos.contacto_nombre ?? null,
      has("telefono"), datos.telefono ?? null, has("email"), datos.email ?? null,
      has("observaciones"), datos.observaciones ?? null, has("activo"), datos.activo ?? null,
      id_proveedor, id_empresa]
  );
  if (!rows[0]) return null;
  return getById(id_empresa, id_proveedor);
};

export const setServicios = async (id_empresa, id_proveedor, ids_servicios) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount: existeProveedor } = await client.query(
      "SELECT 1 FROM proveedores WHERE id_proveedor = $1 AND id_empresa = $2 FOR UPDATE",
      [id_proveedor, id_empresa]
    );
    if (!existeProveedor) {
      await client.query("ROLLBACK");
      return { estado: "proveedor_no_encontrado" };
    }

    const { rows: servicios } = await client.query(
      "SELECT id_servicio FROM servicios WHERE id_empresa = $1 AND id_servicio = ANY($2::int[])",
      [id_empresa, ids_servicios]
    );
    if (servicios.length !== ids_servicios.length) {
      await client.query("ROLLBACK");
      return { estado: "servicio_no_encontrado" };
    }

    await client.query("DELETE FROM proveedor_servicios WHERE id_proveedor = $1", [id_proveedor]);
    if (ids_servicios.length) {
      await client.query(
        `INSERT INTO proveedor_servicios (id_proveedor, id_servicio)
         SELECT $1, unnest($2::int[])`,
        [id_proveedor, ids_servicios]
      );
    }
    const { rows: [proveedor] } = await client.query(
      `${SELECT_PROVEEDOR} WHERE p.id_empresa = $1 AND p.id_proveedor = $2`,
      [id_empresa, id_proveedor]
    );
    await client.query("COMMIT");
    return { estado: "ok", proveedor };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const remove = async (id_empresa, id_proveedor) => {
  const { rowCount } = await pool.query(
    "DELETE FROM proveedores WHERE id_proveedor = $1 AND id_empresa = $2",
    [id_proveedor, id_empresa]
  );
  return rowCount > 0;
};
