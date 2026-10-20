import pool from "../../data/db.js";

const detallePropuesta = `
  SELECT p.*,
         e.nombre AS nombre_evento,
         e.fecha AS fecha_evento,
         e.estado AS estado_evento,
         c.nombre AS nombre_cliente,
         p.fecha_presentacion + p.vigencia_dias * INTERVAL '1 day' AS fecha_vencimiento,
         COALESCE(SUM(i.cantidad * i.precio_unitario) FILTER (WHERE s.id_servicio IS NOT NULL), 0) AS subtotal,
         COALESCE(SUM(i.cantidad * i.precio_unitario) FILTER (WHERE s.id_servicio IS NOT NULL), 0) - p.descuento AS total
    FROM propuestas p
    JOIN eventos e ON e.id_evento = p.id_evento AND e.id_empresa = p.id_empresa
    JOIN clientes c ON c.id_cliente = e.id_cliente
    LEFT JOIN propuesta_items i ON i.id_propuesta = p.id_propuesta
    LEFT JOIN servicios s ON s.id_servicio = i.id_servicio AND s.id_empresa = p.id_empresa
`;

const seleccionarItems = async (id_empresa, id_propuesta) => {
  const { rows } = await pool.query(
    `SELECT i.*, s.nombre AS nombre_servicio
       FROM propuesta_items i
       JOIN propuestas p ON p.id_propuesta = i.id_propuesta
       JOIN servicios s ON s.id_servicio = i.id_servicio AND s.id_empresa = p.id_empresa
      WHERE i.id_propuesta = $1 AND p.id_empresa = $2
      ORDER BY i.id_item`,
    [id_propuesta, id_empresa]
  );
  return rows;
};

export const vencerExpiradas = async (id_empresa, id_evento = null) => {
  await pool.query(
    `UPDATE propuestas
        SET estado = 'vencida', fecha_actualizacion = NOW()
      WHERE id_empresa = $1
        AND estado = 'presentada'
        AND fecha_presentacion + vigencia_dias * INTERVAL '1 day' <= NOW()
        AND ($2::int IS NULL OR id_evento = $2)`,
    [id_empresa, id_evento]
  );
};

export const getAll = async (id_empresa, estado) => {
  await vencerExpiradas(id_empresa);
  const { rows } = await pool.query(
    `${detallePropuesta}
      WHERE p.id_empresa = $1
        AND ($2::text IS NULL OR p.estado = $2)
      GROUP BY p.id_propuesta, e.nombre, e.fecha, e.estado, c.nombre, p.fecha_presentacion, p.vigencia_dias
      ORDER BY e.fecha, p.id_propuesta`,
    [id_empresa, estado ?? null]
  );
  return rows;
};

export const getByEvent = async (id_empresa, id_evento) => {
  await vencerExpiradas(id_empresa, id_evento);
  const { rows } = await pool.query(
    `${detallePropuesta}
      WHERE p.id_empresa = $1 AND p.id_evento = $2
      GROUP BY p.id_propuesta, e.nombre, e.fecha, e.estado, c.nombre, p.fecha_presentacion, p.vigencia_dias`,
    [id_empresa, id_evento]
  );
  if (!rows[0]) return null;
  return { ...rows[0], items: await seleccionarItems(id_empresa, rows[0].id_propuesta) };
};

export const getById = async (id_empresa, id_propuesta) => {
  const { rows } = await pool.query(
    "SELECT estado FROM propuestas WHERE id_propuesta = $1 AND id_empresa = $2",
    [id_propuesta, id_empresa]
  );
  return rows[0] ?? null;
};

export const getEvent = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    "SELECT id_evento FROM eventos WHERE id_evento = $1 AND id_empresa = $2",
    [id_evento, id_empresa]
  );
  return rows[0] ?? null;
};

export const create = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    `INSERT INTO propuestas (id_empresa, id_evento)
     SELECT $1, e.id_evento
       FROM eventos e
      WHERE e.id_evento = $2 AND e.id_empresa = $1
     RETURNING *`,
    [id_empresa, id_evento]
  );
  return rows[0] ?? null;
};

export const update = async (id_empresa, id_propuesta, { descuento, condiciones }) => {
  const { rows } = await pool.query(
    `UPDATE propuestas SET
       descuento = CASE WHEN $1::boolean THEN $2 ELSE descuento END,
       condiciones = CASE WHEN $3::boolean THEN $4 ELSE condiciones END,
       fecha_actualizacion = NOW()
     WHERE id_propuesta = $5 AND id_empresa = $6
       AND estado IN ('en_preparacion', 'rechazada', 'vencida')
     RETURNING *`,
    [
      descuento !== undefined,
      descuento ?? null,
      condiciones !== undefined,
      condiciones ?? null,
      id_propuesta,
      id_empresa
    ]
  );
  return rows[0] ?? null;
};

export const createItem = async (id_empresa, id_propuesta, item) => {
  const { rows } = await pool.query(
    `INSERT INTO propuesta_items (id_propuesta, id_servicio, descripcion, cantidad, precio_unitario)
     SELECT p.id_propuesta, s.id_servicio, $4, $5, COALESCE($6, s.precio_referencia)
       FROM propuestas p
       JOIN servicios s ON s.id_servicio = $3 AND s.id_empresa = p.id_empresa
      WHERE p.id_propuesta = $1 AND p.id_empresa = $2
        AND p.estado IN ('en_preparacion', 'rechazada', 'vencida')
     RETURNING *`,
    [
      id_propuesta,
      id_empresa,
      item.id_servicio,
      item.descripcion ?? null,
      item.cantidad,
      item.precio_unitario ?? null
    ]
  );
  return rows[0] ?? null;
};

export const updateItem = async (id_empresa, id_propuesta, id_item, item) => {
  const { rows } = await pool.query(
    `UPDATE propuesta_items i SET
       id_servicio = s.id_servicio,
       descripcion = CASE WHEN $1::boolean THEN $2 ELSE i.descripcion END,
       cantidad = CASE WHEN $3::boolean THEN $4 ELSE i.cantidad END,
       precio_unitario = CASE WHEN $5::boolean THEN $6 ELSE i.precio_unitario END
      FROM propuestas p, servicios s
     WHERE i.id_item = $7 AND i.id_propuesta = p.id_propuesta
       AND p.id_propuesta = $8 AND p.id_empresa = $9
       AND p.estado IN ('en_preparacion', 'rechazada', 'vencida')
       AND s.id_servicio = COALESCE($10, i.id_servicio)
       AND s.id_empresa = p.id_empresa
     RETURNING i.*`,
    [
      item.descripcion !== undefined,
      item.descripcion ?? null,
      item.cantidad !== undefined,
      item.cantidad ?? null,
      item.precio_unitario !== undefined,
      item.precio_unitario ?? null,
      id_item,
      id_propuesta,
      id_empresa,
      item.id_servicio ?? null
    ]
  );
  return rows[0] ?? null;
};

export const removeItem = async (id_empresa, id_propuesta, id_item) => {
  const { rowCount } = await pool.query(
    `DELETE FROM propuesta_items i
      USING propuestas p
      WHERE i.id_item = $1 AND i.id_propuesta = p.id_propuesta
        AND p.id_propuesta = $2 AND p.id_empresa = $3
        AND p.estado IN ('en_preparacion', 'rechazada', 'vencida')`,
    [id_item, id_propuesta, id_empresa]
  );
  return rowCount > 0;
};

const cambiarEstado = async (id_empresa, id_propuesta, accion, motivo = null) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT p.*, e.id_evento, e.estado AS estado_evento,
              (p.estado = 'presentada' AND
               p.fecha_presentacion + p.vigencia_dias * INTERVAL '1 day' <= NOW()) AS expirada
         FROM propuestas p
         JOIN eventos e ON e.id_evento = p.id_evento AND e.id_empresa = p.id_empresa
        WHERE p.id_propuesta = $1 AND p.id_empresa = $2
        FOR UPDATE OF p, e`,
      [id_propuesta, id_empresa]
    );
    const propuesta = rows[0];
    if (!propuesta) {
      await client.query("ROLLBACK");
      return { estado: "no_encontrada" };
    }

    if (propuesta.expirada) {
      await client.query(
        "UPDATE propuestas SET estado = 'vencida', fecha_actualizacion = NOW() WHERE id_propuesta = $1 AND id_empresa = $2",
        [id_propuesta, id_empresa]
      );
      await client.query("COMMIT");
      return { estado: "vencida" };
    }

    if (accion === "presentar") {
      if (!["en_preparacion", "rechazada", "vencida"].includes(propuesta.estado)) {
        await client.query("ROLLBACK");
        return { estado: "transicion_invalida" };
      }
      const { rows: items } = await client.query(
        "SELECT id_item FROM propuesta_items WHERE id_propuesta = $1",
        [id_propuesta]
      );
      if (!items.length) {
        await client.query("ROLLBACK");
        return { estado: "sin_items" };
      }
      // falta_informacion: cuando el centro completa los datos, se presenta la propuesta igual
      if (!["recibida", "falta_informacion", "propuesta_enviada", "no_aceptada"].includes(propuesta.estado_evento)) {
        await client.query("ROLLBACK");
        return { estado: "evento_invalido" };
      }
      await client.query(
        `UPDATE propuestas
            SET estado = 'presentada', fecha_presentacion = NOW(),
                fecha_respuesta = NULL, motivo_rechazo = NULL, fecha_actualizacion = NOW()
          WHERE id_propuesta = $1 AND id_empresa = $2`,
        [id_propuesta, id_empresa]
      );
      await client.query(
        "UPDATE eventos SET estado = 'propuesta_enviada' WHERE id_evento = $1 AND id_empresa = $2",
        [propuesta.id_evento, id_empresa]
      );
    } else if (accion === "aceptar") {
      if (propuesta.estado !== "presentada") {
        await client.query("ROLLBACK");
        return { estado: "transicion_invalida" };
      }
      const { rows: items } = await client.query(
        `SELECT i.id_servicio
           FROM propuesta_items i
           JOIN servicios s ON s.id_servicio = i.id_servicio AND s.id_empresa = $2
          WHERE i.id_propuesta = $1`,
        [id_propuesta, id_empresa]
      );
      if (!items.length) {
        await client.query("ROLLBACK");
        return { estado: "sin_items" };
      }
      await client.query(
        `UPDATE propuestas
            SET estado = 'aceptada', fecha_respuesta = NOW(), fecha_actualizacion = NOW()
          WHERE id_propuesta = $1 AND id_empresa = $2`,
        [id_propuesta, id_empresa]
      );
      await client.query(
        `UPDATE eventos SET estado = 'confirmado'
          WHERE id_evento = $1 AND id_empresa = $2`,
        [propuesta.id_evento, id_empresa]
      );
      const { rowCount } = await client.query(
        `INSERT INTO evento_servicios (id_evento, id_servicio, estado)
         SELECT $1, i.id_servicio, 'pendiente'
           FROM propuesta_items i
           JOIN servicios s ON s.id_servicio = i.id_servicio AND s.id_empresa = $2
          WHERE i.id_propuesta = $3`,
        [propuesta.id_evento, id_empresa, id_propuesta]
      );
      if (rowCount !== items.length) throw new Error("No se pudieron crear todos los servicios acordados");
    } else {
      if (propuesta.estado !== "presentada") {
        await client.query("ROLLBACK");
        return { estado: "transicion_invalida" };
      }
      await client.query(
        `UPDATE propuestas
            SET estado = 'rechazada', motivo_rechazo = $1,
                fecha_respuesta = NOW(), fecha_actualizacion = NOW()
          WHERE id_propuesta = $2 AND id_empresa = $3`,
        [motivo, id_propuesta, id_empresa]
      );
      await client.query(
        "UPDATE eventos SET estado = 'no_aceptada' WHERE id_evento = $1 AND id_empresa = $2",
        [propuesta.id_evento, id_empresa]
      );
    }

    await client.query("COMMIT");
    return { estado: "ok" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const presentar = (id_empresa, id_propuesta) =>
  cambiarEstado(id_empresa, id_propuesta, "presentar");

export const aceptar = (id_empresa, id_propuesta) =>
  cambiarEstado(id_empresa, id_propuesta, "aceptar");

export const rechazar = (id_empresa, id_propuesta, motivo) =>
  cambiarEstado(id_empresa, id_propuesta, "rechazar", motivo);
