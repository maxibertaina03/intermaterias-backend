import pool from "../../data/db.js";

export const getAll = async (id_empresa) => {
  const { rows } = await pool.query(
    `SELECT s.*, (SELECT count(*)::int FROM eventos e WHERE e.id_sede = s.id_sede) AS cantidad_eventos
       FROM sedes s WHERE s.id_empresa = $1 ORDER BY s.nombre`,
    [id_empresa]
  );
  return rows;
};

export const getById = async (id_empresa, id_sede) => {
  const { rows } = await pool.query("SELECT * FROM sedes WHERE id_sede = $1 AND id_empresa = $2", [id_sede, id_empresa]);
  return rows[0] ?? null;
};

export const create = async (id_empresa, { nombre, direccion, capacidad }) => {
  const { rows } = await pool.query(
    `INSERT INTO sedes (id_empresa, nombre, direccion, capacidad) VALUES ($1, $2, $3, $4) RETURNING *`,
    [id_empresa, nombre, direccion ?? null, capacidad ?? null]
  );
  return rows[0];
};

export const update = async (id_empresa, id_sede, datos) => {
  const has = (k) => datos[k] !== undefined;
  const { rows } = await pool.query(
    `UPDATE sedes SET
       nombre = CASE WHEN $1::boolean THEN $2 ELSE nombre END,
       direccion = CASE WHEN $3::boolean THEN $4 ELSE direccion END,
       capacidad = CASE WHEN $5::boolean THEN $6::int ELSE capacidad END
     WHERE id_sede = $7 AND id_empresa = $8 RETURNING *`,
    [has("nombre"), datos.nombre ?? null, has("direccion"), datos.direccion ?? null,
     has("capacidad"), datos.capacidad ?? null, id_sede, id_empresa]
  );
  return rows[0] ?? null;
};

export const remove = async (id_empresa, id_sede) => {
  const { rowCount } = await pool.query("DELETE FROM sedes WHERE id_sede = $1 AND id_empresa = $2", [id_sede, id_empresa]);
  return rowCount > 0;
};
