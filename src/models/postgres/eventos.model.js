import pool from "../../data/db.js";

const SELECT_LISTADO = `
  SELECT e.id_evento, e.id_cliente, c.nombre AS nombre_cliente,
         e.id_tipo_evento, t.nombre AS nombre_tipo_evento,
         e.id_sede, e.nombre, e.fecha, e.hora_inicio, e.cantidad_estimada, e.estado
    FROM eventos e
    JOIN clientes c ON c.id_cliente = e.id_cliente
    JOIN tipos_evento t ON t.id_tipo_evento = e.id_tipo_evento
`;

export const getAll = async (id_empresa, { estado, desde, hasta, cliente } = {}) => {
  const { rows } = await pool.query(
    `${SELECT_LISTADO}
      WHERE e.id_empresa = $1
        AND ($2::varchar IS NULL OR e.estado = $2)
        AND ($3::date IS NULL OR e.fecha >= $3)
        AND ($4::date IS NULL OR e.fecha <= $4)
        AND ($5::int IS NULL OR e.id_cliente = $5)
      ORDER BY e.fecha`,
    [id_empresa, estado ?? null, desde ?? null, hasta ?? null, cliente ?? null]
  );
  return rows;
};

const SELECT_DETALLE = `
  SELECT e.*,
         c.nombre AS nombre_cliente, c.tipo AS tipo_cliente,
         ct.nombre AS nombre_contacto, ct.telefono AS telefono_contacto, ct.email AS email_contacto,
         t.nombre AS nombre_tipo_evento,
         s.nombre AS nombre_sede
    FROM eventos e
    JOIN clientes c ON c.id_cliente = e.id_cliente
    JOIN tipos_evento t ON t.id_tipo_evento = e.id_tipo_evento
    LEFT JOIN contactos ct ON ct.id_contacto = e.id_contacto
    LEFT JOIN sedes s ON s.id_sede = e.id_sede
`;

export const getById = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    `${SELECT_DETALLE} WHERE e.id_empresa = $1 AND e.id_evento = $2`,
    [id_empresa, id_evento]
  );
  return rows[0] ?? null;
};

export const getEstado = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    "SELECT estado FROM eventos WHERE id_evento = $1 AND id_empresa = $2",
    [id_evento, id_empresa]
  );
  return rows[0]?.estado ?? null;
};

// Valida que cliente/tipo/sede/contacto sean de esta empresa (multitenant) al crear.
export const create = async (id_empresa, datos) => {
  const { rows } = await pool.query(
    `INSERT INTO eventos (
       id_empresa, id_cliente, id_contacto, id_tipo_evento, id_sede,
       nombre, fecha, hora_inicio, cantidad_estimada, necesidades
     )
     SELECT $1, c.id_cliente, ct.id_contacto, t.id_tipo_evento, se.id_sede,
            $6, $7::date, $8::time, $9, $10
       FROM clientes c
       JOIN tipos_evento t ON t.id_empresa = $1 AND t.id_tipo_evento = $4
       LEFT JOIN contactos ct ON ct.id_contacto = $3 AND ct.id_cliente = c.id_cliente
       LEFT JOIN sedes se ON se.id_empresa = $1 AND se.id_sede = $5
      WHERE c.id_empresa = $1 AND c.id_cliente = $2
        AND ($3::int IS NULL OR ct.id_contacto IS NOT NULL)
        AND ($5::int IS NULL OR se.id_sede IS NOT NULL)
     RETURNING *`,
    [
      id_empresa, datos.id_cliente, datos.id_contacto ?? null, datos.id_tipo_evento, datos.id_sede ?? null,
      datos.nombre, datos.fecha, datos.hora_inicio ?? null, datos.cantidad_estimada, datos.necesidades ?? null,
    ]
  );
  return rows[0] ?? null;
};

// Campos de un evento confirmado cuyo cambio queda en cambios_evento.
const CAMPOS_SEGUIDOS = [
  { campo: "fecha", descripcion: "Cambio de fecha" },
  { campo: "id_sede", descripcion: "Cambio de sede" },
  { campo: "cantidad_estimada", descripcion: "Cambio de cantidad estimada" },
];
const ESTADOS_CERRADOS = ["realizado", "cancelado"];
const ESTADOS_YA_EVENTO = ["confirmado", "en_preparacion", "realizado", "cancelado"];

const sonDistintos = (a, b) => {
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() !== new Date(b).getTime();
  return a !== b;
};

const aTexto = (valor) => {
  if (valor === null || valor === undefined) return "sin definir";
  if (valor instanceof Date) {
    // Fecha local (no toISOString: convierte a UTC y puede correr el día)
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, "0");
    const d = String(valor.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(valor);
};

export const update = async (id_empresa, id_evento, datos, id_usuario) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: actuales } = await client.query(
      "SELECT * FROM eventos WHERE id_evento = $1 AND id_empresa = $2 FOR UPDATE",
      [id_evento, id_empresa]
    );
    const actual = actuales[0];
    if (!actual) {
      await client.query("ROLLBACK");
      return { resultado: "no_encontrado" };
    }
    // Un evento cerrado (realizado o cancelado) ya no se edita
    if (ESTADOS_CERRADOS.includes(actual.estado)) {
      await client.query("ROLLBACK");
      return { resultado: "cerrado" };
    }

    if (datos.id_tipo_evento !== undefined) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM tipos_evento WHERE id_tipo_evento = $1 AND id_empresa = $2",
        [datos.id_tipo_evento, id_empresa]
      );
      if (!rowCount) { await client.query("ROLLBACK"); return { resultado: "datos_invalidos" }; }
    }
    if (datos.id_sede !== undefined && datos.id_sede !== null) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM sedes WHERE id_sede = $1 AND id_empresa = $2",
        [datos.id_sede, id_empresa]
      );
      if (!rowCount) { await client.query("ROLLBACK"); return { resultado: "datos_invalidos" }; }
    }
    if (datos.id_contacto !== undefined && datos.id_contacto !== null) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM contactos WHERE id_contacto = $1 AND id_cliente = $2",
        [datos.id_contacto, actual.id_cliente]
      );
      if (!rowCount) { await client.query("ROLLBACK"); return { resultado: "datos_invalidos" }; }
    }

    const nuevo = {
      id_contacto: datos.id_contacto !== undefined ? datos.id_contacto : actual.id_contacto,
      id_tipo_evento: datos.id_tipo_evento !== undefined ? datos.id_tipo_evento : actual.id_tipo_evento,
      id_sede: datos.id_sede !== undefined ? datos.id_sede : actual.id_sede,
      nombre: datos.nombre !== undefined ? datos.nombre : actual.nombre,
      fecha: datos.fecha !== undefined ? datos.fecha : actual.fecha,
      hora_inicio: datos.hora_inicio !== undefined ? datos.hora_inicio : actual.hora_inicio,
      cantidad_estimada: datos.cantidad_estimada !== undefined ? datos.cantidad_estimada : actual.cantidad_estimada,
      necesidades: datos.necesidades !== undefined ? datos.necesidades : actual.necesidades,
    };

    const { rows: actualizados } = await client.query(
      `UPDATE eventos SET
         id_contacto = $1, id_tipo_evento = $2, id_sede = $3, nombre = $4,
         fecha = $5::date, hora_inicio = $6::time, cantidad_estimada = $7, necesidades = $8
       WHERE id_evento = $9 AND id_empresa = $10
       RETURNING *`,
      [
        nuevo.id_contacto, nuevo.id_tipo_evento, nuevo.id_sede, nuevo.nombre,
        nuevo.fecha, nuevo.hora_inicio, nuevo.cantidad_estimada, nuevo.necesidades,
        id_evento, id_empresa,
      ]
    );
    const evento = actualizados[0];

    if (ESTADOS_YA_EVENTO.includes(actual.estado)) {
      for (const { campo, descripcion } of CAMPOS_SEGUIDOS) {
        if (sonDistintos(actual[campo], evento[campo])) {
          await client.query(
            `INSERT INTO cambios_evento (id_evento, id_usuario, descripcion, valor_anterior, valor_nuevo)
             VALUES ($1, $2, $3, $4, $5)`,
            [id_evento, id_usuario, descripcion, aTexto(actual[campo]), aTexto(evento[campo])]
          );
        }
      }
    }

    await client.query("COMMIT");
    return { resultado: "ok", evento };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getCambios = async (id_empresa, id_evento) => {
  const { rows } = await pool.query(
    `SELECT ch.*, u.nombre AS nombre_usuario
       FROM cambios_evento ch
       JOIN eventos e ON e.id_evento = ch.id_evento AND e.id_empresa = $1
       JOIN usuarios u ON u.id_usuario = ch.id_usuario
      WHERE ch.id_evento = $2
      ORDER BY ch.fecha DESC`,
    [id_empresa, id_evento]
  );
  return rows;
};

// Transiciones manuales de estado (las demás las hace propuestas al presentar/aceptar/rechazar).
const TRANSICIONES = {
  falta_informacion: ["recibida"],
  en_preparacion: ["confirmado"],
  realizado: ["confirmado", "en_preparacion"],
};

export const cambiarEstado = async (id_empresa, id_evento, estado, observaciones_cierre) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT estado FROM eventos WHERE id_evento = $1 AND id_empresa = $2 FOR UPDATE",
      [id_evento, id_empresa]
    );
    if (!rows[0]) { await client.query("ROLLBACK"); return "no_encontrado"; }
    if (!TRANSICIONES[estado].includes(rows[0].estado)) {
      await client.query("ROLLBACK");
      return "transicion_invalida";
    }
    await client.query(
      `UPDATE eventos SET estado = $1,
         observaciones_cierre = CASE WHEN $1::varchar = 'realizado' THEN COALESCE($2, observaciones_cierre) ELSE observaciones_cierre END
       WHERE id_evento = $3 AND id_empresa = $4`,
      [estado, observaciones_cierre ?? null, id_evento, id_empresa]
    );
    await client.query("COMMIT");
    return "ok";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// Se cancela un evento abierto: no uno ya cancelado, realizado o con la propuesta no aceptada.
export const ESTADOS_NO_CANCELABLES = ["cancelado", "realizado", "no_aceptada"];

export const cancelar = async (id_empresa, id_evento, motivo) => {
  const { rows } = await pool.query(
    `UPDATE eventos SET estado = 'cancelado', motivo_cancelacion = $1
      WHERE id_evento = $2 AND id_empresa = $3 AND NOT (estado = ANY($4::varchar[]))
     RETURNING *`,
    [motivo, id_evento, id_empresa, ESTADOS_NO_CANCELABLES]
  );
  return rows[0] ?? null;
};
