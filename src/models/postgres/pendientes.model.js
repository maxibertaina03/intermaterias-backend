import pool from "../../data/db.js";

export const getAll = async (id_empresa) => {
  const [servicios, tareas, propuestas] = await Promise.all([
    pool.query(
      `SELECT es.id_evento_servicio, es.estado, es.es_propio, es.observaciones,
              e.id_evento, e.nombre AS nombre_evento, e.fecha AS fecha_evento,
              s.nombre AS nombre_servicio, p.nombre AS nombre_proveedor
         FROM evento_servicios es
         JOIN eventos e ON e.id_evento = es.id_evento
         JOIN servicios s ON s.id_servicio = es.id_servicio
         LEFT JOIN proveedores p ON p.id_proveedor = es.id_proveedor
        WHERE e.id_empresa = $1 AND es.estado = 'pendiente'
        ORDER BY e.fecha, e.nombre, s.nombre`,
      [id_empresa]
    ),
    pool.query(
      `SELECT t.id_tarea, t.descripcion, t.fecha_prevista, t.estado,
              e.id_evento, e.nombre AS nombre_evento, e.fecha AS fecha_evento,
              u.nombre AS nombre_responsable
         FROM tareas t
         JOIN eventos e ON e.id_evento = t.id_evento AND e.id_empresa = t.id_empresa
         LEFT JOIN usuarios u ON u.id_usuario = t.id_responsable AND u.id_empresa = t.id_empresa
        WHERE t.id_empresa = $1
          AND t.estado <> 'hecha'
          AND (t.fecha_prevista < CURRENT_DATE
               OR t.fecha_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)
        ORDER BY t.fecha_prevista NULLS LAST, t.id_tarea`,
      [id_empresa]
    ),
    pool.query(
      `SELECT p.id_propuesta, p.estado, p.fecha_presentacion, p.vigencia_dias,
              p.fecha_presentacion + p.vigencia_dias * INTERVAL '1 day' AS fecha_vencimiento,
              e.id_evento, e.nombre AS nombre_evento, e.fecha AS fecha_evento,
              c.nombre AS nombre_cliente,
              COALESCE(SUM(i.cantidad * i.precio_unitario), 0) - p.descuento AS total
         FROM propuestas p
         JOIN eventos e ON e.id_evento = p.id_evento AND e.id_empresa = p.id_empresa
         JOIN clientes c ON c.id_cliente = e.id_cliente
         LEFT JOIN propuesta_items i ON i.id_propuesta = p.id_propuesta
        WHERE p.id_empresa = $1 AND p.estado = 'presentada'
          AND p.fecha_presentacion + p.vigencia_dias * INTERVAL '1 day'
              BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        GROUP BY p.id_propuesta, e.id_evento, e.nombre, e.fecha, c.nombre
        ORDER BY fecha_vencimiento, e.nombre`,
      [id_empresa]
    )
  ]);
  return {
    servicios: servicios.rows,
    tareas: tareas.rows,
    propuestas: propuestas.rows
  };
};
