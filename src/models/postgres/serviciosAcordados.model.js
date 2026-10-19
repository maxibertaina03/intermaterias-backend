import pool from "../../data/db.js";

export const getAll = async (id_empresa, id_evento = null) => {
  const { rows } = await pool.query(
    `SELECT es.id_evento_servicio, es.id_evento, es.id_servicio, es.es_propio,
            es.id_proveedor, es.id_responsable, es.estado, es.observaciones,
            e.nombre AS nombre_evento, e.fecha AS fecha_evento, e.estado AS estado_evento,
            s.nombre AS nombre_servicio,
            p.nombre AS nombre_proveedor,
            u.nombre AS nombre_responsable
       FROM evento_servicios es
       JOIN eventos e ON e.id_evento = es.id_evento AND e.id_empresa = $1
       JOIN servicios s ON s.id_servicio = es.id_servicio AND s.id_empresa = e.id_empresa
       LEFT JOIN proveedores p ON p.id_proveedor = es.id_proveedor AND p.id_empresa = e.id_empresa
       LEFT JOIN usuarios u ON u.id_usuario = es.id_responsable AND u.id_empresa = e.id_empresa
      WHERE ($2::int IS NULL OR e.id_evento = $2)
      ORDER BY e.fecha, e.nombre, s.nombre, es.id_evento_servicio`,
    [id_empresa, id_evento]
  );
  return rows;
};

export const update = async (id_empresa, id_evento_servicio, datos) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT es.*, e.estado AS estado_evento
         FROM evento_servicios es
         JOIN eventos e ON e.id_evento = es.id_evento AND e.id_empresa = $1
         JOIN servicios s ON s.id_servicio = es.id_servicio AND s.id_empresa = e.id_empresa
        WHERE es.id_evento_servicio = $2
        FOR UPDATE OF es`,
      [id_empresa, id_evento_servicio]
    );
    const actual = rows[0];
    if (!actual) {
      await client.query("ROLLBACK");
      return { estado: "no_encontrado" };
    }
    if (!["confirmado", "en_preparacion"].includes(actual.estado_evento)) {
      await client.query("ROLLBACK");
      return { estado: "evento_no_coordinable" };
    }

    const es_propio = datos.es_propio ?? actual.es_propio;
    const id_proveedor = es_propio
      ? null
      : datos.id_proveedor === undefined ? actual.id_proveedor : datos.id_proveedor;
    const id_responsable = datos.id_responsable === undefined ? actual.id_responsable : datos.id_responsable;
    const observaciones = datos.observaciones === undefined ? actual.observaciones : datos.observaciones;

    if (id_proveedor !== null) {
      const { rowCount } = await client.query(
        `SELECT 1
           FROM proveedores p
           JOIN proveedor_servicios ps ON ps.id_proveedor = p.id_proveedor
           JOIN servicios s ON s.id_servicio = ps.id_servicio AND s.id_empresa = p.id_empresa
          WHERE p.id_proveedor = $1 AND p.id_empresa = $2 AND p.activo
            AND s.id_servicio = $3`,
        [id_proveedor, id_empresa, actual.id_servicio]
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return { estado: "proveedor_no_ofrece_servicio" };
      }
    }

    if (id_responsable !== null) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM usuarios WHERE id_usuario = $1 AND id_empresa = $2 AND activo",
        [id_responsable, id_empresa]
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return { estado: "responsable_no_encontrado" };
      }
    }

    const { rows: actualizados } = await client.query(
      `UPDATE evento_servicios
          SET es_propio = $1,
              id_proveedor = $2,
              id_responsable = $3,
              observaciones = $4,
              estado = CASE
                WHEN es_propio IS DISTINCT FROM $1 OR id_proveedor IS DISTINCT FROM $2 THEN 'pendiente'
                ELSE estado
              END
        WHERE id_evento_servicio = $5
        RETURNING *`,
      [es_propio, id_proveedor, id_responsable, observaciones, id_evento_servicio]
    );
    await client.query("COMMIT");
    return { estado: "ok", servicio: actualizados[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const confirmar = async (id_empresa, id_evento_servicio) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT es.*, e.estado AS estado_evento
         FROM evento_servicios es
         JOIN eventos e ON e.id_evento = es.id_evento AND e.id_empresa = $1
         JOIN servicios s ON s.id_servicio = es.id_servicio AND s.id_empresa = e.id_empresa
        WHERE es.id_evento_servicio = $2
        FOR UPDATE OF es`,
      [id_empresa, id_evento_servicio]
    );
    const servicio = rows[0];
    if (!servicio) {
      await client.query("ROLLBACK");
      return { estado: "no_encontrado" };
    }
    if (!["confirmado", "en_preparacion"].includes(servicio.estado_evento)) {
      await client.query("ROLLBACK");
      return { estado: "evento_no_coordinable" };
    }
    if (servicio.estado !== "pendiente") {
      await client.query("ROLLBACK");
      return { estado: "ya_confirmado" };
    }
    if (!servicio.es_propio && !servicio.id_proveedor) {
      await client.query("ROLLBACK");
      return { estado: "falta_proveedor" };
    }
    if (!servicio.es_propio) {
      const { rowCount } = await client.query(
        `SELECT 1
           FROM proveedores p
           JOIN proveedor_servicios ps ON ps.id_proveedor = p.id_proveedor
           JOIN servicios s ON s.id_servicio = ps.id_servicio AND s.id_empresa = p.id_empresa
          WHERE p.id_proveedor = $1 AND p.id_empresa = $2 AND p.activo
            AND s.id_servicio = $3`,
        [servicio.id_proveedor, id_empresa, servicio.id_servicio]
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return { estado: "proveedor_no_ofrece_servicio" };
      }
    }

    const { rows: actualizados } = await client.query(
      `UPDATE evento_servicios SET estado = 'confirmado'
        WHERE id_evento_servicio = $1 RETURNING *`,
      [id_evento_servicio]
    );
    await client.query("COMMIT");
    return { estado: "ok", servicio: actualizados[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
