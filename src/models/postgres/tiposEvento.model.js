import pool from "../../data/db.js";

export const getAll = async (id_empresa) => {
  const { rows } = await pool.query(
    `SELECT t.*, (SELECT count(*)::int FROM eventos e WHERE e.id_tipo_evento = t.id_tipo_evento) AS cantidad_eventos
       FROM tipos_evento t WHERE t.id_empresa = $1 ORDER BY t.nombre`,
    [id_empresa]
  );
  return rows;
};

export const create = async (id_empresa, nombre) => {
  const { rows } = await pool.query(
    "INSERT INTO tipos_evento (id_empresa, nombre) VALUES ($1, $2) RETURNING *", [id_empresa, nombre]);
  return rows[0];
};

export const update = async (id_empresa, id_tipo_evento, nombre) => {
  const { rows } = await pool.query(
    "UPDATE tipos_evento SET nombre = $1 WHERE id_tipo_evento = $2 AND id_empresa = $3 RETURNING *",
    [nombre, id_tipo_evento, id_empresa]
  );
  return rows[0] ?? null;
};

export const remove = async (id_empresa, id_tipo_evento) => {
  const { rowCount } = await pool.query(
    "DELETE FROM tipos_evento WHERE id_tipo_evento = $1 AND id_empresa = $2", [id_tipo_evento, id_empresa]);
  return rowCount > 0;
};
