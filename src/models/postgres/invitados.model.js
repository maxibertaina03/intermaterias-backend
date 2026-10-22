import crypto from "crypto";
import pool from "../../data/db.js";

const SELECT_INVITADO = `
  SELECT id_invitado, nombre, apellido, asiste, medio_pago, pago_verificado, fecha_respuesta,
         comprobante_nombre, comprobante_tipo, (comprobante IS NOT NULL) AS tiene_comprobante
    FROM invitados`;

export const getEvento = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    "SELECT estado FROM eventos WHERE id_evento = $1 AND id_empresa = $2",
    [id_evento, id_empresa]
  );
  return rows[0] ?? null;
};

export const crearOActualizarInvitacion = async (id_empresa, id_evento, { precio_por_invitado, fecha_limite, activa }) => {
  const token = crypto.randomBytes(24).toString("hex");
  const { rows } = await pool.query(
    `INSERT INTO invitaciones (id_empresa, id_evento, token, precio_por_invitado, activa, fecha_limite)
     SELECT $1, e.id_evento, $3, $4, $5, $6
       FROM eventos e
      WHERE e.id_evento = $2 AND e.id_empresa = $1
        AND e.estado IN ('confirmado', 'en_preparacion')
     ON CONFLICT (id_evento) DO UPDATE SET
       precio_por_invitado = EXCLUDED.precio_por_invitado,
       activa = EXCLUDED.activa,
       fecha_limite = EXCLUDED.fecha_limite
     RETURNING *`,
    [id_empresa, id_evento, token, precio_por_invitado, activa ?? true, fecha_limite ?? null]
  );
  return rows[0] ?? null;
};

export const getPorEvento = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    "SELECT * FROM invitaciones WHERE id_empresa = $1 AND id_evento = $2",
    [id_empresa, id_evento]
  );
  const invitacion = rows[0] ?? null;
  if (!invitacion) {
    return { invitacion: null, invitados: [], totales: { van: 0, no_van: 0, a_cobrar: 0, verificados: 0 } };
  }

  const { rows: invitados } = await pool.query(
    `${SELECT_INVITADO} WHERE id_invitacion = $1 ORDER BY apellido, nombre`,
    [invitacion.id_invitacion]
  );
  const van = invitados.filter((i) => i.asiste).length;
  const verificados = invitados.filter((i) => i.pago_verificado).length;
  const totales = {
    van,
    no_van: invitados.length - van,
    a_cobrar: van * Number(invitacion.precio_por_invitado),
    verificados
  };
  return { invitacion, invitados, totales };
};

export const buscarPorToken = async (token) => {
  const { rows } = await pool.query(
    `SELECT inv.id_invitacion, inv.token, inv.precio_por_invitado, inv.fecha_limite, inv.activa,
            e.nombre AS evento, e.fecha, e.hora_inicio, s.nombre AS sede,
            (inv.fecha_limite IS NOT NULL AND inv.fecha_limite < CURRENT_DATE) AS vencida
       FROM invitaciones inv
       JOIN eventos e ON e.id_evento = inv.id_evento
       LEFT JOIN sedes s ON s.id_sede = e.id_sede
      WHERE inv.token = $1`,
    [token]
  );
  return rows[0] ?? null;
};

export const crearInvitado = async (id_invitacion, { nombre, apellido, asiste, medio_pago }, archivo) => {
  const { rows } = await pool.query(
    `INSERT INTO invitados (id_invitacion, nombre, apellido, asiste, medio_pago, comprobante, comprobante_nombre, comprobante_tipo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_invitado, nombre, apellido, asiste, medio_pago, fecha_respuesta`,
    [
      id_invitacion,
      nombre,
      apellido,
      asiste,
      asiste ? (medio_pago ?? null) : null,
      archivo?.buffer ?? null,
      archivo?.originalname ?? null,
      archivo?.mimetype ?? null
    ]
  );
  return rows[0];
};

export const getInvitado = async (id_empresa, id_invitado) => {
  const { rows } = await pool.query(
    `${SELECT_INVITADO}
       JOIN invitaciones inv ON inv.id_invitacion = invitados.id_invitacion
      WHERE invitados.id_invitado = $1 AND inv.id_empresa = $2`,
    [id_invitado, id_empresa]
  );
  return rows[0] ?? null;
};

export const verificarPago = async (id_empresa, id_invitado) => {
  const { rows } = await pool.query(
    `UPDATE invitados SET pago_verificado = TRUE
      FROM invitaciones inv
     WHERE invitados.id_invitacion = inv.id_invitacion
       AND invitados.id_invitado = $1 AND inv.id_empresa = $2
     RETURNING invitados.id_invitado, invitados.pago_verificado`,
    [id_invitado, id_empresa]
  );
  return rows[0] ?? null;
};

export const getComprobante = async (id_empresa, id_invitado) => {
  const { rows } = await pool.query(
    `SELECT i.comprobante, i.comprobante_nombre, i.comprobante_tipo
       FROM invitados i
       JOIN invitaciones inv ON inv.id_invitacion = i.id_invitacion
      WHERE i.id_invitado = $1 AND inv.id_empresa = $2`,
    [id_invitado, id_empresa]
  );
  return rows[0] ?? null;
};
