import pool from "../../data/db.js";

const selectTareas = `
  SELECT t.*, e.nombre AS nombre_evento, e.fecha AS fecha_evento,
         u.nombre AS nombre_responsable
    FROM tareas t
    JOIN eventos e ON e.id_evento = t.id_evento AND e.id_empresa = t.id_empresa
    LEFT JOIN usuarios u ON u.id_usuario = t.id_responsable AND u.id_empresa = t.id_empresa
`;

export const getAll = async (id_empresa, id_evento = null) => {
  const { rows } = await pool.query(
    `${selectTareas}
      WHERE t.id_empresa = $1 AND ($2::int IS NULL OR t.id_evento = $2)
      ORDER BY t.fecha_prevista NULLS LAST, t.id_tarea`,
    [id_empresa, id_evento]
  );
  return rows;
};

export const getEvent = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    "SELECT estado FROM eventos WHERE id_evento = $1 AND id_empresa = $2",
    [id_evento, id_empresa]
  );
  return rows[0] ?? null;
};

export const getUser = async (id_empresa, id_usuario) => {
  const { rows } = await pool.query(
    "SELECT id_usuario FROM usuarios WHERE id_usuario = $1 AND id_empresa = $2 AND activo",
    [id_usuario, id_empresa]
  );
  return rows[0] ?? null;
};

export const create = async (id_empresa, tarea) => {
  const { rows } = await pool.query(
    `INSERT INTO tareas (id_empresa, id_evento, id_responsable, descripcion, fecha_prevista)
     SELECT $1, e.id_evento, $4, $5, $6
       FROM eventos e
      WHERE e.id_evento = $2 AND e.id_empresa = $1
        AND e.estado IN ('confirmado', 'en_preparacion')
     RETURNING *`,
    [id_empresa, tarea.id_evento, tarea.id_responsable ?? null, tarea.descripcion, tarea.fecha_prevista ?? null]
  );
  return rows[0] ?? null;
};

export const update = async (id_empresa, id_tarea, tarea) => {
  const { rows } = await pool.query(
    `UPDATE tareas t SET
       descripcion = CASE WHEN $1::boolean THEN $2 ELSE t.descripcion END,
       fecha_prevista = CASE WHEN $3::boolean THEN $4::date ELSE t.fecha_prevista END,
       id_responsable = CASE WHEN $5::boolean THEN $6 ELSE t.id_responsable END,
       estado = CASE WHEN $7::boolean THEN $8 ELSE t.estado END
      FROM eventos e
     WHERE t.id_tarea = $9 AND t.id_empresa = $10
       AND e.id_evento = t.id_evento AND e.id_empresa = t.id_empresa
       AND e.estado IN ('confirmado', 'en_preparacion')
     RETURNING t.*`,
    [
      tarea.descripcion !== undefined,
      tarea.descripcion ?? null,
      tarea.fecha_prevista !== undefined,
      tarea.fecha_prevista ?? null,
      tarea.id_responsable !== undefined,
      tarea.id_responsable ?? null,
      tarea.estado !== undefined,
      tarea.estado ?? null,
      id_tarea,
      id_empresa
    ]
  );
  return rows[0] ?? null;
};

export const remove = async (id_empresa, id_tarea) => {
  const { rowCount } = await pool.query(
    `DELETE FROM tareas t
      USING eventos e
      WHERE t.id_tarea = $1 AND t.id_empresa = $2
        AND e.id_evento = t.id_evento AND e.id_empresa = t.id_empresa
        AND e.estado IN ('confirmado', 'en_preparacion')`,
    [id_tarea, id_empresa]
  );
  return rowCount > 0;
};
