import pool from "../../data/db.js";

export const getAll = async (id_empresa) => {
  const { rows } = await pool.query(
    "SELECT * FROM servicios WHERE id_empresa = $1 ORDER BY nombre",
    [id_empresa]
  );
  return rows;
};

export const getById = async (id_empresa, id_servicio) => {
  const { rows } = await pool.query(
    "SELECT * FROM servicios WHERE id_servicio = $1 AND id_empresa = $2",
    [id_servicio, id_empresa]
  );
  return rows[0] ?? null;
};

export const create = async (id_empresa, { nombre, descripcion, precio_referencia, activo }) => {
  const { rows } = await pool.query(
    `INSERT INTO servicios (id_empresa, nombre, descripcion, precio_referencia, activo)
     VALUES ($1, $2, $3, $4, COALESCE($5, TRUE)) RETURNING *`,
    [id_empresa, nombre, descripcion ?? null, precio_referencia ?? null, activo ?? null]
  );
  return rows[0];
};

export const update = async (id_empresa, id_servicio, datos) => {
  const has = (key) => datos[key] !== undefined;
  const { rows } = await pool.query(
    `UPDATE servicios SET
       nombre = CASE WHEN $1::boolean THEN $2 ELSE nombre END,
       descripcion = CASE WHEN $3::boolean THEN $4 ELSE descripcion END,
       precio_referencia = CASE WHEN $5::boolean THEN $6::numeric ELSE precio_referencia END,
       activo = CASE WHEN $7::boolean THEN $8::boolean ELSE activo END
     WHERE id_servicio = $9 AND id_empresa = $10 RETURNING *`,
    [has("nombre"), datos.nombre ?? null, has("descripcion"), datos.descripcion ?? null,
      has("precio_referencia"), datos.precio_referencia ?? null, has("activo"), datos.activo ?? null,
      id_servicio, id_empresa]
  );
  return rows[0] ?? null;
};

export const remove = async (id_empresa, id_servicio) => {
  const { rowCount } = await pool.query(
    "DELETE FROM servicios WHERE id_servicio = $1 AND id_empresa = $2",
    [id_servicio, id_empresa]
  );
  return rowCount > 0;
};
